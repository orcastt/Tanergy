from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_team_owner_remove_member_revokes_active_seat(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspace_members = [
        {
            "display_name": "Team Editor",
            "role": "editor",
            "user_id": "user_team_editor",
            "workspace_id": "workspace_team",
        }
    ]
    fake_db.workspace_seat_assignments = [
        {
            "assigned_by": "user_team_owner",
            "id": "seat_editor",
            "included_credits": 2500,
            "plan_key": "team_start",
            "status": "active",
            "user_id": "user_team_editor",
            "workspace_id": "workspace_team",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.delete(
        "/api/v1/workspaces/current/members/user_team_editor",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True, "userId": "user_team_editor"}
    assert fake_db.workspace_members == []
    assert fake_db.workspace_seat_assignments[0]["status"] == "revoked"


def test_workspace_admin_cannot_remove_owner(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspace_members = [
        {
            "display_name": "Owner",
            "role": "owner",
            "user_id": "user_group_owner",
            "workspace_id": "workspace_group",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.delete(
        "/api/v1/workspaces/current/members/user_group_owner",
        headers={
            "x-tangent-user-id": "user_group_admin",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Owner role cannot be removed here."
    assert fake_db.workspace_members[0]["role"] == "owner"


def test_team_owner_can_transfer_workspace_ownership(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {
            "billing_owner_user_id": "user_team_owner",
            "id": "workspace_team",
            "kind": "team_workspace",
            "name": "Team Workspace",
            "owner_id": "user_team_owner",
            "status": "active",
        }
    ]
    fake_db.users = [
        {"display_name": "Team Owner", "email": "owner@example.com", "id": "user_team_owner"},
        {"display_name": "Team Admin", "email": "admin@example.com", "id": "user_team_admin"},
    ]
    fake_db.workspace_members = [
        {
            "display_name": "Team Owner",
            "role": "owner",
            "user_id": "user_team_owner",
            "workspace_id": "workspace_team",
        },
        {
            "display_name": "Team Admin",
            "role": "admin",
            "user_id": "user_team_admin",
            "workspace_id": "workspace_team",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_owner_transfer.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/workspaces/current/owner/transfer",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
            "x-tangent-workspace-name": "Team Workspace",
            "x-tangent-workspace-role": "owner",
        },
        json={"userId": "user_team_admin"},
    )

    assert response.status_code == 200
    payload = response.json()["result"]
    assert payload["previousOwnerUserId"] == "user_team_owner"
    assert payload["member"]["userId"] == "user_team_admin"
    assert payload["member"]["role"] == "owner"
    assert payload["workspace"]["role"] == "admin"
    assert fake_db.workspaces[0]["owner_id"] == "user_team_admin"
    assert fake_db.workspaces[0]["billing_owner_user_id"] == "user_team_admin"
    owner_member = next(member for member in fake_db.workspace_members if member["user_id"] == "user_team_owner")
    target_member = next(member for member in fake_db.workspace_members if member["user_id"] == "user_team_admin")
    assert owner_member["role"] == "admin"
    assert target_member["role"] == "owner"


def test_group_workspace_owner_transfer_is_rejected(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_owner_transfer.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/workspaces/current/owner/transfer",
        headers={
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
            "x-tangent-workspace-role": "owner",
        },
        json={"userId": "user_group_editor"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Workspace owner transfer is only available for Team workspaces right now."


def test_workspace_admin_cannot_transfer_owner(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_owner_transfer.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/workspaces/current/owner/transfer",
        headers={
            "x-tangent-user-id": "user_team_admin",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
            "x-tangent-workspace-role": "admin",
        },
        json={"userId": "user_team_editor"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only workspace owners can transfer ownership."
