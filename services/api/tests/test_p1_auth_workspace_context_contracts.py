from fastapi.testclient import TestClient

from tangent_api.auth_provider import VerifiedAuthIdentity
from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_bearer_session_context_uses_membership_role_not_spoofed_headers(monkeypatch):
    auth_db = AuthContextFakeDatabase(
        users=[_user("user_editor")],
        identities=[_identity_row("user_editor")],
        workspaces=[_workspace("workspace_team", kind="team_workspace")],
        workspace_members=[_member("workspace_team", "user_editor", "editor")],
    )
    _patch_bearer_auth(monkeypatch, auth_db)
    client = TestClient(app)

    response = client.get(
        "/api/v1/auth/session",
        headers={
            "Authorization": "Bearer valid-token",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "solo_workspace",
            "x-tangent-workspace-name": "Spoofed Workspace",
            "x-tangent-workspace-role": "owner",
            "x-tangent-plan-key": "free_canvas",
        },
    )

    assert response.status_code == 200
    workspace = response.json()["session"]["activeWorkspace"]
    assert workspace["id"] == "workspace_team"
    assert workspace["kind"] == "team_workspace"
    assert workspace["name"] == "Team Workspace"
    assert workspace["role"] == "editor"
    assert workspace["planKey"] == "team_growth"


def test_bearer_member_cannot_manage_team_seats_with_spoofed_owner_header(monkeypatch):
    auth_db = AuthContextFakeDatabase(
        users=[_user("user_member")],
        identities=[_identity_row("user_member")],
        workspaces=[_workspace("workspace_team", kind="team_workspace")],
        workspace_members=[_member("workspace_team", "user_member", "member")],
    )
    route_db = FakePostgresDatabase()
    route_db.workspaces = [_workspace("workspace_team", kind="team_workspace")]
    route_db.workspace_members = [_member("workspace_team", "user_member", "member")]
    route_db.workspace_seat_assignments = [
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
    _patch_bearer_auth(monkeypatch, auth_db)
    monkeypatch.setattr("tangent_api.workspace_seats.connect_to_postgres", route_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/workspaces/current/seats",
        headers={
            "Authorization": "Bearer valid-token",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
            "x-tangent-workspace-role": "owner",
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Workspace role cannot manage team seats."
    assert route_db.workspace_seat_assignments[0]["status"] == "active"


def _patch_bearer_auth(monkeypatch, auth_db):
    async def fake_verify_bearer_token(token: str) -> VerifiedAuthIdentity:
        assert token == "valid-token"
        return VerifiedAuthIdentity(
            avatar_url=None,
            display_name="Real User",
            email="real@example.com",
            email_verified=True,
            provider="clerk",
            provider_subject="clerk_real_user",
            session_id="session_real",
        )

    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_REQUIRE_API_AUTH", "1")
    monkeypatch.setattr("tangent_api.request_context.verify_bearer_token", fake_verify_bearer_token)
    monkeypatch.setattr("tangent_api.auth_sessions.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.auth_sessions.connect_to_postgres", auth_db.connect)
    monkeypatch.setattr("tangent_api.auth_sessions.ensure_credit_account", lambda cursor, owner_type, owner_id: None)


def _user(user_id: str) -> dict[str, object]:
    return {
        "avatar_initials": "RU",
        "display_name": "Real User",
        "email": "real@example.com",
        "email_verified": True,
        "id": user_id,
        "profile_completed_at": "2026-05-20T00:00:00Z",
        "status": "active",
    }


def _identity_row(user_id: str) -> dict[str, object]:
    return {
        "email": "real@example.com",
        "provider": "clerk",
        "provider_subject": "clerk_real_user",
        "user_id": user_id,
    }


def _workspace(workspace_id: str, *, kind: str) -> dict[str, object]:
    return {
        "billing_owner_user_id": "user_owner",
        "id": workspace_id,
        "kind": kind,
        "name": "Team Workspace",
        "owner_id": "user_owner",
        "status": "active",
    }


def _member(workspace_id: str, user_id: str, role: str) -> dict[str, object]:
    return {
        "display_name": "Real User",
        "joined_at": "2026-05-20T00:00:00Z",
        "role": role,
        "user_id": user_id,
        "workspace_id": workspace_id,
    }


class AuthContextFakeDatabase:
    def __init__(self, *, users, identities, workspaces, workspace_members):
        self.commits = 0
        self.identities = identities
        self.users = users
        self.workspaces = workspaces
        self.workspace_members = workspace_members

    def connect(self):
        return AuthContextFakeConnection(self)


class AuthContextFakeConnection:
    def __init__(self, database):
        self.database = database

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return AuthContextFakeCursor(self.database)

    def commit(self):
        self.database.commits += 1


class AuthContextFakeCursor:
    def __init__(self, database):
        self.database = database
        self.row = None
        self.rows = []

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split())
        self.row = None
        self.rows = []
        if normalized.startswith("SELECT u.id"):
            self.row = self._load_session_row(params)
        elif normalized.startswith("SELECT wm.workspace_id"):
            self.rows = self._load_membership_rows(params[0])
        elif normalized.startswith("UPDATE tangent_users SET"):
            return
        elif normalized.startswith("UPDATE tangent_user_identities SET"):
            return
        else:
            raise AssertionError(f"Unhandled auth context query: {normalized}")

    def fetchone(self):
        return self.row

    def fetchall(self):
        return self.rows

    def _load_session_row(self, params):
        provider, provider_subject = params[0], params[1]
        requested_workspace_id = params[2] if len(params) > 2 else None
        identity = next(
            (
                row
                for row in self.database.identities
                if row["provider"] == provider and row["provider_subject"] == provider_subject
            ),
            None,
        )
        if not identity:
            return None
        memberships = [
            row for row in self.database.workspace_members
            if row["user_id"] == identity["user_id"]
            and (requested_workspace_id is None or row["workspace_id"] == requested_workspace_id)
        ]
        if not memberships:
            return None
        member = memberships[0]
        user = next(row for row in self.database.users if row["id"] == identity["user_id"])
        workspace = next(row for row in self.database.workspaces if row["id"] == member["workspace_id"])
        return (
            user["id"],
            user["email"],
            user["display_name"],
            user["avatar_initials"],
            user["email_verified"],
            workspace["id"],
            workspace["name"],
            workspace["kind"],
            member["role"],
            user["status"],
            user["profile_completed_at"],
        )

    def _load_membership_rows(self, user_id):
        rows = []
        for member in self.database.workspace_members:
            if member["user_id"] != user_id:
                continue
            workspace = next(row for row in self.database.workspaces if row["id"] == member["workspace_id"])
            if workspace.get("status", "active") == "deleted":
                continue
            rows.append(
                (
                    workspace["id"],
                    workspace["name"],
                    workspace["kind"],
                    "team_growth" if workspace["kind"] == "team_workspace" else "free_canvas",
                    member["role"],
                    0,
                    member["joined_at"],
                )
            )
        return rows
