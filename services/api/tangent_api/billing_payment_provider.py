import os
from typing import Optional

from fastapi import HTTPException


MANUAL_PAYMENT_PROVIDER = "manual_test"
STRIPE_PAYMENT_PROVIDER = "stripe"


def get_payment_provider() -> str:
    provider = os.getenv("TANGENT_PAYMENT_PROVIDER", MANUAL_PAYMENT_PROVIDER)
    normalized = normalize_payment_provider(provider)
    return normalized or MANUAL_PAYMENT_PROVIDER


def get_hosted_checkout_base_url() -> Optional[str]:
    value = os.getenv("TANGENT_PAYMENT_CHECKOUT_BASE_URL", "").strip()
    return value or None


def get_hosted_checkout_cancel_url() -> Optional[str]:
    value = os.getenv("TANGENT_PAYMENT_CANCEL_URL", "").strip()
    return value or None


def get_hosted_checkout_success_url() -> Optional[str]:
    value = os.getenv("TANGENT_PAYMENT_SUCCESS_URL", "").strip()
    return value or None


def get_stripe_secret_key() -> Optional[str]:
    value = os.getenv("TANGENT_STRIPE_SECRET_KEY", "").strip()
    return value or None


def payment_provider_adapter(provider: str) -> str:
    if provider == MANUAL_PAYMENT_PROVIDER:
        return "manual_test"
    if provider == STRIPE_PAYMENT_PROVIDER:
        return "stripe_checkout"
    return "hosted_redirect"


def normalize_payment_provider(provider: str) -> str:
    normalized = provider.strip().lower().replace("-", "_")
    if normalized and normalized.replace("_", "").isalnum():
        return normalized
    return ""


def require_checkout_provider_ready(provider: str) -> None:
    if provider == MANUAL_PAYMENT_PROVIDER:
        return
    if provider == STRIPE_PAYMENT_PROVIDER:
        if not get_stripe_secret_key():
            raise HTTPException(status_code=501, detail="Stripe checkout secret is not configured.")
        if not get_hosted_checkout_success_url():
            raise HTTPException(status_code=501, detail="Stripe checkout success URL is not configured.")
        return
    if not get_hosted_checkout_base_url():
        raise HTTPException(status_code=501, detail="Hosted payment checkout is not configured.")
