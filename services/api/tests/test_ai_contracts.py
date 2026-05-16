import json
import time

from fastapi.testclient import TestClient

from tangent_api.main import app
from tangent_api import ai_contracts, ai_provider_assets
from tangent_api.ai_provider_assets import ProviderInputAsset
from tangent_api.ai_provider_openai_compatible import run_openai_compatible_attempt
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunChargeSummary, AiRunRecord, AiRunRequest
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
        "doubao-seedream-5.0-lite",
        "jimeng_t2i_v40",
        "nano-banana-2",
    ]
    assert models[0]["isDefault"] is True
    assert models[0]["parameterSchema"]["size"]
    assert models[-1]["parameterSchema"]["imageSize"]

    analysis_response = client.get("/api/v1/ai/models?capability=image_analysis")

    assert analysis_response.status_code == 200
    analysis_models = analysis_response.json()["models"]
    assert {model["id"] for model in analysis_models} == {
        "gpt-5.5",
        "gpt-5-mini",
        "gpt-4o-mini",
        "gemini-2.5-flash",
    }

    text_response = client.get("/api/v1/ai/models?capability=text")

    assert text_response.status_code == 200
    text_models = text_response.json()["models"]
    assert [model["id"] for model in text_models] == ["gpt-5.5", "gpt-5-mini"]
    assert text_models[0]["isDefault"] is True


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


def test_ai_run_mock_analysis_uses_supported_analysis_model():
    client = TestClient(app)

    response = client.post(
        "/api/v1/ai/runs",
        json={
            "boardId": "board_ai_analysis",
            "inputAssetIds": ["asset_ref_1"],
            "nodeId": "node_analysis",
            "nodeType": "analysis",
            "prompt": "Describe the lighting and composition.",
            "runType": "image_analysis",
            "selectedModelId": "gpt-5-mini",
        },
    )

    assert response.status_code == 200
    run = response.json()["run"]
    assert run["estimatedCredits"] == 2
    assert run["modelId"] == "gpt-5-mini"
    assert run["provider"] == "geekai"
    assert run["status"] == "queued"

    loaded = _wait_for_run_status(client, run["runId"], {"succeeded"})
    assert loaded["modelId"] == "gpt-5-mini"
    assert loaded["outputAssetIds"] == []
    assert loaded["textOutput"]
    assert "Mock analysis" in loaded["textOutput"]


def test_provider_base64_image_decode_rejects_estimated_oversize_payload(monkeypatch):
    monkeypatch.setattr(ai_provider_assets, "MAX_ASSET_BYTES", 2)

    try:
        ai_provider_assets.decode_b64_image("AAAA")
    except ValueError as exc:
        assert "asset size limit" in str(exc)
    else:
        raise AssertionError("Expected oversized provider image output to be rejected.")


def test_provider_input_assets_reject_total_oversize_payload(monkeypatch):
    class FakeStorage:
        def get_record(self, asset_id, context):
            return type(
                "Record",
                (),
                {
                    "height": 1,
                    "mime": "image/png",
                    "original_url": f"/assets/{asset_id}/original.png",
                    "title": asset_id,
                    "width": 1,
                },
            )()

        def get_file_bytes(self, asset_id, file_name, context):
            _ = (asset_id, file_name, context)
            return b"abc"

    monkeypatch.setattr(ai_provider_assets, "MAX_PROVIDER_INPUT_TOTAL_BYTES", 4)
    monkeypatch.setattr("tangent_api.ai_provider_assets.get_asset_storage_adapter", lambda: FakeStorage())

    context = ApiRequestContext(
        auth_mode="dev-bypass",
        is_dev_fallback=True,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email="test@example.com",
        user_email_verified=True,
        user_id="user_test",
        workspace_board_count=1,
        workspace_id="workspace_test",
        workspace_kind="group_workspace",
        workspace_name="Test Workspace",
        workspace_role="owner",
    )
    payload = AiRunRequest(
        input_asset_ids=["asset_a", "asset_b"],
        prompt="Describe the attached images.",
        run_type="image_analysis",
        selected_model_id="gpt-5-mini",
    )

    try:
        ai_provider_assets.load_provider_input_assets(payload, context)
    except ValueError as exc:
        assert "total size limit" in str(exc)
    else:
        raise AssertionError("Expected oversized provider input assets to be rejected.")


