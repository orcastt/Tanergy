from types import SimpleNamespace

from fastapi.testclient import TestClient

from tangent_api.main import app


def test_admin_operator_users_route_returns_inventory_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="admin")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.list_admin_operator_users",
        lambda limit, offset, search=None: (
            [
                {
                    "createdAt": "2026-05-09T10:00:00Z",
                    "displayName": "Ada",
                    "email": "ada@example.com",
                    "groupPlansActive": [
                        {
                            "periodEnd": "2026-06-09T10:00:00Z",
                            "periodStart": "2026-05-09T10:00:00Z",
                            "planKey": "collaborate_plus",
                            "status": "active",
                            "subscriptionId": "sub_group_1",
                        }
                    ],
                    "id": "user_ada",
                    "ownedGroupCount": 2,
                    "ownedTeamCount": 1,
                    "personalCredit": {"remainingCredits": 560, "spentCredits": 440, "totalCredits": 1000},
                    "registrationState": "registered",
                    "status": "active",
                    "teamPlansActive": [
                        {
                            "boardCount": 3,
                            "createdAt": "2026-05-09T10:00:00Z",
                            "credit": {"remainingCredits": 1500, "spentCredits": 500, "totalCredits": 2000},
                            "id": "workspace_team_1",
                            "kind": "team_workspace",
                            "memberCount": 4,
                            "periodEnd": "2026-06-09T10:00:00Z",
                            "periodStart": "2026-05-09T10:00:00Z",
                            "planKey": "team_growth",
                            "planStatus": "active",
                            "seatCapacity": 7,
                            "subscriptionId": "sub_team_1",
                            "workspaceName": "Ada Studio",
                        }
                    ],
                    "totalCreditsSpent": 940,
                }
            ],
            320,
        ),
    )
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/operator/users?limit=50&offset=100&search=ada",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["totalCount"] == 320
    assert payload["users"][0]["teamPlansActive"][0]["workspaceName"] == "Ada Studio"
    assert payload["users"][0]["personalCredit"]["remainingCredits"] == 560.0


def test_admin_operator_user_detail_route_returns_one_bundle(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="support")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.get_admin_operator_user_detail",
        lambda user_id: {
            "billingHistory": [
                {
                    "amountCents": 30000,
                    "createdAt": "2026-05-09T10:00:00Z",
                    "id": "ledger_1",
                    "item": "team_growth",
                    "personalCreditsDelta": 0,
                    "reason": "admin correction",
                    "teamCreditsDelta": 12000,
                    "workspaceId": "workspace_team_1",
                }
            ],
            "joinedGroups": [],
            "joinedTeams": [],
            "ownedGroups": [],
            "ownedTeams": [
                {
                    "boardCount": 1,
                    "boards": [{"id": "board_1", "title": "Moodboard", "visibility": "private"}],
                    "createdAt": "2026-05-09T10:00:00Z",
                    "credit": {"remainingCredits": 1200, "spentCredits": 300, "totalCredits": 1500},
                    "id": "workspace_team_1",
                    "invitations": [
                        {
                            "acceptedAt": None,
                            "acceptedBy": None,
                            "createdAt": "2026-05-09T11:00:00Z",
                            "email": "new.member@example.com",
                            "expiresAt": "2026-05-16T11:00:00Z",
                            "id": "invite_1",
                            "invitedBy": "user_support",
                            "metadata": {"workspaceKind": "team_workspace"},
                            "revokedAt": None,
                            "role": "editor",
                            "targetUserId": None,
                            "workspaceId": "workspace_team_1",
                        }
                    ],
                    "kind": "team_workspace",
                    "memberCount": 2,
                    "members": [
                        {
                            "displayName": "Ada",
                            "email": "ada@example.com",
                            "role": "admin",
                            "usageCredits": 300,
                            "userId": user_id,
                        }
                    ],
                    "ownerEmail": "ada@example.com",
                    "ownerId": user_id,
                    "periodEnd": "2026-06-09T10:00:00Z",
                    "periodStart": "2026-05-09T10:00:00Z",
                    "planKey": "team_growth",
                    "planStatus": "active",
                    "seatCapacity": 5,
                    "subscriptionId": "sub_team_1",
                    "usageByUser": 300,
                    "workspaceName": "Ada Studio",
                }
            ],
            "user": {
                "createdAt": "2026-05-09T10:00:00Z",
                "displayName": "Ada",
                "email": "ada@example.com",
                "id": user_id,
                "personalCredit": {"remainingCredits": 560, "spentCredits": 440, "totalCredits": 1000},
                "registrationState": "registered",
                "status": "active",
                "totalCreditsSpent": 940,
            },
        },
    )
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/operator/users/user_ada",
        headers={"x-tangent-user-id": "user_support", "x-tangent-workspace-id": "workspace_support"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert payload["detail"]["user"]["id"] == "user_ada"
    assert payload["detail"]["billingHistory"][0]["teamCreditsDelta"] == 12000.0
    assert payload["detail"]["ownedTeams"][0]["invitations"][0]["email"] == "new.member@example.com"


def test_admin_operator_user_status_route_returns_mutation_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="support")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.set_admin_operator_user_status",
        lambda **kwargs: {
            "auditId": "admin_audit_status",
            "message": "User status updated to suspended.",
            "ok": True,
            "status": "suspended",
            "userId": kwargs["user_id"],
            "warning": None,
        },
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/operator/users/user_ada/status",
        headers={"x-tangent-user-id": "user_support", "x-tangent-workspace-id": "workspace_support"},
        json={"reason": "support action", "status": "suspended"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "auditId": "admin_audit_status",
        "message": "User status updated to suspended.",
        "ok": True,
        "status": "suspended",
        "userId": "user_ada",
        "warning": None,
    }


