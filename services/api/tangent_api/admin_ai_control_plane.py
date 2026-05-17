from typing import Optional

from tangent_api.admin_ai_control_plane_reads import (
    list_admin_ai_models as _list_admin_ai_models_impl,
    list_admin_ai_pricing_rules as _list_admin_ai_pricing_rules_impl,
    list_admin_ai_provider_routes as _list_admin_ai_provider_routes_impl,
)
from tangent_api.admin_ai_control_plane_writes import (
    update_admin_ai_model as _update_admin_ai_model_impl,
    update_admin_ai_pricing_rule as _update_admin_ai_pricing_rule_impl,
    update_admin_ai_provider_route as _update_admin_ai_provider_route_impl,
)
from tangent_api.schemas import (
    AdminAiModelRecord,
    AdminAiModelUpdateRequest,
    AdminAiPricingRuleRecord,
    AdminAiPricingRuleUpdateRequest,
    AdminAiProviderRouteRecord,
    AdminAiProviderRouteUpdateRequest,
)
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def list_admin_ai_models(
    limit: int,
    capability: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> list[AdminAiModelRecord]:
    return _list_admin_ai_models_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        limit=limit,
        capability=capability,
        enabled=enabled,
    )


def list_admin_ai_provider_routes(
    limit: int,
    model_key: Optional[str] = None,
    provider_key: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> list[AdminAiProviderRouteRecord]:
    return _list_admin_ai_provider_routes_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        limit=limit,
        model_key=model_key,
        provider_key=provider_key,
        enabled=enabled,
    )


def list_admin_ai_pricing_rules(
    limit: int,
    model_key: Optional[str] = None,
    tier_key: Optional[str] = None,
    status: Optional[str] = None,
) -> list[AdminAiPricingRuleRecord]:
    return _list_admin_ai_pricing_rules_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        limit=limit,
        model_key=model_key,
        tier_key=tier_key,
        status=status,
    )


def update_admin_ai_model(model_key: str, input_data: AdminAiModelUpdateRequest) -> AdminAiModelRecord:
    return _update_admin_ai_model_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        model_key=model_key,
        input_data=input_data,
    )


def update_admin_ai_provider_route(route_id: str, input_data: AdminAiProviderRouteUpdateRequest) -> AdminAiProviderRouteRecord:
    return _update_admin_ai_provider_route_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        route_id=route_id,
        input_data=input_data,
    )


def update_admin_ai_pricing_rule(rule_id: str, input_data: AdminAiPricingRuleUpdateRequest) -> AdminAiPricingRuleRecord:
    return _update_admin_ai_pricing_rule_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        rule_id=rule_id,
        input_data=input_data,
    )
