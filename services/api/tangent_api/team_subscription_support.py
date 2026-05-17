from fastapi import HTTPException

from tangent_api.plan_catalog import annual_price_usd_for_plan, included_credits_for_plan, monthly_price_usd_for_plan, seat_max_for_plan
from tangent_api.request_context import ApiRequestContext

TEAM_PLAN_KEYS = {"team_start", "team_growth"}
TEAM_SEAT_MAX = 15


def build_team_subscription_metadata(
    context: ApiRequestContext,
    *,
    billing_interval: str,
    metadata: dict[str, object],
    plan_key: str,
    quantity: int,
    team_name: str,
) -> dict[str, object]:
    normalized_plan = _normalize_team_plan_key(plan_key)
    normalized_interval = _normalize_billing_interval(billing_interval)
    normalized_quantity = _normalize_team_quantity(quantity)
    normalized_team_name = _normalize_team_name(team_name)
    included_credits = included_credits_for_plan(normalized_plan)
    return {
        "billingInterval": normalized_interval,
        **metadata,
        "checkoutWorkspaceId": context.workspace_id,
        "includedCreditsPerSeat": included_credits,
        "ownerUserId": context.user_id,
        "planFamily": "team",
        "planKey": normalized_plan,
        "quantity": normalized_quantity,
        "teamName": normalized_team_name,
    }


def calculate_team_subscription_amount_cents(plan_key: str, quantity: int, billing_interval: str) -> int:
    normalized_plan = _normalize_team_plan_key(plan_key)
    normalized_interval = _normalize_billing_interval(billing_interval)
    normalized_quantity = _normalize_team_quantity(quantity)
    if normalized_interval == "annual":
        annual_price_usd = int(annual_price_usd_for_plan(normalized_plan) or 0)
        return annual_price_usd * 100 * 12 * normalized_quantity
    monthly_price_usd = int(monthly_price_usd_for_plan(normalized_plan) or 0)
    return monthly_price_usd * 100 * normalized_quantity


def _normalize_team_plan_key(plan_key: str) -> str:
    normalized = plan_key.strip()
    if normalized not in TEAM_PLAN_KEYS:
        raise HTTPException(status_code=400, detail="Invalid team plan key.")
    return normalized


def _normalize_billing_interval(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in {"monthly", "annual"}:
        raise HTTPException(status_code=400, detail="Invalid billing interval.")
    return normalized


def _subscription_term_days(billing_interval: str) -> int:
    return 365 if billing_interval == "annual" else 30


def _normalize_team_quantity(quantity: int) -> int:
    if quantity < 1:
        raise HTTPException(status_code=400, detail="Team seat quantity must be at least one.")
    max_seats = seat_max_for_plan("team_growth") or TEAM_SEAT_MAX
    if quantity > max_seats:
        raise HTTPException(status_code=400, detail=f"Team seat quantity cannot exceed {max_seats}.")
    return quantity


def _resolve_next_seat_capacity(*, current_capacity: int, payment_kind: str, quantity: int) -> int:
    if payment_kind == "seat_purchase":
        next_capacity = current_capacity + quantity
    else:
        next_capacity = max(current_capacity, quantity)
    max_seats = seat_max_for_plan("team_growth") or TEAM_SEAT_MAX
    if next_capacity > max_seats:
        raise HTTPException(status_code=400, detail=f"Team seat capacity cannot exceed {max_seats}.")
    return next_capacity


def _normalize_team_name(team_name: str) -> str:
    normalized = " ".join(team_name.strip().split())
    if not normalized:
        raise HTTPException(status_code=400, detail="Team name is required.")
    if len(normalized) > 80:
        raise HTTPException(status_code=400, detail="Team name is too long.")
    return normalized