def test_provider_input_assets_can_prefer_preview_bytes(monkeypatch):
    requested_files = []

    class FakeStorage:
        def get_record(self, asset_id, context):
            _ = context
            return type(
                "Record",
                (),
                {
                    "height": 640,
                    "mime": "image/png",
                    "original_url": f"/assets/{asset_id}/original.png",
                    "thumbnail1024_url": f"/assets/{asset_id}/thumb-1024.webp",
                    "thumbnail512_url": f"/assets/{asset_id}/thumb-512.webp",
                    "thumbnail256_url": None,
                    "title": asset_id,
                    "width": 960,
                },
            )()

        def get_file_bytes(self, asset_id, file_name, context):
            _ = (asset_id, context)
            requested_files.append(file_name)
            return b"preview"

    monkeypatch.setattr("tangent_api.ai_provider_assets.get_asset_storage_adapter", lambda: FakeStorage())

    context = _make_test_context()
    payload = AiRunRequest(
        input_asset_ids=["asset_preview"],
        prompt="Describe the attached image.",
        run_type="image_analysis",
        selected_model_id="gpt-5-mini",
    )

    assets = ai_provider_assets.load_provider_input_assets(payload, context, prefer_preview=True)

    assert requested_files == ["thumb-1024.webp"]
    assert assets[0].file_name == "thumb-1024.webp"
    assert assets[0].content == b"preview"


def test_persist_provider_output_assets_skips_input_reload_when_dimensions_do_not_depend_on_input(monkeypatch):
    class FakeStorage:
        def get_record(self, asset_id, context):
            raise AssertionError(f"Unexpected record load for {asset_id}.")

        def get_file_bytes(self, asset_id, file_name, context):
            raise AssertionError(f"Unexpected byte load for {asset_id}:{file_name}.")

        def create_from_bytes(self, *, content, mime, context, origin, title, width, height):
            _ = (content, mime, context, origin, title, width, height)
            return type("Asset", (), {"id": "asset_generated"})()

    monkeypatch.setattr("tangent_api.ai_provider_assets.get_asset_storage_adapter", lambda: FakeStorage())

    context = _make_test_context()
    payload = AiRunRequest(
        input_asset_ids=["asset_original"],
        params={"aspectRatio": "1:1", "resolution": "1K"},
        prompt="Generate a poster.",
        run_type="image_generation",
        selected_model_id="gpt-image-2",
    )

    asset_ids = ai_provider_assets.persist_provider_output_assets(
        [ai_provider_assets.ProviderImageOutput(content=b"png", mime="image/png")],
        context,
        payload,
        "openai",
    )

    assert asset_ids == ["asset_generated"]


def test_persist_provider_output_assets_prefers_detected_output_dimensions(monkeypatch):
    recorded_dimensions: list[tuple[int, int]] = []

    class FakeStorage:
        def get_record(self, asset_id, context):
            raise AssertionError(f"Unexpected record load for {asset_id}.")

        def get_file_bytes(self, asset_id, file_name, context):
            raise AssertionError(f"Unexpected byte load for {asset_id}:{file_name}.")

        def create_from_bytes(self, *, content, mime, context, origin, title, width, height):
            _ = (content, mime, context, origin, title)
            recorded_dimensions.append((width, height))
            return type("Asset", (), {"id": "asset_generated"})()

    monkeypatch.setattr("tangent_api.ai_provider_assets.get_asset_storage_adapter", lambda: FakeStorage())

    context = _make_test_context()
    payload = AiRunRequest(
        input_asset_ids=[],
        params={"aspectRatio": "1:1", "imageSize": "1K"},
        prompt="Generate a poster.",
        run_type="image_generation",
        selected_model_id="nano-banana-2",
    )

    asset_ids = ai_provider_assets.persist_provider_output_assets(
        [ai_provider_assets.ProviderImageOutput(content=_png_with_dimensions(640, 960), mime="image/png")],
        context,
        payload,
        "geekai",
    )

    assert asset_ids == ["asset_generated"]
    assert recorded_dimensions == [(640, 960)]


