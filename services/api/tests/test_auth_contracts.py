from typing import Optional

from fastapi.testclient import TestClient

from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext


def test_auth_session_dev_fallback(monkeypatch):
    monkeypatch.delenv("TANGENT_REQUIRE_API_AUTH", raising=False)
    client = TestClient(app)

    response = client.get("/api/v1/auth/session")

    assert response.status_code == 200
    session = response.json()["session"]
    assert session["authMode"] == "dev"
    assert session["isDevFallback"] is True
    assert session["user"]["id"] == "dev-user"
    assert session["activeWorkspace"]["id"] == "dev-workspace"


def test_auth_session_explicit_context(monkeypatch):
    monkeypatch.delenv("TANGENT_REQUIRE_API_AUTH", raising=False)
    client = TestClient(app)

    response = client.get(
        "/api/v1/auth/session",
        headers={"x-tangent-user-id": "user_custom", "x-tangent-workspace-id": "workspace_custom"},
    )

    assert response.status_code == 200
    session = response.json()["session"]
    assert session["authMode"] == "dev"
    assert session["isDevFallback"] is False
    assert session["user"]["id"] == "user_custom"
    assert session["activeWorkspace"]["id"] == "workspace_custom"


def test_auth_required_mode_requires_bearer_token(monkeypatch):
    monkeypatch.setenv("TANGENT_REQUIRE_API_AUTH", "1")
    client = TestClient(app)

    missing = client.get("/api/v1/auth/session")
    assert missing.status_code == 401

    explicit_headers = client.get(
        "/api/v1/auth/session",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "dev-workspace"},
    )
    assert explicit_headers.status_code == 401


def test_auth_production_runtime_requires_bearer_token(monkeypatch):
    monkeypatch.delenv("TANGENT_REQUIRE_API_AUTH", raising=False)
    monkeypatch.setenv("TANGENT_ENV", "production")
    client = TestClient(app)

    response = client.get(
        "/api/v1/auth/session",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 401


def test_auth_session_explicit_workspace_context(monkeypatch):
    monkeypatch.delenv("TANGENT_REQUIRE_API_AUTH", raising=False)
    client = TestClient(app)

    response = client.get(
        "/api/v1/auth/session",
        headers={
            "x-tangent-user-id": "user_custom",
            "x-tangent-workspace-id": "workspace_custom",
            "x-tangent-workspace-kind": "team_workspace",
            "x-tangent-workspace-name": "Custom Team",
            "x-tangent-workspace-role": "admin",
            "x-tangent-plan-key": "team_growth",
        },
    )

    assert response.status_code == 200
    workspace = response.json()["session"]["activeWorkspace"]
    assert workspace["id"] == "workspace_custom"
    assert workspace["kind"] == "team_workspace"
    assert workspace["name"] == "Custom Team"
    assert workspace["planKey"] == "team_growth"
    assert workspace["role"] == "admin"


def test_auth_required_mode_accepts_verified_bearer(monkeypatch):
    monkeypatch.setenv("TANGENT_REQUIRE_API_AUTH", "1")

    async def fake_resolve_authenticated_request_context(
        token: str,
        requested_workspace_id: Optional[str] = None,
        request_ip: Optional[str] = None,
    ) -> ApiRequestContext:
        assert token == "valid-token"
        assert requested_workspace_id == "workspace_clerk_123"
        assert request_ip == "203.0.113.10"
        return ApiRequestContext(
            auth_mode="required",
            is_dev_fallback=False,
            user_avatar_initials="CU",
            user_display_name="Clerk User",
            user_email="user@example.com",
            user_email_verified=True,
            user_id="user_clerk_123",
            workspace_board_count=4,
            workspace_id="workspace_clerk_123",
            workspace_name="Tanergy Workspace",
            workspace_plan_key="team_growth",
            workspace_memberships=[
                {
                    "board_count": 4,
                    "workspace_id": "workspace_clerk_123",
                    "workspace_kind": "team_workspace",
                    "workspace_name": "Tanergy Workspace",
                    "workspace_plan_key": "team_growth",
                    "workspace_role": "owner",
                },
                {
                    "board_count": 1,
                    "workspace_id": "workspace_group_456",
                    "workspace_kind": "group_workspace",
                    "workspace_name": "Creative Group",
                    "workspace_plan_key": "collaborate_plus",
                    "workspace_role": "editor",
                },
            ],
            workspace_role="owner",
        )

    monkeypatch.setattr(
        "tangent_api.request_context.resolve_authenticated_request_context",
        fake_resolve_authenticated_request_context,
    )
    client = TestClient(app)

    response = client.get(
        "/api/v1/auth/session",
        headers={
            "Authorization": "Bearer valid-token",
            "x-forwarded-for": "203.0.113.10, 10.0.0.10",
            "x-tangent-user-id": "attacker-user",
            "x-tangent-workspace-id": "workspace_clerk_123",
        },
    )

    assert response.status_code == 200
    session = response.json()["session"]
    assert session["authMode"] == "required"
    assert session["isDevFallback"] is False
    assert session["user"]["id"] == "user_clerk_123"
    assert session["user"]["displayName"] == "Clerk User"
    assert session["user"]["email"] == "user@example.com"
    assert session["activeWorkspace"]["id"] == "workspace_clerk_123"
    assert session["activeWorkspace"]["boardCount"] == 4
    assert session["activeWorkspace"]["planKey"] == "team_growth"
    assert [workspace["id"] for workspace in session["workspaces"]] == ["workspace_clerk_123", "workspace_group_456"]
    assert [workspace["planKey"] for workspace in session["workspaces"]] == ["team_growth", "collaborate_plus"]


def test_auth_malformed_bearer_header_returns_401(monkeypatch):
    monkeypatch.setenv("TANGENT_REQUIRE_API_AUTH", "1")
    client = TestClient(app)

    response = client.get("/api/v1/auth/session", headers={"Authorization": "Token nope"})

    assert response.status_code == 401
