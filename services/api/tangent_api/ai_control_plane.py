import os
from dataclasses import dataclass
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.ai_control_plane_defaults import (
    DEFAULT_MODEL_ROWS,
    DEFAULT_PRICING_ROWS,
    DEFAULT_ROUTE_ROWS,
    DEFAULT_TIER_ROWS,
)
from tangent_api.ai_control_plane_support import (
    clamp_count,
    health_rank,
    is_effective_now,
    pricing_row_from_tuple,
    route_row_from_tuple,
    row_supports_run_type,
    row_to_model_option,
    sort_key,
    tier_row_from_tuple,
    model_row_from_tuple,
)
from tangent_api.ai_credit_pricing import estimate_credits_for_rule
from tangent_api.ai_schemas import AiModelOption, AiRunQuoteRecord, AiRunRequest
from tangent_api.credit_ledger import build_credit_preflight_response
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres
from tangent_api.workspace_entitlements import resolve_ai_charge_summary


@dataclass(frozen=True)
class AiRunQuoteBundle:
    model: AiModelOption
    pricing_rule_id: Optional[str]
    provider: str
    quote: AiRunQuoteRecord
    route_id: Optional[str]
    route_key: Optional[str]


def list_models(capability: Optional[str]) -> list[AiModelOption]:
    models, tiers, routes, _pricing = _load_control_plane_rows()
    if capability:
        models = [
            row for row in models
            if capability == row.get("capability") or capability in list(row.get("capabilities") or [])
        ]
    options = [row_to_model_option(row, tiers, routes) for row in models if row.get("enabled", True)]
    options.sort(key=lambda option: (not option.is_default, option.display_name.lower()))
    return options


def load_pricing_rule_by_id(pricing_rule_id: Optional[str]) -> Optional[dict[str, Any]]:
    if not pricing_rule_id:
        return None
    _models, _tiers, _routes, pricing_rules = _load_control_plane_rows()
    return next((row for row in pricing_rules if row.get("id") == pricing_rule_id), None)


def load_tier_by_key(model_key: str, tier_key: Optional[str]) -> Optional[dict[str, Any]]:
    if not tier_key:
        return None
    _models, tiers, _routes, _pricing_rules = _load_control_plane_rows()
    return next(
        (
            row for row in tiers
            if row.get("model_key") == model_key and row.get("tier_key") == tier_key and row.get("enabled", True)
        ),
        None,
    )


def build_ai_run_quote(payload: AiRunRequest, context: ApiRequestContext) -> AiRunQuoteRecord:
    return resolve_ai_run_quote(payload, context).quote


def resolve_ai_run_quote(payload: AiRunRequest, context: ApiRequestContext) -> AiRunQuoteBundle:
    models, tiers, routes, pricing_rules = _load_control_plane_rows()
    model_row = _select_model_row(models, payload.selected_model_id, payload.run_type)
    tier_row = _select_tier_row(payload, model_row, tiers)
    pricing_row = _select_pricing_row(model_row["model_key"], tier_row, pricing_rules)
    route_row = _select_route_row(model_row["model_key"], routes)
    model = row_to_model_option(model_row, tiers, routes)
    estimated_credits = _estimate_credits(payload, model.id, pricing_row)
    preflight = _build_quote_preflight(context, estimated_credits)
    quote = AiRunQuoteRecord(
        accountId=preflight["accountId"],
        availableCredits=preflight["availableCredits"],
        billingUnit=(pricing_row or {}).get("billing_unit", "per_run"),
        canRun=preflight["canRun"],
        charge=preflight["charge"],
        costHint=f"Estimated {estimated_credits:g} credits · {model.display_name}",
        estimatedCredits=estimated_credits,
        modelDisplayName=model.display_name,
        modelId=model.id,
        parameterKey=tier_row["parameter_key"] if tier_row else None,
        preflightStatus=preflight["preflightStatus"],
        pricingRuleId=(pricing_row or {}).get("id"),
        requiredCredits=estimated_credits,
        routeId=(route_row or {}).get("id"),
        routeKey=(route_row or {}).get("route_key"),
        selectedTierKey=tier_row["tier_key"] if tier_row else None,
        selectedTierLabel=tier_row["public_label"] if tier_row else None,
        shortfallCredits=preflight["shortfallCredits"],
    )
    return AiRunQuoteBundle(
        model=model,
        pricing_rule_id=(pricing_row or {}).get("id"),
        provider=(route_row or {}).get("provider_key") or model.provider,
        quote=quote,
        route_id=(route_row or {}).get("id"),
        route_key=(route_row or {}).get("route_key"),
    )


