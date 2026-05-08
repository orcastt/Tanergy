from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_admin_manual_finance_topups_write_payments_ledger_and_audit(monkeypatch):
    fake_db = _install_manual_finance_db(monkeypatch)
    client = TestClient(app)
    headers = _headers("user_finance")

    user_response = client.post(
        "/api/v1/admin/finance/manual/user-topup",
        headers=headers,
        json={"amountCents": 1200, "credits": 75, "note": "wire received", "userId": "user_member"},
    )
    team_response = client.post(
        "/api/v1/admin/finance/manual/workspace-topup",
        headers=headers,
        json={"credits": 125, "workspaceId": "workspace_team"},
    )

    assert user_response.status_code == 200
    assert user_response.json()["balanceCredits"] == 75
    assert team_response.status_code == 200
    assert team_response.json()["accountId"] == "credit_workspace_workspace_team"
    assert [row["provider"] for row in fake_db.payments] == ["admin_manual", "admin_manual"]
    assert [row["kind"] for row in fake_db.payments] == ["topup", "workspace_topup"]
    assert [row["reason"] for row in fake_db.credit_ledger] == ["topup_purchase", "topup_purchase"]
    assert [row["action"] for row in fake_db.admin_audit_logs[-2:]] == [
        "admin.finance.manual.user_topup",
        "admin.finance.manual.workspace_topup",
    ]


def test_admin_manual_finance_sets_and_cancels_plans(monkeypatch):
    fake_db = _install_manual_finance_db(monkeypatch)
    client = TestClient(app)
    headers = _headers("user_finance")

    collaborate = client.post(
        "/api/v1/admin/finance/manual/collaborate-plan",
        headers=headers,
        json={"grantIncludedCredits": True, "planKey": "collaborate_plus", "userId": "user_member"},
    )
    team = client.post(
        "/api/v1/admin/finance/manual/team-plan",
        headers=headers,
        json={"grantIncludedCredits": True, "planKey": "team_growth", "seatCapacity": 2, "workspaceId": "workspace_team"},
    )

    assert collaborate.status_code == 200
    assert team.status_code == 200
    assert {row["plan_key"] for row in fake_db.subscriptions} == {"collaborate_plus", "team_growth"}
    assert sum(row["credits_delta"] for row in fake_db.credit_ledger) == 13000

    cancel = client.post(
        "/api/v1/admin/finance/manual/subscription-cancel",
        headers=headers,
        json={"subscriptionId": team.json()["subscriptionId"], "note": "manual downgrade"},
    )

    assert cancel.status_code == 200
    assert next(row for row in fake_db.subscriptions if row["plan_key"] == "team_growth")["status"] == "canceled"
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.finance.manual.subscription_cancel"


def test_admin_manual_finance_requires_write_role(monkeypatch):
    _install_manual_finance_db(monkeypatch, role="analyst")
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/finance/manual/user-topup",
        headers=_headers("user_finance"),
        json={"credits": 1, "userId": "user_member"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin role does not grant this action."


def _install_manual_finance_db(monkeypatch, role="finance") -> FakePostgresDatabase:
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "created_at": "2026-05-08T00:00:00Z",
            "granted_by": "user_owner",
            "note": role,
            "permissions": {},
            "revoked_at": None,
            "role": role,
            "user_id": "user_finance",
        }
    ]
    fake_db.users = [
        _user("user_finance", "finance@example.com"),
        _user("user_member", "member@example.com"),
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
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_finance_manual.connect_to_postgres", fake_db.connect)
    return fake_db


def _headers(user_id):
    return {"x-tangent-user-id": user_id, "x-tangent-workspace-id": "workspace_team"}


def _user(user_id, email):
    return {
        "created_at": "2026-05-08T00:00:00Z",
        "display_name": user_id,
        "email": email,
        "id": user_id,
        "last_login_at": None,
        "locale": "en",
        "status": "active",
    }
