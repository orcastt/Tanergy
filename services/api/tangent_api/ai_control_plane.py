import os
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.ai_control_plane_defaults import (
    DEFAULT_MODEL_ROWS,
    DEFAULT_PRICING_ROWS,
    DEFAULT_ROUTE_ROWS,
    DEFAULT_TIER_ROWS,
)
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
    options = [_row_to_model_option(row, tiers, routes) for row in models if row.get("enabled", True)]
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
    model = _row_to_model_option(model_row, tiers, routes)
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
            model_rows = [_model_row_from_tuple(row) for row in cursor.fetchall()]
            if not model_rows:
                return DEFAULT_MODEL_ROWS, DEFAULT_TIER_ROWS, DEFAULT_ROUTE_ROWS, DEFAULT_PRICING_ROWS
            cursor.execute(
                """
                SELECT id, model_key, tier_key, public_label, parameter_key, provider_params, sort_order, enabled
                FROM tangent_model_parameter_tiers
                ORDER BY model_key ASC, sort_order ASC, public_label ASC
                """
            )
            tier_rows = [_tier_row_from_tuple(row) for row in cursor.fetchall()]
            cursor.execute(
                """
                SELECT id, model_key, provider_key, provider_model, route_key, priority, weight, health_status,
                       timeout_ms, retry_policy, enabled, created_at, updated_at
                FROM tangent_model_provider_routes
                ORDER BY model_key ASC, priority ASC, weight DESC, updated_at DESC
                """
            )
            route_rows = [_route_row_from_tuple(row) for row in cursor.fetchall()]
            cursor.execute(
                """
                SELECT id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
                       credit_multiplier, provider_cost_formula, status, effective_from, effective_to,
                       created_at, updated_at
                FROM tangent_model_pricing_rules
                ORDER BY model_key ASC, effective_from DESC, created_at DESC
                """
            )
            pricing_rows = [_pricing_row_from_tuple(row) for row in cursor.fetchall()]
    return model_rows, tier_rows, route_rows, pricing_rows


def _select_model_row(rows: list[dict[str, Any]], model_id: Optional[str], run_type: str) -> dict[str, Any]:
    normalized_model_id = _normalize_selected_model_id(model_id)
    selected = next(
        (
            row
            for row in rows
            if row["model_key"] == normalized_model_id
            and row.get("enabled", True)
            and _row_supports_run_type(row, run_type)
        ),
        None,
    )
    supported_rows = [row for row in rows if row.get("enabled", True) and _row_supports_run_type(row, run_type)]
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
    now = datetime.now(timezone.utc)
    matches = []
    for row in rows:
        if row["model_key"] != model_key or row.get("status") != "active":
            continue
        if tier_row and row.get("tier_key") not in {None, tier_row["tier_key"]}:
            continue
        if not _is_effective_now(row.get("effective_from"), row.get("effective_to"), now):
            continue
        matches.append(row)
    matches.sort(
        key=lambda row: (
            0 if tier_row and row.get("tier_key") == tier_row["tier_key"] else 1,
            -_sort_key(row.get("effective_from")),
        )
    )
    return matches[0] if matches else None


def _select_route_row(model_key: str, rows: list[dict[str, Any]]) -> Optional[dict[str, Any]]:
    matches = [row for row in rows if row["model_key"] == model_key and row.get("enabled", True)]
    matches.sort(key=lambda row: (_health_rank(row.get("health_status")), int(row.get("priority", 9999)), -int(row.get("weight", 0))))
    return matches[0] if matches else None


def _estimate_credits(payload: AiRunRequest, model_id: str, pricing_row: Optional[dict[str, Any]]) -> float:
    if payload.run_type in {"image_analysis", "text"}:
        if pricing_row:
            unit = float(pricing_row.get("estimated_credits", 1) or 1)
            minimum = float(pricing_row.get("min_credits", unit) or unit)
            multiplier = float(pricing_row.get("credit_multiplier", 1) or 1)
            return max(minimum, unit * multiplier)
        if payload.run_type == "text":
            return 1
        return 2 + (0.5 * len(payload.input_asset_ids))
    if pricing_row:
        count = _clamp_count(payload.params.get("count", 1))
        unit = float(pricing_row.get("estimated_credits", 0) or 0)
        minimum = float(pricing_row.get("min_credits", 0) or 0)
        multiplier = float(pricing_row.get("credit_multiplier", 1) or 1)
        if pricing_row.get("billing_unit") == "per_image":
            return max(minimum, unit * count * multiplier)
        return max(minimum, unit * multiplier)
    return 5 * _clamp_count(payload.params.get("count", 1))


