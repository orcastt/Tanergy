from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.billing_payment_schemas import BillingPaymentRecord
from tangent_api.plan_catalog import annual_price_usd_for_plan, included_credits_for_plan, monthly_price_usd_for_plan
from tangent_api.request_context import ApiRequestContext

COLLABORATE_PLAN_KEYS = {"collaborate_start", "collaborate_plus"}


def build_collaborate_subscription_metadata(
    context: ApiRequestContext,
    *,
    billing_interval: str,
    metadata: dict[str, object],
    plan_key: str,
) -> dict[str, object]:
    normalized_plan = _normalize_collaborate_plan_key(plan_key)
    normalized_interval = _normalize_billing_interval(billing_interval)
    included_credits = included_credits_for_plan(normalized_plan)
    return {
        "billingInterval": normalized_interval,
        **metadata,
        "checkoutWorkspaceId": context.workspace_id,
        "includedCredits": included_credits,
        "ownerUserId": context.user_id,
        "planFamily": "collaborate",
        "planKey": normalized_plan,
    }


def calculate_collaborate_subscription_amount_cents(plan_key: str, billing_interval: str) -> int:
    normalized_plan = _normalize_collaborate_plan_key(plan_key)
    normalized_interval = _normalize_billing_interval(billing_interval)
    if normalized_interval == "annual":
        annual_price_usd = int(annual_price_usd_for_plan(normalized_plan) or 0)
        return annual_price_usd * 100 * 12
    monthly_price_usd = int(monthly_price_usd_for_plan(normalized_plan) or 0)
    return monthly_price_usd * 100


def assert_collaborate_subscription_completion_allowed(payment: BillingPaymentRecord, context: ApiRequestContext) -> None:
    owner_user_id = str(payment.metadata.get("ownerUserId") or "")
    if owner_user_id != context.user_id:
        raise HTTPException(status_code=403, detail="Collaborate payment does not belong to the current user.")


def upsert_collaborate_subscription(
    cursor: object,
    payment: BillingPaymentRecord,
    context: ApiRequestContext,
) -> None:
    assert_collaborate_subscription_completion_allowed(payment, context)
    plan_key = _normalize_collaborate_plan_key(str(payment.metadata.get("planKey") or ""))
    account_id = str(payment.account_id or f"credit_user_{context.user_id}")
    cursor.execute(
        """
        SELECT id
        FROM tangent_subscriptions
        WHERE account_id = %s
          AND plan_family = 'collaborate'
          AND status IN ('active', 'trialing')
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (account_id,),
    )
    row = cursor.fetchone()
    billing_interval = _normalize_billing_interval(str(payment.metadata.get("billingInterval") or "monthly"))
    current_period_start = datetime.now(timezone.utc)
    current_period_end = current_period_start + timedelta(days=_subscription_term_days(billing_interval))
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
            VALUES (%s, %s, 'user', %s, NULL, 'collaborate', %s, NULL, %s, %s, 'active', 1, %s, %s)
            """,
            (
                f"subscription_{uuid4()}",
                account_id,
                context.user_id,
                payment.provider,
                payment.id,
                plan_key,
                current_period_start,
                current_period_end,
            ),
        )
        return
    cursor.execute(
        """
        UPDATE tangent_subscriptions
        SET plan_key = %s,
            plan_family = 'collaborate',
            owner_type = 'user',
            owner_id = %s,
            workspace_id = NULL,
            provider = %s,
            provider_subscription_id = %s,
            status = 'active',
            seat_capacity = 1,
            current_period_start = %s,
            current_period_end = %s,
            updated_at = NOW()
        WHERE id = %s
        """,
        (
            plan_key,
            context.user_id,
            payment.provider,
            payment.id,
            current_period_start,
            current_period_end,
            row[0],
        ),
    )


def subscription_credits_from_payment(payment: BillingPaymentRecord) -> float:
    return float(payment.metadata.get("includedCredits") or 0)


def _normalize_collaborate_plan_key(plan_key: str) -> str:
    normalized = plan_key.strip()
    if normalized not in COLLABORATE_PLAN_KEYS:
        raise HTTPException(status_code=400, detail="Invalid Collaborate plan key.")
    return normalized


def _normalize_billing_interval(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in {"monthly", "annual"}:
        raise HTTPException(status_code=400, detail="Invalid billing interval.")
    return normalized


def _subscription_term_days(billing_interval: str) -> int:
    return 365 if billing_interval == "annual" else 30
