from typing import Optional

from tangent_api.admin_finance_schemas import (
    AdminFinanceAccountCountRecord,
    AdminFinanceCountRecord,
    AdminFinanceLedgerRecord,
    AdminFinanceMemberUsageRecord,
    AdminFinancePaymentRecord,
    AdminFinanceSubscriptionCountRecord,
    AdminFinanceSubscriptionRecord,
    AdminFinanceWalletRecord,
)


def count_from_row(row: tuple[object, ...]) -> AdminFinanceCountRecord:
    return AdminFinanceCountRecord(key=str(row[0] or "unknown"), count=as_int(row[1]), amountCents=as_int(row[2]))


def account_count_from_row(row: tuple[object, ...]) -> AdminFinanceAccountCountRecord:
    return AdminFinanceAccountCountRecord(
        accountKind=str(row[1] or "personal_wallet"),
        count=as_int(row[3]),
        ownerType=str(row[0] or "unknown"),
        status=str(row[2] or "unknown"),
    )


def subscription_count_from_row(row: tuple[object, ...]) -> AdminFinanceSubscriptionCountRecord:
    return AdminFinanceSubscriptionCountRecord(
        count=as_int(row[2]),
        planFamily=str(row[0] or "unknown"),
        seatCapacity=as_int(row[3]),
        status=str(row[1] or "unknown"),
    )


def payment_from_row(row: tuple[object, ...]) -> AdminFinancePaymentRecord:
    return AdminFinancePaymentRecord(
        accountId=row[1],
        accountKind=row[4],
        amountCents=as_int(row[7]),
        checkoutSessionId=row[11],
        createdAt=to_iso(row[10]),
        currency=str(row[8] or "usd"),
        id=str(row[0]),
        kind=str(row[12] or "topup"),
        metadata=as_dict(row[13]),
        ownerId=row[3],
        ownerType=row[2],
        provider=str(row[5] or "manual_test"),
        providerPaymentId=row[6],
        status=str(row[9] or "pending"),
    )


def wallet_from_row(row: tuple[object, ...]) -> AdminFinanceWalletRecord:
    return AdminFinanceWalletRecord(
        accountId=str(row[0]),
        accountKind=str(row[3] or "personal_wallet"),
        balanceCredits=as_float(row[7]),
        createdAt=to_iso(row[5]),
        ownerId=str(row[2]),
        ownerType=str(row[1]),
        status=str(row[4] or "active"),
        updatedAt=to_iso(row[6]),
    )


def ledger_from_row(row: tuple[object, ...]) -> AdminFinanceLedgerRecord:
    return AdminFinanceLedgerRecord(
        accountId=str(row[1]),
        accountKind=row[4],
        actorUserId=row[6],
        createdAt=to_iso(row[12]),
        creditsDelta=as_float(row[9]),
        id=str(row[0]),
        metadata=as_dict(row[11]),
        ownerId=row[3],
        ownerType=row[2],
        reason=str(row[10]),
        sourceId=row[8],
        sourceType=str(row[7]),
        workspaceId=row[5],
    )


def subscription_from_row(row: tuple[object, ...]) -> AdminFinanceSubscriptionRecord:
    return AdminFinanceSubscriptionRecord(
        accountId=str(row[1]),
        createdAt=to_iso(row[14]),
        currentPeriodEnd=optional_iso(row[13]),
        currentPeriodStart=optional_iso(row[12]),
        id=str(row[0]),
        ownerId=str(row[3]),
        ownerType=str(row[2]),
        planFamily=str(row[5] or "free"),
        planKey=str(row[6]),
        provider=str(row[7]),
        providerCustomerId=row[8],
        providerSubscriptionId=row[9],
        seatCapacity=as_int(row[11]),
        status=str(row[10]),
        updatedAt=to_iso(row[15]),
        workspaceId=row[4],
    )


def member_usage_from_row(row: tuple[object, ...]) -> AdminFinanceMemberUsageRecord:
    return AdminFinanceMemberUsageRecord(
        chargeCount=as_int(row[6]),
        displayName=str(row[3] or row[1]),
        email=row[2],
        lastUsageAt=optional_iso(row[7]),
        role=str(row[4]),
        usageCredits=as_float(row[5]),
        userId=str(row[1]),
        workspaceId=str(row[0]),
    )


def as_float(value: object) -> float:
    return float(value or 0)


def as_int(value: object) -> int:
    return int(value or 0)


def as_dict(value: object) -> dict[str, object]:
    return value if isinstance(value, dict) else {}


def to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def optional_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    return to_iso(value)
