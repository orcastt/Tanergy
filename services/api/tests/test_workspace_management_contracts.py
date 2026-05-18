from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_group_owner_can_rename_workspace(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {
            "billing_owner_user_id": "user_group_owner",
            "id": "workspace_group",
            "kind": "group_workspace",
            "name": "Design Circle",
            "owner_id": "user_group_owner",
            "status": "active",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_management.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.patch(
        "/api/v1/workspaces/current",
        headers={
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
            "x-tangent-workspace-role": "owner",
        },
        json={"name": "Studio Crits"},
    )

    assert response.status_code == 200
    assert response.json()["workspace"]["name"] == "Studio Crits"
    assert fake_db.workspaces[0]["name"] == "Studio Crits"


def test_workspace_admin_cannot_rename_workspace(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {
            "billing_owner_user_id": "user_group_owner",
            "id": "workspace_group",
            "kind": "group_workspace",
            "name": "Design Circle",
            "owner_id": "user_group_owner",
            "status": "active",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_management.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.patch(
        "/api/v1/workspaces/current",
        headers={
            "x-tangent-user-id": "user_group_admin",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
            "x-tangent-workspace-role": "admin",
        },
        json={"name": "Studio Crits"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only the workspace owner can rename or delete this workspace."


def test_group_owner_delete_workspace_clears_workspace_content_but_keeps_subscription(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {
            "billing_owner_user_id": "user_group_owner",
            "id": "workspace_group",
            "kind": "group_workspace",
            "name": "Design Circle",
            "owner_id": "user_group_owner",
            "status": "active",
        }
    ]
    fake_db.workspace_members = [
        {"display_name": "Owner", "role": "owner", "user_id": "user_group_owner", "workspace_id": "workspace_group"},
        {"display_name": "Editor", "role": "editor", "user_id": "user_group_editor", "workspace_id": "workspace_group"},
    ]
    fake_db.workspace_invitations = [
        {"accepted_at": None, "accepted_by": None, "created_at": "2026-05-08T00:20:00Z", "email": "new@example.com", "expires_at": "2026-05-15T00:00:00Z", "id": "invite_group", "invited_by": "user_group_owner", "metadata": {}, "revoked_at": None, "role": "viewer", "target_user_id": None, "token_hash": "hash", "workspace_id": "workspace_group"},
    ]
    fake_db.boards[("workspace_group", "board_group")] = ("board_group", "workspace_group")
    fake_db.board_members[("workspace_group", "board_group", "user_group_owner")] = ("workspace_group", "board_group", "user_group_owner", "owner", None, None)
    fake_db.snapshots[("workspace_group", "board_group", "snapshot_group")] = ("snapshot_group", "workspace_group", "board_group")
    fake_db.board_share_links = [
        {"access_role": "viewer", "board_id": "board_group", "created_at": "2026-05-08T00:30:00Z", "created_by": "user_group_owner", "expires_at": None, "id": "share_group", "revoked_at": None, "share_id": "share_group", "workspace_id": "workspace_group"},
    ]
    fake_db.subscriptions = [
        {"id": "sub_group", "owner_id": "user_group_owner", "owner_type": "user", "plan_family": "collaborate", "plan_key": "collaborate_plus", "status": "active", "workspace_id": None},
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_management.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.request(
        "DELETE",
        "/api/v1/workspaces/current",
        headers={
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
            "x-tangent-workspace-role": "owner",
        },
        json={"confirmation": "DELETE"},
    )

    assert response.status_code == 200
    payload = response.json()["result"]
    assert payload["boardsRemoved"] == 1
    assert payload["membersRemoved"] == 2
    assert payload["invitesRevoked"] == 1
    assert fake_db.workspaces[0]["status"] == "deleted"
    assert fake_db.workspace_members == []
    assert fake_db.workspace_invitations == []
    assert ("workspace_group", "board_group") in fake_db.deleted_boards
    assert fake_db.board_members == {}
    assert fake_db.snapshots == {}
    assert fake_db.board_share_links[0]["revoked_at"] is not None
    assert fake_db.subscriptions[0]["status"] == "active"


def test_team_owner_delete_workspace_revokes_seats_and_keeps_team_subscription(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {
            "billing_owner_user_id": "user_team_owner",
            "id": "workspace_team",
            "kind": "team_workspace",
            "name": "Ops Team",
            "owner_id": "user_team_owner",
            "status": "active",
        }
    ]
    fake_db.workspace_members = [
        {"display_name": "Owner", "role": "owner", "user_id": "user_team_owner", "workspace_id": "workspace_team"},
        {"display_name": "Editor", "role": "editor", "user_id": "user_team_editor", "workspace_id": "workspace_team"},
    ]
    fake_db.workspace_seat_assignments = [
        {"assigned_by": "user_team_owner", "id": "seat_team_editor", "included_credits": 2500, "plan_key": "team_start", "status": "active", "user_id": "user_team_editor", "workspace_id": "workspace_team"},
    ]
    fake_db.boards[("workspace_team", "board_team")] = ("board_team", "workspace_team")
    fake_db.subscriptions = [
        {"id": "sub_team", "owner_id": "workspace_team", "owner_type": "workspace", "plan_family": "team", "plan_key": "team_start", "status": "active", "workspace_id": "workspace_team"},
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_management.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.request(
        "DELETE",
        "/api/v1/workspaces/current",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
            "x-tangent-workspace-role": "owner",
        },
        json={"confirmation": "DELETE"},
    )

    assert response.status_code == 200
    assert response.json()["result"]["boardsRemoved"] == 1
    assert fake_db.workspaces[0]["status"] == "deleted"
    assert fake_db.workspace_members == []
    assert ("workspace_team", "board_team") in fake_db.deleted_boards
    assert fake_db.workspace_seat_assignments[0]["status"] == "revoked"
    assert fake_db.subscriptions[0]["status"] == "active"
