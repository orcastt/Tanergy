from fastapi import APIRouter, Depends

from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.workspace_entitlements import (
    build_workspace_dashboard_response,
    build_workspace_entitlement_response,
)
from tangent_api.workspace_schemas import WorkspaceDashboardResponse, WorkspaceEntitlementResponse

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
