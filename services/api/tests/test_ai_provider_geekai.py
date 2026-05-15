import base64
from typing import Optional

import httpx

from tangent_api.ai_provider_assets import ProviderImageOutput, ProviderInputAsset
from tangent_api.ai_provider_geekai import run_geekai_attempt
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunChargeSummary, AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext


def test_run_geekai_attempt_routes_nano_banana_through_images_edits(monkeypatch):
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
                json={"task_status": "succeed", "data": [{"url": "https://cdn.example.test/generated.png"}]},
                request=httpx.Request("POST", f"https://example.test{path}"),
            )

    monkeypatch.setattr("tangent_api.ai_provider_geekai.httpx.Client", FakeClient)
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.load_provider_input_assets",
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
        "tangent_api.ai_provider_geekai.download_provider_image",
        lambda url, timeout_seconds, headers=None: ProviderImageOutput(content=b"\x89PNG\r\n\x1a\nout", mime="image/png"),
    )
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.persist_provider_output_assets",
        lambda outputs, context, payload, provider: ["asset_generated_1"],
    )

    result = run_geekai_attempt(
        _run_record(model_id="nano-banana-2"),
        _request(
            model_id="nano-banana-2",
            params={"aspectRatio": "16:9", "count": 1, "imageSize": "2K"},
            input_asset_ids=["asset_ref_1"],
        ),
        _route(provider_model="nano-banana-2"),
        _context(),
        api_key="test-key",
        base_url="https://example.test/v1",
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_generated_1"]
    assert captured_request["path"] == "/images/edits"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    assert request_json["aspect_ratio"] == "16:9"
    assert request_json["size"] == "2K"
    assert request_json["model"] == "nano-banana-2"
    expected_base64 = base64.b64encode(b"\x89PNG\r\n\x1a\nmock").decode("ascii")
    assert request_json["image"] == f"data:image/png;base64,{expected_base64}"


def test_run_geekai_attempt_routes_image_analysis_through_responses(monkeypatch):
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
                json={"output_text": "Reverse prompt result."},
                request=httpx.Request("POST", f"https://example.test{path}"),
            )

    monkeypatch.setattr("tangent_api.ai_provider_geekai.httpx.Client", FakeClient)
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.load_provider_input_assets",
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

    result = run_geekai_attempt(
        _run_record(model_id="gpt-5.5", run_type="image_analysis", route_id="route_gpt_5_5_primary"),
        _request(
            model_id="gpt-5.5",
            node_type="analysis",
            run_type="image_analysis",
            input_asset_ids=["asset_ref_1"],
            params={},
        ),
        _route(provider_model="gpt-5.5", route_id="route_gpt_5_5_primary"),
        _context(),
        api_key="test-key",
        base_url="https://example.test/v1",
    )

    assert result.status == "succeeded"
    assert result.text_output == "Reverse prompt result."
    assert captured_request["path"] == "/responses"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    assert request_json["model"] == "gpt-5.5"
    assert request_json["input"][0]["content"][0]["type"] == "input_text"
    assert request_json["input"][0]["content"][1]["type"] == "input_image"


