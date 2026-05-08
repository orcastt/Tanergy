import hashlib
import hmac
import json

from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_payment_webhook_completes_personal_topup_once(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_PAYMENT_WEBHOOK_SECRET", "webhook-secret")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/topups/checkout",
        headers={
            "x-tangent-user-id": "user_webhook_topup",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={"credits": 30, "metadata": {"pack": "webhook"}},
    )
    assert checkout.status_code == 200
    payment = checkout.json()["payment"]

    payload = {
        "data": {
            "paymentId": payment["id"],
            "providerPaymentId": "provider_topup_1",
        },
        "id": "evt_topup_1",
        "type": "checkout.session.completed",
    }
    first = _post_signed_webhook(client, payload)
    duplicate = _post_signed_webhook(client, payload)

    assert first.status_code == 200
    assert first.json()["processed"] is True
    assert first.json()["duplicate"] is False
    assert duplicate.status_code == 200
    assert duplicate.json()["duplicate"] is True
    assert len(fake_db.credit_ledger) == 1
    assert fake_db.credit_ledger[0]["account_id"] == "credit_user_user_webhook_topup"
    assert fake_db.credit_ledger[0]["actor_user_id"] == "user_webhook_topup"
    assert fake_db.credit_ledger[0]["credits_delta"] == 30
    assert fake_db.payments[0]["provider_payment_id"] == "provider_topup_1"
    assert fake_db.payments[0]["status"] == "succeeded"
    assert fake_db.webhook_events[0]["processed_at"] is not None


def test_payment_webhook_provisions_team_subscription(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_PAYMENT_WEBHOOK_SECRET", "webhook-secret")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/teams/checkout",
        headers={
            "x-tangent-user-id": "user_webhook_team",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
        json={
            "planKey": "team_start",
            "quantity": 2,
            "teamName": "Webhook Team",
        },
    )
    assert checkout.status_code == 200
    payment = checkout.json()["payment"]

    payload = {
        "data": {
            "paymentId": payment["id"],
            "providerPaymentId": "provider_team_1",
        },
        "id": "evt_team_1",
        "type": "checkout.session.completed",
    }
    response = _post_signed_webhook(client, payload)

    assert response.status_code == 200
    body = response.json()
    assert body["payment"]["status"] == "succeeded"
    assert body["payment"]["accountId"].startswith("credit_workspace_workspace_")
    workspace_id = body["payment"]["metadata"]["workspaceId"]
    assert fake_db.workspaces[0]["id"] == workspace_id
    assert fake_db.workspace_members[0]["user_id"] == "user_webhook_team"
    assert fake_db.subscriptions[0]["account_id"] == body["payment"]["accountId"]
    assert fake_db.credit_ledger[-1]["account_id"] == body["payment"]["accountId"]
    assert fake_db.credit_ledger[-1]["credits_delta"] == 5000
    assert fake_db.payments[0]["provider_payment_id"] == "provider_team_1"
    assert fake_db.webhook_events[0]["processed_at"] is not None


def test_payment_webhook_rejects_invalid_signature(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_PAYMENT_WEBHOOK_SECRET", "webhook-secret")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/billing/webhooks/manual_test",
        content=json.dumps({"id": "evt_bad", "type": "checkout.session.completed"}).encode("utf-8"),
        headers={
            "Content-Type": "application/json",
            "x-tangent-webhook-signature": "sha256=bad",
        },
    )

    assert response.status_code == 401
    assert fake_db.webhook_events == []


def _post_signed_webhook(client: TestClient, payload: dict[str, object]):
    raw_body = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
    signature = hmac.new(b"webhook-secret", raw_body, hashlib.sha256).hexdigest()
    return client.post(
        "/api/v1/billing/webhooks/manual_test",
        content=raw_body,
        headers={
            "Content-Type": "application/json",
            "x-tangent-webhook-signature": f"sha256={signature}",
        },
    )
