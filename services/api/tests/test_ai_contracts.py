from fastapi.testclient import TestClient

from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext


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
    assert run["costCredits"] == 0
    assert run["modelId"] == "gpt-image-2"
    assert len(run["outputAssetIds"]) == 4
    assert run["status"] == "succeeded"

    loaded = client.get(f"/api/v1/ai/runs/{run['runId']}")
    assert loaded.status_code == 200
    assert loaded.json()["run"]["runId"] == run["runId"]


def test_ai_run_auth_required_mode(monkeypatch):
    monkeypatch.setenv("TANGENT_REQUIRE_API_AUTH", "1")

    async def fake_resolve_authenticated_request_context(token: str) -> ApiRequestContext:
        assert token == "valid-token"
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
