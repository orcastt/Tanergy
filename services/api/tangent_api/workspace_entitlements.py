import os
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException

from tangent_api.ai_schemas import AiRunChargeSummary
from tangent_api.billing_balance import load_credit_balance_for_account, load_credit_reason_totals, load_credit_spent_for_account, split_credit_balance
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.workspace_entitlement_members import (
    can_see_team_member_usage,
    context_workspace_dashboard_member,
    load_workspace_dashboard_members_from_db,
    update_workspace_member_role_with_connections,
)
from tangent_api.workspace_entitlement_policy import (
    build_plan_summary,
    build_workspace_summary,
    demo_usage_for_user,
    entitlement_source,
    is_plan_key_allowed_for_workspace_kind,
    optional_iso,
    payer_label,
    resolve_billing_interval,
    resolve_next_refresh_at,
    resolve_plan_key,
)
from tangent_api.workspace_dashboard_seats import load_workspace_dashboard_seat_capacity
from tangent_api.workspace_schemas import (
    BillingMeResponse,
    PersonalCreditSummary,
    WorkspaceDashboardMember,
    WorkspaceDashboardRecord,
    WorkspaceEntitlementResponse,
)
@dataclass(frozen=True)
class EntitlementResolution:
    charged_account_id: Optional[str]
    current_period_start: Optional[str]
    current_period_end: Optional[str]
    included_credits_override: Optional[int]
    plan_key: str
    workspace_seat_id: Optional[str] = None

def build_billing_me_response(context: ApiRequestContext) -> BillingMeResponse:
    entitlement = resolve_entitlement(context)
    plan = build_plan_summary(entitlement.plan_key, entitlement.included_credits_override)
    charge = _build_ai_charge_summary(context, entitlement)
    billing_interval = resolve_billing_interval(
        entitlement.current_period_start,
        entitlement.current_period_end,
        plan.billing_period,
    )
    included_total = plan.included_credits
    if os.getenv("DATABASE_URL"):
        total_balance = load_credit_balance_for_account(charge.charged_account_id)
        reason_totals = load_credit_reason_totals(charge.charged_account_id)
        usage = int(round(load_credit_spent_for_account(charge.charged_account_id)))
        if total_balance > 0 and reason_totals.get("subscription_grant", 0) > 0:
            included_remaining, top_up_balance = split_credit_balance(total_balance, included_total)
        else:
            included_remaining = 0
            top_up_balance = max(0, int(round(total_balance)))
    else:
        usage = demo_usage_for_user(context.user_id, included_total)
        included_remaining = max(0, included_total - usage)
        top_up_balance = 0
    return BillingMeResponse(
        billingInterval=billing_interval,
        chargeScope=charge.charged_scope,
        credits=PersonalCreditSummary(
            includedRemaining=included_remaining,
            includedTotal=included_total,
            topUpBalance=top_up_balance,
            usedThisCycle=usage,
        ),
        currentPeriodStart=entitlement.current_period_start,
        currentPeriodEnd=entitlement.current_period_end,
        ok=True,
        nextRefreshAt=resolve_next_refresh_at(
            entitlement.current_period_start,
            entitlement.current_period_end,
            billing_interval,
        ),
        payerLabel=charge.payer_label,
        plan=plan,
        workspace=build_workspace_summary(context),
    )

def build_workspace_dashboard_response(context: ApiRequestContext) -> WorkspaceDashboardRecord:
    can_see_member_usage = can_see_team_member_usage(context)
    members = _load_workspace_dashboard_members(context, can_see_member_usage)
    total_usage = None
    if can_see_member_usage:
        total_usage = sum(member.usage_this_cycle or 0 for member in members)
    return WorkspaceDashboardRecord(
        boardCount=context.workspace_board_count,
        canSeeMemberUsage=can_see_member_usage,
        dashboardKind="team_usage" if can_see_member_usage else "group_structure",
        memberCount=len(members),
        members=members,
        seatCapacity=load_workspace_dashboard_seat_capacity(context),
        totalUsageThisCycle=total_usage,
        workspace=build_workspace_summary(context),
    )

def build_workspace_entitlement_response(context: ApiRequestContext) -> WorkspaceEntitlementResponse:
    entitlement = resolve_entitlement(context)
    return WorkspaceEntitlementResponse(
        charge=_build_ai_charge_summary(context, entitlement),
        ok=True,
        plan=build_plan_summary(entitlement.plan_key, entitlement.included_credits_override),
        workspace=build_workspace_summary(context),
    )

def resolve_ai_charge_summary(context: ApiRequestContext) -> AiRunChargeSummary:
    return _build_ai_charge_summary(context, resolve_entitlement(context))

def resolve_entitlement(context: ApiRequestContext) -> EntitlementResolution:
    database_resolution = _resolve_database_entitlement(context)
    if database_resolution:
        return database_resolution
    return EntitlementResolution(
        charged_account_id=None,
        current_period_start=None,
        current_period_end=None,
        included_credits_override=None,
        plan_key=resolve_plan_key(context.workspace_kind, context.workspace_plan_key),
        workspace_seat_id=None,
    )

def update_workspace_member_role(user_id: str, role: str, context: ApiRequestContext) -> WorkspaceDashboardMember:
    return update_workspace_member_role_with_connections(
        user_id,
        role,
        context,
        connect_to_postgres_fn=connect_to_postgres,
        require_database_url_fn=require_database_url,
    )

