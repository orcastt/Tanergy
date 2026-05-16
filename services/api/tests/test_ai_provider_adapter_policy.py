from tangent_api.ai_provider_adapters import execute_ai_provider_attempt
from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunChargeSummary, AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext


def test_execute_ai_provider_attempt_disables_stub_in_staging(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")

    result = execute_ai_provider_attempt(_run_record(), _request(), _route(), _context())

    assert result.status == "failed"
    assert result.error_code == "provider_stub_disabled"


def test_execute_ai_provider_attempt_defaults_to_live_in_staging_when_provider_credentials_exist(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.setenv("GEEKAI_API_KEY", "test-key")
    monkeypatch.setenv("GEEKAI_BASE_URL", "https://example.com/v1")

    def fake_live_attempt(*_args, **_kwargs):
        return AiProviderAttemptResult(
            created_at="2026-05-14T00:00:00Z",
            error_code=None,
            error_message=None,
            latency_ms=120,
            output_asset_ids=["asset_live_1"],
            provider="geekai",
            provider_cost=None,
            provider_currency=None,
            retryable=False,
            route_id="route_gpt_image_2_primary",
            route_key="geekai-primary",
            status="succeeded",
            text_output=None,
            work_started=True,
        )

    monkeypatch.setattr("tangent_api.ai_provider_adapters.run_geekai_attempt", fake_live_attempt)

    result = execute_ai_provider_attempt(_run_record(), _request(), _route(), _context())

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_live_1"]


def test_execute_ai_provider_attempt_keeps_stub_in_local_default(monkeypatch):
    monkeypatch.delenv("APP_ENV", raising=False)

    result = execute_ai_provider_attempt(_run_record(), _request(), _route(), _context())

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_mock_run_test_1_sunset-forest_refs0"]


def test_execute_ai_provider_attempt_uses_dedicated_nano_banana_credentials(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.delenv("GEEKAI_API_KEY", raising=False)
    monkeypatch.delenv("GEEKAI_BASE_URL", raising=False)
    monkeypatch.setenv("GEEKAI_NANO_BANANA_API_KEY", "nano-key")
    monkeypatch.setenv("GEEKAI_NANO_BANANA_BASE_URL", "https://nano.example.com/v1")

    def fake_live_attempt(*_args, **_kwargs):
        return AiProviderAttemptResult(
            created_at="2026-05-14T00:00:00Z",
            error_code=None,
            error_message=None,
            latency_ms=90,
            output_asset_ids=["asset_nano_1"],
            provider="geekai",
            provider_cost=None,
            provider_currency=None,
            retryable=False,
            route_id="route_nano_banana_2_primary",
            route_key="geekai-primary",
            status="succeeded",
            text_output=None,
            work_started=True,
        )

    monkeypatch.setattr("tangent_api.ai_provider_adapters.run_geekai_attempt", fake_live_attempt)

    result = execute_ai_provider_attempt(
        _run_record(model_id="nano-banana-2", route_id="route_nano_banana_2_primary"),
        _request(model_id="nano-banana-2"),
        _route(provider_model="nano-banana-2", route_id="route_nano_banana_2_primary"),
        _context(),
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_nano_1"]


def test_execute_ai_provider_attempt_does_not_use_nano_only_credentials_for_other_models(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.delenv("GEEKAI_API_KEY", raising=False)
    monkeypatch.delenv("GEEKAI_BASE_URL", raising=False)
    monkeypatch.setenv("GEEKAI_NANO_BANANA_API_KEY", "nano-key")
    monkeypatch.setenv("GEEKAI_NANO_BANANA_BASE_URL", "https://nano.example.com/v1")

    result = execute_ai_provider_attempt(_run_record(), _request(), _route(), _context())

    assert result.status == "failed"
    assert result.error_code == "provider_stub_disabled"


def test_execute_ai_provider_attempt_uses_text_credentials_for_text_runs(monkeypatch):
    monkeypatch.setenv("APP_ENV", "staging")
    monkeypatch.delenv("GEEKAI_API_KEY", raising=False)
    monkeypatch.delenv("GEEKAI_BASE_URL", raising=False)
    monkeypatch.setenv("GEEKAI_TEXT_API_KEY", "text-key")
    monkeypatch.setenv("GEEKAI_TEXT_BASE_URL", "https://text.example.com/v1")

    def fake_live_attempt(*_args, **_kwargs):
        return AiProviderAttemptResult(
            created_at="2026-05-15T00:00:00Z",
            error_code=None,
            error_message=None,
            latency_ms=80,
            output_asset_ids=[],
            provider="geekai",
            provider_cost=None,
            provider_currency=None,
            retryable=False,
            route_id="route_gpt_5_5_primary",
            route_key="geekai-gpt55-primary",
            status="succeeded",
            text_output="ok",
            work_started=True,
        )

    monkeypatch.setattr("tangent_api.ai_provider_adapters.run_geekai_attempt", fake_live_attempt)

    result = execute_ai_provider_attempt(
        _run_record(model_id="gpt-5.5", route_id="route_gpt_5_5_primary", run_type="text"),
        _request(model_id="gpt-5.5", node_type="chat", run_type="text"),
        _route(provider_model="gpt-5.5", route_id="route_gpt_5_5_primary"),
        _context(),
    )

    assert result.status == "succeeded"
    assert result.text_output == "ok"


def _route(provider_model="gpt-image-2", route_id="route_gpt_image_2_primary"):
    return AiProviderRouteCandidate(
        health_status="healthy",
        priority=10,
        provider_key="geekai",
        provider_model=provider_model,
        retry_policy={"maxAttempts": 1},
        route_id=route_id,
        route_key="geekai-primary",
        timeout_ms=60_000,
        weight=100,
    )


def _request(model_id="gpt-image-2", node_type="image_gen", run_type="image_generation"):
    return AiRunRequest(
        boardId=None,
        inputAssetIds=[],
        nodeId=None,
        nodeType=node_type,
        params={"count": 1},
        prompt="Sunset forest",
        runType=run_type,
        selectedModelId=model_id,
        systemPrompt=None,
    )


def _run_record(model_id="gpt-image-2", route_id="route_gpt_image_2_primary", run_type="image_generation"):
    charge = AiRunChargeSummary(
        chargedAccountId="account_test",
        chargedScope="personal",
        entitlementSource="subscription",
        payerLabel="Test User",
        planKey="free",
        preflightStatus="ok",
        workspaceKind="solo_workspace",
        workspaceSeatId=None,
    )
    return AiRunRecord(
        boardId=None,
        charge=charge,
        chargedAccountId="account_test",
        chargedScope="personal",
        costCredits=0,
        costHint="Queued",
        createdAt="2026-05-14T00:00:00Z",
        estimatedCredits=5,
        entitlementSource="subscription",
        error=None,
        inputAssetIds=[],
        latencyMs=0,
        modelId=model_id,
        nodeId=None,
        outputAssetIds=[],
        pricingRuleId="price_test",
        provider="geekai",
        providerCost=None,
        providerCurrency=None,
        routeId=route_id,
        routeKey="geekai-primary",
        runId="run_test",
        runType=run_type,
        selectedTierKey="1k",
        status="queued",
        textOutput=None,
        workspaceKind="solo_workspace",
        workspaceSeatId=None,
    )


def _context():
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email="test@example.com",
        user_email_verified=True,
        user_id="user_test",
        workspace_board_count=0,
        workspace_id="workspace_test",
        workspace_kind="solo_workspace",
        workspace_name="Test Workspace",
        workspace_role="owner",
    )
