import httpx

from tangent_api.ai_provider_openai_compatible import run_openai_compatible_attempt
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunChargeSummary, AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext


def test_run_openai_compatible_attempt_flattens_hunyuan_system_prompt(monkeypatch):
    captured_request: dict[str, object] = {}

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
            return httpx.Response(
                200,
                json={"choices": [{"message": {"content": "Polished prompt result."}}]},
                request=httpx.Request("POST", f"https://example.test{path}"),
            )

    monkeypatch.setattr("tangent_api.ai_provider_openai_compatible.httpx.Client", FakeClient)

    result = run_openai_compatible_attempt(
        _run_record(model_id="hunyuan-3.0-preview", route_id="route_hunyuan_text_primary", run_type="text"),
        _request(
            model_id="hunyuan-3.0-preview",
            node_type="prompt_optimizer",
            run_type="text",
            prompt="A clean ceramic cup poster",
            system_prompt="You are a prompt optimizer for AI image generation.",
        ),
        _route(provider_model="hunyuan-3.0-preview", route_id="route_hunyuan_text_primary"),
        _context(),
        api_key="test-key",
        base_url="https://example.test/v1",
    )

    assert result.status == "succeeded"
    assert result.text_output == "Polished prompt result."
    assert captured_request["path"] == "/chat/completions"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    messages = request_json["messages"]
    assert isinstance(messages, list)
    assert messages
    assert all(isinstance(message, dict) and message.get("role") != "system" for message in messages)
    first_message = messages[0]
    assert isinstance(first_message, dict)
    assert first_message["role"] == "user"
    assert request_json["stream"] is True
    assert "System instruction:" in str(first_message["content"])
    assert "A clean ceramic cup poster" in str(first_message["content"])


def test_run_openai_compatible_attempt_parses_streaming_text(monkeypatch):
    captured_request: dict[str, object] = {}

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
            body = (
                'data: {"choices":[{"delta":{"content":"Polished "}}]}\n\n'
                'data: {"choices":[{"delta":{"content":"prompt."}}]}\n\n'
                "data: [DONE]\n\n"
            )
            return httpx.Response(
                200,
                content=body.encode("utf-8"),
                headers={"content-type": "text/event-stream"},
                request=httpx.Request("POST", f"https://example.test{path}"),
            )

    monkeypatch.setattr("tangent_api.ai_provider_openai_compatible.httpx.Client", FakeClient)

    result = run_openai_compatible_attempt(
        _run_record(model_id="qwq-plus-latest", route_id="route_qwq_plus_latest_primary", run_type="text"),
        _request(model_id="qwq-plus-latest", node_type="prompt_optimizer", run_type="text"),
        _route(provider_model="qwq-plus-latest", route_id="route_qwq_plus_latest_primary"),
        _context(),
        api_key="test-key",
        base_url="https://example.test/v1",
    )

    assert result.status == "succeeded"
    assert result.text_output == "Polished prompt."
    assert captured_request["path"] == "/chat/completions"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    assert request_json["model"] == "qwq-plus-latest"
    assert request_json["stream"] is True


def _route(provider_model="gpt-image-2", route_id="route_gpt_image_2_primary"):
    return AiProviderRouteCandidate(
        health_status="healthy",
        priority=10,
        provider_key="jiekou",
        provider_model=provider_model,
        retry_policy={"maxAttempts": 1},
        route_id=route_id,
        route_key="jiekou-primary",
        timeout_ms=60_000,
        weight=100,
    )


def _request(
    model_id="gpt-image-2",
    node_type="image_gen",
    run_type="image_generation",
    prompt="Sunset forest",
    system_prompt=None,
):
    return AiRunRequest(
        boardId=None,
        inputAssetIds=[],
        nodeId=None,
        nodeType=node_type,
        params={"count": 1},
        prompt=prompt,
        runType=run_type,
        selectedModelId=model_id,
        systemPrompt=system_prompt,
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
        createdAt="2026-05-15T00:00:00Z",
        estimatedCredits=1,
        entitlementSource="subscription",
        error=None,
        inputAssetIds=[],
        latencyMs=0,
        modelId=model_id,
        nodeId=None,
        outputAssetIds=[],
        pricingRuleId="price_test",
        provider="jiekou",
        providerCost=None,
        providerCurrency=None,
        routeId=route_id,
        routeKey="jiekou-primary",
        runId="run_test",
        runType=run_type,
        selectedTierKey=None,
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
        user_profile_completed=True,
        workspace_board_count=0,
        workspace_id="workspace_test",
        workspace_kind="solo_workspace",
        workspace_memberships=[],
        workspace_name="Test Workspace",
        workspace_plan_key="free_canvas",
        workspace_role="owner",
    )
