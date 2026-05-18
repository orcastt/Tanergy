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
from tangent_api.admin_finance_schemas import (
    AdminFinanceLedgerResponse,
    AdminFinanceMemberUsageResponse,
    AdminFinancePaymentsResponse,
    AdminFinanceSubscriptionsResponse,
    AdminFinanceSummaryResponse,
    AdminFinanceWalletsResponse,
)
from tangent_api.plan_catalog import list_plan_catalog, update_plan_catalog_entry
from tangent_api.plan_catalog_schemas import PlanCatalogMutationResponse, PlanCatalogResponse, PlanCatalogUpdateRequest
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.routers.admin_finance_manual import router as manual_router

router = APIRouter(prefix="/api/v1/admin/finance", tags=["admin"])
router.include_router(manual_router)

FINANCE_READ_ROLES = {"owner", "admin", "finance"}
FINANCE_WRITE_ROLES = {"owner", "admin", "finance"}


@router.get("/summary", response_model=AdminFinanceSummaryResponse)
def get_admin_finance_summary(
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminFinanceSummaryResponse:
    require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    summary = load_admin_finance_summary()
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
    require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    payments = list_admin_finance_payments(
        kind=kind,
        limit=limit,
        provider=provider,
        status=status,
        user_id=user_id,
        workspace_id=workspace_id,
    )
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
    require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    wallets = list_admin_finance_wallets(
        account_kind=account_kind,
        limit=limit,
        owner_id=owner_id,
        owner_type=owner_type,
        status=status,
    )
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
    require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    ledger = list_admin_finance_ledger(
        account_id=account_id,
        actor_user_id=actor_user_id,
        limit=limit,
        reason=reason,
        workspace_id=workspace_id,
    )
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
    require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    subscriptions = list_admin_finance_subscriptions(
        limit=limit,
        owner_id=owner_id,
        plan_family=plan_family,
        status=status,
        workspace_id=workspace_id,
    )
    return AdminFinanceSubscriptionsResponse(ok=True, subscriptions=subscriptions)


@router.get("/member-usage", response_model=AdminFinanceMemberUsageResponse)
def get_admin_finance_member_usage(
    workspace_id: str = Query(alias="workspaceId", min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminFinanceMemberUsageResponse:
    require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    member_usage = list_admin_finance_member_usage(workspace_id, limit=limit)
    return AdminFinanceMemberUsageResponse(ok=True, memberUsage=member_usage)


@router.get("/plan-catalog", response_model=PlanCatalogResponse)
def get_admin_finance_plan_catalog(
    context: ApiRequestContext = Depends(get_request_context),
) -> PlanCatalogResponse:
    require_admin_role(context, allowed_roles=FINANCE_READ_ROLES)
    plans = list_plan_catalog()
    return PlanCatalogResponse(ok=True, plans=plans)


@router.put("/plan-catalog/{plan_key}", response_model=PlanCatalogMutationResponse)
def put_admin_finance_plan_catalog(
    plan_key: str,
    payload: PlanCatalogUpdateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> PlanCatalogMutationResponse:
    roles = require_admin_role(context, allowed_roles=FINANCE_WRITE_ROLES)
    patch = payload.model_dump(by_alias=False, exclude_unset=True)
    plan = update_plan_catalog_entry(plan_key, patch)
    write_admin_audit_log(
        action="admin.finance.plan_catalog.update",
        actor_user_id=context.user_id,
        metadata={
            "planKey": plan_key,
            "roles": [getattr(role, "role", "") for role in roles],
            "updatedFields": sorted(payload.model_dump(by_alias=False, exclude_unset=True).keys()),
        },
        workspace_id=context.workspace_id,
    )
    return PlanCatalogMutationResponse(ok=True, plan=plan)
