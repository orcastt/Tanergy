from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.admin_finance_manual_ops import (
    COLLABORATE_PLAN_KEYS,
    TEAM_PLAN_KEYS,
    assert_user_exists,
    assert_workspace_exists,
    grant_included_credits as grant_plan_credits,
    insert_audit,
    insert_ledger_entry,
    insert_manual_payment,
    load_credit_balance,
    manual_response,
    normalize_id,
    normalize_plan_key,
    normalize_subscription_status,
    positive_credits,
    upsert_subscription,
)
from tangent_api.admin_finance_manual_schemas import AdminManualFinanceMutationResponse
from tangent_api.billing_credit_accounts import ensure_credit_account
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.workspace_entitlements import PLAN_CATALOG


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


def manual_set_collaborate_plan(
    *,
    actor_user_id: str,
    grant_included_credits: bool,
    note: Optional[str],
    plan_key: str,
    status: str,
    target_user_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    normalized_plan = normalize_plan_key(plan_key, COLLABORATE_PLAN_KEYS, "Collaborate")
    normalized_status = normalize_subscription_status(status)
    operation_id = f"admin_manual_{uuid4()}"
    target_user_id = normalize_id(target_user_id, "user id")
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_user_exists(cursor, target_user_id)
            account_id = ensure_credit_account(cursor, "user", target_user_id)
            subscription_id = upsert_subscription(
                cursor,
                account_id=account_id,
                operation_id=operation_id,
                owner_id=target_user_id,
                owner_type="user",
                plan_family="collaborate",
                plan_key=normalized_plan,
                seat_capacity=1,
                status=normalized_status,
                workspace_id=None,
            )
            ledger_entry_id = grant_plan_credits(
                cursor,
                account_id=account_id,
                actor_user_id=actor_user_id,
                credits=float(PLAN_CATALOG[normalized_plan]["included_credits"] or 0),
                enabled=grant_included_credits,
                metadata={"note": note, "operationId": operation_id, "planKey": normalized_plan, "targetUserId": target_user_id},
                source_id=subscription_id,
                workspace_id=None,
            )
            balance = load_credit_balance(cursor, account_id)
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.collaborate_plan",
                actor_user_id=actor_user_id,
                metadata={"accountId": account_id, "grantIncludedCredits": grant_included_credits, "note": note, "planKey": normalized_plan, "status": normalized_status},
                target_user_id=target_user_id,
                workspace_id=None,
            )
        connection.commit()
    return manual_response(account_id, audit_id, balance, ledger_entry_id, "Collaborate plan updated.", subscription_id)


def manual_set_team_plan(
    *,
    actor_user_id: str,
    grant_included_credits: bool,
    note: Optional[str],
    plan_key: str,
    seat_capacity: int,
    status: str,
    workspace_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    normalized_plan = normalize_plan_key(plan_key, TEAM_PLAN_KEYS, "Team")
    normalized_status = normalize_subscription_status(status)
    operation_id = f"admin_manual_{uuid4()}"
    workspace_id = normalize_id(workspace_id, "workspace id")
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_workspace_exists(cursor, workspace_id)
            account_id = ensure_credit_account(cursor, "workspace", workspace_id)
            subscription_id = upsert_subscription(
                cursor,
                account_id=account_id,
                operation_id=operation_id,
                owner_id=workspace_id,
                owner_type="workspace",
                plan_family="team",
                plan_key=normalized_plan,
                seat_capacity=seat_capacity,
                status=normalized_status,
                workspace_id=workspace_id,
            )
            credits = float(PLAN_CATALOG[normalized_plan]["included_credits"] or 0) * seat_capacity
            ledger_entry_id = grant_plan_credits(
                cursor,
                account_id=account_id,
                actor_user_id=actor_user_id,
                credits=credits,
                enabled=grant_included_credits,
                metadata={"note": note, "operationId": operation_id, "planKey": normalized_plan, "seatCapacity": seat_capacity},
                source_id=subscription_id,
                workspace_id=workspace_id,
            )
            balance = load_credit_balance(cursor, account_id)
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.team_plan",
                actor_user_id=actor_user_id,
                metadata={"accountId": account_id, "grantIncludedCredits": grant_included_credits, "note": note, "planKey": normalized_plan, "seatCapacity": seat_capacity, "status": normalized_status},
                workspace_id=workspace_id,
            )
        connection.commit()
    return manual_response(account_id, audit_id, balance, ledger_entry_id, "Team plan updated.", subscription_id)


def manual_cancel_subscription(
    *,
    actor_user_id: str,
    note: Optional[str],
    subscription_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    normalized_id = normalize_id(subscription_id, "subscription id")
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, account_id, owner_type, owner_id, workspace_id
                FROM tangent_subscriptions
                WHERE id = %s
                LIMIT 1
                """,
                (normalized_id,),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Subscription not found.")
            cursor.execute(
                """
                UPDATE tangent_subscriptions
                SET status = 'canceled',
                    current_period_end = NOW(),
                    updated_at = NOW()
                WHERE id = %s
                """,
                (normalized_id,),
            )
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.subscription_cancel",
                actor_user_id=actor_user_id,
                metadata={"accountId": row[1], "note": note, "ownerId": row[3], "ownerType": row[2], "subscriptionId": normalized_id},
                target_user_id=str(row[3]) if row[2] == "user" else None,
                workspace_id=row[4],
            )
        connection.commit()
    return AdminManualFinanceMutationResponse(
        accountId=str(row[1]),
        auditId=audit_id,
        message="Subscription canceled.",
        ok=True,
        subscriptionId=normalized_id,
    )