def test_resolve_requested_dimensions_uses_image_size_and_ratio_for_nano_banana():
    payload = AiRunRequest(
        input_asset_ids=[],
        params={"aspectRatio": "9:16", "imageSize": "0.5K"},
        prompt="Generate a poster.",
        run_type="image_generation",
        selected_model_id="nano-banana-2",
    )

    assert ai_provider_assets.resolve_requested_dimensions(payload) == (288, 512)


def test_resolve_requested_dimensions_ignores_unrelated_gpt_size_for_nano_banana():
    payload = AiRunRequest(
        input_asset_ids=[],
        params={"aspectRatio": "3:4", "imageSize": "0.5K", "size": "1024x1024"},
        prompt="Generate a portrait poster.",
        run_type="image_generation",
        selected_model_id="nano-banana-2",
    )

    assert ai_provider_assets.resolve_requested_dimensions(payload) == (384, 512)


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


def _make_test_context():
    return ApiRequestContext(
        auth_mode="dev-bypass",
        is_dev_fallback=True,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email="test@example.com",
        user_email_verified=True,
        user_id="user_test",
        workspace_board_count=1,
        workspace_id="workspace_test",
        workspace_kind="group_workspace",
        workspace_name="Test Workspace",
        workspace_role="owner",
    )


def _png_with_dimensions(width: int, height: int) -> bytes:
    return (
        b"\x89PNG\r\n\x1a\n"
        + b"\x00\x00\x00\rIHDR"
        + width.to_bytes(4, "big")
        + height.to_bytes(4, "big")
        + b"\x08\x06\x00\x00\x00"
        + b"\x00\x00\x00\x00"
    )


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


