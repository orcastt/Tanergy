from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_team_subscription_checkout_complete_provisions_team_workspace(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/teams/checkout",
        headers={
            "x-tangent-user-id": "user_team_buyer",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
        json={
            "currency": "usd",
            "metadata": {"source": "settings_team_plan"},
            "planKey": "team_start",
            "quantity": 2,
            "teamName": "Launch Team",
        },
    )

    assert checkout.status_code == 200
    payment = checkout.json()["payment"]
    assert payment["accountId"] == "credit_user_user_team_buyer"
    assert payment["amountCents"] == 5000
    assert payment["kind"] == "team_subscription"
    assert payment["metadata"]["ownerUserId"] == "user_team_buyer"
    assert payment["metadata"]["teamName"] == "Launch Team"
    assert payment["status"] == "pending"

    completed = client.post(
        f"/api/v1/billing/payments/{payment['id']}/complete",
        headers={
            "x-tangent-user-id": "user_team_buyer",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert completed.status_code == 200
    completed_payment = completed.json()["payment"]
    workspace_id = completed_payment["metadata"]["workspaceId"]
    assert completed_payment["accountId"] == f"credit_workspace_{workspace_id}"
    assert completed_payment["metadata"]["workspaceName"] == "Launch Team"
    assert fake_db.workspaces[0]["id"] == workspace_id
    assert fake_db.workspaces[0]["kind"] == "team_workspace"
    assert fake_db.workspaces[0]["owner_id"] == "user_team_buyer"
    assert fake_db.workspace_members[0]["role"] == "owner"
    assert fake_db.workspace_members[0]["user_id"] == "user_team_buyer"
    assert fake_db.workspace_seat_assignments[0]["user_id"] == "user_team_buyer"
    assert fake_db.workspace_seat_assignments[0]["plan_key"] == "team_start"
    assert fake_db.workspace_seat_assignments[0]["status"] == "active"
    assert fake_db.credit_accounts[-1]["account_kind"] == "team_wallet"
    assert fake_db.subscriptions[0]["account_id"] == f"credit_workspace_{workspace_id}"
    assert fake_db.subscriptions[0]["owner_type"] == "workspace"
    assert fake_db.subscriptions[0]["owner_id"] == workspace_id
    assert fake_db.subscriptions[0]["plan_family"] == "team"
    assert fake_db.subscriptions[0]["plan_key"] == "team_start"
    assert fake_db.subscriptions[0]["seat_capacity"] == 2
    assert fake_db.credit_ledger[-1]["account_id"] == f"credit_workspace_{workspace_id}"
    assert fake_db.credit_ledger[-1]["credits_delta"] == 5000
    assert fake_db.credit_ledger[-1]["workspace_id"] == workspace_id


def test_team_subscription_checkout_rejects_above_seat_cap(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", FakePostgresDatabase().connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/teams/checkout",
        headers={
            "x-tangent-user-id": "user_team_buyer",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
        json={
            "planKey": "team_start",
            "quantity": 16,
            "teamName": "Too Big Team",
        },
    )

    assert checkout.status_code == 400
    assert checkout.json()["detail"] == "Team seat quantity cannot exceed 15."


def test_team_subscription_completion_requires_original_buyer(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/teams/checkout",
        headers={
            "x-tangent-user-id": "user_team_buyer",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
        json={
            "planKey": "team_growth",
            "quantity": 1,
            "teamName": "Private Team",
        },
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
    assert completed.json()["detail"] == "Team payment does not belong to the current user."
    assert fake_db.workspaces == []


def test_team_wallet_topup_checkout_complete_credits_workspace_account(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/workspaces/current/topups/checkout",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
        json={
            "credits": 120,
            "currency": "usd",
            "metadata": {"pack": "team_boost"},
        },
    )

    assert checkout.status_code == 200
    payment = checkout.json()["payment"]
    assert payment["accountId"] == "credit_workspace_workspace_team"
    assert payment["amountCents"] == 120
    assert payment["kind"] == "workspace_topup"
    assert payment["metadata"]["workspaceId"] == "workspace_team"
    assert payment["status"] == "pending"

    completed = client.post(
        f"/api/v1/billing/payments/{payment['id']}/complete",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )

    assert completed.status_code == 200
    payload = completed.json()
    assert payload["payment"]["status"] == "succeeded"
    assert payload["topupEntryId"] is not None
    assert fake_db.credit_ledger[-1]["account_id"] == "credit_workspace_workspace_team"
    assert fake_db.credit_ledger[-1]["credits_delta"] == 120
    assert fake_db.credit_ledger[-1]["reason"] == "topup_purchase"
    assert fake_db.credit_ledger[-1]["workspace_id"] == "workspace_team"
