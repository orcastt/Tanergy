from typing import Optional

from fastapi import HTTPException

from tangent_api.admin_finance_manual_ops import insert_audit, insert_ledger_entry, load_credit_balance
from tangent_api.admin_finance_manual_plan_context import PlanContext, iso_datetime, load_plan_context
from tangent_api.admin_finance_manual_schemas import AdminManualFinanceMutationResponse
from tangent_api.admin_operator_subscription_writes import (
    freeze_admin_operator_subscription,
    unfreeze_admin_operator_subscription,
)
from tangent_api.storage.postgres_board_deletion import soft_delete_workspace_boards


def operate_plan_lifecycle_action(
    cursor: object,
    *,
    action: str,
    actor_user_id: str,
    context: PlanContext,
    label: str,
    note: str,
    target_user_id: Optional[str],
) -> AdminManualFinanceMutationResponse:
    if not context.subscription_id:
        raise HTTPException(status_code=404, detail=f"{label} plan not found.")

    if action == "delete":
        deactivated_workspace_ids = _deactivate_plan_workspaces(
            cursor,
            owner_id=context.owner_id,
            plan_family=context.plan_family,
            workspace_id=context.workspace_id,
        )
        cursor.execute(
            """
            UPDATE tangent_subscriptions
            SET status = 'canceled',
                current_period_end = NOW(),
                updated_at = NOW()
            WHERE id = %s
            """,
            (context.subscription_id,),
        )
        ledger_entry_id, balance_credits, revoked_credits = _revoke_remaining_plan_credits(
            cursor,
            account_id=context.account_id,
            actor_user_id=actor_user_id,
            note=note,
            subscription_id=context.subscription_id,
            target_user_id=target_user_id,
            workspace_id=context.workspace_id,
        )
        audit_id = insert_audit(
            cursor,
            action=f"admin.finance.manual.{context.plan_family}_plan_operation",
            actor_user_id=actor_user_id,
            metadata={
                "action": action,
                "accountId": context.account_id,
                "note": note,
                "planKey": context.plan_key,
                "deactivatedWorkspaceIds": deactivated_workspace_ids,
                "revokedCredits": revoked_credits,
                "subscriptionId": context.subscription_id,
            },
            target_user_id=target_user_id,
            workspace_id=context.workspace_id,
        )
        return AdminManualFinanceMutationResponse(
            accountId=context.account_id,
            action=action,
            auditId=audit_id,
            balanceCredits=balance_credits,
            grantedCredits=-revoked_credits if revoked_credits > 0 else None,
            ledgerEntryId=ledger_entry_id,
            message=_action_message(label, action),
            ok=True,
            planKey=context.plan_key,
            seatCapacity=context.seat_capacity,
            subscriptionId=context.subscription_id,
            subscriptionStatus="canceled",
            userId=target_user_id,
            workspaceId=context.workspace_id,
        )

    mutation = freeze_admin_operator_subscription if action == "freeze" else unfreeze_admin_operator_subscription
    result = mutation(
        actor_user_id=actor_user_id,
        reason=note,
        subscription_id=context.subscription_id,
        workspace_id=context.workspace_id,
    )
    updated = load_plan_context(
        cursor,
        account_id=context.account_id,
        owner_id=context.owner_id,
        owner_type=context.owner_type,
        plan_family=context.plan_family,
        subscription_id=context.subscription_id,
        workspace_id=context.workspace_id,
    )
    return AdminManualFinanceMutationResponse(
        accountId=context.account_id,
        action=action,
        auditId=result.audit_id,
        effectiveAt=iso_datetime(updated.current_period_start),
        message=_action_message(label, action),
        ok=True,
        periodEnd=iso_datetime(updated.current_period_end),
        periodStart=iso_datetime(updated.current_period_start),
        planKey=updated.plan_key,
        seatCapacity=updated.seat_capacity,
        subscriptionId=context.subscription_id,
        subscriptionStatus=result.status,
        userId=target_user_id,
        workspaceId=context.workspace_id,
    )


