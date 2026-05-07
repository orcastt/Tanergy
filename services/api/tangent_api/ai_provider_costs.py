from dataclasses import dataclass
from typing import Optional

from tangent_api.ai_control_plane import load_pricing_rule_by_id
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest


@dataclass(frozen=True)
class AiRunSettlementSummary:
    cost_credits: float
    provider_cost: Optional[float]
    provider_currency: Optional[str]


def resolve_run_settlement(
    run: AiRunRecord,
    payload: AiRunRequest,
    output_count: int,
    provider_cost: Optional[float],
    provider_currency: Optional[str],
) -> AiRunSettlementSummary:
    pricing_rule = load_pricing_rule_by_id(run.pricing_rule_id)
    return AiRunSettlementSummary(
        cost_credits=resolve_settlement_credits(run, payload, output_count, pricing_rule),
        provider_cost=resolve_provider_cost(payload, output_count, pricing_rule, provider_cost),
        provider_currency=provider_currency or resolve_provider_currency(pricing_rule),
    )


def resolve_settlement_credits(
    run: AiRunRecord,
    payload: AiRunRequest,
    output_count: int,
    pricing_rule: Optional[dict[str, object]],
) -> float:
    if not pricing_rule:
        return float(run.estimated_credits or 0)
    unit = _as_float(pricing_rule.get("estimated_credits"), default=float(run.estimated_credits or 0))
    minimum = _as_float(pricing_rule.get("min_credits"), default=0)
    multiplier = _as_float(pricing_rule.get("credit_multiplier"), default=1)
    billing_unit = str(pricing_rule.get("billing_unit") or "per_run")
    if billing_unit == "per_image":
        quantity = max(1, output_count or requested_output_count(payload))
        return max(minimum, unit * quantity * multiplier)
    if billing_unit == "per_run":
        return max(minimum, unit * multiplier)
    return max(minimum, unit * multiplier)


def resolve_provider_cost(
    payload: AiRunRequest,
    output_count: int,
    pricing_rule: Optional[dict[str, object]],
    provider_cost: Optional[float],
) -> Optional[float]:
    if provider_cost is not None:
        return round(float(provider_cost), 6)
    if not pricing_rule:
        return None
    formula = dict(pricing_rule.get("provider_cost_formula") or {})
    amount = _as_optional_float(formula.get("amount"))
    if amount is None:
        return None
    quantity = _resolve_cost_quantity(payload, output_count, str(formula.get("type") or formula.get("unit") or "per_run"))
    return round(amount * quantity, 6)


def resolve_provider_currency(pricing_rule: Optional[dict[str, object]]) -> Optional[str]:
    if not pricing_rule:
        return None
    formula = dict(pricing_rule.get("provider_cost_formula") or {})
    currency = formula.get("currency")
    return str(currency) if currency else None


def requested_output_count(payload: AiRunRequest) -> int:
    return _clamp_count(payload.params.get("count", 1))


def _resolve_cost_quantity(payload: AiRunRequest, output_count: int, formula_type: str) -> int:
    normalized = formula_type.strip().lower()
    if normalized in {"fixed", "per_run", "run"}:
        return 1
    if normalized in {"per_input_image", "input_image"}:
        return max(1, len(payload.input_asset_ids))
    return max(1, output_count or requested_output_count(payload))


def _clamp_count(value: object) -> int:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return 1
    return max(1, min(4, numeric))


def _as_float(value: object, default: float) -> float:
    parsed = _as_optional_float(value)
    return parsed if parsed is not None else default


def _as_optional_float(value: object) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
