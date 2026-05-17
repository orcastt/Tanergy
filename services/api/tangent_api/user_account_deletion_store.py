from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.storage.postgres_connection import connect_to_postgres


@dataclass(frozen=True)
class UserDeletionContext:
    clerk_user_id: Optional[str]
    status: str


def load_user_deletion_context(user_id: str) -> UserDeletionContext:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT
                    COALESCE(u.status, 'active'),
                    (
                        SELECT ui.provider_subject
                        FROM tangent_user_identities ui
                        WHERE ui.user_id = u.id
                          AND ui.provider = 'clerk'
                        ORDER BY ui.created_at ASC
                        LIMIT 1
                    )
                FROM tangent_users u
                WHERE u.id = %s
                LIMIT 1
                """,
                (user_id,),
            )
            row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return UserDeletionContext(clerk_user_id=_optional_str(row[1]), status=str(row[0] or "active"))


def load_owned_solo_workspace_ids(user_id: str) -> list[str]:
    return [
        str(row[0])
        for row in _fetchall(
            """
            SELECT id
            FROM tangent_workspaces
            WHERE owner_id = %s
              AND COALESCE(kind, 'solo_workspace') = 'solo_workspace'
              AND COALESCE(status, 'active') <> 'deleted'
            ORDER BY created_at ASC
            """,
            (user_id,),
        )
    ]


def load_shared_workspace_ids(user_id: str) -> list[str]:
    rows = _fetchall(
        """
        SELECT DISTINCT workspace_id
        FROM (
            SELECT b.workspace_id
            FROM tangent_boards b
            WHERE b.owner_id = %s
            UNION
            SELECT a.workspace_id
            FROM tangent_assets a
            WHERE a.created_by = %s
            UNION
            SELECT s.workspace_id
            FROM tangent_board_snapshots s
            WHERE s.created_by = %s
            UNION
            SELECT r.workspace_id
            FROM tangent_ai_runs r
            WHERE r.created_by = %s
            UNION
            SELECT wm.workspace_id
            FROM tangent_workspace_members wm
            WHERE wm.user_id = %s
        ) shared_workspaces
        JOIN tangent_workspaces w ON w.id = shared_workspaces.workspace_id
        WHERE w.owner_id <> %s
          AND COALESCE(w.kind, 'solo_workspace') <> 'solo_workspace'
          AND COALESCE(w.status, 'active') <> 'deleted'
        ORDER BY workspace_id
        """,
        (user_id, user_id, user_id, user_id, user_id, user_id),
    )
    return [str(row[0]) for row in rows]


def reassign_shared_workspace_content(cursor: Any, user_id: str, workspace_ids: list[str]) -> None:
    if not workspace_ids:
        return
    cursor.execute(
        """
        UPDATE tangent_boards b
        SET owner_id = w.owner_id
        FROM tangent_workspaces w
        WHERE b.workspace_id = w.id
          AND b.owner_id = %s
          AND w.id = ANY(%s)
        """,
        (user_id, workspace_ids),
    )
    cursor.execute(
        """
        INSERT INTO tangent_board_members (workspace_id, board_id, user_id, role)
        SELECT b.workspace_id, b.id, w.owner_id, 'owner'
        FROM tangent_boards b
        JOIN tangent_workspaces w ON w.id = b.workspace_id
        WHERE b.owner_id = w.owner_id
          AND w.id = ANY(%s)
        ON CONFLICT (workspace_id, board_id, user_id) DO UPDATE SET role = 'owner'
        """,
        (workspace_ids,),
    )
    cursor.execute(
        """
        UPDATE tangent_assets a
        SET created_by = w.owner_id
        FROM tangent_workspaces w
        WHERE a.workspace_id = w.id
          AND a.created_by = %s
          AND w.id = ANY(%s)
        """,
        (user_id, workspace_ids),
    )
    cursor.execute(
        """
        UPDATE tangent_board_snapshots s
        SET created_by = w.owner_id
        FROM tangent_workspaces w
        WHERE s.workspace_id = w.id
          AND s.created_by = %s
          AND w.id = ANY(%s)
        """,
        (user_id, workspace_ids),
    )
    cursor.execute(
        """
        UPDATE tangent_ai_runs r
        SET created_by = w.owner_id
        FROM tangent_workspaces w
        WHERE r.workspace_id = w.id
          AND r.created_by = %s
          AND w.id = ANY(%s)
        """,
        (user_id, workspace_ids),
    )


def delete_user_scoped_logs(cursor: Any, user_id: str) -> None:
    cursor.execute("DELETE FROM tangent_api_call_logs WHERE user_id = %s", (user_id,))
    cursor.execute("DELETE FROM tangent_analytics_events WHERE user_id = %s", (user_id,))
    cursor.execute("DELETE FROM tangent_moderation_items WHERE created_by = %s", (user_id,))


def delete_user_owned_resources(cursor: Any, user_id: str, solo_workspace_ids: list[str]) -> None:
    if solo_workspace_ids:
        cursor.execute("DELETE FROM tangent_workspaces WHERE id = ANY(%s)", (solo_workspace_ids,))
    cursor.execute("DELETE FROM tangent_collections WHERE owner_id = %s", (user_id,))


def delete_user_credit_accounts(cursor: Any, user_id: str, solo_workspace_ids: list[str]) -> None:
    cursor.execute(
        """
        DELETE FROM tangent_credit_accounts
        WHERE owner_type = 'user'
          AND owner_id = %s
        """,
        (user_id,),
    )
    if solo_workspace_ids:
        cursor.execute(
            """
            DELETE FROM tangent_credit_accounts
            WHERE owner_type = 'workspace'
              AND owner_id = ANY(%s)
            """,
            (solo_workspace_ids,),
        )


def _fetchall(query: str, params: tuple[object, ...]) -> list[tuple[object, ...]]:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()


def _optional_str(value: object) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None
