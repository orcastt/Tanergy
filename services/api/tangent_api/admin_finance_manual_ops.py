import json
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.admin_finance_manual_utils import clean_metadata, normalize_id


def assert_user_exists(cursor: object, user_id: str) -> None:
    cursor.execute("SELECT 1 FROM tangent_users WHERE id = %s", (normalize_id(user_id, "user id"),))
    if cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="User not found.")


def assert_workspace_exists(cursor: object, workspace_id: str) -> None:
    cursor.execute("SELECT 1 FROM tangent_workspaces WHERE id = %s", (normalize_id(workspace_id, "workspace id"),))
    if cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Workspace not found.")


def grant_included_credits(
    cursor: object,
    *,
    account_id: str,
    actor_user_id: str,
    credits: float,
    enabled: bool,
    metadata: dict[str, object],
    source_id: str,
    workspace_id: Optional[str],
) -> Optional[str]:
    if not enabled or credits <= 0:
        return None
    return insert_ledger_entry(
        cursor,
        account_id=account_id,
        actor_user_id=actor_user_id,
        credits_delta=credits,
        metadata=metadata,
        reason="subscription_grant",
        source_id=source_id,
        source_type="subscription",
        workspace_id=workspace_id,
    )


def insert_manual_payment(
    cursor: object,
    *,
    account_id: str,
    amount_cents: int,
    currency: str,
    kind: str,
    operation_id: str,
    metadata: dict[str, object],
) -> str:
    payment_id = f"payment_{uuid4()}"
    cursor.execute(
        """
        INSERT INTO tangent_payments (
            id, account_id, provider, provider_payment_id, amount_cents, currency,
            status, checkout_session_id, kind, metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s, 'succeeded', %s, %s, %s::jsonb)
        """,
        (
            payment_id,
            account_id,
            "admin_manual",
            operation_id,
            amount_cents,
            currency.strip().lower() or "usd",
            f"manual_{uuid4()}",
            kind,
            json.dumps({**metadata, "operationId": operation_id, "provider": "admin_manual"}),
        ),
    )
    return payment_id


def insert_ledger_entry(
    cursor: object,
    *,
    account_id: str,
    actor_user_id: str,
    credits_delta: float,
    metadata: dict[str, object],
    reason: str,
    source_id: str,
    source_type: str,
    workspace_id: Optional[str],
) -> str:
    entry_id = f"credit_ledger_{uuid4()}"
    cursor.execute(
        """
        INSERT INTO tangent_credit_ledger (
            id, account_id, workspace_id, actor_user_id, source_type, source_id,
            credits_delta, reason, metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
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
            json.dumps(clean_metadata(metadata)),
        ),
    )
    return entry_id


def upsert_subscription(
    cursor: object,
    *,
    account_id: str,
    operation_id: str,
    owner_id: str,
    owner_type: str,
    period_start: Optional[datetime],
    plan_family: str,
    plan_key: str,
    period_end: Optional[datetime],
    seat_capacity: int,
    status: str,
    workspace_id: Optional[str],
) -> str:
    cursor.execute(
        """
        SELECT id
        FROM tangent_subscriptions
        WHERE account_id = %s
          AND plan_family = %s
          AND status IN ('active', 'trialing')
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (account_id, plan_family),
    )
    row = cursor.fetchone()
    effective_period_start = period_start or datetime.now(timezone.utc)
    effective_period_end = period_end or (effective_period_start + timedelta(days=30))
    if row is None:
        return insert_subscription(
            cursor,
            account_id=account_id,
            operation_id=operation_id,
            owner_id=owner_id,
            owner_type=owner_type,
            period_end=effective_period_end,
            period_start=effective_period_start,
            plan_family=plan_family,
            plan_key=plan_key,
            seat_capacity=seat_capacity,
            status=status,
            workspace_id=workspace_id,
        )
    subscription_id = str(row[0])
    cursor.execute(
        """
        UPDATE tangent_subscriptions
        SET plan_key = %s,
            plan_family = %s,
            owner_type = %s,
            owner_id = %s,
            workspace_id = %s,
            provider = 'admin_manual',
            provider_subscription_id = %s,
            status = %s,
            seat_capacity = %s,
            current_period_start = %s,
            current_period_end = %s,
            updated_at = NOW()
        WHERE id = %s
        """,
        (
            plan_key,
            plan_family,
            owner_type,
            owner_id,
            workspace_id,
            operation_id,
            status,
            seat_capacity,
            effective_period_start,
            effective_period_end,
            subscription_id,
        ),
    )
    return subscription_id


def insert_subscription(
    cursor: object,
    *,
    account_id: str,
    operation_id: str,
    owner_id: str,
    owner_type: str,
    period_end: datetime,
    period_start: datetime,
    plan_family: str,
    plan_key: str,
    seat_capacity: int,
    status: str,
    workspace_id: Optional[str],
) -> str:
    subscription_id = f"subscription_{uuid4()}"
    cursor.execute(
        """
        INSERT INTO tangent_subscriptions (
            id, account_id, owner_type, owner_id, workspace_id, plan_family,
            provider, provider_customer_id, provider_subscription_id, plan_key,
            status, seat_capacity, current_period_start, current_period_end
        )
        VALUES (%s, %s, %s, %s, %s, %s, 'admin_manual', NULL, %s, %s, %s, %s, %s, %s)
        """,
        (
            subscription_id,
            account_id,
            owner_type,
            owner_id,
            workspace_id,
            plan_family,
            operation_id,
            plan_key,
            status,
            seat_capacity,
            period_start,
            period_end,
        ),
    )
    return subscription_id


def insert_audit(
    cursor: object,
    *,
    action: str,
    actor_user_id: str,
    metadata: dict[str, object],
    target_user_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> str:
    audit_id = f"admin_audit_{uuid4()}"
    cursor.execute(
        """
        INSERT INTO tangent_admin_audit_logs (
            id, actor_user_id, target_user_id, workspace_id, action, metadata
        ) VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        """,
        (audit_id, actor_user_id, target_user_id, workspace_id, action, json.dumps(clean_metadata(metadata))),
    )
    return audit_id


def load_credit_balance(cursor: object, account_id: str) -> float:
    cursor.execute("SELECT COALESCE(SUM(credits_delta), 0) FROM tangent_credit_ledger WHERE account_id = %s", (account_id,))
    row = cursor.fetchone()
    return float(row[0] or 0) if row else 0.0
