from typing import Any, Optional

from tangent_api.admin_ai_control_plane_support import (
    row_to_admin_ai_model,
    row_to_admin_ai_pricing_rule,
    row_to_admin_ai_provider_route,
)
from tangent_api.schemas import AdminAiModelRecord, AdminAiPricingRuleRecord, AdminAiProviderRouteRecord


def list_admin_ai_models(
    *,
    db_connect: Any,
    require_database_url: Any,
    limit: int,
    capability: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> list[AdminAiModelRecord]:
    require_database_url()
    with db_connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
                       estimated_latency, enabled, is_default, provider_key, default_tier_key,
                       default_pricing_rule_id, created_at, updated_at
                FROM tangent_model_registry
                ORDER BY updated_at DESC, model_key ASC
                """
            )
            rows = cursor.fetchall()
    records = [row_to_admin_ai_model(row) for row in rows]
    if capability:
        records = [record for record in records if capability == record.capability or capability in record.capabilities]
    if enabled is not None:
        records = [record for record in records if record.enabled is enabled]
    return records[:limit]


def list_admin_ai_provider_routes(
    *,
    db_connect: Any,
    require_database_url: Any,
    limit: int,
    model_key: Optional[str] = None,
    provider_key: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> list[AdminAiProviderRouteRecord]:
    require_database_url()
    with db_connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, model_key, provider_key, provider_model, route_key, priority, weight,
                       health_status, timeout_ms, retry_policy, enabled, created_at, updated_at
                FROM tangent_model_provider_routes
                ORDER BY priority ASC, weight DESC, updated_at DESC
                """
            )
            rows = cursor.fetchall()
    records = [row_to_admin_ai_provider_route(row) for row in rows]
    if model_key:
        records = [record for record in records if record.model_key == model_key]
    if provider_key:
        records = [record for record in records if record.provider_key == provider_key]
    if enabled is not None:
        records = [record for record in records if record.enabled is enabled]
    return records[:limit]


def list_admin_ai_pricing_rules(
    *,
    db_connect: Any,
    require_database_url: Any,
    limit: int,
    model_key: Optional[str] = None,
    tier_key: Optional[str] = None,
    status: Optional[str] = None,
) -> list[AdminAiPricingRuleRecord]:
    require_database_url()
    with db_connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
                       credit_multiplier, provider_cost_formula, status, effective_from, effective_to,
                       created_at, updated_at
                FROM tangent_model_pricing_rules
                ORDER BY effective_from DESC, created_at DESC
                """
            )
            rows = cursor.fetchall()
    records = [row_to_admin_ai_pricing_rule(row) for row in rows]
    if model_key:
        records = [record for record in records if record.model_key == model_key]
    if tier_key:
        records = [record for record in records if record.tier_key == tier_key]
    if status:
        records = [record for record in records if record.status == status]
    return records[:limit]