def _action_message(label: str, action: str) -> str:
    return f"{label} plan {_past_tense(action)}."


def _past_tense(action: str) -> str:
    return {
        "assign": "assigned",
        "delete": "deleted",
        "freeze": "frozen",
        "renew": "renewed",
        "unfreeze": "unfrozen",
        "upgrade": "upgraded",
    }.get(action, action)


def _deactivate_plan_workspaces(
    cursor: object,
    *,
    owner_id: str,
    plan_family: str,
    workspace_id: Optional[str],
) -> list[str]:
    workspace_ids = _resolve_plan_workspace_ids(
        cursor,
        owner_id=owner_id,
        plan_family=plan_family,
        workspace_id=workspace_id,
    )
    if not workspace_ids:
        return []
    cursor.execute(
        """
        UPDATE tangent_workspaces
        SET status = 'deleted'
        WHERE id = ANY(%s)
        """,
        (workspace_ids,),
    )
    soft_delete_workspace_boards(cursor, workspace_ids)
    cursor.execute(
        """
        UPDATE tangent_subscriptions
        SET status = 'canceled',
            current_period_end = NOW(),
            updated_at = NOW()
        WHERE workspace_id = ANY(%s)
          AND status IN ('active', 'trialing', 'paused')
        """,
        (workspace_ids,),
    )
    return workspace_ids


def _resolve_plan_workspace_ids(
    cursor: object,
    *,
    owner_id: str,
    plan_family: str,
    workspace_id: Optional[str],
) -> list[str]:
    if plan_family == "team" and workspace_id:
        return [workspace_id]
    if plan_family != "collaborate":
        return []
    cursor.execute(
        """
        SELECT id
        FROM tangent_workspaces
        WHERE owner_id = %s
          AND kind = 'group_workspace'
          AND COALESCE(status, 'active') <> 'deleted'
        ORDER BY created_at ASC NULLS LAST, id ASC
        """,
        (owner_id,),
    )
    return [str(row[0]) for row in cursor.fetchall()]


def _revoke_remaining_plan_credits(
    cursor: object,
    *,
    account_id: str,
    actor_user_id: str,
    note: str,
    subscription_id: str,
    target_user_id: Optional[str],
    workspace_id: Optional[str],
) -> tuple[Optional[str], Optional[float], float]:
    granted_credits = _load_subscription_grant_total(cursor, account_id, subscription_id)
    balance_before = load_credit_balance(cursor, account_id)
    revoked_credits = min(max(granted_credits, 0.0), max(balance_before, 0.0))
    if revoked_credits <= 0:
        return None, balance_before, 0.0
    ledger_entry_id = insert_ledger_entry(
        cursor,
        account_id=account_id,
        actor_user_id=actor_user_id,
        credits_delta=-revoked_credits,
        metadata={
            "balanceBefore": balance_before,
            "note": note,
            "revokedCredits": revoked_credits,
            "subscriptionId": subscription_id,
            "targetUserId": target_user_id,
            "workspaceId": workspace_id,
        },
        reason="subscription_revoke",
        source_id=subscription_id,
        source_type="subscription",
        workspace_id=workspace_id,
    )
    return ledger_entry_id, load_credit_balance(cursor, account_id), revoked_credits


def _load_subscription_grant_total(cursor: object, account_id: str, subscription_id: str) -> float:
    cursor.execute(
        """
        SELECT COALESCE(SUM(credits_delta), 0)
        FROM tangent_credit_ledger
        WHERE account_id = %s
          AND source_type = 'subscription'
          AND source_id = %s
          AND reason = 'subscription_grant'
          AND credits_delta > 0
        """,
        (account_id, subscription_id),
    )
    row = cursor.fetchone()
    return float(row[0] or 0) if row else 0.0
