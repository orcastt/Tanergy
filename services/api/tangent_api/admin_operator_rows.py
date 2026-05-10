from typing import Optional

from tangent_api.admin_operator_schemas import (
    AdminOperatorCreditSummary,
    AdminOperatorUserPlan,
    AdminOperatorUserRow,
    AdminOperatorWorkspacePlan,
)


def user_from_row(row: tuple[object, ...]) -> AdminOperatorUserRow:
    last_login_at = to_iso(row[5])
    return AdminOperatorUserRow(
        createdAt=to_iso(row[4]) or "",
        displayName=str(row[2] or ""),
        email=str(row[1] or ""),
        id=str(row[0]),
        ipAddress=text_or_none(row[7]),
        lastLoginAt=last_login_at,
        personalCredit=empty_credit(),
        registrationState=registration_state_from_values(email_verified=bool(row[6]), last_login_at=last_login_at),
        status=str(row[3] or "active"),
        totalCreditsSpent=0,
    )


def workspace_from_row(
    row: tuple[object, ...],
    *,
    role_index: Optional[int] = None,
    usage_index: Optional[int] = None,
) -> AdminOperatorWorkspacePlan:
    return AdminOperatorWorkspacePlan(
        boardCount=int(row[16] or 0),
        createdAt=to_iso(row[5]) or "",
        credit=credit_from_values(row[17], row[18]),
        id=str(row[0]),
        kind=str(row[2] or "solo_workspace"),
        memberCount=int(row[15] or 0),
        ownerEmail=str(row[4] or ""),
        ownerId=str(row[3]) if row[3] is not None else None,
        pauseReason=text_or_none(row[14]),
        pausedAt=to_iso(row[12]),
        pausedBy=text_or_none(row[13]),
        periodEnd=to_iso(row[11]),
        periodStart=to_iso(row[10]),
        planKey=row[7],
        planStatus=row[8],
        role=str(row[role_index]) if role_index is not None and row[role_index] is not None else None,
        seatCapacity=int(row[9] or 0),
        subscriptionId=row[6],
        usageByUser=float(row[usage_index] or 0) if usage_index is not None else 0,
        workspaceName=str(row[1] or "Untitled workspace"),
    )


def user_plan_from_row(row: tuple[object, ...]) -> AdminOperatorUserPlan:
    return AdminOperatorUserPlan(
        pauseReason=text_or_none(row[7]),
        pausedAt=to_iso(row[5]),
        pausedBy=text_or_none(row[6]),
        periodEnd=to_iso(row[4]),
        periodStart=to_iso(row[3]),
        planKey=str(row[1] or "free"),
        status=str(row[2] or "inactive"),
        subscriptionId=str(row[0]),
    )

def credit_from_values(balance: object, spent: object) -> AdminOperatorCreditSummary:
    remaining = float(balance or 0)
    used = float(spent or 0)
    return AdminOperatorCreditSummary(remainingCredits=remaining, spentCredits=used, totalCredits=remaining + used)


def empty_credit() -> AdminOperatorCreditSummary:
    return AdminOperatorCreditSummary(remainingCredits=0, spentCredits=0, totalCredits=0)


def to_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def registration_state_from_values(*, email_verified: bool, last_login_at: Optional[str]) -> str:
    if email_verified:
        return "verified"
    if last_login_at:
        return "registered"
    return "pending_verification"


def text_or_none(value: object) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    return text or None