def test_admin_operator_user_delete_route_returns_mutation_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="admin")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.hard_delete_admin_operator_user",
        lambda **kwargs: {
            "auditId": "admin_audit_delete",
            "message": "User deleted.",
            "ok": True,
            "status": "deleted",
            "userId": kwargs["user_id"],
            "warning": None,
        },
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/operator/users/user_ada/delete",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
        json={"reason": "refund"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload == {
        "auditId": "admin_audit_delete",
        "message": "User deleted.",
        "ok": True,
        "status": "deleted",
        "userId": "user_ada",
        "warning": None,
    }


def test_admin_operator_subscription_freeze_route_returns_mutation_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="admin")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.freeze_admin_operator_subscription",
        lambda **kwargs: {
            "auditId": "admin_audit_freeze",
            "message": "Subscription frozen.",
            "ok": True,
            "status": "paused",
            "subscriptionId": kwargs["subscription_id"],
            "workspaceId": "workspace_team_1",
        },
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/operator/subscriptions/sub_team_1/freeze",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
        json={"reason": "pause team plan"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "auditId": "admin_audit_freeze",
        "message": "Subscription frozen.",
        "ok": True,
        "status": "paused",
        "subscriptionId": "sub_team_1",
        "userId": None,
        "workspaceId": "workspace_team_1",
    }


def test_admin_operator_subscription_unfreeze_route_returns_mutation_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="support")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.unfreeze_admin_operator_subscription",
        lambda **kwargs: {
            "auditId": "admin_audit_unfreeze",
            "message": "Subscription unfrozen.",
            "ok": True,
            "status": "active",
            "subscriptionId": kwargs["subscription_id"],
            "userId": "user_ada",
        },
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/operator/subscriptions/sub_group_1/unfreeze",
        headers={"x-tangent-user-id": "user_support", "x-tangent-workspace-id": "workspace_support"},
        json={"reason": "resume collaborate"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "auditId": "admin_audit_unfreeze",
        "message": "Subscription unfrozen.",
        "ok": True,
        "status": "active",
        "subscriptionId": "sub_group_1",
        "userId": "user_ada",
        "workspaceId": None,
    }


