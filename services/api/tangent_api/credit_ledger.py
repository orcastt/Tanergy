import os
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.credit_ledger_refund import (
    refund_outstanding_run_charge as _refund_outstanding_run_charge_impl,
)
from tangent_api.credit_ledger_support import (
    LEDGER_REASONS,
    build_credit_preflight_for_account,
    credit_ledger_entry_from_row,
    load_credit_ledger_rows,
    normalize_limit,
    positive_credits,
    write_credit_ledger_entry_for_account,
)
from tangent_api.credit_schemas import (
    CreditLedgerMutationResponse,
    CreditLedgerResponse,
    CreditPreflightResponse,
)
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres as storage_connect_to_postgres
from tangent_api.workspace_entitlements import resolve_ai_charge_summary

connect_to_postgres = storage_connect_to_postgres


def build_credit_ledger_response(
    context: ApiRequestContext,
    limit: int = 50,
    *,
    actor_user_id: Optional[str] = None,
    reason: Optional[str] = None,
    source_id: Optional[str] = None,
    source_type: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> CreditLedgerResponse:
    normalized_limit = normalize_limit(limit)
    charge = resolve_ai_charge_summary(context)
    account_id = charge.charged_account_id
    if not os.getenv("DATABASE_URL"):
        return CreditLedgerResponse(accountId=account_id, balanceCredits=0, entries=[], ok=True)
    balance, rows = load_credit_ledger_rows(
        account_id,
        normalized_limit,
        actor_user_id=actor_user_id,
        connect_db=_connect_to_postgres,
        reason=reason,
        source_id=source_id,
        source_type=source_type,
        workspace_id=workspace_id,
    )
    return CreditLedgerResponse(
        accountId=account_id,
        balanceCredits=balance,
        entries=[credit_ledger_entry_from_row(row) for row in rows],
        ok=True,
    )


def build_credit_preflight_response(
    context: ApiRequestContext,
    required_credits: float,
) -> CreditPreflightResponse:
    if required_credits < 0:
        raise HTTPException(status_code=400, detail="Required credits must be non-negative.")
    charge = resolve_ai_charge_summary(context)
    preflight = build_credit_preflight_for_account(
        charge.charged_account_id,
        required_credits,
        connect_db=_connect_to_postgres,
        has_database_url=bool(os.getenv("DATABASE_URL")),
    )
    return CreditPreflightResponse(**{**preflight.model_dump(by_alias=True), "charge": charge})


def grant_subscription_credits(
    context: ApiRequestContext,
    credits: float,
    source_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    charge = resolve_ai_charge_summary(context)
    return grant_subscription_credits_to_account(
        account_id=charge.charged_account_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        credits=credits,
        source_id=source_id,
        metadata=metadata,
    )


def grant_subscription_credits_to_account(
    account_id: str,
    actor_user_id: str,
    workspace_id: str,
    credits: float,
    source_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    return write_credit_ledger_entry_for_account(
        account_id=account_id,
        actor_user_id=actor_user_id,
        workspace_id=workspace_id,
        credits_delta=positive_credits(credits, "Granted credits"),
        reason="subscription_grant",
        source_id=source_id,
        source_type="subscription",
        connect_db=_connect_to_postgres,
        metadata=metadata,
    )


def record_topup_purchase(
    context: ApiRequestContext,
    credits: float,
    source_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    charge = resolve_ai_charge_summary(context)
    return record_topup_purchase_to_account(
        account_id=charge.charged_account_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        credits=credits,
        source_id=source_id,
        metadata=metadata,
    )


def record_topup_purchase_to_account(
    account_id: str,
    actor_user_id: str,
    workspace_id: str,
    credits: float,
    source_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    return write_credit_ledger_entry_for_account(
        account_id=account_id,
        actor_user_id=actor_user_id,
        workspace_id=workspace_id,
        credits_delta=positive_credits(credits, "Top-up credits"),
        reason="topup_purchase",
        source_id=source_id,
        source_type="payment",
        connect_db=_connect_to_postgres,
        metadata=metadata,
    )


def settle_usage_charge(
    context: ApiRequestContext,
    credits: float,
    run_id: str,
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    required_credits = positive_credits(credits, "Usage credits")
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
    required_credits = positive_credits(credits, "Usage credits")
    preflight = build_credit_preflight_for_account(
        account_id,
        required_credits,
        connect_db=_connect_to_postgres,
        has_database_url=bool(os.getenv("DATABASE_URL")),
    )
    if not preflight.can_run:
        raise HTTPException(status_code=402, detail="Insufficient credits for this AI run.")
    return write_credit_ledger_entry_for_account(
        account_id=account_id,
        actor_user_id=actor_user_id,
        workspace_id=workspace_id,
        credits_delta=-required_credits,
        reason="usage_charge",
        source_id=run_id,
        source_type="ai_run",
        connect_db=_connect_to_postgres,
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
        credits_delta=positive_credits(credits, "Refund credits"),
        reason="usage_refund",
        source_id=run_id,
        source_type="ai_run",
        metadata=metadata,
    )


def refund_outstanding_run_charge(
    context: ApiRequestContext,
    run_id: str,
    metadata: Optional[dict[str, Any]] = None,
    *,
    account_id: Optional[str] = None,
) -> Optional[CreditLedgerMutationResponse]:
    return _refund_outstanding_run_charge_impl(
        context,
        run_id,
        metadata,
        account_id=account_id,
        connect_db=_connect_to_postgres,
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
    return write_credit_ledger_entry_for_account(
        account_id=charge.charged_account_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        credits_delta=credits_delta,
        reason=reason,
        source_id=source_id,
        source_type=source_type,
        connect_db=_connect_to_postgres,
        metadata=metadata,
    )


def _connect_to_postgres():
    try:
        from tangent_api import workspace_entitlements as workspace_entitlements_module
        workspace_connect = getattr(workspace_entitlements_module, "connect_to_postgres", storage_connect_to_postgres)
        if workspace_connect is not storage_connect_to_postgres:
            return workspace_connect()
    except Exception:
        pass
    return connect_to_postgres()
