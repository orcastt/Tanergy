from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.schemas import (
    AdminAuditLogRecord,
    AdminBoardRecord,
    AdminRoleRecord,
    AdminSummaryRecord,
    AdminUserRecord,
    AdminWorkspaceRecord,
)


def load_active_admin_roles(
    *,
    db_connect: Any,
    require_database_url: Any,
    user_id: str,
) -> list[AdminRoleRecord]:
    try:
        require_database_url()
    except HTTPException:
        return []

    with db_connect() as connection:
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


def load_admin_summary(*, db_connect: Any, require_database_url: Any) -> AdminSummaryRecord:
    require_database_url()

    with db_connect() as connection:
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


def list_admin_users(*, db_connect: Any, require_database_url: Any, limit: int) -> list[AdminUserRecord]:
    require_database_url()

    with db_connect() as connection:
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


def list_admin_workspaces(*, db_connect: Any, require_database_url: Any, limit: int) -> list[AdminWorkspaceRecord]:
    require_database_url()

    with db_connect() as connection:
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


def list_admin_boards(*, db_connect: Any, require_database_url: Any, limit: int) -> list[AdminBoardRecord]:
    require_database_url()

    with db_connect() as connection:
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
    db_connect: Any,
    require_database_url: Any,
    limit: int,
    action: Optional[str] = None,
    actor_user_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
) -> list[AdminAuditLogRecord]:
    require_database_url()
    where: list[str] = []
    params: list[object] = []

    if action:
        where.append("a.action = %s")
        params.append(action.strip())
    if actor_user_id:
        where.append("a.actor_user_id = %s")
        params.append(actor_user_id.strip())
    if target_user_id:
        where.append("a.target_user_id = %s")
        params.append(target_user_id.strip())

    where_sql = f"WHERE {' AND '.join(where)}" if where else ""
    query = f"""
        SELECT a.id, a.actor_user_id, a.target_user_id, a.workspace_id, a.action, a.metadata, a.created_at,
               actor_user.email, actor_user.display_name,
               target_user.email, target_user.display_name
        FROM tangent_admin_audit_logs a
        LEFT JOIN tangent_users actor_user ON actor_user.id = a.actor_user_id
        LEFT JOIN tangent_users target_user ON target_user.id = a.target_user_id
        {where_sql}
        ORDER BY a.created_at DESC
        LIMIT %s
    """
    params.append(limit)

    with db_connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, tuple(params))
            rows = cursor.fetchall()

    return [_row_to_admin_audit_log(row) for row in rows]


def count_active_admin_roles(*, db_connect: Any, role: str) -> int:
    with db_connect() as connection:
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
        actorDisplayName=str(row[8]) if len(row) > 8 and row[8] is not None else None,
        actorEmail=str(row[7]) if len(row) > 7 and row[7] is not None else None,
        actorUserId=str(row[1]) if row[1] is not None else None,
        createdAt=_coerce_timestamp(row[6]) or "",
        id=str(row[0]),
        metadata=metadata,
        targetDisplayName=str(row[10]) if len(row) > 10 and row[10] is not None else None,
        targetEmail=str(row[9]) if len(row) > 9 and row[9] is not None else None,
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
