from fastapi import APIRouter, Depends, Query

from tangent_api.admin_access import (
    grant_admin_role,
    load_active_admin_roles,
    require_admin_role,
    revoke_admin_role,
    write_admin_audit_log,
)
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import AdminRoleGrantRequest, AdminRoleListResponse, AdminRoleMutationResponse

router = APIRouter()


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
    require_admin_role(context, allowed_roles={"owner", "admin"})
    granted, audit_id = grant_admin_role(
        actor_user_id=context.user_id,
        target_user_id=payload.user_id,
        role=payload.role,
        permissions=payload.permissions,
        note=payload.note,
        reason=payload.reason,
        workspace_id=context.workspace_id,
    )
    return AdminRoleMutationResponse(auditId=audit_id, ok=True, role=granted, userId=payload.user_id)


@router.delete("/roles/{user_id}/{role}", response_model=AdminRoleMutationResponse)
def delete_admin_role(
    user_id: str,
    role: str,
    reason: str = Query(min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminRoleMutationResponse:
    require_admin_role(context, allowed_roles={"owner", "admin"})
    revoked, audit_id = revoke_admin_role(
        actor_user_id=context.user_id,
        target_user_id=user_id,
        role=role,
        reason=reason,
        workspace_id=context.workspace_id,
    )
    return AdminRoleMutationResponse(auditId=audit_id, ok=True, role=revoked, userId=user_id)
