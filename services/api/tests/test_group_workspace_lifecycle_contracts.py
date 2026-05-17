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


def test_free_user_can_create_single_group_workspace(monkeypatch):
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

    assert response.status_code == 200
    workspace = response.json()["workspace"]
    assert workspace["kind"] == "group_workspace"
    assert workspace["name"] == "No Plan Group"
    assert workspace["role"] == "owner"
    assert fake_db.workspaces[0]["owner_id"] == "user_free"
    assert fake_db.workspace_members[0]["role"] == "owner"
    assert fake_db.workspace_members[0]["user_id"] == "user_free"


def test_free_canvas_group_create_enforces_single_group_limit(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {
            "id": "workspace_group_0",
            "kind": "group_workspace",
            "name": "Existing Group",
            "owner_id": "user_free",
            "status": "active",
        }
    ]
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
        json={"name": "Second Group"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current plan allows up to 1 group workspaces."
    assert len(fake_db.workspaces) == 1


def test_collaborate_start_group_create_enforces_group_limit(monkeypatch):
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
    fake_db.workspaces = [
        {
            "id": f"workspace_group_{index}",
            "kind": "group_workspace",
            "name": f"Group {index}",
            "owner_id": "user_group_owner",
            "status": "active",
        }
        for index in range(10)
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
        json={"name": "Overflow Group"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Current plan allows up to 10 group workspaces."
    assert len(fake_db.workspaces) == 10
