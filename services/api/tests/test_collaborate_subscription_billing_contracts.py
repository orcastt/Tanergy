from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_collaborate_subscription_checkout_complete_activates_personal_subscription(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/collaborate/checkout",
        headers={
            "x-tangent-user-id": "user_collab_buyer",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
        json={
            "currency": "usd",
            "metadata": {"source": "settings_collaborate_plan"},
            "planKey": "collaborate_plus",
        },
    )

    assert checkout.status_code == 200
    payment = checkout.json()["payment"]
    assert payment["accountId"] == "credit_user_user_collab_buyer"
    assert payment["amountCents"] == 2500
    assert payment["kind"] == "collaborate_subscription"
    assert payment["metadata"]["includedCredits"] == 2000
    assert payment["metadata"]["ownerUserId"] == "user_collab_buyer"
    assert payment["metadata"]["planFamily"] == "collaborate"
    assert payment["status"] == "pending"

    completed = client.post(
        f"/api/v1/billing/payments/{payment['id']}/complete",
        headers={
            "x-tangent-user-id": "user_collab_buyer",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert completed.status_code == 200
    assert completed.json()["payment"]["status"] == "succeeded"
    assert fake_db.subscriptions[0]["account_id"] == "credit_user_user_collab_buyer"
    assert fake_db.subscriptions[0]["owner_type"] == "user"
    assert fake_db.subscriptions[0]["owner_id"] == "user_collab_buyer"
    assert fake_db.subscriptions[0]["plan_family"] == "collaborate"
    assert fake_db.subscriptions[0]["plan_key"] == "collaborate_plus"
    assert fake_db.subscriptions[0]["provider_subscription_id"] == payment["id"]
    assert fake_db.credit_ledger[-1]["account_id"] == "credit_user_user_collab_buyer"
    assert fake_db.credit_ledger[-1]["credits_delta"] == 2000
    assert fake_db.credit_ledger[-1]["reason"] == "subscription_grant"


def test_collaborate_subscription_upgrade_reuses_single_active_subscription(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_accounts = [
        {
            "account_kind": "personal_wallet",
            "id": "credit_user_user_collab_upgrade",
            "owner_id": "user_collab_upgrade",
            "owner_type": "user",
            "status": "active",
        }
    ]
    fake_db.subscriptions = [
        {
            "account_id": "credit_user_user_collab_upgrade",
            "id": "subscription_existing_collab",
            "owner_id": "user_collab_upgrade",
            "owner_type": "user",
            "plan_family": "collaborate",
            "plan_key": "collaborate_start",
            "provider": "manual_test",
            "provider_subscription_id": "payment_old",
            "seat_capacity": 1,
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/collaborate/checkout",
        headers={
            "x-tangent-user-id": "user_collab_upgrade",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={"planKey": "collaborate_plus"},
    )
    payment = checkout.json()["payment"]

    completed = client.post(
        f"/api/v1/billing/payments/{payment['id']}/complete",
        headers={
            "x-tangent-user-id": "user_collab_upgrade",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert completed.status_code == 200
    assert len(fake_db.subscriptions) == 1
    assert fake_db.subscriptions[0]["id"] == "subscription_existing_collab"
    assert fake_db.subscriptions[0]["plan_key"] == "collaborate_plus"
    assert fake_db.subscriptions[0]["owner_type"] == "user"
    assert fake_db.subscriptions[0]["owner_id"] == "user_collab_upgrade"
    assert fake_db.credit_ledger[-1]["credits_delta"] == 2000


def test_collaborate_subscription_completion_requires_original_buyer(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/collaborate/checkout",
        headers={
            "x-tangent-user-id": "user_collab_buyer",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
        json={"planKey": "collaborate_start"},
    )
    payment_id = checkout.json()["payment"]["id"]

    completed = client.post(
        f"/api/v1/billing/payments/{payment_id}/complete",
        headers={
            "x-tangent-user-id": "user_other",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert completed.status_code == 403
    assert completed.json()["detail"] == "Collaborate payment does not belong to the current user."
    assert fake_db.subscriptions == []
