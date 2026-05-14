from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from tangent_api.admin_access import require_admin_role
from tangent_api.admin_operator_board_writes import (
    copy_admin_operator_board,
    delete_admin_operator_board as delete_admin_operator_board_write,
)
from tangent_api.admin_operator_member_writes import (
    create_admin_operator_workspace_member,
    remove_admin_operator_workspace_member,
    update_admin_operator_workspace_member_role,
)
from tangent_api.admin_operator_reads import get_admin_operator_user_detail, list_admin_operator_users
from tangent_api.admin_operator_schemas import (
    AdminOperatorBoardMutationResponse,
    AdminOperatorReasonRequest,
    AdminOperatorSubscriptionMutationResponse,
    AdminOperatorUserDetailResponse,
    AdminOperatorUserMutationResponse,
    AdminOperatorUserStatusRequest,
    AdminOperatorUsersResponse,
    AdminOperatorWorkspaceInvitationCreateRequest,
    AdminOperatorWorkspaceInvitationCreateResponse,
    AdminOperatorWorkspaceInvitationResponse,
    AdminOperatorWorkspaceInvitationsResponse,
    AdminOperatorWorkspaceMemberCreateRequest,
    AdminOperatorWorkspaceMemberMutationResponse,
    AdminOperatorWorkspaceMemberRoleRequest,
)
from tangent_api.admin_operator_subscription_writes import (
    freeze_admin_operator_subscription,
    unfreeze_admin_operator_subscription,
)
from tangent_api.admin_operator_workspace_invites import (
    create_admin_operator_workspace_invitation,
    list_admin_operator_workspace_invitations,
    revoke_admin_operator_workspace_invitation,
)
from tangent_api.admin_operator_writes import soft_delete_admin_operator_user, set_admin_operator_user_status
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/api/v1/admin/operator", tags=["admin"])

OPERATOR_READ_ROLES = {"owner", "admin", "support", "analyst", "finance"}
OPERATOR_WRITE_ROLES = {"owner", "admin", "support"}


