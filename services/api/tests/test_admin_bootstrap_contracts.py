from fastapi.testclient import TestClient

from tangent_api.main import app


def test_admin_page_bootstrap_returns_requested_sections(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.load_active_admin_roles",
        lambda user_id: [{"createdAt": "2026-05-09T10:00:00Z", "permissions": {}, "role": "admin"}],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.load_admin_summary",
        lambda: {
            "adminUserCount": 2,
            "boardsCount": 12,
            "usersCount": 3,
            "workspacesCount": 4,
        },
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.list_admin_directory_users",
        lambda limit, offset, search=None: (
            [
                {
                    "createdAt": "2026-05-09T10:00:00Z",
                    "displayName": "Ada Lovelace",
                    "email": "ada@example.com",
                    "groupCount": 1,
                    "id": "user_ada",
                    "locale": "en",
                    "ownedBoardCount": 7,
                    "personalWalletCredits": 240,
                    "status": "active",
                    "teamCount": 2,
                }
            ],
            3,
        ),
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.list_admin_directory_workspaces_page",
        lambda kind, limit, offset, owner_id=None, search=None: (
            [
                {
                    "boardCount": 4,
                    "createdAt": "2026-05-09T10:00:00Z",
                    "id": f"{kind}_1",
                    "kind": kind,
                    "memberCount": 2,
                    "name": f"{kind} workspace",
                    "ownerDisplayName": "Ada",
                    "ownerEmail": "ada@example.com",
                    "seatCapacity": 5,
                    "status": "active",
                    "usageCredits": 10,
                    "walletCredits": 50,
                }
            ],
            9,
        ),
    )
    client = TestClient(app)
    response = client.get(
        "/api/v1/admin/bootstrap?includeSummary=1&includeUsers=1&includeTeams=1&includeGroups=1&limit=100",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["access"]["canAccessAdmin"] is True
    assert payload["summary"]["summary"]["usersCount"] == 3
    assert payload["users"]["totalCount"] == 3
    assert payload["teams"]["limit"] == 100
    assert payload["teams"]["offset"] == 0
    assert payload["teams"]["totalCount"] == 9
    assert payload["teams"]["workspaces"][0]["kind"] == "team_workspace"
    assert payload["groups"]["workspaces"][0]["kind"] == "group_workspace"


def test_admin_user_detail_bootstrap_returns_user_and_owned_workspaces(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.load_active_admin_roles",
        lambda user_id: [{"createdAt": "2026-05-09T10:00:00Z", "permissions": {}, "role": "finance"}],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.get_admin_directory_user",
        lambda user_id: {
            "createdAt": "2026-05-09T10:00:00Z",
            "displayName": "Grace Hopper",
            "email": "grace@example.com",
            "groupCount": 1,
            "id": user_id,
            "locale": "en",
            "ownedBoardCount": 3,
            "personalWalletCredits": 120,
            "status": "active",
            "teamCount": 1,
        },
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_bootstrap.list_admin_directory_workspaces_page",
        lambda kind, limit, offset, owner_id=None, search=None: (
            [
                {
                    "boardCount": 2,
                    "createdAt": "2026-05-09T10:00:00Z",
                    "id": f"{kind}_{owner_id}",
                    "kind": kind,
                    "memberCount": 2,
                    "name": f"{kind} workspace",
                    "ownerDisplayName": "Grace",
                    "ownerEmail": "grace@example.com",
                    "ownerId": owner_id,
                    "seatCapacity": 5,
                    "status": "active",
                    "usageCredits": 10,
                    "walletCredits": 20,
                }
            ],
            4,
        ),
    )
    client = TestClient(app)
    response = client.get(
        "/api/v1/admin/bootstrap/users/user_grace?limit=100",
        headers={"x-tangent-user-id": "user_finance", "x-tangent-workspace-id": "workspace_finance"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["access"]["canAccessAdmin"] is True
    assert payload["user"]["user"]["id"] == "user_grace"
    assert payload["teams"]["totalCount"] == 4
    assert payload["teams"]["workspaces"][0]["ownerId"] == "user_grace"
    assert payload["groups"]["workspaces"][0]["ownerId"] == "user_grace"
