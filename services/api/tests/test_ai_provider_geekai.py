import httpx

from tangent_api.ai_provider_assets import ProviderImageOutput
from tangent_api.ai_provider_geekai import run_geekai_attempt
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunChargeSummary, AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext


def test_run_geekai_attempt_posts_gpt_image_2_generation(monkeypatch):
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

        def post(self, url: str, headers: dict[str, str], json: dict[str, object]):
            captured_request["url"] = url
            captured_request["headers"] = headers
            captured_request["json"] = json
            return httpx.Response(
                200,
                json={"data": [{"url": "https://cdn.example.test/gpt-image.png"}]},
                request=httpx.Request("POST", url),
            )

    monkeypatch.setattr("tangent_api.ai_provider_geekai.httpx.Client", FakeClient)
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai_image_requests.download_provider_image",
        lambda url, timeout_seconds, headers=None: ProviderImageOutput(content=b"\x89PNG\r\n\x1a\nout", mime="image/png"),
    )
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.persist_provider_output_assets",
        lambda outputs, context, payload, provider: ["asset_gpt_1"],
    )

    result = run_geekai_attempt(
        _run_record(),
        _request(params={"count": 1, "quality": "high", "size": "2048x1152"}),
        _route(provider_model="gpt-image-2"),
        _context(),
        api_key="test-key",
        base_url="https://geekai.co/api/v1",
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_gpt_1"]
    assert captured_request["url"] == "https://geekai.co/api/v1/images/generations"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    assert request_json["model"] == "gpt-image-2"
    assert request_json["quality"] == "high"
    assert request_json["response_format"] == "url"
    assert request_json["size"] == "2048x1152"


def test_run_geekai_attempt_posts_nano_banana_chat_completion(monkeypatch):
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

        def post(self, url: str, headers: dict[str, str], json: dict[str, object]):
            captured_request["url"] = url
            captured_request["headers"] = headers
            captured_request["json"] = json
            return httpx.Response(
                200,
                json={"choices": [{"message": {"image": {"url": "https://cdn.example.test/nano.png"}}}]},
                request=httpx.Request("POST", url),
            )

    monkeypatch.setattr("tangent_api.ai_provider_geekai.httpx.Client", FakeClient)
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai_image_requests.download_provider_image",
        lambda url, timeout_seconds, headers=None: ProviderImageOutput(content=b"\x89PNG\r\n\x1a\nout", mime="image/png"),
    )
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.persist_provider_output_assets",
        lambda outputs, context, payload, provider: ["asset_nano_1"],
    )

    result = run_geekai_attempt(
        _run_record(model_id="nano-banana-2", route_id="route_nano_banana_2_primary"),
        _request(
            model_id="nano-banana-2",
            params={"aspectRatio": "1:8", "count": 1, "imageSize": "2K"},
        ),
        _route(
            provider_model="gemini-3.1-flash-image-preview",
            route_id="route_nano_banana_2_primary",
        ),
        _context(),
        api_key="test-key",
        base_url="https://geekai.co/api/v1",
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_nano_1"]
    assert captured_request["url"] == "https://geekai.co/api/v1/chat/completions"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    assert request_json["model"] == "gemini-3.1-flash-image-preview"
    assert request_json["image"] == {"aspect_ratio": "1:8", "image_size": "2K"}
    assert request_json["stream"] is False


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


def _request(model_id="gpt-image-2", params=None):
    return AiRunRequest(
        boardId=None,
        inputAssetIds=[],
        nodeId=None,
        nodeType="image_gen",
        params=params or {"count": 1},
        prompt="Draw a dog",
        runType="image_generation",
        selectedModelId=model_id,
        systemPrompt=None,
    )


def _run_record(model_id="gpt-image-2", route_id="route_gpt_image_2_primary"):
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
        createdAt="2026-05-20T00:00:00Z",
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
        runType="image_generation",
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
        user_profile_completed=True,
        workspace_board_count=0,
        workspace_id="workspace_test",
        workspace_kind="solo_workspace",
        workspace_memberships=[],
        workspace_name="Test Workspace",
        workspace_plan_key="free_canvas",
        workspace_role="owner",
    )
