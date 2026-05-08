import json
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.billing_payment_schemas import BillingPaymentMutationResponse, BillingPaymentRecord
from tangent_api.credit_ledger import grant_subscription_credits_to_account, record_topup_purchase_to_account
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import require_database_url
from tangent_api.team_subscription_lifecycle import (
    assert_team_subscription_completion_allowed,
    build_team_subscription_metadata,
    calculate_team_subscription_amount_cents,
    provision_team_subscription_payment,
)
from tangent_api.workspace_entitlements import PLAN_CATALOG

PAYMENT_PROVIDER = "manual_test"
TOPUP_CENTS_PER_CREDIT = {
    "collaborate_plus": 1,
    "collaborate_start": 1,
    "enterprise": 1,
    "free_canvas": 2,
    "team_growth": 1,
    "team_start": 1,
}


def list_billing_payments(
    context: ApiRequestContext,
    *,
    kind: Optional[str] = None,
    limit: int = 25,
    status: Optional[str] = None,
    workspace_scoped: bool = False,
) -> list[BillingPaymentRecord]:
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    account_id = _resolve_payment_account_id(context, kind, workspace_scoped)
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, account_id, provider, provider_payment_id, amount_cents, currency,
                       status, created_at, checkout_session_id, kind, metadata
                FROM tangent_payments
                WHERE account_id = %s
                ORDER BY created_at DESC
                LIMIT %s
                """,
                (account_id, limit),
            )
            rows = cursor.fetchall()
    records = [_payment_from_row(row) for row in rows]
    if kind:
        records = [record for record in records if record.kind == kind]
    if status:
        records = [record for record in records if record.status == status]
    if workspace_scoped:
        records = [record for record in records if record.metadata.get("workspaceId") == context.workspace_id]
    return records[:limit]


def create_topup_checkout(
    context: ApiRequestContext,
    *,
    credits: float,
    currency: str,
    metadata: dict[str, object],
) -> BillingPaymentRecord:
    require_database_url()
    if credits <= 0:
        raise HTTPException(status_code=400, detail="Top-up credits must be greater than zero.")
    cents_per_credit = TOPUP_CENTS_PER_CREDIT.get(context.workspace_plan_key or "free_canvas", 1)
    amount_cents = max(1, int(round(float(credits) * cents_per_credit)))
    payment_metadata = {
        **metadata,
        "credits": float(credits),
        "workspaceId": context.workspace_id,
    }
    return _create_payment(
        account_owner_id=context.user_id,
        account_owner_type="user",
        amount_cents=amount_cents,
        currency=currency,
        kind="topup",
        metadata=payment_metadata,
    )


def create_workspace_topup_checkout(
    context: ApiRequestContext,
    *,
    credits: float,
    currency: str,
    metadata: dict[str, object],
) -> BillingPaymentRecord:
    require_database_url()
    if context.workspace_kind != "team_workspace":
        raise HTTPException(status_code=400, detail="Workspace top-up is only available for Team workspaces.")
    if context.workspace_role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Only workspace owners or admins may top up the Team wallet.")
    if credits <= 0:
        raise HTTPException(status_code=400, detail="Top-up credits must be greater than zero.")
    cents_per_credit = TOPUP_CENTS_PER_CREDIT.get(context.workspace_plan_key or "team_start", 1)
    payment_metadata = {
        **metadata,
        "credits": float(credits),
        "workspaceId": context.workspace_id,
        "workspaceKind": context.workspace_kind,
    }
    return _create_payment(
        account_owner_id=context.workspace_id,
        account_owner_type="workspace",
        amount_cents=max(1, int(round(float(credits) * cents_per_credit))),
        currency=currency,
        kind="workspace_topup",
        metadata=payment_metadata,
    )


def create_workspace_seat_checkout(
    context: ApiRequestContext,
    *,
    currency: str,
    metadata: dict[str, object],
    plan_key: str,
    quantity: int,
) -> BillingPaymentRecord:
    require_database_url()
    if context.workspace_kind != "team_workspace":
        raise HTTPException(status_code=400, detail="Seat purchase is only available for Team workspaces.")
    if context.workspace_role not in {"owner", "admin"}:
        raise HTTPException(status_code=403, detail="Only workspace owners or admins may purchase seats.")
    if plan_key not in {"team_start", "team_growth"}:
        raise HTTPException(status_code=400, detail="Invalid team plan key.")
    if quantity < 1:
        raise HTTPException(status_code=400, detail="Seat quantity must be at least one.")
    monthly_price_usd = int(PLAN_CATALOG[plan_key]["monthly_price_usd"] or 0)
    included_credits = int(PLAN_CATALOG[plan_key]["included_credits"] or 0)
    payment_metadata = {
        **metadata,
        "includedCreditsPerSeat": included_credits,
        "planKey": plan_key,
        "quantity": quantity,
        "workspaceId": context.workspace_id,
    }
    return _create_payment(
        account_owner_id=context.workspace_id,
        account_owner_type="workspace",
        amount_cents=monthly_price_usd * 100 * quantity,
        currency=currency,
        kind="seat_purchase",
        metadata=payment_metadata,
    )


def create_team_subscription_checkout(
    context: ApiRequestContext,
    *,
    currency: str,
    metadata: dict[str, object],
    plan_key: str,
    quantity: int,
    team_name: str,
) -> BillingPaymentRecord:
    require_database_url()
    payment_metadata = build_team_subscription_metadata(
        context,
        metadata=metadata,
        plan_key=plan_key,
        quantity=quantity,
        team_name=team_name,
    )
    amount_cents = calculate_team_subscription_amount_cents(plan_key, quantity)
    return _create_payment(
        account_owner_id=context.user_id,
        account_owner_type="user",
        amount_cents=amount_cents,
        currency=currency,
        kind="team_subscription",
        metadata=payment_metadata,
    )


def complete_billing_payment(
    payment_id: str,
    context: ApiRequestContext,
) -> BillingPaymentMutationResponse:
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, account_id, provider, provider_payment_id, amount_cents, currency,
                       status, created_at, checkout_session_id, kind, metadata
                FROM tangent_payments
                WHERE id = %s
                LIMIT 1
                """,
                (payment_id,),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Payment not found.")
            payment = _payment_from_row(row)
            _assert_payment_completion_allowed(payment, context)
            if payment.status == "succeeded":
                return BillingPaymentMutationResponse(ok=True, payment=payment)

            provider_payment_id = f"payment_{uuid4()}"
            cursor.execute(
                """
                UPDATE tangent_payments
                SET status = 'succeeded',
                    provider_payment_id = %s
                WHERE id = %s
                RETURNING id, account_id, provider, provider_payment_id, amount_cents, currency,
                          status, created_at, checkout_session_id, kind, metadata
                """,
                (provider_payment_id, payment_id),
            )
            updated_row = cursor.fetchone()
            updated = _payment_from_row(updated_row)

            topup_entry_id = None
            if updated.kind == "topup":
                credits = float(updated.metadata.get("credits") or 0)
                mutation = record_topup_purchase_to_account(
                    account_id=str(updated.account_id),
                    actor_user_id=context.user_id,
                    workspace_id=context.workspace_id,
                    credits=credits,
                    source_id=updated.id,
                    metadata={
                        "checkoutSessionId": updated.checkout_session_id,
                        "paymentId": updated.id,
                        **updated.metadata,
                    },
                )
                topup_entry_id = mutation.entry.id
            elif updated.kind == "workspace_topup":
                credits = float(updated.metadata.get("credits") or 0)
                mutation = record_topup_purchase_to_account(
                    account_id=str(updated.account_id),
                    actor_user_id=context.user_id,
                    workspace_id=str(updated.metadata.get("workspaceId") or context.workspace_id),
                    credits=credits,
                    source_id=updated.id,
                    metadata={
                        "checkoutSessionId": updated.checkout_session_id,
                        "paymentId": updated.id,
                        **updated.metadata,
                    },
                )
                topup_entry_id = mutation.entry.id
            elif updated.kind == "seat_purchase":
                _upsert_workspace_subscription(cursor, updated)
                _grant_team_subscription_credits(updated, context)
            elif updated.kind == "team_subscription":
                updated = provision_team_subscription_payment(cursor, updated, context)
                _upsert_workspace_subscription(cursor, updated)
                _grant_team_subscription_credits(updated, context)
        connection.commit()
    return BillingPaymentMutationResponse(ok=True, payment=updated, topupEntryId=topup_entry_id)


