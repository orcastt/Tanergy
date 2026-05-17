from __future__ import annotations

from typing import Optional

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardMemberCandidateRecord, BoardMemberRecord
from tangent_api.storage.postgres_board_schema import ensure_board_schema
from tangent_api.storage.postgres_board_store_support import connect_to_postgres_via_store as connect_to_postgres


class PostgresBoardStoreMembersMixin:
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
        return [board_member_from_row(row) for row in rows]

    def upsert_member(
        self,
        board_id: str,
        user_id: str,
        role: str,
        display_name: Optional[str],
        context: ApiRequestContext,
    ) -> BoardMemberRecord:
        record = self._load_board_without_touch(board_id, context, required_access="manage")
        normalized_role = normalize_board_member_role(role)
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
        return board_member_from_row(row)

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
        normalized_email = normalize_email(email)
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


def normalize_board_member_role(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in {"owner", "admin", "editor", "viewer", "temporary_viewer"}:
        raise HTTPException(status_code=400, detail="Invalid board member role.")
    return normalized


def board_member_from_row(row: tuple[object, ...]) -> BoardMemberRecord:
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


def normalize_email(value: str) -> str:
    trimmed = value.strip().lower()
    if "@" not in trimmed or "." not in trimmed.split("@", 1)[-1]:
        raise HTTPException(status_code=400, detail="Valid email is required.")
    return trimmed[:320]
