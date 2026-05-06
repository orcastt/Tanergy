from typing import Optional

from fastapi import APIRouter, Depends, Query

from tangent_api.admin_access import (
    grant_admin_role,
    list_admin_audit_logs,
    list_admin_boards,
    list_admin_users,
    list_admin_workspaces,
    load_active_admin_roles,
    load_admin_summary,
    require_admin_role,
    revoke_admin_role,
    write_admin_audit_log,
)
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import (
    AdminAuditLogsResponse,
    AdminBoardsResponse,
    AdminMeResponse,
    AdminRoleGrantRequest,
    AdminRoleListResponse,
    AdminRoleMutationResponse,
    AdminSummaryResponse,
    AdminUsersResponse,
    AdminWorkspacesResponse,
)

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/me", response_model=AdminMeResponse)
def get_admin_me(
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminMeResponse:
    roles = load_active_admin_roles(context.user_id)
    return AdminMeResponse(
        canAccessAdmin=bool(roles),
        ok=True,
        roles=roles,
        userId=context.user_id,
    )


@router.get("/summary", response_model=AdminSummaryResponse)
def get_admin_summary(
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminSummaryResponse:
    roles = require_admin_role(context)
    summary = load_admin_summary()
    write_admin_audit_log(
        action="admin.summary.read",
        actor_user_id=context.user_id,
        metadata={"roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminSummaryResponse(ok=True, summary=summary)


@router.get("/users", response_model=AdminUsersResponse)
def get_admin_users(
    limit: int = Query(default=25, ge=1, le=100),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminUsersResponse:
    roles = require_admin_role(context)
    users = list_admin_users(limit)
    write_admin_audit_log(
        action="admin.users.list",
        actor_user_id=context.user_id,
        metadata={"limit": limit, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminUsersResponse(ok=True, users=users)


@router.get("/workspaces", response_model=AdminWorkspacesResponse)
def get_admin_workspaces(
    limit: int = Query(default=25, ge=1, le=100),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminWorkspacesResponse:
    roles = require_admin_role(context)
    workspaces = list_admin_workspaces(limit)
    write_admin_audit_log(
        action="admin.workspaces.list",
        actor_user_id=context.user_id,
        metadata={"limit": limit, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminWorkspacesResponse(ok=True, workspaces=workspaces)


@router.get("/boards", response_model=AdminBoardsResponse)
def get_admin_boards(
    limit: int = Query(default=25, ge=1, le=100),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminBoardsResponse:
    roles = require_admin_role(context)
    boards = list_admin_boards(limit)
    write_admin_audit_log(
        action="admin.boards.list",
        actor_user_id=context.user_id,
        metadata={"limit": limit, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminBoardsResponse(ok=True, boards=boards)


@router.get("/audit-logs", response_model=AdminAuditLogsResponse)
def get_admin_audit_logs(
    limit: int = Query(default=25, ge=1, le=100),
    action: Optional[str] = Query(default=None, min_length=1),
    actor_user_id: Optional[str] = Query(default=None, alias="actorUserId", min_length=1),
    target_user_id: Optional[str] = Query(default=None, alias="targetUserId", min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAuditLogsResponse:
    roles = require_admin_role(context)
    logs = list_admin_audit_logs(
        limit=limit,
        action=action,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
    )
    write_admin_audit_log(
        action="admin.audit.list",
        actor_user_id=context.user_id,
        metadata={
            "action": action,
            "actorUserId": actor_user_id,
            "limit": limit,
            "roles": [role.role for role in roles],
            "targetUserId": target_user_id,
        },
        workspace_id=context.workspace_id,
    )
    return AdminAuditLogsResponse(ok=True, logs=logs)


@router.get("/roles", response_model=AdminRoleListResponse)
def get_admin_roles_for_user(
    user_id: str = Query(alias="userId", min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminRoleListResponse:
    roles = require_admin_role(context)
    write_admin_audit_log(
        action="admin.roles.read",
        actor_user_id=context.user_id,
        metadata={"roles": [role.role for role in roles], "targetUserId": user_id},
        workspace_id=context.workspace_id,
    )
    return AdminRoleListResponse(ok=True, roles=load_active_admin_roles(user_id), userId=user_id)


@router.post("/roles", response_model=AdminRoleMutationResponse)
def post_admin_role(
    payload: AdminRoleGrantRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminRoleMutationResponse:
    require_admin_role(context, allowed_roles={"owner"})
    granted, audit_id = grant_admin_role(
        actor_user_id=context.user_id,
        target_user_id=payload.user_id,
        role=payload.role,
        permissions=payload.permissions,
        note=payload.note,
        workspace_id=context.workspace_id,
    )
    return AdminRoleMutationResponse(auditId=audit_id, ok=True, role=granted, userId=payload.user_id)


@router.delete("/roles/{user_id}/{role}", response_model=AdminRoleMutationResponse)
def delete_admin_role(
    user_id: str,
    role: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminRoleMutationResponse:
    require_admin_role(context, allowed_roles={"owner"})
    revoked, audit_id = revoke_admin_role(
        actor_user_id=context.user_id,
        target_user_id=user_id,
        role=role,
        workspace_id=context.workspace_id,
    )
    return AdminRoleMutationResponse(auditId=audit_id, ok=True, role=revoked, userId=user_id)
