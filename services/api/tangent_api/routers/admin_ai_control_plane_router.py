from typing import Optional

from fastapi import APIRouter, Depends, Query

from tangent_api.admin_access import require_admin_role, write_admin_audit_log
from tangent_api.admin_ai_control_plane import (
    list_admin_ai_models,
    list_admin_ai_pricing_rules,
    list_admin_ai_provider_routes,
    update_admin_ai_model,
    update_admin_ai_pricing_rule,
    update_admin_ai_provider_route,
)
from tangent_api.request_context import ApiRequestContext, get_request_context
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
)

router = APIRouter(prefix="/ai")

AI_CONTROL_READ_ROLES = {"owner", "admin", "finance"}
AI_CONTROL_WRITE_ROLES = {"owner", "admin"}


@router.get("/models", response_model=AdminAiModelsResponse)
def get_admin_ai_models(
    limit: int = Query(default=50, ge=1, le=200),
    capability: Optional[str] = Query(default=None, min_length=1),
    enabled: Optional[bool] = Query(default=None),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiModelsResponse:
    roles = require_admin_role(context, allowed_roles=AI_CONTROL_READ_ROLES)
    models = list_admin_ai_models(limit=limit, capability=capability, enabled=enabled)
    write_admin_audit_log(
        action="admin.ai.models.list",
        actor_user_id=context.user_id,
        metadata={"capability": capability, "enabled": enabled, "limit": limit, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminAiModelsResponse(models=models, ok=True)


@router.patch("/models/{model_key}", response_model=AdminAiModelMutationResponse)
def patch_admin_ai_model(
    model_key: str,
    input_data: AdminAiModelUpdateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiModelMutationResponse:
    roles = require_admin_role(context, allowed_roles=AI_CONTROL_WRITE_ROLES)
    model = update_admin_ai_model(model_key, input_data)
    write_admin_audit_log(
        action="admin.ai.model.update",
        actor_user_id=context.user_id,
        metadata={"fields": sorted(input_data.model_fields_set), "modelKey": model_key, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminAiModelMutationResponse(model=model, ok=True)


@router.get("/provider-routes", response_model=AdminAiProviderRoutesResponse)
def get_admin_ai_provider_routes(
    limit: int = Query(default=100, ge=1, le=300),
    model_key: Optional[str] = Query(default=None, alias="modelKey", min_length=1),
    provider_key: Optional[str] = Query(default=None, alias="providerKey", min_length=1),
    enabled: Optional[bool] = Query(default=None),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiProviderRoutesResponse:
    roles = require_admin_role(context, allowed_roles=AI_CONTROL_READ_ROLES)
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


@router.patch("/provider-routes/{route_id}", response_model=AdminAiProviderRouteMutationResponse)
def patch_admin_ai_provider_route(
    route_id: str,
    input_data: AdminAiProviderRouteUpdateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiProviderRouteMutationResponse:
    roles = require_admin_role(context, allowed_roles=AI_CONTROL_WRITE_ROLES)
    route = update_admin_ai_provider_route(route_id, input_data)
    write_admin_audit_log(
        action="admin.ai.provider_route.update",
        actor_user_id=context.user_id,
        metadata={"fields": sorted(input_data.model_fields_set), "roles": [role.role for role in roles], "routeId": route_id},
        workspace_id=context.workspace_id,
    )
    return AdminAiProviderRouteMutationResponse(ok=True, route=route)


@router.get("/pricing-rules", response_model=AdminAiPricingRulesResponse)
def get_admin_ai_pricing_rules(
    limit: int = Query(default=100, ge=1, le=300),
    model_key: Optional[str] = Query(default=None, alias="modelKey", min_length=1),
    tier_key: Optional[str] = Query(default=None, alias="tierKey", min_length=1),
    status: Optional[str] = Query(default=None, min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiPricingRulesResponse:
    roles = require_admin_role(context, allowed_roles=AI_CONTROL_READ_ROLES)
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


@router.patch("/pricing-rules/{rule_id}", response_model=AdminAiPricingRuleMutationResponse)
def patch_admin_ai_pricing_rule(
    rule_id: str,
    input_data: AdminAiPricingRuleUpdateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiPricingRuleMutationResponse:
    roles = require_admin_role(context, allowed_roles=AI_CONTROL_WRITE_ROLES)
    pricing_rule = update_admin_ai_pricing_rule(rule_id, input_data)
    write_admin_audit_log(
        action="admin.ai.pricing_rule.update",
        actor_user_id=context.user_id,
        metadata={"fields": sorted(input_data.model_fields_set), "pricingRuleId": rule_id, "roles": [role.role for role in roles]},
        workspace_id=context.workspace_id,
    )
    return AdminAiPricingRuleMutationResponse(ok=True, pricing_rule=pricing_rule)
