from typing import List, Optional

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext, ApiWorkspaceContext
from tangent_api.remote_image_import import RemoteImageImport
from tangent_api.storage.asset_storage_adapter import get_asset_storage_adapter
from tangent_api.storage import asset_store_common
from tests.persistence_fakes import FakePostgresDatabase, FakeS3Client


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


def test_asset_data_url_rejects_unsupported_mime_before_decode():
    with pytest.raises(HTTPException) as exc:
        asset_store_common.parse_image_data_url("data:text/html;base64,AAAA")

    assert getattr(exc.value, "status_code", None) == 400
    assert "Unsupported image MIME type" in str(getattr(exc.value, "detail", ""))


def test_asset_data_url_rejects_estimated_oversize_payload(monkeypatch):
    monkeypatch.setattr(asset_store_common, "MAX_ASSET_BYTES", 2)

    with pytest.raises(HTTPException) as exc:
        asset_store_common.parse_image_data_url("data:image/png;base64,AAAA")

    assert getattr(exc.value, "status_code", None) == 400
    assert "100MB or smaller" in str(getattr(exc.value, "detail", ""))


def test_asset_from_url_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DIR", str(tmp_path / "assets"))
    monkeypatch.setattr(
        "tangent_api.routers.assets.fetch_remote_image",
        lambda url: RemoteImageImport(
            content=b"\x00\x00\x00",
            file_name="remote.png",
            height=4,
            mime="image/png",
            width=6,
        ),
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/assets/from-url",
        json={"origin": "remote_import", "title": "Remote import", "url": "https://example.com/image.png"},
    )

    assert response.status_code == 200
    asset = response.json()["asset"]
    assert asset["origin"] == "remote_import"
    assert asset["title"] == "Remote import"
    assert asset["width"] == 6
    assert asset["height"] == 4


def test_remove_background_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DIR", str(tmp_path / "assets"))
    monkeypatch.setattr("tangent_api.image_ops._run_rembg", lambda content: content)
    client = TestClient(app)

    upload = client.post(
        "/api/v1/assets/upload",
        data={"height": "8", "origin": "upload", "title": "Source image", "width": "8"},
        files={"file": ("source.png", b"\x00\x00\x00", "image/png")},
    )
    asset_id = upload.json()["asset"]["id"]

    response = client.post("/api/v1/image-ops/remove-background", json={"assetId": asset_id})

    assert response.status_code == 200
    asset = response.json()["asset"]
    assert asset["origin"] == "background_removal"
    assert asset["mime"] == "image/png"
    assert asset["id"] != asset_id


def test_remove_background_rejects_large_pixel_budget(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DIR", str(tmp_path / "assets"))
    monkeypatch.setattr("tangent_api.image_ops._run_rembg", lambda content: content)
    client = TestClient(app)

    upload = client.post(
        "/api/v1/assets/upload",
        data={"height": "5000", "origin": "upload", "title": "Huge source", "width": "6000"},
        files={"file": ("source.png", b"\x00\x00\x00", "image/png")},
    )
    asset_id = upload.json()["asset"]["id"]

    response = client.post("/api/v1/image-ops/remove-background", json={"assetId": asset_id})

    assert response.status_code == 413
    assert response.json()["detail"] == "Image operation input must be 24MP or smaller."


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


def test_asset_s3_postgres_metadata_resolves_files_across_workspace_membership(monkeypatch):
    fake_s3 = FakeS3Client()
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DRIVER", "s3-compatible")
    monkeypatch.setenv("TANGENT_ASSET_METADATA_DRIVER", "postgres")
    monkeypatch.setenv("S3_ENDPOINT", "https://r2.example.test")
    monkeypatch.setenv("S3_BUCKET", "tangent-assets")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "test-access-key")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "test-secret-key")
    monkeypatch.setattr(
        "tangent_api.storage.s3_asset_store.create_s3_client",
        lambda config: fake_s3,
    )
    monkeypatch.setattr(
        "tangent_api.storage.postgres_asset_metadata_store.connect_to_postgres",
        fake_db.connect,
    )
    adapter = get_asset_storage_adapter()

    owner_context = make_asset_context("user_owner", "workspace_team")
    asset = adapter.create_from_bytes(
        b"\x89PNG\r\n\x1a\n",
        "image/png",
        owner_context,
        "upload",
        "Cross workspace asset",
        1,
        1,
    )

    reader_context = make_asset_context(
        "user_owner",
        "workspace_personal",
        memberships=["workspace_personal", "workspace_team"],
    )
    content = adapter.get_file_bytes(asset.id, "original.png", reader_context)
    assert content == b"\x89PNG\r\n\x1a\n"


