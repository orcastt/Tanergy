from typing import Optional

from fastapi import APIRouter, Depends, Query

from tangent_api.admin_access import require_admin_role, write_admin_audit_log
from tangent_api.admin_finance_reads import (
    list_admin_finance_ledger,
    list_admin_finance_member_usage,
    list_admin_finance_payments,
    list_admin_finance_subscriptions,
    list_admin_finance_wallets,
    load_admin_finance_summary,
)
from tangent_api.admin_finance_manual import (
    manual_cancel_subscription,
    manual_set_collaborate_plan,
    manual_set_team_plan,
    manual_topup_user,
    manual_topup_workspace,
)
from tangent_api.admin_finance_manual_schemas import (
    AdminManualCollaboratePlanRequest,
    AdminManualFinanceMutationResponse,
    AdminManualSubscriptionCancelRequest,
    AdminManualTeamPlanRequest,
    AdminManualUserTopupRequest,
    AdminManualWorkspaceTopupRequest,
)
from tangent_api.admin_finance_schemas import (
    AdminFinanceLedgerResponse,
    AdminFinanceMemberUsageResponse,
    AdminFinancePaymentsResponse,
    AdminFinanceSubscriptionsResponse,
    AdminFinanceSummaryResponse,
    AdminFinanceWalletsResponse,
)
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/api/v1/admin/finance", tags=["admin"])

FINANCE_READ_ROLES = {"owner", "admin", "finance", "analyst"}
FINANCE_WRITE_ROLES = {"owner", "admin", "finance"}


@router.get("/summary", response_model=AdminFinanceSummaryResponse)
def get_admin_finance_summary(
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminFinanceSummaryResponse:
    roles = require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    summary = load_admin_finance_summary()
    _write_read_audit(context, "admin.finance.summary.read", roles, {})
    return AdminFinanceSummaryResponse(ok=True, summary=summary)


@router.get("/payments", response_model=AdminFinancePaymentsResponse)
def get_admin_finance_payments(
    kind: Optional[str] = Query(default=None, min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    provider: Optional[str] = Query(default=None, min_length=1),
    status: Optional[str] = Query(default=None, min_length=1),
    user_id: Optional[str] = Query(default=None, alias="userId", min_length=1),
    workspace_id: Optional[str] = Query(default=None, alias="workspaceId", min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminFinancePaymentsResponse:
    roles = require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    payments = list_admin_finance_payments(
        kind=kind,
        limit=limit,
        provider=provider,
        status=status,
        user_id=user_id,
        workspace_id=workspace_id,
    )
    _write_read_audit(context, "admin.finance.payments.list", roles, locals())
    return AdminFinancePaymentsResponse(ok=True, payments=payments)


@router.get("/wallets", response_model=AdminFinanceWalletsResponse)
def get_admin_finance_wallets(
    account_kind: Optional[str] = Query(default=None, alias="accountKind", min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    owner_id: Optional[str] = Query(default=None, alias="ownerId", min_length=1),
    owner_type: Optional[str] = Query(default=None, alias="ownerType", min_length=1),
    status: Optional[str] = Query(default=None, min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminFinanceWalletsResponse:
    roles = require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    wallets = list_admin_finance_wallets(
        account_kind=account_kind,
        limit=limit,
        owner_id=owner_id,
        owner_type=owner_type,
        status=status,
    )
    _write_read_audit(context, "admin.finance.wallets.list", roles, locals())
    return AdminFinanceWalletsResponse(ok=True, wallets=wallets)


@router.get("/credit-ledger", response_model=AdminFinanceLedgerResponse)
def get_admin_finance_credit_ledger(
    account_id: Optional[str] = Query(default=None, alias="accountId", min_length=1),
    actor_user_id: Optional[str] = Query(default=None, alias="actorUserId", min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    reason: Optional[str] = Query(default=None, min_length=1),
    workspace_id: Optional[str] = Query(default=None, alias="workspaceId", min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminFinanceLedgerResponse:
    roles = require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    ledger = list_admin_finance_ledger(
        account_id=account_id,
        actor_user_id=actor_user_id,
        limit=limit,
        reason=reason,
        workspace_id=workspace_id,
    )
    _write_read_audit(context, "admin.finance.credit_ledger.list", roles, locals())
    return AdminFinanceLedgerResponse(ok=True, ledger=ledger)


@router.get("/subscriptions", response_model=AdminFinanceSubscriptionsResponse)
def get_admin_finance_subscriptions(
    limit: int = Query(default=50, ge=1, le=200),
    owner_id: Optional[str] = Query(default=None, alias="ownerId", min_length=1),
    plan_family: Optional[str] = Query(default=None, alias="planFamily", min_length=1),
    status: Optional[str] = Query(default=None, min_length=1),
    workspace_id: Optional[str] = Query(default=None, alias="workspaceId", min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminFinanceSubscriptionsResponse:
    roles = require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    subscriptions = list_admin_finance_subscriptions(
        limit=limit,
        owner_id=owner_id,
        plan_family=plan_family,
        status=status,
        workspace_id=workspace_id,
    )
    _write_read_audit(context, "admin.finance.subscriptions.list", roles, locals())
    return AdminFinanceSubscriptionsResponse(ok=True, subscriptions=subscriptions)


@router.get("/member-usage", response_model=AdminFinanceMemberUsageResponse)
def get_admin_finance_member_usage(
    workspace_id: str = Query(alias="workspaceId", min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminFinanceMemberUsageResponse:
    roles = require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    member_usage = list_admin_finance_member_usage(workspace_id, limit=limit)
    _write_read_audit(context, "admin.finance.member_usage.list", roles, {"limit": limit, "workspaceId": workspace_id})
    return AdminFinanceMemberUsageResponse(ok=True, memberUsage=member_usage)


@router.post("/manual/user-topup", response_model=AdminManualFinanceMutationResponse)
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


@router.post("/manual/workspace-topup", response_model=AdminManualFinanceMutationResponse)
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


@router.post("/manual/collaborate-plan", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_collaborate_plan(
    payload: AdminManualCollaboratePlanRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_set_collaborate_plan(
        actor_user_id=context.user_id,
        grant_included_credits=payload.grant_included_credits,
        note=payload.note,
        plan_key=payload.plan_key,
        status=payload.status,
        target_user_id=payload.user_id,
    )


@router.post("/manual/team-plan", response_model=AdminManualFinanceMutationResponse)
def post_admin_manual_team_plan(
    payload: AdminManualTeamPlanRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminManualFinanceMutationResponse:
    require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    return manual_set_team_plan(
        actor_user_id=context.user_id,
        grant_included_credits=payload.grant_included_credits,
        note=payload.note,
        plan_key=payload.plan_key,
        seat_capacity=payload.seat_capacity,
        status=payload.status,
        workspace_id=payload.workspace_id,
    )


@router.post("/manual/subscription-cancel", response_model=AdminManualFinanceMutationResponse)
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


def _write_read_audit(
    context: ApiRequestContext,
    action: str,
    roles: list[object],
    metadata: dict[str, object],
) -> None:
    write_admin_audit_log(
        action=action,
        actor_user_id=context.user_id,
        metadata={**_safe_metadata(metadata), "roles": [getattr(role, "role", "") for role in roles]},
        workspace_id=context.workspace_id,
    )


def _safe_metadata(metadata: dict[str, object]) -> dict[str, object]:
    blocked = {"context", "roles", "payments", "wallets", "ledger", "subscriptions", "member_usage"}
    return {key: value for key, value in metadata.items() if key not in blocked and value not in (None, "")}