def test_admin_operator_workspace_member_role_route_returns_mutation_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="support")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.update_admin_operator_workspace_member_role",
        lambda **kwargs: {
            "auditId": "admin_audit_member_role",
            "message": "Workspace member role updated.",
            "ok": True,
            "role": kwargs["role"],
            "userId": kwargs["user_id"],
            "workspaceId": kwargs["workspace_id"],
        },
    )
    client = TestClient(app)

    response = client.patch(
        "/api/v1/admin/operator/workspaces/workspace_team_1/members/user_ada",
        headers={"x-tangent-user-id": "user_support", "x-tangent-workspace-id": "workspace_support"},
        json={"reason": "align permissions", "role": "editor"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "auditId": "admin_audit_member_role",
        "message": "Workspace member role updated.",
        "ok": True,
        "role": "editor",
        "userId": "user_ada",
        "workspaceId": "workspace_team_1",
    }


def test_admin_operator_workspace_member_remove_route_returns_mutation_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="admin")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.remove_admin_operator_workspace_member",
        lambda **kwargs: {
            "auditId": "admin_audit_member_remove",
            "message": "Workspace member removed.",
            "ok": True,
            "role": None,
            "userId": kwargs["user_id"],
            "workspaceId": kwargs["workspace_id"],
        },
    )
    client = TestClient(app)

    response = client.request(
        "DELETE",
        "/api/v1/admin/operator/workspaces/workspace_group_1/members/user_ada",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
        json={"reason": "remove from workspace"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "auditId": "admin_audit_member_remove",
        "message": "Workspace member removed.",
        "ok": True,
        "role": None,
        "userId": "user_ada",
        "workspaceId": "workspace_group_1",
    }


def test_admin_operator_workspace_member_add_route_returns_mutation_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="admin")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.create_admin_operator_workspace_member",
        lambda **kwargs: {
            "auditId": "admin_audit_member_add",
            "message": "Workspace member added.",
            "ok": True,
            "role": kwargs["role"],
            "userId": kwargs["user_id"],
            "workspaceId": kwargs["workspace_id"],
        },
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/operator/workspaces/workspace_team_1/members",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
        json={"reason": "seat assigned", "role": "viewer", "userId": "user_new"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "auditId": "admin_audit_member_add",
        "message": "Workspace member added.",
        "ok": True,
        "role": "viewer",
        "userId": "user_new",
        "workspaceId": "workspace_team_1",
    }


def test_admin_operator_workspace_invitations_list_route_returns_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="support")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.list_admin_operator_workspace_invitations",
        lambda workspace_id: [
            {
                "acceptedAt": None,
                "acceptedBy": None,
                "createdAt": "2026-05-10T10:00:00Z",
                "email": "invitee@example.com",
                "expiresAt": "2026-05-17T10:00:00Z",
                "id": "invite_1",
                "invitedBy": "user_admin",
                "metadata": {"workspaceKind": "team_workspace"},
                "revokedAt": None,
                "role": "editor",
                "targetUserId": None,
                "workspaceId": workspace_id,
            }
        ],
    )
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/operator/workspaces/workspace_team_1/invitations",
        headers={"x-tangent-user-id": "user_support", "x-tangent-workspace-id": "workspace_support"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "invitations": [
            {
                "acceptedAt": None,
                "acceptedBy": None,
                "createdAt": "2026-05-10T10:00:00Z",
                "email": "invitee@example.com",
                "expiresAt": "2026-05-17T10:00:00Z",
                "id": "invite_1",
                "invitedBy": "user_admin",
                "metadata": {"workspaceKind": "team_workspace"},
                "revokedAt": None,
                "role": "editor",
                "targetUserId": None,
                "workspaceId": "workspace_team_1",
            }
        ],
        "ok": True,
        "workspaceId": "workspace_team_1",
    }


