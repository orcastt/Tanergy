import os
import re
from typing import Optional

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.workspace_entitlement_policy import optional_iso
from tangent_api.workspace_schemas import WorkspaceDashboardMember

ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
WORKSPACE_DASHBOARD_MEMBER_LIMIT = 200


def can_see_team_member_usage(context: ApiRequestContext) -> bool:
    return context.workspace_kind == "team_workspace" and context.workspace_role in {"owner", "admin"}


def update_workspace_member_role(user_id: str, role: str, context: ApiRequestContext) -> WorkspaceDashboardMember:
    return update_workspace_member_role_with_connections(
        user_id,
        role,
        context,
        connect_to_postgres_fn=connect_to_postgres,
        require_database_url_fn=require_database_url,
    )


def update_workspace_member_role_with_connections(
    user_id: str,
    role: str,
    context: ApiRequestContext,
    *,
    connect_to_postgres_fn: object,
    require_database_url_fn: object,
) -> WorkspaceDashboardMember:
    assert_can_manage_workspace_members(context)
    normalized_user_id = normalize_id(user_id, "user id")
    normalized_role = normalize_workspace_role(role)
    require_database_url_fn()

    with connect_to_postgres_fn() as connection:
        with connection.cursor() as cursor:
            current_member = load_workspace_member_row(cursor, context.workspace_id, normalized_user_id)
            if current_member is None:
                raise HTTPException(status_code=404, detail="Workspace member not found.")
            current_role = str(current_member[3])
            assert_role_mutation_allowed(context.workspace_role, normalized_user_id, context.user_id, current_role, normalized_role)
            cursor.execute(
                """
                UPDATE tangent_workspace_members
                SET role = %s
                WHERE workspace_id = %s
                  AND user_id = %s
                """,
                (normalized_role, context.workspace_id, normalized_user_id),
            )
            row = load_workspace_member_row(cursor, context.workspace_id, normalized_user_id)
        connection.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace member not found.")
    usage_by_user = (
        load_workspace_usage_map(context.workspace_id, connect_to_postgres_fn=connect_to_postgres_fn)
        if can_see_team_member_usage(context)
        else {}
    )
    return workspace_dashboard_member_from_row(row, usage_by_user.get(normalized_user_id), can_see_team_member_usage(context))


def load_workspace_dashboard_members_from_db(
    context: ApiRequestContext,
    can_see_member_usage: bool,
    *,
    connect_to_postgres_fn: object = connect_to_postgres,
) -> list[WorkspaceDashboardMember]:
    with connect_to_postgres_fn() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT wm.user_id,
                       u.email,
                       COALESCE(wm.display_name, u.display_name, u.email),
                       wm.role,
                       wm.joined_at,
                       wm.invited_by
                FROM tangent_workspace_members wm
                LEFT JOIN tangent_users u ON u.id = wm.user_id
                WHERE wm.workspace_id = %s
                ORDER BY CASE wm.role
                    WHEN 'owner' THEN 0
                    WHEN 'admin' THEN 1
                    WHEN 'editor' THEN 2
                    WHEN 'member' THEN 3
                    WHEN 'viewer' THEN 4
                    WHEN 'guest' THEN 5
                    ELSE 6
                END,
                wm.joined_at ASC
                LIMIT %s
                """,
                (context.workspace_id, WORKSPACE_DASHBOARD_MEMBER_LIMIT),
            )
            rows = cursor.fetchall()[:WORKSPACE_DASHBOARD_MEMBER_LIMIT]
    if not rows:
        usage_by_user = (
            load_workspace_usage_map(
                context.workspace_id,
                [context.user_id],
                connect_to_postgres_fn=connect_to_postgres_fn,
            )
            if can_see_member_usage
            else {}
        )
        return [context_workspace_dashboard_member(context, can_see_member_usage, usage_by_user.get(context.user_id, 0))]
    member_user_ids = [str(row[0]) for row in rows if row[0] not in (None, "")]
    usage_by_user = (
        load_workspace_usage_map(
            context.workspace_id,
            member_user_ids,
            connect_to_postgres_fn=connect_to_postgres_fn,
        )
        if can_see_member_usage
        else {}
    )
    return [
        workspace_dashboard_member_from_row(row, usage_by_user.get(str(row[0])), can_see_member_usage)
        for row in rows
    ]


def context_workspace_dashboard_member(
    context: ApiRequestContext,
    can_see_member_usage: bool,
    usage: int = 0,
) -> WorkspaceDashboardMember:
    return WorkspaceDashboardMember(
        displayName=context.user_display_name,
        email=context.user_email,
        invitedBy=None,
        joinedAt=None,
        role=context.workspace_role,
        usageThisCycle=usage if can_see_member_usage else None,
        userId=context.user_id,
    )


def load_workspace_usage_map(
    workspace_id: str,
    user_ids: Optional[list[str]] = None,
    *,
    connect_to_postgres_fn: object = connect_to_postgres,
) -> dict[str, int]:
    if not os.getenv("DATABASE_URL"):
        return {}
    normalized_user_ids = sorted({user_id for user_id in (user_ids or []) if user_id})
    user_filter = "AND actor_user_id = ANY(%s)" if normalized_user_ids else ""
    params: tuple[object, ...] = (workspace_id, normalized_user_ids) if normalized_user_ids else (workspace_id,)
    with connect_to_postgres_fn() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT actor_user_id,
                       COALESCE(SUM(CASE WHEN credits_delta < 0 THEN -credits_delta ELSE 0 END), 0)
                FROM tangent_credit_ledger
                WHERE workspace_id = %s
                  AND actor_user_id IS NOT NULL
                  {user_filter}
                GROUP BY actor_user_id
                """,
                params,
            )
            rows = cursor.fetchall()
    allowed = set(normalized_user_ids)
    return {
        str(row[0]): int(float(row[1] or 0))
        for row in rows
        if not allowed or str(row[0]) in allowed
    }


