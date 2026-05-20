from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_delete_current_workspace_ignores_spoofed_owner_header_and_uses_database_owner(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        _workspace("workspace_group", owner_id="user_real_owner", kind="group_workspace"),
    ]
    fake_db.workspace_members = [
        _member("workspace_group", "user_real_owner", "owner"),
        _member("workspace_group", "user_editor", "editor"),
    ]
    _patch_workspace_db(monkeypatch, fake_db)
    client = TestClient(app)

    response = client.request(
        "DELETE",
        "/api/v1/workspaces/current",
        headers=_headers("workspace_group", "user_editor", kind="group_workspace", role="owner"),
        json={"confirmation": "DELETE"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Only the workspace owner can rename or delete this workspace."
    assert fake_db.workspaces[0]["status"] == "active"
    assert len(fake_db.workspace_members) == 2


def test_workspace_invitations_reject_non_manager_even_with_spoofed_owner_header(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [_workspace("workspace_group", owner_id="user_owner", kind="group_workspace")]
    fake_db.workspace_members = [
        _member("workspace_group", "user_owner", "owner"),
        _member("workspace_group", "user_editor", "editor"),
    ]
    fake_db.workspace_invitations = [_invite("invite_group", "workspace_group")]
    _patch_workspace_db(monkeypatch, fake_db)
    client = TestClient(app)
    spoofed_owner_headers = _headers("workspace_group", "user_editor", kind="group_workspace", role="owner")

    listed = client.get("/api/v1/workspaces/current/invitations", headers=spoofed_owner_headers)
    created = client.post(
        "/api/v1/workspaces/current/invitations",
        headers=spoofed_owner_headers,
        json={"role": "viewer"},
    )
    revoked = client.delete("/api/v1/workspaces/current/invitations/invite_group", headers=spoofed_owner_headers)

    assert listed.status_code == 403
    assert created.status_code == 403
    assert revoked.status_code == 403
    assert fake_db.workspace_invitations[0]["revoked_at"] is None


def test_workspace_invitation_revoke_cannot_cross_workspace(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        _workspace("workspace_a", owner_id="user_owner_a", kind="group_workspace"),
        _workspace("workspace_b", owner_id="user_owner_b", kind="group_workspace"),
    ]
    fake_db.workspace_members = [
        _member("workspace_a", "user_owner_a", "owner"),
        _member("workspace_b", "user_owner_b", "owner"),
    ]
    fake_db.workspace_invitations = [_invite("invite_b", "workspace_b")]
    _patch_workspace_db(monkeypatch, fake_db)
    client = TestClient(app)

    response = client.delete(
        "/api/v1/workspaces/current/invitations/invite_b",
        headers=_headers("workspace_a", "user_owner_a", kind="group_workspace", role="owner"),
    )

    assert response.status_code == 404
    assert fake_db.workspace_invitations[0]["revoked_at"] is None


def test_workspace_member_routes_reject_editor_spoofing_manager_role(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [_workspace("workspace_group", owner_id="user_owner", kind="group_workspace")]
    fake_db.workspace_members = [
        _member("workspace_group", "user_owner", "owner"),
        _member("workspace_group", "user_editor", "editor"),
        _member("workspace_group", "user_viewer", "viewer"),
    ]
    _patch_workspace_db(monkeypatch, fake_db)
    client = TestClient(app)
    spoofed_admin_headers = _headers("workspace_group", "user_editor", kind="group_workspace", role="admin")

    promoted = client.patch(
        "/api/v1/workspaces/current/members/user_viewer",
        headers=spoofed_admin_headers,
        json={"role": "admin"},
    )
    removed = client.delete("/api/v1/workspaces/current/members/user_viewer", headers=spoofed_admin_headers)

    assert promoted.status_code == 403
    assert removed.status_code == 403
    assert _role(fake_db, "workspace_group", "user_viewer") == "viewer"


def test_workspace_member_routes_keep_owner_protected(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [_workspace("workspace_group", owner_id="user_owner", kind="group_workspace")]
    fake_db.workspace_members = [
        _member("workspace_group", "user_owner", "owner"),
        _member("workspace_group", "user_admin", "admin"),
    ]
    _patch_workspace_db(monkeypatch, fake_db)
    client = TestClient(app)
    admin_headers = _headers("workspace_group", "user_admin", kind="group_workspace", role="admin")

    changed = client.patch(
        "/api/v1/workspaces/current/members/user_owner",
        headers=admin_headers,
        json={"role": "viewer"},
    )
    removed = client.delete("/api/v1/workspaces/current/members/user_owner", headers=admin_headers)

    assert changed.status_code == 400
    assert removed.status_code == 400
    assert _role(fake_db, "workspace_group", "user_owner") == "owner"


def test_workspace_seat_routes_reject_regular_member(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [_workspace("workspace_team", owner_id="user_owner", kind="team_workspace")]
    fake_db.workspace_members = [
        _member("workspace_team", "user_owner", "owner"),
        _member("workspace_team", "user_member", "member"),
    ]
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
    fake_db.workspace_seat_assignments = [
        {
            "assigned_by": "user_owner",
            "id": "seat_member",
            "included_credits": 2500,
            "plan_key": "team_start",
            "status": "active",
            "user_id": "user_member",
            "workspace_id": "workspace_team",
        }
    ]
    _patch_workspace_db(monkeypatch, fake_db)
    client = TestClient(app)
    member_headers = _headers("workspace_team", "user_member", kind="team_workspace", role="owner")

    listed = client.get("/api/v1/workspaces/current/seats", headers=member_headers)
    upserted = client.post(
        "/api/v1/workspaces/current/seats",
        headers=member_headers,
        json={"planKey": "team_start", "userId": "user_member"},
    )
    revoked = client.delete("/api/v1/workspaces/current/seats/user_member", headers=member_headers)

    assert listed.status_code == 403
    assert upserted.status_code == 403
    assert revoked.status_code == 403
    assert fake_db.workspace_seat_assignments[0]["status"] == "active"


def _patch_workspace_db(monkeypatch, fake_db: FakePostgresDatabase) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_management.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_seats.connect_to_postgres", fake_db.connect)


def _headers(workspace_id: str, user_id: str, *, kind: str, role: str) -> dict[str, str]:
    return {
        "x-tangent-user-id": user_id,
        "x-tangent-workspace-id": workspace_id,
        "x-tangent-workspace-kind": kind,
        "x-tangent-workspace-role": role,
    }


def _workspace(workspace_id: str, *, owner_id: str, kind: str) -> dict[str, object]:
    return {
        "billing_owner_user_id": owner_id,
        "id": workspace_id,
        "kind": kind,
        "name": "Workspace",
        "owner_id": owner_id,
        "status": "active",
    }


def _member(workspace_id: str, user_id: str, role: str) -> dict[str, object]:
    return {
        "display_name": user_id.replace("_", " ").title(),
        "role": role,
        "user_id": user_id,
        "workspace_id": workspace_id,
    }


def _invite(invite_id: str, workspace_id: str) -> dict[str, object]:
    return {
        "accepted_at": None,
        "accepted_by": None,
        "created_at": "2026-05-08T00:20:00Z",
        "email": "new@example.com",
        "expires_at": "2999-01-01T00:00:00Z",
        "id": invite_id,
        "invited_by": "user_owner",
        "metadata": {"workspaceKind": "group_workspace"},
        "revoked_at": None,
        "role": "viewer",
        "target_user_id": None,
        "token_hash": f"hash_{invite_id}",
        "workspace_id": workspace_id,
    }


def _role(fake_db: FakePostgresDatabase, workspace_id: str, user_id: str) -> str:
    member = next(
        row
        for row in fake_db.workspace_members
        if row["workspace_id"] == workspace_id and row["user_id"] == user_id
    )
    return str(member["role"])
