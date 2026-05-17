import json
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.billing_payment_schemas import BillingPaymentRecord
from tangent_api.plan_catalog import included_credits_for_plan
from tangent_api.request_context import ApiRequestContext
from tangent_api.team_subscription_support import (
    TEAM_PLAN_KEYS,
    _normalize_billing_interval,
    _normalize_team_name,
    _normalize_team_plan_key,
    _normalize_team_quantity,
    _resolve_next_seat_capacity,
    _subscription_term_days,
)


def assert_team_subscription_completion_allowed(payment: BillingPaymentRecord, context: ApiRequestContext) -> None:
    owner_user_id = str(payment.metadata.get("ownerUserId") or "")
    if owner_user_id != context.user_id:
        raise HTTPException(status_code=403, detail="Team payment does not belong to the current user.")


def provision_team_subscription_payment(
    cursor: object,
    payment: BillingPaymentRecord,
    context: ApiRequestContext,
) -> BillingPaymentRecord:
    assert_team_subscription_completion_allowed(payment, context)
    metadata = dict(payment.metadata or {})
    workspace_id = str(metadata.get("workspaceId") or f"workspace_{uuid4()}")
    team_name = _normalize_team_name(str(metadata.get("teamName") or "Team workspace"))
    plan_key = _normalize_team_plan_key(str(metadata.get("planKey") or ""))
    quantity = _normalize_team_quantity(int(metadata.get("quantity") or 1))
    requested_account_id = f"credit_workspace_{workspace_id}"

    _upsert_team_workspace(cursor, workspace_id, team_name, context)
    _upsert_team_owner_membership(cursor, workspace_id, context)
    _upsert_team_owner_seat_assignment(cursor, workspace_id, context, plan_key)
    account_id = _ensure_team_wallet(cursor, workspace_id, requested_account_id)

    provisioned_metadata = {
        **metadata,
        "planFamily": "team",
        "planKey": plan_key,
        "quantity": quantity,
        "workspaceId": workspace_id,
        "workspaceName": team_name,
    }
    cursor.execute(
        """
        UPDATE tangent_payments
        SET account_id = %s,
            metadata = %s::jsonb
        WHERE id = %s
        RETURNING id, account_id, provider, provider_payment_id, amount_cents, currency,
                  status, created_at, checkout_session_id, kind, metadata
        """,
        (account_id, json.dumps(provisioned_metadata), payment.id),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Payment not found.")
    return _payment_from_row(row)


def upsert_team_workspace_subscription(cursor: object, payment: BillingPaymentRecord) -> None:
    workspace_id = str(payment.metadata.get("workspaceId") or "")
    plan_key = str(payment.metadata.get("planKey") or "")
    if not workspace_id or plan_key not in TEAM_PLAN_KEYS:
        return
    account_id = str(payment.account_id or f"credit_workspace_{workspace_id}")
    seat_capacity = int(payment.metadata.get("quantity") or 1)
    cursor.execute(
        """
        SELECT id, seat_capacity, plan_key, current_period_start, current_period_end
        FROM tangent_subscriptions
        WHERE account_id = %s
          AND status IN ('active', 'trialing')
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (account_id,),
    )
    row = cursor.fetchone()
    billing_interval = _normalize_billing_interval(str(payment.metadata.get("billingInterval") or "monthly"))
    next_period_start = datetime.now(timezone.utc)
    next_period_end = next_period_start + timedelta(days=_subscription_term_days(billing_interval))
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
            VALUES (%s, %s, 'workspace', %s, %s, 'team', %s, NULL, %s, %s, 'active', %s, %s, %s)
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
                next_period_start,
                next_period_end,
            ),
        )
        return
    current_capacity = int(row[1] or 0)
    current_plan_key = str(row[2] or plan_key)
    next_plan_key = current_plan_key if payment.kind == "seat_purchase" else plan_key
    if payment.kind == "seat_purchase" and current_plan_key != plan_key:
        raise HTTPException(status_code=400, detail="Seat purchase plan must match the active Team subscription.")
    next_capacity = _resolve_next_seat_capacity(
        current_capacity=current_capacity,
        payment_kind=payment.kind,
        quantity=seat_capacity,
    )
    current_period_start = row[3] if payment.kind == "seat_purchase" else next_period_start
    current_period_end = row[4] if payment.kind == "seat_purchase" else next_period_end
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
            seat_capacity = %s,
            current_period_start = %s,
            current_period_end = %s,
            updated_at = NOW()
        WHERE id = %s
        """,
        (
            next_plan_key,
            workspace_id,
            workspace_id,
            payment.provider,
            payment.id,
            next_capacity,
            current_period_start,
            current_period_end,
            row[0],
        ),
    )


def _upsert_team_workspace(cursor: object, workspace_id: str, team_name: str, context: ApiRequestContext) -> None:
    cursor.execute(
        """
        INSERT INTO tangent_workspaces (
            id,
            name,
            owner_id,
            kind,
            slug,
            status,
            billing_owner_user_id
        )
        VALUES (%s, %s, %s, 'team_workspace', NULL, 'active', %s)
        ON CONFLICT (id)
        DO UPDATE SET
            name = EXCLUDED.name,
            kind = 'team_workspace',
            status = 'active',
            billing_owner_user_id = EXCLUDED.billing_owner_user_id
        """,
        (workspace_id, team_name, context.user_id, context.user_id),
    )


def _upsert_team_owner_membership(cursor: object, workspace_id: str, context: ApiRequestContext) -> None:
    cursor.execute(
        """
        INSERT INTO tangent_workspace_members (
            workspace_id,
            user_id,
            role,
            display_name,
            invited_by
        )
        VALUES (%s, %s, 'owner', %s, NULL)
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET
            role = 'owner',
            display_name = COALESCE(EXCLUDED.display_name, tangent_workspace_members.display_name)
        """,
        (workspace_id, context.user_id, context.user_display_name),
    )


def _upsert_team_owner_seat_assignment(cursor: object, workspace_id: str, context: ApiRequestContext, plan_key: str) -> None:
    included_credits = included_credits_for_plan(plan_key)
    cursor.execute(
        """
        INSERT INTO tangent_workspace_seat_assignments (
            id,
            workspace_id,
            user_id,
            plan_key,
            status,
            included_credits,
            current_period_start,
            current_period_end,
            assigned_by
        )
        VALUES (%s, %s, %s, %s, 'active', %s, NULL, NULL, %s)
        ON CONFLICT (workspace_id, user_id, plan_key)
        DO UPDATE SET
            status = 'active',
            included_credits = EXCLUDED.included_credits,
            assigned_by = EXCLUDED.assigned_by,
            updated_at = NOW()
        """,
        (
            f"seat_{uuid4()}",
            workspace_id,
            context.user_id,
            plan_key,
            included_credits,
            context.user_id,
        ),
    )


def _ensure_team_wallet(cursor: object, workspace_id: str, account_id: str) -> str:
    cursor.execute(
        """
        INSERT INTO tangent_credit_accounts (
            id,
            owner_type,
            owner_id,
            account_kind,
            status
        )
        VALUES (%s, 'workspace', %s, 'team_wallet', 'active')
        ON CONFLICT (owner_type, owner_id)
        DO UPDATE SET
            status = 'active',
            account_kind = 'team_wallet',
            updated_at = NOW()
        RETURNING id
        """,
        (account_id, workspace_id),
    )
    row = cursor.fetchone()
    return str(row[0]) if row else account_id


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
        provider=str(row[2] or "manual_test"),
        providerPaymentId=row[3],
        status=str(row[6] or "pending"),
    )


def _to_iso(value: Optional[object]) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
