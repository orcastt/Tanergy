from typing import Optional

from fastapi import HTTPException

from tangent_api.schemas import (
    AdminAiModelRecord,
    AdminAiModelUpdateRequest,
    AdminAiPricingRuleRecord,
    AdminAiPricingRuleUpdateRequest,
    AdminAiProviderRouteRecord,
    AdminAiProviderRouteUpdateRequest,
)
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

ALLOWED_CAPABILITIES = {"image_generation", "image_edit", "image_analysis", "image_reference", "text"}
ALLOWED_HEALTH_STATUSES = {"healthy", "unknown", "degraded", "failed", "disabled"}
ALLOWED_PRICING_STATUSES = {"active", "draft", "retired"}
ALLOWED_BILLING_UNITS = {"per_image", "per_run", "per_output_token", "per_input_token", "blended"}


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


def update_admin_ai_model(model_key: str, input_data: AdminAiModelUpdateRequest) -> AdminAiModelRecord:
    require_database_url()
    updates: list[str] = []
    params: list[object] = []
    fields = input_data.model_fields_set

    if "display_name" in fields:
        display_name = (input_data.display_name or "").strip()
        if not display_name:
            raise HTTPException(status_code=400, detail="Model display name is required.")
        updates.append("display_name = %s")
        params.append(display_name)
    if "capability" in fields:
        capability = _normalize_choice(input_data.capability, ALLOWED_CAPABILITIES, "Invalid model capability.")
        updates.append("capability = %s")
        params.append(capability)
    if "capabilities" in fields:
        capabilities = _normalize_capability_list(input_data.capabilities)
        updates.append("capabilities = %s::jsonb")
        params.append(_json_dump(capabilities))
    if "parameter_schema" in fields:
        updates.append("parameter_schema = %s::jsonb")
        params.append(_json_dump(input_data.parameter_schema or {}))
    if "cost_hint" in fields:
        updates.append("cost_hint = %s")
        params.append(input_data.cost_hint or "")
    if "estimated_latency" in fields:
        updates.append("estimated_latency = %s")
        params.append(input_data.estimated_latency or "")
    if "enabled" in fields:
        updates.append("enabled = %s")
        params.append(bool(input_data.enabled))
    if "is_default" in fields:
        updates.append("is_default = %s")
        params.append(bool(input_data.is_default))
    if "provider_key" in fields:
        updates.append("provider_key = %s")
        params.append(_optional_trimmed(input_data.provider_key))
    if "default_tier_key" in fields:
        updates.append("default_tier_key = %s")
        params.append(_optional_trimmed(input_data.default_tier_key))
    if "default_pricing_rule_id" in fields:
        updates.append("default_pricing_rule_id = %s")
        params.append(_optional_trimmed(input_data.default_pricing_rule_id))
    if not updates:
        raise HTTPException(status_code=400, detail="No model changes were provided.")

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            if input_data.is_default:
                cursor.execute(
                    """
                    UPDATE tangent_model_registry
                    SET is_default = FALSE,
                        updated_at = NOW()
                    WHERE model_key <> %s
                      AND is_default = TRUE
                    """,
                    (model_key,),
                )
            cursor.execute(
                f"""
                UPDATE tangent_model_registry
                SET {", ".join(updates)},
                    updated_at = NOW()
                WHERE model_key = %s
                RETURNING model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
                          estimated_latency, enabled, is_default, provider_key, default_tier_key,
                          default_pricing_rule_id, created_at, updated_at
                """,
                tuple([*params, model_key]),
            )
            row = cursor.fetchone()
        connection.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="Model not found.")
    return _row_to_admin_ai_model(row)


