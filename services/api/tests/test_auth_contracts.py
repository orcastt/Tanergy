from typing import Optional

from fastapi import HTTPException
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
    assert session["user"]["profileCompleted"] is True
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
            user_profile_completed=False,
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
    assert session["user"]["profileCompleted"] is False
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


def test_auth_profile_patch_requires_authenticated_session(monkeypatch):
    monkeypatch.delenv("TANGENT_REQUIRE_API_AUTH", raising=False)
    client = TestClient(app)

    response = client.patch("/api/v1/auth/profile", json={"displayName": "New Name"})

    assert response.status_code == 401


def test_auth_profile_patch_updates_local_profile(monkeypatch):
    monkeypatch.setenv("TANGENT_REQUIRE_API_AUTH", "1")

    async def fake_resolve_authenticated_request_context(
        token: str,
        requested_workspace_id: Optional[str] = None,
        request_ip: Optional[str] = None,
    ) -> ApiRequestContext:
        assert token == "valid-token"
        return ApiRequestContext(
            auth_mode="required",
            is_dev_fallback=False,
            user_avatar_initials="CU",
            user_display_name="Clerk User",
            user_email="user@example.com",
            user_email_verified=True,
            user_id="user_clerk_123",
            user_profile_completed=False,
            workspace_board_count=4,
            workspace_id="workspace_clerk_123",
            workspace_name="Tanergy Workspace",
            workspace_plan_key="team_growth",
            workspace_memberships=[],
            workspace_role="owner",
        )

    monkeypatch.setattr(
        "tangent_api.request_context.resolve_authenticated_request_context",
        fake_resolve_authenticated_request_context,
    )
    monkeypatch.setattr(
        "tangent_api.routers.auth.update_auth_profile",
        lambda user_id, display_name: type("Profile", (), {
            "avatar_initials": "NN",
            "display_name": display_name,
            "email": "user@example.com",
            "email_verified": True,
            "profile_completed": True,
            "user_id": user_id,
        })(),
    )
    client = TestClient(app)

    response = client.patch(
        "/api/v1/auth/profile",
        headers={"Authorization": "Bearer valid-token"},
        json={"displayName": "New Name"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["user"]["displayName"] == "New Name"
    assert payload["user"]["profileCompleted"] is True


def test_auth_account_delete_requires_authenticated_session(monkeypatch):
    monkeypatch.delenv("TANGENT_REQUIRE_API_AUTH", raising=False)
    client = TestClient(app)

    response = client.request(
        "DELETE",
        "/api/v1/auth/account",
        json={"confirmation": "DELETE", "reason": "self delete"},
    )

    assert response.status_code == 401


def test_auth_account_delete_deletes_authenticated_account(monkeypatch):
    monkeypatch.setenv("TANGENT_REQUIRE_API_AUTH", "1")

    async def fake_resolve_authenticated_request_context(
        token: str,
        requested_workspace_id: Optional[str] = None,
        request_ip: Optional[str] = None,
    ) -> ApiRequestContext:
        assert token == "valid-token"
        return ApiRequestContext(
            auth_mode="required",
            is_dev_fallback=False,
            user_avatar_initials="CU",
            user_display_name="Clerk User",
            user_email="user@example.com",
            user_email_verified=True,
            user_id="user_clerk_123",
            user_profile_completed=True,
            workspace_board_count=2,
            workspace_id="workspace_clerk_123",
            workspace_name="Tanergy Workspace",
            workspace_plan_key="free_canvas",
            workspace_memberships=[],
            workspace_role="owner",
        )

    monkeypatch.setattr(
        "tangent_api.request_context.resolve_authenticated_request_context",
        fake_resolve_authenticated_request_context,
    )
    delete_calls: list[dict[str, object]] = []
    monkeypatch.setattr(
        "tangent_api.routers.auth.delete_user_account",
        lambda **kwargs: delete_calls.append(kwargs) or type(
            "DeleteResult",
            (),
            {"message": "User deleted.", "warning": None},
        )(),
    )
    client = TestClient(app)

    response = client.request(
        "DELETE",
        "/api/v1/auth/account",
        headers={"Authorization": "Bearer valid-token"},
        json={"confirmation": "DELETE", "reason": "self delete"},
    )

    assert response.status_code == 200
    assert response.json() == {"error": None, "message": "User deleted.", "ok": True, "warning": None}
    assert delete_calls == [{
        "actor_user_id": "user_clerk_123",
        "audit_action": "auth.account.delete",
        "audit_metadata": {"mode": "self"},
        "reason": "self delete",
        "target_user_id": "user_clerk_123",
        "workspace_id": "workspace_clerk_123",
    }]


def test_auth_account_delete_surfaces_structured_blockers(monkeypatch):
    monkeypatch.setenv("TANGENT_REQUIRE_API_AUTH", "1")

    async def fake_resolve_authenticated_request_context(
        token: str,
        requested_workspace_id: Optional[str] = None,
        request_ip: Optional[str] = None,
    ) -> ApiRequestContext:
        assert token == "valid-token"
        return ApiRequestContext(
            auth_mode="required",
            is_dev_fallback=False,
            user_avatar_initials="CU",
            user_display_name="Clerk User",
            user_email="user@example.com",
            user_email_verified=True,
            user_id="user_clerk_123",
            user_profile_completed=True,
            workspace_board_count=2,
            workspace_id="workspace_clerk_123",
            workspace_name="Tanergy Workspace",
            workspace_plan_key="free_canvas",
            workspace_memberships=[],
            workspace_role="owner",
        )

    monkeypatch.setattr(
        "tangent_api.request_context.resolve_authenticated_request_context",
        fake_resolve_authenticated_request_context,
    )

    def raise_blocked_delete(**kwargs):
        raise HTTPException(
            status_code=409,
            detail={
                "blockers": [{"code": "joined_team_workspace", "workspaceName": "Team One"}],
                "error": "account_delete_blocked",
                "message": "Account deletion is blocked until Team, Group, seat, subscription, and invite bindings are cleared.",
            },
        )

    monkeypatch.setattr("tangent_api.routers.auth.delete_user_account", raise_blocked_delete)
    client = TestClient(app)

    response = client.request(
        "DELETE",
        "/api/v1/auth/account",
        headers={"Authorization": "Bearer valid-token"},
        json={"confirmation": "DELETE", "reason": "self delete"},
    )

    assert response.status_code == 409
    assert response.json()["detail"]["error"] == "account_delete_blocked"
    assert response.json()["detail"]["blockers"][0]["workspaceName"] == "Team One"
