from typing import Optional

from tangent_api.admin_operator_rows import to_iso
from tangent_api.admin_operator_schemas import AdminOperatorBillingHistoryRow


def payment_history_from_row(row: tuple[object, ...]) -> AdminOperatorBillingHistoryRow:
    metadata = _dict(row[9])
    workspace_id = _as_optional_str(row[13])
    return AdminOperatorBillingHistoryRow(
        amountCents=int(row[1] or 0),
        createdAt=to_iso(row[4]) or "",
        id=str(row[0]),
        item=_payment_item_label(str(row[5] or "topup"), metadata),
        metadata={
            **metadata,
            "accountKind": str(row[12] or "personal_wallet"),
            "currency": str(row[2] or "usd"),
            "entryType": "payment",
            "ownerId": _as_optional_str(row[11]),
            "ownerType": str(row[10] or "user"),
            "paymentKind": str(row[5] or "topup"),
            "provider": str(row[6] or "manual_test"),
            "providerPaymentId": _as_optional_str(row[7]),
            "status": str(row[3] or "pending"),
            "workspaceName": _as_optional_str(row[14]),
        },
        personalCreditsDelta=0,
        reason=_payment_reason(metadata),
        teamCreditsDelta=0,
        workspaceId=workspace_id,
    )


def ledger_history_from_row(row: tuple[object, ...]) -> AdminOperatorBillingHistoryRow:
    owner_type = str(row[4] or "user")
    metadata = _dict(row[9])
    credits_delta = float(row[2] or 0)
    workspace_id = _as_optional_str(row[3]) or (_as_optional_str(row[5]) if owner_type == "workspace" else None)
    return AdminOperatorBillingHistoryRow(
        amountCents=None,
        createdAt=to_iso(row[8]) or "",
        id=str(row[0]),
        item=_ledger_item_label(str(row[1] or "ledger"), metadata),
        metadata={
            **metadata,
            "accountKind": str(row[6] or "personal_wallet"),
            "entryType": "ledger",
            "ownerId": _as_optional_str(row[5]),
            "ownerType": owner_type,
            "sourceId": _as_optional_str(row[11]),
            "sourceType": str(row[10] or "unknown"),
            "workspaceName": _as_optional_str(row[7]),
        },
        personalCreditsDelta=credits_delta if owner_type == "user" else 0,
        reason=_ledger_reason(str(row[1] or "ledger"), metadata),
        teamCreditsDelta=credits_delta if owner_type == "workspace" else 0,
        workspaceId=workspace_id,
    )


def subscription_history_from_row(row: tuple[object, ...]) -> AdminOperatorBillingHistoryRow:
    workspace_id = _as_optional_str(row[9]) or (_as_optional_str(row[12]) if str(row[11] or "user") == "workspace" else None)
    period_start = to_iso(row[5])
    period_end = to_iso(row[6])
    return AdminOperatorBillingHistoryRow(
        amountCents=None,
        createdAt=to_iso(row[8]) or to_iso(row[7]) or "",
        id=str(row[0]),
        item=_plan_label(str(row[2] or row[1] or "subscription")),
        metadata={
            "entryType": "subscription",
            "ownerId": _as_optional_str(row[12]),
            "ownerType": str(row[11] or "user"),
            "planFamily": str(row[1] or "free"),
            "planKey": str(row[2] or "free"),
            "provider": str(row[13] or "manual_test"),
            "providerSubscriptionId": _as_optional_str(row[14]),
            "seatCapacity": int(row[4] or 0),
            "status": str(row[3] or "inactive"),
            "workspaceName": _as_optional_str(row[10]),
        },
        personalCreditsDelta=0,
        reason=_period_text(period_start, period_end),
        teamCreditsDelta=0,
        workspaceId=workspace_id,
    )


def audit_history_from_row(row: tuple[object, ...]) -> AdminOperatorBillingHistoryRow:
    metadata = _dict(row[2])
    return AdminOperatorBillingHistoryRow(
        amountCents=None,
        createdAt=to_iso(row[3]) or "",
        id=str(row[0]),
        item=_audit_item_label(str(row[1] or "audit")),
        metadata={
            **metadata,
            "entryType": "audit",
            "status": _audit_status(metadata),
            "workspaceName": _as_optional_str(row[5]),
        },
        personalCreditsDelta=0,
        reason=_audit_reason(str(row[1] or "audit"), metadata),
        teamCreditsDelta=0,
        workspaceId=_as_optional_str(row[4]),
    )


