import json
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.billing_payment_schemas import BillingPaymentRecord
from tangent_api.billing_payment_rows import payment_from_row
from tangent_api.collaborate_subscription_lifecycle import (
    build_collaborate_subscription_metadata,
    calculate_collaborate_subscription_amount_cents,
)
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import require_database_url
from tangent_api.team_subscription_lifecycle import (
    build_team_subscription_metadata,
    calculate_team_subscription_amount_cents,
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
    cents_per_credit = TOPUP_CENTS_PER_CREDIT.get(context.workspace_plan_key or "free_canvas", 1)
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


def create_collaborate_subscription_checkout(
    context: ApiRequestContext,
    *,
    currency: str,
    metadata: dict[str, object],
    plan_key: str,
) -> BillingPaymentRecord:
    require_database_url()
    payment_metadata = build_collaborate_subscription_metadata(
        context,
        metadata=metadata,
        plan_key=plan_key,
    )
    return _create_payment(
        account_owner_id=context.user_id,
        account_owner_type="user",
        amount_cents=calculate_collaborate_subscription_amount_cents(plan_key),
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
    return payment_from_row(row)


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
