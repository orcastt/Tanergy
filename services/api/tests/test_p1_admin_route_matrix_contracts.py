from typing import Optional

import pytest
from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


ROLES = ("plain", "support", "finance", "admin", "owner")
READ_ADMIN = {"finance", "admin", "owner"}
WRITE_ADMIN = {"admin", "owner"}
FINANCE_WRITE = {"finance", "admin", "owner"}


@pytest.mark.parametrize(
    ("method", "path", "body", "allowed_roles"),
    [
        ("GET", "/api/v1/admin/summary", None, READ_ADMIN),
        ("GET", "/api/v1/admin/users", None, READ_ADMIN),
        ("GET", "/api/v1/admin/directory/users", None, READ_ADMIN),
        ("GET", "/api/v1/admin/operator/users", None, READ_ADMIN),
        ("GET", "/api/v1/admin/finance/summary", None, READ_ADMIN),
        ("GET", "/api/v1/admin/ai/models", None, READ_ADMIN),
        ("GET", "/api/v1/admin/ai/runs", None, READ_ADMIN),
        ("GET", "/api/v1/admin/ai/versions?resourceType=model&resourceId=model_a", None, READ_ADMIN),
        ("GET", "/api/v1/admin/ai/route-metrics", None, READ_ADMIN),
        ("GET", "/api/v1/admin/roles?userId=user_finance", None, READ_ADMIN),
        ("PATCH", "/api/v1/admin/ai/models/model_a", {"enabled": False}, WRITE_ADMIN),
        ("POST", "/api/v1/admin/ai/models/model_a/publish", {"note": "publish"}, WRITE_ADMIN),
        ("POST", "/api/v1/admin/roles", {"userId": "user_target", "role": "finance", "reason": "grant"}, WRITE_ADMIN),
        ("POST", "/api/v1/admin/operator/users/user_target/status", {"reason": "suspend", "status": "suspended"}, WRITE_ADMIN),
        ("POST", "/api/v1/admin/finance/manual/user-topup", {"userId": "user_target", "credits": 1, "note": "top up"}, FINANCE_WRITE),
        ("PUT", "/api/v1/admin/finance/plan-catalog/free", {"includedCredits": 5}, FINANCE_WRITE),
    ],
)
def test_p1_admin_routes_enforce_role_matrix_with_real_admin_roles(
    monkeypatch,
    method: str,
    path: str,
    body: Optional[dict[str, object]],
    allowed_roles: set[str],
):
    fake_db = _wire_admin_fake_db(monkeypatch)
    _stub_route_side_effects(monkeypatch)

    client = TestClient(app)
    for role in ROLES:
        response = client.request(method, path, headers=_headers(role), json=body)
        if role in allowed_roles:
            assert response.status_code == 200, (method, path, role, response.text)
        else:
            assert response.status_code == 403, (method, path, role, response.text)

    assert fake_db.admin_roles


def test_admin_me_reports_access_only_for_p1_admin_roles(monkeypatch):
    _wire_admin_fake_db(monkeypatch)
    client = TestClient(app)

    access_by_role = {
        role: client.get("/api/v1/admin/me", headers=_headers(role)).json()["canAccessAdmin"]
        for role in ROLES
    }

    assert access_by_role == {
        "plain": False,
        "support": False,
        "finance": True,
        "admin": True,
        "owner": True,
    }


def _wire_admin_fake_db(monkeypatch) -> FakePostgresDatabase:
    fake_db = FakePostgresDatabase()
    fake_db.users = [_user("user_target"), *[_user(f"user_{role}") for role in ROLES]]
    fake_db.admin_roles = [_admin_role(f"user_{role}", role) for role in ROLES if role != "plain"]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_ADMIN_ROLE_CACHE_SECONDS", "0")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    return fake_db