def _normalize_selected_model_id(model_id: Optional[str]) -> Optional[str]:
    if model_id == "gemini-3.1-flash-image-preview":
        return "nano-banana-2"
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


def _row_supports_run_type(row: dict[str, Any], run_type: str) -> bool:
    if run_type == "text":
        return "text" in list(row.get("capabilities") or [])
    if run_type == "image_analysis":
        return "image_analysis" in list(row.get("capabilities") or [])
    if run_type in {"image_generation", "image_edit"}:
        capabilities = list(row.get("capabilities") or [])
        return run_type in capabilities or "image_generation" in capabilities
    return False


def _row_to_model_option(model_row: dict[str, Any], tiers: list[dict[str, Any]], routes: list[dict[str, Any]]) -> AiModelOption:
    model_tiers = [row for row in tiers if row["model_key"] == model_row["model_key"] and row.get("enabled", True)]
    provider = model_row.get("provider_key") or next((row["provider_key"] for row in routes if row["model_key"] == model_row["model_key"]), "unknown")
    parameter_schema = dict(model_row.get("parameter_schema") or {})
    for row in model_tiers:
        values = parameter_schema.setdefault(row["parameter_key"], [])
        if row["public_label"] not in values:
            values.append(row["public_label"])
    return AiModelOption(
        capabilities=list(model_row.get("capabilities") or []),
        costHint=str(model_row.get("cost_hint") or ""),
        defaultTierKey=model_row.get("default_tier_key"),
        displayName=str(model_row["display_name"]),
        estimatedLatency=str(model_row.get("estimated_latency") or ""),
        id=str(model_row["model_key"]),
        isDefault=bool(model_row.get("is_default")),
        isEnabled=bool(model_row.get("enabled", True)),
        parameterSchema=parameter_schema,
        provider=str(provider),
        tierOptions=[{"key": row["tier_key"], "label": row["public_label"], "parameterKey": row["parameter_key"]} for row in model_tiers],
    )


def _model_row_from_tuple(row: tuple[object, ...]) -> dict[str, Any]:
    return {"model_key": row[0], "display_name": row[1], "capability": row[2], "capabilities": list(row[3] or []), "parameter_schema": row[4] or {}, "cost_hint": row[5] or "", "estimated_latency": row[6] or "", "enabled": bool(row[7]), "is_default": bool(row[8]), "provider_key": row[9], "default_tier_key": row[10]}


def _tier_row_from_tuple(row: tuple[object, ...]) -> dict[str, Any]:
    return {"id": row[0], "model_key": row[1], "tier_key": row[2], "public_label": row[3], "parameter_key": row[4], "provider_params": row[5] or {}, "sort_order": int(row[6] or 0), "enabled": bool(row[7])}


def _route_row_from_tuple(row: tuple[object, ...]) -> dict[str, Any]:
    return {"id": row[0], "model_key": row[1], "provider_key": row[2], "provider_model": row[3], "route_key": row[4], "priority": int(row[5] or 0), "weight": int(row[6] or 0), "health_status": row[7] or "unknown", "timeout_ms": int(row[8] or 60000), "retry_policy": row[9] or {}, "enabled": bool(row[10]), "created_at": _to_iso(row[11]), "updated_at": _to_iso(row[12])}


def _pricing_row_from_tuple(row: tuple[object, ...]) -> dict[str, Any]:
    return {"id": row[0], "model_key": row[1], "tier_key": row[2], "billing_unit": row[3], "estimated_credits": float(row[4] or 0), "min_credits": float(row[5] or 0), "credit_multiplier": float(row[6] or 1), "provider_cost_formula": row[7] or {}, "status": row[8], "effective_from": _to_iso(row[9]), "effective_to": _to_iso(row[10]) if row[10] else None, "created_at": _to_iso(row[11]), "updated_at": _to_iso(row[12])}


def _clamp_count(value: object) -> int:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return 1
    return max(1, min(4, numeric))


def _health_rank(status: Optional[str]) -> int:
    return {"healthy": 0, "unknown": 1, "degraded": 2, "failed": 3, "disabled": 4}.get(str(status or "unknown"), 5)


def _is_effective_now(effective_from: Optional[str], effective_to: Optional[str], now: datetime) -> bool:
    start = _parse_datetime(effective_from) or datetime.min.replace(tzinfo=timezone.utc)
    end = _parse_datetime(effective_to) if effective_to else None
    return start <= now and (end is None or end > now)


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _sort_key(value: Optional[str]) -> float:
    parsed = _parse_datetime(value)
    return parsed.timestamp() if parsed else 0.0


def _to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
