from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.admin_access import _count_active_admin_roles, _insert_admin_audit_log, load_active_admin_roles
from tangent_api.clerk_admin import delete_clerk_user
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


@dataclass(frozen=True)
class UserAccountDeletionResult:
    audit_id: Optional[str]
    deleted_solo_workspace_ids: tuple[str, ...]
    message: str
    user_id: str
    warning: Optional[str] = None


def delete_user_account(
    *,
    actor_user_id: Optional[str],
    audit_action: Optional[str],
    audit_metadata: Optional[dict[str, Any]],
    reason: str,
    target_user_id: str,
    workspace_id: Optional[str] = None,
) -> UserAccountDeletionResult:
    require_database_url()
    normalized_reason = _normalize_reason(reason)
    deletion_context = _load_user_deletion_context(target_user_id)
    _guard_last_active_owner(target_user_id)

    if deletion_context.status == "deleted":
        raise HTTPException(status_code=400, detail="User is already deleted.")

    owned_non_solo_workspace_ids = _load_owned_non_solo_workspace_ids(target_user_id)
    if owned_non_solo_workspace_ids:
        raise HTTPException(
            status_code=409,
            detail="Transfer or delete owned Team or Group workspaces before deleting this account.",
        )

    shared_workspace_ids = _load_shared_workspace_ids(target_user_id)
    owned_solo_workspace_ids = _load_owned_solo_workspace_ids(target_user_id)

    audit_id = None
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            if actor_user_id and audit_action:
                metadata = dict(audit_metadata or {})
                metadata.update(
                    {
                        "deletedUserId": target_user_id,
                        "deletedSoloWorkspaceIds": list(owned_solo_workspace_ids),
                        "reason": normalized_reason,
                        "sharedWorkspaceIds": list(shared_workspace_ids),
                    }
                )
                audit_id = _insert_admin_audit_log(
                    cursor,
                    action=audit_action,
                    actor_user_id=actor_user_id,
                    metadata=metadata,
                    target_user_id=target_user_id,
                    workspace_id=workspace_id,
                )

            _reassign_shared_workspace_content(cursor, target_user_id, shared_workspace_ids)
            _delete_user_scoped_logs(cursor, target_user_id)
            _delete_user_owned_resources(cursor, target_user_id, owned_solo_workspace_ids)
            _delete_user_credit_accounts(cursor, target_user_id, owned_solo_workspace_ids)
            cursor.execute("DELETE FROM tangent_users WHERE id = %s", (target_user_id,))
        connection.commit()

    warning = None
    if deletion_context.clerk_user_id:
        try:
            delete_clerk_user(deletion_context.clerk_user_id)
        except HTTPException as exc:
            warning = str(exc.detail or "Clerk account deletion failed.")

    return UserAccountDeletionResult(
        audit_id=audit_id,
        deleted_solo_workspace_ids=tuple(owned_solo_workspace_ids),
        message="User deleted.",
        user_id=target_user_id,
        warning=warning,
    )


@dataclass(frozen=True)
class _UserDeletionContext:
    clerk_user_id: Optional[str]
    status: str


def _load_user_deletion_context(user_id: str) -> _UserDeletionContext:
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
    return _UserDeletionContext(clerk_user_id=_optional_str(row[1]), status=str(row[0] or "active"))


def _load_owned_non_solo_workspace_ids(user_id: str) -> list[str]:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id
                FROM tangent_workspaces
                WHERE owner_id = %s
                  AND COALESCE(kind, 'solo_workspace') <> 'solo_workspace'
                  AND COALESCE(status, 'active') <> 'deleted'
                ORDER BY created_at ASC
                """,
                (user_id,),
            )
            rows = cursor.fetchall()
    return [str(row[0]) for row in rows]


def _load_owned_solo_workspace_ids(user_id: str) -> list[str]:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
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
            rows = cursor.fetchall()
    return [str(row[0]) for row in rows]


def _load_shared_workspace_ids(user_id: str) -> list[str]:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
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
            rows = cursor.fetchall()
    return [str(row[0]) for row in rows]


def _reassign_shared_workspace_content(cursor: Any, user_id: str, workspace_ids: list[str]) -> None:
    if not workspace_ids:
        return

    array_value = workspace_ids
    cursor.execute(
        """
        UPDATE tangent_boards b
        SET owner_id = w.owner_id
        FROM tangent_workspaces w
        WHERE b.workspace_id = w.id
          AND b.owner_id = %s
          AND w.id = ANY(%s)
        """,
        (user_id, array_value),
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
        (array_value,),
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
        (user_id, array_value),
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
        (user_id, array_value),
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
        (user_id, array_value),
    )


def _delete_user_scoped_logs(cursor: Any, user_id: str) -> None:
    cursor.execute("DELETE FROM tangent_api_call_logs WHERE user_id = %s", (user_id,))
    cursor.execute("DELETE FROM tangent_analytics_events WHERE user_id = %s", (user_id,))
    cursor.execute("DELETE FROM tangent_moderation_items WHERE created_by = %s", (user_id,))


def _delete_user_owned_resources(cursor: Any, user_id: str, solo_workspace_ids: list[str]) -> None:
    if solo_workspace_ids:
        cursor.execute("DELETE FROM tangent_workspaces WHERE id = ANY(%s)", (solo_workspace_ids,))
    cursor.execute("DELETE FROM tangent_collections WHERE owner_id = %s", (user_id,))


def _delete_user_credit_accounts(cursor: Any, user_id: str, solo_workspace_ids: list[str]) -> None:
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


def _guard_last_active_owner(user_id: str) -> None:
    roles = load_active_admin_roles(user_id)
    if not any(role.role == "owner" for role in roles):
        return
    if _count_active_admin_roles("owner") <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last active owner.")


def _normalize_reason(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized:
        raise HTTPException(status_code=400, detail="Reason is required.")
    return normalized[:500]


def _optional_str(value: object) -> Optional[str]:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None
