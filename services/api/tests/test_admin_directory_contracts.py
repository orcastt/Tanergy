from types import SimpleNamespace

from fastapi.testclient import TestClient

from tangent_api.admin_directory_users import _user_where
from tangent_api.main import app


def test_admin_directory_users_route_supports_pagination_and_search(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_directory.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="admin")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_directory.list_admin_directory_users",
        lambda limit, offset, search=None: (
            [
                {
                    "collaboratePlanKey": "collaborate_plus",
                    "collaboratePlanStatus": "active",
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
                    "teamPlanKey": "team_growth",
                    "teamPlanStatus": "active",
                }
            ],
            320,
        ),
    )
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/directory/users?limit=50&offset=100&search=ada",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "error": None,
        "limit": 50,
        "offset": 100,
        "ok": True,
        "totalCount": 320,
        "users": [
            {
                "collaboratePeriodEnd": None,
                "collaboratePlanKey": "collaborate_plus",
                "collaboratePlanStatus": "active",
                "collaborateSubscriptionId": None,
                "createdAt": "2026-05-09T10:00:00Z",
                "displayName": "Ada Lovelace",
                "email": "ada@example.com",
                "groupCount": 1,
                "id": "user_ada",
                "lastLoginAt": None,
                "locale": "en",
                "ownedBoardCount": 7,
                "personalCreditsSpent": 0.0,
                "personalWalletCredits": 240.0,
                "status": "active",
                "teamCount": 2,
                "teamCreditsSpent": 0.0,
                "teamPeriodEnd": None,
                "teamPlanKey": "team_growth",
                "teamPlanStatus": "active",
                "teamSubscriptionId": None,
                "totalCreditsSpent": 0.0,
            }
        ],
    }


def test_admin_directory_user_detail_route_returns_single_user(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_directory.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="support")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_directory.get_admin_directory_user",
        lambda user_id: {
            "collaboratePlanKey": "collaborate_start",
            "collaboratePlanStatus": "active",
            "collaborateSubscriptionId": None,
            "createdAt": "2026-05-01T09:00:00Z",
            "displayName": "Grace Hopper",
            "email": "grace@example.com",
            "groupCount": 0,
            "id": user_id,
            "locale": "en",
            "ownedBoardCount": 3,
            "personalCreditsSpent": 0.0,
            "personalWalletCredits": 120,
            "status": "active",
            "teamCount": 1,
            "teamCreditsSpent": 0.0,
            "teamPlanKey": "team_start",
            "teamPlanStatus": "active",
            "teamSubscriptionId": None,
            "totalCreditsSpent": 0.0,
        },
    )
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/directory/users/user_grace",
        headers={"x-tangent-user-id": "user_support", "x-tangent-workspace-id": "workspace_support"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["user"]["id"] == "user_grace"
    assert payload["user"]["teamPlanKey"] == "team_start"
    assert payload["user"]["collaboratePlanKey"] == "collaborate_start"


def test_admin_directory_workspaces_route_supports_search(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_directory.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="support")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_directory.list_admin_directory_workspaces_page",
        lambda kind, limit, offset, owner_id=None, search=None: (
            [
                {
                    "boardCount": 12,
                    "createdAt": "2026-05-10T09:00:00Z",
                    "id": "workspace_team_ada",
                    "kind": kind,
                    "memberCount": 4,
                    "name": "Ada Studio",
                    "ownerDisplayName": "Ada Lovelace",
                    "ownerEmail": "ada@example.com",
                    "ownerId": owner_id,
                    "planKey": "team_growth",
                    "planStatus": "active",
                    "seatCapacity": 7,
                    "status": "active",
                    "subscriptionId": "sub_team_1",
                    "subscriptionPeriodEnd": "2026-06-10T09:00:00Z",
                    "usageCredits": 900,
                    "walletCredits": 2100,
                }
            ],
            84,
        ),
    )
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/directory/workspaces?kind=team_workspace&limit=25&offset=50&ownerId=user_ada&search=ada",
        headers={"x-tangent-user-id": "user_support", "x-tangent-workspace-id": "workspace_support"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "error": None,
        "limit": 25,
        "offset": 50,
        "ok": True,
        "totalCount": 84,
        "workspaces": [
            {
                "boardCount": 12,
                "createdAt": "2026-05-10T09:00:00Z",
                "id": "workspace_team_ada",
                "kind": "team_workspace",
                "memberCount": 4,
                "name": "Ada Studio",
                "ownerCollaboratePlanKey": None,
                "ownerCollaborateSubscriptionId": None,
                "ownerDisplayName": "Ada Lovelace",
                "ownerEmail": "ada@example.com",
                "ownerId": "user_ada",
                "planKey": "team_growth",
                "planStatus": "active",
                "seatCapacity": 7,
                "status": "active",
                "subscriptionId": "sub_team_1",
                "subscriptionPeriodEnd": "2026-06-10T09:00:00Z",
                "usageCredits": 900.0,
                "walletCredits": 2100.0,
            }
        ],
    }
    payload = response.json()
    assert payload["workspaces"][0]["name"] == "Ada Studio"
    assert payload["workspaces"][0]["walletCredits"] == 2100.0


def test_admin_directory_user_where_keeps_null_status_rows_visible():
    where, params = _user_where(None)

    assert where == ["COALESCE(u.status, 'active') <> 'deleted'"]
    assert params == []
