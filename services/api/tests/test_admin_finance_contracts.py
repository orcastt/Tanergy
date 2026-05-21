from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.admin_finance_fakes import FinanceFakeDatabase
from tests.persistence_fakes import FakePostgresDatabase


def test_admin_finance_routes_surface_reconciliation_records(monkeypatch):
    fake_db = FakePostgresDatabase()
    finance_db = FinanceFakeDatabase()
    _seed_admin_fixture(fake_db)
    _seed_finance_fixture(finance_db)
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_finance_reads.connect_to_postgres", finance_db.connect)
    monkeypatch.setattr("tangent_api.admin_finance_summary_reads.connect_to_postgres", finance_db.connect)
    client = TestClient(app)
    headers = {"x-tangent-user-id": "user_finance", "x-tangent-workspace-id": "workspace_team"}

    summary = client.get("/api/v1/admin/finance/summary", headers=headers)
    assert summary.status_code == 200
    summary_payload = summary.json()["summary"]
    assert summary_payload["ledgerTotals"] == {
        "balanceCredits": 88.5,
        "grantedCredits": 105.0,
        "spentCredits": 16.5,
    }
    assert {"amountCents": 1500, "count": 1, "key": "succeeded"} in summary_payload["paymentStatusCounts"]

    payments = client.get("/api/v1/admin/finance/payments?status=succeeded&workspaceId=workspace_team", headers=headers)
    assert payments.status_code == 200
    assert [row["id"] for row in payments.json()["payments"]] == ["payment_team_topup"]
    assert payments.json()["payments"][0]["accountKind"] == "team_wallet"

    wallets = client.get("/api/v1/admin/finance/wallets?ownerType=workspace", headers=headers)
    assert wallets.status_code == 200
    assert wallets.json()["wallets"][0]["balanceCredits"] == 88.5

    subscriptions = client.get("/api/v1/admin/finance/subscriptions?planFamily=team", headers=headers)
    assert subscriptions.status_code == 200
    assert subscriptions.json()["subscriptions"][0]["seatCapacity"] == 3

    ledger = client.get("/api/v1/admin/finance/credit-ledger?workspaceId=workspace_team&reason=usage_charge", headers=headers)
    assert ledger.status_code == 200
    assert {row["actorUserId"] for row in ledger.json()["ledger"]} == {"user_member", "user_finance"}

    member_usage = client.get("/api/v1/admin/finance/member-usage?workspaceId=workspace_team", headers=headers)
    assert member_usage.status_code == 200
    assert member_usage.json()["memberUsage"][0]["usageCredits"] == 12.5


def test_admin_finance_requires_finance_read_role(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "created_at": "2026-05-08T00:00:00Z",
            "granted_by": "user_owner",
            "note": "moderation only",
            "permissions": {},
            "revoked_at": None,
            "role": "moderator",
            "user_id": "user_moderator",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/finance/summary",
        headers={"x-tangent-user-id": "user_moderator", "x-tangent-workspace-id": "workspace_team"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin role does not grant this action."


def _seed_admin_fixture(fake_db):
    fake_db.admin_roles = [
        {
            "created_at": "2026-05-08T00:00:00Z",
            "granted_by": "user_owner",
            "note": "finance",
            "permissions": {},
            "revoked_at": None,
            "role": "finance",
            "user_id": "user_finance",
        }
    ]


def _seed_finance_fixture(fake_db):
    fake_db.users = [
        _user("user_finance", "finance@example.com", "Finance User"),
        _user("user_member", "member@example.com", "Member User"),
    ]
    fake_db.workspaces = [
        {
            "created_at": "2026-05-08T00:00:00Z",
            "id": "workspace_team",
            "kind": "team_workspace",
            "name": "Team Workspace",
            "owner_id": "user_finance",
            "status": "active",
        }
    ]
    fake_db.workspace_members = [
        _member("workspace_team", "user_finance", "admin"),
        _member("workspace_team", "user_member", "member"),
    ]
    fake_db.credit_accounts = [
        _account("credit_workspace_team", "workspace", "workspace_team", "team_wallet"),
        _account("credit_user_finance", "user", "user_finance", "personal_wallet"),
    ]
    fake_db.payments = [
        _payment("payment_team_topup", "credit_workspace_team", "workspace_topup", "succeeded", 1500),
        _payment("payment_personal_pending", "credit_user_finance", "topup", "pending", 500),
    ]
    fake_db.credit_ledger = [
        _ledger("ledger_grant", "credit_workspace_team", "workspace_team", "user_finance", 100, "topup_purchase"),
        _ledger("ledger_bonus", "credit_workspace_team", "workspace_team", "user_finance", 5, "subscription_grant"),
        _ledger("ledger_usage_member", "credit_workspace_team", "workspace_team", "user_member", -12.5, "usage_charge"),
        _ledger("ledger_usage_finance", "credit_workspace_team", "workspace_team", "user_finance", -4, "usage_charge"),
    ]
    fake_db.subscriptions = [
        {
            "account_id": "credit_workspace_team",
            "created_at": "2026-05-08T00:05:00Z",
            "current_period_end": "2026-06-08T00:05:00Z",
            "current_period_start": "2026-05-08T00:05:00Z",
            "id": "subscription_team",
            "owner_id": "workspace_team",
            "owner_type": "workspace",
            "plan_family": "team",
            "plan_key": "team_start",
            "provider": "manual_test",
            "provider_customer_id": "customer_team",
            "provider_subscription_id": "provider_subscription_team",
            "seat_capacity": 3,
            "status": "active",
            "updated_at": "2026-05-08T00:05:00Z",
            "workspace_id": "workspace_team",
        }
    ]


def _user(user_id, email, display_name):
    return {
        "created_at": "2026-05-08T00:00:00Z",
        "display_name": display_name,
        "email": email,
        "id": user_id,
        "last_login_at": None,
        "locale": "en",
        "status": "active",
    }


def _member(workspace_id, user_id, role):
    return {
        "display_name": None,
        "invited_by": "user_finance",
        "joined_at": "2026-05-08T00:01:00Z",
        "role": role,
        "user_id": user_id,
        "workspace_id": workspace_id,
    }


def _account(account_id, owner_type, owner_id, account_kind):
    return {
        "account_kind": account_kind,
        "created_at": "2026-05-08T00:02:00Z",
        "id": account_id,
        "owner_id": owner_id,
        "owner_type": owner_type,
        "status": "active",
        "updated_at": "2026-05-08T00:02:00Z",
    }


def _payment(payment_id, account_id, kind, status, amount_cents):
    return {
        "account_id": account_id,
        "amount_cents": amount_cents,
        "checkout_session_id": f"checkout_{payment_id}",
        "created_at": "2026-05-08T00:03:00Z",
        "currency": "usd",
        "id": payment_id,
        "kind": kind,
        "metadata": {"workspaceId": "workspace_team"},
        "provider": "manual_test",
        "provider_payment_id": f"provider_{payment_id}" if status == "succeeded" else None,
        "status": status,
    }


def _ledger(ledger_id, account_id, workspace_id, actor_user_id, credits_delta, reason):
    return {
        "account_id": account_id,
        "actor_user_id": actor_user_id,
        "created_at": f"2026-05-08T00:04:{len(ledger_id):02d}Z",
        "credits_delta": credits_delta,
        "id": ledger_id,
        "metadata": {},
        "reason": reason,
        "source_id": f"source_{ledger_id}",
        "source_type": "payment" if credits_delta > 0 else "ai_run",
        "workspace_id": workspace_id,
    }
