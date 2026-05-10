from fastapi import APIRouter, Depends

from tangent_api.admin_access import require_admin_role
from tangent_api.admin_finance_manual import (
    manual_adjust_user_credits,
    manual_adjust_workspace_credits,
    manual_topup_user,
    manual_topup_workspace,
)
from tangent_api.admin_finance_manual_schemas import (
    AdminManualCollaboratePlanRequest,
    AdminManualCreditAdjustmentRequest,
    AdminManualCreateGroupWorkspaceRequest,
    AdminManualCreateTeamWorkspaceRequest,
    AdminManualFinanceMutationResponse,
    AdminManualGroupPlanOperationRequest,
    AdminManualSubscriptionCancelRequest,
    AdminManualTeamPlanRequest,
    AdminManualTeamPlanOperationRequest,
    AdminManualUserTopupRequest,
    AdminManualWorkspaceDeleteRequest,
    AdminManualWorkspaceTopupRequest,
)
from tangent_api.admin_finance_manual_plan_operations import (
    manual_operate_group_plan,
    manual_operate_team_plan,
)
from tangent_api.admin_finance_manual_subscriptions import (
    manual_cancel_subscription,
    manual_set_collaborate_plan,
    manual_set_team_plan,
)
from tangent_api.admin_finance_manual_workspaces import (
    manual_create_group_workspace,
    manual_create_team_workspace,
    manual_delete_workspace,
)
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/manual", tags=["admin"])

FINANCE_WRITE_ROLES = {"owner", "admin", "finance"}


@router.post("/user-topup", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_user_topup(
    payload: AdminManualUserTopupRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_topup_user(
        actor_user_id=context.user_id,
        amount_cents=payload.amount_cents,
        credits=payload.credits,
        currency=payload.currency,
        note=payload.note,
        target_user_id=payload.user_id,
    )


@router.post("/workspace-topup", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_workspace_topup(
    payload: AdminManualWorkspaceTopupRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_topup_workspace(
        actor_user_id=context.user_id,
        amount_cents=payload.amount_cents,
        credits=payload.credits,
        currency=payload.currency,
        note=payload.note,
        workspace_id=payload.workspace_id,
    )


@router.post("/user-credit-adjust", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_user_credit_adjust(
    payload: AdminManualCreditAdjustmentRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_adjust_user_credits(
        actor_user_id=context.user_id,
        credits_delta=payload.credits_delta,
        note=payload.note,
        target_user_id=payload.user_id or "",
    )


@router.post("/workspace-credit-adjust", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_workspace_credit_adjust(
    payload: AdminManualCreditAdjustmentRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_adjust_workspace_credits(
        actor_user_id=context.user_id,
        credits_delta=payload.credits_delta,
        note=payload.note,
        workspace_id=payload.workspace_id or "",
    )


@router.post("/collaborate-plan", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_collaborate_plan(
    payload: AdminManualCollaboratePlanRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_set_collaborate_plan(
        actor_user_id=context.user_id,
        duration_count=payload.duration_count,
        duration_unit_days=payload.duration_unit_days,
        effect_mode=payload.effect_mode,
        grant_included_credits=payload.grant_included_credits,
        note=payload.note,
        period_end=payload.period_end,
        plan_key=payload.plan_key,
        status=payload.status,
        target_user_id=payload.user_id,
    )


@router.post("/team-plan", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_team_plan(
    payload: AdminManualTeamPlanRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_set_team_plan(
        actor_user_id=context.user_id,
        duration_count=payload.duration_count,
        duration_unit_days=payload.duration_unit_days,
        effect_mode=payload.effect_mode,
        grant_included_credits=payload.grant_included_credits,
        note=payload.note,
        period_end=payload.period_end,
        plan_key=payload.plan_key,
        seat_capacity=payload.seat_capacity,
        status=payload.status,
        workspace_id=payload.workspace_id,
    )


@router.post("/group-plan-operation", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_group_plan_operation(
    payload: AdminManualGroupPlanOperationRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_operate_group_plan(
        action=payload.action,
        actor_user_id=context.user_id,
        duration_count=payload.duration_count,
        duration_unit_days=payload.duration_unit_days,
        effect_mode=payload.effect_mode,
        grant_included_credits=payload.grant_included_credits,
        note=payload.note,
        plan_key=payload.plan_key,
        status=payload.status,
        subscription_id=payload.subscription_id,
        target_user_id=payload.user_id,
    )


@router.post("/team-plan-operation", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_team_plan_operation(
    payload: AdminManualTeamPlanOperationRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_operate_team_plan(
        action=payload.action,
        actor_user_id=context.user_id,
        duration_count=payload.duration_count,
        duration_unit_days=payload.duration_unit_days,
        effect_mode=payload.effect_mode,
        grant_included_credits=payload.grant_included_credits,
        note=payload.note,
        plan_key=payload.plan_key,
        seat_capacity=payload.seat_capacity,
        status=payload.status,
        subscription_id=payload.subscription_id,
        workspace_id=payload.workspace_id,
    )


@router.post("/group-workspace", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_group_workspace(
    payload: AdminManualCreateGroupWorkspaceRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_create_group_workspace(
        actor_user_id=context.user_id,
        note=payload.note,
        target_user_id=payload.user_id,
        workspace_name=payload.workspace_name,
    )


@router.post("/team-workspace", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_team_workspace(
    payload: AdminManualCreateTeamWorkspaceRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_create_team_workspace(
        actor_user_id=context.user_id,
        duration_count=payload.duration_count,
        duration_unit_days=payload.duration_unit_days,
        effect_mode=payload.effect_mode,
        extra_credits=payload.extra_credits,
        grant_plan_credits=payload.grant_included_credits,
        note=payload.note,
        period_end=payload.period_end,
        plan_key=payload.plan_key,
        seat_capacity=payload.seat_capacity,
        status=payload.status,
        target_user_id=payload.user_id,
        workspace_name=payload.workspace_name,
    )


@router.post("/subscription-cancel", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_subscription_cancel(
    payload: AdminManualSubscriptionCancelRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_cancel_subscription(
        actor_user_id=context.user_id,
        note=payload.note,
        subscription_id=payload.subscription_id,
    )


@router.post("/workspace-delete", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_workspace_delete(
    payload: AdminManualWorkspaceDeleteRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_delete_workspace(
        actor_user_id=context.user_id,
        note=payload.note,
        workspace_id=payload.workspace_id,
    )
