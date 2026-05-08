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
