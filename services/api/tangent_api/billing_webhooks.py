import hashlib
import hmac
import json
import os
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.billing_payment_provider import normalize_payment_provider
from tangent_api.billing_payment_schemas import BillingWebhookMutationResponse
from tangent_api.billing_payment_completion import complete_billing_payment_from_provider
from tangent_api.storage.postgres_connection import require_database_url


SUPPORTED_COMPLETION_EVENTS = {
    "checkout.session.completed",
    "manual_test.payment_succeeded",
    "payment.succeeded",
    "payment_intent.succeeded",
}


def process_billing_webhook(
    provider: str,
    *,
    raw_body: bytes,
    signature: Optional[str],
) -> BillingWebhookMutationResponse:
    require_database_url()
    normalized_provider = _normalize_provider(provider)
    _verify_signature(raw_body, signature)
    payload = _parse_payload(raw_body)
    provider_event_id = _extract_event_id(payload)
    event_type = _extract_event_type(payload)
    event_id, duplicate = _record_webhook_event(normalized_provider, provider_event_id, event_type, payload)
    if duplicate:
        return BillingWebhookMutationResponse(
            duplicate=True,
            eventId=event_id,
            ok=True,
            processed=True,
        )
    if event_type not in SUPPORTED_COMPLETION_EVENTS:
        _mark_webhook_event_processed(event_id)
        return BillingWebhookMutationResponse(eventId=event_id, ok=True, processed=False)

    data = _extract_event_data(payload)
    payment_id, checkout_session_id = _extract_payment_reference(data, payload, event_type)
    provider_payment_id = _extract_provider_payment_id(data, provider_event_id)
    completion = complete_billing_payment_from_provider(
        checkout_session_id=checkout_session_id,
        payment_id=payment_id,
        provider=normalized_provider,
        provider_payment_id=provider_payment_id,
    )
    _mark_webhook_event_processed(event_id)
    return BillingWebhookMutationResponse(
        duplicate=False,
        eventId=event_id,
        ok=True,
        payment=completion.payment,
        processed=True,
    )


def _verify_signature(raw_body: bytes, signature: Optional[str]) -> None:
    secret = os.getenv("TANGENT_PAYMENT_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(status_code=501, detail="Payment webhook secret is not configured.")
    provided = (signature or "").strip()
    if not provided:
        raise HTTPException(status_code=401, detail="Missing payment webhook signature.")
    if provided.startswith("sha256="):
        provided = provided.removeprefix("sha256=")
    expected = hmac.new(secret.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Invalid payment webhook signature.")


def _parse_payload(raw_body: bytes) -> dict[str, Any]:
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid payment webhook payload.") from exc
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid payment webhook payload.")
    return payload


def _record_webhook_event(
    provider: str,
    provider_event_id: str,
    event_type: str,
    payload: dict[str, Any],
) -> tuple[str, bool]:
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tangent_webhook_events (
                    id,
                    provider,
                    provider_event_id,
                    event_type,
                    payload
                )
                VALUES (%s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (provider, provider_event_id)
                DO UPDATE SET payload = tangent_webhook_events.payload
                RETURNING id, processed_at
                """,
                (
                    f"webhook_{provider_event_id}",
                    provider,
                    provider_event_id,
                    event_type,
                    json.dumps(payload),
                ),
            )
            row = cursor.fetchone()
        connection.commit()
    return str(row[0]), row[1] is not None


def _mark_webhook_event_processed(event_id: str) -> None:
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE tangent_webhook_events
                SET processed_at = NOW()
                WHERE id = %s
                """,
                (event_id,),
            )
        connection.commit()


def _extract_event_data(payload: dict[str, Any]) -> dict[str, Any]:
    data = payload.get("data")
    if isinstance(data, dict):
        nested = data.get("object")
        if isinstance(nested, dict):
            return nested
        return data
    return {}


def _extract_event_id(payload: dict[str, Any]) -> str:
    event_id = str(payload.get("id") or payload.get("eventId") or "").strip()
    if not event_id:
        raise HTTPException(status_code=400, detail="Payment webhook event id is required.")
    return event_id


def _extract_event_type(payload: dict[str, Any]) -> str:
    event_type = str(payload.get("type") or payload.get("eventType") or "").strip()
    if not event_type:
        raise HTTPException(status_code=400, detail="Payment webhook event type is required.")
    return event_type


def _extract_payment_reference(
    data: dict[str, Any],
    payload: dict[str, Any],
    event_type: str,
) -> tuple[Optional[str], Optional[str]]:
    metadata = _extract_provider_metadata(data, payload)
    payment_id = str(
        data.get("paymentId")
        or data.get("payment_id")
        or metadata.get("paymentId")
        or metadata.get("payment_id")
        or payload.get("paymentId")
        or payload.get("payment_id")
        or ""
    ).strip()
    client_reference_id = str(
        data.get("client_reference_id")
        or metadata.get("clientReferenceId")
        or metadata.get("client_reference_id")
        or payload.get("client_reference_id")
        or ""
    ).strip()
    if not payment_id and client_reference_id.startswith("payment_"):
        payment_id = client_reference_id
    checkout_session_id = str(
        data.get("checkoutSessionId")
        or data.get("checkout_session_id")
        or data.get("checkout_session")
        or metadata.get("checkoutSessionId")
        or metadata.get("checkout_session_id")
        or metadata.get("checkout_session")
        or payload.get("checkoutSessionId")
        or payload.get("checkout_session_id")
        or payload.get("checkout_session")
        or ""
    ).strip()
    if not checkout_session_id and client_reference_id.startswith("checkout_"):
        checkout_session_id = client_reference_id
    if not checkout_session_id and event_type == "checkout.session.completed":
        checkout_session_id = str(data.get("id") or "").strip()
    if not payment_id:
        payment_id = None
    if not checkout_session_id:
        checkout_session_id = None
    if not payment_id and not checkout_session_id:
        raise HTTPException(status_code=400, detail="Payment webhook payment reference is required.")
    return payment_id, checkout_session_id


def _extract_provider_metadata(data: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    metadata = data.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    metadata = payload.get("metadata")
    if isinstance(metadata, dict):
        return metadata
    return {}


def _extract_provider_payment_id(data: dict[str, Any], fallback_event_id: str) -> str:
    return str(
        data.get("providerPaymentId")
        or data.get("provider_payment_id")
        or data.get("payment_intent")
        or data.get("id")
        or fallback_event_id
    )


def _normalize_provider(provider: str) -> str:
    normalized = normalize_payment_provider(provider)
    if not normalized:
        raise HTTPException(status_code=400, detail="Invalid payment provider.")
    return normalized
