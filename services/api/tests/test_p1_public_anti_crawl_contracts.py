import base64

from fastapi.testclient import TestClient

from tangent_api.main import app
from tangent_api.security_events import list_recent_security_events, reset_security_events
from tangent_api.security_rate_limit import reset_http_rate_limit_state

PNG_BYTES = b"\x89PNG\r\n\x1a\n"


def test_asset_file_download_headers_and_private_cache(tmp_path, monkeypatch):
    reset_http_rate_limit_state()
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DIR", str(tmp_path / "assets"))
    monkeypatch.setenv("TANGENT_ASSET_STORAGE_DRIVER", "local-dev")
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    client = TestClient(app)

    create_response = client.post(
        "/api/v1/assets/from-data-url",
        json={
            "dataUrl": f"data:image/png;base64,{base64.b64encode(PNG_BYTES).decode('ascii')}",
            "height": 1,
            "origin": "upload",
            "title": "Header Probe",
            "width": 1,
        },
    )
    asset = create_response.json()["asset"]

    response = client.get(asset["originalUrl"])

    assert response.status_code == 200
    assert response.headers["cache-control"] == "private, max-age=3600"
    assert response.headers["cross-origin-resource-policy"] == "same-site"
    assert response.headers["x-robots-tag"] == "noindex, nofollow"
    assert response.headers["x-content-type-options"] == "nosniff"


def test_asset_file_download_uses_dedicated_rate_limit(monkeypatch):
    reset_http_rate_limit_state()
    reset_security_events()
    monkeypatch.setenv("TANGENT_SECURITY_REDIS_ENABLED", "0")
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "1")
    monkeypatch.setenv("TANGENT_ASSET_FILE_RATE_LIMIT_PER_MINUTE", "1")
    client = TestClient(app)
    headers = {"x-tangent-user-id": "asset_reader", "x-tangent-workspace-id": "workspace_assets"}

    first = client.get("/api/v1/assets/files/missing_one/original.png", headers=headers)
    second = client.get("/api/v1/assets/files/missing_two/original.png", headers=headers)

    assert first.status_code == 404
    assert second.status_code == 429
    last_event = list_recent_security_events()[-1]
    assert last_event["reason"] == "http_rate_limit_exceeded"
    assert last_event["metadata"]["routeClass"] == "asset_file"
    reset_http_rate_limit_state()


def test_public_share_routes_return_anti_crawl_headers(monkeypatch):
    reset_http_rate_limit_state()
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    client = TestClient(app)

    resolve_response = client.get("/api/v1/boards/share-links/missing_share")
    load_response = client.get("/api/v1/boards/share-links/missing_share/board")

    for response in (resolve_response, load_response):
        assert response.status_code == 404
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["cross-origin-resource-policy"] == "same-origin"
        assert response.headers["x-robots-tag"] == "noindex, nofollow"
