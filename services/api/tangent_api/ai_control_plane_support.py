from datetime import datetime, timezone
from typing import Any, Optional

from tangent_api.ai_schemas import AiModelOption


def row_supports_run_type(row: dict[str, Any], run_type: str) -> bool:
    if run_type == "text":
        return "text" in list(row.get("capabilities") or [])
    if run_type == "image_analysis":
        return "image_analysis" in list(row.get("capabilities") or [])
    if run_type in {"image_generation", "image_edit"}:
        capabilities = list(row.get("capabilities") or [])
        return run_type in capabilities or "image_generation" in capabilities
    return False


def row_to_model_option(model_row: dict[str, Any], tiers: list[dict[str, Any]], routes: list[dict[str, Any]]) -> AiModelOption:
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


def model_row_from_tuple(row: tuple[object, ...]) -> dict[str, Any]:
    return {"model_key": row[0], "display_name": row[1], "capability": row[2], "capabilities": list(row[3] or []), "parameter_schema": row[4] or {}, "cost_hint": row[5] or "", "estimated_latency": row[6] or "", "enabled": bool(row[7]), "is_default": bool(row[8]), "provider_key": row[9], "default_tier_key": row[10]}


def tier_row_from_tuple(row: tuple[object, ...]) -> dict[str, Any]:
    return {"id": row[0], "model_key": row[1], "tier_key": row[2], "public_label": row[3], "parameter_key": row[4], "provider_params": row[5] or {}, "sort_order": int(row[6] or 0), "enabled": bool(row[7])}


def route_row_from_tuple(row: tuple[object, ...]) -> dict[str, Any]:
    return {"id": row[0], "model_key": row[1], "provider_key": row[2], "provider_model": row[3], "route_key": row[4], "priority": int(row[5] or 0), "weight": int(row[6] or 0), "health_status": row[7] or "unknown", "timeout_ms": int(row[8] or 60000), "retry_policy": row[9] or {}, "enabled": bool(row[10]), "created_at": to_iso(row[11]), "updated_at": to_iso(row[12])}


def pricing_row_from_tuple(row: tuple[object, ...]) -> dict[str, Any]:
    return {"id": row[0], "model_key": row[1], "tier_key": row[2], "billing_unit": row[3], "estimated_credits": float(row[4] or 0), "min_credits": float(row[5] or 0), "credit_multiplier": float(row[6] or 1), "provider_cost_formula": row[7] or {}, "status": row[8], "effective_from": to_iso(row[9]), "effective_to": to_iso(row[10]) if row[10] else None, "created_at": to_iso(row[11]), "updated_at": to_iso(row[12])}


def clamp_count(value: object) -> int:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return 1
    return max(1, min(4, numeric))


def health_rank(status: Optional[str]) -> int:
    return {"healthy": 0, "unknown": 1, "degraded": 2, "failed": 3, "disabled": 4}.get(str(status or "unknown"), 5)


def is_effective_now(effective_from: Optional[str], effective_to: Optional[str], now: datetime) -> bool:
    start = parse_datetime(effective_from) or datetime.min.replace(tzinfo=timezone.utc)
    end = parse_datetime(effective_to) if effective_to else None
    return start <= now and (end is None or end > now)


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def sort_key(value: Optional[str]) -> float:
    parsed = parse_datetime(value)
    return parsed.timestamp() if parsed else 0.0


def to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
