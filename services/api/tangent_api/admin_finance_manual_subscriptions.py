from datetime import date, datetime, time, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.admin_finance_manual_ops import assert_user_exists, assert_workspace_exists, grant_included_credits as grant_plan_credits, insert_audit, load_credit_balance, upsert_subscription
from tangent_api.admin_finance_manual_schemas import AdminManualFinanceMutationResponse
from tangent_api.admin_finance_manual_utils import COLLABORATE_PLAN_KEYS, TEAM_PLAN_KEYS, manual_response, normalize_id, normalize_plan_key, normalize_subscription_status, resolve_collaborate_term_months, resolve_subscription_window, resolve_team_term_months
from tangent_api.billing_credit_accounts import ensure_credit_account
from tangent_api.plan_catalog import included_credits_for_plan
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def manual_set_collaborate_plan(
    *,
    actor_user_id: str,
    duration_count: int,
    duration_unit_days: int,
    effect_mode: str,
    grant_included_credits: bool,
    note: Optional[str],
    period_end: Optional[str],
    plan_key: str,
    status: str,
    target_user_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    normalized_plan = normalize_plan_key(plan_key, COLLABORATE_PLAN_KEYS, "Collaborate")
    normalized_status = normalize_subscription_status(status)
    duration_months = resolve_collaborate_term_months(duration_count, duration_unit_days)
    resolved_period_end = parse_period_end(period_end)
    resolved_period_start, resolved_period_end = resolve_subscription_window(
        duration_count=duration_count,
        duration_unit_days=duration_unit_days,
        effect_mode=effect_mode,
        period_end=resolved_period_end,
    )
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
                period_end=resolved_period_end,
                period_start=resolved_period_start,
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
                credits=float(included_credits_for_plan(normalized_plan)) * duration_months,
                enabled=grant_included_credits,
                metadata={
                    "note": note,
                    "durationCount": duration_count,
                    "durationUnitDays": duration_unit_days,
                    "effectMode": effect_mode,
                    "operationId": operation_id,
                    "periodEnd": resolved_period_end.isoformat() if resolved_period_end else None,
                    "periodStart": resolved_period_start.isoformat(),
                    "planKey": normalized_plan,
                    "targetUserId": target_user_id,
                },
                source_id=subscription_id,
                workspace_id=None,
            )
            balance = load_credit_balance(cursor, account_id)
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.collaborate_plan",
                actor_user_id=actor_user_id,
                metadata={
                    "accountId": account_id,
                    "durationCount": duration_count,
                    "durationUnitDays": duration_unit_days,
                    "effectMode": effect_mode,
                    "grantIncludedCredits": grant_included_credits,
                    "note": note,
                    "periodEnd": resolved_period_end.isoformat() if resolved_period_end else None,
                    "periodStart": resolved_period_start.isoformat(),
                    "planKey": normalized_plan,
                    "status": normalized_status,
                },
                target_user_id=target_user_id,
                workspace_id=None,
            )
        connection.commit()
    return manual_response(account_id, audit_id, balance, ledger_entry_id, "Collaborate plan updated.", subscription_id)


def manual_set_team_plan(
    *,
    actor_user_id: str,
    duration_count: int,
    duration_unit_days: int,
    effect_mode: str,
    grant_included_credits: bool,
    note: Optional[str],
    period_end: Optional[str],
    plan_key: str,
    seat_capacity: int,
    status: str,
    workspace_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    normalized_plan = normalize_plan_key(plan_key, TEAM_PLAN_KEYS, "Team")
    normalized_status = normalize_subscription_status(status)
    duration_months = resolve_team_term_months(duration_count, duration_unit_days)
    resolved_period_end = parse_period_end(period_end)
    resolved_period_start, resolved_period_end = resolve_subscription_window(
        duration_count=duration_count,
        duration_unit_days=duration_unit_days,
        effect_mode=effect_mode,
        period_end=resolved_period_end,
    )
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
                period_end=resolved_period_end,
                period_start=resolved_period_start,
                plan_family="team",
                plan_key=normalized_plan,
                seat_capacity=seat_capacity,
                status=normalized_status,
                workspace_id=workspace_id,
            )
            credits = float(included_credits_for_plan(normalized_plan)) * seat_capacity * duration_months
            ledger_entry_id = grant_plan_credits(
                cursor,
                account_id=account_id,
                actor_user_id=actor_user_id,
                credits=credits,
                enabled=grant_included_credits,
                metadata={
                    "note": note,
                    "durationCount": duration_count,
                    "durationUnitDays": duration_unit_days,
                    "effectMode": effect_mode,
                    "operationId": operation_id,
                    "periodEnd": resolved_period_end.isoformat() if resolved_period_end else None,
                    "periodStart": resolved_period_start.isoformat(),
                    "planKey": normalized_plan,
                    "seatCapacity": seat_capacity,
                },
                source_id=subscription_id,
                workspace_id=workspace_id,
            )
            balance = load_credit_balance(cursor, account_id)
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.team_plan",
                actor_user_id=actor_user_id,
                metadata={
                    "accountId": account_id,
                    "durationCount": duration_count,
                    "durationUnitDays": duration_unit_days,
                    "effectMode": effect_mode,
                    "grantIncludedCredits": grant_included_credits,
                    "note": note,
                    "periodEnd": resolved_period_end.isoformat() if resolved_period_end else None,
                    "periodStart": resolved_period_start.isoformat(),
                    "planKey": normalized_plan,
                    "seatCapacity": seat_capacity,
                    "status": normalized_status,
                },
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


def parse_period_end(value: Optional[str]) -> Optional[datetime]:
    if value is None or not value.strip():
        return None
    normalized = value.strip()
    try:
        if len(normalized) == 10:
            parsed_date = date.fromisoformat(normalized)
            return datetime.combine(parsed_date, time(23, 59, 59), tzinfo=timezone.utc)
        parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Invalid period end date.") from error
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