def _stub_route_side_effects(monkeypatch) -> None:
    monkeypatch.setattr(
        "tangent_api.routers.admin_core_router.load_admin_summary",
        lambda: {"adminUserCount": 3, "boardsCount": 0, "usersCount": 1, "workspacesCount": 0},
    )
    monkeypatch.setattr("tangent_api.routers.admin_core_router.list_admin_users", lambda limit: [])
    monkeypatch.setattr("tangent_api.routers.admin_directory.list_admin_directory_users", lambda **_kwargs: ([], 0))
    monkeypatch.setattr("tangent_api.routers.admin_operator.list_admin_operator_users", lambda **_kwargs: ([], 0))
    monkeypatch.setattr("tangent_api.routers.admin_finance.load_admin_finance_summary", _finance_summary)
    monkeypatch.setattr("tangent_api.routers.admin_ai_control_plane_router.list_admin_ai_models", lambda **_kwargs: [])
    monkeypatch.setattr("tangent_api.routers.admin_ai_control_plane_router.update_admin_ai_model", lambda *_args: _ai_model())
    monkeypatch.setattr("tangent_api.routers.admin_ai_runtime_router.list_admin_ai_runs", lambda **_kwargs: [])
    monkeypatch.setattr("tangent_api.routers.admin_ai_versions_router.list_admin_ai_versions", lambda *_args: [])
    monkeypatch.setattr("tangent_api.routers.admin_ai_versions_router.publish_admin_ai_version", lambda *_args, **_kwargs: _ai_version())
    monkeypatch.setattr("tangent_api.routers.admin_ai_analytics.list_admin_ai_route_metrics", lambda **_kwargs: _route_metrics())
    monkeypatch.setattr("tangent_api.routers.admin_operator.set_admin_operator_user_status", lambda **_kwargs: _operator_status())
    monkeypatch.setattr("tangent_api.routers.admin_finance_manual.manual_topup_user", lambda **_kwargs: _manual_result())
    monkeypatch.setattr("tangent_api.routers.admin_finance.update_plan_catalog_entry", lambda *_args: _plan())


def _headers(role: str) -> dict[str, str]:
    return {"x-tangent-user-id": f"user_{role}", "x-tangent-workspace-id": "workspace_admin"}


def _user(user_id: str) -> dict[str, object]:
    return {
        "created_at": "2026-05-20T00:00:00Z",
        "display_name": user_id,
        "email": f"{user_id}@example.test",
        "id": user_id,
        "locale": "en",
        "status": "active",
    }


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


def _finance_summary() -> dict[str, object]:
    return {
        "accountCounts": [],
        "ledgerTotals": {"balanceCredits": 0, "grantedCredits": 0, "spentCredits": 0},
        "paymentKindCounts": [],
        "paymentProviderCounts": [],
        "paymentStatusCounts": [],
        "subscriptionCounts": [],
    }


def _ai_model() -> dict[str, object]:
    return {
        "capability": "image_generation",
        "capabilities": ["image_generation"],
        "costHint": "low",
        "createdAt": "2026-05-20T00:00:00Z",
        "displayName": "Model A",
        "enabled": True,
        "estimatedLatency": "fast",
        "isDefault": False,
        "modelKey": "model_a",
        "parameterSchema": {},
        "updatedAt": "2026-05-20T00:00:00Z",
    }


def _ai_version() -> dict[str, object]:
    return {
        "action": "publish",
        "createdAt": "2026-05-20T00:00:00Z",
        "id": "version_1",
        "resourceId": "model_a",
        "resourceType": "model",
        "snapshot": {},
        "versionNumber": 1,
    }


def _route_metrics() -> dict[str, object]:
    totals = {
        "averageAttemptsPerRun": 0,
        "calls": 0,
        "creditsCharged": 0,
        "directWins": 0,
        "failedCalls": 0,
        "fallbackWins": 0,
        "providerCost": 0,
        "routeHitRuns": 0,
        "succeededCalls": 0,
        "terminalFailures": 0,
    }
    return {"metrics": [], "ok": True, "totals": totals}


def _operator_status() -> dict[str, object]:
    return {"auditId": "audit_1", "message": "updated", "ok": True, "status": "suspended", "userId": "user_target"}


def _manual_result() -> dict[str, object]:
    return {"message": "ok", "ok": True, "userId": "user_target"}


def _plan() -> dict[str, object]:
    return {
        "billingPeriod": "none",
        "includedCredits": 5,
        "name": "Free",
        "planFamily": "free",
        "planKey": "free",
        "registrationCredits": 5,
    }
