import hashlib

from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_workspace_invite_create_and_accept_adds_member(monkeypatch):
    fake_db = FakePostgresDatabase()
    _seed_workspace_access(fake_db, "workspace_team", "team_workspace", "user_team_owner")
    fake_db.subscriptions = [
        {
            "id": "subscription_team",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_start",
            "seat_capacity": 2,
            "status": "active",
            "updated_at": "2026-05-08T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/workspaces/current/invitations",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
        json={"expiresInDays": 3, "metadata": {"source": "team_panel"}, "role": "editor"},
    )

    assert created.status_code == 200
    result = created.json()["result"]
    token = result["token"]
    invitation = result["invitation"]
    assert result["acceptPath"] == f"/api/v1/workspaces/invitations/{token}/accept"
    assert invitation["role"] == "editor"
    assert invitation["workspaceId"] == "workspace_team"
    assert fake_db.workspace_invitations[0]["token_hash"] == hashlib.sha256(token.encode("utf-8")).hexdigest()
    assert fake_db.workspace_invitations[0]["token_hash"] != token

    accepted = client.post(
        f"/api/v1/workspaces/invitations/{token}/accept",
        headers={
            "x-tangent-user-id": "user_new_editor",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert accepted.status_code == 200
    accepted_result = accepted.json()["result"]
    assert accepted_result["role"] == "editor"
    assert accepted_result["workspaceId"] == "workspace_team"
    assert any(
        row["workspace_id"] == "workspace_team"
        and row["user_id"] == "user_new_editor"
        and row["role"] == "editor"
        for row in fake_db.workspace_members
    )
    assert fake_db.workspace_seat_assignments[0]["plan_key"] == "team_start"
    assert fake_db.workspace_seat_assignments[0]["status"] == "active"
    assert fake_db.workspace_seat_assignments[0]["user_id"] == "user_new_editor"
    assert fake_db.workspace_invitations[0]["accepted_by"] == "user_new_editor"


def test_team_workspace_invite_create_requires_available_seat_capacity(monkeypatch):
    fake_db = FakePostgresDatabase()
    _seed_workspace_access(fake_db, "workspace_team", "team_workspace", "user_team_owner")
    fake_db.subscriptions = [
        {
            "id": "subscription_team_full",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_start",
            "seat_capacity": 2,
            "status": "active",
            "updated_at": "2026-05-08T00:00:00Z",
        }
    ]
    fake_db.workspace_members.append(
        {
            "display_name": "Owner",
            "role": "owner",
            "user_id": "user_team_owner",
            "workspace_id": "workspace_team",
        }
    )
    fake_db.workspace_members.append(
        {
            "display_name": "Editor",
            "role": "editor",
            "user_id": "user_existing_editor",
            "workspace_id": "workspace_team",
        }
    )
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/workspaces/current/invitations",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
        json={"expiresInDays": 3, "metadata": {"source": "team_panel"}, "role": "editor"},
    )

    assert created.status_code == 402
    assert created.json()["detail"] == (
        "Team seats are full. Buy more seats or contact an administrator before inviting another member."
    )
    assert fake_db.workspace_invitations == []


def test_team_workspace_invite_create_counts_pending_invites_as_reserved_seats(monkeypatch):
    token = "pending-seat-token"
    fake_db = FakePostgresDatabase()
    _seed_workspace_access(fake_db, "workspace_team", "team_workspace", "user_team_owner")
    fake_db.subscriptions = [
        {
            "id": "subscription_team_pending_full",
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
            "id": "invite_pending_team",
            "invited_by": "user_team_owner",
            "metadata": {"workspaceKind": "team_workspace"},
            "revoked_at": None,
            "role": "editor",
            "target_user_id": None,
            "token_hash": hashlib.sha256(token.encode("utf-8")).hexdigest(),
            "workspace_id": "workspace_team",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/workspaces/current/invitations",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
        json={"expiresInDays": 3, "role": "editor"},
    )

    assert created.status_code == 402
    assert created.json()["detail"] == (
        "Team seats are full. Buy more seats or contact an administrator before inviting another member."
    )
    assert [row["id"] for row in fake_db.workspace_invitations] == ["invite_pending_team"]


def test_solo_workspace_cannot_create_workspace_invites(monkeypatch):
    fake_db = FakePostgresDatabase()
    _seed_workspace_access(fake_db, "workspace_personal", "solo_workspace", "user_personal_owner")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/workspaces/current/invitations",
        headers={
            "x-tangent-user-id": "user_personal_owner",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
        json={"role": "viewer"},
    )

    assert created.status_code == 403
    assert created.json()["detail"] == "Workspace invitations are unavailable for this workspace."


def test_workspace_invite_revoke_blocks_accept(monkeypatch):
    fake_db = FakePostgresDatabase()
    _seed_workspace_access(fake_db, "workspace_group", "group_workspace", "user_group_owner")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/workspaces/current/invitations",
        headers={
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={"role": "viewer"},
    )
    result = created.json()["result"]
    invitation_id = result["invitation"]["id"]
    token = result["token"]

    revoked = client.delete(
        f"/api/v1/workspaces/current/invitations/{invitation_id}",
        headers={
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert revoked.status_code == 200
    assert revoked.json()["invitation"]["revokedAt"] is not None

    accepted = client.post(
        f"/api/v1/workspaces/invitations/{token}/accept",
        headers={
            "x-tangent-user-id": "user_viewer",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert accepted.status_code == 404
    assert not any(row["user_id"] == "user_viewer" for row in fake_db.workspace_members)


def test_expired_workspace_invite_cannot_be_accepted(monkeypatch):
    token = "expired-token"
    fake_db = FakePostgresDatabase()
    fake_db.workspace_invitations = [
        {
            "accepted_at": None,
            "accepted_by": None,
            "created_at": "2026-05-01T00:00:00Z",
            "email": None,
            "expires_at": "2000-01-01T00:00:00Z",
            "id": "invite_expired",
            "invited_by": "user_team_owner",
            "metadata": {},
            "revoked_at": None,
            "role": "editor",
            "target_user_id": None,
            "token_hash": hashlib.sha256(token.encode("utf-8")).hexdigest(),
            "workspace_id": "workspace_team",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    accepted = client.post(
        f"/api/v1/workspaces/invitations/{token}/accept",
        headers={
            "x-tangent-user-id": "user_new_editor",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert accepted.status_code == 404
    assert fake_db.workspace_members == []


def test_team_workspace_invite_accept_requires_available_seat(monkeypatch):
    token = "seat-limited-token"
    fake_db = FakePostgresDatabase()
    fake_db.subscriptions = [
        {
            "id": "subscription_team_full",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_start",
            "seat_capacity": 1,
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
            "id": "invite_full_team",
            "invited_by": "user_team_owner",
            "metadata": {"workspaceKind": "team_workspace"},
            "revoked_at": None,
            "role": "editor",
            "target_user_id": None,
            "token_hash": hashlib.sha256(token.encode("utf-8")).hexdigest(),
            "workspace_id": "workspace_team",
        }
    ]
    fake_db.workspace_members = [
        {
            "display_name": "Existing Editor",
            "role": "editor",
            "user_id": "user_existing_editor",
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
            "x-tangent-user-id": "user_new_editor",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert accepted.status_code == 402
    assert accepted.json()["detail"] == (
        "Team seats are full. Buy more seats or contact an administrator before inviting another member."
    )
    assert [row["user_id"] for row in fake_db.workspace_seat_assignments] == ["user_existing_editor"]
    assert [row["user_id"] for row in fake_db.workspace_members] == ["user_existing_editor"]


def test_group_workspace_invite_accept_enforces_member_cap(monkeypatch):
    token = "group-full-token"
    fake_db = FakePostgresDatabase()
    fake_db.workspace_members = [
        {
            "display_name": f"Member {index}",
            "role": "viewer",
            "user_id": f"user_group_member_{index}",
            "workspace_id": "workspace_group",
        }
        for index in range(15)
    ]
    fake_db.workspace_invitations = [
        {
            "accepted_at": None,
            "accepted_by": None,
            "created_at": "2026-05-08T00:00:00Z",
            "email": None,
            "expires_at": "2999-01-01T00:00:00Z",
            "id": "invite_full_group",
            "invited_by": "user_group_owner",
            "metadata": {"workspaceKind": "group_workspace"},
            "revoked_at": None,
            "role": "viewer",
            "target_user_id": None,
            "token_hash": hashlib.sha256(token.encode("utf-8")).hexdigest(),
            "workspace_id": "workspace_group",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    accepted = client.post(
        f"/api/v1/workspaces/invitations/{token}/accept",
        headers={
            "x-tangent-user-id": "user_group_new",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert accepted.status_code == 400
    assert accepted.json()["detail"] == "Group member cap is 15."
    assert len(fake_db.workspace_members) == 15


def test_group_workspace_invite_accept_does_not_count_owned_groups_against_join(monkeypatch):
    token = "group-join-ok-token"
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {
            "id": "workspace_group_owned",
            "kind": "group_workspace",
            "name": "Owned Group",
            "owner_id": "user_group_owner",
            "status": "active",
        },
        {
            "id": "workspace_group_invited",
            "kind": "group_workspace",
            "name": "Invited Group",
            "owner_id": "user_other_owner",
            "status": "active",
        },
    ]
    fake_db.workspace_members = [
        {
            "display_name": "Owner",
            "role": "owner",
            "user_id": "user_group_owner",
            "workspace_id": "workspace_group_owned",
        },
        {
            "display_name": "Other Owner",
            "role": "owner",
            "user_id": "user_other_owner",
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
            "invited_by": "user_other_owner",
            "metadata": {"workspaceKind": "group_workspace"},
            "revoked_at": None,
            "role": "editor",
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
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert accepted.status_code == 200
    accepted_result = accepted.json()["result"]
    assert accepted_result["workspaceId"] == "workspace_group_invited"
    assert accepted_result["role"] == "editor"
    assert any(
        row["workspace_id"] == "workspace_group_invited"
        and row["user_id"] == "user_group_owner"
        and row["role"] == "editor"
        for row in fake_db.workspace_members
    )
    assert fake_db.workspace_invitations[0]["accepted_by"] == "user_group_owner"


def test_workspace_invite_accept_preserves_board_target_metadata(monkeypatch):
    fake_db = FakePostgresDatabase()
    _seed_workspace_access(fake_db, "workspace_group", "group_workspace", "user_group_owner")
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/workspaces/current/invitations",
        headers={
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "metadata": {"boardId": "board_launch", "boardTitle": "Launch Board"},
            "role": "editor",
        },
    )

    assert created.status_code == 200
    token = created.json()["result"]["token"]
    assert created.json()["result"]["invitation"]["metadata"]["boardId"] == "board_launch"
    assert created.json()["result"]["invitation"]["metadata"]["boardTitle"] == "Launch Board"

    accepted = client.post(
        f"/api/v1/workspaces/invitations/{token}/accept",
        headers={
            "x-tangent-user-id": "user_group_editor",
            "x-tangent-workspace-id": "workspace_personal",
            "x-tangent-workspace-kind": "solo_workspace",
        },
    )

    assert accepted.status_code == 200
    accepted_metadata = accepted.json()["result"]["invitation"]["metadata"]
    assert accepted_metadata["boardId"] == "board_launch"
    assert accepted_metadata["boardTitle"] == "Launch Board"
    assert accepted_metadata["workspaceKind"] == "group_workspace"


def _seed_workspace_access(
    fake_db: FakePostgresDatabase,
    workspace_id: str,
    kind: str,
    owner_id: str,
) -> None:
    fake_db.workspaces.append(
        {
            "billing_owner_user_id": owner_id,
            "id": workspace_id,
            "kind": kind,
            "name": "Workspace",
            "owner_id": owner_id,
            "status": "active",
        }
    )
    if not any(row["workspace_id"] == workspace_id and row["user_id"] == owner_id for row in fake_db.workspace_members):
        fake_db.workspace_members.append(
            {
                "display_name": "Owner",
                "role": "owner",
                "user_id": owner_id,
                "workspace_id": workspace_id,
            }
        )