def update_admin_ai_provider_route(route_id: str, input_data: AdminAiProviderRouteUpdateRequest) -> AdminAiProviderRouteRecord:
    require_database_url()
    updates: list[str] = []
    params: list[object] = []
    fields = input_data.model_fields_set

    if "model_key" in fields:
        updates.append("model_key = %s")
        params.append(_required_trimmed(input_data.model_key, "Route model key is required."))
    if "provider_key" in fields:
        updates.append("provider_key = %s")
        params.append(_required_trimmed(input_data.provider_key, "Route provider key is required."))
    if "provider_model" in fields:
        updates.append("provider_model = %s")
        params.append(_required_trimmed(input_data.provider_model, "Route provider model is required."))
    if "route_key" in fields:
        updates.append("route_key = %s")
        params.append(_required_trimmed(input_data.route_key, "Route key is required."))
    if "priority" in fields:
        if input_data.priority is None or input_data.priority < 0:
            raise HTTPException(status_code=400, detail="Route priority must be non-negative.")
        updates.append("priority = %s")
        params.append(int(input_data.priority))
    if "weight" in fields:
        if input_data.weight is None or input_data.weight < 0:
            raise HTTPException(status_code=400, detail="Route weight must be non-negative.")
        updates.append("weight = %s")
        params.append(int(input_data.weight))
    if "health_status" in fields:
        updates.append("health_status = %s")
        params.append(_normalize_choice(input_data.health_status, ALLOWED_HEALTH_STATUSES, "Invalid route health status."))
    if "timeout_ms" in fields:
        if input_data.timeout_ms is None or input_data.timeout_ms < 1:
            raise HTTPException(status_code=400, detail="Route timeout must be positive.")
        updates.append("timeout_ms = %s")
        params.append(int(input_data.timeout_ms))
    if "retry_policy" in fields:
        updates.append("retry_policy = %s::jsonb")
        params.append(_json_dump(input_data.retry_policy or {}))
    if "enabled" in fields:
        updates.append("enabled = %s")
        params.append(bool(input_data.enabled))
    if not updates:
        raise HTTPException(status_code=400, detail="No provider route changes were provided.")

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                UPDATE tangent_model_provider_routes
                SET {", ".join(updates)},
                    updated_at = NOW()
                WHERE id = %s
                RETURNING id, model_key, provider_key, provider_model, route_key, priority, weight,
                          health_status, timeout_ms, retry_policy, enabled, created_at, updated_at
                """,
                tuple([*params, route_id]),
            )
            row = cursor.fetchone()
        connection.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="Provider route not found.")
    return _row_to_admin_ai_provider_route(row)


def update_admin_ai_pricing_rule(rule_id: str, input_data: AdminAiPricingRuleUpdateRequest) -> AdminAiPricingRuleRecord:
    require_database_url()
    updates: list[str] = []
    params: list[object] = []
    fields = input_data.model_fields_set

    if "model_key" in fields:
        updates.append("model_key = %s")
        params.append(_required_trimmed(input_data.model_key, "Pricing rule model key is required."))
    if "tier_key" in fields:
        updates.append("tier_key = %s")
        params.append(_optional_trimmed(input_data.tier_key))
    if "billing_unit" in fields:
        updates.append("billing_unit = %s")
        params.append(_normalize_choice(input_data.billing_unit, ALLOWED_BILLING_UNITS, "Invalid billing unit."))
    if "estimated_credits" in fields:
        if input_data.estimated_credits is None or input_data.estimated_credits < 0:
            raise HTTPException(status_code=400, detail="Estimated credits must be non-negative.")
        updates.append("estimated_credits = %s")
        params.append(float(input_data.estimated_credits))
    if "min_credits" in fields:
        if input_data.min_credits is None or input_data.min_credits < 0:
            raise HTTPException(status_code=400, detail="Minimum credits must be non-negative.")
        updates.append("min_credits = %s")
        params.append(float(input_data.min_credits))
    if "credit_multiplier" in fields:
        if input_data.credit_multiplier is None or input_data.credit_multiplier < 0:
            raise HTTPException(status_code=400, detail="Credit multiplier must be non-negative.")
        updates.append("credit_multiplier = %s")
        params.append(float(input_data.credit_multiplier))
    if "provider_cost_formula" in fields:
        updates.append("provider_cost_formula = %s::jsonb")
        params.append(_json_dump(input_data.provider_cost_formula or {}))
    if "status" in fields:
        updates.append("status = %s")
        params.append(_normalize_choice(input_data.status, ALLOWED_PRICING_STATUSES, "Invalid pricing rule status."))
    if "effective_from" in fields:
        updates.append("effective_from = %s")
        params.append(_required_trimmed(input_data.effective_from, "Effective from timestamp is required."))
    if "effective_to" in fields:
        updates.append("effective_to = %s")
        params.append(_optional_trimmed(input_data.effective_to))
    if not updates:
        raise HTTPException(status_code=400, detail="No pricing rule changes were provided.")

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                UPDATE tangent_model_pricing_rules
                SET {", ".join(updates)},
                    updated_at = NOW()
                WHERE id = %s
                RETURNING id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
                          credit_multiplier, provider_cost_formula, status, effective_from, effective_to,
                          created_at, updated_at
                """,
                tuple([*params, rule_id]),
            )
            row = cursor.fetchone()
        connection.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="Pricing rule not found.")
    return _row_to_admin_ai_pricing_rule(row)


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


def _json_dump(value: object) -> str:
    import json

    return json.dumps({} if value is None else value)


def _normalize_choice(value: Optional[str], allowed: set[str], error_detail: str) -> str:
    normalized = _required_trimmed(value, error_detail)
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail=error_detail)
    return normalized


def _normalize_capability_list(values: Optional[list[str]]) -> list[str]:
    normalized = [item.strip() for item in values or [] if item and item.strip()]
    if any(item not in ALLOWED_CAPABILITIES for item in normalized):
        raise HTTPException(status_code=400, detail="Invalid model capabilities.")
    return normalized


def _optional_trimmed(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    normalized = value.strip()
    return normalized or None


def _required_trimmed(value: Optional[str], error_detail: str) -> str:
    normalized = _optional_trimmed(value)
    if not normalized:
        raise HTTPException(status_code=400, detail=error_detail)
    return normalized
