from typing import Optional

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AdminRoleRecord
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

ADMIN_ACCESS_ROLES = {"owner", "admin", "support", "analyst", "finance", "moderator"}


def load_active_admin_roles(user_id: str) -> list[AdminRoleRecord]:
    try:
        require_database_url()
    except HTTPException:
        return []

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT role, permissions, note, granted_by, created_at
                FROM tangent_admin_roles
                WHERE user_id = %s AND revoked_at IS NULL
                ORDER BY created_at ASC
                """,
                (user_id,),
            )
            rows = cursor.fetchall()

    return [_row_to_admin_role(row) for row in rows]


def is_global_admin(user_id: str) -> bool:
    return any(role.role in ADMIN_ACCESS_ROLES for role in load_active_admin_roles(user_id))


def require_admin_role(
    context: ApiRequestContext,
    allowed_roles: Optional[set[str]] = None,
) -> list[AdminRoleRecord]:
    try:
        require_database_url()
    except HTTPException as exc:
        raise HTTPException(status_code=503, detail="Admin access requires Postgres configuration.") from exc

    roles = load_active_admin_roles(context.user_id)
    if not roles:
        raise HTTPException(status_code=403, detail="Admin role required.")

    if allowed_roles and not any(role.role in allowed_roles for role in roles):
        raise HTTPException(status_code=403, detail="Admin role does not grant this action.")
    return roles


def _row_to_admin_role(row: tuple[object, ...]) -> AdminRoleRecord:
    created_at = row[4].isoformat() if hasattr(row[4], "isoformat") else str(row[4])
    permissions = row[1] if isinstance(row[1], dict) else {}
    return AdminRoleRecord(
        createdAt=created_at,
        grantedBy=row[3],
        note=row[2],
        permissions=permissions,
        role=row[0],
    )
