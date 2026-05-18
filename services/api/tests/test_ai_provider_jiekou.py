import base64

import httpx

from tangent_api.ai_provider_assets import ProviderImageOutput, ProviderInputAsset
from tangent_api.ai_provider_jiekou import run_jiekou_attempt
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunChargeSummary, AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext


def test_run_jiekou_attempt_routes_nano_banana_i2i(monkeypatch):
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
                json={"images": ["https://cdn.example.test/generated.png"]},
                request=httpx.Request("POST", url),
            )

    monkeypatch.setattr("tangent_api.ai_provider_jiekou.httpx.Client", FakeClient)
    monkeypatch.setattr(
        "tangent_api.ai_provider_jiekou_image_requests.load_provider_input_assets",
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
    monkeypatch.setattr(
        "tangent_api.ai_provider_jiekou_image_requests.download_provider_image",
        lambda url, timeout_seconds, headers=None: ProviderImageOutput(content=b"\x89PNG\r\n\x1a\nout", mime="image/png"),
    )
    monkeypatch.setattr(
        "tangent_api.ai_provider_jiekou.persist_provider_output_assets",
        lambda outputs, context, payload, provider: ["asset_generated_1"],
    )

    result = run_jiekou_attempt(
        _run_record(model_id="nano-banana-2"),
        _request(
            model_id="nano-banana-2",
            params={"aspectRatio": "1:4", "count": 1, "imageSize": "0.5K"},
            input_asset_ids=["asset_ref_1"],
        ),
        _route(provider_model="nano-banana-2"),
        _context(),
        api_key="test-key",
        base_url="https://api.jiekou.ai",
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_generated_1"]
    assert captured_request["url"] == "https://api.jiekou.ai/v3/gemini-3.1-flash-image-edit"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    assert request_json["size"] == "0.5K"
    assert request_json["aspect_ratio"] == "1:4"
    assert request_json["output_format"] == "png"
    expected_base64 = base64.b64encode(b"\x89PNG\r\n\x1a\nmock").decode("ascii")
    assert request_json["image_base64s"] == [expected_base64]


def test_run_jiekou_attempt_posts_seedream_group_generation(monkeypatch):
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
                json={"images": ["https://cdn.example.test/1.png", "https://cdn.example.test/2.png"]},
                request=httpx.Request("POST", url),
            )

    monkeypatch.setattr("tangent_api.ai_provider_jiekou.httpx.Client", FakeClient)
    monkeypatch.setattr(
        "tangent_api.ai_provider_jiekou_image_requests.download_provider_image",
        lambda url, timeout_seconds, headers=None: ProviderImageOutput(content=b"\x89PNG\r\n\x1a\nout", mime="image/png"),
    )
    monkeypatch.setattr(
        "tangent_api.ai_provider_jiekou.persist_provider_output_assets",
        lambda outputs, context, payload, provider: ["asset_generated_1", "asset_generated_2"],
    )

    result = run_jiekou_attempt(
        _run_record(model_id="doubao-seedream-5.0-lite", route_id="route_doubao_seedream_5_0_lite_primary"),
        _request(
            model_id="doubao-seedream-5.0-lite",
            params={"count": 2, "seedreamSize": "3K"},
        ),
        _route(provider_model="doubao-seedream-5.0-lite", route_id="route_doubao_seedream_5_0_lite_primary"),
        _context(),
        api_key="test-key",
        base_url="https://api.jiekou.ai/v3",
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_generated_1", "asset_generated_2"]
    assert captured_request["url"] == "https://api.jiekou.ai/v3/seedream-5.0-lite"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    assert request_json["size"] == "3K"
    assert request_json["sequential_image_generation"] == "auto"
    assert request_json["sequential_image_generation_options"] == {"max_images": 2}
    assert request_json["optimize_prompt_options"] == {"mode": "standard"}


def test_run_jiekou_attempt_routes_gpt_image_2_edit(monkeypatch):
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
                json={"images": ["https://cdn.example.test/gpt-edit.png"]},
                request=httpx.Request("POST", url),
            )

    monkeypatch.setattr("tangent_api.ai_provider_jiekou.httpx.Client", FakeClient)
    monkeypatch.setattr(
        "tangent_api.ai_provider_jiekou_image_requests.load_provider_input_assets",
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
    monkeypatch.setattr(
        "tangent_api.ai_provider_jiekou_image_requests.download_provider_image",
        lambda url, timeout_seconds, headers=None: ProviderImageOutput(content=b"\x89PNG\r\n\x1a\nout", mime="image/png"),
    )
    monkeypatch.setattr(
        "tangent_api.ai_provider_jiekou.persist_provider_output_assets",
        lambda outputs, context, payload, provider: ["asset_gpt_edit_1"],
    )

    result = run_jiekou_attempt(
        _run_record(model_id="gpt-image-2"),
        _request(
            model_id="gpt-image-2",
            params={"count": 1, "quality": "high", "size": "2048x1536"},
            input_asset_ids=["asset_ref_1"],
        ),
        _route(provider_model="gpt-image-2"),
        _context(),
        api_key="test-key",
        base_url="https://api.jiekou.ai",
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_gpt_edit_1"]
    assert captured_request["url"] == "https://api.jiekou.ai/v3/gpt-image-2-edit"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    assert request_json["quality"] == "high"
    assert request_json["size"] == "2048x1536"
    assert request_json["background"] == "auto"
    assert request_json["output_format"] == "png"


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
    params=None,
    input_asset_ids=None,
):
    return AiRunRequest(
        boardId=None,
        inputAssetIds=input_asset_ids or [],
        nodeId=None,
        nodeType=node_type,
        params=params or {"count": 1},
        prompt="Sunset forest",
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
        createdAt="2026-05-16T00:00:00Z",
        estimatedCredits=5,
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
