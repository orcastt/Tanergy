from __future__ import annotations

import json
from copy import deepcopy
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_access import (
    assert_board_page_limit,
    assert_can_create_board,
    assert_can_delete_board,
    assert_can_own_board,
    assert_can_write_board,
    assert_workspace_allows_board_visibility,
    workspace_kind_allows_board_sharing,
)
from tangent_api.board_asset_references import assert_no_postgres_foreign_asset_refs
from tangent_api.board_guard import audit_board_document
from tangent_api.board_metadata import get_board_snapshot_display_title
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardRestoreResponse,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSnapshotCreateRequest,
    BoardSummary,
    get_board_document_metrics,
    normalize_board_card_color,
    normalize_board_description,
    normalize_board_share_id,
    normalize_board_thumbnail_url,
    normalize_board_title,
    normalize_board_visibility,
    summarize_board_record,
)
from tangent_api.storage.postgres_board_codec import sanitize_board_id
from tangent_api.storage.postgres_board_schema import ensure_board_schema
from tangent_api.storage.postgres_board_deletion import soft_delete_board
from tangent_api.storage.postgres_board_store_support import (
    build_board_record,
    connect_to_postgres_via_store as connect_to_postgres,
    copy_title,
)


class PostgresBoardStoreMutationsMixin:
    def save_board(
        self,
        input_data: BoardSaveRequest,
        context: ApiRequestContext,
    ) -> BoardSaveResponse:
        audit = audit_board_document(input_data.document)
        if not audit.ok:
            return BoardSaveResponse(audit=audit, error="Board document failed save guard.", ok=False)
        assert_no_postgres_foreign_asset_refs(input_data.document, context, connect_to_postgres)

        board_id = sanitize_board_id(input_data.board_id) or f"board_{uuid4()}"
        saved_at = datetime.now(timezone.utc).isoformat()
        metrics = get_board_document_metrics(input_data.document)
        assert_board_page_limit(metrics.get("page_count", 1), context)
        self._assert_workspace_active(context)
        existing = self._read_existing_board(board_id, context)
        if existing:
            assert_can_write_board(existing, context, self._load_board_member_role(board_id, context))
        else:
            self._assert_board_not_soft_deleted(board_id, context)
            if not input_data.create_if_missing:
                raise HTTPException(status_code=404, detail="Board not found in workspace.")
            assert_can_create_board(context)
        record = build_board_record(input_data, context, board_id, existing, audit.byte_size, metrics, saved_at)
        if not existing:
            record = record.model_copy(update={"owner_id": self._resolve_new_board_owner_id(context)})

        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    INSERT INTO tangent_boards (
                        id,
                        workspace_id,
                        owner_id,
                        title,
                        document,
                        byte_size,
                        asset_count,
                        shape_count,
                        description,
                        card_color,
                        thumbnail_url,
                        last_opened_at,
                        saved_at,
                        created_at,
                        is_starred,
                        is_pinned,
                        visibility,
                        share_id
                    )
                    VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (workspace_id, id) DO UPDATE SET
                        owner_id = EXCLUDED.owner_id,
                        title = EXCLUDED.title,
                        document = EXCLUDED.document,
                        byte_size = EXCLUDED.byte_size,
                        asset_count = EXCLUDED.asset_count,
                        shape_count = EXCLUDED.shape_count,
                        description = EXCLUDED.description,
                        card_color = EXCLUDED.card_color,
                        thumbnail_url = EXCLUDED.thumbnail_url,
                        is_starred = EXCLUDED.is_starred,
                        is_pinned = EXCLUDED.is_pinned,
                        visibility = EXCLUDED.visibility,
                        share_id = EXCLUDED.share_id,
                        saved_at = EXCLUDED.saved_at
                    """,
                    (
                        record.id,
                        record.workspace_id,
                        record.owner_id,
                        record.title,
                        json.dumps(record.document),
                        record.byte_size,
                        record.asset_count,
                        record.shape_count,
                        record.description,
                        record.card_color,
                        record.thumbnail_url,
                        record.last_opened_at,
                        record.saved_at,
                        record.created_at,
                        record.is_starred,
                        record.is_pinned,
                        record.visibility,
                        record.share_id,
                    ),
                )
                if not existing:
                    cursor.execute(
                        """
                        INSERT INTO tangent_board_members (
                            workspace_id,
                            board_id,
                            user_id,
                            role,
                            invited_by
                        ) VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (workspace_id, board_id, user_id) DO NOTHING
                        """,
                        (record.workspace_id, record.id, record.owner_id, "owner", None),
                    )
            connection.commit()

        return BoardSaveResponse(audit=audit, board=summarize_board_record(record), ok=True)

    def _resolve_new_board_owner_id(self, context: ApiRequestContext) -> str:
        if context.workspace_kind not in {"group_workspace", "team_workspace"}:
            return context.user_id
        if context.workspace_role == "owner":
            return context.user_id
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    SELECT COALESCE(
                        NULLIF(w.owner_id, ''),
                        (
                            SELECT wm.user_id
                            FROM tangent_workspace_members wm
                            WHERE wm.workspace_id = w.id
                              AND wm.role = 'owner'
                            ORDER BY wm.joined_at ASC, wm.user_id ASC
                            LIMIT 1
                        )
                    )
                    FROM tangent_workspaces w
                    WHERE w.id = %s
                    LIMIT 1
                    """,
                    (context.workspace_id,),
                )
                row = cursor.fetchone()
        owner_id = str(row[0]).strip() if row and row[0] else ""
        return owner_id or context.user_id

    def update_board_metadata(
        self,
        board_id: str,
        title: Optional[str],
        description: Optional[str],
        card_color: Optional[str],
        thumbnail_url: Optional[str],
        is_starred: Optional[bool],
        is_pinned: Optional[bool],
        visibility: Optional[str],
        share_id: Optional[str],
        context: ApiRequestContext,
    ) -> BoardSummary:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
        next_title = normalize_board_title(title, record.title) if title is not None else record.title

        saved_at = datetime.now(timezone.utc).isoformat()
        next_description = normalize_board_description(description) if description is not None else record.description
        next_card_color = normalize_board_card_color(card_color) if card_color is not None else record.card_color
        next_thumbnail_url = normalize_board_thumbnail_url(thumbnail_url) if thumbnail_url is not None else record.thumbnail_url
        next_is_starred = bool(is_starred) if is_starred is not None else record.is_starred
        next_is_pinned = bool(is_pinned) if is_pinned is not None else record.is_pinned
        next_visibility = normalize_board_visibility(visibility) if visibility is not None else record.visibility
        assert_workspace_allows_board_visibility(context.workspace_kind, next_visibility)
        next_share_id = normalize_board_share_id(share_id) if share_id is not None else record.share_id
        if not workspace_kind_allows_board_sharing(context.workspace_kind):
            next_share_id = None
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    UPDATE tangent_boards
                    SET title = %s, description = %s, card_color = %s, thumbnail_url = %s,
                        is_starred = %s, is_pinned = %s, visibility = %s, share_id = %s, saved_at = %s
                    WHERE workspace_id = %s AND id = %s
                    """,
                    (
                        next_title,
                        next_description,
                        next_card_color,
                        next_thumbnail_url,
                        next_is_starred,
                        next_is_pinned,
                        next_visibility,
                        next_share_id,
                        saved_at,
                        context.workspace_id,
                        record.id,
                    ),
                )
            connection.commit()

        update = {
            "card_color": next_card_color,
            "description": next_description,
            "is_pinned": next_is_pinned,
            "is_starred": next_is_starred,
            "saved_at": saved_at,
            "share_id": next_share_id,
            "thumbnail_url": next_thumbnail_url,
            "title": next_title,
            "visibility": next_visibility,
        }
        return summarize_board_record(record.model_copy(update=update))

    def delete_board(self, board_id: str, context: ApiRequestContext) -> str:
        record = self._load_board_without_touch(board_id, context, required_access="read")
        assert_can_delete_board(record, context, self._load_board_member_role(record.id, context))
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                soft_delete_board(cursor, context.workspace_id, record.id)
            connection.commit()
        return record.id

    def copy_board(self, board_id: str, context: ApiRequestContext) -> BoardSummary:
        source = self._load_board_without_touch(board_id, context, required_access="read")
        assert_can_own_board(source, context, self._load_board_member_role(source.id, context))
        assert_can_create_board(context)
        copied = self.save_board(
            BoardSaveRequest(
                boardId=None,
                cardColor=source.card_color,
                description=source.description,
                document=deepcopy(source.document),
                thumbnailUrl=source.thumbnail_url,
                title=copy_title(source.title),
            ),
            context,
        )
        if not copied.ok or not copied.board:
            raise HTTPException(status_code=422, detail=copied.error or "Board copy failed.")
        return copied.board

    def restore_snapshot(
        self,
        board_id: str,
        snapshot_id: str,
        context: ApiRequestContext,
    ) -> BoardRestoreResponse:
        from tangent_api.storage.postgres_board_snapshot_store import PostgresBoardSnapshotStore

        record = self._load_board_without_touch(board_id, context, required_access="write")
        snapshots = PostgresBoardSnapshotStore()
        source_snapshot = snapshots.load_snapshot(board_id, snapshot_id, context)
        pre_restore_snapshot = snapshots.create_snapshot(
            board_id,
            BoardSnapshotCreateRequest(
                document=record.document,
                reason="pre_restore",
                thumbnailUrl=record.thumbnail_url,
                title=get_board_snapshot_display_title(record.document, record.title),
            ),
            context,
        )
        restored = self.save_board(
            BoardSaveRequest(
                boardId=record.id,
                cardColor=record.card_color,
                description=record.description,
                document=deepcopy(source_snapshot.document),
                thumbnailUrl=source_snapshot.thumbnail_url or record.thumbnail_url,
                title=record.title,
            ),
            context,
        )
        if not restored.ok or not restored.board:
            raise HTTPException(status_code=422, detail=restored.error or "Board restore failed.")
        board = self.load_board(record.id, context)
        return BoardRestoreResponse(
            board=board,
            ok=True,
            preRestoreSnapshotId=pre_restore_snapshot.id,
            sourceSnapshotId=source_snapshot.id,
        )
