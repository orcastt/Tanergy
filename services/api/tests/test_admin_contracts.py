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
