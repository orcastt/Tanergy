from typing import Optional

from fastapi import APIRouter, Depends, Query

from tangent_api.admin_access import require_admin_role
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
    require_admin_role(context, allowed_roles=AI_ANALYTICS_ROLES)
    metrics = list_admin_ai_route_metrics(capability=capability, limit=limit)
    return metrics
