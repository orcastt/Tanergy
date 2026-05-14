import json
import time

import pytest
from fastapi import HTTPException

from tangent_api.auth_provider import VerifiedAuthIdentity, _validate_registered_claims
from tangent_api.auth_session_memberships import ResolvedWorkspaceMembership, load_workspace_memberships
from tangent_api.auth_sessions import resolve_local_auth_session


@pytest.fixture(autouse=True)
def enable_last_ip_column(monkeypatch):
    monkeypatch.setattr("tangent_api.auth_sessions.auth_user_last_ip_enabled", lambda: True)


def test_existing_session_can_select_requested_member_workspace(monkeypatch):
    fake_connection = AuthSessionFakeConnection()
    wallet_calls = []
    monkeypatch.setattr("tangent_api.auth_sessions.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.auth_sessions.connect_to_postgres", lambda: fake_connection)
    monkeypatch.setattr(
        "tangent_api.auth_sessions._load_auth_session_row",
        lambda cursor, identity, requested_workspace_id: (
            "user_123",
            "user@example.com",
            "Clerk User",
            "CU",
            True,
            "workspace_team",
            "Team Space",
            "team_workspace",
            "admin",
        ),
    )
    monkeypatch.setattr(
        "tangent_api.auth_sessions.load_workspace_memberships",
        lambda cursor, user_id, active_workspace_id: [
            ResolvedWorkspaceMembership(7, "workspace_team", "team_workspace", "Team Space", "team_growth", "admin"),
            ResolvedWorkspaceMembership(2, "workspace_solo", "solo_workspace", "Personal workspace", "free_canvas", "owner"),
        ],
    )
    monkeypatch.setattr(
        "tangent_api.auth_sessions.ensure_credit_account",
        lambda cursor, owner_type, owner_id: wallet_calls.append((owner_type, owner_id)) or f"credit_{owner_type}_{owner_id}",
    )

    session = resolve_local_auth_session(_identity(), requested_workspace_id="workspace_team")

    assert session.workspace_id == "workspace_team"
    assert session.workspace_kind == "team_workspace"
    assert session.workspace_plan_key == "team_growth"
    assert session.workspace_role == "admin"
    assert session.board_count == 7
    assert [workspace.workspace_id for workspace in session.workspaces] == ["workspace_team", "workspace_solo"]
    assert [workspace.workspace_plan_key for workspace in session.workspaces] == ["team_growth", "free_canvas"]
    assert wallet_calls == [("user", "user_123")]
    assert fake_connection.commits == 1


def test_load_workspace_memberships_filters_deleted_workspaces_in_sql():
    cursor = AuthMembershipQueryCursor([
        (
            "workspace_active",
            "Active Space",
            "solo_workspace",
            "free_canvas",
            "owner",
            3,
            "2026-05-14T00:00:00Z",
        ),
    ])

    memberships = load_workspace_memberships(cursor, "user_123", "workspace_active")

    assert [workspace.workspace_id for workspace in memberships] == ["workspace_active"]
    assert cursor.params == ("user_123",)
    assert "COALESCE(w.status, 'active') <> 'deleted'" in cursor.query


def test_existing_session_rejects_non_member_requested_workspace(monkeypatch):
    monkeypatch.setattr("tangent_api.auth_sessions.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.auth_sessions.connect_to_postgres", AuthSessionFakeConnection)
    monkeypatch.setattr("tangent_api.auth_sessions._load_auth_session_row", lambda cursor, identity, requested_workspace_id: None)
    monkeypatch.setattr("tangent_api.auth_sessions.identity_exists", lambda cursor, identity: True)
    monkeypatch.setattr("tangent_api.auth_sessions.load_identity_user_status", lambda cursor, identity: "active")

    with pytest.raises(HTTPException) as exc:
        resolve_local_auth_session(_identity(), requested_workspace_id="workspace_forbidden")

    assert exc.value.status_code == 403
    assert exc.value.detail == "Requested workspace is not available for this user."


def test_suspended_user_session_is_rejected(monkeypatch):
    monkeypatch.setattr("tangent_api.auth_sessions.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.auth_sessions.connect_to_postgres", AuthSessionFakeConnection)
    monkeypatch.setattr(
        "tangent_api.auth_sessions._load_auth_session_row",
        lambda cursor, identity, requested_workspace_id: (
            "user_123",
            "user@example.com",
            "Clerk User",
            "CU",
            True,
            "workspace_team",
            "Team Space",
            "team_workspace",
            "admin",
            "suspended",
        ),
    )

    with pytest.raises(HTTPException) as exc:
        resolve_local_auth_session(_identity())

    assert exc.value.status_code == 403
    assert exc.value.detail == "User account is suspended."


