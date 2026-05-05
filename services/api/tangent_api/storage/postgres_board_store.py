import json
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_access import (
    assert_can_create_board,
    assert_can_manage_board,
    assert_can_read_board,
    assert_can_write_board,
    can_read_board,
    can_read_workspace,
)
from tangent_api.board_guard import audit_board_document
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardRecord,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSummary,
    get_board_document_metrics,
    normalize_board_card_color,
    normalize_board_description,
    normalize_board_share_id,
    normalize_board_thumbnail_url,
    normalize_board_visibility,
    summarize_board_record,
)
from tangent_api.storage.postgres_board_codec import board_record_from_row, sanitize_board_id
from tangent_api.storage.postgres_board_schema import BOARD_SELECT_COLUMNS, ensure_board_schema
from tangent_api.storage.postgres_connection import connect_to_postgres


class PostgresBoardStore:
    def save_board(
        self,
        input_data: BoardSaveRequest,
        context: ApiRequestContext,
    ) -> BoardSaveResponse:
        audit = audit_board_document(input_data.document)
        if not audit.ok:
            return BoardSaveResponse(audit=audit, error="Board document failed save guard.", ok=False)

        board_id = sanitize_board_id(input_data.board_id) or f"board_{uuid4()}"
        saved_at = datetime.now(timezone.utc).isoformat()
        metrics = get_board_document_metrics(input_data.document)
        existing = self._read_existing_board(board_id, context)
        if existing:
            assert_can_write_board(existing, context)
        else:
            assert_can_create_board(context)
        record = BoardRecord(
            assetCount=metrics["asset_count"],
            byteSize=audit.byte_size,
            cardColor=normalize_board_card_color(input_data.card_color or (existing.card_color if existing else None)),
            createdAt=existing.created_at if existing else saved_at,
            description=normalize_board_description(input_data.description or (existing.description if existing else None)),
            document=input_data.document,
            id=board_id,
            isPinned=existing.is_pinned if existing else False,
            isStarred=existing.is_starred if existing else False,
            lastOpenedAt=existing.last_opened_at if existing else None,
            ownerId=existing.owner_id if existing else context.user_id,
            savedAt=saved_at,
            shapeCount=metrics["shape_count"],
            shareId=normalize_board_share_id(existing.share_id if existing else None),
            thumbnailUrl=normalize_board_thumbnail_url(input_data.thumbnail_url or (existing.thumbnail_url if existing else None)),
            title=(input_data.title or "Untitled Board").strip() or "Untitled Board",
            visibility=normalize_board_visibility(existing.visibility if existing else None),
            workspaceId=context.workspace_id,
        )

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
                            role
                        ) VALUES (%s, %s, %s, 'owner')
                        ON CONFLICT (workspace_id, board_id, user_id) DO NOTHING
                        """,
                        (record.workspace_id, record.id, record.owner_id),
                    )
            connection.commit()

        return BoardSaveResponse(audit=audit, board=summarize_board_record(record), ok=True)

    def load_board(self, board_id: str, context: ApiRequestContext) -> BoardRecord:
        safe_board_id = sanitize_board_id(board_id)
        if not safe_board_id:
            raise HTTPException(status_code=400, detail="Invalid board id.")

        record = self._load_board_without_touch(safe_board_id, context)
        opened_at = datetime.now(timezone.utc).isoformat()
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    UPDATE tangent_boards
                    SET last_opened_at = %s
                    WHERE workspace_id = %s AND id = %s
                    """,
                    (opened_at, context.workspace_id, safe_board_id),
                )
            connection.commit()

        return record.model_copy(update={"last_opened_at": opened_at})

    def list_boards(self, context: ApiRequestContext) -> list[BoardSummary]:
        if not can_read_workspace(context):
            return []
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    f"""
                    SELECT {BOARD_SELECT_COLUMNS}
                    FROM tangent_boards
                    WHERE workspace_id = %s
                    ORDER BY saved_at DESC
                    """,
                    (context.workspace_id,),
                )
                rows = cursor.fetchall()
        records = [board_record_from_row(row) for row in rows]
        return [summarize_board_record(record) for record in records if can_read_board(record, context)]

    def rename_board(self, board_id: str, title: str, context: ApiRequestContext) -> BoardSummary:
        return self.update_board_metadata(board_id, title, None, None, None, None, None, None, None, context)

    def update_board_metadata(
        self, board_id: str, title: Optional[str], description: Optional[str], card_color: Optional[str],
        thumbnail_url: Optional[str], is_starred: Optional[bool], is_pinned: Optional[bool],
        visibility: Optional[str], share_id: Optional[str],
        context: ApiRequestContext,
    ) -> BoardSummary:
        record = self._load_board_without_touch(board_id, context)
        assert_can_manage_board(record, context)
        next_title = title.strip() if title is not None else record.title
        if not next_title:
            raise HTTPException(status_code=400, detail="Board title is required.")
        if len(next_title) > 80:
            raise HTTPException(status_code=400, detail="Board title must be 80 characters or fewer.")

        saved_at = datetime.now(timezone.utc).isoformat()
        next_description = normalize_board_description(description) if description is not None else record.description
        next_card_color = normalize_board_card_color(card_color) if card_color is not None else record.card_color
        next_thumbnail_url = normalize_board_thumbnail_url(thumbnail_url) if thumbnail_url is not None else record.thumbnail_url
        next_is_starred = bool(is_starred) if is_starred is not None else record.is_starred
        next_is_pinned = bool(is_pinned) if is_pinned is not None else record.is_pinned
        next_visibility = normalize_board_visibility(visibility) if visibility is not None else record.visibility
        next_share_id = normalize_board_share_id(share_id) if share_id is not None else record.share_id
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
                        next_title, next_description, next_card_color, next_thumbnail_url,
                        next_is_starred, next_is_pinned, next_visibility, next_share_id,
                        saved_at, context.workspace_id, record.id,
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
        record = self._load_board_without_touch(board_id, context)
        assert_can_manage_board(record, context)
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    DELETE FROM tangent_boards
                    WHERE workspace_id = %s AND id = %s
                    """,
                    (context.workspace_id, record.id),
                )
            connection.commit()
        return record.id

    def _load_board_without_touch(self, board_id: str, context: ApiRequestContext) -> BoardRecord:
        safe_board_id = sanitize_board_id(board_id)
        if not safe_board_id:
            raise HTTPException(status_code=400, detail="Invalid board id.")

        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    f"""
                    SELECT {BOARD_SELECT_COLUMNS}
                    FROM tangent_boards
                    WHERE workspace_id = %s AND id = %s
                    """,
                    (context.workspace_id, safe_board_id),
                )
                row = cursor.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Board not found in workspace.")
        record = board_record_from_row(row)
        assert_can_read_board(record, context)
        return record

    def _read_existing_board(self, board_id: str, context: ApiRequestContext) -> Optional[BoardRecord]:
        try:
            return self._load_board_without_touch(board_id, context)
        except HTTPException as exc:
            if exc.status_code == 404:
                return None
            raise
        except Exception:
            return None
