import re
from typing import Optional

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import require_database_url

ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
MANAGER_ROLES = {"owner", "admin"}


def remove_workspace_member(user_id: str, context: ApiRequestContext) -> str:
    _assert_can_manage_workspace_members(context)
    normalized_user_id = _normalize_id(user_id, "user id")
    if normalized_user_id == context.user_id:
        raise HTTPException(status_code=400, detail="Workspace members cannot remove themselves.")
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            current_role = _load_workspace_member_role(cursor, context.workspace_id, normalized_user_id)
            if current_role is None:
                raise HTTPException(status_code=404, detail="Workspace member not found.")
            _assert_remove_allowed(context.workspace_role, current_role)
            cursor.execute(
                """
                DELETE FROM tangent_workspace_members
                WHERE workspace_id = %s
                  AND user_id = %s
                """,
                (context.workspace_id, normalized_user_id),
            )
            if context.workspace_kind == "team_workspace":
                cursor.execute(
                    """
                    UPDATE tangent_workspace_seat_assignments
                    SET status = 'revoked',
                        updated_at = NOW()
                    WHERE workspace_id = %s
                      AND user_id = %s
                      AND status <> 'revoked'
                    """,
                    (context.workspace_id, normalized_user_id),
                )
        connection.commit()
    return normalized_user_id


def _assert_can_manage_workspace_members(context: ApiRequestContext) -> None:
    if context.workspace_kind not in {"group_workspace", "team_workspace", "enterprise_workspace"}:
        raise HTTPException(status_code=403, detail="Workspace member management is unavailable for this workspace.")
    if context.workspace_role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Workspace role cannot manage workspace members.")


def _load_workspace_member_role(cursor: object, workspace_id: str, user_id: str) -> Optional[str]:
    cursor.execute(
        """
        SELECT role
        FROM tangent_workspace_members
        WHERE workspace_id = %s
          AND user_id = %s
        LIMIT 1
        """,
        (workspace_id, user_id),
    )
    row = cursor.fetchone()
    return str(row[0]) if row else None


def _assert_remove_allowed(actor_role: str, target_role: str) -> None:
    if target_role == "owner":
        raise HTTPException(status_code=400, detail="Owner role cannot be removed here.")
    if actor_role != "owner" and target_role == "admin":
        raise HTTPException(status_code=403, detail="Only owners can remove admins.")


def _normalize_id(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized or not ID_PATTERN.match(normalized) or ".." in normalized:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return normalized
