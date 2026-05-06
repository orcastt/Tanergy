from fastapi.testclient import TestClient

from tangent_api.main import app


def test_billing_me_returns_actor_personal_team_contract():
    client = TestClient(app)

    response = client.get(
        "/api/v1/billing/me",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["chargeScope"] == "actor_personal"
    assert payload["payerLabel"] == "Charges your credits"
    assert payload["plan"]["planKey"] == "team_start"
    assert payload["plan"]["includedCredits"] == 2500
    assert payload["workspace"]["kind"] == "team_workspace"
    assert payload["credits"]["includedTotal"] == 2500


def test_workspace_dashboard_keeps_group_usage_private():
    client = TestClient(app)

    response = client.get(
        "/api/v1/workspaces/current/dashboard",
        headers={
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert response.status_code == 200
    dashboard = response.json()["dashboard"]
    assert dashboard["dashboardKind"] == "group_structure"
    assert dashboard["canSeeMemberUsage"] is False
    assert dashboard["members"][0]["usageThisCycle"] is None
    assert dashboard["totalUsageThisCycle"] is None
    assert dashboard["workspace"]["kind"] == "group_workspace"


def test_workspace_dashboard_exposes_team_usage_to_owner():
    client = TestClient(app)

    response = client.get(
        "/api/v1/workspaces/current/dashboard",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )

    assert response.status_code == 200
    dashboard = response.json()["dashboard"]
    assert dashboard["dashboardKind"] == "team_usage"
    assert dashboard["canSeeMemberUsage"] is True
    assert dashboard["members"][0]["usageThisCycle"] is not None
    assert dashboard["totalUsageThisCycle"] == dashboard["members"][0]["usageThisCycle"]


def test_workspace_entitlement_returns_ai_charge_summary():
    client = TestClient(app)

    response = client.get(
        "/api/v1/workspaces/current/entitlement",
        headers={
            "x-tangent-user-id": "user_team_member",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["charge"]["chargedScope"] == "actor_personal"
    assert payload["charge"]["entitlementSource"] == "team_seat_allowance"
    assert payload["charge"]["workspaceSeatId"] == "seat_workspace_team_user_team_member"
    assert payload["plan"]["planKey"] == "team_start"
