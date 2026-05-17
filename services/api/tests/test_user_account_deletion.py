from __future__ import annotations

from typing import Any

import pytest
from fastapi import HTTPException

from tangent_api.user_account_deletion import UserAccountDeletionBlocker, delete_user_account


class _FakeCursorContext:
    def __init__(self, cursor: "_FakeCursor") -> None:
        self._cursor = cursor

    def __enter__(self) -> "_FakeCursor":
        return self._cursor

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False


class _FakeCursor:
    def __init__(self) -> None:
        self.executed: list[tuple[str, tuple[Any, ...] | None]] = []

    def __enter__(self) -> "_FakeCursor":
        return self

    def __exit__(self, exc_type, exc, tb) -> bool:
        return False

    def execute(self, query: str, params: tuple[Any, ...] | None = None) -> None:
        self.executed.append((query, params))


class _FakeConnection:
    def __init__(self) -> None:
        self.cursor_instance = _FakeCursor()

    def cursor(self) -> _FakeCursorContext:
        return _FakeCursorContext(self.cursor_instance)


class _FakeConnectionManager:
    def __init__(self) -> None:
        self.connection = _FakeConnection()
        self.committed = False
        self.rolled_back = False

    def __enter__(self) -> _FakeConnection:
        return self.connection

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is None:
            self.committed = True
        else:
            self.rolled_back = True
        return False


def _install_delete_test_stubs(monkeypatch, manager: _FakeConnectionManager) -> None:
    monkeypatch.setattr("tangent_api.user_account_deletion.require_database_url", lambda: "postgres://test")
    monkeypatch.setattr("tangent_api.user_account_deletion.connect_to_postgres", lambda: manager)
    monkeypatch.setattr("tangent_api.user_account_deletion._insert_admin_audit_log", lambda *args, **kwargs: "audit_1")
    monkeypatch.setattr(
        "tangent_api.user_account_deletion._load_user_deletion_context",
        lambda user_id: type("Context", (), {"clerk_user_id": "clerk_123", "status": "active"})(),
    )
    monkeypatch.setattr("tangent_api.user_account_deletion._guard_last_active_owner", lambda user_id: None)
    monkeypatch.setattr("tangent_api.user_account_deletion._load_account_delete_blockers", lambda user_id: [])
    monkeypatch.setattr("tangent_api.user_account_deletion._load_shared_workspace_ids", lambda user_id: [])
    monkeypatch.setattr("tangent_api.user_account_deletion._load_owned_solo_workspace_ids", lambda user_id: ["solo_1"])
    monkeypatch.setattr("tangent_api.user_account_deletion._reassign_shared_workspace_content", lambda *args, **kwargs: None)
    monkeypatch.setattr("tangent_api.user_account_deletion._delete_user_scoped_logs", lambda *args, **kwargs: None)
    monkeypatch.setattr("tangent_api.user_account_deletion._delete_user_owned_resources", lambda *args, **kwargs: None)
    monkeypatch.setattr("tangent_api.user_account_deletion._delete_user_credit_accounts", lambda *args, **kwargs: None)


def test_delete_user_account_commits_only_after_clerk_delete(monkeypatch):
    manager = _FakeConnectionManager()
    _install_delete_test_stubs(monkeypatch, manager)

    clerk_calls: list[str] = []
    monkeypatch.setattr("tangent_api.user_account_deletion.delete_clerk_user", lambda user_id: clerk_calls.append(user_id))

    result = delete_user_account(
        actor_user_id="user_admin",
        audit_action="admin.operator.user.delete",
        audit_metadata={"mode": "admin"},
        reason="privacy request",
        target_user_id="user_target",
        workspace_id="workspace_admin",
    )

    assert clerk_calls == ["clerk_123"]
    assert manager.committed is True
    assert manager.rolled_back is False
    assert result.warning is None
    assert result.deleted_solo_workspace_ids == ("solo_1",)
    assert manager.connection.cursor_instance.executed[-1] == (
        "DELETE FROM tangent_users WHERE id = %s",
        ("user_target",),
    )


def test_delete_user_account_raises_structured_blockers(monkeypatch):
    manager = _FakeConnectionManager()
    _install_delete_test_stubs(monkeypatch, manager)
    monkeypatch.setattr(
        "tangent_api.user_account_deletion._load_account_delete_blockers",
        lambda user_id: [
            UserAccountDeletionBlocker(
                code="joined_team_workspace",
                message="Still a member of a Team or Group workspace.",
                role="member",
                workspace_id="workspace_team_1",
                workspace_kind="team_workspace",
                workspace_name="Team One",
            ),
            UserAccountDeletionBlocker(
                code="active_subscription",
                message="Has an active subscription that must be canceled or cleared first.",
                plan_key="collaborate_plus",
                subscription_id="sub_123",
            ),
        ],
    )

    with pytest.raises(HTTPException) as exc_info:
        delete_user_account(
            actor_user_id="user_admin",
            audit_action="admin.operator.user.delete",
            audit_metadata={"mode": "admin"},
            reason="privacy request",
            target_user_id="user_target",
            workspace_id="workspace_admin",
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == {
        "blockers": [
            {
                "code": "joined_team_workspace",
                "message": "Still a member of a Team or Group workspace.",
                "role": "member",
                "workspaceId": "workspace_team_1",
                "workspaceKind": "team_workspace",
                "workspaceName": "Team One",
            },
            {
                "code": "active_subscription",
                "message": "Has an active subscription that must be canceled or cleared first.",
                "planKey": "collaborate_plus",
                "subscriptionId": "sub_123",
            },
        ],
        "error": "account_delete_blocked",
        "message": "Account deletion is blocked until Team, Group, seat, subscription, and invite bindings are cleared.",
    }
    assert manager.committed is False
    assert manager.rolled_back is False


def test_delete_user_account_rolls_back_when_clerk_delete_fails(monkeypatch):
    manager = _FakeConnectionManager()
    _install_delete_test_stubs(monkeypatch, manager)

    def _raise_clerk_failure(user_id: str) -> None:
        raise HTTPException(status_code=502, detail="Clerk account deletion failed.")

    monkeypatch.setattr("tangent_api.user_account_deletion.delete_clerk_user", _raise_clerk_failure)

    with pytest.raises(HTTPException) as exc_info:
        delete_user_account(
            actor_user_id=None,
            audit_action=None,
            audit_metadata=None,
            reason="privacy request",
            target_user_id="user_target",
            workspace_id=None,
        )

    assert exc_info.value.status_code == 502
    assert manager.committed is False
    assert manager.rolled_back is True
    assert manager.connection.cursor_instance.executed[-1] == (
        "DELETE FROM tangent_users WHERE id = %s",
        ("user_target",),
    )
