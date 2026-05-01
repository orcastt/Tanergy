from fastapi.testclient import TestClient

from tangent_api.main import app


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
    client = TestClient(app)

    missing = client.get("/api/v1/ai/models?capability=image_generation")
    assert missing.status_code == 401

    explicit = client.get(
        "/api/v1/ai/models?capability=image_generation",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "dev-workspace"},
    )
    assert explicit.status_code == 200
