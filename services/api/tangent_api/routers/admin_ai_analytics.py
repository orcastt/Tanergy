from typing import Optional

from fastapi import APIRouter, Depends, Query

from tangent_api.admin_access import require_admin_role, write_admin_audit_log
from tangent_api.admin_ai_analytics import list_admin_ai_route_metrics
from tangent_api.admin_ai_analytics_schemas import AdminAiRouteMetricsResponse
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/api/v1/admin/ai", tags=["admin"])

AI_ANALYTICS_ROLES = {"owner", "admin", "support", "analyst", "finance"}


@router.get("/route-metrics", response_model=AdminAiRouteMetricsResponse)
def get_admin_ai_route_metrics(
    capability: Optional[str] = Query(default=None, min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiRouteMetricsResponse:
    roles = require_admin_role(context, allowed_roles=AI_ANALYTICS_ROLES)
    metrics = list_admin_ai_route_metrics(capability=capability, limit=limit)
    write_admin_audit_log(
        action="admin.ai.route_metrics.list",
        actor_user_id=context.user_id,
        metadata={"capability": capability, "limit": limit, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return metrics