def _grant_team_subscription_credits(
    payment: BillingPaymentRecord,
    context: ApiRequestContext,
) -> None:
    credits = float(payment.metadata.get("includedCreditsPerSeat") or 0) * int(payment.metadata.get("quantity") or 0)
    if credits <= 0:
        return
    grant_subscription_credits_to_account(
        account_id=str(payment.account_id),
        actor_user_id=context.user_id,
        workspace_id=str(payment.metadata.get("workspaceId") or context.workspace_id),
        credits=credits,
        source_id=payment.id,
        metadata={
            "checkoutSessionId": payment.checkout_session_id,
            "paymentId": payment.id,
            **payment.metadata,
        },
    )


def _create_payment(
    *,
    account_owner_id: str,
    account_owner_type: str,
    amount_cents: int,
    currency: str,
    kind: str,
    metadata: dict[str, object],
) -> BillingPaymentRecord:
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            account_id = _ensure_credit_account(cursor, account_owner_type, account_owner_id)
            payment_id = f"payment_{uuid4()}"
            checkout_session_id = f"checkout_{uuid4()}"
            cursor.execute(
                """
                INSERT INTO tangent_payments (
                    id,
                    account_id,
                    provider,
                    provider_payment_id,
                    amount_cents,
                    currency,
                    status,
                    checkout_session_id,
                    kind,
                    metadata
                )
                VALUES (%s, %s, %s, NULL, %s, %s, 'pending', %s, %s, %s::jsonb)
                RETURNING id, account_id, provider, provider_payment_id, amount_cents, currency,
                          status, created_at, checkout_session_id, kind, metadata
                """,
                (
                    payment_id,
                    account_id,
                    PAYMENT_PROVIDER,
                    amount_cents,
                    currency.lower(),
                    checkout_session_id,
                    kind,
                    json.dumps(metadata),
                ),
            )
            row = cursor.fetchone()
        connection.commit()
    return _payment_from_row(row)


