from io import BytesIO

from fastapi.testclient import TestClient

from tangent_api.main import app


class FakeS3NotFound(Exception):
    response = {
        "Error": {"Code": "NoSuchKey"},
        "ResponseMetadata": {"HTTPStatusCode": 404},
    }


class FakeS3Client:
    def __init__(self):
        self.objects = {}

    def put_object(self, Body, Bucket, ContentType, Key):
        self.objects[(Bucket, Key)] = {"Body": Body, "ContentType": ContentType}

    def get_object(self, Bucket, Key):
        stored = self.objects.get((Bucket, Key))
        if not stored:
            raise FakeS3NotFound()
        return {"Body": BytesIO(stored["Body"]), "ContentType": stored["ContentType"]}


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


def test_asset_s3_compatible_driver_requires_config(monkeypatch):
    for name in (
        "S3_ENDPOINT",
        "S3_BUCKET",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
    ):
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DRIVER", "s3-compatible")
    client = TestClient(app)

    response = client.post(
        "/api/v1/assets/from-data-url",
        json={"dataUrl": "data:image/png;base64,AAAA", "height": 1, "origin": "upload", "width": 1},
    )

    assert response.status_code == 501
    assert "S3-compatible asset storage is not configured" in response.json()["detail"]
    assert "S3_ENDPOINT" in response.json()["detail"]


def test_asset_s3_compatible_contract(monkeypatch):
    fake_s3 = FakeS3Client()
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DRIVER", "s3-compatible")
    monkeypatch.setenv("S3_ENDPOINT", "https://r2.example.test")
    monkeypatch.setenv("S3_BUCKET", "tangent-assets")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "test-access-key")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "test-secret-key")
    monkeypatch.setattr(
        "tangent_api.storage.s3_asset_store.create_s3_client",
        lambda config: fake_s3,
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/assets/from-data-url",
        json={
            "dataUrl": "data:image/png;base64,AAAA",
            "fileName": "smoke.png",
            "height": 1,
            "origin": "upload",
            "thumbnails": {
                "256": {"dataUrl": "data:image/png;base64,BBBB", "height": 1, "width": 1}
            },
            "title": "S3 smoke asset",
            "width": 1,
        },
    )

    assert response.status_code == 200
    asset = response.json()["asset"]
    assert asset["createdBy"] == "dev-user"
    assert asset["workspaceId"] == "dev-workspace"
    assert asset["originalUrl"].endswith("/original.png")
    assert asset["storage"] == "s3-compatible"
    assert asset["thumbnail256Url"].endswith("/thumb-256.png")

    metadata_key = f"workspaces/dev-workspace/assets/{asset['id']}/metadata.json"
    original_key = f"workspaces/dev-workspace/assets/{asset['id']}/original.png"
    assert ("tangent-assets", metadata_key) in fake_s3.objects
    assert ("tangent-assets", original_key) in fake_s3.objects

    metadata = client.get(f"/api/v1/assets/{asset['id']}")
    assert metadata.status_code == 200
    assert metadata.json()["asset"]["id"] == asset["id"]

    file_response = client.get(asset["originalUrl"])
    assert file_response.status_code == 200
    assert file_response.content == b"\x00\x00\x00"
    assert file_response.headers["content-type"].startswith("image/png")

    missing_file = client.get(f"/api/v1/assets/files/{asset['id']}/missing.png")
    assert missing_file.status_code == 404

    cross_workspace = client.get(
        f"/api/v1/assets/{asset['id']}",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "other-workspace"},
    )
    assert cross_workspace.status_code == 404


def test_asset_unknown_driver_fails(monkeypatch):
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DRIVER", "unknown-driver")
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