def test_blocked_identity_does_not_fall_through_to_user_creation(monkeypatch):
    monkeypatch.setattr("tangent_api.auth_sessions.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.auth_sessions.connect_to_postgres", AuthSessionFakeConnection)
    monkeypatch.setattr("tangent_api.auth_sessions._load_auth_session_row", lambda cursor, identity, requested_workspace_id: None)
    monkeypatch.setattr("tangent_api.auth_sessions.identity_exists", lambda cursor, identity: True)
    monkeypatch.setattr("tangent_api.auth_sessions.load_identity_user_status", lambda cursor, identity: "deleted")

    with pytest.raises(HTTPException) as exc:
        resolve_local_auth_session(_identity(), requested_workspace_id="workspace_forbidden")

    assert exc.value.status_code == 403
    assert exc.value.detail == "User account is deleted."


def test_auth_provider_requires_configured_authorized_party(monkeypatch):
    monkeypatch.setenv("CLERK_AUTHORIZED_PARTIES", "https://app.tanergy.ai")
    monkeypatch.delenv("CLERK_JWT_ISSUER", raising=False)
    monkeypatch.delenv("CLERK_JWT_AUDIENCE", raising=False)

    with pytest.raises(HTTPException) as missing:
        _validate_registered_claims({"exp": time.time() + 60})

    with pytest.raises(HTTPException) as invalid:
        _validate_registered_claims({"azp": "https://evil.example", "exp": time.time() + 60})

    assert missing.value.status_code == 401
    assert missing.value.detail == "Missing token authorized party."
    assert invalid.value.status_code == 401
    assert invalid.value.detail == "Invalid token authorized party."


def test_verified_session_creates_default_workspace_and_personal_wallet(monkeypatch):
    fake_db = AuthBootstrapFakeDatabase()
    wallet_calls = []
    monkeypatch.setattr("tangent_api.auth_sessions.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.auth_sessions.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr(
        "tangent_api.auth_sessions.ensure_credit_account",
        lambda cursor, owner_type, owner_id: wallet_calls.append((owner_type, owner_id)) or f"credit_{owner_type}_{owner_id}",
    )

    session = resolve_local_auth_session(_identity(), request_ip="203.0.113.11")

    assert session.user_id == fake_db.users[0]["id"]
    assert session.workspace_id == fake_db.workspaces[0]["id"]
    assert session.workspace_kind == "solo_workspace"
    assert fake_db.users[0]["last_ip_address"] == "203.0.113.11"
    assert fake_db.workspace_members == [
        {
            "display_name": "Clerk User",
            "role": "owner",
            "user_id": session.user_id,
            "workspace_id": session.workspace_id,
        }
    ]
    assert fake_db.credit_ledger == [
        {
            "account_id": f"credit_user_{session.user_id}",
            "actor_user_id": session.user_id,
            "credits_delta": 50.0,
            "metadata": {"grantType": "registration", "planKey": "free_canvas"},
            "reason": "subscription_grant",
            "source_id": f"registration_free_canvas_{session.user_id}",
            "source_type": "subscription",
            "workspace_id": session.workspace_id,
        }
    ]
    assert wallet_calls == [("user", session.user_id)]
    assert fake_db.commits == 1


def test_existing_verified_session_bootstraps_local_admin_role_from_loopback_request(monkeypatch):
    fake_db = AuthBootstrapFakeDatabase()
    wallet_calls = []
    monkeypatch.delenv("TANGENT_REQUIRE_API_AUTH", raising=False)
    monkeypatch.setattr("tangent_api.auth_sessions.require_database_url", lambda: None)
    monkeypatch.setattr("tangent_api.auth_sessions.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr(
        "tangent_api.auth_sessions._load_auth_session_row",
        lambda cursor, identity, requested_workspace_id: (
            "user_existing",
            "user@example.com",
            "Clerk User",
            "CU",
            True,
            "workspace_existing",
            "Tanergy Workspace",
            "solo_workspace",
            "owner",
        ),
    )
    monkeypatch.setattr(
        "tangent_api.auth_sessions.load_workspace_memberships",
        lambda cursor, user_id, active_workspace_id: [
            ResolvedWorkspaceMembership(0, "workspace_existing", "solo_workspace", "Tanergy Workspace", "free_canvas", "owner")
        ],
    )
    monkeypatch.setattr(
        "tangent_api.auth_sessions.ensure_credit_account",
        lambda cursor, owner_type, owner_id: wallet_calls.append((owner_type, owner_id)) or f"credit_{owner_type}_{owner_id}",
    )

    session = resolve_local_auth_session(_identity(), request_ip="127.0.0.1")

    assert session.user_id == "user_existing"
    assert wallet_calls == [("user", "user_existing")]
    assert fake_db.admin_roles == [
        {
            "granted_by": "user_existing",
            "note": "Local real-login admin bootstrap",
            "permissions": {"bootstrap": True, "scope": "local_real_login"},
            "revoked_at": None,
            "role": "owner",
            "user_id": "user_existing",
        }
    ]
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.bootstrap.real_login"
    assert fake_db.commits == 1


