import math
from typing import Any, Optional

from tangent_api.ai_control_plane_support import clamp_count
from tangent_api.ai_schemas import AiRunRequest


CREDIT_USD_VALUE = 0.01
DEFAULT_GROSS_MARGIN = 0.25
DEFAULT_TOKEN_OUTPUT_ESTIMATE = 800
ROUNDING_INCREMENT_CREDITS = 0.5
TOKEN_CHARS = 4


def estimate_credits_for_rule(
    payload: AiRunRequest,
    pricing_rule: dict[str, Any],
    *,
    output_count: Optional[int] = None,
    provider_cost: Optional[float] = None,
    fallback_credits: float = 1,
) -> float:
    formula = dict(pricing_rule.get("provider_cost_formula") or {})
    formula_type = str(formula.get("type") or formula.get("unit") or "").strip().lower()
    minimum = _as_float(pricing_rule.get("min_credits"), fallback_credits)
    multiplier = _as_float(pricing_rule.get("credit_multiplier"), 1)

    if formula_type == "token_usage_estimate":
        cost = provider_cost if provider_cost is not None else estimate_token_provider_cost(payload, formula)
        credits = credits_from_provider_cost(cost, formula=formula, minimum=minimum)
        return round(credits * multiplier, 2)

    if str(pricing_rule.get("billing_unit") or "per_run") == "per_image":
        quantity = max(1, output_count or clamp_count(payload.params.get("count", 1)))
        cost = provider_cost if provider_cost is not None else _as_optional_float(formula.get("amount"))
        if cost is not None:
            credits = credits_from_provider_cost(cost, formula=formula, minimum=minimum)
            return round(credits * quantity * multiplier, 2)
        unit = _as_float(pricing_rule.get("estimated_credits"), fallback_credits)
        return max(minimum, unit * quantity * multiplier)

    unit = _as_float(pricing_rule.get("estimated_credits"), fallback_credits)
    return max(minimum, unit * multiplier)


def estimate_token_provider_cost(payload: AiRunRequest, formula: dict[str, Any]) -> float:
    input_tokens = estimate_input_tokens(payload, formula)
    output_tokens = max(
        _as_float(payload.params.get("maxOutputTokens"), 0),
        _as_float(payload.params.get("estimatedOutputTokens"), 0),
        _as_float(formula.get("estimatedOutputTokens"), DEFAULT_TOKEN_OUTPUT_ESTIMATE),
    )
    input_price = _as_float(formula.get("inputUsdPerMTok") or formula.get("input_usd_per_mtok"), 0)
    output_price = _as_float(formula.get("outputUsdPerMTok") or formula.get("output_usd_per_mtok"), 0)
    return round((input_tokens * input_price + output_tokens * output_price) / 1_000_000, 8)


def estimate_input_tokens(payload: AiRunRequest, formula: dict[str, Any]) -> int:
    configured_floor = int(_as_float(formula.get("estimatedInputTokens"), 0))
    text = "\n\n".join(_payload_text_parts(payload))
    text_tokens = math.ceil(len(text) / TOKEN_CHARS) if text else 0
    image_tokens = int(_as_float(formula.get("imageInputTokens"), 0)) * len(payload.input_asset_ids)
    return max(1, configured_floor, text_tokens + image_tokens)


def credits_from_provider_cost(
    provider_cost: Optional[float],
    *,
    formula: Optional[dict[str, Any]] = None,
    minimum: float = 0,
) -> float:
    if provider_cost is None:
        return minimum
    formula = dict(formula or {})
    credit_usd = _as_float(formula.get("creditUsd") or formula.get("credit_usd"), CREDIT_USD_VALUE)
    margin = _as_float(formula.get("grossMargin") or formula.get("gross_margin"), DEFAULT_GROSS_MARGIN)
    retained = max(0.01, 1 - min(max(margin, 0), 0.95))
    raw_credits = float(provider_cost) / retained / max(credit_usd, 0.0001)
    rounded = math.ceil(raw_credits / ROUNDING_INCREMENT_CREDITS) * ROUNDING_INCREMENT_CREDITS
    return max(minimum, round(rounded, 2))


def _payload_text_parts(payload: AiRunRequest) -> list[str]:
    parts: list[str] = []
    _append_text(parts, payload.system_prompt)
    _append_text(parts, payload.prompt)
    raw_messages = payload.params.get("messages")
    if isinstance(raw_messages, list):
        for item in raw_messages[:32]:
            if isinstance(item, dict):
                _append_message_content(parts, item.get("content"))
    for key in ("context", "conversation", "promptContext"):
        _append_text(parts, payload.params.get(key))
    return parts


def _append_message_content(parts: list[str], content: object) -> None:
    if isinstance(content, str):
        _append_text(parts, content)
        return
    if isinstance(content, list):
        for item in content:
            if isinstance(item, dict):
                _append_text(parts, item.get("text"))


def _append_text(parts: list[str], value: object) -> None:
    if isinstance(value, str):
        text = value.strip()
        if text:
            parts.append(text)


def _as_float(value: object, default: float) -> float:
    parsed = _as_optional_float(value)
    return parsed if parsed is not None else default


def _as_optional_float(value: object) -> Optional[float]:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None