def _ensure_credit_account(cursor: object, owner_type: str, owner_id: str) -> str:
    account_id = f"credit_{owner_type}_{owner_id}"
    account_kind = "team_wallet" if owner_type == "workspace" else "personal_wallet"
    cursor.execute(
        """
        INSERT INTO tangent_credit_accounts (
            id,
            owner_type,
            owner_id,
            account_kind,
            status
        )
        VALUES (%s, %s, %s, %s, 'active')
        ON CONFLICT (owner_type, owner_id)
        DO UPDATE SET
            status = 'active',
            account_kind = EXCLUDED.account_kind,
            updated_at = NOW()
        RETURNING id
        """,
        (account_id, owner_type, owner_id, account_kind),
    )
    row = cursor.fetchone()
    return str(row[0]) if row else account_id


def _resolve_payment_account_id(context: ApiRequestContext, kind: Optional[str], workspace_scoped: bool) -> str:
    if workspace_scoped or kind == "seat_purchase":
        return f"credit_workspace_{context.workspace_id}"
    return f"credit_user_{context.user_id}"


def _assert_payment_completion_allowed(payment: BillingPaymentRecord, context: ApiRequestContext) -> None:
    if payment.kind == "workspace_topup":
        if context.workspace_role not in {"owner", "admin"}:
            raise HTTPException(status_code=403, detail="Only workspace owners or admins may complete Team wallet payments.")
        if payment.metadata.get("workspaceId") != context.workspace_id:
            raise HTTPException(status_code=403, detail="Workspace payment does not belong to this workspace.")
        return
    if payment.kind == "seat_purchase":
        if context.workspace_role not in {"owner", "admin"}:
            raise HTTPException(status_code=403, detail="Only workspace owners or admins may complete seat payments.")
        if payment.metadata.get("workspaceId") != context.workspace_id:
            raise HTTPException(status_code=403, detail="Seat payment does not belong to this workspace.")
        return
    if payment.kind == "team_subscription":
        assert_team_subscription_completion_allowed(payment, context)
        return
    expected_account_id = f"credit_user_{context.user_id}"
    if payment.account_id != expected_account_id:
        raise HTTPException(status_code=403, detail="Payment does not belong to the current user.")