class AuthSessionFakeConnection:
    def __init__(self):
        self.commits = 0

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return AuthSessionFakeCursor()

    def commit(self):
        self.commits += 1


class AuthSessionFakeCursor:
    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        return None


class AuthMembershipQueryCursor:
    def __init__(self, rows):
        self.params = None
        self.query = ""
        self.rows = rows

    def execute(self, query, params=None):
        self.query = " ".join(query.split())
        self.params = params

    def fetchall(self):
        return self.rows


class AuthBootstrapFakeConnection:
    def __init__(self, database):
        self.database = database

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def cursor(self):
        return AuthBootstrapFakeCursor(self.database)

    def commit(self):
        self.database.commits += 1


class AuthBootstrapFakeCursor:
    def __init__(self, database):
        self.database = database
        self.row = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, query, params=None):
        normalized = " ".join(query.split())
        self.row = None
        if normalized.startswith("SELECT u.id"):
            return
        if normalized.startswith("SELECT 1 FROM tangent_admin_roles"):
            self.row = next(
                (
                    (1,)
                    for row in self.database.admin_roles
                    if row["user_id"] == params[0] and row["revoked_at"] is None
                ),
                None,
            )
            return
        if normalized.startswith("SELECT 1 FROM tangent_user_identities"):
            return
        if normalized.startswith("UPDATE tangent_users SET"):
            return
        if normalized.startswith("UPDATE tangent_user_identities SET"):
            return
        if normalized.startswith("INSERT INTO tangent_users"):
            self.database.users.append(
                {
                    "avatar_initials": params[3],
                    "display_name": params[2],
                    "email": params[1],
                    "email_verified": params[4],
                    "id": params[0],
                    "last_ip_address": params[5],
                }
            )
            return
        if normalized.startswith("INSERT INTO tangent_user_identities"):
            self.database.identities.append(
                {
                    "email": params[4],
                    "provider": params[2],
                    "provider_subject": params[3],
                    "user_id": params[1],
                }
            )
            return
        if normalized.startswith("INSERT INTO tangent_workspaces"):
            self.database.workspaces.append(
                {
                    "id": params[0],
                    "kind": params[3],
                    "name": params[1],
                    "owner_id": params[2],
                }
            )
            return
        if normalized.startswith("INSERT INTO tangent_workspace_members"):
            self.database.workspace_members.append(
                {
                    "display_name": params[2],
                    "role": "owner",
                    "user_id": params[1],
                    "workspace_id": params[0],
                }
            )
            return
        if normalized.startswith("SELECT 1 FROM tangent_credit_ledger"):
            self.row = next(
                (
                    (1,)
                    for row in self.database.credit_ledger
                    if row["account_id"] == params[0] and row["source_id"] == params[1]
                ),
                None,
            )
            return
        if normalized.startswith("INSERT INTO tangent_credit_ledger"):
            self.database.credit_ledger.append(
                {
                    "account_id": params[1],
                    "actor_user_id": params[3],
                    "credits_delta": params[5],
                    "metadata": json.loads(params[6]),
                    "reason": "subscription_grant",
                    "source_id": params[4],
                    "source_type": "subscription",
                    "workspace_id": params[2],
                }
            )
            return
        if normalized.startswith("INSERT INTO tangent_admin_roles"):
            self.database.admin_roles.append(
                {
                    "granted_by": params[3],
                    "note": params[2],
                    "permissions": json.loads(params[1]),
                    "revoked_at": None,
                    "role": "owner",
                    "user_id": params[0],
                }
            )
            return
        if normalized.startswith("INSERT INTO tangent_admin_audit_logs"):
            self.database.admin_audit_logs.append(
                {
                    "action": params[4],
                    "actor_user_id": params[1],
                    "metadata": json.loads(params[5]),
                    "target_user_id": params[2],
                    "workspace_id": params[3],
                }
            )
            return
        raise AssertionError(f"Unhandled auth session query: {normalized}")

    def fetchone(self):
        return self.row


class AuthBootstrapFakeDatabase:
    def __init__(self):
        self.admin_audit_logs = []
        self.admin_roles = []
        self.commits = 0
        self.credit_ledger = []
        self.identities = []
        self.users = []
        self.workspaces = []
        self.workspace_members = []

    def connect(self):
        return AuthBootstrapFakeConnection(self)


def _identity() -> VerifiedAuthIdentity:
    return VerifiedAuthIdentity(
        avatar_url=None,
        display_name="Clerk User",
        email="user@example.com",
        email_verified=True,
        provider="clerk",
        provider_subject="clerk_user_123",
        session_id="session_123",
    )