def _payment_item_label(kind: str, metadata: dict[str, object]) -> str:
    labels = {
        "collaborate_subscription": "Collaborate Payment",
        "seat_purchase": "Seat Purchase",
        "team_subscription": "Team Payment",
        "topup": "Personal Top-up Payment",
        "workspace_topup": "Team Wallet Payment",
    }
    return labels.get(kind, _humanize(kind or metadata.get("planKey") or "payment"))


def _ledger_item_label(reason: str, metadata: dict[str, object]) -> str:
    labels = {
        "admin_adjustment": "Admin adjustment",
        "subscription_grant": f"{_plan_label(str(metadata.get('planKey') or 'included credits'))} grant",
        "topup_purchase": "Credit top-up",
        "usage_charge": "AI usage",
        "usage_refund": "Usage refund",
    }
    return labels.get(reason, _humanize(reason or "ledger"))


def _payment_reason(metadata: dict[str, object]) -> str:
    note = _note(metadata)
    if note:
        return note
    if metadata.get("teamName"):
        return str(metadata["teamName"])
    if metadata.get("planKey"):
        return _plan_label(str(metadata["planKey"]))
    if metadata.get("credits") not in (None, ""):
        return f"{_compact_number(metadata['credits'])} credits"
    if metadata.get("quantity") not in (None, ""):
        return f"{metadata['quantity']} seats"
    return ""


def _ledger_reason(reason: str, metadata: dict[str, object]) -> str:
    note = _note(metadata)
    if note:
        return note
    if reason == "subscription_grant" and metadata.get("seatCapacity") not in (None, ""):
        return f"{metadata['seatCapacity']} seats"
    if reason in {"usage_charge", "usage_refund"} and metadata.get("runId"):
        return str(metadata["runId"])
    return ""


def _audit_item_label(action: str) -> str:
    labels = {
        "admin.finance.manual.collaborate_plan": "Collaborate plan updated",
        "admin.finance.manual.group_workspace_create": "Group created",
        "admin.finance.manual.subscription_cancel": "Subscription deleted",
        "admin.finance.manual.team_plan": "Team plan updated",
        "admin.finance.manual.team_workspace_create": "Team created",
        "admin.finance.manual.user_credit_adjust": "Personal credits adjusted",
        "admin.finance.manual.user_topup": "Personal credits topped up",
        "admin.finance.manual.workspace_credit_adjust": "Team credits adjusted",
        "admin.finance.manual.workspace_delete": "Workspace deleted",
        "admin.finance.manual.workspace_topup": "Team credits topped up",
        "admin.operator.subscription.freeze": "Subscription frozen",
        "admin.operator.subscription.unfreeze": "Subscription resumed",
        "admin.operator.user.delete": "User deleted",
        "admin.operator.user.status": "User status updated",
        "admin.operator.workspace_member.remove": "Member removed",
        "admin.operator.workspace_member.role": "Member role updated",
    }
    return labels.get(action, _humanize(action.split(".")[-1] if "." in action else action))


def _audit_reason(action: str, metadata: dict[str, object]) -> str:
    note = _note(metadata)
    if note:
        return note
    if action == "admin.operator.workspace_member.role":
        previous_role = _as_optional_str(metadata.get("previousRole"))
        new_role = _as_optional_str(metadata.get("newRole"))
        if previous_role and new_role:
            return f"{previous_role} -> {new_role}"
    return ""


def _audit_status(metadata: dict[str, object]) -> str:
    return _as_optional_str(metadata.get("status")) or _as_optional_str(metadata.get("newRole")) or ""


def _plan_label(value: str) -> str:
    return _humanize(value)


def _period_text(period_start: Optional[str], period_end: Optional[str]) -> str:
    if not period_start and not period_end:
        return ""
    if period_start and period_end:
        return f"{period_start[:10]} to {period_end[:10]}"
    return (period_start or period_end or "")[:10]


def _humanize(value: object) -> str:
    return " ".join(str(value or "").replace(".", " ").replace("_", " ").split()).title() or "-"


def _note(metadata: dict[str, object]) -> str:
    return _as_optional_str(metadata.get("note")) or _as_optional_str(metadata.get("reason")) or ""


def _compact_number(value: object) -> str:
    amount = float(value or 0)
    return str(int(amount)) if amount.is_integer() else f"{amount:.2f}".rstrip("0").rstrip(".")


def _dict(value: object) -> dict[str, object]:
    return dict(value) if isinstance(value, dict) else {}


def _as_optional_str(value: object) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
