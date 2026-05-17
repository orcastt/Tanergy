from typing import Any

from fastapi import HTTPException

from tangent_api.admin_ai_control_plane_support import (
    ALLOWED_BILLING_UNITS,
    ALLOWED_CAPABILITIES,
    ALLOWED_HEALTH_STATUSES,
    ALLOWED_PRICING_STATUSES,
    json_dump,
    normalize_capability_list,
    normalize_choice,
    normalize_optional_provider_key,
    normalize_required_provider_key,
    optional_trimmed,
    required_trimmed,
    row_to_admin_ai_model,
    row_to_admin_ai_pricing_rule,
    row_to_admin_ai_provider_route,
)
from tangent_api.schemas import (
    AdminAiModelRecord,
    AdminAiModelUpdateRequest,
    AdminAiPricingRuleRecord,
    AdminAiPricingRuleUpdateRequest,
    AdminAiProviderRouteRecord,
    AdminAiProviderRouteUpdateRequest,
)


def update_admin_ai_model(
    *,
    db_connect: Any,
    require_database_url: Any,
    model_key: str,
    input_data: AdminAiModelUpdateRequest,
) -> AdminAiModelRecord:
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
        updates.append("capability = %s")
        params.append(normalize_choice(input_data.capability, ALLOWED_CAPABILITIES, "Invalid model capability."))
    if "capabilities" in fields:
        updates.append("capabilities = %s::jsonb")
        params.append(json_dump(normalize_capability_list(input_data.capabilities)))
    if "parameter_schema" in fields:
        updates.append("parameter_schema = %s::jsonb")
        params.append(json_dump(input_data.parameter_schema or {}))
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
        params.append(normalize_optional_provider_key(input_data.provider_key))
    if "default_tier_key" in fields:
        updates.append("default_tier_key = %s")
        params.append(optional_trimmed(input_data.default_tier_key))
    if "default_pricing_rule_id" in fields:
        updates.append("default_pricing_rule_id = %s")
        params.append(optional_trimmed(input_data.default_pricing_rule_id))
    if not updates:
        raise HTTPException(status_code=400, detail="No model changes were provided.")

    with db_connect() as connection:
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
    return row_to_admin_ai_model(row)


def update_admin_ai_provider_route(
    *,
    db_connect: Any,
    require_database_url: Any,
    route_id: str,
    input_data: AdminAiProviderRouteUpdateRequest,
) -> AdminAiProviderRouteRecord:
    require_database_url()
    updates: list[str] = []
    params: list[object] = []
    fields = input_data.model_fields_set

    if "model_key" in fields:
        updates.append("model_key = %s")
        params.append(required_trimmed(input_data.model_key, "Route model key is required."))
    if "provider_key" in fields:
        updates.append("provider_key = %s")
        params.append(normalize_required_provider_key(input_data.provider_key, "Route provider key is required."))
    if "provider_model" in fields:
        updates.append("provider_model = %s")
        params.append(required_trimmed(input_data.provider_model, "Route provider model is required."))
    if "route_key" in fields:
        updates.append("route_key = %s")
        params.append(required_trimmed(input_data.route_key, "Route key is required."))
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
        params.append(normalize_choice(input_data.health_status, ALLOWED_HEALTH_STATUSES, "Invalid route health status."))
    if "timeout_ms" in fields:
        if input_data.timeout_ms is None or input_data.timeout_ms < 1:
            raise HTTPException(status_code=400, detail="Route timeout must be positive.")
        updates.append("timeout_ms = %s")
        params.append(int(input_data.timeout_ms))
    if "retry_policy" in fields:
        updates.append("retry_policy = %s::jsonb")
        params.append(json_dump(input_data.retry_policy or {}))
    if "enabled" in fields:
        updates.append("enabled = %s")
        params.append(bool(input_data.enabled))
    if not updates:
        raise HTTPException(status_code=400, detail="No provider route changes were provided.")

    with db_connect() as connection:
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
    return row_to_admin_ai_provider_route(row)


def update_admin_ai_pricing_rule(
    *,
    db_connect: Any,
    require_database_url: Any,
    rule_id: str,
    input_data: AdminAiPricingRuleUpdateRequest,
) -> AdminAiPricingRuleRecord:
    require_database_url()
    updates: list[str] = []
    params: list[object] = []
    fields = input_data.model_fields_set

    if "model_key" in fields:
        updates.append("model_key = %s")
        params.append(required_trimmed(input_data.model_key, "Pricing rule model key is required."))
    if "tier_key" in fields:
        updates.append("tier_key = %s")
        params.append(optional_trimmed(input_data.tier_key))
    if "billing_unit" in fields:
        updates.append("billing_unit = %s")
        params.append(normalize_choice(input_data.billing_unit, ALLOWED_BILLING_UNITS, "Invalid billing unit."))
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
        params.append(json_dump(input_data.provider_cost_formula or {}))
    if "status" in fields:
        updates.append("status = %s")
        params.append(normalize_choice(input_data.status, ALLOWED_PRICING_STATUSES, "Invalid pricing rule status."))
    if "effective_from" in fields:
        updates.append("effective_from = %s")
        params.append(required_trimmed(input_data.effective_from, "Effective from timestamp is required."))
    if "effective_to" in fields:
        updates.append("effective_to = %s")
        params.append(optional_trimmed(input_data.effective_to))
    if not updates:
        raise HTTPException(status_code=400, detail="No pricing rule changes were provided.")

    with db_connect() as connection:
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
    return row_to_admin_ai_pricing_rule(row)
