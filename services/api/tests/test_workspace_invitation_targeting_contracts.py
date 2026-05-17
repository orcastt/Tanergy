import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from tangent_api.auth_provider import _resolve_clerk_email
from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext
from tangent_api.workspace_invitation_support import (
    assert_invitation_target,
    assert_team_invite_workspace_ready,
    resolve_invitation_target_user_id,
)
from tests.persistence_fakes import FakePostgresDatabase


def test_resolve_clerk_email_reads_email_address_claim():
    email, verified = _resolve_clerk_email(
        {
            "email_address": "visible@example.com",
            "email_verified": True,
        }
    )

    assert email == "visible@example.com"
    assert verified is True


def test_resolve_clerk_email_reads_primary_email_from_email_addresses():
    email, verified = _resolve_clerk_email(
        {
            "email_addresses": [
                {
                    "email_address": "secondary@example.com",
                    "id": "email_secondary",
                    "verification": {"status": "unverified"},
                },
                {
                    "email_address": "primary@example.com",
                    "id": "email_primary",
                    "verification": {"status": "verified"},
                },
            ],
            "primary_email_address_id": "email_primary",
        }
    )

    assert email == "primary@example.com"
    assert verified is True


def test_assert_invitation_target_prefers_target_user_id_over_synthetic_email():
    row = (
        "invite_123",
        "workspace_team",
        "visible@example.com",
        "editor",
        "user_owner",
        None,
        "2999-01-01T00:00:00Z",
        None,
        None,
        "2026-05-17T00:00:00Z",
        "token_hash",
        "user_target",
        {"workspaceKind": "team_workspace"},
    )

    assert_invitation_target(row, build_context(user_email="user_target@clerk.local", user_id="user_target"))


def test_assert_invitation_target_rejects_wrong_sign_in_email():
    row = (
        "invite_123",
        "workspace_group",
        "visible@example.com",
        "viewer",
        "user_owner",
        None,
        "2999-01-01T00:00:00Z",
        None,
        None,
        "2026-05-17T00:00:00Z",
        "token_hash",
        None,
        {"workspaceKind": "group_workspace"},
    )

    with pytest.raises(HTTPException) as exc:
        assert_invitation_target(row, build_context(user_email="other@example.com"))

    assert exc.value.status_code == 403
    assert exc.value.detail == "Workspace invitation is for another sign-in email."


def test_resolve_invitation_target_user_id_finds_known_user_email():
    cursor = StubCursor(("user_known",))

    result = resolve_invitation_target_user_id(cursor, "visible@example.com")

    assert result == "user_known"
    assert cursor.params == ("visible@example.com",)


def test_team_invite_workspace_ready_requires_active_subscription():
    cursor = StubCursor(None)

    with pytest.raises(HTTPException) as exc:
        assert_team_invite_workspace_ready(cursor, "workspace_team")

    assert exc.value.status_code == 402
    assert exc.value.detail == "This Team workspace needs an active Team subscription before invite links can be used."


def test_team_workspace_invite_create_requires_active_subscription(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/workspaces/current/invitations",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
        json={"role": "editor"},
    )

    assert response.status_code == 402
    assert response.json()["detail"] == "This Team workspace needs an active Team subscription before invite links can be used."


def build_context(*, user_email: str, user_id: str = "user_current") -> ApiRequestContext:
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials="TC",
        user_display_name="Test Current",
        user_email=user_email,
        user_email_verified=True,
        user_id=user_id,
        user_profile_completed=True,
        workspace_board_count=0,
        workspace_id="workspace_personal",
        workspace_kind="solo_workspace",
        workspace_memberships=[],
        workspace_name="Personal workspace",
        workspace_plan_key="free_canvas",
        workspace_role="owner",
    )


class StubCursor:
    def __init__(self, row):
        self.params = None
        self.row = row

    def execute(self, _query, params=None):
        self.params = params

    def fetchone(self):
        return self.row
