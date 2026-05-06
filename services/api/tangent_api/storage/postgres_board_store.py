import json
from copy import deepcopy
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
from tangent_api.board_metadata import get_board_snapshot_display_title
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardMemberCandidateRecord,
    BoardMemberRecord,
    BoardRecord,
    BoardRestoreResponse,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSnapshotCreateRequest,
    BoardShareLinkRecord,
    BoardShareLinkResolveRecord,
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

BOARD_SHARE_ACCESS_ROLE_PATTERN = {"viewer", "editor"}


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
            assert_can_write_board(existing, context, self._load_board_member_role(board_id, context))
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
                            role,
                            invited_by
                        ) VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (workspace_id, board_id, user_id) DO NOTHING
                        """,
                        (record.workspace_id, record.id, record.owner_id, "owner", None),
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
        boards, _ = self.list_boards_paginated(context)
        return boards

    def list_boards_paginated(
        self,
        context: ApiRequestContext,
        cursor: Optional[str] = None,
        limit: int = 50,
    ) -> tuple[list[BoardSummary], Optional[str]]:
        if not can_read_workspace(context):
            return [], None
        member_roles = self._load_workspace_board_member_roles(context) if context.workspace_role == "guest" else {}
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
        summaries = [
            summarize_board_record(record)
            for record in records
            if can_read_board(record, context, member_roles.get(record.id))
        ]
        return _paginate_board_summaries(summaries, cursor, limit)

    def rename_board(self, board_id: str, title: str, context: ApiRequestContext) -> BoardSummary:
        return self.update_board_metadata(board_id, title, None, None, None, None, None, None, None, context)

    def update_board_metadata(
        self, board_id: str, title: Optional[str], description: Optional[str], card_color: Optional[str],
        thumbnail_url: Optional[str], is_starred: Optional[bool], is_pinned: Optional[bool],
        visibility: Optional[str], share_id: Optional[str],
        context: ApiRequestContext,
    ) -> BoardSummary:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
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
        record = self._load_board_without_touch(board_id, context, required_access="manage")
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

    def copy_board(self, board_id: str, context: ApiRequestContext) -> BoardSummary:
        source = self._load_board_without_touch(board_id, context, required_access="read")
        assert_can_create_board(context)
        copied = self.save_board(
            BoardSaveRequest(
                boardId=None,
                cardColor=source.card_color,
                description=source.description,
                document=deepcopy(source.document),
                thumbnailUrl=source.thumbnail_url,
                title=_copy_title(source.title),
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

    def list_members(self, board_id: str, context: ApiRequestContext) -> list[BoardMemberRecord]:
        record = self._load_board_without_touch(board_id, context, required_access="read")
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    SELECT
                        bm.user_id,
                        bm.role,
                        COALESCE(wm.display_name, u.display_name, u.email),
                        u.email,
                        bm.invited_by,
                        bm.joined_at,
                        COALESCE(wm.role, 'member')
                    FROM tangent_board_members bm
                    LEFT JOIN tangent_workspace_members wm
                      ON wm.workspace_id = bm.workspace_id AND wm.user_id = bm.user_id
                    LEFT JOIN tangent_users u
                      ON u.id = bm.user_id
                    WHERE bm.workspace_id = %s AND bm.board_id = %s
                    ORDER BY bm.joined_at ASC
                    """,
                    (context.workspace_id, record.id),
                )
                rows = cursor.fetchall()
        return [_board_member_from_row(row) for row in rows]

    def upsert_member(
        self,
        board_id: str,
        user_id: str,
        role: str,
        display_name: Optional[str],
        context: ApiRequestContext,
    ) -> BoardMemberRecord:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
        normalized_role = _normalize_board_member_role(role)
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    INSERT INTO tangent_board_members (
                        workspace_id,
                        board_id,
                        user_id,
                        role,
                        invited_by
                    )
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (workspace_id, board_id, user_id) DO UPDATE SET
                        role = EXCLUDED.role
                    """,
                    (context.workspace_id, record.id, user_id, normalized_role, context.user_id),
                )
                row = self._select_board_member_row(cursor, context.workspace_id, record.id, user_id, display_name)
            connection.commit()
        if not row:
            raise HTTPException(status_code=404, detail="Board member upsert failed.")
        return _board_member_from_row(row)

    def remove_member(self, board_id: str, user_id: str, context: ApiRequestContext) -> str:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
        if user_id == record.owner_id:
            raise HTTPException(status_code=400, detail="Board owner cannot be removed.")
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    DELETE FROM tangent_board_members
                    WHERE workspace_id = %s AND board_id = %s AND user_id = %s
                    """,
                    (context.workspace_id, record.id, user_id),
                )
            connection.commit()
        return user_id

    def search_member_candidates(
        self,
        board_id: str,
        query: str,
        context: ApiRequestContext,
    ) -> list[BoardMemberCandidateRecord]:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
        normalized_query = query.strip().lower()
        if not normalized_query:
            return []
        like_query = f"%{normalized_query}%"
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    SELECT
                        wm.user_id,
                        u.email,
                        COALESCE(wm.display_name, u.display_name, u.email),
                        wm.role,
                        bm.role
                    FROM tangent_workspace_members wm
                    JOIN tangent_users u
                      ON u.id = wm.user_id
                    LEFT JOIN tangent_board_members bm
                      ON bm.workspace_id = wm.workspace_id
                     AND bm.board_id = %s
                     AND bm.user_id = wm.user_id
                    WHERE wm.workspace_id = %s
                      AND (
                        LOWER(u.email) LIKE %s
                        OR LOWER(COALESCE(wm.display_name, u.display_name, '')) LIKE %s
                        OR LOWER(wm.user_id) LIKE %s
                      )
                    ORDER BY
                        CASE WHEN bm.user_id IS NULL THEN 0 ELSE 1 END,
                        LOWER(COALESCE(wm.display_name, u.display_name, u.email)) ASC
                    LIMIT 12
                    """,
                    (record.id, context.workspace_id, like_query, like_query, like_query),
                )
                rows = cursor.fetchall()
        return [
            BoardMemberCandidateRecord(
                alreadyMember=row[4] is not None,
                boardRole=row[4],
                displayName=row[2],
                email=row[1],
                userId=row[0],
                workspaceRole=row[3],
            )
            for row in rows
        ]

    def invite_member_by_email(
        self,
        board_id: str,
        email: str,
        role: str,
        display_name: Optional[str],
        context: ApiRequestContext,
    ) -> BoardMemberRecord:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
        normalized_email = _normalize_email(email)
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    SELECT
                        wm.user_id,
                        u.email,
                        COALESCE(wm.display_name, u.display_name, u.email),
                        wm.role
                    FROM tangent_workspace_members wm
                    JOIN tangent_users u
                      ON u.id = wm.user_id
                    WHERE wm.workspace_id = %s
                      AND LOWER(u.email) = %s
                    LIMIT 1
                    """,
                    (context.workspace_id, normalized_email),
                )
                person = cursor.fetchone()
        if not person:
            raise HTTPException(status_code=404, detail="Workspace person for that email was not found.")
        preferred_display_name = display_name.strip() if isinstance(display_name, str) and display_name.strip() else person[2]
        return self.upsert_member(board_id, str(person[0]), role, preferred_display_name, context)

    def ensure_share_link(
        self,
        board_id: str,
        access_role: str,
        context: ApiRequestContext,
    ) -> BoardShareLinkRecord:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
        normalized_access_role = _normalize_board_share_access_role(access_role)
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    SELECT id, workspace_id, board_id, share_id, access_role, created_by, expires_at, created_at
                    FROM tangent_board_share_links
                    WHERE workspace_id = %s AND board_id = %s AND revoked_at IS NULL
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (context.workspace_id, record.id),
                )
                existing = cursor.fetchone()
                if existing:
                    if str(existing[4]).strip().lower() != normalized_access_role:
                        cursor.execute(
                            """
                            UPDATE tangent_board_share_links
                            SET access_role = %s
                            WHERE id = %s
                            """,
                            (normalized_access_role, existing[0]),
                        )
                        existing = (
                            existing[0],
                            existing[1],
                            existing[2],
                            existing[3],
                            normalized_access_role,
                            existing[5],
                            existing[6],
                            existing[7],
                        )
                else:
                    now = datetime.now(timezone.utc).isoformat()
                    share_link_id = f"board_share_{uuid4()}"
                    share_id = uuid4().hex[:16]
                    cursor.execute(
                        """
                        INSERT INTO tangent_board_share_links (
                            id,
                            workspace_id,
                            board_id,
                            share_id,
                            access_role,
                            created_by,
                            expires_at
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (share_link_id, context.workspace_id, record.id, share_id, normalized_access_role, context.user_id, None),
                    )
                    existing = (
                        share_link_id,
                        context.workspace_id,
                        record.id,
                        share_id,
                        normalized_access_role,
                        context.user_id,
                        None,
                        now,
                    )
            connection.commit()
        self.update_board_metadata(record.id, None, None, None, None, None, None, None, str(existing[3]), context)
        return _board_share_link_from_row(existing)

    def revoke_share_link(self, board_id: str, share_id: str, context: ApiRequestContext) -> str:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
        normalized_share_id = _require_share_id(share_id)
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    UPDATE tangent_board_share_links
                    SET revoked_at = NOW()
                    WHERE workspace_id = %s AND board_id = %s AND share_id = %s AND revoked_at IS NULL
                    """,
                    (context.workspace_id, record.id, normalized_share_id),
                )
                updated_rows = cursor.rowcount
            connection.commit()
        if updated_rows == 0:
            raise HTTPException(status_code=404, detail="Board share link not found.")
        self.update_board_metadata(record.id, None, None, None, None, None, None, None, "", context)
        return normalized_share_id

    def resolve_share_link(self, share_id: str) -> BoardShareLinkResolveRecord:
        normalized_share_id = _require_share_id(share_id)
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    SELECT sl.share_id, sl.workspace_id, sl.board_id, b.title, sl.access_role
                    FROM tangent_board_share_links sl
                    JOIN tangent_boards b
                      ON b.workspace_id = sl.workspace_id AND b.id = sl.board_id
                    WHERE sl.share_id = %s AND sl.revoked_at IS NULL
                    ORDER BY sl.created_at DESC
                    LIMIT 1
                    """,
                    (normalized_share_id,),
                )
                row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Board share link not found.")
        return BoardShareLinkResolveRecord(
            accessRole=row[4],
            boardId=row[2],
            boardTitle=row[3],
            shareId=row[0],
            workspaceId=row[1],
        )

    def load_shared_board(self, share_id: str) -> BoardRecord:
        normalized_share_id = _require_share_id(share_id)
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    f"""
                    SELECT {BOARD_SELECT_COLUMNS}
                    FROM tangent_board_share_links sl
                    JOIN tangent_boards b
                      ON b.workspace_id = sl.workspace_id AND b.id = sl.board_id
                    WHERE sl.share_id = %s AND sl.revoked_at IS NULL
                    ORDER BY sl.created_at DESC
                    LIMIT 1
                    """,
                    (normalized_share_id,),
                )
                row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Board share link not found.")

        record = board_record_from_row(row)
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
                    (opened_at, record.workspace_id, record.id),
                )
            connection.commit()

        return record.model_copy(update={"last_opened_at": opened_at})

    def _load_board_without_touch(
        self,
        board_id: str,
        context: ApiRequestContext,
        required_access: str = "read",
    ) -> BoardRecord:
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
        member_role = self._load_board_member_role(record.id, context)
        if required_access == "manage":
            assert_can_manage_board(record, context, member_role)
        elif required_access == "write":
            assert_can_write_board(record, context, member_role)
        else:
            assert_can_read_board(record, context, member_role)
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

    def _load_board_member_role(self, board_id: str, context: ApiRequestContext) -> Optional[str]:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT role
                    FROM tangent_board_members
                    WHERE workspace_id = %s AND board_id = %s AND user_id = %s
                    """,
                    (context.workspace_id, board_id, context.user_id),
                )
                row = cursor.fetchone()
        if not row:
            return None
        return str(row[0]).strip().lower()

    def _load_workspace_board_member_roles(self, context: ApiRequestContext) -> dict[str, str]:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    SELECT board_id, role
                    FROM tangent_board_members
                    WHERE workspace_id = %s AND user_id = %s
                    """,
                    (context.workspace_id, context.user_id),
                )
                rows = cursor.fetchall()
        return {str(row[0]): str(row[1]).strip().lower() for row in rows}

    def _select_board_member_row(
        self,
        cursor: object,
        workspace_id: str,
        board_id: str,
        user_id: str,
        display_name: Optional[str],
    ) -> object:
        cursor.execute(
            """
            SELECT
                bm.user_id,
                bm.role,
                COALESCE(%s, wm.display_name, u.display_name, u.email),
                u.email,
                bm.invited_by,
                bm.joined_at,
                COALESCE(wm.role, 'member')
            FROM tangent_board_members bm
            LEFT JOIN tangent_workspace_members wm
              ON wm.workspace_id = bm.workspace_id AND wm.user_id = bm.user_id
            LEFT JOIN tangent_users u
              ON u.id = bm.user_id
            WHERE bm.workspace_id = %s AND bm.board_id = %s AND bm.user_id = %s
            """,
            (display_name, workspace_id, board_id, user_id),
        )
        return cursor.fetchone()


def _paginate_board_summaries(
    summaries: list[BoardSummary],
    cursor: Optional[str],
    limit: int,
) -> tuple[list[BoardSummary], Optional[str]]:
    normalized_limit = max(1, min(limit, 100))
    start_index = 0
    if cursor:
        for index, item in enumerate(summaries):
            if _encode_board_cursor(item) == cursor:
                start_index = index + 1
                break
    page = summaries[start_index:start_index + normalized_limit]
    next_cursor = _encode_board_cursor(page[-1]) if start_index + normalized_limit < len(summaries) and page else None
    return page, next_cursor


def _encode_board_cursor(board: BoardSummary) -> str:
    return f"{board.saved_at.replace('+00:00', 'Z')}|{board.id}"


def _copy_title(title: str) -> str:
    return f"{title} Copy" if title else "Untitled Board Copy"


def _normalize_board_member_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in {"owner", "admin", "editor", "viewer", "temporary_viewer"}:
        raise HTTPException(status_code=400, detail="Invalid board member role.")
    return normalized


def _board_member_from_row(row: tuple[object, ...]) -> BoardMemberRecord:
    joined_at = row[5].isoformat() if hasattr(row[5], "isoformat") else str(row[5])
    return BoardMemberRecord(
        displayName=row[2],
        email=row[3],
        invitedBy=row[4],
        joinedAt=joined_at,
        role=row[1],
        userId=row[0],
        workspaceRole=row[6],
    )


def _board_share_link_from_row(row: tuple[object, ...]) -> BoardShareLinkRecord:
    created_at = row[7].isoformat() if hasattr(row[7], "isoformat") else str(row[7])
    expires_at = row[6].isoformat() if hasattr(row[6], "isoformat") else row[6]
    return BoardShareLinkRecord(
        accessRole=row[4],
        boardId=row[2],
        createdAt=created_at,
        createdBy=row[5],
        expiresAt=expires_at,
        id=row[0],
        shareId=row[3],
        workspaceId=row[1],
    )


def _normalize_board_share_access_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in BOARD_SHARE_ACCESS_ROLE_PATTERN:
        raise HTTPException(status_code=400, detail="Invalid board share access role.")
    return normalized


def _normalize_email(value: str) -> str:
    trimmed = value.strip().lower()
    if "@" not in trimmed or "." not in trimmed.split("@", 1)[-1]:
        raise HTTPException(status_code=400, detail="Valid email is required.")
    return trimmed[:320]


def _require_share_id(value: str) -> str:
    normalized = normalize_board_share_id(value)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid board share id.")
    return normalized