def _build_ai_charge_summary(
    context: ApiRequestContext,
    entitlement: EntitlementResolution,
) -> AiRunChargeSummary:
    if context.workspace_kind == "enterprise_workspace":
        charged_scope = "workspace_pool"
    elif context.workspace_kind == "team_workspace":
        charged_scope = "team_wallet"
    else:
        charged_scope = "actor_personal"
    charged_account_id = entitlement.charged_account_id or (
        f"credit_workspace_{context.workspace_id}"
        if charged_scope in {"team_wallet", "workspace_pool"}
        else f"credit_user_{context.user_id}"
    )
    workspace_seat_id = entitlement.workspace_seat_id
    if workspace_seat_id is None and context.workspace_kind == "team_workspace":
        workspace_seat_id = f"seat_{context.workspace_id}_{context.user_id}"
    return AiRunChargeSummary(
        chargedAccountId=charged_account_id,
        chargedScope=charged_scope,
        entitlementSource=entitlement_source(context.workspace_kind),
        payerLabel=payer_label(charged_scope),
        planKey=entitlement.plan_key,
        preflightStatus="mock_contract_only",
        workspaceKind=context.workspace_kind,
        workspaceSeatId=workspace_seat_id,
    )

def _resolve_database_entitlement(context: ApiRequestContext) -> Optional[EntitlementResolution]:
    if not os.getenv("DATABASE_URL"):
        return None
    subscription_row = None
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            if context.workspace_kind == "team_workspace":
                cursor.execute(
                    """
                    SELECT plan_key, seat_capacity, current_period_start, current_period_end
                    FROM tangent_subscriptions
                    WHERE owner_type = 'workspace'
                      AND owner_id = %s
                      AND plan_family = 'team'
                      AND status IN ('active', 'trialing')
                      AND (current_period_end IS NULL OR current_period_end > NOW())
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    (context.workspace_id,),
                )
                subscription_row = cursor.fetchone()
                if subscription_row is None:
                    raise HTTPException(status_code=402, detail="Active Team subscription is required to use Team wallet.")
                cursor.execute(
                    """
                    SELECT id, plan_key, included_credits
                    FROM tangent_workspace_seat_assignments
                    WHERE workspace_id = %s
                      AND user_id = %s
                      AND status = 'active'
                      AND (current_period_end IS NULL OR current_period_end > NOW())
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    (context.workspace_id, context.user_id),
                )
                seat_row = cursor.fetchone()
                if seat_row and str(seat_row[1]) in {"team_start", "team_growth", "enterprise"}:
                    charged_account_id = _select_credit_account_id(
                        cursor,
                        "workspace",
                        context.workspace_id,
                        account_kind="team_wallet",
                    )
                    return EntitlementResolution(
                        charged_account_id=charged_account_id,
                        current_period_start=optional_iso(subscription_row[2]),
                        current_period_end=optional_iso(subscription_row[3]),
                        included_credits_override=int(seat_row[2] or 0),
                        plan_key=str(seat_row[1]),
                        workspace_seat_id=str(seat_row[0]),
                    )
                raise HTTPException(status_code=402, detail="Active Team seat is required to use Team wallet.")
            owner_type = "workspace" if context.workspace_kind == "enterprise_workspace" else "user"
            owner_id = context.workspace_id if owner_type == "workspace" else context.user_id
            cursor.execute(
                """
                SELECT ca.id, s.plan_key, s.current_period_start, s.current_period_end
                FROM tangent_credit_accounts ca
                JOIN tangent_subscriptions s ON s.account_id = ca.id
                WHERE ca.owner_type = %s
                  AND ca.owner_id = %s
                  AND ca.status = 'active'
                  AND s.status IN ('active', 'trialing')
                  AND (s.current_period_end IS NULL OR s.current_period_end > NOW())
                ORDER BY s.updated_at DESC
                LIMIT 1
                """,
                (owner_type, owner_id),
            )
            subscription_row = cursor.fetchone()
    if subscription_row and is_plan_key_allowed_for_workspace_kind(str(subscription_row[1]), context.workspace_kind):
        return EntitlementResolution(
            charged_account_id=str(subscription_row[0]),
            current_period_start=optional_iso(subscription_row[2]),
            current_period_end=optional_iso(subscription_row[3]),
            included_credits_override=None,
            plan_key=str(subscription_row[1]),
            workspace_seat_id=None,
        )
    return None

def _load_workspace_dashboard_members(
    context: ApiRequestContext,
    can_see_member_usage: bool,
) -> list[WorkspaceDashboardMember]:
    if not os.getenv("DATABASE_URL"):
        return [_demo_workspace_dashboard_member(context, can_see_member_usage)]
    return load_workspace_dashboard_members_from_db(
        context,
        can_see_member_usage,
        connect_to_postgres_fn=connect_to_postgres,
    )

def _demo_workspace_dashboard_member(
    context: ApiRequestContext,
    can_see_member_usage: bool,
) -> WorkspaceDashboardMember:
    entitlement = resolve_entitlement(context)
    usage = demo_usage_for_user(
        context.user_id,
        build_plan_summary(entitlement.plan_key, entitlement.included_credits_override).included_credits,
    )
    return context_workspace_dashboard_member(context, can_see_member_usage, usage)

def _select_credit_account_id(
    cursor: object,
    owner_type: str,
    owner_id: str,
    *,
    account_kind: Optional[str] = None,
) -> Optional[str]:
    filters = ["owner_type = %s", "owner_id = %s", "status = 'active'"]
    params: list[object] = [owner_type, owner_id]
    if account_kind:
        filters.append("(account_kind = %s OR account_kind IS NULL)")
        params.append(account_kind)
    cursor.execute(
        f"""
        SELECT id
        FROM tangent_credit_accounts
        WHERE {" AND ".join(filters)}
        LIMIT 1
        """,
        tuple(params),
    )
    row = cursor.fetchone()
    return str(row[0]) if row else None
