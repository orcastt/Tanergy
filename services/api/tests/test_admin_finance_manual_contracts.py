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
        json={"credits": 125, "note": "manual team topup", "workspaceId": "workspace_team"},
    )
    deduct_response = client.post(
        "/api/v1/admin/finance/manual/user-credit-adjust",
        headers=headers,
        json={"creditsDelta": -25, "note": "support correction", "userId": "user_member"},
    )

    assert user_response.status_code == 200
    assert user_response.json()["balanceCredits"] == 75
    assert team_response.status_code == 200
    assert deduct_response.status_code == 200
    assert deduct_response.json()["balanceCredits"] == 50
    assert team_response.json()["accountId"] == "credit_workspace_workspace_team"
    assert [row["provider"] for row in fake_db.payments] == ["admin_manual", "admin_manual"]
    assert [row["kind"] for row in fake_db.payments] == ["topup", "workspace_topup"]
    assert [row["reason"] for row in fake_db.credit_ledger] == ["topup_purchase", "topup_purchase", "admin_adjustment"]
    assert [row["action"] for row in fake_db.admin_audit_logs[-3:]] == [
        "admin.finance.manual.user_topup",
        "admin.finance.manual.workspace_topup",
        "admin.finance.manual.user_credit_adjust",
    ]


def test_admin_manual_finance_sets_and_cancels_plans(monkeypatch):
    fake_db = _install_manual_finance_db(monkeypatch)
    client = TestClient(app)
    headers = _headers("user_finance")

    collaborate = client.post(
        "/api/v1/admin/finance/manual/collaborate-plan",
        headers=headers,
        json={
            "durationCount": 2,
            "durationUnitDays": 30,
            "effectMode": "next_week",
            "grantIncludedCredits": True,
            "note": "upgrade group plan",
            "planKey": "collaborate_plus",
            "userId": "user_member",
        },
    )
    team = client.post(
        "/api/v1/admin/finance/manual/team-plan",
        headers=headers,
        json={
            "grantIncludedCredits": True,
            "note": "upgrade team plan",
            "periodEnd": "2026-07-31",
            "planKey": "team_growth",
            "seatCapacity": 2,
            "workspaceId": "workspace_team",
        },
    )

    assert collaborate.status_code == 200
    assert team.status_code == 200
    assert {row["plan_key"] for row in fake_db.subscriptions} == {"collaborate_plus", "team_growth"}
    assert sum(row["credits_delta"] for row in fake_db.credit_ledger) == 15000
    assert next(row for row in fake_db.subscriptions if row["plan_key"] == "collaborate_plus")["current_period_end"]
    assert _iso(next(row for row in fake_db.subscriptions if row["plan_key"] == "team_growth")["current_period_end"]).startswith("2026-07-31")

    cancel = client.post(
        "/api/v1/admin/finance/manual/subscription-cancel",
        headers=headers,
        json={"subscriptionId": team.json()["subscriptionId"], "note": "manual downgrade"},
    )

    assert cancel.status_code == 200
    assert next(row for row in fake_db.subscriptions if row["plan_key"] == "team_growth")["status"] == "canceled"
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.finance.manual.subscription_cancel"


def test_admin_manual_finance_creates_and_deletes_workspaces(monkeypatch):
    fake_db = _install_manual_finance_db(monkeypatch)
    client = TestClient(app)
    headers = _headers("user_finance")

    group = client.post(
        "/api/v1/admin/finance/manual/group-workspace",
        headers=headers,
        json={"note": "create creator group", "userId": "user_member", "workspaceName": "Creator Group"},
    )
    team = client.post(
        "/api/v1/admin/finance/manual/team-workspace",
        headers=headers,
        json={
            "durationCount": 4,
            "durationUnitDays": 30,
            "extraCredits": 250,
            "grantIncludedCredits": True,
            "note": "create creator team",
            "periodEnd": "2026-08-15",
            "planKey": "team_start",
            "seatCapacity": 3,
            "status": "active",
            "userId": "user_member",
            "workspaceName": "Creator Team",
        },
    )

    assert group.status_code == 200
    assert team.status_code == 200
    assert any(row["kind"] == "group_workspace" and row["owner_id"] == "user_member" for row in fake_db.workspaces)
    created_team = next(row for row in fake_db.workspaces if row["id"] == team.json()["workspaceId"])
    assert created_team["kind"] == "team_workspace"
    assert created_team["owner_id"] == "user_member"
    assert any(row["workspace_id"] == created_team["id"] and row["role"] == "owner" for row in fake_db.workspace_members)
    created_subscription = next(row for row in fake_db.subscriptions if row.get("workspace_id") == created_team["id"])
    assert created_subscription["plan_key"] == "team_start"
    assert _iso(created_subscription["current_period_end"]).startswith("2026-08-15")
    created_team_ledger = [row for row in fake_db.credit_ledger if row.get("workspace_id") == created_team["id"]]
    assert sum(row["credits_delta"] for row in created_team_ledger) == 30250

    deleted = client.post(
        "/api/v1/admin/finance/manual/workspace-delete",
        headers=headers,
        json={"workspaceId": created_team["id"], "note": "cleanup"},
    )

    assert deleted.status_code == 200
    assert next(row for row in fake_db.workspaces if row["id"] == created_team["id"])["status"] == "deleted"
    assert next(row for row in fake_db.subscriptions if row.get("workspace_id") == created_team["id"])["status"] == "canceled"
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.finance.manual.workspace_delete"


def test_admin_manual_finance_requires_write_role(monkeypatch):
    _install_manual_finance_db(monkeypatch, role="analyst")
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/finance/manual/user-topup",
        headers=_headers("user_finance"),
        json={"credits": 1, "note": "should fail", "userId": "user_member"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin role does not grant this action."


def test_admin_manual_finance_requires_operation_reason(monkeypatch):
    _install_manual_finance_db(monkeypatch)
    client = TestClient(app)

    response = client.post(
        "/api/v1/admin/finance/manual/user-topup",
        headers=_headers("user_finance"),
        json={"credits": 1, "note": "   ", "userId": "user_member"},
    )

    assert response.status_code == 422


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
    monkeypatch.setattr("tangent_api.admin_finance_manual_subscriptions.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_finance_manual_workspaces.connect_to_postgres", fake_db.connect)
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


def _iso(value):
    return value.isoformat() if hasattr(value, "isoformat") else str(value)
