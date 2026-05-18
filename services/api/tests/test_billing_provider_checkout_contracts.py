import hashlib
import hmac
import json

from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_self_serve_checkout_is_disabled_in_staging_without_explicit_gate(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/collaborate/checkout",
        headers={"x-tangent-user-id": "user_beta", "x-tangent-workspace-id": "workspace_beta"},
        json={"planKey": "collaborate_start"},
    )

    assert checkout.status_code == 403
    assert checkout.json()["detail"] == "Self-serve billing checkout is disabled during beta. Admin Finance must enable plans manually."


def test_stripe_checkout_session_completes_only_by_webhook(monkeypatch):
    fake_db = FakePostgresDatabase()
    stripe_calls = []
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_PAYMENT_PROVIDER", "stripe")
    monkeypatch.setenv("TANGENT_PAYMENT_CANCEL_URL", "https://app.example/billing/cancel")
    monkeypatch.setenv("TANGENT_PAYMENT_SUCCESS_URL", "https://app.example/billing/success")
    monkeypatch.setenv("TANGENT_STRIPE_SECRET_KEY", "sk_test_contract")
    monkeypatch.setenv("TANGENT_PAYMENT_WEBHOOK_SECRET", "webhook-secret")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.billing_stripe_checkout.httpx.post", _fake_stripe_post(stripe_calls))
    client = TestClient(app)
    headers = {
        "x-tangent-user-id": "user_hosted_checkout",
        "x-tangent-workspace-id": "workspace_hosted",
    }

    checkout = client.post(
        "/api/v1/billing/topups/checkout",
        headers=headers,
        json={"credits": 18, "metadata": {"pack": "hosted"}},
    )
    assert checkout.status_code == 200
    checkout_body = checkout.json()
    payment = checkout_body["payment"]

    assert checkout_body["checkout"]["adapter"] == "stripe_checkout"
    assert checkout_body["checkout"]["id"] == "cs_test_contract"
    assert checkout_body["checkout"]["url"] == "https://checkout.stripe.test/session"
    assert checkout_body["checkout"]["metadata"]["providerCheckoutSessionId"] == "cs_test_contract"
    stripe_call = stripe_calls[0]
    assert stripe_call["auth"] == ("sk_test_contract", "")
    assert stripe_call["data"]["client_reference_id"] == payment["id"]
    assert stripe_call["data"]["line_items[0][price_data][unit_amount]"] == str(payment["amountCents"])
    assert stripe_call["data"]["metadata[paymentId]"] == payment["id"]
    assert stripe_call["data"]["metadata[checkoutSessionId]"] == payment["checkoutSessionId"]
    assert stripe_call["data"]["payment_intent_data[metadata][paymentId]"] == payment["id"]

    manual_complete = client.post(f"/api/v1/billing/payments/{payment['id']}/complete", headers=headers)
    assert manual_complete.status_code == 409
    assert fake_db.credit_ledger == []

    webhook = _post_signed_webhook(
        client,
        {
            "data": {
                "object": {
                    "id": "cs_test_contract",
                    "metadata": {
                        "checkoutSessionId": payment["checkoutSessionId"],
                        "paymentId": payment["id"],
                    },
                    "payment_intent": "pi_hosted_1",
                }
            },
            "id": "evt_hosted_1",
            "type": "checkout.session.completed",
        },
        provider="stripe",
    )

    assert webhook.status_code == 200
    assert webhook.json()["payment"]["status"] == "succeeded"
    assert fake_db.credit_ledger[0]["credits_delta"] == 18
    assert fake_db.payments[0]["provider_payment_id"] == "pi_hosted_1"


def test_generic_hosted_provider_checkout_requires_hosted_url(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_PAYMENT_PROVIDER", "checkout_proxy")
    monkeypatch.delenv("TANGENT_PAYMENT_CHECKOUT_BASE_URL", raising=False)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/billing/topups/checkout",
        headers={
            "x-tangent-user-id": "user_hosted_missing",
            "x-tangent-workspace-id": "workspace_hosted_missing",
        },
        json={"credits": 8},
    )

    assert response.status_code == 501
    assert fake_db.payments == []


def test_stripe_checkout_requires_server_secret(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_PAYMENT_PROVIDER", "stripe")
    monkeypatch.setenv("TANGENT_PAYMENT_SUCCESS_URL", "https://app.example/billing/success")
    monkeypatch.delenv("TANGENT_STRIPE_SECRET_KEY", raising=False)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/billing/topups/checkout",
        headers={
            "x-tangent-user-id": "user_stripe_secret_missing",
            "x-tangent-workspace-id": "workspace_stripe_secret_missing",
        },
        json={"credits": 8},
    )

    assert response.status_code == 501
    assert fake_db.payments == []


def test_stripe_checkout_requires_success_url(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_PAYMENT_PROVIDER", "stripe")
    monkeypatch.setenv("TANGENT_STRIPE_SECRET_KEY", "sk_test_contract")
    monkeypatch.delenv("TANGENT_PAYMENT_SUCCESS_URL", raising=False)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/billing/topups/checkout",
        headers={
            "x-tangent-user-id": "user_stripe_success_missing",
            "x-tangent-workspace-id": "workspace_stripe_success_missing",
        },
        json={"credits": 8},
    )

    assert response.status_code == 501
    assert fake_db.payments == []


def _post_signed_webhook(client: TestClient, payload: dict[str, object], provider: str):
    raw_body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(b"webhook-secret", raw_body, hashlib.sha256).hexdigest()
    return client.post(
        f"/api/v1/billing/webhooks/{provider}",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "x-tangent-webhook-signature": f"sha256={signature}",
        },
    )


def _fake_stripe_post(calls: list[dict[str, object]]):
    def fake_post(url: str, *, auth: tuple[str, str], data: dict[str, str], timeout: int):
        calls.append({
            "auth": auth,
            "data": data,
            "timeout": timeout,
            "url": url,
        })
        return _FakeStripeResponse()

    return fake_post


class _FakeStripeResponse:
    status_code = 200

    def json(self):
        return {
            "id": "cs_test_contract",
            "url": "https://checkout.stripe.test/session",
        }
