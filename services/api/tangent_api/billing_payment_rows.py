from tangent_api.billing_payment_schemas import BillingPaymentRecord


def payment_from_row(row: tuple[object, ...]) -> BillingPaymentRecord:
    return BillingPaymentRecord(
        accountId=row[1],
        amountCents=int(row[4] or 0),
        checkoutSessionId=row[8],
        createdAt=_to_iso(row[7]),
        currency=str(row[5] or "usd"),
        id=str(row[0]),
        kind=str(row[9] or "topup"),
        metadata=dict(row[10] or {}),
        provider=str(row[2] or "manual_test"),
        providerPaymentId=row[3],
        status=str(row[6] or "pending"),
    )


def _to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
