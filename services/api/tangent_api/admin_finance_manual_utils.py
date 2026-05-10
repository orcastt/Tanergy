from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import HTTPException

from tangent_api.admin_finance_manual_schemas import AdminManualFinanceMutationResponse

COLLABORATE_PLAN_KEYS = {"collaborate_start", "collaborate_plus"}
EFFECT_MODES = {"immediate", "next_week"}
MUTABLE_SUBSCRIPTION_STATUSES = {"active", "trialing"}
TEAM_PLAN_KEYS = {"team_start", "team_growth"}


def manual_response(account_id: str, audit_id: str, balance: float, ledger_entry_id: Optional[str], message: str, subscription_id: str) -> AdminManualFinanceMutationResponse:
    return AdminManualFinanceMutationResponse(
        accountId=account_id,
        auditId=audit_id,
        balanceCredits=balance,
        ledgerEntryId=ledger_entry_id,
        message=message,
        ok=True,
        subscriptionId=subscription_id,
    )


def normalize_id(value: str, label: str) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized:
        raise HTTPException(status_code=400, detail=f"{label.capitalize()} is required.")
    return normalized


def normalize_plan_key(plan_key: str, allowed: set[str], label: str) -> str:
    normalized = normalize_id(plan_key, "plan key")
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid {label} plan key.")
    return normalized


def normalize_subscription_status(status: str) -> str:
    normalized = (status or "active").strip().lower()
    if normalized not in MUTABLE_SUBSCRIPTION_STATUSES:
        raise HTTPException(status_code=400, detail="Manual plan status must be active or trialing.")
    return normalized


def normalize_effect_mode(effect_mode: str) -> str:
    normalized = (effect_mode or "immediate").strip().lower()
    if normalized not in EFFECT_MODES:
        raise HTTPException(status_code=400, detail="Effect mode must be immediate or next_week.")
    return normalized


def resolve_subscription_window(
    *,
    duration_count: int,
    duration_unit_days: int,
    effect_mode: str,
    period_end: Optional[datetime],
) -> tuple[datetime, datetime]:
    normalized_effect_mode = normalize_effect_mode(effect_mode)
    period_start = datetime.now(timezone.utc)
    if normalized_effect_mode == "next_week":
        period_start = period_start + timedelta(days=7)
    if period_end is not None:
        return period_start, period_end
    total_days = max(0, duration_count) * max(1, duration_unit_days)
    if total_days <= 0:
        total_days = 30
    return period_start, period_start + timedelta(days=total_days)


def positive_credits(value: float) -> float:
    if value <= 0:
        raise HTTPException(status_code=400, detail="Credits must be greater than zero.")
    return value


def clean_metadata(metadata: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in metadata.items() if value not in (None, "")}
