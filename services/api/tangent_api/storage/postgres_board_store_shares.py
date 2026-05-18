from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_access import assert_board_allows_share_links, workspace_kind_allows_board_sharing
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardRecord, BoardShareLinkRecord, BoardShareLinkResolveRecord, normalize_board_share_id
from tangent_api.storage.postgres_board_codec import board_record_from_row
from tangent_api.storage.postgres_board_schema import BOARD_SELECT_COLUMNS, ensure_board_schema
from tangent_api.storage.postgres_board_store_support import connect_to_postgres_via_store as connect_to_postgres

BOARD_SHARE_ACCESS_ROLE_PATTERN = {"viewer", "editor"}


class PostgresBoardStoreSharesMixin:
    def ensure_share_link(
        self,
        board_id: str,
        access_role: str,
        context: ApiRequestContext,
        expires_at: Optional[str] = None,
    ) -> BoardShareLinkRecord:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
        assert_board_allows_share_links(record, context.workspace_kind)
        normalized_access_role = normalize_board_share_access_role(access_role)
        normalized_expires_at = normalize_share_expires_at(expires_at)
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    SELECT id, workspace_id, board_id, share_id, access_role, created_by, expires_at, created_at
                    FROM tangent_board_share_links
                    WHERE workspace_id = %s AND board_id = %s AND revoked_at IS NULL
                      AND (expires_at IS NULL OR expires_at > NOW())
                    ORDER BY created_at DESC
                    LIMIT 1
                    """,
                    (context.workspace_id, record.id),
                )
                existing = cursor.fetchone()
                if existing:
                    current_expires_at = existing[6].isoformat() if hasattr(existing[6], "isoformat") else existing[6]
                    if str(existing[4]).strip().lower() != normalized_access_role or current_expires_at != normalized_expires_at:
                        cursor.execute(
                            """
                            UPDATE tangent_board_share_links
                            SET access_role = %s, expires_at = %s
                            WHERE id = %s
                            """,
                            (normalized_access_role, normalized_expires_at, existing[0]),
                        )
                        existing = (
                            existing[0],
                            existing[1],
                            existing[2],
                            existing[3],
                            normalized_access_role,
                            existing[5],
                            normalized_expires_at,
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
                        (
                            share_link_id,
                            context.workspace_id,
                            record.id,
                            share_id,
                            normalized_access_role,
                            context.user_id,
                            normalized_expires_at,
                        ),
                    )
                    existing = (
                        share_link_id,
                        context.workspace_id,
                        record.id,
                        share_id,
                        normalized_access_role,
                        context.user_id,
                        normalized_expires_at,
                        now,
                    )
            connection.commit()
        self.update_board_metadata(record.id, None, None, None, None, None, None, None, str(existing[3]), context)
        return board_share_link_from_row(existing)

    def revoke_share_link(self, board_id: str, share_id: str, context: ApiRequestContext) -> str:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
        normalized_share_id = require_share_id(share_id)
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
        normalized_share_id = require_share_id(share_id)
        record = self._load_shared_board_without_touch(normalized_share_id)
        self._assert_shared_board_is_shareable(record)
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
                      AND b.deleted_at IS NULL
                      AND (sl.expires_at IS NULL OR sl.expires_at > NOW())
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
        normalized_share_id = require_share_id(share_id)
        record = self._load_shared_board_without_touch(normalized_share_id)
        self._assert_shared_board_is_shareable(record)
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
                      AND b.deleted_at IS NULL
                      AND (sl.expires_at IS NULL OR sl.expires_at > NOW())
                    ORDER BY sl.created_at DESC
                    LIMIT 1
                    """,
                    (normalized_share_id,),
                )
                row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Board share link not found.")

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
                    (opened_at, row[1], row[2]),
                )
            connection.commit()
        return board_record_from_row(row).model_copy(update={"last_opened_at": opened_at})

    def _load_shared_board_without_touch(self, share_id: str) -> BoardRecord:
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
                      AND b.deleted_at IS NULL
                      AND (sl.expires_at IS NULL OR sl.expires_at > NOW())
                    ORDER BY sl.created_at DESC
                    LIMIT 1
                    """,
                    (share_id,),
                )
                row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Board share link not found.")
        return board_record_from_row(row)

    def _assert_shared_board_is_shareable(self, record: BoardRecord) -> None:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                ensure_board_schema(cursor)
                cursor.execute(
                    """
                    SELECT COALESCE(kind, 'solo_workspace'), COALESCE(status, 'active')
                    FROM tangent_workspaces
                    WHERE id = %s
                    """,
                    (record.workspace_id,),
                )
                row = cursor.fetchone()
        workspace_kind = str(row[0] or "solo_workspace") if row else "solo_workspace"
        workspace_status = str(row[1] or "active") if row else "active"
        if workspace_status == "deleted" or not workspace_kind_allows_board_sharing(workspace_kind):
            raise HTTPException(status_code=404, detail="Board share link not found.")


def board_share_link_from_row(row: tuple[object, ...]) -> BoardShareLinkRecord:
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


def normalize_board_share_access_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in BOARD_SHARE_ACCESS_ROLE_PATTERN:
        raise HTTPException(status_code=400, detail="Invalid board share access role.")
    return normalized


def normalize_share_expires_at(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    try:
        expires_at = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid board share expiry.") from exc
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Board share expiry must be in the future.")
    return expires_at.isoformat()


def require_share_id(value: str) -> str:
    normalized = normalize_board_share_id(value)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid board share id.")
    return normalized
