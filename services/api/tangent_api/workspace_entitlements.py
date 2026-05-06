from tangent_api.ai_schemas import AiRunChargeSummary
from tangent_api.request_context import ApiRequestContext
from tangent_api.workspace_schemas import (
    BillingMeResponse,
    BillingWorkspaceSummary,
    PersonalCreditSummary,
    WorkspaceDashboardMember,
    WorkspaceDashboardRecord,
    WorkspaceEntitlementResponse,
    WorkspacePlanSummary,
)


PLAN_CATALOG = {
    "free_canvas": {
        "billing_period": "none",
        "included_credits": 0,
        "monthly_price_usd": 0,
        "name": "Free Canvas",
        "seat_range": None,
    },
    "collaborate_start": {
        "billing_period": "monthly_or_annual",
        "included_credits": 1500,
        "monthly_price_usd": 18,
        "name": "Collaborate Start",
        "seat_range": "1+ users",
    },
    "team_start": {
        "billing_period": "monthly_or_annual",
        "included_credits": 2500,
        "monthly_price_usd": 25,
        "name": "Team Start",
        "seat_range": "2-15 seats",
    },
    "enterprise": {
        "billing_period": "contract",
        "included_credits": 0,
        "monthly_price_usd": None,
        "name": "Enterprise",
        "seat_range": "custom",
    },
}


def build_billing_me_response(context: ApiRequestContext) -> BillingMeResponse:
    plan_key = resolve_plan_key(context.workspace_kind)
    plan = build_plan_summary(plan_key)
    charge = resolve_ai_charge_summary(context)
    included_total = plan.included_credits
    usage = _mock_usage_for_user(context.user_id, included_total)
    return BillingMeResponse(
        chargeScope=charge.charged_scope,
        credits=PersonalCreditSummary(
            includedRemaining=max(0, included_total - usage),
            includedTotal=included_total,
            topUpBalance=0,
            usedThisCycle=usage,
        ),
        ok=True,
        payerLabel=charge.payer_label,
        plan=plan,
        workspace=build_workspace_summary(context),
    )


def build_workspace_dashboard_response(context: ApiRequestContext) -> WorkspaceDashboardRecord:
    can_see_member_usage = can_see_team_member_usage(context)
    usage = _mock_usage_for_user(context.user_id, build_plan_summary(resolve_plan_key(context.workspace_kind)).included_credits)
    member = WorkspaceDashboardMember(
        displayName=context.user_display_name,
        email=context.user_email,
        role=context.workspace_role,
        usageThisCycle=usage if can_see_member_usage else None,
        userId=context.user_id,
    )
    return WorkspaceDashboardRecord(
        boardCount=context.workspace_board_count,
        canSeeMemberUsage=can_see_member_usage,
        dashboardKind="team_usage" if can_see_member_usage else "group_structure",
        memberCount=1,
        members=[member],
        totalUsageThisCycle=usage if can_see_member_usage else None,
        workspace=build_workspace_summary(context),
    )


def build_workspace_entitlement_response(context: ApiRequestContext) -> WorkspaceEntitlementResponse:
    plan_key = resolve_plan_key(context.workspace_kind)
    return WorkspaceEntitlementResponse(
        charge=resolve_ai_charge_summary(context),
        ok=True,
        plan=build_plan_summary(plan_key),
        workspace=build_workspace_summary(context),
    )


def resolve_ai_charge_summary(context: ApiRequestContext) -> AiRunChargeSummary:
    plan_key = resolve_plan_key(context.workspace_kind)
    is_enterprise_pool = context.workspace_kind == "enterprise_workspace"
    charged_scope = "workspace_pool" if is_enterprise_pool else "actor_personal"
    charged_account_id = (
        f"credit_workspace_{context.workspace_id}"
        if charged_scope == "workspace_pool"
        else f"credit_user_{context.user_id}"
    )
    workspace_seat_id = (
        f"seat_{context.workspace_id}_{context.user_id}"
        if context.workspace_kind == "team_workspace"
        else None
    )
    return AiRunChargeSummary(
        chargedAccountId=charged_account_id,
        chargedScope=charged_scope,
        entitlementSource=_entitlement_source(context.workspace_kind),
        payerLabel="Charges enterprise workspace credits" if is_enterprise_pool else "Charges your credits",
        planKey=plan_key,
        preflightStatus="mock_contract_only",
        workspaceKind=context.workspace_kind,
        workspaceSeatId=workspace_seat_id,
    )


def build_workspace_summary(context: ApiRequestContext) -> BillingWorkspaceSummary:
    return BillingWorkspaceSummary(
        id=context.workspace_id,
        kind=context.workspace_kind,
        name=context.workspace_name,
        role=context.workspace_role,
    )


def build_plan_summary(plan_key: str) -> WorkspacePlanSummary:
    spec = PLAN_CATALOG.get(plan_key, PLAN_CATALOG["free_canvas"])
    return WorkspacePlanSummary(
        billingPeriod=spec["billing_period"],
        includedCredits=int(spec["included_credits"] or 0),
        monthlyPriceUsd=spec["monthly_price_usd"],
        name=str(spec["name"]),
        planKey=plan_key,
        seatRange=spec["seat_range"],
    )


def resolve_plan_key(workspace_kind: str) -> str:
    if workspace_kind == "group_workspace":
        return "collaborate_start"
    if workspace_kind == "team_workspace":
        return "team_start"
    if workspace_kind == "enterprise_workspace":
        return "enterprise"
    return "free_canvas"


def can_see_team_member_usage(context: ApiRequestContext) -> bool:
    return context.workspace_kind == "team_workspace" and context.workspace_role in {"owner", "admin"}


def _entitlement_source(workspace_kind: str) -> str:
    if workspace_kind == "team_workspace":
        return "team_seat_allowance"
    if workspace_kind == "group_workspace":
        return "personal_collaborate_balance"
    if workspace_kind == "enterprise_workspace":
        return "enterprise_contract"
    return "personal_topup_or_free"


def _mock_usage_for_user(user_id: str, included_total: int) -> int:
    if included_total <= 0:
        return 0
    return min(included_total, 120 + (sum(ord(char) for char in user_id) % 380))