@router.get("/users", response_model=AdminOperatorUsersResponse)
def get_admin_operator_users(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=5000),
    search: Optional[str] = Query(default=None, min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorUsersResponse:
    require_admin_role(context, allowed_roles=OPERATOR_READ_ROLES)
    users, total_count = list_admin_operator_users(limit=limit, offset=offset, search=search)
    return AdminOperatorUsersResponse(ok=True, limit=limit, offset=offset, totalCount=total_count, users=users)


@router.get("/users/{user_id}", response_model=AdminOperatorUserDetailResponse)
def get_admin_operator_user_detail_route(
    user_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorUserDetailResponse:
    require_admin_role(context, allowed_roles=OPERATOR_READ_ROLES)
    detail = get_admin_operator_user_detail(user_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return AdminOperatorUserDetailResponse(ok=True, detail=detail)


@router.post("/users/{user_id}/status", response_model=AdminOperatorUserMutationResponse)
def post_admin_operator_user_status(
    user_id: str,
    payload: AdminOperatorUserStatusRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorUserMutationResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return set_admin_operator_user_status(
        actor_user_id=context.user_id,
        reason=payload.reason,
        status=payload.status,
        user_id=user_id,
        workspace_id=context.workspace_id,
    )


@router.post("/users/{user_id}/delete", response_model=AdminOperatorUserMutationResponse)
def post_admin_operator_user_delete(
    user_id: str,
    payload: AdminOperatorReasonRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorUserMutationResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return soft_delete_admin_operator_user(
        actor_user_id=context.user_id,
        reason=payload.reason,
        user_id=user_id,
        workspace_id=context.workspace_id,
    )


@router.post("/subscriptions/{subscription_id}/freeze", response_model=AdminOperatorSubscriptionMutationResponse)
def post_admin_operator_subscription_freeze(
    subscription_id: str,
    payload: AdminOperatorReasonRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorSubscriptionMutationResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return freeze_admin_operator_subscription(
        actor_user_id=context.user_id,
        reason=payload.reason,
        subscription_id=subscription_id,
        workspace_id=context.workspace_id,
    )


@router.post("/subscriptions/{subscription_id}/unfreeze", response_model=AdminOperatorSubscriptionMutationResponse)
def post_admin_operator_subscription_unfreeze(
    subscription_id: str,
    payload: AdminOperatorReasonRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorSubscriptionMutationResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return unfreeze_admin_operator_subscription(
        actor_user_id=context.user_id,
        reason=payload.reason,
        subscription_id=subscription_id,
        workspace_id=context.workspace_id,
    )


@router.patch("/workspaces/{workspace_id}/members/{user_id}", response_model=AdminOperatorWorkspaceMemberMutationResponse)
def patch_admin_operator_workspace_member_role(
    workspace_id: str,
    user_id: str,
    payload: AdminOperatorWorkspaceMemberRoleRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorWorkspaceMemberMutationResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return update_admin_operator_workspace_member_role(
        actor_user_id=context.user_id,
        reason=payload.reason,
        role=payload.role,
        user_id=user_id,
        workspace_id=workspace_id,
    )


@router.post("/workspaces/{workspace_id}/members", response_model=AdminOperatorWorkspaceMemberMutationResponse)
def post_admin_operator_workspace_member(
    workspace_id: str,
    payload: AdminOperatorWorkspaceMemberCreateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorWorkspaceMemberMutationResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return create_admin_operator_workspace_member(
        actor_user_id=context.user_id,
        reason=payload.reason,
        role=payload.role,
        user_id=payload.user_id,
        workspace_id=workspace_id,
    )


@router.delete("/workspaces/{workspace_id}/members/{user_id}", response_model=AdminOperatorWorkspaceMemberMutationResponse)
def delete_admin_operator_workspace_member(
    workspace_id: str,
    user_id: str,
    payload: AdminOperatorReasonRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorWorkspaceMemberMutationResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return remove_admin_operator_workspace_member(
        actor_user_id=context.user_id,
        reason=payload.reason,
        user_id=user_id,
        workspace_id=workspace_id,
    )


@router.get("/workspaces/{workspace_id}/invitations", response_model=AdminOperatorWorkspaceInvitationsResponse)
def get_admin_operator_workspace_invitations(
    workspace_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorWorkspaceInvitationsResponse:
    require_admin_role(context, allowed_roles=OPERATOR_READ_ROLES)
    invitations = list_admin_operator_workspace_invitations(workspace_id)
    return AdminOperatorWorkspaceInvitationsResponse(invitations=invitations, ok=True, workspaceId=workspace_id)


@router.post("/workspaces/{workspace_id}/invitations", response_model=AdminOperatorWorkspaceInvitationCreateResponse)
def post_admin_operator_workspace_invitation(
    workspace_id: str,
    payload: AdminOperatorWorkspaceInvitationCreateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorWorkspaceInvitationCreateResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return create_admin_operator_workspace_invitation(
        actor_user_id=context.user_id,
        email=payload.email,
        expires_in_days=payload.expires_in_days,
        metadata=payload.metadata,
        reason=payload.reason,
        role=payload.role,
        target_user_id=payload.target_user_id,
        workspace_id=workspace_id,
    )


@router.delete("/workspaces/{workspace_id}/invitations/{invitation_id}", response_model=AdminOperatorWorkspaceInvitationResponse)
def delete_admin_operator_workspace_invitation(
    workspace_id: str,
    invitation_id: str,
    payload: AdminOperatorReasonRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorWorkspaceInvitationResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return revoke_admin_operator_workspace_invitation(
        actor_user_id=context.user_id,
        invitation_id=invitation_id,
        reason=payload.reason,
        workspace_id=workspace_id,
    )


@router.post("/workspaces/{workspace_id}/boards/{board_id}/copy", response_model=AdminOperatorBoardMutationResponse)
def post_admin_operator_board_copy(
    workspace_id: str,
    board_id: str,
    payload: AdminOperatorReasonRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorBoardMutationResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return copy_admin_operator_board(
        actor_user_id=context.user_id,
        board_id=board_id,
        reason=payload.reason,
        workspace_id=workspace_id,
    )


@router.delete("/workspaces/{workspace_id}/boards/{board_id}", response_model=AdminOperatorBoardMutationResponse)
def delete_admin_operator_board_route(
    workspace_id: str,
    board_id: str,
    payload: AdminOperatorReasonRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminOperatorBoardMutationResponse:
    require_admin_role(context, allowed_roles=OPERATOR_WRITE_ROLES)
    return delete_admin_operator_board_write(
        actor_user_id=context.user_id,
        board_id=board_id,
        reason=payload.reason,
        workspace_id=workspace_id,
    )
