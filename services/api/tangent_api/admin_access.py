import json
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    AdminAuditLogRecord,
    AdminBoardRecord,
    AdminRoleRecord,
    AdminSummaryRecord,
    AdminUserRecord,
    AdminWorkspaceRecord,
)
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
                SELECT ar.role, ar.permissions, ar.note, ar.granted_by, ar.created_at
                FROM tangent_admin_roles ar
                JOIN tangent_users u ON u.id = ar.user_id
                WHERE ar.user_id = %s
                  AND ar.revoked_at IS NULL
                  AND COALESCE(u.status, 'active') = 'active'
                ORDER BY ar.created_at ASC
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


def load_admin_summary() -> AdminSummaryRecord:
    require_database_url()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) FROM tangent_users WHERE status <> 'deleted'")
            users_count = _count_from_row(cursor.fetchone())

            cursor.execute("SELECT COUNT(*) FROM tangent_workspaces WHERE status <> 'deleted'")
            workspaces_count = _count_from_row(cursor.fetchone())

            cursor.execute("SELECT COUNT(*) FROM tangent_boards WHERE deleted_at IS NULL")
            boards_count = _count_from_row(cursor.fetchone())

            cursor.execute("SELECT COUNT(DISTINCT user_id) FROM tangent_admin_roles WHERE revoked_at IS NULL")
            admin_users_count = _count_from_row(cursor.fetchone())

    return AdminSummaryRecord(
        admin_user_count=admin_users_count,
        boards_count=boards_count,
        users_count=users_count,
        workspaces_count=workspaces_count,
    )


def list_admin_users(limit: int) -> list[AdminUserRecord]:
    require_database_url()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, email, display_name, status, locale, created_at, last_login_at
                FROM tangent_users
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cursor.fetchall()

    return [_row_to_admin_user(row) for row in rows]


def list_admin_workspaces(limit: int) -> list[AdminWorkspaceRecord]:
    require_database_url()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, owner_id, status, created_at, COALESCE(kind, 'solo_workspace')
                FROM tangent_workspaces
                WHERE status <> 'deleted'
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cursor.fetchall()

    return [_row_to_admin_workspace(row) for row in rows]


def list_admin_boards(limit: int) -> list[AdminBoardRecord]:
    require_database_url()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, workspace_id, owner_id, title, visibility, saved_at
                FROM tangent_boards
                WHERE deleted_at IS NULL
                ORDER BY saved_at DESC
                LIMIT %s
                """,
                (limit,),
            )
            rows = cursor.fetchall()

    return [_row_to_admin_board(row) for row in rows]


def list_admin_audit_logs(
    *,
    limit: int,
    action: Optional[str] = None,
    actor_user_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
) -> list[AdminAuditLogRecord]:
    require_database_url()
    where: list[str] = []
    params: list[object] = []

    if action:
        where.append("action = %s")
        params.append(action.strip())
    if actor_user_id:
        where.append("actor_user_id = %s")
        params.append(actor_user_id.strip())
    if target_user_id:
        where.append("target_user_id = %s")
        params.append(target_user_id.strip())

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    query = f"""
        SELECT id, actor_user_id, target_user_id, workspace_id, action, metadata, created_at
        FROM tangent_admin_audit_logs
        {where_sql}
        ORDER BY created_at DESC
        LIMIT %s
    """
    params.append(limit)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

    return [_row_to_admin_audit_log(row) for row in rows]


def grant_admin_role(
    *,
    actor_user_id: str,
    target_user_id: str,
    role: str,
    permissions: Optional[dict[str, Any]] = None,
    note: Optional[str] = None,
    reason: str,
    workspace_id: Optional[str] = None,
) -> tuple[AdminRoleRecord, str]:
    require_database_url()
    normalized_role = _normalize_admin_role_name(role)
    normalized_reason = _normalize_admin_mutation_reason(reason)
    coerced_permissions = _coerce_json_dict(permissions)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM tangent_users WHERE id = %s", (target_user_id,))
            if cursor.fetchone() is None:
                raise HTTPException(status_code=404, detail="Target user not found.")
            cursor.execute(
                """
                INSERT INTO tangent_admin_roles (
                    user_id,
                    role,
                    permissions,
                    note,
                    granted_by,
                    revoked_at
                ) VALUES (%s, %s, %s::jsonb, %s, %s, NULL)
                ON CONFLICT (user_id, role) DO UPDATE SET
                    permissions = EXCLUDED.permissions,
                    note = EXCLUDED.note,
                    granted_by = EXCLUDED.granted_by,
                    revoked_at = NULL
                """,
                (
                    target_user_id,
                    normalized_role,
                    json.dumps(coerced_permissions),
                    note,
                    actor_user_id,
                ),
            )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.role.grant",
                actor_user_id=actor_user_id,
                metadata={"permissions": coerced_permissions, "reason": normalized_reason, "role": normalized_role},
                target_user_id=target_user_id,
                workspace_id=workspace_id,
            )
        connection.commit()

    granted = next((item for item in load_active_admin_roles(target_user_id) if item.role == normalized_role), None)
    if granted is None:
        raise HTTPException(status_code=404, detail="Admin role grant failed.")
    return granted, audit_id


def revoke_admin_role(
    *,
    actor_user_id: str,
    target_user_id: str,
    role: str,
    reason: str,
    workspace_id: Optional[str] = None,
) -> tuple[AdminRoleRecord, str]:
    require_database_url()
    normalized_role = _normalize_admin_role_name(role)
    normalized_reason = _normalize_admin_mutation_reason(reason)
    active_roles = load_active_admin_roles(target_user_id)
    target_role = next((item for item in active_roles if item.role == normalized_role), None)
    if target_role is None:
        raise HTTPException(status_code=404, detail="Active admin role not found.")
    if normalized_role == "owner" and _count_active_admin_roles("owner") <= 1:
        raise HTTPException(status_code=400, detail="Cannot revoke the last active owner role.")

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE tangent_admin_roles
                SET revoked_at = NOW()
                WHERE user_id = %s AND role = %s AND revoked_at IS NULL
                """,
                (target_user_id, normalized_role),
            )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.role.revoke",
                actor_user_id=actor_user_id,
                metadata={"reason": normalized_reason, "role": normalized_role},
                target_user_id=target_user_id,
                workspace_id=workspace_id,
            )
        connection.commit()
    return target_role, audit_id