def _load_control_plane_rows() -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    if not os.getenv("DATABASE_URL"):
        return DEFAULT_MODEL_ROWS, DEFAULT_TIER_ROWS, DEFAULT_ROUTE_ROWS, DEFAULT_PRICING_ROWS
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
                       estimated_latency, enabled, is_default, provider_key, default_tier_key
                FROM tangent_model_registry
                ORDER BY is_default DESC, display_name ASC
                """
            )
            model_rows = [model_row_from_tuple(row) for row in cursor.fetchall()]
            if not model_rows:
                return DEFAULT_MODEL_ROWS, DEFAULT_TIER_ROWS, DEFAULT_ROUTE_ROWS, DEFAULT_PRICING_ROWS
            cursor.execute(
                """
                SELECT id, model_key, tier_key, public_label, parameter_key, provider_params, sort_order, enabled
                FROM tangent_model_parameter_tiers
                ORDER BY model_key ASC, sort_order ASC, public_label ASC
                """
            )
            tier_rows = [tier_row_from_tuple(row) for row in cursor.fetchall()]
            cursor.execute(
                """
                SELECT id, model_key, provider_key, provider_model, route_key, priority, weight, health_status,
                       timeout_ms, retry_policy, enabled, created_at, updated_at
                FROM tangent_model_provider_routes
                ORDER BY model_key ASC, priority ASC, weight DESC, updated_at DESC
                """
            )
            route_rows = [route_row_from_tuple(row) for row in cursor.fetchall()]
            cursor.execute(
                """
                SELECT id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
                       credit_multiplier, provider_cost_formula, status, effective_from, effective_to,
                       created_at, updated_at
                FROM tangent_model_pricing_rules
                ORDER BY model_key ASC, effective_from DESC, created_at DESC
                """
            )
            pricing_rows = [pricing_row_from_tuple(row) for row in cursor.fetchall()]
    return model_rows, tier_rows, route_rows, pricing_rows


def _select_model_row(rows: list[dict[str, Any]], model_id: Optional[str], run_type: str) -> dict[str, Any]:
    normalized_model_id = _normalize_selected_model_id(model_id)
    selected = next(
        (
            row
            for row in rows
            if row["model_key"] == normalized_model_id
            and row.get("enabled", True)
            and row_supports_run_type(row, run_type)
        ),
        None,
    )
    supported_rows = [row for row in rows if row.get("enabled", True) and row_supports_run_type(row, run_type)]
    fallback = next((row for row in supported_rows if row.get("is_default")), None)
    model = selected or fallback or next(iter(supported_rows), None)
    if model is None:
        raise HTTPException(status_code=400, detail="The selected AI model is unavailable.")
    return model


def _select_tier_row(payload: AiRunRequest, model_row: dict[str, Any], rows: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    if payload.run_type not in {"image_generation", "image_edit"}:
        return None
    model_rows = [row for row in rows if row["model_key"] == model_row["model_key"] and row.get("enabled", True)]
    if not model_rows:
        return None
    for row in model_rows:
        parameter_key = str(row.get("parameter_key") or "").strip()
        requested = str(payload.params.get(parameter_key) or "").strip().lower() if parameter_key else ""
        if requested and requested == str(row["public_label"]).strip().lower():
            return row
    legacy_requested = str(payload.params.get("resolution") or "").strip().lower()
    for row in model_rows:
        if legacy_requested and legacy_requested == str(row["public_label"]).strip().lower():
            return row
    default_key = model_row.get("default_tier_key")
    if default_key:
        for row in model_rows:
            if row["tier_key"] == default_key:
                return row
    return model_rows[0]


def _select_pricing_row(model_key: str, tier_row: Optional[dict[str, Any]], rows: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    matches = []
    for row in rows:
        if row["model_key"] != model_key or row.get("status") != "active":
            continue
        if tier_row and row.get("tier_key") not in {None, tier_row["tier_key"]}:
            continue
        if not is_effective_now(row.get("effective_from"), row.get("effective_to"), now):
            continue
        matches.append(row)
    matches.sort(
        key=lambda row: (
            0 if tier_row and row.get("tier_key") == tier_row["tier_key"] else 1,
            -sort_key(row.get("effective_from")),
        )
    )
    return matches[0] if matches else None


def _select_route_row(model_key: str, rows: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    matches = [row for row in rows if row["model_key"] == model_key and row.get("enabled", True)]
    matches.sort(key=lambda row: (health_rank(row.get("health_status")), int(row.get("priority", 9999)), -int(row.get("weight", 0))))
    return matches[0] if matches else None


def _estimate_credits(payload: AiRunRequest, model_id: str, pricing_row: Optional[dict[str, Any]]) -> float:
    if payload.run_type in {"image_analysis", "text"}:
        if pricing_row:
            return estimate_credits_for_rule(payload, pricing_row, fallback_credits=1)
        if payload.run_type == "text":
            return 1
        return 2 + (0.5 * len(payload.input_asset_ids))
    if pricing_row:
        return estimate_credits_for_rule(payload, pricing_row, fallback_credits=0)
    return 5 * clamp_count(payload.params.get("count", 1))


def _normalize_selected_model_id(model_id: Optional[str]) -> Optional[str]:
    return model_id


def _build_quote_preflight(context: ApiRequestContext, required_credits: float) -> dict[str, Any]:
    if os.getenv("DATABASE_URL"):
        response = build_credit_preflight_response(context, required_credits).model_dump(by_alias=True)
        return response
    charge = resolve_ai_charge_summary(context)
    return {
        "accountId": charge.charged_account_id,
        "availableCredits": 0.0,
        "canRun": True,
        "charge": charge,
        "preflightStatus": "mock_contract_only",
        "requiredCredits": required_credits,
        "shortfallCredits": 0.0,
    }