def test_admin_operator_workspace_invitation_create_route_returns_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="admin")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.create_admin_operator_workspace_invitation",
        lambda **kwargs: {
            "acceptPath": "/api/v1/workspaces/invitations/token_1/accept",
            "auditId": "admin_audit_invite_create",
            "invitation": {
                "acceptedAt": None,
                "acceptedBy": None,
                "createdAt": "2026-05-10T10:00:00Z",
                "email": kwargs["email"],
                "expiresAt": "2026-05-17T10:00:00Z",
                "id": "invite_1",
                "invitedBy": "user_admin",
                "metadata": {"workspaceKind": "team_workspace"},
                "revokedAt": None,
                "role": kwargs["role"],
                "targetUserId": kwargs["target_user_id"],
                "workspaceId": kwargs["workspace_id"],
            },
            "message": "Workspace invitation created.",
            "ok": True,
            "token": "token_1",
            "workspaceId": kwargs["workspace_id"],
        },
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/operator/workspaces/workspace_team_1/invitations",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
        json={"email": "invitee@example.com", "expiresInDays": 7, "reason": "add editor", "role": "editor"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Workspace invitation created."
    assert response.json()["acceptPath"] == "/api/v1/workspaces/invitations/token_1/accept"
    assert response.json()["workspaceId"] == "workspace_team_1"


def test_admin_operator_workspace_invitation_revoke_route_returns_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="support")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.revoke_admin_operator_workspace_invitation",
        lambda **kwargs: {
            "auditId": "admin_audit_invite_revoke",
            "invitation": {
                "acceptedAt": None,
                "acceptedBy": None,
                "createdAt": "2026-05-10T10:00:00Z",
                "email": "invitee@example.com",
                "expiresAt": "2026-05-17T10:00:00Z",
                "id": kwargs["invitation_id"],
                "invitedBy": "user_admin",
                "metadata": {"workspaceKind": "team_workspace"},
                "revokedAt": "2026-05-10T11:00:00Z",
                "role": "viewer",
                "targetUserId": None,
                "workspaceId": kwargs["workspace_id"],
            },
            "message": "Workspace invitation revoked.",
            "ok": True,
            "workspaceId": kwargs["workspace_id"],
        },
    )
    client = TestClient(app)

    response = client.request(
        "DELETE",
        "/api/v1/admin/operator/workspaces/workspace_group_1/invitations/invite_1",
        headers={"x-tangent-user-id": "user_support", "x-tangent-workspace-id": "workspace_support"},
        json={"reason": "cleanup"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Workspace invitation revoked."
    assert response.json()["workspaceId"] == "workspace_group_1"


def test_admin_operator_board_copy_route_returns_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="admin")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.copy_admin_operator_board",
        lambda **kwargs: {
            "auditId": "admin_audit_board_copy",
            "board": {
                "assetCount": 0,
                "byteSize": 512,
                "cardColor": None,
                "createdAt": "2026-05-10T10:00:00Z",
                "description": None,
                "id": "board_copy_1",
                "isPinned": False,
                "isStarred": False,
                "lastOpenedAt": None,
                "ownerId": "user_ada",
                "savedAt": "2026-05-10T10:00:00Z",
                "shapeCount": 2,
                "shareId": None,
                "thumbnailUrl": None,
                "title": "Board Copy",
                "visibility": "private",
                "workspaceId": kwargs["workspace_id"],
            },
            "boardId": "board_copy_1",
            "message": "Board copied.",
            "ok": True,
            "workspaceId": kwargs["workspace_id"],
        },
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/operator/workspaces/workspace_team_1/boards/board_1/copy",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
        json={"reason": "support duplicate"},
    )

    assert response.status_code == 200
    assert response.json()["message"] == "Board copied."
    assert response.json()["boardId"] == "board_copy_1"


def test_admin_operator_board_delete_route_returns_shape(monkeypatch):
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.require_admin_role",
        lambda context, allowed_roles=None: [SimpleNamespace(role="admin")],
    )
    monkeypatch.setattr(
        "tangent_api.routers.admin_operator.delete_admin_operator_board_write",
        lambda **kwargs: {
            "auditId": "admin_audit_board_delete",
            "board": None,
            "boardId": kwargs["board_id"],
            "message": "Board deleted.",
            "ok": True,
            "workspaceId": kwargs["workspace_id"],
        },
    )
    client = TestClient(app)

    response = client.request(
        "DELETE",
        "/api/v1/admin/operator/workspaces/workspace_team_1/boards/board_1",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
        json={"reason": "remove duplicate"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "auditId": "admin_audit_board_delete",
        "board": None,
        "boardId": "board_1",
        "message": "Board deleted.",
        "ok": True,
        "workspaceId": "workspace_team_1",
    }
