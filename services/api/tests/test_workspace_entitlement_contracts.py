from fastapi.testclient import TestClient
import pytest
from fastapi import HTTPException

from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext
from tangent_api.workspace_seats import upsert_workspace_seat_assignment
from tangent_api.workspace_schemas import WorkspaceSeatAssignmentUpsertRequest
from tests.persistence_fakes import FakePostgresDatabase


@pytest.fixture(autouse=True)
def clear_database_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    yield


def test_billing_me_returns_team_wallet_contract():
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
    assert payload["chargeScope"] == "team_wallet"
    assert payload["payerLabel"] == "Charges Team wallet"
    assert payload["chargeScope"] != "actor_personal"
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
    assert payload["chargeScope"] == "team_wallet"
    assert payload["payerLabel"] == "Charges Team wallet"
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
            "account_kind": "team_wallet",
            "id": "credit_db_team_wallet",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
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
    fake_db.subscriptions = [
        {
            "account_id": "credit_db_team_wallet",
            "id": "subscription_team_growth",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_growth",
            "seat_capacity": 2,
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_seats.connect_to_postgres", fake_db.connect)
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
    assert payload["charge"]["chargedAccountId"] == "credit_db_team_wallet"
    assert payload["charge"]["chargedScope"] == "team_wallet"
    assert payload["charge"]["entitlementSource"] == "team_wallet"
    assert payload["charge"]["workspaceSeatId"] == "seat_db_growth_1"
    assert payload["plan"]["planKey"] == "team_growth"
    assert payload["plan"]["includedCredits"] == 6200


def test_workspace_entitlement_rejects_paused_team_subscription(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_accounts = [
        {
            "account_kind": "team_wallet",
            "id": "credit_db_team_wallet",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "status": "active",
        }
    ]
    fake_db.workspace_seat_assignments = [
        {
            "id": "seat_db_growth_1",
            "included_credits": 5500,
            "plan_key": "team_growth",
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
            "user_id": "user_team_member",
            "workspace_id": "workspace_team",
        }
    ]
    fake_db.subscriptions = [
        {
            "account_id": "credit_db_team_wallet",
            "id": "subscription_team_growth",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_growth",
            "seat_capacity": 2,
            "status": "paused",
            "updated_at": "2026-05-06T00:00:00Z",
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

    assert response.status_code == 402
    assert response.json()["detail"] == "Active Team subscription is required to use Team wallet."


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
    monkeypatch.setattr("tangent_api.workspace_seats.connect_to_postgres", fake_db.connect)
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
    assert payload["charge"]["chargedAccountId"] == "credit_workspace_workspace_team"
    assert payload["charge"]["chargedScope"] == "team_wallet"
    assert payload["charge"]["entitlementSource"] == "team_wallet"
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


def test_credit_ledger_route_applies_filters(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_ledger = [
        {
            "account_id": "credit_user_user_ledger",
            "actor_user_id": "user_ledger",
            "created_at": "2026-05-06T00:10:00Z",
            "credits_delta": -15,
            "id": "ledger_usage_match",
            "metadata": {"runId": "run_1"},
            "reason": "usage_charge",
            "source_id": "run_1",
            "source_type": "ai_run",
            "workspace_id": "workspace_group",
        },
        {
            "account_id": "credit_user_user_ledger",
            "actor_user_id": "user_other",
            "created_at": "2026-05-06T00:20:00Z",
            "credits_delta": -7,
            "id": "ledger_usage_other_actor",
            "metadata": {"runId": "run_2"},
            "reason": "usage_charge",
            "source_id": "run_2",
            "source_type": "ai_run",
            "workspace_id": "workspace_group",
        },
        {
            "account_id": "credit_user_user_ledger",
            "actor_user_id": "user_ledger",
            "created_at": "2026-05-06T00:30:00Z",
            "credits_delta": 20,
            "id": "ledger_topup_other_reason",
            "metadata": {},
            "reason": "topup_purchase",
            "source_id": "payment_1",
            "source_type": "payment",
            "workspace_id": "workspace_other",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/credits/ledger?reason=usage_charge&actorUserId=user_ledger&workspaceId=workspace_group",
        headers={
            "x-tangent-user-id": "user_ledger",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert response.status_code == 200
    assert [entry["id"] for entry in response.json()["entries"]] == ["ledger_usage_match"]


def test_credit_topup_route_writes_payment_entry(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/credits/topups",
        headers={
            "x-tangent-user-id": "user_topup",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "credits": 24,
            "metadata": {"pack": "growth"},
            "sourceId": "payment_growth_1",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["accountId"] == "credit_user_user_topup"
    assert payload["balanceCredits"] == 24
    assert payload["entry"]["reason"] == "topup_purchase"
    assert payload["entry"]["sourceType"] == "payment"
    assert payload["entry"]["metadata"] == {"pack": "growth"}
    assert fake_db.credit_ledger[-1]["source_id"] == "payment_growth_1"


def test_billing_topup_checkout_complete_and_list_payments(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/topups/checkout",
        headers={
            "x-tangent-plan-key": "collaborate_start",
            "x-tangent-user-id": "user_topup_checkout",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "credits": 40,
            "currency": "usd",
            "metadata": {"pack": "starter"},
        },
    )

    assert checkout.status_code == 200
    payment = checkout.json()["payment"]
    assert payment["accountId"] == "credit_user_user_topup_checkout"
    assert payment["amountCents"] == 40
    assert payment["kind"] == "topup"
    assert payment["status"] == "pending"

    completed = client.post(
        f"/api/v1/billing/payments/{payment['id']}/complete",
        headers={
            "x-tangent-plan-key": "collaborate_start",
            "x-tangent-user-id": "user_topup_checkout",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert completed.status_code == 200
    completed_payload = completed.json()
    assert completed_payload["payment"]["status"] == "succeeded"
    assert completed_payload["topupEntryId"] is not None
    assert fake_db.credit_ledger[-1]["account_id"] == "credit_user_user_topup_checkout"
    assert fake_db.credit_ledger[-1]["credits_delta"] == 40
    assert fake_db.credit_ledger[-1]["reason"] == "topup_purchase"

    listed = client.get(
        "/api/v1/billing/payments?status=succeeded",
        headers={
            "x-tangent-user-id": "user_topup_checkout",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
    )

    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()["payments"]] == [payment["id"]]


def test_team_seat_checkout_complete_updates_subscription_and_workspace_payments(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.subscriptions = [
        {
            "account_id": "credit_workspace_workspace_team",
            "id": "subscription_team_growth",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_growth",
            "seat_capacity": 1,
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/workspaces/current/seats/checkout",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
        json={
            "planKey": "team_growth",
            "quantity": 3,
            "currency": "usd",
            "metadata": {"cycle": "launch"},
        },
    )

    assert checkout.status_code == 200
    payment = checkout.json()["payment"]
    assert payment["accountId"] == "credit_workspace_workspace_team"
    assert payment["amountCents"] == 13500
    assert payment["kind"] == "seat_purchase"
    assert payment["status"] == "pending"

    completed = client.post(
        f"/api/v1/billing/payments/{payment['id']}/complete",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )

    assert completed.status_code == 200
    completed_payload = completed.json()
    assert completed_payload["payment"]["status"] == "succeeded"
    assert completed_payload["topupEntryId"] is None
    assert fake_db.subscriptions[0]["account_id"] == "credit_workspace_workspace_team"
    assert fake_db.subscriptions[0]["owner_type"] == "workspace"
    assert fake_db.subscriptions[0]["owner_id"] == "workspace_team"
    assert fake_db.subscriptions[0]["plan_family"] == "team"
    assert fake_db.subscriptions[0]["plan_key"] == "team_growth"
    assert fake_db.subscriptions[0]["provider_subscription_id"] == payment["id"]
    assert fake_db.subscriptions[0]["seat_capacity"] == 4
    assert fake_db.credit_ledger[-1]["account_id"] == "credit_workspace_workspace_team"
    assert fake_db.credit_ledger[-1]["credits_delta"] == 16500
    assert fake_db.credit_ledger[-1]["reason"] == "subscription_grant"

    listed = client.get(
        "/api/v1/billing/payments?workspaceScoped=true&kind=seat_purchase&status=succeeded",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )

    assert listed.status_code == 200
    assert [row["id"] for row in listed.json()["payments"]] == [payment["id"]]


def test_team_seat_checkout_rejects_mismatched_active_plan(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.subscriptions = [
        {
            "account_id": "credit_workspace_workspace_team",
            "id": "subscription_team_start",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_start",
            "seat_capacity": 2,
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    checkout = client.post(
        "/api/v1/billing/workspaces/current/seats/checkout",
        headers={
            "x-tangent-user-id": "user_team_owner",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
        json={
            "planKey": "team_growth",
            "quantity": 1,
        },
    )

    assert checkout.status_code == 400
    assert checkout.json()["detail"] == "Seat purchase plan must match the active Team subscription."


def test_team_owner_can_assign_and_list_seats(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_accounts = [
        {
            "account_kind": "team_wallet",
            "id": "credit_workspace_legacy_team",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "status": "active",
        }
    ]
    fake_db.payments = [
        {
            "account_id": "credit_workspace_legacy_team",
            "amount_cents": 9000,
            "created_at": "2026-05-06T00:00:00Z",
            "currency": "usd",
            "id": "payment_seat_growth",
            "kind": "seat_purchase",
            "metadata": {
                "planKey": "team_growth",
                "quantity": 2,
                "workspaceId": "workspace_team",
            },
            "provider": "manual_test",
            "provider_payment_id": "payment_provider_seat_growth",
            "status": "succeeded",
        }
    ]
    fake_db.subscriptions = [
        {
            "account_id": "credit_workspace_legacy_team",
            "id": "subscription_team_growth",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_growth",
            "seat_capacity": 2,
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
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
    monkeypatch.setattr("tangent_api.workspace_seats.connect_to_postgres", fake_db.connect)
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
    assert seat["includedCredits"] == 5500
    assert seat["planKey"] == "team_growth"
    assert seat["status"] == "active"
    assert seat["userId"] == "user_team_member"
    assert fake_db.credit_accounts[0]["account_kind"] == "team_wallet"
    assert fake_db.credit_accounts[0]["owner_id"] == "workspace_team"
    assert fake_db.credit_accounts[0]["owner_type"] == "workspace"
    assert fake_db.credit_ledger == []

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


def test_group_owner_can_change_workspace_member_role(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspace_members = [
        {
            "display_name": "Group Member",
            "invited_by": "user_group_owner",
            "joined_at": "2026-05-05T01:00:00Z",
            "role": "member",
            "user_id": "user_group_member",
            "workspace_id": "workspace_group",
        }
    ]
    fake_db.users = [
        {
            "id": "user_group_member",
            "email": "member@example.com",
            "display_name": "Group Member",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": None,
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_seats.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.patch(
        "/api/v1/workspaces/current/members/user_group_member",
        headers={
            "x-tangent-user-id": "user_group_owner",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={"role": "guest"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["member"]["role"] == "guest"
    assert payload["member"]["invitedBy"] == "user_group_owner"
    assert fake_db.workspace_members[0]["role"] == "guest"


def test_team_seat_assignment_revokes_previous_plan_for_same_member(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.payments = [
        {
            "account_id": "credit_workspace_workspace_team",
            "amount_cents": 9000,
            "created_at": "2026-05-06T00:00:00Z",
            "currency": "usd",
            "id": "payment_seat_growth",
            "kind": "seat_purchase",
            "metadata": {
                "planKey": "team_growth",
                "quantity": 1,
                "workspaceId": "workspace_team",
            },
            "provider": "manual_test",
            "provider_payment_id": "payment_provider_seat_growth",
            "status": "succeeded",
        }
    ]
    fake_db.subscriptions = [
        {
            "account_id": "credit_workspace_workspace_team",
            "id": "subscription_team_growth",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_growth",
            "seat_capacity": 1,
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
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
    monkeypatch.setattr("tangent_api.workspace_seats.connect_to_postgres", fake_db.connect)
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
    monkeypatch.setattr("tangent_api.workspace_seats.connect_to_postgres", fake_db.connect)
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
    monkeypatch.setattr("tangent_api.workspace_seats.connect_to_postgres", FakePostgresDatabase().connect)

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
