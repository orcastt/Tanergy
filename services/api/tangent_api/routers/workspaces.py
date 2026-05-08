from fastapi import APIRouter, Depends

from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.workspace_invitations import (
    accept_workspace_invitation,
    create_workspace_invitation,
    list_workspace_invitations,
    revoke_workspace_invitation,
)
from tangent_api.workspace_lifecycle import create_group_workspace
from tangent_api.workspace_members import remove_workspace_member
from tangent_api.workspace_entitlements import (
    build_workspace_dashboard_response,
    build_workspace_entitlement_response,
    list_workspace_seat_assignments,
    revoke_workspace_seat_assignment,
    update_workspace_member_role,
    upsert_workspace_seat_assignment,
)
from tangent_api.workspace_schemas import (
    WorkspaceDashboardResponse,
    WorkspaceCreateResponse,
    WorkspaceEntitlementResponse,
    WorkspaceGroupCreateRequest,
    WorkspaceInvitationAcceptResponse,
    WorkspaceInvitationCreateRequest,
    WorkspaceInvitationCreateResponse,
    WorkspaceInvitationResponse,
    WorkspaceInvitationsResponse,
    WorkspaceMemberResponse,
    WorkspaceMemberRoleUpdateRequest,
    WorkspaceSeatAssignmentResponse,
    WorkspaceSeatAssignmentUpsertRequest,
    WorkspaceSeatAssignmentsResponse,
)

router = APIRouter(prefix="/api/v1/workspaces", tags=["workspaces"])


@router.get("/current/dashboard", response_model=WorkspaceDashboardResponse)
def get_current_workspace_dashboard(
    context: ApiRequestContext = Depends(get_request_context),
) -> WorkspaceDashboardResponse:
    return WorkspaceDashboardResponse(dashboard=build_workspace_dashboard_response(context), ok=True)


@router.get("/current/entitlement", response_model=WorkspaceEntitlementResponse)
def get_current_workspace_entitlement(
    context: ApiRequestContext = Depends(get_request_context),
) -> WorkspaceEntitlementResponse:
    return build_workspace_entitlement_response(context)


@router.post("/groups", response_model=WorkspaceCreateResponse)
def post_group_workspace(
    input_data: WorkspaceGroupCreateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> WorkspaceCreateResponse:
    return WorkspaceCreateResponse(workspace=create_group_workspace(input_data.name, context), ok=True)


@router.get("/current/invitations", response_model=WorkspaceInvitationsResponse)
def get_current_workspace_invitations(
    context: ApiRequestContext = Depends(get_request_context),
) -> WorkspaceInvitationsResponse:
    return WorkspaceInvitationsResponse(invitations=list_workspace_invitations(context), ok=True)


@router.post("/current/invitations", response_model=WorkspaceInvitationCreateResponse)
def post_current_workspace_invitation(
    input_data: WorkspaceInvitationCreateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> WorkspaceInvitationCreateResponse:
    return WorkspaceInvitationCreateResponse(
        result=create_workspace_invitation(
            email=input_data.email,
            expires_in_days=input_data.expires_in_days,
            metadata=input_data.metadata,
            role=input_data.role,
            target_user_id=input_data.target_user_id,
            context=context,
        ),
        ok=True,
    )


@router.post("/invitations/{token}/accept", response_model=WorkspaceInvitationAcceptResponse)
def post_workspace_invitation_accept(
    token: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> WorkspaceInvitationAcceptResponse:
    return WorkspaceInvitationAcceptResponse(result=accept_workspace_invitation(token, context), ok=True)


@router.delete("/current/invitations/{invitation_id}", response_model=WorkspaceInvitationResponse)
def delete_current_workspace_invitation(
    invitation_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> WorkspaceInvitationResponse:
    return WorkspaceInvitationResponse(invitation=revoke_workspace_invitation(invitation_id, context), ok=True)


@router.get("/current/seats", response_model=WorkspaceSeatAssignmentsResponse)
def list_current_workspace_seats(
    context: ApiRequestContext = Depends(get_request_context),
) -> WorkspaceSeatAssignmentsResponse:
    return WorkspaceSeatAssignmentsResponse(seats=list_workspace_seat_assignments(context), ok=True)


@router.post("/current/seats", response_model=WorkspaceSeatAssignmentResponse)
def upsert_current_workspace_seat(
    input_data: WorkspaceSeatAssignmentUpsertRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> WorkspaceSeatAssignmentResponse:
    return WorkspaceSeatAssignmentResponse(seat=upsert_workspace_seat_assignment(input_data, context), ok=True)


@router.delete("/current/seats/{user_id}")
def revoke_current_workspace_seat(
    user_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> dict[str, object]:
    return {"ok": True, "userId": revoke_workspace_seat_assignment(user_id, context)}


@router.patch("/current/members/{user_id}", response_model=WorkspaceMemberResponse)
def update_current_workspace_member_role(
    user_id: str,
    input_data: WorkspaceMemberRoleUpdateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> WorkspaceMemberResponse:
    return WorkspaceMemberResponse(member=update_workspace_member_role(user_id, input_data.role, context), ok=True)


@router.delete("/current/members/{user_id}")
def delete_current_workspace_member(
    user_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> dict[str, object]:
    return {"ok": True, "userId": remove_workspace_member(user_id, context)}
