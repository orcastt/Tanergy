import time

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from tangent_api.admin_access import require_admin_role
from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext
from tests.persistence_fakes import FakePostgresDatabase


def test_admin_me_returns_no_access_without_roles(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/me",
        headers={"x-tangent-user-id": "user_plain", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["canAccessAdmin"] is False
    assert payload["roles"] == []
    assert payload["userId"] == "user_plain"


def test_admin_me_returns_active_roles_only(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "owner",
            "permissions": {"all": True},
            "note": "bootstrap",
            "granted_by": "user_seed",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        },
        {
            "user_id": "user_admin",
            "role": "support",
            "permissions": {"tickets": True},
            "note": "revoked",
            "granted_by": "user_seed",
            "created_at": "2026-05-05T00:05:00Z",
            "revoked_at": "2026-05-05T00:10:00Z",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/me",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["canAccessAdmin"] is True
    assert [role["role"] for role in payload["roles"]] == ["owner"]
    assert payload["roles"][0]["permissions"] == {"all": True}


def test_require_admin_role_blocks_non_admin(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)

    with pytest.raises(HTTPException) as error:
        require_admin_role(make_context("user_plain"))
    assert error.value.status_code == 403


def test_require_admin_role_accepts_allowed_role(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"users": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)

    roles = require_admin_role(make_context("user_admin"), allowed_roles={"owner", "admin"})
    assert [role.role for role in roles] == ["admin"]


def test_admin_summary_requires_admin_role(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/summary",
        headers={"x-tangent-user-id": "user_plain", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Admin role required."


def test_admin_summary_returns_counts_and_writes_audit_log(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_owner",
            "role": "owner",
            "permissions": {"admin": True},
            "note": "bootstrap",
            "granted_by": "seed_user",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_owner",
            "email": "owner@example.com",
            "display_name": "Owner User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": "2026-05-05T10:00:00Z",
        },
        {
            "id": "user_member",
            "email": "member@example.com",
            "display_name": "Member User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-04T00:00:00Z",
            "last_login_at": None,
        },
    ]
    fake_db.workspaces = [
        {"id": "workspace_one", "status": "active"},
        {"id": "workspace_two", "status": "active"},
    ]
    fake_db.boards = {
        ("workspace_one", "board_one"): ("board_one", "workspace_one"),
        ("workspace_two", "board_two"): ("board_two", "workspace_two"),
        ("workspace_two", "board_three"): ("board_three", "workspace_two"),
    }
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/summary",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "workspace_one"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["summary"] == {
        "adminUserCount": 1,
        "boardsCount": 3,
        "usersCount": 2,
        "workspacesCount": 2,
    }
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.summary.read"
    assert fake_db.admin_audit_logs[-1]["actor_user_id"] == "user_owner"
    assert fake_db.admin_audit_logs[-1]["metadata"] == {"roles": ["owner"]}


def test_admin_finance_plan_catalog_returns_default_plan_rows(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_finance",
            "role": "finance",
            "permissions": {"billing": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.plan_catalog.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/finance/plan-catalog",
        headers={"x-tangent-user-id": "user_finance", "x-tangent-workspace-id": "workspace_admin"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["plans"][0]["planKey"] == "free_canvas"
    assert payload["plans"][0]["registrationCredits"] == 50
    assert any(plan["planKey"] == "team_start" for plan in payload["plans"])


def test_admin_finance_plan_catalog_update_persists_override(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"billing": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.plan_catalog.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.put(
        "/api/v1/admin/finance/plan-catalog/team_start",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_admin"},
        json={"boardLimit": 12, "monthlyPriceUsd": 29, "seatMax": 18},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["plan"]["planKey"] == "team_start"
    assert payload["plan"]["boardLimit"] == 12
    assert payload["plan"]["monthlyPriceUsd"] == 29
    assert payload["plan"]["seatMax"] == 18
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.finance.plan_catalog.update"


def test_billing_plans_route_exposes_subscription_catalog_defaults():
    client = TestClient(app)

    response = client.get("/api/v1/billing/plans")

    assert response.status_code == 200
    payload = response.json()
    assert payload["plans"][0]["planKey"] == "free_canvas"
    assert payload["plans"][0]["boardLimit"] == 1
    assert payload["plans"][0]["registrationCredits"] == 50


def test_admin_users_returns_descending_users_and_writes_audit_log(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"users": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_old",
            "email": "old@example.com",
            "display_name": "Old User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-01T00:00:00Z",
            "last_login_at": None,
        },
        {
            "id": "user_new",
            "email": "new@example.com",
            "display_name": "New User",
            "status": "active",
            "locale": "fr",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": "2026-05-05T12:00:00Z",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/users?limit=1",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["users"] == [
        {
            "createdAt": "2026-05-05T00:00:00Z",
            "displayName": "New User",
            "email": "new@example.com",
            "id": "user_new",
            "lastLoginAt": "2026-05-05T12:00:00Z",
            "locale": "fr",
            "status": "active",
        }
    ]
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.users.list"
    assert fake_db.admin_audit_logs[-1]["metadata"] == {"limit": 1, "roles": ["admin"]}


def test_admin_workspaces_and_boards_routes_return_read_only_resources(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"resources": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.workspaces = [
        {
            "id": "workspace_new",
            "name": "Workspace New",
            "owner_id": "user_admin",
            "status": "active",
            "created_at": "2026-05-05T00:00:00Z",
        },
        {
            "id": "workspace_old",
            "name": "Workspace Old",
            "owner_id": "user_member",
            "status": "active",
            "created_at": "2026-05-01T00:00:00Z",
        },
    ]
    fake_db.boards = {
        ("workspace_new", "board_new"): (
            "board_new", "workspace_new", "user_admin", "New Board", {"assets": [], "shapes": []}, 0, 0, 0,
            None, None, None, None, "2026-05-05T02:00:00Z", "2026-05-05T01:00:00Z", False, False, "workspace", None,
        ),
        ("workspace_old", "board_old"): (
            "board_old", "workspace_old", "user_member", "Old Board", {"assets": [], "shapes": []}, 0, 0, 0,
            None, None, None, None, "2026-05-04T02:00:00Z", "2026-05-04T01:00:00Z", False, False, "private", None,
        ),
    }
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    workspaces = client.get(
        "/api/v1/admin/workspaces?limit=1",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_new"},
    )
    assert workspaces.status_code == 200
    assert workspaces.json()["workspaces"] == [
        {
            "createdAt": "2026-05-05T00:00:00Z",
            "id": "workspace_new",
            "kind": "solo_workspace",
            "name": "Workspace New",
            "ownerId": "user_admin",
            "status": "active",
        }
    ]

    boards = client.get(
        "/api/v1/admin/boards?limit=1",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_new"},
    )
    assert boards.status_code == 200
    assert boards.json()["boards"] == [
        {
            "id": "board_new",
            "ownerId": "user_admin",
            "savedAt": "2026-05-05T02:00:00Z",
            "title": "New Board",
            "visibility": "workspace",
            "workspaceId": "workspace_new",
        }
    ]
    assert fake_db.admin_audit_logs[-2]["action"] == "admin.workspaces.list"
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.boards.list"


def test_admin_ai_routes_return_filtered_resources_and_write_audit_logs(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"ai": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_admin",
            "email": "admin@example.com",
            "display_name": "Admin User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": "2026-05-05T00:00:00Z",
        }
    ]
    fake_db.model_registry = [
        {
            "model_key": "gpt-image-2",
            "display_name": "GPT Image 2",
            "capability": "image_generation",
            "capabilities": ["image_generation", "image_edit"],
            "parameter_schema": {"resolution": ["1K", "2K"]},
            "cost_hint": "Fast tests",
            "estimated_latency": "5-12s",
            "enabled": True,
            "is_default": True,
            "provider_key": "geekai",
            "default_tier_key": "1k",
            "default_pricing_rule_id": "price_gpt_image_2_1k_v1",
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T02:00:00Z",
        },
        {
            "model_key": "text-helper",
            "display_name": "Text Helper",
            "capability": "text",
            "capabilities": ["text"],
            "parameter_schema": {},
            "cost_hint": "",
            "estimated_latency": "1-2s",
            "enabled": False,
            "is_default": False,
            "provider_key": "openai",
            "default_tier_key": None,
            "default_pricing_rule_id": None,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T01:00:00Z",
        },
    ]
    fake_db.model_provider_routes = [
        {
            "id": "route_gpt_primary",
            "model_key": "gpt-image-2",
            "provider_key": "geekai",
            "provider_model": "gpt-image-2",
            "route_key": "primary",
            "priority": 10,
            "weight": 100,
            "health_status": "healthy",
            "timeout_ms": 60000,
            "retry_policy": {"maxAttempts": 1},
            "enabled": True,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T02:00:00Z",
        },
        {
            "id": "route_gpt_backup",
            "model_key": "gpt-image-2",
            "provider_key": "backup",
            "provider_model": "gpt-image-2",
            "route_key": "backup",
            "priority": 20,
            "weight": 50,
            "health_status": "degraded",
            "timeout_ms": 60000,
            "retry_policy": {"maxAttempts": 1},
            "enabled": False,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T01:00:00Z",
        },
    ]
    fake_db.model_pricing_rules = [
        {
            "id": "price_gpt_image_2_1k_v1",
            "model_key": "gpt-image-2",
            "tier_key": "1k",
            "billing_unit": "per_image",
            "estimated_credits": 5,
            "min_credits": 5,
            "credit_multiplier": 1,
            "provider_cost_formula": {"unit": "image"},
            "status": "active",
            "effective_from": "2026-05-06T00:00:00Z",
            "effective_to": None,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_ai_control_plane.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    models = client.get(
        "/api/v1/admin/ai/models?enabled=true&capability=image_generation",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert models.status_code == 200
    assert [item["modelKey"] for item in models.json()["models"]] == ["gpt-image-2"]

    routes = client.get(
        "/api/v1/admin/ai/provider-routes?modelKey=gpt-image-2&enabled=true",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert routes.status_code == 200
    assert [item["routeId"] for item in routes.json()["routes"]] == ["route_gpt_primary"]

    pricing = client.get(
        "/api/v1/admin/ai/pricing-rules?modelKey=gpt-image-2&status=active",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert pricing.status_code == 200
    assert [item["id"] for item in pricing.json()["pricingRules"]] == ["price_gpt_image_2_1k_v1"]

    assert [entry["action"] for entry in fake_db.admin_audit_logs[-3:]] == [
        "admin.ai.models.list",
        "admin.ai.provider_routes.list",
        "admin.ai.pricing_rules.list",
    ]


def test_admin_ai_runtime_routes_return_persisted_runs_and_api_calls(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"ai": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_admin",
            "email": "admin@example.com",
            "display_name": "Admin User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": "2026-05-05T00:00:00Z",
        },
        {
            "id": "user_runtime",
            "email": "runtime@example.com",
            "display_name": "Runtime User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": "2026-05-05T00:00:00Z",
        },
    ]
    fake_db.credit_ledger = [
        {
            "account_id": "credit_user_user_runtime",
            "credits_delta": 40,
            "id": "ledger_seed",
            "reason": "topup_purchase",
            "source_type": "payment",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_AI_MOCK_LEDGER_CHARGING", "1")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_ai_runtime_reads.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/ai/runs",
        headers={
            "x-tangent-user-id": "user_runtime",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "boardId": "board_runtime",
            "params": {"count": 1},
            "prompt": "Admin runtime readback",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )
    assert created.status_code == 200
    run_id = created.json()["run"]["runId"]

    settled_run = _wait_for_run_status(client, run_id, {"succeeded"})

    runs = client.get(
        "/api/v1/admin/ai/runs?status=succeeded&modelId=gpt-image-2",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert runs.status_code == 200
    run_record = runs.json()["runs"][0]
    assert [item["id"] for item in runs.json()["runs"]] == [run_id]
    assert run_record["boardId"] == "board_runtime"
    assert run_record["chargedAccountId"] == "credit_user_user_runtime"
    assert run_record["costCredits"] == 5.5
    assert run_record["estimatedCredits"] == 5.5
    assert run_record["modelId"] == "gpt-image-2"
    assert run_record["outputAssetIds"] == [f"asset_mock_{run_id}_1_admin-runtime-readback_refs0"]
    assert run_record["preflightStatus"] == "settled"
    assert run_record["provider"] == "geekai"
    assert run_record["providerCost"] == 0.04
    assert run_record["providerCurrency"] == "USD"
    assert run_record["routeKey"] == "geekai-gpt-image-2-primary"
    assert run_record["runType"] == "image_generation"
    assert run_record["selectedTierKey"] == "1k"
    assert run_record["status"] == "succeeded"
    assert run_record["workspaceId"] == "workspace_group"

    api_calls = client.get(
        "/api/v1/admin/ai/api-calls?status=succeeded&provider=geekai",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert api_calls.status_code == 200
    assert api_calls.json()["apiCalls"] == [
        {
            "boardId": "board_runtime",
            "createdAt": fake_db.ai_api_calls[-1]["created_at"].isoformat(),
            "creditsCharged": 5.5,
            "creditsRefunded": 0.0,
            "errorCode": None,
            "id": f"ai_call_{run_id}_a1",
            "latencyMs": 450,
            "modelId": "gpt-image-2",
            "nodeId": None,
            "pricingRuleId": "price_gpt_image_2_1k_v1",
            "provider": "geekai",
            "providerCost": 0.04,
            "providerCurrency": "USD",
            "routeId": "route_gpt_image_2_primary",
            "routeKey": "geekai-gpt-image-2-primary",
            "runId": run_id,
            "status": "succeeded",
            "userId": "user_runtime",
            "workspaceId": "workspace_group",
        }
    ]
    filtered_runs = client.get(
        f"/api/v1/admin/ai/runs?runId={run_id}&routeId=route_gpt_image_2_primary&routeKey=geekai-gpt-image-2-primary&provider=geekai&pricingRuleId=price_gpt_image_2_1k_v1&preflightStatus=settled&workspaceId=workspace_group&boardId=board_runtime",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert filtered_runs.status_code == 200
    assert [item["id"] for item in filtered_runs.json()["runs"]] == [run_id]

    filtered_api_calls = client.get(
        f"/api/v1/admin/ai/api-calls?runId={run_id}&routeId=route_gpt_image_2_primary&routeKey=geekai-gpt-image-2-primary&pricingRuleId=price_gpt_image_2_1k_v1&workspaceId=workspace_group&boardId=board_runtime",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert filtered_api_calls.status_code == 200
    assert [item["id"] for item in filtered_api_calls.json()["apiCalls"]] == [f"ai_call_{run_id}_a1"]
    assert fake_db.admin_audit_logs[-1]["metadata"]["routeId"] == "route_gpt_image_2_primary"

    fake_db.ai_runs[run_id]["route_id"] = None
    legacy_filtered_runs = client.get(
        "/api/v1/admin/ai/runs?routeId=route_gpt_image_2_primary&routeKey=geekai-gpt-image-2-primary&provider=geekai",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert legacy_filtered_runs.status_code == 200
    assert [item["id"] for item in legacy_filtered_runs.json()["runs"]] == [run_id]
    assert fake_db.admin_audit_logs[-1]["metadata"]["routeId"] == "route_gpt_image_2_primary"
    assert [entry["action"] for entry in fake_db.admin_audit_logs[-5:]] == [
        "admin.ai.runs.list",
        "admin.ai.api_calls.list",
        "admin.ai.runs.list",
        "admin.ai.api_calls.list",
        "admin.ai.runs.list",
    ]


def test_admin_ai_route_metrics_report_direct_fallback_and_terminal_health(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"ai": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_admin",
            "email": "admin@example.com",
            "display_name": "Admin User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": "2026-05-05T00:00:00Z",
        }
    ]
    fake_db.model_registry = [
        {
            "model_key": "gpt-image-2",
            "display_name": "GPT Image 2",
            "capability": "image_generation",
            "capabilities": ["image_generation", "image_edit"],
            "parameter_schema": {"resolution": ["1K"]},
            "cost_hint": "Fast tests",
            "estimated_latency": "5-12s",
            "enabled": True,
            "is_default": True,
            "provider_key": "geekai",
            "default_tier_key": "1k",
            "default_pricing_rule_id": "price_gpt_image_2_1k_v1",
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    fake_db.ai_runs = {
        "run_direct": {
            "id": "run_direct",
            "workspace_id": "workspace_group",
            "created_by": "user_runtime",
            "board_id": "board_runtime",
            "node_id": None,
            "run_type": "image_generation",
            "model_id": "gpt-image-2",
            "provider": "geekai",
            "status": "succeeded",
            "input_asset_ids": [],
            "output_asset_ids": ["asset_direct"],
            "params": {"count": 1},
            "prompt_preview": "Direct route win",
            "cost_credits": 5,
            "latency_ms": 410,
            "error_code": None,
            "error_message": None,
            "workspace_kind": "group_workspace",
            "workspace_seat_id": None,
            "charged_account_id": "credit_user_runtime",
            "charged_scope": "actor_personal",
            "entitlement_source": "personal_topup_or_free",
            "credits_charged": 5,
            "credits_refunded": 0,
            "provider_cost": 0.04,
            "provider_currency": "USD",
            "estimated_credits": 5,
            "pricing_rule_id": "price_gpt_image_2_1k_v1",
            "route_id": "route_primary",
            "route_key": "primary",
            "selected_tier_key": "1k",
            "preflight_status": "settled",
            "created_at": "2026-05-10T12:00:00Z",
            "updated_at": "2026-05-10T12:00:05Z",
        },
        "run_fallback": {
            "id": "run_fallback",
            "workspace_id": "workspace_group",
            "created_by": "user_runtime",
            "board_id": "board_runtime",
            "node_id": None,
            "run_type": "image_generation",
            "model_id": "gpt-image-2",
            "provider": "openai",
            "status": "succeeded",
            "input_asset_ids": [],
            "output_asset_ids": ["asset_backup"],
            "params": {"count": 1},
            "prompt_preview": "Fallback route win",
            "cost_credits": 6,
            "latency_ms": 600,
            "error_code": None,
            "error_message": None,
            "workspace_kind": "group_workspace",
            "workspace_seat_id": None,
            "charged_account_id": "credit_user_runtime",
            "charged_scope": "actor_personal",
            "entitlement_source": "personal_topup_or_free",
            "credits_charged": 6,
            "credits_refunded": 0,
            "provider_cost": 0.06,
            "provider_currency": "USD",
            "estimated_credits": 6,
            "pricing_rule_id": "price_gpt_image_2_1k_v1",
            "route_id": "route_backup",
            "route_key": "backup",
            "selected_tier_key": "1k",
            "preflight_status": "settled",
            "created_at": "2026-05-10T12:01:00Z",
            "updated_at": "2026-05-10T12:01:05Z",
        },
        "run_failed": {
            "id": "run_failed",
            "workspace_id": "workspace_group",
            "created_by": "user_runtime",
            "board_id": "board_runtime",
            "node_id": None,
            "run_type": "image_generation",
            "model_id": "gpt-image-2",
            "provider": "geekai",
            "status": "failed",
            "input_asset_ids": [],
            "output_asset_ids": [],
            "params": {"count": 1},
            "prompt_preview": "Terminal route failure",
            "cost_credits": 0,
            "latency_ms": 500,
            "error_code": "provider_failed",
            "error_message": "Provider timed out.",
            "workspace_kind": "group_workspace",
            "workspace_seat_id": None,
            "charged_account_id": "credit_user_runtime",
            "charged_scope": "actor_personal",
            "entitlement_source": "personal_topup_or_free",
            "credits_charged": 0,
            "credits_refunded": 0,
            "provider_cost": 0.02,
            "provider_currency": "USD",
            "estimated_credits": 5,
            "pricing_rule_id": "price_gpt_image_2_1k_v1",
            "route_id": "route_primary",
            "route_key": "primary",
            "selected_tier_key": "1k",
            "preflight_status": "failed",
            "created_at": "2026-05-10T12:02:00Z",
            "updated_at": "2026-05-10T12:02:05Z",
        },
    }
    fake_db.ai_api_calls = [
        {
            "id": "ai_call_run_direct_a1",
            "workspace_id": "workspace_group",
            "user_id": "user_runtime",
            "run_id": "run_direct",
            "board_id": "board_runtime",
            "node_id": None,
            "model_id": "gpt-image-2",
            "provider": "geekai",
            "route_key": "primary",
            "route_id": "route_primary",
            "pricing_rule_id": "price_gpt_image_2_1k_v1",
            "status": "succeeded",
            "latency_ms": 410,
            "credits_charged": 5,
            "credits_refunded": 0,
            "provider_cost": 0.04,
            "provider_currency": "USD",
            "error_code": None,
            "created_at": "2026-05-10T12:00:01Z",
        },
        {
            "id": "ai_call_run_fallback_a1",
            "workspace_id": "workspace_group",
            "user_id": "user_runtime",
            "run_id": "run_fallback",
            "board_id": "board_runtime",
            "node_id": None,
            "model_id": "gpt-image-2",
            "provider": "geekai",
            "route_key": "primary",
            "route_id": "route_primary",
            "pricing_rule_id": "price_gpt_image_2_1k_v1",
            "status": "failed",
            "latency_ms": 300,
            "credits_charged": 0,
            "credits_refunded": 0,
            "provider_cost": 0.01,
            "provider_currency": "USD",
            "error_code": "provider_failed",
            "created_at": "2026-05-10T12:01:01Z",
        },
        {
            "id": "ai_call_run_fallback_a2",
            "workspace_id": "workspace_group",
            "user_id": "user_runtime",
            "run_id": "run_fallback",
            "board_id": "board_runtime",
            "node_id": None,
            "model_id": "gpt-image-2",
            "provider": "openai",
            "route_key": "backup",
            "route_id": "route_backup",
            "pricing_rule_id": "price_gpt_image_2_1k_v1",
            "status": "succeeded",
            "latency_ms": 600,
            "credits_charged": 6,
            "credits_refunded": 0,
            "provider_cost": 0.06,
            "provider_currency": "USD",
            "error_code": None,
            "created_at": "2026-05-10T12:01:03Z",
        },
        {
            "id": "ai_call_run_failed_a1",
            "workspace_id": "workspace_group",
            "user_id": "user_runtime",
            "run_id": "run_failed",
            "board_id": "board_runtime",
            "node_id": None,
            "model_id": "gpt-image-2",
            "provider": "geekai",
            "route_key": "primary",
            "route_id": "route_primary",
            "pricing_rule_id": "price_gpt_image_2_1k_v1",
            "status": "failed",
            "latency_ms": 500,
            "credits_charged": 0,
            "credits_refunded": 0,
            "provider_cost": 0.02,
            "provider_currency": "USD",
            "error_code": "provider_failed",
            "created_at": "2026-05-10T12:02:01Z",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_ai_analytics.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/ai/route-metrics?capability=image_generation",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["ok"] is True
    assert [metric["routeId"] for metric in payload["metrics"]] == ["route_primary", "route_backup"]

    primary_metric = payload["metrics"][0]
    assert primary_metric["calls"] == 3
    assert primary_metric["routeHitRuns"] == 3
    assert primary_metric["directWins"] == 1
    assert primary_metric["fallbackWins"] == 1
    assert primary_metric["terminalFailures"] == 1
    assert primary_metric["succeededCalls"] == 1
    assert primary_metric["failedCalls"] == 2
    assert primary_metric["creditsCharged"] == 5.0
    assert primary_metric["providerCost"] == pytest.approx(0.07)
    assert primary_metric["averageAttemptsPerRun"] == 1.0
    assert primary_metric["directWinRate"] == 33.33
    assert primary_metric["routeAttemptSuccessRate"] == 33.33
    assert primary_metric["lastCalledAt"] == "2026-05-10T12:02:01Z"

    backup_metric = payload["metrics"][1]
    assert backup_metric["calls"] == 1
    assert backup_metric["routeHitRuns"] == 1
    assert backup_metric["directWins"] == 1
    assert backup_metric["fallbackWins"] == 0
    assert backup_metric["terminalFailures"] == 0
    assert backup_metric["provider"] == "openai"

    totals = payload["totals"]
    assert totals["averageAttemptsPerRun"] == 1.0
    assert totals["calls"] == 4
    assert totals["creditsCharged"] == 11.0
    assert totals["directWinRate"] == 50.0
    assert totals["directWins"] == 2
    assert totals["failedCalls"] == 2
    assert totals["fallbackWins"] == 1
    assert totals["providerCost"] == pytest.approx(0.13)
    assert totals["routeAttemptSuccessRate"] == 50.0
    assert totals["routeHitRuns"] == 4
    assert totals["succeededCalls"] == 2
    assert totals["terminalFailures"] == 1


def test_admin_ai_control_plane_patch_routes_persist_updates_and_audit(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"ai": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.model_registry = [
        {
            "model_key": "gpt-image-2",
            "display_name": "GPT Image 2",
            "capability": "image_generation",
            "capabilities": ["image_generation", "image_edit"],
            "parameter_schema": {"resolution": ["1K"]},
            "cost_hint": "Fast tests",
            "estimated_latency": "5-12s",
            "enabled": True,
            "is_default": True,
            "provider_key": "geekai",
            "default_tier_key": "1k",
            "default_pricing_rule_id": "price_gpt_image_2_1k_v1",
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    fake_db.model_provider_routes = [
        {
            "id": "route_gpt_primary",
            "model_key": "gpt-image-2",
            "provider_key": "geekai",
            "provider_model": "gpt-image-2",
            "route_key": "primary",
            "priority": 10,
            "weight": 100,
            "health_status": "healthy",
            "timeout_ms": 60000,
            "retry_policy": {"maxAttempts": 1},
            "enabled": True,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    fake_db.model_pricing_rules = [
        {
            "id": "price_gpt_image_2_1k_v1",
            "model_key": "gpt-image-2",
            "tier_key": "1k",
            "billing_unit": "per_image",
            "estimated_credits": 5,
            "min_credits": 5,
            "credit_multiplier": 1,
            "provider_cost_formula": {"amount": 0.04, "currency": "USD", "type": "per_image"},
            "status": "active",
            "effective_from": "2026-05-06T00:00:00Z",
            "effective_to": None,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_ai_control_plane.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    model_response = client.patch(
        "/api/v1/admin/ai/models/gpt-image-2",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
        json={
            "costHint": "Higher quality default.",
            "defaultTierKey": "2k",
            "enabled": False,
            "estimatedLatency": "8-16s",
        },
    )
    assert model_response.status_code == 200
    assert model_response.json()["model"]["defaultTierKey"] == "2k"
    assert model_response.json()["model"]["enabled"] is False

    route_response = client.patch(
        "/api/v1/admin/ai/provider-routes/route_gpt_primary",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
        json={
            "enabled": False,
            "healthStatus": "degraded",
            "priority": 25,
            "retryPolicy": {"maxAttempts": 3},
            "timeoutMs": 45000,
            "weight": 120,
        },
    )
    assert route_response.status_code == 200
    assert route_response.json()["route"]["healthStatus"] == "degraded"
    assert route_response.json()["route"]["timeoutMs"] == 45000

    pricing_response = client.patch(
        "/api/v1/admin/ai/pricing-rules/price_gpt_image_2_1k_v1",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
        json={
            "creditMultiplier": 1.5,
            "estimatedCredits": 7,
            "providerCostFormula": {"amount": 0.06, "currency": "USD", "type": "per_image"},
            "status": "draft",
        },
    )
    assert pricing_response.status_code == 200
    assert pricing_response.json()["pricingRule"]["creditMultiplier"] == 1.5
    assert pricing_response.json()["pricingRule"]["status"] == "draft"

    assert fake_db.model_registry[0]["default_tier_key"] == "2k"
    assert fake_db.model_provider_routes[0]["retry_policy"] == {"maxAttempts": 3}
    assert fake_db.model_pricing_rules[0]["estimated_credits"] == 7
    assert [entry["action"] for entry in fake_db.admin_audit_logs[-3:]] == [
        "admin.ai.model.update",
        "admin.ai.provider_route.update",
        "admin.ai.pricing_rule.update",
    ]


def test_admin_ai_provider_route_update_rejects_non_geekai_provider(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"ai": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.model_provider_routes = [
        {
            "id": "route_gpt_primary",
            "model_key": "gpt-image-2",
            "provider_key": "geekai",
            "provider_model": "gpt-image-2",
            "route_key": "geekai-gpt-image-2-primary",
            "priority": 10,
            "weight": 100,
            "health_status": "healthy",
            "timeout_ms": 60000,
            "retry_policy": {"maxAttempts": 1},
            "enabled": True,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_ai_control_plane.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    route_response = client.patch(
        "/api/v1/admin/ai/provider-routes/route_gpt_primary",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
        json={"providerKey": "legacy-provider"},
    )

    assert route_response.status_code == 400
    assert route_response.json()["detail"] == "Provider key is not enabled for this deployment."


def test_admin_ai_publish_list_and_rollback_versions(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"ai": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.model_registry = [
        {
            "model_key": "gpt-image-2",
            "display_name": "GPT Image 2",
            "capability": "image_generation",
            "capabilities": ["image_generation", "image_edit"],
            "parameter_schema": {"resolution": ["1K"]},
            "cost_hint": "Fast tests",
            "estimated_latency": "5-12s",
            "enabled": True,
            "is_default": True,
            "provider_key": "geekai",
            "default_tier_key": "1k",
            "default_pricing_rule_id": "price_gpt_image_2_1k_v1",
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    fake_db.model_pricing_rules = [
        {
            "id": "price_gpt_image_2_1k_v1",
            "model_key": "gpt-image-2",
            "tier_key": "1k",
            "billing_unit": "per_image",
            "estimated_credits": 5,
            "min_credits": 5,
            "credit_multiplier": 1,
            "provider_cost_formula": {"amount": 0.04, "currency": "USD", "type": "per_image"},
            "status": "active",
            "effective_from": "2026-05-06T00:00:00Z",
            "effective_to": None,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        },
        {
            "id": "price_gpt_image_2_1k_v2",
            "model_key": "gpt-image-2",
            "tier_key": "1k",
            "billing_unit": "per_image",
            "estimated_credits": 7,
            "min_credits": 7,
            "credit_multiplier": 1.4,
            "provider_cost_formula": {"amount": 0.06, "currency": "USD", "type": "per_image"},
            "status": "draft",
            "effective_from": "2026-05-06T01:00:00Z",
            "effective_to": None,
            "created_at": "2026-05-06T01:00:00Z",
            "updated_at": "2026-05-06T01:00:00Z",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_ai_versions.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    published_model = client.post(
        "/api/v1/admin/ai/models/gpt-image-2/publish",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
        json={"note": "Initial model publish"},
    )
    assert published_model.status_code == 200
    model_version = published_model.json()["version"]
    assert model_version["action"] == "publish"
    assert model_version["versionNumber"] == 1
    assert model_version["snapshot"]["display_name"] == "GPT Image 2"

    list_model_versions = client.get(
        "/api/v1/admin/ai/versions?resourceType=model&resourceId=gpt-image-2",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert list_model_versions.status_code == 200
    assert [row["id"] for row in list_model_versions.json()["versions"]] == [model_version["id"]]

    patched_model = client.patch(
        "/api/v1/admin/ai/models/gpt-image-2",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
        json={"displayName": "GPT Image 2 Beta", "enabled": False},
    )
    assert patched_model.status_code == 200
    assert patched_model.json()["model"]["displayName"] == "GPT Image 2 Beta"

    rolled_back_model = client.post(
        f"/api/v1/admin/ai/models/gpt-image-2/rollback/{model_version['id']}",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
        json={"note": "Restore baseline"},
    )
    assert rolled_back_model.status_code == 200
    rollback_version = rolled_back_model.json()["version"]
    assert rollback_version["action"] == "rollback"
    assert rollback_version["versionNumber"] == 2
    assert fake_db.model_registry[0]["display_name"] == "GPT Image 2"
    assert fake_db.model_registry[0]["enabled"] is True

    published_pricing = client.post(
        "/api/v1/admin/ai/pricing-rules/price_gpt_image_2_1k_v2/publish",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
        json={"note": "Promote v2"},
    )
    assert published_pricing.status_code == 200
    pricing_version = published_pricing.json()["version"]
    assert pricing_version["action"] == "publish"
    assert pricing_version["versionNumber"] == 1
    pricing_rules_by_id = {row["id"]: row for row in fake_db.model_pricing_rules}
    assert pricing_rules_by_id["price_gpt_image_2_1k_v2"]["status"] == "active"
    assert pricing_rules_by_id["price_gpt_image_2_1k_v1"]["status"] == "retired"

    listed_pricing_versions = client.get(
        "/api/v1/admin/ai/versions?resourceType=pricing_rule&resourceId=price_gpt_image_2_1k_v2",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert listed_pricing_versions.status_code == 200
    assert [row["id"] for row in listed_pricing_versions.json()["versions"]] == [pricing_version["id"]]

    assert [entry["action"] for entry in fake_db.admin_audit_logs[-6:]] == [
        "admin.ai.model.publish",
        "admin.ai.versions.list",
        "admin.ai.model.update",
        "admin.ai.model.rollback",
        "admin.ai.pricing_rule.publish",
        "admin.ai.versions.list",
    ]


def test_admin_ai_api_calls_route_surfaces_failover_attempt_history(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"ai": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_admin",
            "email": "admin@example.com",
            "display_name": "Admin User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": "2026-05-05T00:00:00Z",
        },
        {
            "id": "user_runtime",
            "email": "runtime@example.com",
            "display_name": "Runtime User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": "2026-05-05T00:00:00Z",
        },
    ]
    fake_db.model_registry = [
        {
            "model_key": "gpt-image-2",
            "display_name": "GPT Image 2",
            "capability": "image_generation",
            "capabilities": ["image_generation", "image_edit"],
            "parameter_schema": {"resolution": ["1K"]},
            "cost_hint": "Fast tests",
            "estimated_latency": "5-12s",
            "enabled": True,
            "is_default": True,
            "provider_key": "geekai",
            "default_tier_key": "1k",
            "default_pricing_rule_id": "price_gpt_image_2_1k_v1",
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    fake_db.model_provider_routes = [
        {
            "id": "route_gpt_image_2_primary",
            "model_key": "gpt-image-2",
            "provider_key": "geekai",
            "provider_model": "gpt-image-2",
            "route_key": "geekai-primary",
            "priority": 10,
            "weight": 100,
            "health_status": "healthy",
            "timeout_ms": 60000,
            "retry_policy": {"maxAttempts": 1},
            "enabled": True,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        },
        {
            "id": "route_gpt_image_2_backup",
            "model_key": "gpt-image-2",
            "provider_key": "openai",
            "provider_model": "gpt-image-2",
            "route_key": "openai-backup",
            "priority": 20,
            "weight": 80,
            "health_status": "healthy",
            "timeout_ms": 60000,
            "retry_policy": {"maxAttempts": 1},
            "enabled": True,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        },
    ]
    fake_db.model_pricing_rules = [
        {
            "id": "price_gpt_image_2_1k_v1",
            "model_key": "gpt-image-2",
            "tier_key": "1k",
            "billing_unit": "per_image",
            "estimated_credits": 5,
            "min_credits": 5,
            "credit_multiplier": 1,
            "provider_cost_formula": {"unit": "image"},
            "status": "active",
            "effective_from": "2026-05-06T00:00:00Z",
            "effective_to": None,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_AI_STUB_FAIL_ROUTE_KEYS", "route_gpt_image_2_primary")
    monkeypatch.delenv("TANGENT_AI_MOCK_LEDGER_CHARGING", raising=False)
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.admin_ai_runtime_reads.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/ai/runs",
        headers={
            "x-tangent-user-id": "user_runtime",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "prompt": "Show failover attempts",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )
    assert created.status_code == 200
    run_id = created.json()["run"]["runId"]

    settled_run = _wait_for_run_status(client, run_id, {"succeeded"})

    api_calls = client.get(
        f"/api/v1/admin/ai/api-calls?provider=openai",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert api_calls.status_code == 200
    assert [item["id"] for item in api_calls.json()["apiCalls"]] == [f"ai_call_{run_id}_a2"]
    assert api_calls.json()["apiCalls"][0]["creditsCharged"] == 5.0
    assert api_calls.json()["apiCalls"][0]["provider"] == "openai"
    assert api_calls.json()["apiCalls"][0]["providerCost"] is None
    assert api_calls.json()["apiCalls"][0]["providerCurrency"] is None
    assert api_calls.json()["apiCalls"][0]["routeKey"] == "openai-backup"
    assert api_calls.json()["apiCalls"][0]["runId"] == run_id
    assert api_calls.json()["apiCalls"][0]["workspaceId"] == "workspace_group"

    all_api_calls = client.get(
        "/api/v1/admin/ai/api-calls",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )
    assert all_api_calls.status_code == 200
    assert [item["id"] for item in all_api_calls.json()["apiCalls"][:2]] == [
        f"ai_call_{run_id}_a2",
        f"ai_call_{run_id}_a1",
    ]
    assert all_api_calls.json()["apiCalls"][1]["errorCode"] == "preflight_route_failure"


def test_admin_audit_logs_route_returns_filtered_entries_and_writes_access_log(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_admin",
            "role": "admin",
            "permissions": {"audit": True},
            "note": "active",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_admin",
            "email": "admin@example.com",
            "display_name": "Admin User",
            "status": "active",
            "created_at": "2026-05-05T00:00:00Z",
        },
        {
            "id": "user_owner",
            "email": "owner@example.com",
            "display_name": "Owner User",
            "status": "active",
            "created_at": "2026-05-05T00:00:00Z",
        },
        {
            "id": "user_target",
            "email": "target@example.com",
            "display_name": "Target User",
            "status": "active",
            "created_at": "2026-05-05T00:00:00Z",
        },
    ]
    fake_db.admin_audit_logs = [
        {
            "id": "admin_audit_1",
            "actor_user_id": "user_owner",
            "target_user_id": "user_target",
            "workspace_id": "workspace_one",
            "action": "admin.role.grant",
            "metadata": {"role": "support"},
            "created_at": "2026-05-05T02:00:00Z",
        },
        {
            "id": "admin_audit_2",
            "actor_user_id": "user_admin",
            "target_user_id": "user_target",
            "workspace_id": "workspace_one",
            "action": "admin.role.revoke",
            "metadata": {"role": "support"},
            "created_at": "2026-05-05T01:00:00Z",
        },
        {
            "id": "admin_audit_3",
            "actor_user_id": "user_admin",
            "target_user_id": "user_other",
            "workspace_id": "workspace_two",
            "action": "admin.users.list",
            "metadata": {"limit": 25},
            "created_at": "2026-05-05T00:30:00Z",
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.get(
        "/api/v1/admin/audit-logs?limit=2&targetUserId=user_target",
        headers={"x-tangent-user-id": "user_admin", "x-tangent-workspace-id": "workspace_one"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert [log["id"] for log in payload["logs"]] == ["admin_audit_1", "admin_audit_2"]
    assert payload["logs"][0] == {
        "action": "admin.role.grant",
        "actorDisplayName": "Owner User",
        "actorEmail": "owner@example.com",
        "actorUserId": "user_owner",
        "createdAt": "2026-05-05T02:00:00Z",
        "id": "admin_audit_1",
        "metadata": {"role": "support"},
        "targetDisplayName": "Target User",
        "targetEmail": "target@example.com",
        "targetUserId": "user_target",
        "workspaceId": "workspace_one",
    }
    assert fake_db.admin_audit_logs[-1]["action"] == "admin.audit.list"
    assert fake_db.admin_audit_logs[-1]["metadata"] == {
        "action": None,
        "actorUserId": None,
        "limit": 2,
        "roles": ["admin"],
        "targetUserId": "user_target",
    }


def test_admin_role_grant_list_and_revoke_routes_require_owner(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_owner",
            "role": "owner",
            "permissions": {"all": True},
            "note": "bootstrap",
            "granted_by": "seed_user",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    fake_db.users = [
        {
            "id": "user_owner",
            "email": "owner@example.com",
            "display_name": "Owner User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": None,
        },
        {
            "id": "user_target",
            "email": "target@example.com",
            "display_name": "Target User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:01:00Z",
            "last_login_at": None,
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    granted = client.post(
        "/api/v1/admin/roles",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "dev-workspace"},
        json={
            "userId": "user_target",
            "role": "admin",
            "permissions": {"users": True},
            "note": "Promoted",
            "reason": "support escalation",
        },
    )
    assert granted.status_code == 200
    granted_payload = granted.json()
    assert granted_payload["userId"] == "user_target"
    assert granted_payload["role"]["role"] == "admin"
    assert granted_payload["role"]["permissions"] == {"users": True}

    listed = client.get(
        "/api/v1/admin/roles?userId=user_target",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "dev-workspace"},
    )
    assert listed.status_code == 200
    assert [role["role"] for role in listed.json()["roles"]] == ["admin"]

    revoked = client.delete(
        "/api/v1/admin/roles/user_target/admin?reason=rotation",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "dev-workspace"},
    )
    assert revoked.status_code == 200
    assert revoked.json()["role"]["role"] == "admin"
    assert [entry["action"] for entry in fake_db.admin_audit_logs[-3:]] == [
        "admin.role.grant",
        "admin.roles.read",
        "admin.role.revoke",
    ]
    assert fake_db.admin_audit_logs[-3]["metadata"]["reason"] == "support escalation"
    assert fake_db.admin_audit_logs[-1]["metadata"]["reason"] == "rotation"

    blocked = client.post(
        "/api/v1/admin/roles",
        headers={"x-tangent-user-id": "user_target", "x-tangent-workspace-id": "dev-workspace"},
        json={"userId": "user_owner", "reason": "try escalation", "role": "support"},
    )
    assert blocked.status_code == 403


def test_admin_role_mutations_require_reason(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_owner",
            "role": "owner",
            "permissions": {"all": True},
            "note": "bootstrap",
            "granted_by": "seed_user",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        },
        {
            "user_id": "user_target",
            "role": "admin",
            "permissions": {"users": True},
            "note": "existing",
            "granted_by": "user_owner",
            "created_at": "2026-05-05T00:10:00Z",
            "revoked_at": None,
        },
    ]
    fake_db.users = [
        {
            "id": "user_owner",
            "email": "owner@example.com",
            "display_name": "Owner User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": None,
        },
        {
            "id": "user_target",
            "email": "target@example.com",
            "display_name": "Target User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:01:00Z",
            "last_login_at": None,
        },
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    grant = client.post(
        "/api/v1/admin/roles",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "dev-workspace"},
        json={"userId": "user_target", "role": "finance"},
    )
    revoke = client.delete(
        "/api/v1/admin/roles/user_target/admin",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert grant.status_code == 422
    assert revoke.status_code == 422


def test_admin_revoke_blocks_last_active_owner(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.admin_roles = [
        {
            "user_id": "user_owner",
            "role": "owner",
            "permissions": {"all": True},
            "note": "bootstrap",
            "granted_by": "seed_user",
            "created_at": "2026-05-05T00:00:00Z",
            "revoked_at": None,
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.admin_access.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.delete(
        "/api/v1/admin/roles/user_owner/owner?reason=rotation",
        headers={"x-tangent-user-id": "user_owner", "x-tangent-workspace-id": "dev-workspace"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "Cannot revoke the last active owner role."


def _wait_for_run_status(client: TestClient, run_id: str, statuses: set[str], timeout_seconds: float = 1.5) -> dict[str, object]:
    deadline = time.time() + timeout_seconds
    last_payload: dict[str, object] | None = None
    while time.time() < deadline:
        response = client.get(f"/api/v1/ai/runs/{run_id}")
        assert response.status_code == 200
        payload = response.json()["run"]
        last_payload = payload
        if payload["status"] in statuses:
            return payload
        time.sleep(0.02)
    assert last_payload is not None
    raise AssertionError(f"Timed out waiting for run {run_id} to reach {statuses}; last payload was {last_payload}")


def make_context(user_id: str) -> ApiRequestContext:
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email=f"{user_id}@example.com",
        user_email_verified=True,
        user_id=user_id,
        workspace_board_count=0,
        workspace_id="dev-workspace",
        workspace_name="Dev Workspace",
        workspace_role="owner",
    )