def test_ai_run_persisted_terminal_state_clears_in_memory_fallbacks(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.delenv("TANGENT_AI_MOCK_LEDGER_CHARGING", raising=False)
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    created = client.post(
        "/api/v1/ai/runs",
        json={
            "boardId": "board_memory_cleanup",
            "prompt": "Clear in-memory fallback caches after persistence",
            "runType": "image_generation",
            "selectedModelId": "gpt-image-2",
        },
    )

    assert created.status_code == 200
    run_id = created.json()["run"]["runId"]
    assert run_id not in ai_contracts.RUN_REQUESTS
    assert run_id in ai_contracts.RUN_CONTEXTS

    settled = _wait_for_run_status(client, run_id, {"succeeded"})

    assert settled["status"] == "succeeded"
    assert run_id not in ai_contracts.RUNS
    assert run_id not in ai_contracts.RUN_REQUESTS
    assert run_id not in ai_contracts.RUN_CONTEXTS


def test_ai_text_run_persists_text_output_and_system_prompt(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("DATABASE_URL", "postgresql://test")
    monkeypatch.delenv("TANGENT_AI_MOCK_LEDGER_CHARGING", raising=False)
    monkeypatch.setattr("tangent_api.ai_control_plane.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.ai_run_persistence.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.credit_ledger.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.workspace_entitlements.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    response = client.post(
        "/api/v1/ai/runs",
        json={
            "boardId": "board_prompt_optimizer",
            "nodeId": "node_prompt_optimizer",
            "nodeType": "prompt_optimizer",
            "prompt": "A clean ceramic cup poster",
            "runType": "text",
            "selectedModelId": "gpt-5.5",
            "systemPrompt": "You are a prompt optimizer for AI image generation.",
        },
    )

    assert response.status_code == 200
    run = response.json()["run"]
    assert run["estimatedCredits"] == 4
    assert run["modelId"] == "gpt-5.5"
    assert run["status"] == "queued"

    settled = _wait_for_run_status(client, run["runId"], {"succeeded"})
    assert settled["runType"] == "text"
    assert "clean ceramic cup poster" in (settled["textOutput"] or "").lower()
    assert fake_db.ai_runs[run["runId"]]["params"]["systemPrompt"] == "You are a prompt optimizer for AI image generation."
    assert fake_db.ai_runs[run["runId"]]["text_output"] == settled["textOutput"]


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


def test_openai_compatible_live_attempt_supports_image_analysis(monkeypatch):
    captured_request: dict[str, object] = {}

    class FakeResponse:
        def __init__(self, body: dict[str, object]):
            self._body = body
            self.content = json.dumps(body).encode("utf-8")
            self.headers = {"content-length": str(len(self.content))}
            self.status_code = 200
            self.text = self.content.decode("utf-8")

        def raise_for_status(self):
            return None

        def json(self):
            return self._body

    class FakeClient:
        def __init__(self, *args, **kwargs):
            _ = args
            _ = kwargs

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            _ = exc_type
            _ = exc
            _ = tb
            return False

        def post(self, path: str, headers: dict[str, str], json: dict[str, object]):
            captured_request["path"] = path
            captured_request["headers"] = headers
            captured_request["json"] = json
            return FakeResponse(
                {
                    "choices": [
                        {
                            "message": {
                                "content": "Detailed analysis result.",
                            }
                        }
                    ],
                    "usage": {
                        "cost": 0.01,
                        "currency": "USD",
                    },
                }
            )

    monkeypatch.setattr("tangent_api.ai_provider_openai_compatible.httpx.Client", FakeClient)
    monkeypatch.setattr(
        "tangent_api.ai_provider_openai_compatible.load_provider_input_assets",
        lambda payload, context, prefer_preview=False: [
            ProviderInputAsset(
                asset_id="asset_ref_1",
                content=b"\x89PNG\r\n\x1a\nmock",
                file_name="reference.png",
                height=512,
                mime="image/png",
                title="Reference",
                width=512,
            )
        ],
    )

    route = AiProviderRouteCandidate(
        health_status="healthy",
        priority=10,
        provider_key="geekai",
        provider_model="gpt-5-mini",
        retry_policy={"maxAttempts": 2},
        route_id="route_gpt_5_mini_primary",
        route_key="geekai-multimodal-primary",
        timeout_ms=45000,
        weight=100,
    )
    context = ApiRequestContext(
        auth_mode="dev-bypass",
        is_dev_fallback=True,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email="test@example.com",
        user_email_verified=True,
        user_id="user_test",
        workspace_board_count=1,
        workspace_id="workspace_test",
        workspace_kind="group_workspace",
        workspace_name="Test Workspace",
        workspace_role="owner",
    )
    payload = AiRunRequest(
        board_id="board_analysis_live",
        input_asset_ids=["asset_ref_1"],
        node_id="node_analysis",
        node_type="analysis",
        prompt="Describe the attached image.",
        run_type="image_analysis",
        selected_model_id="gpt-5-mini",
    )
    run = AiRunRecord(
        board_id="board_analysis_live",
        charge=AiRunChargeSummary(
            charged_account_id="credit_user_test",
            charged_scope="actor_personal",
            entitlement_source="personal_topup_or_free",
            payer_label="Charges your credits",
            plan_key="free_canvas",
            preflight_status="mock_contract_only",
            workspace_kind="group_workspace",
            workspace_seat_id=None,
        ),
        charged_account_id="credit_user_test",
        charged_scope="actor_personal",
        cost_credits=0,
        cost_hint="Estimated 2 credits · GPT-5 Mini",
        created_at="2026-05-13T00:00:00Z",
        estimated_credits=2,
        entitlement_source="personal_topup_or_free",
        error=None,
        input_asset_ids=["asset_ref_1"],
        latency_ms=0,
        model_id="gpt-5-mini",
        node_id="node_analysis",
        output_asset_ids=[],
        pricing_rule_id="price_gpt_5_mini_v1",
        provider="geekai",
        provider_cost=None,
        provider_currency=None,
        route_id="route_gpt_5_mini_primary",
        route_key="geekai-multimodal-primary",
        run_id="run_analysis_live",
        run_type="image_analysis",
        selected_tier_key=None,
        status="running",
        text_output=None,
        workspace_kind="group_workspace",
        workspace_seat_id=None,
    )

    result = run_openai_compatible_attempt(
        run,
        payload,
        route,
        context,
        api_key="test-key",
        base_url="https://example.test/v1",
    )

    assert result.status == "succeeded"
    assert result.text_output == "Detailed analysis result."
    assert result.provider_cost == 0.01
    assert result.provider_currency == "USD"
    assert captured_request["path"] == "/chat/completions"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    messages = request_json["messages"]
    assert isinstance(messages, list)
    user_message = messages[-1]
    assert isinstance(user_message, dict)
    content = user_message["content"]
    assert isinstance(content, list)
    assert content[0]["type"] == "text"
    assert content[1]["type"] == "image_url"


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
