import httpx
from fastapi import HTTPException

from tangent_api.billing_payment_provider import (
    get_hosted_checkout_cancel_url,
    get_hosted_checkout_success_url,
    get_stripe_secret_key,
)
from tangent_api.billing_payment_schemas import BillingPaymentRecord

STRIPE_CHECKOUT_SESSIONS_URL = "https://api.stripe.com/v1/checkout/sessions"


def create_stripe_checkout_session(
    payment: BillingPaymentRecord,
    metadata: dict[str, str],
) -> tuple[str, str]:
    secret_key = get_stripe_secret_key()
    success_url = get_hosted_checkout_success_url()
    if not secret_key or not success_url:
        raise HTTPException(status_code=501, detail="Stripe checkout is not configured.")
    payload = _stripe_checkout_payload(payment, metadata, success_url)
    try:
        response = httpx.post(
            STRIPE_CHECKOUT_SESSIONS_URL,
            auth=(secret_key, ""),
            data=payload,
            timeout=15,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail="Stripe checkout session request failed.") from exc
    if response.status_code >= 400:
        raise HTTPException(status_code=502, detail="Stripe checkout session creation failed.")
    body = response.json()
    session_id = str(body.get("id") or "").strip()
    session_url = str(body.get("url") or "").strip()
    if not session_id or not session_url:
        raise HTTPException(status_code=502, detail="Stripe checkout session response was incomplete.")
    return session_id, session_url


def _stripe_checkout_payload(
    payment: BillingPaymentRecord,
    metadata: dict[str, str],
    success_url: str,
) -> dict[str, str]:
    payload = {
        "client_reference_id": payment.id,
        "line_items[0][price_data][currency]": payment.currency,
        "line_items[0][price_data][product_data][name]": _stripe_product_name(payment),
        "line_items[0][price_data][unit_amount]": str(payment.amount_cents),
        "line_items[0][quantity]": "1",
        "mode": "payment",
        "success_url": success_url,
    }
    cancel_url = get_hosted_checkout_cancel_url()
    if cancel_url:
        payload["cancel_url"] = cancel_url
    for key, value in metadata.items():
        payload[f"metadata[{key}]"] = value
        payload[f"payment_intent_data[metadata][{key}]"] = value
    return payload


def _stripe_product_name(payment: BillingPaymentRecord) -> str:
    labels = {
        "collaborate_subscription": "Tangent Collaborate subscription",
        "seat_purchase": "Tangent Team seat purchase",
        "team_subscription": "Tangent Team subscription",
        "topup": "Tangent credit top-up",
        "workspace_topup": "Tangent Team wallet top-up",
    }
    return labels.get(payment.kind, "Tangent billing checkout")