def write_admin_audit_log(
    *,
    action: str,
    actor_user_id: Optional[str],
    metadata: Optional[dict[str, Any]] = None,
    target_user_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> str:
    require_database_url()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            audit_id = _insert_admin_audit_log(
                cursor,
                action=action,
                actor_user_id=actor_user_id,
                metadata=metadata,
                target_user_id=target_user_id,
                workspace_id=workspace_id,
            )
        connection.commit()
    return audit_id


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


def _row_to_admin_user(row: tuple[object, ...]) -> AdminUserRecord:
    return AdminUserRecord(
        created_at=_coerce_timestamp(row[5]),
        display_name=row[2] or "",
        email=row[1],
        id=row[0],
        last_login_at=_coerce_timestamp(row[6]),
        locale=row[4] or "en",
        status=row[3] or "active",
    )


def _row_to_admin_workspace(row: tuple[object, ...]) -> AdminWorkspaceRecord:
    return AdminWorkspaceRecord(
        createdAt=_coerce_timestamp(row[4]),
        id=str(row[0]),
        kind=str(row[5] or "solo_workspace") if len(row) > 5 else "solo_workspace",
        name=str(row[1] or "Untitled Workspace"),
        ownerId=str(row[2]) if row[2] is not None else None,
        status=str(row[3] or "active"),
    )


def _row_to_admin_board(row: tuple[object, ...]) -> AdminBoardRecord:
    return AdminBoardRecord(
        id=str(row[0]),
        ownerId=str(row[2]),
        savedAt=_coerce_timestamp(row[5]) or "",
        title=str(row[3] or "Untitled Board"),
        visibility=str(row[4] or "private"),
        workspaceId=str(row[1]),
    )


def _row_to_admin_audit_log(row: tuple[object, ...]) -> AdminAuditLogRecord:
    metadata = row[5] if isinstance(row[5], dict) else {}
    return AdminAuditLogRecord(
        action=str(row[4]),
        actorUserId=str(row[1]) if row[1] is not None else None,
        createdAt=_coerce_timestamp(row[6]) or "",
        id=str(row[0]),
        metadata=metadata,
        targetUserId=str(row[2]) if row[2] is not None else None,
        workspaceId=str(row[3]) if row[3] is not None else None,
    )


def _count_from_row(row: object) -> int:
    if row is None:
        return 0
    value = row[0] if isinstance(row, (list, tuple)) else row
    return int(value or 0)


def _coerce_timestamp(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _coerce_json_dict(value: Optional[dict[str, Any]]) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _normalize_admin_role_name(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in ADMIN_ACCESS_ROLES:
        raise HTTPException(status_code=400, detail="Invalid admin role.")
    return normalized


def _normalize_admin_mutation_reason(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized:
        raise HTTPException(status_code=400, detail="Admin role mutation reason is required.")
    return normalized[:500]


def _count_active_admin_roles(role: str) -> int:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM tangent_admin_roles ar
                JOIN tangent_users u ON u.id = ar.user_id
                WHERE ar.role = %s
                  AND ar.revoked_at IS NULL
                  AND COALESCE(u.status, 'active') = 'active'
                """,
                (role,),
            )
            row = cursor.fetchone()
    return _count_from_row(row)


def _insert_admin_audit_log(
    cursor: Any,
    *,
    action: str,
    actor_user_id: Optional[str],
    metadata: Optional[dict[str, Any]] = None,
    target_user_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> str:
    audit_id = f"admin_audit_{uuid4()}"
    safe_workspace_id = _coerce_existing_workspace_id(cursor, workspace_id)
    cursor.execute(
        """
        INSERT INTO tangent_admin_audit_logs (
            id,
            actor_user_id,
            target_user_id,
            workspace_id,
            action,
            metadata
        ) VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        """,
        (
            audit_id,
            actor_user_id,
            target_user_id,
            safe_workspace_id,
            action,
            json.dumps(_coerce_json_dict(metadata)),
        ),
    )
    return audit_id


def _coerce_existing_workspace_id(cursor: Any, workspace_id: Optional[str]) -> Optional[str]:
    if not workspace_id:
        return None
    cursor.execute("SELECT 1 FROM tangent_workspaces WHERE id = %s", (workspace_id,))
    return workspace_id if cursor.fetchone() is not None else None
