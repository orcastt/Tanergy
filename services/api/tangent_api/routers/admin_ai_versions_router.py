from fastapi import APIRouter, Depends, Query

from tangent_api.admin_access import require_admin_role, write_admin_audit_log
from tangent_api.admin_ai_control_plane_schemas import (
    AdminAiControlPlaneVersionsResponse,
    AdminAiPublishRequest,
    AdminAiVersionMutationResponse,
)
from tangent_api.admin_ai_versions import list_admin_ai_versions, publish_admin_ai_version, rollback_admin_ai_version
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/ai")

AI_VERSION_READ_ROLES = {"owner", "admin", "finance"}
AI_VERSION_WRITE_ROLES = {"owner", "admin"}


@router.get("/versions", response_model=AdminAiControlPlaneVersionsResponse)
def get_admin_ai_versions(
    resource_type: str = Query(alias="resourceType", min_length=1),
    resource_id: str = Query(alias="resourceId", min_length=1),
    limit: int = Query(default=20, ge=1, le=100),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiControlPlaneVersionsResponse:
    roles = require_admin_role(context, allowed_roles=AI_VERSION_READ_ROLES)
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


@router.post("/models/{model_key}/publish", response_model=AdminAiVersionMutationResponse)
def publish_admin_ai_model(
    model_key: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles=AI_VERSION_WRITE_ROLES)
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


@router.post("/models/{model_key}/rollback/{version_id}", response_model=AdminAiVersionMutationResponse)
def rollback_admin_ai_model(
    model_key: str,
    version_id: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles=AI_VERSION_WRITE_ROLES)
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


@router.post("/provider-routes/{route_id}/publish", response_model=AdminAiVersionMutationResponse)
def publish_admin_ai_provider_route(
    route_id: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles=AI_VERSION_WRITE_ROLES)
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


@router.post("/provider-routes/{route_id}/rollback/{version_id}", response_model=AdminAiVersionMutationResponse)
def rollback_admin_ai_provider_route(
    route_id: str,
    version_id: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles=AI_VERSION_WRITE_ROLES)
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


@router.post("/pricing-rules/{rule_id}/publish", response_model=AdminAiVersionMutationResponse)
def publish_admin_ai_pricing_rule(
    rule_id: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles=AI_VERSION_WRITE_ROLES)
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


@router.post("/pricing-rules/{rule_id}/rollback/{version_id}", response_model=AdminAiVersionMutationResponse)
def rollback_admin_ai_pricing_rule(
    rule_id: str,
    version_id: str,
    payload: AdminAiPublishRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminAiVersionMutationResponse:
    roles = require_admin_role(context, allowed_roles=AI_VERSION_WRITE_ROLES)
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
