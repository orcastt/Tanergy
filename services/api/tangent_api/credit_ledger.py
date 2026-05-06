import json
import os
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.ai_schemas import AiRunChargeSummary
from tangent_api.credit_schemas import (
    CreditLedgerEntryRecord,
    CreditLedgerMutationResponse,
    CreditLedgerResponse,
    CreditPreflightResponse,
)
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres
from tangent_api.workspace_entitlements import resolve_ai_charge_summary

LEDGER_REASONS = {
    "admin_adjustment",
    "plan_change_adjustment",
    "seat_change_adjustment",
    "subscription_grant",
    "topup_purchase",
    "usage_charge",
    "usage_refund",
}


def build_credit_ledger_response(context: ApiRequestContext, limit: int = 50) -> CreditLedgerResponse:
    normalized_limit = _normalize_limit(limit)
    charge = resolve_ai_charge_summary(context)
    account_id = charge.charged_account_id
    if not os.getenv("DATABASE_URL"):
        return CreditLedgerResponse(accountId=account_id, balanceCredits=0, entries=[], ok=True)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            balance = _load_credit_balance(cursor, account_id)
            cursor.execute(
                """
                SELECT id, account_id, workspace_id, actor_user_id, source_type, source_id,
                       credits_delta, reason, metadata, created_at
                FROM tangent_credit_ledger
                WHERE account_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (account_id, normalized_limit),
            )
            rows = cursor.fetchall()
    return CreditLedgerResponse(
        accountId=account_id,
        balanceCredits=balance,
        entries=[_credit_ledger_entry_from_row(row) for row in rows],
        ok=True,
    )


def build_credit_preflight_response(
    context: ApiRequestContext,
    required_credits: float,
) -> CreditPreflightResponse:
    if required_credits < 0:
        raise HTTPException(status_code=400, detail="Required credits must be non-negative.")
    charge = resolve_ai_charge_summary(context)
    account_id = charge.charged_account_id
    available_credits = 0.0
    if os.getenv("DATABASE_URL"):
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                available_credits = _load_credit_balance(cursor, account_id)
    can_run = available_credits >= required_credits
    shortfall = max(0.0, required_credits - available_credits)
    return CreditPreflightResponse(
        accountId=account_id,
        availableCredits=available_credits,
        canRun=can_run,
        charge=charge,
        ok=True,
        preflightStatus="ok" if can_run else "insufficient_credits",
        requiredCredits=required_credits,
        shortfallCredits=shortfall,
    )


def grant_subscription_credits(
    context: ApiRequestContext,
    credits: float,
    source_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    return write_credit_ledger_entry(
        context=context,
        credits_delta=_positive_credits(credits, "Granted credits"),
        reason="subscription_grant",
        source_id=source_id,
        source_type="subscription",
        metadata=metadata,
    )


def record_topup_purchase(
    context: ApiRequestContext,
    credits: float,
    source_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    return write_credit_ledger_entry(
        context=context,
        credits_delta=_positive_credits(credits, "Top-up credits"),
        reason="topup_purchase",
        source_id=source_id,
        source_type="payment",
        metadata=metadata,
    )


def settle_usage_charge(
    context: ApiRequestContext,
    credits: float,
    run_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    required_credits = _positive_credits(credits, "Usage credits")
    charge = resolve_ai_charge_summary(context)
    return settle_usage_charge_to_account(
        account_id=charge.charged_account_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        credits=required_credits,
        run_id=run_id,
        metadata=metadata,
    )


def settle_usage_charge_to_account(
    account_id: str,
    actor_user_id: str,
    workspace_id: str,
    credits: float,
    run_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    required_credits = _positive_credits(credits, "Usage credits")
    preflight = _build_credit_preflight_for_account(account_id, required_credits)
    if not preflight.can_run:
        raise HTTPException(status_code=402, detail="Insufficient credits for this AI run.")
    return _write_credit_ledger_entry_for_account(
        account_id=account_id,
        actor_user_id=actor_user_id,
        workspace_id=workspace_id,
        credits_delta=-required_credits,
        reason="usage_charge",
        source_id=run_id,
        source_type="ai_run",
        metadata=metadata,
    )


def settle_usage_refund(
    context: ApiRequestContext,
    credits: float,
    run_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    return write_credit_ledger_entry(
        context=context,
        credits_delta=_positive_credits(credits, "Refund credits"),
        reason="usage_refund",
        source_id=run_id,
        source_type="ai_run",
        metadata=metadata,
    )


def record_admin_adjustment(
    context: ApiRequestContext,
    credits_delta: float,
    adjustment_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    if credits_delta == 0:
        raise HTTPException(status_code=400, detail="Credit adjustment cannot be zero.")
    return write_credit_ledger_entry(
        context=context,
        credits_delta=credits_delta,
        reason="admin_adjustment",
        source_id=adjustment_id,
        source_type="admin",
        metadata=metadata,
    )


def write_credit_ledger_entry(
    context: ApiRequestContext,
    credits_delta: float,
    reason: str,
    source_id: Optional[str],
    source_type: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    if reason not in LEDGER_REASONS:
        raise HTTPException(status_code=400, detail="Invalid credit ledger reason.")
    if credits_delta == 0:
        raise HTTPException(status_code=400, detail="Credit delta cannot be zero.")
    if not os.getenv("DATABASE_URL"):
        raise HTTPException(status_code=501, detail="Credit ledger persistence is not configured.")

    charge = resolve_ai_charge_summary(context)
    return _write_credit_ledger_entry_for_account(
        account_id=charge.charged_account_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        credits_delta=credits_delta,
        reason=reason,
        source_id=source_id,
        source_type=source_type,
        metadata=metadata,
    )


def _build_credit_preflight_for_account(
    account_id: str,
    required_credits: float,
) -> CreditPreflightResponse:
    available_credits = 0.0
    if os.getenv("DATABASE_URL"):
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                available_credits = _load_credit_balance(cursor, account_id)
    can_run = available_credits >= required_credits
    shortfall = max(0.0, required_credits - available_credits)
    return CreditPreflightResponse(
        accountId=account_id,
        availableCredits=available_credits,
        canRun=can_run,
        charge=AiRunChargeSummary(
            chargedAccountId=account_id,
            chargedScope="actor_personal",
            entitlementSource="ledger_account_override",
            payerLabel="Charges your credits",
            planKey="unknown",
            preflightStatus="ok" if can_run else "insufficient_credits",
            workspaceKind="solo_workspace",
            workspaceSeatId=None,
        ),
        ok=True,
        preflightStatus="ok" if can_run else "insufficient_credits",
        requiredCredits=required_credits,
        shortfallCredits=shortfall,
    )


def _write_credit_ledger_entry_for_account(
    account_id: str,
    actor_user_id: str,
    workspace_id: str,
    credits_delta: float,
    reason: str,
    source_id: Optional[str],
    source_type: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    entry_id = f"credit_ledger_{uuid4()}"
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tangent_credit_ledger (
                    id,
                    account_id,
                    workspace_id,
                    actor_user_id,
                    source_type,
                    source_id,
                    credits_delta,
                    reason,
                    metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                RETURNING id, account_id, workspace_id, actor_user_id, source_type, source_id,
                          credits_delta, reason, metadata, created_at
                """,
                (
                    entry_id,
                    account_id,
                    workspace_id,
                    actor_user_id,
                    source_type,
                    source_id,
                    credits_delta,
                    reason,
                    json.dumps(metadata or {}),
                ),
            )
            row = cursor.fetchone()
            balance = _load_credit_balance(cursor, account_id)
        connection.commit()
    return CreditLedgerMutationResponse(
        accountId=account_id,
        balanceCredits=balance,
        entry=_credit_ledger_entry_from_row(row),
        ok=True,
    )


def _load_credit_balance(cursor: object, account_id: str) -> float:
    cursor.execute(
        """
        SELECT COALESCE(SUM(credits_delta), 0)
        FROM tangent_credit_ledger
        WHERE account_id = %s
        """,
        (account_id,),
    )
    row = cursor.fetchone()
    return float(row[0] or 0) if row else 0.0


def _positive_credits(value: float, label: str) -> float:
    if value <= 0:
        raise HTTPException(status_code=400, detail=f"{label} must be greater than zero.")
    return value


def _credit_ledger_entry_from_row(row: tuple[object, ...]) -> CreditLedgerEntryRecord:
    return CreditLedgerEntryRecord(
        accountId=str(row[1]),
        actorUserId=row[3],
        createdAt=_to_iso(row[9]),
        creditsDelta=float(row[6] or 0),
        id=str(row[0]),
        metadata=_normalize_metadata(row[8]),
        reason=str(row[7]),
        sourceId=row[5],
        sourceType=str(row[4]),
        workspaceId=row[2],
    )


def _normalize_limit(limit: int) -> int:
    if limit < 1:
        return 1
    return min(limit, 100)


def _normalize_metadata(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
