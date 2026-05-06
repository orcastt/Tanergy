from fastapi.testclient import TestClient
import pytest
from fastapi import HTTPException

from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext
from tangent_api.workspace_entitlements import upsert_workspace_seat_assignment
from tangent_api.workspace_schemas import WorkspaceSeatAssignmentUpsertRequest
from tests.persistence_fakes import FakePostgresDatabase


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


def test_billing_me_supports_team_growth_plan_contract():
    client = TestClient(app)

    response = client.get(
        "/api/v1/billing/me",
        headers={
            "x-tangent-plan-key": "team_growth",
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["chargeScope"] == "actor_personal"
    assert payload["plan"]["planKey"] == "team_growth"
    assert payload["plan"]["includedCredits"] == 5500
    assert payload["plan"]["monthlyPriceUsd"] == 45
    assert payload["credits"]["includedTotal"] == 5500


def test_billing_me_supports_collaborate_plus_plan_contract():
    client = TestClient(app)

    response = client.get(
        "/api/v1/billing/me",
        headers={
            "x-tangent-plan-key": "collaborate_plus",
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["chargeScope"] == "actor_personal"
    assert payload["plan"]["planKey"] == "collaborate_plus"
    assert payload["plan"]["includedCredits"] == 2000
    assert payload["plan"]["monthlyPriceUsd"] == 25


def test_workspace_entitlement_uses_database_team_seat_assignment(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_accounts = [
        {
            "id": "credit_db_team_member",
            "owner_id": "user_team_member",
            "owner_type": "user",
            "status": "active",
        }
    ]
    fake_db.workspace_seat_assignments = [
        {
            "id": "seat_db_growth_1",
            "included_credits": 6200,
            "plan_key": "team_growth",
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
            "user_id": "user_team_member",
            "workspace_id": "workspace_team",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
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
    assert payload["charge"]["chargedAccountId"] == "credit_db_team_member"
    assert payload["charge"]["workspaceSeatId"] == "seat_db_growth_1"
    assert payload["plan"]["planKey"] == "team_growth"
    assert payload["plan"]["includedCredits"] == 6200


def test_billing_me_uses_database_personal_subscription(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_accounts = [
        {
            "id": "credit_user_group_paid",
            "owner_id": "user_group_paid",
            "owner_type": "user",
            "status": "active",
        }
    ]
    fake_db.subscriptions = [
        {
            "account_id": "credit_user_group_paid",
            "plan_key": "collaborate_plus",
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/billing/me",
        headers={
            "x-tangent-user-id": "user_group_paid",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["chargeScope"] == "actor_personal"
    assert payload["payerLabel"] == "Charges your credits"
    assert payload["plan"]["planKey"] == "collaborate_plus"
    assert payload["credits"]["includedTotal"] == 2000


def test_billing_me_rejects_plan_key_for_wrong_workspace_kind():
    client = TestClient(app)

    response = client.get(
        "/api/v1/billing/me",
        headers={
            "x-tangent-plan-key": "team_growth",
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Invalid workspace plan key."


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


def test_credit_ledger_returns_balance_and_recent_entries(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_ledger = [
        {
            "account_id": "credit_user_user_ledger",
            "actor_user_id": "user_ledger",
            "created_at": "2026-05-06T00:00:00Z",
            "credits_delta": 100,
            "id": "ledger_grant",
            "metadata": {"grant": "monthly"},
            "reason": "subscription_grant",
            "source_id": "sub_1",
            "source_type": "subscription",
            "workspace_id": "workspace_group",
        },
        {
            "account_id": "credit_user_user_ledger",
            "actor_user_id": "user_ledger",
            "created_at": "2026-05-06T00:10:00Z",
            "credits_delta": -15,
            "id": "ledger_usage",
            "metadata": {"runId": "run_1"},
            "reason": "usage_charge",
            "source_id": "run_1",
            "source_type": "ai_run",
            "workspace_id": "workspace_group",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/credits/ledger",
        headers={
            "x-tangent-user-id": "user_ledger",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["accountId"] == "credit_user_user_ledger"
    assert payload["balanceCredits"] == 85
    assert [entry["id"] for entry in payload["entries"]] == ["ledger_usage", "ledger_grant"]


def test_credit_preflight_reports_shortfall(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_ledger = [
        {
            "account_id": "credit_user_user_preflight",
            "credits_delta": 12,
            "id": "ledger_topup",
            "reason": "topup_purchase",
            "source_type": "payment",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/credits/preflight?requiredCredits=20",
        headers={
            "x-tangent-user-id": "user_preflight",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["accountId"] == "credit_user_user_preflight"
    assert payload["availableCredits"] == 12
    assert payload["canRun"] is False
    assert payload["preflightStatus"] == "insufficient_credits"
    assert payload["shortfallCredits"] == 8


def test_team_owner_can_assign_and_list_seats(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspace_members = [
        {
            "display_name": "Team Member",
            "role": "member",
            "user_id": "user_team_member",
            "workspace_id": "workspace_team",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    assigned = client.post(
        "/api/v1/workspaces/current/seats",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
        json={
            "includedCredits": 6100,
            "planKey": "team_growth",
            "userId": "user_team_member",
        },
    )

    assert assigned.status_code == 200
    seat = assigned.json()["seat"]
    assert seat["assignedBy"] == "user_team_owner"
    assert seat["includedCredits"] == 6100
    assert seat["planKey"] == "team_growth"
    assert seat["status"] == "active"
    assert seat["userId"] == "user_team_member"
    assert fake_db.credit_accounts[0]["owner_id"] == "user_team_member"

    listed = client.get(
        "/api/v1/workspaces/current/seats",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )
    assert listed.status_code == 200
    assert listed.json()["seats"][0]["id"] == seat["id"]


def test_team_seat_assignment_revokes_previous_plan_for_same_member(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspace_members = [
        {
            "display_name": "Team Member",
            "role": "member",
            "user_id": "user_team_member",
            "workspace_id": "workspace_team",
        }
    ]
    fake_db.workspace_seat_assignments = [
        {
            "assigned_by": "user_team_owner",
            "id": "seat_old_start",
            "included_credits": 2500,
            "plan_key": "team_start",
            "status": "active",
            "user_id": "user_team_member",
            "workspace_id": "workspace_team",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/workspaces/current/seats",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
        json={
            "planKey": "team_growth",
            "userId": "user_team_member",
        },
    )

    assert response.status_code == 200
    assert fake_db.workspace_seat_assignments[0]["status"] == "revoked"
    active_seats = [row for row in fake_db.workspace_seat_assignments if row["status"] == "active"]
    assert len(active_seats) == 1
    assert active_seats[0]["plan_key"] == "team_growth"


def test_team_owner_can_revoke_seat(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspace_seat_assignments = [
        {
            "assigned_by": "user_team_owner",
            "id": "seat_revoke_me",
            "included_credits": 2500,
            "plan_key": "team_start",
            "status": "active",
            "user_id": "user_team_member",
            "workspace_id": "workspace_team",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.delete(
        "/api/v1/workspaces/current/seats/user_team_member",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"ok": True, "userId": "user_team_member"}
    assert fake_db.workspace_seat_assignments[0]["status"] == "revoked"


def test_seat_assignment_requires_team_admin_or_owner(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", FakePostgresDatabase().connect)

    with pytest.raises(HTTPException) as group_error:
        upsert_workspace_seat_assignment(
            WorkspaceSeatAssignmentUpsertRequest(planKey="team_start", userId="user_1"),
            make_context("user_group_owner", "group_workspace", "owner"),
        )
    assert group_error.value.status_code == 403

    with pytest.raises(HTTPException) as member_error:
        upsert_workspace_seat_assignment(
            WorkspaceSeatAssignmentUpsertRequest(planKey="team_start", userId="user_1"),
            make_context("user_team_member", "team_workspace", "member"),
        )
    assert member_error.value.status_code == 403


def make_context(user_id: str, workspace_kind: str, workspace_role: str) -> ApiRequestContext:
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email=f"{user_id}@example.com",
        user_email_verified=True,
        user_id=user_id,
        workspace_board_count=0,
        workspace_id="workspace_team" if workspace_kind == "team_workspace" else "workspace_group",
        workspace_kind=workspace_kind,
        workspace_name="Test Workspace",
        workspace_plan_key=None,
        workspace_role=workspace_role,
    )
