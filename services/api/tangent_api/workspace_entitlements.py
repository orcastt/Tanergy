import os
import re
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException

from tangent_api.ai_schemas import AiRunChargeSummary
from tangent_api.billing_balance import load_credit_balance_for_account, load_credit_reason_totals, split_credit_balance
from tangent_api.plan_catalog import DEFAULT_PLAN_CATALOG, load_plan_spec
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.workspace_schemas import (
    BillingMeResponse,
    BillingWorkspaceSummary,
    PersonalCreditSummary,
    WorkspaceDashboardMember,
    WorkspaceDashboardRecord,
    WorkspaceEntitlementResponse,
    WorkspacePlanSummary,
)


PLAN_CATALOG = DEFAULT_PLAN_CATALOG

ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
WORKSPACE_DASHBOARD_MEMBER_LIMIT = 200


@dataclass(frozen=True)
class EntitlementResolution:
    charged_account_id: Optional[str]
    current_period_end: Optional[str]
    included_credits_override: Optional[int]
    plan_key: str
    workspace_seat_id: Optional[str] = None


def build_billing_me_response(context: ApiRequestContext) -> BillingMeResponse:
    entitlement = resolve_entitlement(context)
    plan = build_plan_summary(entitlement.plan_key, entitlement.included_credits_override)
    charge = _build_ai_charge_summary(context, entitlement)
    included_total = plan.included_credits
    if os.getenv("DATABASE_URL"):
        total_balance = load_credit_balance_for_account(charge.charged_account_id)
        reason_totals = load_credit_reason_totals(charge.charged_account_id)
        usage = _usage_from_reason_totals(reason_totals)
        if total_balance > 0 and reason_totals.get("subscription_grant", 0) > 0:
            included_remaining, top_up_balance = split_credit_balance(total_balance, included_total)
        else:
            included_remaining = 0
            top_up_balance = max(0, int(round(total_balance)))
    else:
        usage = _demo_usage_for_user(context.user_id, included_total)
        included_remaining = max(0, included_total - usage)
        top_up_balance = 0
    return BillingMeResponse(
        chargeScope=charge.charged_scope,
        credits=PersonalCreditSummary(
            includedRemaining=included_remaining,
            includedTotal=included_total,
            topUpBalance=top_up_balance,
            usedThisCycle=usage,
        ),
        currentPeriodEnd=entitlement.current_period_end,
        ok=True,
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


def _build_ai_charge_summary(
    context: ApiRequestContext,
    entitlement: EntitlementResolution,
) -> AiRunChargeSummary:
    is_enterprise_pool = context.workspace_kind == "enterprise_workspace"
    is_team_wallet = context.workspace_kind == "team_workspace"
    if is_enterprise_pool:
        charged_scope = "workspace_pool"
    elif is_team_wallet:
        charged_scope = "team_wallet"
    else:
        charged_scope = "actor_personal"
    charged_account_id = (
        entitlement.charged_account_id
        or (
            f"credit_workspace_{context.workspace_id}"
            if charged_scope in {"team_wallet", "workspace_pool"}
            else f"credit_user_{context.user_id}"
        )
    )
    workspace_seat_id = entitlement.workspace_seat_id
    if workspace_seat_id is None and context.workspace_kind == "team_workspace":
        workspace_seat_id = f"seat_{context.workspace_id}_{context.user_id}"
    return AiRunChargeSummary(
        chargedAccountId=charged_account_id,
        chargedScope=charged_scope,
        entitlementSource=_entitlement_source(context.workspace_kind),
        payerLabel=_payer_label(charged_scope),
        planKey=entitlement.plan_key,
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


def build_plan_summary(plan_key: str, included_credits_override: Optional[int] = None) -> WorkspacePlanSummary:
    spec = load_plan_spec(plan_key)
    return WorkspacePlanSummary(
        annualPriceUsd=spec.get("annual_price_usd"),
        billingPeriod=spec["billing_period"],
        boardLimit=spec.get("board_limit"),
        groupMemberLimit=spec.get("group_member_limit"),
        groupWorkspaceLimit=spec.get("group_workspace_limit"),
        includedCredits=int(included_credits_override if included_credits_override is not None else spec["included_credits"] or 0),
        monthlyPriceUsd=spec["monthly_price_usd"],
        name=str(spec["name"]),
        pageLimit=spec.get("page_limit"),
        planKey=plan_key,
        registrationCredits=int(spec.get("registration_credits") or 0),
        seatMax=spec.get("seat_max"),
        seatMin=spec.get("seat_min"),
        seatRange=spec["seat_range"],
    )


def resolve_plan_key(workspace_kind: str, workspace_plan_key: Optional[str] = None) -> str:
    if workspace_plan_key and _is_plan_key_allowed_for_workspace_kind(workspace_plan_key, workspace_kind):
        return workspace_plan_key
    if workspace_kind == "group_workspace":
        return "collaborate_start"
    if workspace_kind == "team_workspace":
        return "team_start"
    if workspace_kind == "enterprise_workspace":
        return "enterprise"
    return "free_canvas"


def resolve_entitlement(context: ApiRequestContext) -> EntitlementResolution:
    database_resolution = _resolve_database_entitlement(context)
    if database_resolution:
        return database_resolution
    return EntitlementResolution(
        charged_account_id=None,
        current_period_end=None,
        included_credits_override=None,
        plan_key=resolve_plan_key(context.workspace_kind, context.workspace_plan_key),
        workspace_seat_id=None,
    )


def can_see_team_member_usage(context: ApiRequestContext) -> bool:
    return context.workspace_kind == "team_workspace" and context.workspace_role in {"owner", "admin"}


def update_workspace_member_role(user_id: str, role: str, context: ApiRequestContext) -> WorkspaceDashboardMember:
    _assert_can_manage_workspace_members(context)
    normalized_user_id = _normalize_id(user_id, "user id")
    normalized_role = _normalize_workspace_role(role)
    require_database_url()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            current_member = _load_workspace_member_row(cursor, context.workspace_id, normalized_user_id)
            if current_member is None:
                raise HTTPException(status_code=404, detail="Workspace member not found.")
            current_role = str(current_member[3])
            _assert_role_mutation_allowed(context.workspace_role, normalized_user_id, context.user_id, current_role, normalized_role)
            cursor.execute(
                """
                UPDATE tangent_workspace_members
                SET role = %s
                WHERE workspace_id = %s
                  AND user_id = %s
                """,
                (
                    normalized_role,
                    context.workspace_id,
                    normalized_user_id,
                ),
            )
            row = _load_workspace_member_row(cursor, context.workspace_id, normalized_user_id)
        connection.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace member not found.")
    usage_by_user = _load_workspace_usage_map(context.workspace_id) if can_see_team_member_usage(context) else {}
    return _workspace_dashboard_member_from_row(row, usage_by_user.get(normalized_user_id), can_see_team_member_usage(context))


def _entitlement_source(workspace_kind: str) -> str:
    if workspace_kind == "team_workspace":
        return "team_wallet"
    if workspace_kind == "group_workspace":
        return "personal_collaborate_balance"
    if workspace_kind == "enterprise_workspace":
        return "enterprise_contract"
    return "personal_topup_or_free"


def _payer_label(charged_scope: str) -> str:
    if charged_scope == "team_wallet":
        return "Charges Team wallet"
    if charged_scope == "workspace_pool":
        return "Charges enterprise workspace credits"
    return "Charges your credits"


def _demo_usage_for_user(user_id: str, included_total: int) -> int:
    if included_total <= 0:
        return 0
    return min(included_total, 120 + (sum(ord(char) for char in user_id) % 380))


def _usage_from_reason_totals(reason_totals: dict[str, float]) -> int:
    charged = float(reason_totals.get("usage_charge", 0) or 0)
    refunded = float(reason_totals.get("usage_refund", 0) or 0)
    return max(0, int(round(-(charged + refunded))))


def _assert_can_manage_workspace_members(context: ApiRequestContext) -> None:
    if context.workspace_kind not in {"group_workspace", "team_workspace", "enterprise_workspace"}:
        raise HTTPException(status_code=403, detail="Workspace member management is unavailable for this workspace.")
    if context.workspace_role not in {"admin", "owner"}:
        raise HTTPException(status_code=403, detail="Workspace role cannot manage workspace members.")


def _normalize_id(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized or not ID_PATTERN.match(normalized) or ".." in normalized:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return normalized


def _normalize_workspace_role(value: str) -> str:
    normalized = value.strip()
    if normalized not in {"admin", "editor", "viewer", "guest", "member"}:
        raise HTTPException(status_code=400, detail="Invalid workspace role.")
    return normalized


def _optional_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _resolve_database_entitlement(context: ApiRequestContext) -> Optional[EntitlementResolution]:
    if not os.getenv("DATABASE_URL"):
        return None
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            if context.workspace_kind == "team_workspace":
                cursor.execute(
                    """
                    SELECT plan_key, seat_capacity, current_period_end
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
                        current_period_end=_optional_iso(subscription_row[2]),
                        included_credits_override=int(seat_row[2] or 0),
                        plan_key=str(seat_row[1]),
                        workspace_seat_id=str(seat_row[0]),
                    )
                raise HTTPException(status_code=402, detail="Active Team seat is required to use Team wallet.")
            owner_type = "workspace" if context.workspace_kind == "enterprise_workspace" else "user"
            owner_id = context.workspace_id if owner_type == "workspace" else context.user_id
            cursor.execute(
                """
                SELECT ca.id, s.plan_key, s.current_period_end
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
    if subscription_row and _is_plan_key_allowed_for_workspace_kind(str(subscription_row[1]), context.workspace_kind):
        return EntitlementResolution(
            charged_account_id=str(subscription_row[0]),
            current_period_end=_optional_iso(subscription_row[2]),
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
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT wm.user_id,
                       u.email,
                       COALESCE(wm.display_name, u.display_name, u.email),
                       wm.role,
                       wm.joined_at,
                       wm.invited_by
                FROM tangent_workspace_members wm
                LEFT JOIN tangent_users u ON u.id = wm.user_id
                WHERE wm.workspace_id = %s
                ORDER BY CASE wm.role
                    WHEN 'owner' THEN 0
                    WHEN 'admin' THEN 1
                    WHEN 'editor' THEN 2
                    WHEN 'member' THEN 3
                    WHEN 'viewer' THEN 4
                    WHEN 'guest' THEN 5
                    ELSE 6
                END,
                wm.joined_at ASC
                LIMIT %s
                """,
                (context.workspace_id, WORKSPACE_DASHBOARD_MEMBER_LIMIT),
            )
            rows = cursor.fetchall()[:WORKSPACE_DASHBOARD_MEMBER_LIMIT]
    if not rows:
        usage_by_user = _load_workspace_usage_map(context.workspace_id, [context.user_id]) if can_see_member_usage else {}
        return [_context_workspace_dashboard_member(context, can_see_member_usage, usage_by_user.get(context.user_id, 0))]
    member_user_ids = [str(row[0]) for row in rows if row[0] not in (None, "")]
    usage_by_user = _load_workspace_usage_map(context.workspace_id, member_user_ids) if can_see_member_usage else {}
    return [
        _workspace_dashboard_member_from_row(row, usage_by_user.get(str(row[0])), can_see_member_usage)
        for row in rows
    ]


def _context_workspace_dashboard_member(
    context: ApiRequestContext,
    can_see_member_usage: bool,
    usage: int = 0,
) -> WorkspaceDashboardMember:
    return WorkspaceDashboardMember(
        displayName=context.user_display_name,
        email=context.user_email,
        invitedBy=None,
        joinedAt=None,
        role=context.workspace_role,
        usageThisCycle=usage if can_see_member_usage else None,
        userId=context.user_id,
    )


def _demo_workspace_dashboard_member(
    context: ApiRequestContext,
    can_see_member_usage: bool,
) -> WorkspaceDashboardMember:
    entitlement = resolve_entitlement(context)
    usage = _demo_usage_for_user(
        context.user_id,
        build_plan_summary(entitlement.plan_key, entitlement.included_credits_override).included_credits,
    )
    return _context_workspace_dashboard_member(context, can_see_member_usage, usage)


def _load_workspace_usage_map(workspace_id: str, user_ids: Optional[list[str]] = None) -> dict[str, int]:
    if not os.getenv("DATABASE_URL"):
        return {}
    normalized_user_ids = sorted({user_id for user_id in (user_ids or []) if user_id})
    user_filter = "AND actor_user_id = ANY(%s)" if normalized_user_ids else ""
    params: tuple[object, ...] = (workspace_id, normalized_user_ids) if normalized_user_ids else (workspace_id,)
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT actor_user_id,
                       COALESCE(SUM(CASE WHEN credits_delta < 0 THEN -credits_delta ELSE 0 END), 0)
                FROM tangent_credit_ledger
                WHERE workspace_id = %s
                  AND actor_user_id IS NOT NULL
                  {user_filter}
                GROUP BY actor_user_id
                """,
                params,
            )
            rows = cursor.fetchall()
    allowed = set(normalized_user_ids)
    return {
        str(row[0]): int(float(row[1] or 0))
        for row in rows
        if not allowed or str(row[0]) in allowed
    }


def _workspace_dashboard_member_from_row(
    row: tuple[object, ...],
    usage_this_cycle: Optional[int],
    can_see_member_usage: bool,
) -> WorkspaceDashboardMember:
    return WorkspaceDashboardMember(
        displayName=str(row[2] or row[1] or row[0]),
        email=str(row[1]) if row[1] else None,
        invitedBy=str(row[5]) if len(row) > 5 and row[5] else None,
        joinedAt=_optional_iso(row[4]) if len(row) > 4 else None,
        role=str(row[3]),
        usageThisCycle=usage_this_cycle if can_see_member_usage else None,
        userId=str(row[0]),
    )


def _load_workspace_member_row(cursor: object, workspace_id: str, user_id: str) -> Optional[tuple[object, ...]]:
    cursor.execute(
        """
        SELECT wm.user_id,
               u.email,
               COALESCE(wm.display_name, u.display_name, u.email),
               wm.role,
               wm.joined_at,
               wm.invited_by
        FROM tangent_workspace_members wm
        LEFT JOIN tangent_users u ON u.id = wm.user_id
        WHERE wm.workspace_id = %s
          AND wm.user_id = %s
        LIMIT 1
        """,
        (workspace_id, user_id),
    )
    return cursor.fetchone()


def _assert_role_mutation_allowed(
    actor_role: str,
    target_user_id: str,
    actor_user_id: str,
    current_role: str,
    next_role: str,
) -> None:
    if current_role == "owner":
        raise HTTPException(status_code=400, detail="Owner role cannot be changed here.")
    if target_user_id == actor_user_id and current_role == "admin" and next_role != "admin":
        raise HTTPException(status_code=400, detail="Admins cannot demote themselves.")
    if actor_role != "owner":
        if next_role == "admin":
            raise HTTPException(status_code=403, detail="Only owners can grant admin role.")
        if current_role == "admin":
            raise HTTPException(status_code=403, detail="Only owners can change another admin role.")


def _is_plan_key_allowed_for_workspace_kind(plan_key: str, workspace_kind: str) -> bool:
    if workspace_kind == "group_workspace":
        return plan_key in {"collaborate_start", "collaborate_plus"}
    if workspace_kind == "team_workspace":
        return plan_key in {"team_start", "team_growth"}
    if workspace_kind == "enterprise_workspace":
        return plan_key == "enterprise"
    return plan_key == "free_canvas"


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
