from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_admin_bootstrap_plain_user_does_not_load_requested_admin_data(monkeypatch):
    fake_db = FakePostgresDatabase()
    _wire_admin_roles(monkeypatch, fake_db)
    _block_bootstrap_loaders(monkeypatch)

    response = TestClient(app).get(
        "/api/v1/admin/bootstrap?includeSummary=1&includeUsers=1&includeTeams=1&includeGroups=1&includeOperatorUsers=1",
        headers={"x-tangent-user-id": "user_plain", "x-tangent-workspace-id": "workspace_plain"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["access"]["canAccessAdmin"] is False
    assert payload["summary"]["ok"] is False
    assert payload["users"]["ok"] is False
    assert payload["teams"]["ok"] is False
    assert payload["groups"]["ok"] is False
    assert payload["operatorUsers"]["ok"] is False


def test_admin_bootstrap_role_without_section_grant_does_not_load_all_data(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [_admin_role("user_support", "support")]
    _wire_admin_roles(monkeypatch, fake_db)
    _block_bootstrap_loaders(monkeypatch)

    response = TestClient(app).get(
        "/api/v1/admin/bootstrap?includeSummary=1&includeUsers=1&includeTeams=1&includeGroups=1&includeOperatorUsers=1",
        headers={"x-tangent-user-id": "user_support", "x-tangent-workspace-id": "workspace_support"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["access"]["roles"][0]["role"] == "support"
    assert payload["access"]["canAccessAdmin"] is False
    assert payload["summary"]["ok"] is False
    assert payload["users"]["ok"] is False
    assert payload["teams"]["ok"] is False
    assert payload["groups"]["ok"] is False
    assert payload["operatorUsers"]["ok"] is False


def test_admin_bootstrap_finance_loads_only_requested_allowed_sections(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [_admin_role("user_finance", "finance")]
    _wire_admin_roles(monkeypatch, fake_db)
    calls: list[str] = []

    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.load_admin_summary",
        lambda: calls.append("summary") or {"adminUserCount": 1, "boardsCount": 0, "usersCount": 3, "workspacesCount": 2},
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.list_admin_directory_users",
        lambda limit, offset, search=None: calls.append("users") or ([], 3),
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.list_admin_operator_users",
        lambda limit, offset, search=None: calls.append("operator") or ([], 4),
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.list_admin_directory_workspaces_page",
        lambda kind, limit, offset, owner_id=None, search=None: calls.append(kind) or ([], 2),
    )

    response = TestClient(app).get(
        "/api/v1/admin/bootstrap?includeSummary=1&includeUsers=0&includeTeams=1&includeGroups=0&includeOperatorUsers=1",
        headers={"x-tangent-user-id": "user_finance", "x-tangent-workspace-id": "workspace_finance"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["access"]["canAccessAdmin"] is True
    assert payload["summary"]["ok"] is True
    assert payload["users"]["ok"] is False
    assert payload["teams"]["ok"] is True
    assert payload["groups"]["ok"] is False
    assert payload["operatorUsers"]["ok"] is True
    assert calls == ["summary", "operator", "team_workspace"]


def _wire_admin_roles(monkeypatch, fake_db: FakePostgresDatabase) -> None:
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)


def _admin_role(user_id: str, role: str) -> dict[str, object]:
    return {
        "created_at": "2026-05-20T00:00:00Z",
        "granted_by": "user_owner",
        "note": "contract test",
        "permissions": {},
        "revoked_at": None,
        "role": role,
        "user_id": user_id,
    }


def _block_bootstrap_loaders(monkeypatch) -> None:
    def fail(*_args, **_kwargs):
        raise AssertionError("bootstrap data loader should not run without the matching admin role")

    monkeypatch.setattr("tangent_api.routers.admin_bootstrap.load_admin_summary", fail)
    monkeypatch.setattr("tangent_api.routers.admin_bootstrap.list_admin_directory_users", fail)
    monkeypatch.setattr("tangent_api.routers.admin_bootstrap.list_admin_operator_users", fail)
    monkeypatch.setattr("tangent_api.routers.admin_bootstrap.list_admin_directory_workspaces_page", fail)