def workspace_dashboard_member_from_row(
    row: tuple[object, ...],
    usage_this_cycle: Optional[int],
    can_see_member_usage: bool,
) -> WorkspaceDashboardMember:
    return WorkspaceDashboardMember(
        displayName=str(row[2] or row[1] or row[0]),
        email=str(row[1]) if row[1] else None,
        invitedBy=str(row[5]) if len(row) > 5 and row[5] else None,
        joinedAt=optional_iso(row[4]) if len(row) > 4 else None,
        role=str(row[3]),
        usageThisCycle=usage_this_cycle if can_see_member_usage else None,
        userId=str(row[0]),
    )


def load_workspace_member_row(cursor: object, workspace_id: str, user_id: str) -> Optional[tuple[object, ...]]:
    cursor.execute(
        """
        SELECT wm.user_id,
               u.email,
               COALESCE(wm.display_name, u.display_name, u.email),
               wm.role,
               wm.joined_at,
               wm.invited_by
        FROM tangent_workspace_members wm
        LEFT JOIN tangent_users u ON u.id = wm.user_id
        WHERE wm.workspace_id = %s
          AND wm.user_id = %s
        LIMIT 1
        """,
        (workspace_id, user_id),
    )
    return cursor.fetchone()


def assert_can_manage_workspace_members(context: ApiRequestContext) -> None:
    if context.workspace_kind not in {"group_workspace", "team_workspace", "enterprise_workspace"}:
        raise HTTPException(status_code=403, detail="Workspace member management is unavailable for this workspace.")
    if context.workspace_role not in {"admin", "owner"}:
        raise HTTPException(status_code=403, detail="Workspace role cannot manage workspace members.")


def normalize_id(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized or not ID_PATTERN.match(normalized) or ".." in normalized:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return normalized


def normalize_workspace_role(value: str) -> str:
    normalized = value.strip()
    if normalized not in {"admin", "editor", "viewer", "guest", "member"}:
        raise HTTPException(status_code=400, detail="Invalid workspace role.")
    return normalized


def assert_role_mutation_allowed(
    actor_role: str,
    target_user_id: str,
    actor_user_id: str,
    current_role: str,
    next_role: str,
) -> None:
    if current_role == "owner":
        raise HTTPException(status_code=400, detail="Owner role cannot be changed here.")
    if target_user_id == actor_user_id and current_role == "admin" and next_role != "admin":
        raise HTTPException(status_code=400, detail="Admins cannot demote themselves.")
    if actor_role != "owner":
        if next_role == "admin":
            raise HTTPException(status_code=403, detail="Only owners can grant admin role.")
        if current_role == "admin":
            raise HTTPException(status_code=403, detail="Only owners can change another admin role.")