def test_run_geekai_attempt_polls_gpt_image_tasks(monkeypatch):
    calls: list[tuple[str, str, dict[str, object] | None]] = []
    poll_count = {"value": 0}

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
            calls.append(("POST", path, json))
            return httpx.Response(
                200,
                json={"task_id": "task_live_1", "task_status": "pending"},
                request=httpx.Request("POST", f"https://example.test{path}"),
            )

        def get(self, path: str, headers: dict[str, str]):
            calls.append(("GET", path, None))
            poll_count["value"] += 1
            body = {"task_status": "running"}
            if poll_count["value"] >= 2:
                body = {"task_status": "succeed", "data": [{"url": "https://cdn.example.test/out.png"}]}
            return httpx.Response(
                200,
                json=body,
                request=httpx.Request("GET", f"https://example.test{path}"),
            )

    monkeypatch.setattr("tangent_api.ai_provider_geekai.httpx.Client", FakeClient)
    monkeypatch.setattr("tangent_api.ai_provider_geekai.sleep", lambda _seconds: None)
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.download_provider_image",
        lambda url, timeout_seconds, headers=None: ProviderImageOutput(content=b"\x89PNG\r\n\x1a\nout", mime="image/png"),
    )
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.persist_provider_output_assets",
        lambda outputs, context, payload, provider: ["asset_gpt_1"],
    )

    result = run_geekai_attempt(
        _run_record(model_id="gpt-image-2"),
        _request(
            model_id="gpt-image-2",
            params={"aspectRatio": "4:3", "count": 1, "resolution": "2K"},
        ),
        _route(provider_model="gpt-image-2"),
        _context(),
        api_key="test-key",
        base_url="https://example.test/v1",
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_gpt_1"]
    assert calls[0][0] == "POST"
    assert calls[0][1] == "/images/generations"
    first_body = calls[0][2]
    assert isinstance(first_body, dict)
    assert first_body["model"] == "gpt-image-2"
    assert first_body["n"] == 1
    assert first_body["quality"] == "high"
    assert first_body["response_format"] == "url"
    assert first_body["retries"] == 0
    assert first_body["size"] == "1536x1024"
    assert calls[1] == ("GET", "/images/task_live_1", None)
    assert calls[2] == ("GET", "/images/task_live_1", None)


def test_run_geekai_attempt_retries_transient_poll_disconnect(monkeypatch):
    calls: list[tuple[str, str]] = []
    poll_count = {"value": 0}

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
            _ = headers
            _ = json
            calls.append(("POST", path))
            return httpx.Response(
                200,
                json={"task_id": "task_live_retry", "task_status": "pending"},
                request=httpx.Request("POST", f"https://example.test{path}"),
            )

        def get(self, path: str, headers: dict[str, str]):
            _ = headers
            calls.append(("GET", path))
            poll_count["value"] += 1
            if poll_count["value"] == 1:
                raise httpx.RemoteProtocolError("Server disconnected without sending a response.")
            return httpx.Response(
                200,
                json={"task_status": "succeed", "data": [{"url": "https://cdn.example.test/out.png"}]},
                request=httpx.Request("GET", f"https://example.test{path}"),
            )

    monkeypatch.setattr("tangent_api.ai_provider_geekai.httpx.Client", FakeClient)
    monkeypatch.setattr("tangent_api.ai_provider_geekai.sleep", lambda _seconds: None)
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.download_provider_image",
        lambda url, timeout_seconds, headers=None: ProviderImageOutput(content=b"\x89PNG\r\n\x1a\nout", mime="image/png"),
    )
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.persist_provider_output_assets",
        lambda outputs, context, payload, provider: ["asset_retry_1"],
    )

    result = run_geekai_attempt(
        _run_record(model_id="gpt-image-2"),
        _request(
            model_id="gpt-image-2",
            params={"count": 1, "quality": "medium", "size": "1024x1024"},
        ),
        _route(provider_model="gpt-image-2"),
        _context(),
        api_key="test-key",
        base_url="https://example.test/v1",
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_retry_1"]
    assert calls == [
        ("POST", "/images/generations"),
        ("GET", "/images/task_live_retry"),
        ("GET", "/images/task_live_retry"),
    ]


def test_run_geekai_attempt_groups_seedream_outputs(monkeypatch):
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
                json={
                    "task_status": "succeed",
                    "data": [
                        {"url": "https://cdn.example.test/seedream-1.png"},
                        {"url": "https://cdn.example.test/seedream-2.png"},
                    ],
                },
                request=httpx.Request("POST", f"https://example.test{path}"),
            )

    monkeypatch.setattr("tangent_api.ai_provider_geekai.httpx.Client", FakeClient)
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.download_provider_image",
        lambda url, timeout_seconds, headers=None: ProviderImageOutput(content=b"\x89PNG\r\n\x1a\nout", mime="image/png"),
    )
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.persist_provider_output_assets",
        lambda outputs, context, payload, provider: ["asset_seedream_1", "asset_seedream_2"],
    )

    result = run_geekai_attempt(
        _run_record(model_id="doubao-seedream-5.0-lite"),
        _request(
            model_id="doubao-seedream-5.0-lite",
            params={"count": 2, "seedreamOutputFormat": "jpeg", "seedreamSize": "3K"},
        ),
        _route(provider_model="doubao-seedream-5.0-lite"),
        _context(),
        api_key="test-key",
        base_url="https://example.test/v1",
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_seedream_1", "asset_seedream_2"]
    assert captured_request["path"] == "/images/generations"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    assert request_json["model"] == "doubao-seedream-5.0-lite"
    assert request_json["output_format"] == "jpeg"
    assert request_json["size"] == "3K"
    assert request_json["watermark"] is False
    assert request_json["extra_body"]["sequential_image_generation"] == "auto"
    assert request_json["extra_body"]["sequential_image_generation_options"]["max_images"] == 2


def test_run_geekai_attempt_routes_jimeng_with_strength(monkeypatch):
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
                json={"task_status": "succeed", "data": [{"url": "https://cdn.example.test/jimeng.png"}]},
                request=httpx.Request("POST", f"https://example.test{path}"),
            )

    monkeypatch.setattr("tangent_api.ai_provider_geekai.httpx.Client", FakeClient)
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.load_provider_input_assets",
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
        "tangent_api.ai_provider_geekai.download_provider_image",
        lambda url, timeout_seconds, headers=None: ProviderImageOutput(content=b"\x89PNG\r\n\x1a\nout", mime="image/png"),
    )
    monkeypatch.setattr(
        "tangent_api.ai_provider_geekai.persist_provider_output_assets",
        lambda outputs, context, payload, provider: ["asset_jimeng_1"],
    )

    result = run_geekai_attempt(
        _run_record(model_id="jimeng_t2i_v40"),
        _request(
            model_id="jimeng_t2i_v40",
            params={"count": 1, "jimengSize": "2304x1728", "jimengStrength": "0.7"},
            input_asset_ids=["asset_ref_1"],
        ),
        _route(provider_model="jimeng_t2i_v40"),
        _context(),
        api_key="test-key",
        base_url="https://example.test/v1",
    )

    assert result.status == "succeeded"
    assert result.output_asset_ids == ["asset_jimeng_1"]
    assert captured_request["path"] == "/images/generations"
    request_json = captured_request["json"]
    assert isinstance(request_json, dict)
    assert request_json["model"] == "jimeng_t2i_v40"
    assert request_json["size"] == "2304x1728"
    assert request_json["strength"] == 0.7
    assert "image" in request_json


def _route(provider_model: str, route_id: Optional[str] = None) -> AiProviderRouteCandidate:
    return AiProviderRouteCandidate(
        health_status="healthy",
        priority=10,
        provider_key="geekai",
        provider_model=provider_model,
        retry_policy={"maxAttempts": 2},
        route_id=route_id or f"route_{provider_model.replace('.', '_')}",
        route_key="geekai-primary",
        timeout_ms=60_000,
        weight=100,
    )


def _request(
    *,
    model_id: str,
    params: dict[str, object],
    input_asset_ids: Optional[list[str]] = None,
    node_type: str = "image_gen",
    run_type: str = "image_generation",
) -> AiRunRequest:
    return AiRunRequest(
        boardId=None,
        inputAssetIds=input_asset_ids or [],
        nodeId=None,
        nodeType=node_type,
        params=params,
        prompt="Sunset forest",
        runType=run_type,
        selectedModelId=model_id,
        systemPrompt=None,
    )


def _run_record(*, model_id: str, route_id: str = "route_test", run_type: str = "image_generation") -> AiRunRecord:
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


def _context() -> ApiRequestContext:
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
