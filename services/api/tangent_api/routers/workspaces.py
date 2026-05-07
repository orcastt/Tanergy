from fastapi import APIRouter, Depends

from tangent_api.request_context import ApiRequestContext, get_request_context
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
    WorkspaceEntitlementResponse,
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