def _upsert_workspace_subscription(cursor: object, payment: BillingPaymentRecord) -> None:
    workspace_id = str(payment.metadata.get("workspaceId") or "")
    plan_key = str(payment.metadata.get("planKey") or "")
    if not workspace_id or plan_key not in {"team_start", "team_growth"}:
        return
    account_id = str(payment.account_id or f"credit_workspace_{workspace_id}")
    seat_capacity = int(payment.metadata.get("quantity") or 1)
    cursor.execute(
        """
        SELECT id
        FROM tangent_subscriptions
        WHERE account_id = %s
          AND status IN ('active', 'trialing')
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (account_id,),
    )
    row = cursor.fetchone()
    current_period_end = datetime.now(timezone.utc) + timedelta(days=30)
    if row is None:
        cursor.execute(
            """
            INSERT INTO tangent_subscriptions (
                id,
                account_id,
                owner_type,
                owner_id,
                workspace_id,
                plan_family,
                provider,
                provider_customer_id,
                provider_subscription_id,
                plan_key,
                status,
                seat_capacity,
                current_period_start,
                current_period_end
            )
            VALUES (%s, %s, 'workspace', %s, %s, 'team', %s, NULL, %s, %s, 'active', %s, NOW(), %s)
            """,
            (
                f"subscription_{uuid4()}",
                account_id,
                workspace_id,
                workspace_id,
                payment.provider,
                payment.id,
                plan_key,
                seat_capacity,
                current_period_end,
            ),
        )
        return
    cursor.execute(
        """
        UPDATE tangent_subscriptions
        SET plan_key = %s,
            plan_family = 'team',
            owner_type = 'workspace',
            owner_id = %s,
            workspace_id = %s,
            provider = %s,
            provider_subscription_id = %s,
            status = 'active',
            seat_capacity = GREATEST(seat_capacity, %s),
            current_period_start = COALESCE(current_period_start, NOW()),
            current_period_end = %s,
            updated_at = NOW()
        WHERE id = %s
        """,
        (
            plan_key,
            workspace_id,
            workspace_id,
            payment.provider,
            payment.id,
            seat_capacity,
            current_period_end,
            row[0],
        ),
    )


def _payment_from_row(row: tuple[object, ...]) -> BillingPaymentRecord:
    return BillingPaymentRecord(
        accountId=row[1],
        amountCents=int(row[4] or 0),
        checkoutSessionId=row[8],
        createdAt=_to_iso(row[7]),
        currency=str(row[5] or "usd"),
        id=str(row[0]),
        kind=str(row[9] or "topup"),
        metadata=dict(row[10] or {}),
        provider=str(row[2] or PAYMENT_PROVIDER),
        providerPaymentId=row[3],
        status=str(row[6] or "pending"),
    )


def _to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
