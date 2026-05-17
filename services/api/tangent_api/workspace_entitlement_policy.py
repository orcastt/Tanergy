from datetime import datetime, timedelta, timezone
from typing import Optional

from tangent_api.plan_catalog import load_plan_spec
from tangent_api.request_context import ApiRequestContext
from tangent_api.workspace_schemas import BillingWorkspaceSummary, WorkspacePlanSummary


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
    if workspace_plan_key and is_plan_key_allowed_for_workspace_kind(workspace_plan_key, workspace_kind):
        return workspace_plan_key
    if workspace_kind == "group_workspace":
        return "free_canvas"
    if workspace_kind == "team_workspace":
        return "team_start"
    if workspace_kind == "enterprise_workspace":
        return "enterprise"
    return "free_canvas"


def entitlement_source(workspace_kind: str) -> str:
    if workspace_kind == "team_workspace":
        return "team_wallet"
    if workspace_kind == "group_workspace":
        return "personal_collaborate_balance"
    if workspace_kind == "enterprise_workspace":
        return "enterprise_contract"
    return "personal_topup_or_free"


def payer_label(charged_scope: str) -> str:
    if charged_scope == "team_wallet":
        return "Charges Team wallet"
    if charged_scope == "workspace_pool":
        return "Charges enterprise workspace credits"
    return "Charges your credits"


def demo_usage_for_user(user_id: str, included_total: int) -> int:
    if included_total <= 0:
        return 0
    return min(included_total, 120 + (sum(ord(char) for char in user_id) % 380))


def usage_from_reason_totals(reason_totals: dict[str, float]) -> int:
    charged = float(reason_totals.get("usage_charge", 0) or 0)
    refunded = float(reason_totals.get("usage_refund", 0) or 0)
    return max(0, int(round(-(charged + refunded))))


def optional_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def resolve_billing_interval(
    current_period_start: Optional[str],
    current_period_end: Optional[str],
    billing_period: str,
) -> Optional[str]:
    if billing_period == "none":
        return "none"
    if billing_period == "contract":
        return "contract"
    start = parse_datetime(current_period_start)
    end = parse_datetime(current_period_end)
    if not start or not end:
        return "monthly"
    return "annual" if (end - start) > timedelta(days=45) else "monthly"


def resolve_next_refresh_at(
    current_period_start: Optional[str],
    current_period_end: Optional[str],
    billing_interval: Optional[str],
) -> Optional[str]:
    if billing_interval in {None, "none", "contract"}:
        return None
    start = parse_datetime(current_period_start)
    end = parse_datetime(current_period_end)
    if not start or not end:
        return current_period_end if billing_interval == "monthly" else None
    if billing_interval == "monthly":
        return end.isoformat()

    step = timedelta(days=30)
    now = datetime.now(timezone.utc)
    next_refresh = start + step
    while next_refresh <= now and next_refresh < end:
        next_refresh += step
    if next_refresh > end:
        next_refresh = end
    return next_refresh.isoformat()


def is_plan_key_allowed_for_workspace_kind(plan_key: str, workspace_kind: str) -> bool:
    if workspace_kind == "group_workspace":
        return plan_key in {"free_canvas", "collaborate_start", "collaborate_plus"}
    if workspace_kind == "team_workspace":
        return plan_key in {"team_start", "team_growth"}
    if workspace_kind == "enterprise_workspace":
        return plan_key == "enterprise"
    return plan_key == "free_canvas"


def parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed.astimezone(timezone.utc)
