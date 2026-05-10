from typing import Optional

from fastapi import HTTPException

from tangent_api.admin_finance_manual_ops import insert_audit
from tangent_api.admin_finance_manual_plan_context import PlanContext, iso_datetime, load_plan_context
from tangent_api.admin_finance_manual_schemas import AdminManualFinanceMutationResponse
from tangent_api.admin_operator_subscription_writes import (
    freeze_admin_operator_subscription,
    unfreeze_admin_operator_subscription,
)


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
        audit_id = insert_audit(
            cursor,
            action=f"admin.finance.manual.{context.plan_family}_plan_operation",
            actor_user_id=actor_user_id,
            metadata={
                "action": action,
                "accountId": context.account_id,
                "note": note,
                "planKey": context.plan_key,
                "subscriptionId": context.subscription_id,
            },
            target_user_id=target_user_id,
            workspace_id=context.workspace_id,
        )
        return AdminManualFinanceMutationResponse(
            accountId=context.account_id,
            action=action,
            auditId=audit_id,
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
