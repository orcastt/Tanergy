from typing import Optional
from urllib.parse import urlencode

from tangent_api.billing_payment_provider import (
    MANUAL_PAYMENT_PROVIDER,
    STRIPE_PAYMENT_PROVIDER,
    get_hosted_checkout_base_url,
    get_hosted_checkout_cancel_url,
    get_hosted_checkout_success_url,
    payment_provider_adapter,
)
from tangent_api.billing_payment_schemas import BillingCheckoutSessionRecord, BillingPaymentRecord
from tangent_api.billing_stripe_checkout import create_stripe_checkout_session


def build_checkout_session(payment: BillingPaymentRecord) -> BillingCheckoutSessionRecord:
    internal_session_id = str(payment.checkout_session_id or payment.id)
    adapter = payment_provider_adapter(payment.provider)
    metadata = _checkout_metadata(payment, internal_session_id, adapter)
    session_id, url = _provider_checkout_session(payment, metadata)
    if session_id != internal_session_id:
        metadata["providerCheckoutSessionId"] = session_id
    return BillingCheckoutSessionRecord(
        adapter=adapter,
        amountCents=payment.amount_cents,
        clientReferenceId=payment.id,
        currency=payment.currency,
        id=session_id,
        kind=payment.kind,
        metadata=metadata,
        mode="manual_test" if payment.provider == MANUAL_PAYMENT_PROVIDER else "hosted_redirect",
        provider=payment.provider,
        url=url,
    )


def _checkout_metadata(payment: BillingPaymentRecord, session_id: str, adapter: str) -> dict[str, str]:
    metadata = {
        "adapter": adapter,
        "amountCents": str(payment.amount_cents),
        "checkoutSessionId": session_id,
        "clientReferenceId": payment.id,
        "currency": payment.currency,
        "kind": payment.kind,
        "paymentId": payment.id,
        "provider": payment.provider,
    }
    success_url = get_hosted_checkout_success_url()
    cancel_url = get_hosted_checkout_cancel_url()
    if success_url:
        metadata["successUrl"] = success_url
    if cancel_url:
        metadata["cancelUrl"] = cancel_url
    return metadata


def _hosted_checkout_url(payment: BillingPaymentRecord, metadata: dict[str, str]) -> Optional[str]:
    if payment.provider == MANUAL_PAYMENT_PROVIDER:
        return None
    base_url = get_hosted_checkout_base_url()
    if not base_url:
        return None
    separator = "&" if "?" in base_url else "?"
    query_values = {
        "amount_cents": metadata["amountCents"],
        "client_reference_id": metadata["clientReferenceId"],
        "currency": metadata["currency"],
        "kind": metadata["kind"],
        "payment_id": metadata["paymentId"],
        "provider": metadata["provider"],
        "session_id": metadata["checkoutSessionId"],
    }
    if metadata.get("successUrl"):
        query_values["success_url"] = metadata["successUrl"]
    if metadata.get("cancelUrl"):
        query_values["cancel_url"] = metadata["cancelUrl"]
    query = urlencode(query_values)
    return f"{base_url}{separator}{query}"


def _provider_checkout_session(
    payment: BillingPaymentRecord,
    metadata: dict[str, str],
) -> tuple[str, Optional[str]]:
    internal_session_id = metadata["checkoutSessionId"]
    if payment.provider == STRIPE_PAYMENT_PROVIDER:
        return create_stripe_checkout_session(payment, metadata)
    return internal_session_id, _hosted_checkout_url(payment, metadata)
