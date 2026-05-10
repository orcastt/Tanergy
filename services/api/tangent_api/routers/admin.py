from typing import Optional

from fastapi import APIRouter, Depends, Query

from tangent_api.admin_ai_control_plane import (
    list_admin_ai_models,
    list_admin_ai_pricing_rules,
    list_admin_ai_provider_routes,
    update_admin_ai_model,
    update_admin_ai_pricing_rule,
    update_admin_ai_provider_route,
)
from tangent_api.admin_ai_control_plane_schemas import (
    AdminAiControlPlaneVersionsResponse,
    AdminAiPublishRequest,
    AdminAiVersionMutationResponse,
)
from tangent_api.admin_ai_versions import list_admin_ai_versions, publish_admin_ai_version, rollback_admin_ai_version
from tangent_api.admin_ai_runtime_reads import list_admin_ai_api_calls, list_admin_ai_runs
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
from tangent_api.admin_ai_runtime_schemas import AdminAiApiCallsResponse, AdminAiRunsResponse
from tangent_api.schemas import (
    AdminAiModelsResponse,
    AdminAiModelMutationResponse,
    AdminAiModelUpdateRequest,
    AdminAiPricingRuleMutationResponse,
    AdminAiPricingRuleUpdateRequest,
    AdminAiPricingRulesResponse,
    AdminAiProviderRouteMutationResponse,
    AdminAiProviderRouteUpdateRequest,
    AdminAiProviderRoutesResponse,
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


@router.get("/ai/models", response_model=AdminAiModelsResponse)
def get_admin_ai_models(
    limit: int = Query(default=50, ge=1, le=200),
    capability: Optional[str] = Query(default=None, min_length=1),
    enabled: Optional[bool] = Query(default=None),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiModelsResponse:
    roles = require_admin_role(context)
    models = list_admin_ai_models(limit=limit, capability=capability, enabled=enabled)
    write_admin_audit_log(
        action="admin.ai.models.list",
        actor_user_id=context.user_id,
        metadata={"capability": capability, "enabled": enabled, "limit": limit, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminAiModelsResponse(models=models, ok=True)


@router.patch("/ai/models/{model_key}", response_model=AdminAiModelMutationResponse)
def patch_admin_ai_model(
    model_key: str,
    input_data: AdminAiModelUpdateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiModelMutationResponse:
    roles = require_admin_role(context, allowed_roles={"owner", "admin"})
    model = update_admin_ai_model(model_key, input_data)
    write_admin_audit_log(
        action="admin.ai.model.update",
        actor_user_id=context.user_id,
        metadata={"fields": sorted(input_data.model_fields_set), "modelKey": model_key, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminAiModelMutationResponse(model=model, ok=True)


@router.get("/ai/provider-routes", response_model=AdminAiProviderRoutesResponse)
def get_admin_ai_provider_routes(
    limit: int = Query(default=100, ge=1, le=300),
    model_key: Optional[str] = Query(default=None, alias="modelKey", min_length=1),
    provider_key: Optional[str] = Query(default=None, alias="providerKey", min_length=1),
    enabled: Optional[bool] = Query(default=None),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiProviderRoutesResponse:
    roles = require_admin_role(context)
    routes = list_admin_ai_provider_routes(
        limit=limit,
        model_key=model_key,
        provider_key=provider_key,
        enabled=enabled,
    )
    write_admin_audit_log(
        action="admin.ai.provider_routes.list",
        actor_user_id=context.user_id,
        metadata={
            "enabled": enabled,
            "limit": limit,
            "modelKey": model_key,
            "providerKey": provider_key,
            "roles": [role.role for role in roles],
        },
        workspace_id=context.workspace_id,
    )
    return AdminAiProviderRoutesResponse(ok=True, routes=routes)


@router.patch("/ai/provider-routes/{route_id}", response_model=AdminAiProviderRouteMutationResponse)
def patch_admin_ai_provider_route(
    route_id: str,
    input_data: AdminAiProviderRouteUpdateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiProviderRouteMutationResponse:
    roles = require_admin_role(context, allowed_roles={"owner", "admin"})
    route = update_admin_ai_provider_route(route_id, input_data)
    write_admin_audit_log(
        action="admin.ai.provider_route.update",
        actor_user_id=context.user_id,
        metadata={"fields": sorted(input_data.model_fields_set), "roles": [role.role for role in roles], "routeId": route_id},
        workspace_id=context.workspace_id,
    )
    return AdminAiProviderRouteMutationResponse(ok=True, route=route)


@router.get("/ai/pricing-rules", response_model=AdminAiPricingRulesResponse)
def get_admin_ai_pricing_rules(
    limit: int = Query(default=100, ge=1, le=300),
    model_key: Optional[str] = Query(default=None, alias="modelKey", min_length=1),
    tier_key: Optional[str] = Query(default=None, alias="tierKey", min_length=1),
    status: Optional[str] = Query(default=None, min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiPricingRulesResponse:
    roles = require_admin_role(context)
    pricing_rules = list_admin_ai_pricing_rules(limit=limit, model_key=model_key, tier_key=tier_key, status=status)
    write_admin_audit_log(
        action="admin.ai.pricing_rules.list",
        actor_user_id=context.user_id,
        metadata={
            "limit": limit,
            "modelKey": model_key,
            "roles": [role.role for role in roles],
            "status": status,
            "tierKey": tier_key,
        },
        workspace_id=context.workspace_id,
    )
    return AdminAiPricingRulesResponse(ok=True, pricingRules=pricing_rules)


@router.patch("/ai/pricing-rules/{rule_id}", response_model=AdminAiPricingRuleMutationResponse)
def patch_admin_ai_pricing_rule(
    rule_id: str,
    input_data: AdminAiPricingRuleUpdateRequest,
    context: ApiRequestContext = Depends(get_request_context),
    ) -> AdminAiPricingRuleMutationResponse:
    roles = require_admin_role(context, allowed_roles={"owner", "admin"})
    pricing_rule = update_admin_ai_pricing_rule(rule_id, input_data)
    write_admin_audit_log(
        action="admin.ai.pricing_rule.update",
        actor_user_id=context.user_id,
        metadata={"fields": sorted(input_data.model_fields_set), "pricingRuleId": rule_id, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminAiPricingRuleMutationResponse(ok=True, pricing_rule=pricing_rule)


@router.get("/ai/versions", response_model=AdminAiControlPlaneVersionsResponse)
def get_admin_ai_versions(
    resource_type: str = Query(alias="resourceType", min_length=1),
    resource_id: str = Query(alias="resourceId", min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiControlPlaneVersionsResponse:
    roles = require_admin_role(context)
    versions = list_admin_ai_versions(resource_type, resource_id, limit)
    write_admin_audit_log(
        action="admin.ai.versions.list",
        actor_user_id=context.user_id,
        metadata={
            "limit": limit,
            "resourceId": resource_id,
            "resourceType": resource_type,
            "roles": [role.role for role in roles],
        },
        workspace_id=context.workspace_id,
    )
    return AdminAiControlPlaneVersionsResponse(ok=True, versions=versions)


@router.post("/ai/models/{model_key}/publish", response_model=AdminAiVersionMutationResponse)
def publish_admin_ai_model(
    model_key: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles={"owner", "admin"})
    version = publish_admin_ai_version(
        "model",
        model_key,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        note=payload.note,
    )
    write_admin_audit_log(
        action="admin.ai.model.publish",
        actor_user_id=context.user_id,
        metadata={"modelKey": model_key, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminAiVersionMutationResponse(ok=True, version=version)


@router.post("/ai/models/{model_key}/rollback/{version_id}", response_model=AdminAiVersionMutationResponse)
def rollback_admin_ai_model(
    model_key: str,
    version_id: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles={"owner", "admin"})
    version = rollback_admin_ai_version(
        "model",
        model_key,
        version_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        note=payload.note,
    )
    write_admin_audit_log(
        action="admin.ai.model.rollback",
        actor_user_id=context.user_id,
        metadata={"modelKey": model_key, "roles": [role.role for role in roles], "versionId": version_id},
        workspace_id=context.workspace_id,
    )
    return AdminAiVersionMutationResponse(ok=True, version=version)


@router.post("/ai/provider-routes/{route_id}/publish", response_model=AdminAiVersionMutationResponse)
def publish_admin_ai_provider_route(
    route_id: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles={"owner", "admin"})
    version = publish_admin_ai_version(
        "provider_route",
        route_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        note=payload.note,
    )
    write_admin_audit_log(
        action="admin.ai.provider_route.publish",
        actor_user_id=context.user_id,
        metadata={"roles": [role.role for role in roles], "routeId": route_id},
        workspace_id=context.workspace_id,
    )
    return AdminAiVersionMutationResponse(ok=True, version=version)


@router.post("/ai/provider-routes/{route_id}/rollback/{version_id}", response_model=AdminAiVersionMutationResponse)
def rollback_admin_ai_provider_route(
    route_id: str,
    version_id: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles={"owner", "admin"})
    version = rollback_admin_ai_version(
        "provider_route",
        route_id,
        version_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        note=payload.note,
    )
    write_admin_audit_log(
        action="admin.ai.provider_route.rollback",
        actor_user_id=context.user_id,
        metadata={"roles": [role.role for role in roles], "routeId": route_id, "versionId": version_id},
        workspace_id=context.workspace_id,
    )
    return AdminAiVersionMutationResponse(ok=True, version=version)


@router.post("/ai/pricing-rules/{rule_id}/publish", response_model=AdminAiVersionMutationResponse)
def publish_admin_ai_pricing_rule(
    rule_id: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles={"owner", "admin"})
    version = publish_admin_ai_version(
        "pricing_rule",
        rule_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        note=payload.note,
    )
    write_admin_audit_log(
        action="admin.ai.pricing_rule.publish",
        actor_user_id=context.user_id,
        metadata={"pricingRuleId": rule_id, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminAiVersionMutationResponse(ok=True, version=version)


@router.post("/ai/pricing-rules/{rule_id}/rollback/{version_id}", response_model=AdminAiVersionMutationResponse)
def rollback_admin_ai_pricing_rule(
    rule_id: str,
    version_id: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles={"owner", "admin"})
    version = rollback_admin_ai_version(
        "pricing_rule",
        rule_id,
        version_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        note=payload.note,
    )
    write_admin_audit_log(
        action="admin.ai.pricing_rule.rollback",
        actor_user_id=context.user_id,
        metadata={"pricingRuleId": rule_id, "roles": [role.role for role in roles], "versionId": version_id},
        workspace_id=context.workspace_id,
    )
    return AdminAiVersionMutationResponse(ok=True, version=version)


@router.get("/ai/runs", response_model=AdminAiRunsResponse)
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


@router.get("/ai/api-calls", response_model=AdminAiApiCallsResponse)
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
