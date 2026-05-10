from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.admin_finance_manual_utils import normalize_id
from tangent_api.storage.postgres_schema import has_postgres_column

CURRENT_SUBSCRIPTION_STATUSES = ("active", "trialing", "paused")


@dataclass(frozen=True)
class PlanContext:
    account_id: str
    owner_id: str
    owner_type: str
    plan_family: str
    subscription_id: Optional[str]
    plan_key: Optional[str]
    status: Optional[str]
    seat_capacity: int
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    workspace_id: Optional[str]


def assert_team_workspace(cursor: object, workspace_id: str) -> None:
    cursor.execute("SELECT kind FROM tangent_workspaces WHERE id = %s LIMIT 1", (workspace_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    if str(row[0] or "") != "team_workspace":
        raise HTTPException(status_code=400, detail="Team plan operations require a Team workspace.")


def load_plan_context(
    cursor: object,
    *,
    account_id: str,
    owner_id: str,
    owner_type: str,
    plan_family: str,
    subscription_id: Optional[str],
    workspace_id: Optional[str],
) -> PlanContext:
    if subscription_id:
        cursor.execute(
            """
            SELECT id, plan_key, status, seat_capacity, current_period_start, current_period_end
            FROM tangent_subscriptions
            WHERE id = %s AND account_id = %s AND plan_family = %s
            LIMIT 1
            """,
            (normalize_id(subscription_id, "subscription id"), account_id, plan_family),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Subscription not found.")
    else:
        cursor.execute(
            """
            SELECT id, plan_key, status, seat_capacity, current_period_start, current_period_end
            FROM tangent_subscriptions
            WHERE account_id = %s
              AND plan_family = %s
              AND status IN ('active', 'trialing', 'paused')
            ORDER BY
                CASE status
                    WHEN 'active' THEN 0
                    WHEN 'trialing' THEN 1
                    WHEN 'paused' THEN 2
                    ELSE 3
                END,
                updated_at DESC NULLS LAST,
                created_at DESC NULLS LAST
            LIMIT 1
            """,
            (account_id, plan_family),
        )
        row = cursor.fetchone()

    return PlanContext(
        account_id=account_id,
        owner_id=owner_id,
        owner_type=owner_type,
        plan_family=plan_family,
        subscription_id=str(row[0]) if row else None,
        plan_key=str(row[1]) if row and row[1] is not None else None,
        status=str(row[2]) if row and row[2] is not None else None,
        seat_capacity=int(row[3] or 1) if row else 1,
        current_period_start=row[4] if row else None,
        current_period_end=row[5] if row else None,
        workspace_id=workspace_id,
    )


def write_plan_subscription(
    cursor: object,
    *,
    context: PlanContext,
    operation_id: str,
    plan_key: str,
    seat_capacity: int,
    status: str,
    period_start: datetime,
    period_end: datetime,
) -> str:
    if context.subscription_id and (context.status or "") in CURRENT_SUBSCRIPTION_STATUSES:
        cursor.execute(
            f"""
            UPDATE tangent_subscriptions
            SET plan_key = %s,
                provider = 'admin_manual',
                provider_subscription_id = %s,
                status = %s,
                seat_capacity = %s,
                current_period_start = %s,
                current_period_end = %s,
                {_clear_pause_metadata_sql()}
                updated_at = NOW()
            WHERE id = %s
            """,
            (plan_key, operation_id, status, seat_capacity, period_start, period_end, context.subscription_id),
        )
        return context.subscription_id

    new_subscription_id = f"subscription_{uuid4()}"
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
            new_subscription_id,
            context.account_id,
            context.owner_type,
            context.owner_id,
            context.workspace_id,
            context.plan_family,
            operation_id,
            plan_key,
            status,
            seat_capacity,
            period_start,
            period_end,
        ),
    )
    return new_subscription_id


def iso_datetime(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    normalized = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
    return normalized.astimezone(timezone.utc).isoformat()


def _clear_pause_metadata_sql() -> str:
    fragments = []
    if has_postgres_column("tangent_subscriptions", "paused_at"):
        fragments.append("paused_at = NULL")
    if has_postgres_column("tangent_subscriptions", "paused_by"):
        fragments.append("paused_by = NULL")
    if has_postgres_column("tangent_subscriptions", "pause_reason"):
        fragments.append("pause_reason = NULL")
    if not fragments:
        return ""
    return "".join(f"{fragment},\n                " for fragment in fragments)
