from typing import Optional

from fastapi import APIRouter, Depends, Query

from tangent_api.admin_access import require_admin_role, write_admin_audit_log
from tangent_api.admin_ai_runtime_reads import list_admin_ai_api_calls, list_admin_ai_runs
from tangent_api.admin_ai_runtime_schemas import AdminAiApiCallsResponse, AdminAiRunsResponse
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/ai")


@router.get("/runs", response_model=AdminAiRunsResponse)
def get_admin_ai_runs(
    limit: int = Query(default=100, ge=1, le=300),
    board_id: Optional[str] = Query(default=None, alias="boardId", min_length=1),
    model_id: Optional[str] = Query(default=None, alias="modelId", min_length=1),
    preflight_status: Optional[str] = Query(default=None, alias="preflightStatus", min_length=1),
    pricing_rule_id: Optional[str] = Query(default=None, alias="pricingRuleId", min_length=1),
    provider: Optional[str] = Query(default=None, min_length=1),
    route_id: Optional[str] = Query(default=None, alias="routeId", min_length=1),
    route_key: Optional[str] = Query(default=None, alias="routeKey", min_length=1),
    run_id: Optional[str] = Query(default=None, alias="runId", min_length=1),
    run_type: Optional[str] = Query(default=None, alias="runType", min_length=1),
    status: Optional[str] = Query(default=None, min_length=1),
    workspace_id: Optional[str] = Query(default=None, alias="workspaceId", min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiRunsResponse:
    roles = require_admin_role(context)
    runs = list_admin_ai_runs(
        limit=limit,
        board_id=board_id,
        model_id=model_id,
        preflight_status=preflight_status,
        pricing_rule_id=pricing_rule_id,
        provider=provider,
        route_id=route_id,
        route_key=route_key,
        run_id=run_id,
        run_type=run_type,
        status=status,
        workspace_id=workspace_id,
    )
    write_admin_audit_log(
        action="admin.ai.runs.list",
        actor_user_id=context.user_id,
        metadata={
            "boardId": board_id,
            "limit": limit,
            "modelId": model_id,
            "preflightStatus": preflight_status,
            "pricingRuleId": pricing_rule_id,
            "provider": provider,
            "roles": [role.role for role in roles],
            "routeId": route_id,
            "routeKey": route_key,
            "runId": run_id,
            "runType": run_type,
            "status": status,
            "workspaceId": workspace_id,
        },
        workspace_id=context.workspace_id,
    )
    return AdminAiRunsResponse(ok=True, runs=runs)


@router.get("/api-calls", response_model=AdminAiApiCallsResponse)
def get_admin_ai_api_calls(
    limit: int = Query(default=100, ge=1, le=300),
    board_id: Optional[str] = Query(default=None, alias="boardId", min_length=1),
    error_code: Optional[str] = Query(default=None, alias="errorCode", min_length=1),
    model_id: Optional[str] = Query(default=None, alias="modelId", min_length=1),
    provider: Optional[str] = Query(default=None, min_length=1),
    pricing_rule_id: Optional[str] = Query(default=None, alias="pricingRuleId", min_length=1),
    route_id: Optional[str] = Query(default=None, alias="routeId", min_length=1),
    route_key: Optional[str] = Query(default=None, alias="routeKey", min_length=1),
    run_id: Optional[str] = Query(default=None, alias="runId", min_length=1),
    status: Optional[str] = Query(default=None, min_length=1),
    workspace_id: Optional[str] = Query(default=None, alias="workspaceId", min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiApiCallsResponse:
    roles = require_admin_role(context)
    api_calls = list_admin_ai_api_calls(
        limit=limit,
        board_id=board_id,
        error_code=error_code,
        model_id=model_id,
        pricing_rule_id=pricing_rule_id,
        provider=provider,
        route_id=route_id,
        route_key=route_key,
        run_id=run_id,
        status=status,
        workspace_id=workspace_id,
    )
    write_admin_audit_log(
        action="admin.ai.api_calls.list",
        actor_user_id=context.user_id,
        metadata={
            "boardId": board_id,
            "errorCode": error_code,
            "limit": limit,
            "modelId": model_id,
            "pricingRuleId": pricing_rule_id,
            "provider": provider,
            "roles": [role.role for role in roles],
            "routeId": route_id,
            "routeKey": route_key,
            "runId": run_id,
            "status": status,
            "workspaceId": workspace_id,
        },
        workspace_id=context.workspace_id,
    )
    return AdminAiApiCallsResponse(apiCalls=api_calls, ok=True)
