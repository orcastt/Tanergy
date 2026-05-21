import hashlib

from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_free_user_can_accept_team_invite_when_team_has_capacity(monkeypatch):
    token = "free-user-team-join-token"
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {
            "id": "workspace_group_owned",
            "kind": "group_workspace",
            "name": "Owned Free Group",
            "owner_id": "user_free",
            "status": "active",
        }
    ]
    fake_db.workspace_members = [
        {
            "display_name": "Free Owner",
            "role": "owner",
            "user_id": "user_free",
            "workspace_id": "workspace_group_owned",
        }
    ]
    fake_db.subscriptions = [
        {
            "id": "subscription_team_start",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_start",
            "seat_capacity": 2,
            "status": "active",
            "updated_at": "2026-05-08T00:00:00Z",
        }
    ]
    fake_db.workspace_invitations = [
        {
            "accepted_at": None,
            "accepted_by": None,
            "created_at": "2026-05-08T00:00:00Z",
            "email": None,
            "expires_at": "2999-01-01T00:00:00Z",
            "id": "invite_team_join",
            "invited_by": "user_team_owner",
            "metadata": {"workspaceKind": "team_workspace"},
            "revoked_at": None,
            "role": "editor",
            "target_user_id": None,
            "token_hash": hashlib.sha256(token.encode("utf-8")).hexdigest(),
            "workspace_id": "workspace_team",
        }
    ]
    fake_db.workspace_seat_assignments = [
        {
            "assigned_by": "user_team_owner",
            "id": "seat_existing",
            "included_credits": 2500,
            "plan_key": "team_start",
            "status": "active",
            "user_id": "user_existing_editor",
            "workspace_id": "workspace_team",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    accepted = client.post(
        f"/api/v1/workspaces/invitations/{token}/accept",
        headers={
            "x-tangent-user-id": "user_free",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert accepted.status_code == 200
    accepted_result = accepted.json()["result"]
    assert accepted_result["workspaceId"] == "workspace_team"
    assert accepted_result["role"] == "editor"
    assert any(
        row["workspace_id"] == "workspace_team"
        and row["user_id"] == "user_free"
        and row["role"] == "editor"
        for row in fake_db.workspace_members
    )
    assert any(
        row["workspace_id"] == "workspace_team"
        and row["user_id"] == "user_free"
        and row["plan_key"] == "team_start"
        and row["status"] == "active"
        for row in fake_db.workspace_seat_assignments
    )


def test_free_user_can_accept_group_invite_after_creating_own_free_group(monkeypatch):
    token = "free-user-group-join-token"
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {
            "id": "workspace_group_owned",
            "kind": "group_workspace",
            "name": "Owned Free Group",
            "owner_id": "user_free",
            "status": "active",
        },
        {
            "id": "workspace_group_invited",
            "kind": "group_workspace",
            "name": "Joined Group",
            "owner_id": "user_group_owner",
            "status": "active",
        },
    ]
    fake_db.workspace_members = [
        {
            "display_name": "Free Owner",
            "role": "owner",
            "user_id": "user_free",
            "workspace_id": "workspace_group_owned",
        },
        {
            "display_name": "Group Owner",
            "role": "owner",
            "user_id": "user_group_owner",
            "workspace_id": "workspace_group_invited",
        },
    ]
    fake_db.workspace_invitations = [
        {
            "accepted_at": None,
            "accepted_by": None,
            "created_at": "2026-05-08T00:00:00Z",
            "email": None,
            "expires_at": "2999-01-01T00:00:00Z",
            "id": "invite_group_join",
            "invited_by": "user_group_owner",
            "metadata": {"workspaceKind": "group_workspace"},
            "revoked_at": None,
            "role": "viewer",
            "target_user_id": None,
            "token_hash": hashlib.sha256(token.encode("utf-8")).hexdigest(),
            "workspace_id": "workspace_group_invited",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    accepted = client.post(
        f"/api/v1/workspaces/invitations/{token}/accept",
        headers={
            "x-tangent-user-id": "user_free",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert accepted.status_code == 200
    accepted_result = accepted.json()["result"]
    assert accepted_result["workspaceId"] == "workspace_group_invited"
    assert accepted_result["role"] == "viewer"
    assert any(
        row["workspace_id"] == "workspace_group_invited"
        and row["user_id"] == "user_free"
        and row["role"] == "viewer"
        for row in fake_db.workspace_members
    )
