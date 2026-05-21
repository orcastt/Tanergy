import json
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.billing_payment_checkout_support import (
    assert_team_seat_purchase_within_capacity,
    resolve_payment_account_id,
    topup_cents_per_credit,
)
from tangent_api.billing_credit_accounts import ensure_credit_account
from tangent_api.billing_payment_provider import get_payment_provider, require_checkout_provider_ready
from tangent_api.billing_payment_schemas import BillingPaymentRecord
from tangent_api.billing_payment_rows import payment_from_row
from tangent_api.collaborate_subscription_lifecycle import (
    build_collaborate_subscription_metadata,
    calculate_collaborate_subscription_amount_cents,
)
from tangent_api.plan_catalog import included_credits_for_plan, monthly_price_usd_for_plan
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import require_database_url
from tangent_api.team_subscription_lifecycle import (
    build_team_subscription_metadata,
    calculate_team_subscription_amount_cents,
)


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

    account_id = resolve_payment_account_id(context, kind, workspace_scoped)
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
    records = [payment_from_row(row) for row in rows]
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
    cents_per_credit = topup_cents_per_credit(context.workspace_plan_key, "free_canvas")
    amount_cents = max(1, int(round(float(credits) * cents_per_credit)))
    payment_metadata = {
        **metadata,
        "credits": float(credits),
        "workspaceId": context.workspace_id,
        "workspaceKind": context.workspace_kind,
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
    cents_per_credit = topup_cents_per_credit(context.workspace_plan_key, "team_start")
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
    assert_team_seat_purchase_within_capacity(context.workspace_id, plan_key, quantity)
    monthly_price_usd = int(monthly_price_usd_for_plan(plan_key) or 0)
    included_credits = included_credits_for_plan(plan_key)
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
    billing_interval: str,
    currency: str,
    metadata: dict[str, object],
    plan_key: str,
    quantity: int,
    team_name: str,
) -> BillingPaymentRecord:
    require_database_url()
    payment_metadata = build_team_subscription_metadata(
        context,
        billing_interval=billing_interval,
        metadata=metadata,
        plan_key=plan_key,
        quantity=quantity,
        team_name=team_name,
    )
    amount_cents = calculate_team_subscription_amount_cents(plan_key, quantity, billing_interval)
    return _create_payment(
        account_owner_id=context.user_id,
        account_owner_type="user",
        amount_cents=amount_cents,
        currency=currency,
        kind="team_subscription",
        metadata=payment_metadata,
    )


def create_collaborate_subscription_checkout(
    context: ApiRequestContext,
    *,
    billing_interval: str,
    currency: str,
    metadata: dict[str, object],
    plan_key: str,
) -> BillingPaymentRecord:
    require_database_url()
    payment_metadata = build_collaborate_subscription_metadata(
        context,
        billing_interval=billing_interval,
        metadata=metadata,
        plan_key=plan_key,
    )
    return _create_payment(
        account_owner_id=context.user_id,
        account_owner_type="user",
        amount_cents=calculate_collaborate_subscription_amount_cents(plan_key, billing_interval),
        currency=currency,
        kind="collaborate_subscription",
        metadata=payment_metadata,
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
            account_id = ensure_credit_account(cursor, account_owner_type, account_owner_id)
            payment_id = f"payment_{uuid4()}"
            checkout_session_id = f"checkout_{uuid4()}"
            payment_provider = get_payment_provider()
            require_checkout_provider_ready(payment_provider)
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
                    payment_provider,
                    amount_cents,
                    currency.lower(),
                    checkout_session_id,
                    kind,
                    json.dumps(metadata),
                ),
            )
            row = cursor.fetchone()
        connection.commit()
    return payment_from_row(row)
