import os
import re
from dataclasses import dataclass
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.ai_schemas import AiRunChargeSummary
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.workspace_schemas import (
    BillingMeResponse,
    BillingWorkspaceSummary,
    PersonalCreditSummary,
    WorkspaceSeatAssignmentRecord,
    WorkspaceSeatAssignmentUpsertRequest,
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
    "collaborate_plus": {
        "billing_period": "monthly_or_annual",
        "included_credits": 2000,
        "monthly_price_usd": 25,
        "name": "Collaborate Plus",
        "seat_range": "1+ users",
    },
    "team_start": {
        "billing_period": "monthly_or_annual",
        "included_credits": 2500,
        "monthly_price_usd": 25,
        "name": "Team Start",
        "seat_range": "2-15 seats",
    },
    "team_growth": {
        "billing_period": "monthly_or_annual",
        "included_credits": 5500,
        "monthly_price_usd": 45,
        "name": "Team Growth",
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

ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


@dataclass(frozen=True)
class EntitlementResolution:
    charged_account_id: Optional[str]
    included_credits_override: Optional[int]
    plan_key: str
    workspace_seat_id: Optional[str] = None


def build_billing_me_response(context: ApiRequestContext) -> BillingMeResponse:
    entitlement = resolve_entitlement(context)
    plan = build_plan_summary(entitlement.plan_key, entitlement.included_credits_override)
    charge = _build_ai_charge_summary(context, entitlement)
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
    entitlement = resolve_entitlement(context)
    usage = _mock_usage_for_user(context.user_id, build_plan_summary(entitlement.plan_key, entitlement.included_credits_override).included_credits)
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
    charged_scope = "workspace_pool" if is_enterprise_pool else "actor_personal"
    charged_account_id = (
        entitlement.charged_account_id
        or (
            f"credit_workspace_{context.workspace_id}"
            if charged_scope == "workspace_pool"
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
        payerLabel="Charges enterprise workspace credits" if is_enterprise_pool else "Charges your credits",
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
    spec = PLAN_CATALOG.get(plan_key, PLAN_CATALOG["free_canvas"])
    return WorkspacePlanSummary(
        billingPeriod=spec["billing_period"],
        includedCredits=int(included_credits_override if included_credits_override is not None else spec["included_credits"] or 0),
        monthlyPriceUsd=spec["monthly_price_usd"],
        name=str(spec["name"]),
        planKey=plan_key,
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
        included_credits_override=None,
        plan_key=resolve_plan_key(context.workspace_kind, context.workspace_plan_key),
        workspace_seat_id=None,
    )


def can_see_team_member_usage(context: ApiRequestContext) -> bool:
    return context.workspace_kind == "team_workspace" and context.workspace_role in {"owner", "admin"}


def list_workspace_seat_assignments(context: ApiRequestContext) -> list[WorkspaceSeatAssignmentRecord]:
    _assert_can_manage_team_seats(context)
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, workspace_id, user_id, plan_key, status, included_credits,
                       current_period_start, current_period_end, assigned_by
                FROM tangent_workspace_seat_assignments
                WHERE workspace_id = %s
                  AND status <> 'revoked'
                ORDER BY updated_at DESC
                """,
                (context.workspace_id,),
            )
            rows = cursor.fetchall()
    return [_seat_assignment_from_row(row) for row in rows]


def upsert_workspace_seat_assignment(
    input_data: WorkspaceSeatAssignmentUpsertRequest,
    context: ApiRequestContext,
) -> WorkspaceSeatAssignmentRecord:
    _assert_can_manage_team_seats(context)
    require_database_url()
    user_id = _normalize_id(input_data.user_id, "user id")
    plan_key = _normalize_team_plan_key(input_data.plan_key)
    included_credits = input_data.included_credits
    if included_credits is None:
        included_credits = int(PLAN_CATALOG[plan_key]["included_credits"] or 0)
    if included_credits < 0:
        raise HTTPException(status_code=400, detail="Included credits must be non-negative.")

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            _assert_active_workspace_member(cursor, context.workspace_id, user_id)
            _ensure_user_credit_account(cursor, user_id)
            seat_id = f"seat_{uuid4()}"
            cursor.execute(
                """
                UPDATE tangent_workspace_seat_assignments
                SET status = 'revoked',
                    updated_at = NOW()
                WHERE workspace_id = %s
                  AND user_id = %s
                  AND plan_key <> %s
                  AND status <> 'revoked'
                """,
                (context.workspace_id, user_id, plan_key),
            )
            cursor.execute(
                """
                INSERT INTO tangent_workspace_seat_assignments (
                    id,
                    workspace_id,
                    user_id,
                    plan_key,
                    status,
                    included_credits,
                    current_period_start,
                    current_period_end,
                    assigned_by
                )
                VALUES (%s, %s, %s, %s, 'active', %s, %s, %s, %s)
                ON CONFLICT (workspace_id, user_id, plan_key)
                DO UPDATE SET
                    status = 'active',
                    included_credits = EXCLUDED.included_credits,
                    current_period_start = EXCLUDED.current_period_start,
                    current_period_end = EXCLUDED.current_period_end,
                    assigned_by = EXCLUDED.assigned_by,
                    updated_at = NOW()
                RETURNING id, workspace_id, user_id, plan_key, status, included_credits,
                          current_period_start, current_period_end, assigned_by
                """,
                (
                    seat_id,
                    context.workspace_id,
                    user_id,
                    plan_key,
                    included_credits,
                    input_data.current_period_start,
                    input_data.current_period_end,
                    context.user_id,
                ),
            )
            row = cursor.fetchone()
        connection.commit()
    return _seat_assignment_from_row(row)


def revoke_workspace_seat_assignment(user_id: str, context: ApiRequestContext) -> str:
    _assert_can_manage_team_seats(context)
    require_database_url()
    normalized_user_id = _normalize_id(user_id, "user id")
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE tangent_workspace_seat_assignments
                SET status = 'revoked',
                    updated_at = NOW()
                WHERE workspace_id = %s
                  AND user_id = %s
                  AND status <> 'revoked'
                """,
                (context.workspace_id, normalized_user_id),
            )
        connection.commit()
    return normalized_user_id


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


def _assert_can_manage_team_seats(context: ApiRequestContext) -> None:
    if context.workspace_kind != "team_workspace":
        raise HTTPException(status_code=403, detail="Seat assignment is only available for Team workspaces.")
    if context.workspace_role not in {"admin", "owner"}:
        raise HTTPException(status_code=403, detail="Workspace role cannot manage team seats.")


def _assert_active_workspace_member(cursor: object, workspace_id: str, user_id: str) -> None:
    cursor.execute(
        """
        SELECT 1
        FROM tangent_workspace_members
        WHERE workspace_id = %s
          AND user_id = %s
          AND role IN ('owner', 'admin', 'member')
        LIMIT 1
        """,
        (workspace_id, user_id),
    )
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Workspace member not found.")


def _ensure_user_credit_account(cursor: object, user_id: str) -> str:
    account_id = f"credit_user_{user_id}"
    cursor.execute(
        """
        INSERT INTO tangent_credit_accounts (
            id,
            owner_type,
            owner_id,
            status
        )
        VALUES (%s, 'user', %s, 'active')
        ON CONFLICT (owner_type, owner_id)
        DO UPDATE SET
            status = 'active',
            updated_at = NOW()
        RETURNING id
        """,
        (account_id, user_id),
    )
    row = cursor.fetchone()
    return str(row[0]) if row else account_id


def _normalize_id(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized or not ID_PATTERN.match(normalized) or ".." in normalized:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return normalized


def _normalize_team_plan_key(value: str) -> str:
    normalized = value.strip()
    if normalized not in {"team_start", "team_growth"}:
        raise HTTPException(status_code=400, detail="Invalid team plan key.")
    return normalized


def _seat_assignment_from_row(row: tuple[object, ...]) -> WorkspaceSeatAssignmentRecord:
    return WorkspaceSeatAssignmentRecord(
        assignedBy=row[8],
        currentPeriodEnd=_optional_iso(row[7]),
        currentPeriodStart=_optional_iso(row[6]),
        id=str(row[0]),
        includedCredits=int(row[5] or 0),
        planKey=str(row[3]),
        status=str(row[4]),
        userId=str(row[2]),
        workspaceId=str(row[1]),
    )


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
                    return EntitlementResolution(
                        charged_account_id=_select_credit_account_id(cursor, "user", context.user_id),
                        included_credits_override=int(seat_row[2] or 0),
                        plan_key=str(seat_row[1]),
                        workspace_seat_id=str(seat_row[0]),
                    )
            owner_type = "workspace" if context.workspace_kind == "enterprise_workspace" else "user"
            owner_id = context.workspace_id if owner_type == "workspace" else context.user_id
            cursor.execute(
                """
                SELECT ca.id, s.plan_key
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
            included_credits_override=None,
            plan_key=str(subscription_row[1]),
            workspace_seat_id=None,
        )
    return None


def _is_plan_key_allowed_for_workspace_kind(plan_key: str, workspace_kind: str) -> bool:
    if workspace_kind == "group_workspace":
        return plan_key in {"collaborate_start", "collaborate_plus"}
    if workspace_kind == "team_workspace":
        return plan_key in {"team_start", "team_growth"}
    if workspace_kind == "enterprise_workspace":
        return plan_key == "enterprise"
    return plan_key == "free_canvas"


def _select_credit_account_id(cursor: object, owner_type: str, owner_id: str) -> Optional[str]:
    cursor.execute(
        """
        SELECT id
        FROM tangent_credit_accounts
        WHERE owner_type = %s
          AND owner_id = %s
          AND status = 'active'
        LIMIT 1
        """,
        (owner_type, owner_id),
    )
    row = cursor.fetchone()
    return str(row[0]) if row else None
