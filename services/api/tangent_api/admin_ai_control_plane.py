from typing import Optional

from tangent_api.schemas import (
    AdminAiModelRecord,
    AdminAiPricingRuleRecord,
    AdminAiProviderRouteRecord,
)
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def list_admin_ai_models(
    limit: int,
    capability: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> list[AdminAiModelRecord]:
    require_database_url()
    with connect_to_postgres() as connection:
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
    records = [_row_to_admin_ai_model(row) for row in rows]
    if capability:
        records = [record for record in records if capability == record.capability or capability in record.capabilities]
    if enabled is not None:
        records = [record for record in records if record.enabled is enabled]
    return records[:limit]


def list_admin_ai_provider_routes(
    limit: int,
    model_key: Optional[str] = None,
    provider_key: Optional[str] = None,
    enabled: Optional[bool] = None,
) -> list[AdminAiProviderRouteRecord]:
    require_database_url()
    with connect_to_postgres() as connection:
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
    records = [_row_to_admin_ai_provider_route(row) for row in rows]
    if model_key:
        records = [record for record in records if record.model_key == model_key]
    if provider_key:
        records = [record for record in records if record.provider_key == provider_key]
    if enabled is not None:
        records = [record for record in records if record.enabled is enabled]
    return records[:limit]


def list_admin_ai_pricing_rules(
    limit: int,
    model_key: Optional[str] = None,
    tier_key: Optional[str] = None,
    status: Optional[str] = None,
) -> list[AdminAiPricingRuleRecord]:
    require_database_url()
    with connect_to_postgres() as connection:
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
    records = [_row_to_admin_ai_pricing_rule(row) for row in rows]
    if model_key:
        records = [record for record in records if record.model_key == model_key]
    if tier_key:
        records = [record for record in records if record.tier_key == tier_key]
    if status:
        records = [record for record in records if record.status == status]
    return records[:limit]


def _row_to_admin_ai_model(row: tuple[object, ...]) -> AdminAiModelRecord:
    return AdminAiModelRecord(
        capabilities=list(row[3] or []),
        capability=str(row[2]),
        costHint=str(row[5] or ""),
        createdAt=_to_iso(row[12]),
        defaultPricingRuleId=row[11],
        defaultTierKey=row[10],
        displayName=str(row[1]),
        enabled=bool(row[7]),
        estimatedLatency=str(row[6] or ""),
        isDefault=bool(row[8]),
        modelKey=str(row[0]),
        parameterSchema=row[4] or {},
        providerKey=row[9],
        updatedAt=_to_iso(row[13]),
    )


def _row_to_admin_ai_provider_route(row: tuple[object, ...]) -> AdminAiProviderRouteRecord:
    return AdminAiProviderRouteRecord(
        createdAt=_to_iso(row[11]),
        enabled=bool(row[10]),
        healthStatus=str(row[7] or "unknown"),
        modelKey=str(row[1]),
        priority=int(row[5] or 0),
        providerKey=str(row[2]),
        providerModel=str(row[3]),
        retryPolicy=row[9] or {},
        routeId=str(row[0]),
        routeKey=str(row[4]),
        timeoutMs=int(row[8] or 60000),
        updatedAt=_to_iso(row[12]),
        weight=int(row[6] or 0),
    )


def _row_to_admin_ai_pricing_rule(row: tuple[object, ...]) -> AdminAiPricingRuleRecord:
    return AdminAiPricingRuleRecord(
        billingUnit=str(row[3]),
        createdAt=_to_iso(row[11]),
        creditMultiplier=float(row[6] or 1),
        effectiveFrom=_to_iso(row[9]),
        effectiveTo=_to_iso(row[10]) if row[10] else None,
        estimatedCredits=float(row[4] or 0),
        id=str(row[0]),
        minCredits=float(row[5] or 0),
        modelKey=str(row[1]),
        providerCostFormula=row[7] or {},
        status=str(row[8]),
        tierKey=row[2],
        updatedAt=_to_iso(row[12]),
    )


def _to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
