from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_collaborate_user_can_create_group_workspace(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_accounts = [
        {
            "account_kind": "personal_wallet",
            "id": "credit_user_user_group_owner",
            "owner_id": "user_group_owner",
            "owner_type": "user",
            "status": "active",
        }
    ]
    fake_db.subscriptions = [
        {
            "account_id": "credit_user_user_group_owner",
            "id": "subscription_collab",
            "owner_id": "user_group_owner",
            "owner_type": "user",
            "plan_family": "collaborate",
            "plan_key": "collaborate_start",
            "status": "active",
            "updated_at": "2026-05-08T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/workspaces/groups",
        headers={
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
        json={"name": "Studio Group"},
    )

    assert response.status_code == 200
    workspace = response.json()["workspace"]
    assert workspace["kind"] == "group_workspace"
    assert workspace["name"] == "Studio Group"
    assert workspace["role"] == "owner"
    assert fake_db.workspaces[0]["id"] == workspace["id"]
    assert fake_db.workspaces[0]["kind"] == "group_workspace"
    assert fake_db.workspaces[0]["owner_id"] == "user_group_owner"
    assert fake_db.workspace_members[0]["role"] == "owner"
    assert fake_db.workspace_members[0]["user_id"] == "user_group_owner"


def test_group_workspace_create_requires_collaborate_subscription(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/workspaces/groups",
        headers={
            "x-tangent-user-id": "user_free",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
        json={"name": "No Plan Group"},
    )

    assert response.status_code == 402
    assert response.json()["detail"] == "Collaborate subscription is required to create a Group workspace."
    assert fake_db.workspaces == []
