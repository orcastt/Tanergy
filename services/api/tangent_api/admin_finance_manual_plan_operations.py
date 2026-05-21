from __future__ import annotations

from typing import Optional
from uuid import uuid4

from tangent_api.admin_finance_manual_ops import (
    assert_user_exists,
    insert_audit,
    insert_ledger_entry,
    load_credit_balance,
)
from tangent_api.admin_finance_manual_plan_context import (
    PlanContext,
    assert_team_workspace,
    iso_datetime,
    load_plan_context,
    write_plan_subscription,
)
from tangent_api.admin_finance_manual_plan_lifecycle import operate_plan_lifecycle_action
from tangent_api.admin_finance_manual_schemas import AdminManualFinanceMutationResponse
from tangent_api.admin_finance_manual_team_seats import sync_team_seat_assignments
from tangent_api.admin_finance_manual_utils import (
    COLLABORATE_PLAN_KEYS,
    TEAM_PLAN_KEYS,
    resolve_monthly_term_months,
    normalize_id,
    normalize_plan_key,
    normalize_subscription_status,
    resolve_subscription_window,
)
from tangent_api.billing_credit_accounts import ensure_credit_account
from tangent_api.plan_catalog import included_credits_for_plan
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def manual_operate_group_plan(
    *,
    action: str,
    actor_user_id: str,
    duration_count: int,
    duration_unit_days: int,
    effect_mode: str,
    grant_included_credits: bool,
    note: str,
    plan_key: Optional[str],
    status: str,
    subscription_id: Optional[str],
    target_user_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    normalized_user_id = normalize_id(target_user_id, "user id")
    normalized_action = action.strip().lower()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_user_exists(cursor, normalized_user_id)
            context = load_plan_context(
                cursor,
                account_id=ensure_credit_account(cursor, "user", normalized_user_id),
                owner_id=normalized_user_id,
                owner_type="user",
                plan_family="collaborate",
                subscription_id=subscription_id,
                workspace_id=None,
            )
            return _operate_plan(
                cursor,
                action=normalized_action,
                actor_user_id=actor_user_id,
                allowed_plan_keys=COLLABORATE_PLAN_KEYS,
                context=context,
                duration_count=duration_count,
                duration_unit_days=duration_unit_days,
                effect_mode=effect_mode,
                grant_included_credits=grant_included_credits,
                label="Group",
                note=note,
                plan_key=plan_key,
                requested_seat_capacity=1,
                status=status,
                target_user_id=normalized_user_id,
            )


def manual_operate_team_plan(
    *,
    action: str,
    actor_user_id: str,
    duration_count: int,
    duration_unit_days: int,
    effect_mode: str,
    grant_included_credits: bool,
    note: str,
    plan_key: Optional[str],
    seat_capacity: Optional[int],
    status: str,
    subscription_id: Optional[str],
    workspace_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    normalized_workspace_id = normalize_id(workspace_id, "workspace id")
    normalized_action = action.strip().lower()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_team_workspace(cursor, normalized_workspace_id)
            context = load_plan_context(
                cursor,
                account_id=ensure_credit_account(cursor, "workspace", normalized_workspace_id),
                owner_id=normalized_workspace_id,
                owner_type="workspace",
                plan_family="team",
                subscription_id=subscription_id,
                workspace_id=normalized_workspace_id,
            )
            return _operate_plan(
                cursor,
                action=normalized_action,
                actor_user_id=actor_user_id,
                allowed_plan_keys=TEAM_PLAN_KEYS,
                context=context,
                duration_count=duration_count,
                duration_unit_days=duration_unit_days,
                effect_mode=effect_mode,
                grant_included_credits=grant_included_credits,
                label="Team",
                note=note,
                plan_key=plan_key,
                requested_seat_capacity=seat_capacity,
                status=status,
                target_user_id=None,
            )


def _operate_plan(
    cursor: object,
    *,
    action: str,
    actor_user_id: str,
    allowed_plan_keys: set[str],
    context: PlanContext,
    duration_count: int,
    duration_unit_days: int,
    effect_mode: str,
    grant_included_credits: bool,
    label: str,
    note: str,
    plan_key: Optional[str],
    requested_seat_capacity: Optional[int],
    status: str,
    target_user_id: Optional[str],
) -> AdminManualFinanceMutationResponse:
    if action in {"freeze", "unfreeze", "delete"}:
        return operate_plan_lifecycle_action(
            cursor,
            action=action,
            actor_user_id=actor_user_id,
            context=context,
            label=label,
            note=note,
            target_user_id=target_user_id,
        )

    normalized_plan_key = normalize_plan_key(plan_key or context.plan_key or "", allowed_plan_keys, label)
    normalized_status = normalize_subscription_status(status)
    seat_capacity = max(1, requested_seat_capacity or context.seat_capacity or 1)
    period_start, period_end = resolve_subscription_window(
        duration_count=duration_count,
        duration_unit_days=duration_unit_days,
        effect_mode=effect_mode,
        period_end=None,
    )
    granted_credits = _calculate_granted_credits(
        action=action,
        current_plan_key=context.plan_key,
        current_seat_capacity=context.seat_capacity,
        duration_count=duration_count,
        duration_unit_days=duration_unit_days,
        plan_family=context.plan_family,
        target_plan_key=normalized_plan_key,
        target_seat_capacity=seat_capacity,
    )
    subscription_id = write_plan_subscription(
        cursor,
        context=context,
        operation_id=f"admin_manual_{uuid4()}",
        plan_key=normalized_plan_key,
        seat_capacity=seat_capacity,
        status=normalized_status,
        period_start=period_start,
        period_end=period_end,
    )
    if context.plan_family == "team" and context.workspace_id:
        sync_team_seat_assignments(
            cursor,
            actor_user_id=actor_user_id,
            period_end=period_end,
            period_start=period_start,
            plan_key=normalized_plan_key,
            seat_capacity=seat_capacity,
            workspace_id=context.workspace_id,
        )

    ledger_entry_id = None
    if grant_included_credits and granted_credits > 0:
        ledger_entry_id = insert_ledger_entry(
            cursor,
            account_id=context.account_id,
            actor_user_id=actor_user_id,
            credits_delta=granted_credits,
            metadata={
                "action": action,
                "effectMode": effect_mode,
                "note": note,
                "periodEnd": period_end.isoformat(),
                "periodStart": period_start.isoformat(),
                "planKey": normalized_plan_key,
                "previousPlanKey": context.plan_key,
                "seatCapacity": seat_capacity,
                "subscriptionId": subscription_id,
            },
            reason="subscription_grant",
            source_id=subscription_id,
            source_type="subscription",
            workspace_id=context.workspace_id,
        )

    balance = load_credit_balance(cursor, context.account_id)
    audit_id = insert_audit(
        cursor,
        action=f"admin.finance.manual.{context.plan_family}_plan_operation",
        actor_user_id=actor_user_id,
        metadata={
            "action": action,
            "accountId": context.account_id,
            "effectMode": effect_mode,
            "grantIncludedCredits": grant_included_credits,
            "grantedCredits": granted_credits if grant_included_credits else 0,
            "note": note,
            "periodEnd": period_end.isoformat(),
            "periodStart": period_start.isoformat(),
            "planKey": normalized_plan_key,
            "previousPlanKey": context.plan_key,
            "seatCapacity": seat_capacity,
            "status": normalized_status,
            "subscriptionId": subscription_id,
        },
        target_user_id=target_user_id,
        workspace_id=context.workspace_id,
    )
    return AdminManualFinanceMutationResponse(
        accountId=context.account_id,
        action=action,
        auditId=audit_id,
        balanceCredits=balance,
        effectiveAt=period_start.isoformat(),
        grantedCredits=granted_credits if grant_included_credits else 0,
        ledgerEntryId=ledger_entry_id,
        message=_action_message(label, action),
        ok=True,
        periodEnd=period_end.isoformat(),
        periodStart=period_start.isoformat(),
        planKey=normalized_plan_key,
        previousPlanKey=context.plan_key,
        seatCapacity=seat_capacity,
        subscriptionId=subscription_id,
        subscriptionStatus=normalized_status,
        userId=target_user_id,
        workspaceId=context.workspace_id,
    )


def _calculate_granted_credits(
    *,
    action: str,
    current_plan_key: Optional[str],
    current_seat_capacity: int,
    duration_count: int,
    duration_unit_days: int,
    plan_family: str,
    target_plan_key: str,
    target_seat_capacity: int,
) -> float:
    duration_multiplier = resolve_monthly_term_months(
        duration_count,
        duration_unit_days,
        "Team" if plan_family == "team" else "Collaborate",
    ) if plan_family in {"team", "collaborate"} else 1
    target_total = float(included_credits_for_plan(target_plan_key)) * target_seat_capacity * duration_multiplier
    if action != "upgrade" or not current_plan_key:
        return target_total
    current_total = float(included_credits_for_plan(current_plan_key)) * max(1, current_seat_capacity) * duration_multiplier
    return max(0.0, target_total - current_total)


def _action_message(label: str, action: str) -> str:
    return f"{label} plan {_past_tense(action)}."


def _past_tense(action: str) -> str:
    return {
        "assign": "assigned",
        "renew": "renewed",
        "upgrade": "upgraded",
    }.get(action, action)
