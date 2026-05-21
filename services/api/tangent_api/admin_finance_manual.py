from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.admin_finance_manual_ops import (
    assert_user_exists,
    assert_workspace_exists,
    insert_audit,
    insert_ledger_entry,
    insert_manual_payment,
    load_credit_balance,
)
from tangent_api.admin_finance_manual_schemas import AdminManualFinanceMutationResponse
from tangent_api.admin_finance_manual_utils import normalize_id, positive_credits
from tangent_api.billing_credit_accounts import ensure_credit_account
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def manual_topup_user(
    *,
    actor_user_id: str,
    amount_cents: int,
    credits: float,
    currency: str,
    note: Optional[str],
    target_user_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    operation_id = f"admin_manual_{uuid4()}"
    target_user_id = normalize_id(target_user_id, "user id")
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_user_exists(cursor, target_user_id)
            account_id = ensure_credit_account(cursor, "user", target_user_id)
            payment_id = insert_manual_payment(
                cursor,
                account_id=account_id,
                amount_cents=amount_cents,
                currency=currency,
                kind="topup",
                operation_id=operation_id,
                metadata={"credits": credits, "note": note, "ownerUserId": target_user_id},
            )
            ledger_entry_id = insert_ledger_entry(
                cursor,
                account_id=account_id,
                actor_user_id=actor_user_id,
                credits_delta=positive_credits(credits),
                metadata={"note": note, "paymentId": payment_id, "targetUserId": target_user_id},
                reason="topup_purchase",
                source_id=payment_id,
                source_type="payment",
                workspace_id=None,
            )
            balance = load_credit_balance(cursor, account_id)
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.user_topup",
                actor_user_id=actor_user_id,
                metadata={"accountId": account_id, "credits": credits, "note": note, "paymentId": payment_id},
                target_user_id=target_user_id,
                workspace_id=None,
            )
        connection.commit()
    return AdminManualFinanceMutationResponse(
        accountId=account_id,
        auditId=audit_id,
        balanceCredits=balance,
        ledgerEntryId=ledger_entry_id,
        message="User credits topped up.",
        ok=True,
        paymentId=payment_id,
    )


def manual_topup_workspace(
    *,
    actor_user_id: str,
    amount_cents: int,
    credits: float,
    currency: str,
    note: Optional[str],
    workspace_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    operation_id = f"admin_manual_{uuid4()}"
    workspace_id = normalize_id(workspace_id, "workspace id")
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_workspace_exists(cursor, workspace_id)
            account_id = ensure_credit_account(cursor, "workspace", workspace_id)
            payment_id = insert_manual_payment(
                cursor,
                account_id=account_id,
                amount_cents=amount_cents,
                currency=currency,
                kind="workspace_topup",
                operation_id=operation_id,
                metadata={"credits": credits, "note": note, "workspaceId": workspace_id},
            )
            ledger_entry_id = insert_ledger_entry(
                cursor,
                account_id=account_id,
                actor_user_id=actor_user_id,
                credits_delta=positive_credits(credits),
                metadata={"note": note, "paymentId": payment_id, "workspaceId": workspace_id},
                reason="topup_purchase",
                source_id=payment_id,
                source_type="payment",
                workspace_id=workspace_id,
            )
            balance = load_credit_balance(cursor, account_id)
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.workspace_topup",
                actor_user_id=actor_user_id,
                metadata={"accountId": account_id, "credits": credits, "note": note, "paymentId": payment_id},
                workspace_id=workspace_id,
            )
        connection.commit()
    return AdminManualFinanceMutationResponse(
        accountId=account_id,
        auditId=audit_id,
        balanceCredits=balance,
        ledgerEntryId=ledger_entry_id,
        message="Team wallet credits topped up.",
        ok=True,
        paymentId=payment_id,
    )


def manual_adjust_user_credits(
    *,
    actor_user_id: str,
    credits_delta: float,
    note: Optional[str],
    target_user_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    operation_id = f"admin_manual_adjust_{uuid4()}"
    target_user_id = normalize_id(target_user_id, "user id")
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_user_exists(cursor, target_user_id)
            account_id = ensure_credit_account(cursor, "user", target_user_id)
            balance_before = load_credit_balance(cursor, account_id)
            _assert_nonzero_adjustment(credits_delta)
            _assert_adjustment_keeps_balance(balance_before, credits_delta)
            ledger_entry_id = insert_ledger_entry(
                cursor,
                account_id=account_id,
                actor_user_id=actor_user_id,
                credits_delta=credits_delta,
                metadata={"balanceBefore": balance_before, "note": note, "operationId": operation_id, "targetUserId": target_user_id},
                reason="admin_adjustment",
                source_id=operation_id,
                source_type="admin_manual",
                workspace_id=None,
            )
            balance = load_credit_balance(cursor, account_id)
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.user_credit_adjust",
                actor_user_id=actor_user_id,
                metadata={
                    "accountId": account_id,
                    "balanceAfter": balance,
                    "balanceBefore": balance_before,
                    "creditsDelta": credits_delta,
                    "note": note,
                    "operationId": operation_id,
                },
                target_user_id=target_user_id,
                workspace_id=None,
            )
        connection.commit()
    return AdminManualFinanceMutationResponse(
        accountId=account_id,
        auditId=audit_id,
        balanceCredits=balance,
        ledgerEntryId=ledger_entry_id,
        message="User credits adjusted.",
        ok=True,
    )


def manual_adjust_workspace_credits(
    *,
    actor_user_id: str,
    credits_delta: float,
    note: Optional[str],
    workspace_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    operation_id = f"admin_manual_adjust_{uuid4()}"
    workspace_id = normalize_id(workspace_id, "workspace id")
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_workspace_exists(cursor, workspace_id)
            account_id = ensure_credit_account(cursor, "workspace", workspace_id)
            balance_before = load_credit_balance(cursor, account_id)
            _assert_nonzero_adjustment(credits_delta)
            _assert_adjustment_keeps_balance(balance_before, credits_delta)
            ledger_entry_id = insert_ledger_entry(
                cursor,
                account_id=account_id,
                actor_user_id=actor_user_id,
                credits_delta=credits_delta,
                metadata={"balanceBefore": balance_before, "note": note, "operationId": operation_id, "workspaceId": workspace_id},
                reason="admin_adjustment",
                source_id=operation_id,
                source_type="admin_manual",
                workspace_id=workspace_id,
            )
            balance = load_credit_balance(cursor, account_id)
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.workspace_credit_adjust",
                actor_user_id=actor_user_id,
                metadata={
                    "accountId": account_id,
                    "balanceAfter": balance,
                    "balanceBefore": balance_before,
                    "creditsDelta": credits_delta,
                    "note": note,
                    "operationId": operation_id,
                },
                workspace_id=workspace_id,
            )
        connection.commit()
    return AdminManualFinanceMutationResponse(
        accountId=account_id,
        auditId=audit_id,
        balanceCredits=balance,
        ledgerEntryId=ledger_entry_id,
        message="Workspace credits adjusted.",
        ok=True,
    )


def _assert_nonzero_adjustment(credits_delta: float) -> None:
    if credits_delta == 0:
        raise HTTPException(status_code=400, detail="Credit adjustment cannot be zero.")


def _assert_adjustment_keeps_balance(balance_before: float, credits_delta: float) -> None:
    if balance_before + credits_delta < 0:
        raise HTTPException(status_code=400, detail="Credit deduction exceeds the current balance.")
