import time

from fastapi.testclient import TestClient

from tangent_api.main import app
from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.request_context import ApiRequestContext
from tests.persistence_fakes import FakePostgresDatabase


def test_ai_model_registry_contract():
    client = TestClient(app)

    response = client.get("/api/v1/ai/models?capability=image_generation")

    assert response.status_code == 200
    models = response.json()["models"]
    assert [model["id"] for model in models] == [
        "gpt-image-2",
        "gemini-3.1-flash-image-preview",
    ]
    assert models[0]["isDefault"] is True
    assert models[0]["parameterSchema"]["resolution"]


def test_ai_run_mock_contract_round_trip():
    client = TestClient(app)

    response = client.post(
        "/api/v1/ai/runs",
        json={
            "boardId": "board_ai_smoke",
            "inputAssetIds": ["asset_ref_1"],
            "nodeId": "node_image_gen",
            "nodeType": "image_gen_4",
            "params": {"count": 4, "resolution": "0.5K"},
            "prompt": "A clean ceramic cup poster",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )

    assert response.status_code == 200
    run = response.json()["run"]
    assert run["boardId"] == "board_ai_smoke"
    assert run["charge"]["chargedScope"] == "actor_personal"
    assert run["charge"]["payerLabel"] == "Charges your credits"
    assert run["costCredits"] == 0
    assert run["estimatedCredits"] == 12
    assert run["entitlementSource"] == "personal_topup_or_free"
    assert run["modelId"] == "gpt-image-2"
    assert run["outputAssetIds"] == []
    assert run["status"] == "queued"

    loaded = _wait_for_run_status(client, run["runId"], {"succeeded"})
    assert loaded["runId"] == run["runId"]
    assert loaded["status"] == "succeeded"
    assert len(loaded["outputAssetIds"]) == 4


def test_ai_run_mock_can_settle_against_credit_ledger(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_ledger = [
        {
            "account_id": "credit_user_user_ai_charge",
            "credits_delta": 40,
            "id": "ledger_seed",
            "reason": "topup_purchase",
            "source_type": "payment",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_AI_MOCK_LEDGER_CHARGING", "1")
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/ai/runs",
        headers={
            "x-tangent-user-id": "user_ai_charge",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "boardId": "board_ai_charge",
            "params": {"count": 2},
            "prompt": "A product mockup",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )

    assert response.status_code == 200
    run = response.json()["run"]
    assert run["status"] == "queued"
    assert run["costCredits"] == 0
    settled_run = _wait_for_run_status(client, run["runId"], {"succeeded"})
    assert settled_run["costCredits"] == 10
    assert settled_run["charge"]["preflightStatus"] == "settled"
    assert settled_run["costHint"] == "Mock AI run · charged 10 credits · Charges your credits"
    assert fake_db.credit_ledger[-1]["credits_delta"] == -10
    assert fake_db.credit_ledger[-1]["reason"] == "usage_charge"
    assert fake_db.credit_ledger[-1]["metadata"]["modelId"] == "gpt-image-2"
    assert fake_db.credit_ledger[-1]["source_id"] == settled_run["runId"]
    assert fake_db.ai_runs[settled_run["runId"]]["pricing_rule_id"] == "price_gpt_image_2_1k_v1"
    assert fake_db.ai_runs[settled_run["runId"]]["route_id"] == "route_gpt_image_2_primary"
    assert fake_db.ai_api_calls[-1]["id"] == f"ai_call_{settled_run['runId']}_a1"
    assert fake_db.ai_api_calls[-1]["run_id"] == settled_run["runId"]
    assert fake_db.ai_api_calls[-1]["status"] == "succeeded"
    assert fake_db.api_cost_ledger[-1]["id"] == f"api_cost_{settled_run['runId']}_a1"
    assert fake_db.api_cost_ledger[-1]["settlement_kind"] == "usage"
    assert fake_db.api_cost_ledger[-1]["credits_charged"] == 10.0
    assert fake_db.api_cost_ledger[-1]["provider"] == "geekai"
    assert fake_db.api_cost_ledger[-1]["provider_currency"] == "USD"


def test_ai_run_mock_settles_team_workspace_against_team_wallet(monkeypatch):
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
            "id": "seat_team_member_1",
            "included_credits": 2500,
            "plan_key": "team_start",
            "status": "active",
            "updated_at": "2026-05-06T00:00:00Z",
            "user_id": "user_team_member",
            "workspace_id": "workspace_team",
        }
    ]
    fake_db.subscriptions = [
        {
            "account_id": "credit_db_team_wallet",
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
    fake_db.credit_ledger = [
        {
            "account_id": "credit_db_team_wallet",
            "credits_delta": 80,
            "id": "ledger_team_wallet_seed",
            "reason": "topup_purchase",
            "source_type": "payment",
            "workspace_id": "workspace_team",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_AI_MOCK_LEDGER_CHARGING", "1")
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/ai/runs",
        headers={
            "x-tangent-user-id": "user_team_member",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
        json={
            "boardId": "board_team_charge",
            "nodeId": "node_team_image_gen",
            "params": {"count": 2},
            "prompt": "A team funded campaign concept",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )

    assert response.status_code == 200
    run = response.json()["run"]
    assert run["charge"]["chargedAccountId"] == "credit_db_team_wallet"
    assert run["charge"]["chargedScope"] == "team_wallet"
    assert run["charge"]["workspaceSeatId"] == "seat_team_member_1"
    settled_run = _wait_for_run_status(client, run["runId"], {"succeeded"})
    assert settled_run["costCredits"] == 10
    assert settled_run["charge"]["preflightStatus"] == "settled"
    assert fake_db.credit_ledger[-1]["account_id"] == "credit_db_team_wallet"
    assert fake_db.credit_ledger[-1]["actor_user_id"] == "user_team_member"
    assert fake_db.credit_ledger[-1]["credits_delta"] == -10
    assert fake_db.credit_ledger[-1]["reason"] == "usage_charge"
    assert fake_db.credit_ledger[-1]["workspace_id"] == "workspace_team"
    assert fake_db.ai_runs[settled_run["runId"]]["charged_account_id"] == "credit_db_team_wallet"
    assert fake_db.ai_runs[settled_run["runId"]]["charged_scope"] == "team_wallet"


def test_ai_run_poll_and_cancel_keep_original_charge_context(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_AI_EXECUTION_START_DELAY_MS", "100")
    monkeypatch.delenv("TANGENT_AI_MOCK_LEDGER_CHARGING", raising=False)
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/ai/runs",
        headers={
            "x-tangent-user-id": "user_original",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "boardId": "board_context_lock",
            "prompt": "Keep my accounting context stable",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )
    assert created.status_code == 200
    run = created.json()["run"]
    run_id = run["runId"]
    assert run["charge"]["chargedAccountId"] == "credit_user_user_original"

    polled = client.get(
        f"/api/v1/ai/runs/{run_id}",
        headers={
            "x-tangent-user-id": "user_spoof",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )
    assert polled.status_code == 200
    assert polled.json()["run"]["charge"]["chargedAccountId"] == "credit_user_user_original"

    canceled = client.post(
        f"/api/v1/ai/runs/{run_id}/cancel",
        headers={
            "x-tangent-user-id": "user_spoof",
            "x-tangent-workspace-id": "workspace_team",
            "x-tangent-workspace-kind": "team_workspace",
        },
    )
    assert canceled.status_code == 200
    canceled_run = canceled.json()["run"]
    assert canceled_run["status"] == "canceled"
    assert canceled_run["charge"]["chargedAccountId"] == "credit_user_user_original"
    assert fake_db.ai_runs[run_id]["created_by"] == "user_original"
    assert fake_db.ai_runs[run_id]["workspace_id"] == "workspace_group"
    assert fake_db.ai_runs[run_id]["charged_account_id"] == "credit_user_user_original"


def test_ai_run_mock_rejects_when_ledger_balance_is_insufficient(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_ledger = [
        {
            "account_id": "credit_user_user_ai_short",
            "credits_delta": 3,
            "id": "ledger_seed",
            "reason": "topup_purchase",
            "source_type": "payment",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_AI_MOCK_LEDGER_CHARGING", "1")
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/ai/runs",
        headers={
            "x-tangent-user-id": "user_ai_short",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "prompt": "One image",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )

    assert response.status_code == 402
    assert response.json()["detail"] == "Insufficient credits for this AI run."
    assert len(fake_db.credit_ledger) == 1
    assert fake_db.ai_runs == {}


def test_ai_run_mock_persists_quote_facts_and_loads_from_database(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.credit_ledger = [
        {
            "account_id": "credit_user_user_persisted",
            "credits_delta": 50,
            "id": "ledger_seed",
            "reason": "topup_purchase",
            "source_type": "payment",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.delenv("TANGENT_AI_MOCK_LEDGER_CHARGING", raising=False)
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/ai/runs",
        headers={
            "x-tangent-user-id": "user_persisted",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "boardId": "board_persisted",
            "params": {"count": 1, "resolution": "2K"},
            "prompt": "Persist me",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )

    assert response.status_code == 200
    run = response.json()["run"]
    persisted = fake_db.ai_runs[run["runId"]]
    assert persisted["estimated_credits"] == 9
    assert persisted["pricing_rule_id"] == "price_gpt_image_2_2k_v1"
    assert persisted["route_id"] == "route_gpt_image_2_primary"
    assert persisted["preflight_status"] == "mock_contract_only"
    assert persisted["status"] in {"queued", "running", "succeeded"}

    payload = _wait_for_run_status(client, run["runId"], {"succeeded"})
    assert payload["pricingRuleId"] == "price_gpt_image_2_2k_v1"
    assert payload["routeId"] == "route_gpt_image_2_primary"
    assert payload["estimatedCredits"] == 9
    assert payload["status"] == "succeeded"


def test_ai_run_mock_can_cancel_while_queued_or_running(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_AI_EXECUTION_START_DELAY_MS", "50")
    monkeypatch.delenv("TANGENT_AI_MOCK_LEDGER_CHARGING", raising=False)
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/ai/runs",
        headers={
            "x-tangent-user-id": "user_cancel",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "prompt": "Cancel me",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )
    assert created.status_code == 200
    run_id = created.json()["run"]["runId"]

    canceled = client.post(f"/api/v1/ai/runs/{run_id}/cancel")
    assert canceled.status_code == 200
    assert canceled.json()["run"]["status"] == "canceled"
    assert fake_db.ai_runs[run_id]["status"] == "canceled"

    loaded = _wait_for_run_status(client, run_id, {"canceled"})
    assert loaded["status"] == "canceled"


def test_ai_run_uses_backup_route_when_primary_route_fails(monkeypatch):
    fake_db = FakePostgresDatabase()
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
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/ai/runs",
        json={
            "prompt": "Fail over please",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )
    assert created.status_code == 200
    run_id = created.json()["run"]["runId"]

    payload = _wait_for_run_status(client, run_id, {"succeeded"})
    assert payload["status"] == "succeeded"
    assert payload["provider"] == "openai"
    assert payload["routeId"] == "route_gpt_image_2_backup"
    assert payload["routeKey"] == "openai-backup"
    assert fake_db.ai_runs[run_id]["route_id"] == "route_gpt_image_2_backup"
    attempts = [row for row in fake_db.ai_api_calls if row["run_id"] == run_id]
    assert [row["id"] for row in attempts] == [f"ai_call_{run_id}_a1", f"ai_call_{run_id}_a2"]
    assert attempts[0]["route_id"] == "route_gpt_image_2_primary"
    assert attempts[0]["status"] == "failed"
    assert attempts[0]["error_code"] == "preflight_route_failure"
    assert attempts[1]["route_id"] == "route_gpt_image_2_backup"
    assert attempts[1]["status"] == "succeeded"
    assert [row["id"] for row in fake_db.api_cost_ledger[-2:]] == [
        f"api_cost_{run_id}_a1",
        f"api_cost_{run_id}_a2",
    ]
    assert fake_db.api_cost_ledger[-2]["settlement_kind"] == "attempt_failure"
    assert fake_db.api_cost_ledger[-1]["settlement_kind"] == "usage"


def test_ai_run_fails_when_all_provider_routes_fail(monkeypatch):
    fake_db = FakePostgresDatabase()
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
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/ai/runs",
        json={
            "prompt": "This should fail",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )
    assert created.status_code == 200
    run_id = created.json()["run"]["runId"]

    payload = _wait_for_run_status(client, run_id, {"failed"})
    assert payload["status"] == "failed"
    assert "All provider routes failed before work started." in payload["error"]
    assert fake_db.ai_runs[run_id]["status"] == "failed"
    assert fake_db.ai_runs[run_id]["cost_credits"] == 0
    attempts = [row for row in fake_db.ai_api_calls if row["run_id"] == run_id]
    assert [row["id"] for row in attempts] == [f"ai_call_{run_id}_a1"]
    assert attempts[0]["route_id"] == "route_gpt_image_2_primary"
    assert attempts[0]["status"] == "failed"


def test_ai_run_retries_same_route_before_failing_over(monkeypatch):
    fake_db = FakePostgresDatabase()
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
            "retry_policy": {"maxAttempts": 2},
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
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/ai/runs",
        json={
            "prompt": "Retry this route first",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )
    assert created.status_code == 200
    run_id = created.json()["run"]["runId"]

    payload = _wait_for_run_status(client, run_id, {"succeeded"})
    assert payload["status"] == "succeeded"
    assert payload["routeId"] == "route_gpt_image_2_backup"
    attempts = [row for row in fake_db.ai_api_calls if row["run_id"] == run_id]
    assert [row["id"] for row in attempts] == [
        f"ai_call_{run_id}_a1",
        f"ai_call_{run_id}_a2",
        f"ai_call_{run_id}_a3",
    ]
    assert [row["route_id"] for row in attempts] == [
        "route_gpt_image_2_primary",
        "route_gpt_image_2_primary",
        "route_gpt_image_2_backup",
    ]
    assert attempts[0]["error_code"] == "preflight_route_failure"
    assert attempts[1]["error_code"] == "preflight_route_failure"
    assert attempts[2]["status"] == "succeeded"


def test_ai_run_timeout_stops_failover_to_avoid_duplicate_provider_work(monkeypatch):
    fake_db = FakePostgresDatabase()
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
            "timeout_ms": 5,
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
    monkeypatch.setenv("TANGENT_AI_STUB_ROUTE_LATENCY_MS", "route_gpt_image_2_primary=25")
    monkeypatch.delenv("TANGENT_AI_MOCK_LEDGER_CHARGING", raising=False)
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/ai/runs",
        json={
            "prompt": "This should timeout",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )
    assert created.status_code == 200
    run_id = created.json()["run"]["runId"]

    payload = _wait_for_run_status(client, run_id, {"failed"})
    assert payload["status"] == "failed"
    assert "Automatic failover stopped" in payload["error"]
    attempts = [row for row in fake_db.ai_api_calls if row["run_id"] == run_id]
    assert [row["id"] for row in attempts] == [f"ai_call_{run_id}_a1"]
    assert attempts[0]["route_id"] == "route_gpt_image_2_primary"
    assert attempts[0]["error_code"] == "provider_timeout"


def test_ai_run_quote_returns_tier_based_estimate_and_preflight(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.model_registry = [
        {
            "model_key": "gpt-image-2",
            "display_name": "GPT Image 2",
            "capability": "image_generation",
            "capabilities": ["image_generation", "image_edit"],
            "parameter_schema": {"resolution": ["0.5K", "1K", "2K"]},
            "cost_hint": "Use low quality for early tests.",
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
    fake_db.model_parameter_tiers = [
        {
            "id": "tier_gpt_image_2_2k",
            "model_key": "gpt-image-2",
            "tier_key": "2k",
            "public_label": "2K",
            "parameter_key": "resolution",
            "provider_params": {"resolution": "2K"},
            "sort_order": 30,
            "enabled": True,
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
            "retry_policy": {"maxAttempts": 2},
            "enabled": True,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    fake_db.model_pricing_rules = [
        {
            "id": "price_gpt_image_2_2k_v1",
            "model_key": "gpt-image-2",
            "tier_key": "2k",
            "billing_unit": "per_image",
            "estimated_credits": 9,
            "min_credits": 9,
            "credit_multiplier": 1,
            "provider_cost_formula": {"unit": "image"},
            "status": "active",
            "effective_from": "2026-05-06T00:00:00Z",
            "effective_to": None,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]
    fake_db.credit_ledger = [
        {
            "account_id": "credit_user_user_quote",
            "credits_delta": 30,
            "id": "ledger_quote_seed",
            "reason": "topup_purchase",
            "source_type": "payment",
        }
    ]
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/ai/runs/quote",
        headers={
            "x-tangent-user-id": "user_quote",
            "x-tangent-workspace-id": "workspace_group",
            "x-tangent-workspace-kind": "group_workspace",
        },
        json={
            "params": {"count": 2, "resolution": "2K"},
            "prompt": "Two images",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )

    assert response.status_code == 200
    quote = response.json()["quote"]
    assert quote["modelId"] == "gpt-image-2"
    assert quote["selectedTierKey"] == "2k"
    assert quote["estimatedCredits"] == 18
    assert quote["canRun"] is True
    assert quote["preflightStatus"] == "ok"


def test_live_provider_adapter_persists_provider_cost_and_settles_by_actual_outputs(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.model_registry = [
        {
            "model_key": "gpt-image-2",
            "display_name": "GPT Image 2",
            "capability": "image_generation",
            "capabilities": ["image_generation", "image_edit"],
            "parameter_schema": {"resolution": ["1K"]},
            "cost_hint": "Live route tests",
            "estimated_latency": "5-12s",
            "enabled": True,
            "is_default": True,
            "provider_key": "openai",
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
            "provider_key": "openai",
            "provider_model": "gpt-image-2",
            "route_key": "openai-primary",
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
            "provider_cost_formula": {"type": "per_image", "currency": "USD", "amount": 0.04},
            "status": "active",
            "effective_from": "2026-05-06T00:00:00Z",
            "effective_to": None,
            "created_at": "2026-05-06T00:00:00Z",
            "updated_at": "2026-05-06T00:00:00Z",
        }
    ]

    def fake_live_attempt(*_args, **_kwargs):
        return AiProviderAttemptResult(
            created_at="2026-05-06T00:00:00Z",
            error_code=None,
            error_message=None,
            latency_ms=320,
            output_asset_ids=["asset_live_single_output"],
            provider="openai",
            provider_cost=0.031,
            provider_currency="USD",
            retryable=False,
            route_id="route_gpt_image_2_primary",
            route_key="openai-primary",
            status="succeeded",
            text_output=None,
            work_started=True,
        )

    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.setenv("TANGENT_AI_PROVIDER_OPENAI_MODE", "live")
    monkeypatch.delenv("TANGENT_AI_MOCK_LEDGER_CHARGING", raising=False)
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_provider_adapters.run_openai_compatible_attempt", fake_live_attempt)
    client = TestClient(app)

    created = client.post(
        "/api/v1/ai/runs",
        json={
            "params": {"count": 2, "resolution": "1K"},
            "prompt": "Live execute one output",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )
    assert created.status_code == 200
    run_id = created.json()["run"]["runId"]

    settled = _wait_for_run_status(client, run_id, {"succeeded"})
    assert settled["provider"] == "openai"
    assert settled["providerCost"] == 0.031
    assert settled["providerCurrency"] == "USD"
    assert settled["costCredits"] == 5
    assert fake_db.ai_runs[run_id]["provider_cost"] == 0.031
    assert fake_db.ai_runs[run_id]["provider_currency"] == "USD"
    assert fake_db.ai_api_calls[-1]["provider_currency"] == "USD"
    assert fake_db.ai_api_calls[-1]["credits_charged"] == 5


def test_ai_run_auth_required_mode(monkeypatch):
    monkeypatch.setenv("TANGENT_REQUIRE_API_AUTH", "1")

    async def fake_resolve_authenticated_request_context(
        token: str,
        requested_workspace_id: object = None,
        request_ip: object = None,
    ) -> ApiRequestContext:
        assert token == "valid-token"
        assert requested_workspace_id is None
        assert request_ip == "testclient"
        return ApiRequestContext(
            auth_mode="required",
            is_dev_fallback=False,
            user_avatar_initials="CU",
            user_display_name="Clerk User",
            user_email="user@example.com",
            user_email_verified=True,
            user_id="user_clerk_123",
            workspace_board_count=0,
            workspace_id="workspace_clerk_123",
            workspace_kind="team_workspace",
            workspace_name="Tanergy Workspace",
            workspace_role="owner",
        )

    monkeypatch.setattr(
        "tangent_api.request_context.resolve_authenticated_request_context",
        fake_resolve_authenticated_request_context,
    )
    client = TestClient(app)

    missing = client.get("/api/v1/ai/models?capability=image_generation")
    assert missing.status_code == 401

    explicit = client.get(
        "/api/v1/ai/models?capability=image_generation",
        headers={"Authorization": "Bearer valid-token"},
    )
    assert explicit.status_code == 200


def _wait_for_run_status(client: TestClient, run_id: str, statuses: set[str], timeout_seconds: float = 1.0) -> dict[str, object]:
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
