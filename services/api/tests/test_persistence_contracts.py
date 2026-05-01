from fastapi.testclient import TestClient

from tangent_api.main import app


def test_asset_local_dev_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DIR", str(tmp_path / "assets"))
    client = TestClient(app)

    response = client.post(
        "/api/v1/assets/from-data-url",
        json={
            "dataUrl": "data:image/png;base64,AAAA",
            "fileName": "smoke.png",
            "height": 1,
            "origin": "upload",
            "thumbnails": {
                "256": {"dataUrl": "data:image/png;base64,AAAA", "height": 1, "width": 1}
            },
            "title": "Smoke asset",
            "width": 1,
        },
    )

    assert response.status_code == 200
    asset = response.json()["asset"]
    assert asset["createdBy"] == "dev-user"
    assert asset["workspaceId"] == "dev-workspace"
    assert asset["thumbnail256Url"]

    metadata = client.get(f"/api/v1/assets/{asset['id']}")
    assert metadata.status_code == 200
    assert metadata.json()["asset"]["id"] == asset["id"]

    file_response = client.get(asset["originalUrl"])
    assert file_response.status_code == 200
    assert file_response.headers["content-type"].startswith("image/png")

    cross_workspace = client.get(
        f"/api/v1/assets/{asset['id']}",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "other-workspace"},
    )
    assert cross_workspace.status_code == 404


def test_asset_upload_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DIR", str(tmp_path / "assets"))
    client = TestClient(app)

    response = client.post(
        "/api/v1/assets/upload",
        data={"height": "1", "origin": "upload", "title": "Upload smoke", "width": "1"},
        files={"file": ("smoke.png", b"\x00\x00\x00", "image/png")},
    )

    assert response.status_code == 200
    asset = response.json()["asset"]
    assert asset["createdBy"] == "dev-user"
    assert asset["workspaceId"] == "dev-workspace"
    assert asset["originalUrl"].endswith("/original.png")


def test_asset_unsupported_driver_fails(monkeypatch):
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DRIVER", "s3-compatible")
    client = TestClient(app)

    response = client.post(
        "/api/v1/assets/from-data-url",
        json={"dataUrl": "data:image/png;base64,AAAA", "height": 1, "origin": "upload", "width": 1},
    )

    assert response.status_code == 501
    assert "Unsupported asset storage driver" in response.json()["detail"]


def test_board_local_dev_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={"boardId": "api-smoke-board", "document": {"shapes": []}, "title": "API Smoke Board"},
    )

    assert save_response.status_code == 200
    saved = save_response.json()["board"]
    assert saved["workspaceId"] == "dev-workspace"
    assert "document" not in saved

    load_response = client.get("/api/v1/boards/api-smoke-board")
    assert load_response.status_code == 200
    loaded = load_response.json()["board"]
    assert loaded["document"] == {"shapes": []}
    assert loaded["workspaceId"] == "dev-workspace"

    blocked = client.get(
        "/api/v1/boards/api-smoke-board",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "other-workspace"},
    )
    assert blocked.status_code == 404


def test_board_guard_blocks_runtime_urls():
    client = TestClient(app)

    response = client.post(
        "/api/v1/boards/validate-document",
        json={"document": {"asset": "data:image/png;base64,AAAA"}},
    )

    assert response.status_code == 422
    assert response.json()["audit"]["issues"][0]["code"] == "runtime-url"
