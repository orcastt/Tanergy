from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.admin_finance_manual_ops import (
    assert_user_exists,
    grant_included_credits,
    insert_audit,
    insert_ledger_entry,
    load_credit_balance,
    upsert_subscription,
)
from tangent_api.admin_finance_manual_schemas import AdminManualFinanceMutationResponse
from tangent_api.admin_finance_manual_subscriptions import parse_period_end
from tangent_api.admin_finance_manual_utils import TEAM_PLAN_KEYS, normalize_id, normalize_plan_key, normalize_subscription_status, positive_credits, resolve_subscription_window, resolve_team_term_months
from tangent_api.admin_finance_manual_workspace_utils import insert_owner_membership, insert_workspace, normalize_workspace_name
from tangent_api.billing_credit_accounts import ensure_credit_account
from tangent_api.plan_catalog import included_credits_for_plan
from tangent_api.storage.postgres_board_deletion import soft_delete_workspace_boards
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def manual_create_group_workspace(
    *,
    actor_user_id: str,
    note: Optional[str],
    target_user_id: str,
    workspace_name: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    target_user_id = normalize_id(target_user_id, "user id")
    normalized_name = normalize_workspace_name(workspace_name)
    workspace_id = f"workspace_{uuid4()}"
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_user_exists(cursor, target_user_id)
            insert_workspace(
                cursor,
                workspace_id=workspace_id,
                owner_id=target_user_id,
                kind="group_workspace",
                workspace_name=normalized_name,
            )
            insert_owner_membership(
                cursor,
                workspace_id=workspace_id,
                user_id=target_user_id,
                display_name=normalized_name,
            )
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.group_workspace_create",
                actor_user_id=actor_user_id,
                metadata={"note": note, "targetUserId": target_user_id, "workspaceId": workspace_id, "workspaceName": normalized_name},
                target_user_id=target_user_id,
                workspace_id=workspace_id,
            )
        connection.commit()
    return AdminManualFinanceMutationResponse(
        auditId=audit_id,
        message="Group workspace created.",
        ok=True,
        workspaceId=workspace_id,
    )


def manual_create_team_workspace(
    *,
    actor_user_id: str,
    duration_count: int,
    duration_unit_days: int,
    effect_mode: str,
    extra_credits: float,
    grant_plan_credits: bool,
    note: Optional[str],
    period_end: Optional[str],
    plan_key: str,
    seat_capacity: int,
    status: str,
    target_user_id: str,
    workspace_name: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    target_user_id = normalize_id(target_user_id, "user id")
    normalized_name = normalize_workspace_name(workspace_name)
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
    workspace_id = f"workspace_{uuid4()}"
    operation_id = f"admin_manual_{uuid4()}"
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_user_exists(cursor, target_user_id)
            insert_workspace(
                cursor,
                workspace_id=workspace_id,
                owner_id=target_user_id,
                kind="team_workspace",
                workspace_name=normalized_name,
            )
            insert_owner_membership(
                cursor,
                workspace_id=workspace_id,
                user_id=target_user_id,
                display_name=normalized_name,
            )
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
            included_credits = float(included_credits_for_plan(normalized_plan)) * seat_capacity * duration_months
            plan_ledger_entry_id = grant_included_credits(
                cursor,
                account_id=account_id,
                actor_user_id=actor_user_id,
                credits=included_credits,
                enabled=grant_plan_credits,
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
                    "workspaceId": workspace_id,
                },
                source_id=subscription_id,
                workspace_id=workspace_id,
            )
            extra_ledger_entry_id = None
            if extra_credits > 0:
                extra_ledger_entry_id = insert_ledger_entry(
                    cursor,
                    account_id=account_id,
                    actor_user_id=actor_user_id,
                    credits_delta=positive_credits(extra_credits),
                    metadata={"note": note, "operationId": operation_id, "workspaceId": workspace_id},
                    reason="admin_adjustment",
                    source_id=workspace_id,
                    source_type="workspace",
                    workspace_id=workspace_id,
                )
            balance = load_credit_balance(cursor, account_id)
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.team_workspace_create",
                actor_user_id=actor_user_id,
                metadata={
                    "accountId": account_id,
                    "durationCount": duration_count,
                    "durationUnitDays": duration_unit_days,
                    "effectMode": effect_mode,
                    "extraCredits": extra_credits,
                    "grantIncludedCredits": grant_plan_credits,
                    "note": note,
                    "periodEnd": resolved_period_end.isoformat() if resolved_period_end else None,
                    "periodStart": resolved_period_start.isoformat(),
                    "planKey": normalized_plan,
                    "seatCapacity": seat_capacity,
                    "status": normalized_status,
                    "targetUserId": target_user_id,
                    "workspaceId": workspace_id,
                    "workspaceName": normalized_name,
                },
                target_user_id=target_user_id,
                workspace_id=workspace_id,
            )
        connection.commit()
    return AdminManualFinanceMutationResponse(
        accountId=account_id,
        auditId=audit_id,
        balanceCredits=balance,
        ledgerEntryId=extra_ledger_entry_id or plan_ledger_entry_id,
        message="Team workspace created.",
        ok=True,
        subscriptionId=subscription_id,
        workspaceId=workspace_id,
    )


def manual_delete_workspace(
    *,
    actor_user_id: str,
    note: Optional[str],
    workspace_id: str,
) -> AdminManualFinanceMutationResponse:
    require_database_url()
    normalized_workspace_id = normalize_id(workspace_id, "workspace id")
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT kind, owner_id, status
                FROM tangent_workspaces
                WHERE id = %s
                LIMIT 1
                """,
                (normalized_workspace_id,),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Workspace not found.")
            workspace_kind = str(row[0] or "")
            if workspace_kind not in {"group_workspace", "team_workspace"}:
                raise HTTPException(status_code=400, detail="Only Group and Team workspaces can be deleted here.")
            cursor.execute(
                """
                UPDATE tangent_workspaces
                SET status = 'deleted'
                WHERE id = %s
                """,
                (normalized_workspace_id,),
            )
            soft_delete_workspace_boards(cursor, [normalized_workspace_id])
            cursor.execute(
                """
                UPDATE tangent_subscriptions
                SET status = 'canceled',
                    current_period_end = NOW(),
                    updated_at = NOW()
                WHERE (workspace_id = %s OR (owner_type = 'workspace' AND owner_id = %s))
                  AND status IN ('active', 'trialing', 'paused')
                """,
                (normalized_workspace_id, normalized_workspace_id),
            )
            audit_id = insert_audit(
                cursor,
                action="admin.finance.manual.workspace_delete",
                actor_user_id=actor_user_id,
                metadata={"note": note, "workspaceId": normalized_workspace_id, "workspaceKind": workspace_kind},
                target_user_id=str(row[1]) if row[1] else None,
                workspace_id=normalized_workspace_id,
            )
        connection.commit()
    return AdminManualFinanceMutationResponse(
        auditId=audit_id,
        message="Workspace deleted.",
        ok=True,
        workspaceId=normalized_workspace_id,
    )