def make_asset_context(
    user_id: str,
    workspace_id: str,
    memberships: Optional[List[str]] = None,
) -> ApiRequestContext:
    membership_ids = memberships or [workspace_id]
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email=f"{user_id}@example.com",
        user_email_verified=True,
        user_id=user_id,
        workspace_board_count=0,
        workspace_id=workspace_id,
        workspace_kind="solo_workspace",
        workspace_memberships=[
            ApiWorkspaceContext(
                board_count=0,
                workspace_id=item,
                workspace_kind="solo_workspace",
                workspace_name=item,
                workspace_plan_key="free_canvas",
                workspace_role="owner",
            )
            for item in membership_ids
        ],
        workspace_name=workspace_id,
        workspace_plan_key="free_canvas",
        workspace_role="owner",
    )
    assert file_response.headers["content-type"].startswith("image/png")

    missing_file = client.get(f"/api/v1/assets/files/{asset['id']}/missing.png")
    assert missing_file.status_code == 404

    cross_workspace = client.get(
        f"/api/v1/assets/{asset['id']}",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "other-workspace"},
    )
    assert cross_workspace.status_code == 404


def test_asset_s3_compatible_postgres_metadata_contract(monkeypatch):
    fake_s3 = FakeS3Client()
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DRIVER", "s3-compatible")
    monkeypatch.setenv("TANGENT_ASSET_METADATA_DRIVER", "postgres")
    monkeypatch.setenv("S3_ENDPOINT", "https://r2.example.test")
    monkeypatch.setenv("S3_BUCKET", "tangent-assets")
    monkeypatch.setenv("S3_ACCESS_KEY_ID", "test-access-key")
    monkeypatch.setenv("S3_SECRET_ACCESS_KEY", "test-secret-key")
    monkeypatch.setattr(
        "tangent_api.storage.s3_asset_store.create_s3_client",
        lambda config: fake_s3,
    )
    monkeypatch.setattr(
        "tangent_api.storage.postgres_asset_metadata_store.connect_to_postgres",
        fake_db.connect,
    )
    client = TestClient(app)

    response = client.post(
        "/api/v1/assets/from-data-url",
        json={
            "dataUrl": "data:image/png;base64,AAAA",
            "fileName": "smoke.png",
            "height": 1,
            "origin": "upload",
            "title": "S3 Postgres asset",
            "width": 1,
        },
    )

    assert response.status_code == 200
    asset = response.json()["asset"]
    metadata_key = f"workspaces/dev-workspace/assets/{asset['id']}/metadata.json"
    original_key = f"workspaces/dev-workspace/assets/{asset['id']}/original.png"
    assert ("tangent-assets", original_key) in fake_s3.objects
    assert ("tangent-assets", metadata_key) not in fake_s3.objects
    assert ("dev-workspace", asset["id"]) in fake_db.assets

    metadata = client.get(f"/api/v1/assets/{asset['id']}")
    assert metadata.status_code == 200
    assert metadata.json()["asset"]["title"] == "S3 Postgres asset"

    file_response = client.get(asset["originalUrl"])
    assert file_response.status_code == 200
    assert file_response.content == b"\x00\x00\x00"

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


def test_fastapi_cors_allows_local_web_origin():
    client = TestClient(app)

    response = client.options(
        "/api/v1/assets/from-data-url",
        headers={
            "Access-Control-Request-Method": "POST",
            "Origin": "http://localhost:3000",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:3000"
