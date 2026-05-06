import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from tangent_api.admin_access import require_admin_role
from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext
from tests.persistence_fakes import FakePostgresDatabase


def test_admin_me_returns_no_access_without_roles(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/me",
        headers={"x-tangent-user-id": "user_plain", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["canAccessAdmin"] is False
    assert payload["roles"] == []
    assert payload["userId"] == "user_plain"


def test_admin_me_returns_active_roles_only(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "owner",
            "permissions": {"all": True},
            "note": "bootstrap",
            "granted_by": "user_seed",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        },
        {
            "user_id": "user_admin",
            "role": "support",
            "permissions": {"tickets": True},
            "note": "revoked",
            "granted_by": "user_seed",
            "created_at": "2026-05-05T00:05:00Z",
            "revoked_at": "2026-05-05T00:10:00Z",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/me",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["canAccessAdmin"] is True
    assert [role["role"] for role in payload["roles"]] == ["owner"]
    assert payload["roles"][0]["permissions"] == {"all": True}


def test_require_admin_role_blocks_non_admin(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)

    with pytest.raises(HTTPException) as error:
        require_admin_role(make_context("user_plain"))
    assert error.value.status_code == 403


def test_require_admin_role_accepts_allowed_role(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"users": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)

    roles = require_admin_role(make_context("user_admin"), allowed_roles={"owner", "admin"})
    assert [role.role for role in roles] == ["admin"]


def test_admin_summary_requires_admin_role(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/summary",
        headers={"x-tangent-user-id": "user_plain", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin role required."


def test_admin_summary_returns_counts_and_writes_audit_log(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_owner",
            "role": "owner",
            "permissions": {"admin": True},
            "note": "bootstrap",
            "granted_by": "seed_user",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_owner",
            "email": "owner@example.com",
            "display_name": "Owner User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": "2026-05-05T10:00:00Z",
        },
        {
            "id": "user_member",
            "email": "member@example.com",
            "display_name": "Member User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-04T00:00:00Z",
            "last_login_at": None,
        },
    ]
    fake_db.workspaces = [
        {"id": "workspace_one", "status": "active"},
        {"id": "workspace_two", "status": "active"},
    ]
    fake_db.boards = {
        ("workspace_one", "board_one"): ("board_one", "workspace_one"),
        ("workspace_two", "board_two"): ("board_two", "workspace_two"),
        ("workspace_two", "board_three"): ("board_three", "workspace_two"),
    }
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/summary",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "workspace_one"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == {
        "adminUserCount": 1,
        "boardsCount": 3,
        "usersCount": 2,
        "workspacesCount": 2,
    }
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.summary.read"
    assert fake_db.admin_audit_logs[-1]["actor_user_id"] == "user_owner"
    assert fake_db.admin_audit_logs[-1]["metadata"] == {"roles": ["owner"]}


def test_admin_users_returns_descending_users_and_writes_audit_log(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"users": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_old",
            "email": "old@example.com",
            "display_name": "Old User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-01T00:00:00Z",
            "last_login_at": None,
        },
        {
            "id": "user_new",
            "email": "new@example.com",
            "display_name": "New User",
            "status": "active",
            "locale": "fr",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": "2026-05-05T12:00:00Z",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/users?limit=1",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["users"] == [
        {
            "createdAt": "2026-05-05T00:00:00Z",
            "displayName": "New User",
            "email": "new@example.com",
            "id": "user_new",
            "lastLoginAt": "2026-05-05T12:00:00Z",
            "locale": "fr",
            "status": "active",
        }
    ]
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.users.list"
    assert fake_db.admin_audit_logs[-1]["metadata"] == {"limit": 1, "roles": ["admin"]}


def test_admin_workspaces_and_boards_routes_return_read_only_resources(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"resources": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.workspaces = [
        {
            "id": "workspace_new",
            "name": "Workspace New",
            "owner_id": "user_admin",
            "status": "active",
            "created_at": "2026-05-05T00:00:00Z",
        },
        {
            "id": "workspace_old",
            "name": "Workspace Old",
            "owner_id": "user_member",
            "status": "active",
            "created_at": "2026-05-01T00:00:00Z",
        },
    ]
    fake_db.boards = {
        ("workspace_new", "board_new"): (
            "board_new", "workspace_new", "user_admin", "New Board", {"assets": [], "shapes": []}, 0, 0, 0,
            None, None, None, None, "2026-05-05T02:00:00Z", "2026-05-05T01:00:00Z", False, False, "workspace", None,
        ),
        ("workspace_old", "board_old"): (
            "board_old", "workspace_old", "user_member", "Old Board", {"assets": [], "shapes": []}, 0, 0, 0,
            None, None, None, None, "2026-05-04T02:00:00Z", "2026-05-04T01:00:00Z", False, False, "private", None,
        ),
    }
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    workspaces = client.get(
        "/api/v1/admin/workspaces?limit=1",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_new"},
    )
    assert workspaces.status_code == 200
    assert workspaces.json()["workspaces"] == [
        {
            "createdAt": "2026-05-05T00:00:00Z",
            "id": "workspace_new",
            "kind": "solo_workspace",
            "name": "Workspace New",
            "ownerId": "user_admin",
            "status": "active",
        }
    ]

    boards = client.get(
        "/api/v1/admin/boards?limit=1",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_new"},
    )
    assert boards.status_code == 200
    assert boards.json()["boards"] == [
        {
            "id": "board_new",
            "ownerId": "user_admin",
            "savedAt": "2026-05-05T02:00:00Z",
            "title": "New Board",
            "visibility": "workspace",
            "workspaceId": "workspace_new",
        }
    ]
    assert fake_db.admin_audit_logs[-2]["action"] == "admin.workspaces.list"
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.boards.list"


def test_admin_audit_logs_route_returns_filtered_entries_and_writes_access_log(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"audit": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.admin_audit_logs = [
        {
            "id": "admin_audit_1",
            "actor_user_id": "user_owner",
            "target_user_id": "user_target",
            "workspace_id": "workspace_one",
            "action": "admin.role.grant",
            "metadata": {"role": "support"},
            "created_at": "2026-05-05T02:00:00Z",
        },
        {
            "id": "admin_audit_2",
            "actor_user_id": "user_admin",
            "target_user_id": "user_target",
            "workspace_id": "workspace_one",
            "action": "admin.role.revoke",
            "metadata": {"role": "support"},
            "created_at": "2026-05-05T01:00:00Z",
        },
        {
            "id": "admin_audit_3",
            "actor_user_id": "user_admin",
            "target_user_id": "user_other",
            "workspace_id": "workspace_two",
            "action": "admin.users.list",
            "metadata": {"limit": 25},
            "created_at": "2026-05-05T00:30:00Z",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/audit-logs?limit=2&targetUserId=user_target",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert [log["id"] for log in payload["logs"]] == ["admin_audit_1", "admin_audit_2"]
    assert payload["logs"][0] == {
        "action": "admin.role.grant",
        "actorUserId": "user_owner",
        "createdAt": "2026-05-05T02:00:00Z",
        "id": "admin_audit_1",
        "metadata": {"role": "support"},
        "targetUserId": "user_target",
        "workspaceId": "workspace_one",
    }
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.audit.list"
    assert fake_db.admin_audit_logs[-1]["metadata"] == {
        "action": None,
        "actorUserId": None,
        "limit": 2,
        "roles": ["admin"],
        "targetUserId": "user_target",
    }


def test_admin_role_grant_list_and_revoke_routes_require_owner(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_owner",
            "role": "owner",
            "permissions": {"all": True},
            "note": "bootstrap",
            "granted_by": "seed_user",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_owner",
            "email": "owner@example.com",
            "display_name": "Owner User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": None,
        },
        {
            "id": "user_target",
            "email": "target@example.com",
            "display_name": "Target User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:01:00Z",
            "last_login_at": None,
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    granted = client.post(
        "/api/v1/admin/roles",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "dev-workspace"},
        json={"userId": "user_target", "role": "admin", "permissions": {"users": True}, "note": "Promoted"},
    )
    assert granted.status_code == 200
    granted_payload = granted.json()
    assert granted_payload["userId"] == "user_target"
    assert granted_payload["role"]["role"] == "admin"
    assert granted_payload["role"]["permissions"] == {"users": True}

    listed = client.get(
        "/api/v1/admin/roles?userId=user_target",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "dev-workspace"},
    )
    assert listed.status_code == 200
    assert [role["role"] for role in listed.json()["roles"]] == ["admin"]

    revoked = client.delete(
        "/api/v1/admin/roles/user_target/admin",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "dev-workspace"},
    )
    assert revoked.status_code == 200
    assert revoked.json()["role"]["role"] == "admin"
    assert [entry["action"] for entry in fake_db.admin_audit_logs[-3:]] == [
        "admin.role.grant",
        "admin.roles.read",
        "admin.role.revoke",
    ]

    blocked = client.post(
        "/api/v1/admin/roles",
        headers={"x-tangent-user-id": "user_target", "x-tangent-workspace-id": "dev-workspace"},
        json={"userId": "user_owner", "role": "support"},
    )
    assert blocked.status_code == 403


def test_admin_revoke_blocks_last_active_owner(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_owner",
            "role": "owner",
            "permissions": {"all": True},
            "note": "bootstrap",
            "granted_by": "seed_user",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.delete(
        "/api/v1/admin/roles/user_owner/owner",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot revoke the last active owner role."


def make_context(user_id: str) -> ApiRequestContext:
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email=f"{user_id}@example.com",
        user_email_verified=True,
        user_id=user_id,
        workspace_board_count=0,
        workspace_id="dev-workspace",
        workspace_name="Dev Workspace",
        workspace_role="owner",
    )
