import logging
from types import SimpleNamespace

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from tangent_api.error_tracking import _scrub_sentry_event, configure_error_tracking
import tangent_api.security_business_limits as business_limits
import tangent_api.security_rate_limit as rate_limits
from tangent_api.ops_observability import observe_http_response
from tangent_api.main import app
from tangent_api.security_business_limits import reset_business_limit_state
from tangent_api.security_events import list_recent_security_events, reset_security_events
from tangent_api.security_idempotency import reset_idempotency_state
from tangent_api.security_rate_limit import reset_http_rate_limit_state
from tangent_api.security_redis import RedisCounterResult


def test_api_responses_include_security_headers(monkeypatch):
    reset_http_rate_limit_state()
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    client = TestClient(app)

    response = client.get("/api/v1/boards")

    assert response.status_code == 200
    assert response.headers["x-content-type-options"] == "nosniff"
    assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["cache-control"] == "no-store"
    assert "frame-ancestors 'none'" in response.headers["content-security-policy"]


def test_api_observability_logs_slow_response_without_query_string(monkeypatch, caplog):
    monkeypatch.setenv("TANGENT_API_SLOW_RESPONSE_MS", "10")
    request = SimpleNamespace(method="GET", url=SimpleNamespace(path="/api/v1/boards"))
    response = SimpleNamespace(status_code=200)

    with caplog.at_level(logging.WARNING, logger="tangent_api.ops_observability"):
        observe_http_response(request, response, 25.0)

    assert "Slow API response" in caplog.text
    assert "/api/v1/boards" in caplog.text
    assert "?" not in caplog.text


def test_error_tracking_stays_disabled_without_dsn(monkeypatch):
    monkeypatch.delenv("SENTRY_DSN", raising=False)
    monkeypatch.delenv("TANGENT_ERROR_TRACKING_DSN", raising=False)

    assert configure_error_tracking() is False


def test_error_tracking_scrubber_removes_sensitive_request_data():
    event = {
        "request": {
            "cookies": "secret-cookie",
            "headers": {
                "Authorization": "Bearer secret",
                "Cookie": "session=secret",
                "Origin": "https://staging.tanergy.cc",
                "x-tangent-share-password": "secret",
            },
            "query_string": "token=secret",
            "url": "https://api.example.com/api/v1/boards?token=secret",
        },
        "user": {"email": "user@example.com", "id": "user_123"},
    }

    scrubbed = _scrub_sentry_event(event, {})

    assert "cookies" not in scrubbed["request"]
    assert "query_string" not in scrubbed["request"]
    assert "Authorization" not in scrubbed["request"]["headers"]
    assert "Cookie" not in scrubbed["request"]["headers"]
    assert "x-tangent-share-password" not in scrubbed["request"]["headers"]
    assert scrubbed["user"] == {"id": "user_123"}


def test_http_rate_limit_returns_429(monkeypatch):
    reset_http_rate_limit_state()
    reset_security_events()
    monkeypatch.setenv("TANGENT_SECURITY_REDIS_ENABLED", "0")
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "1")
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_PER_MINUTE", "1")
    client = TestClient(app)
    headers = {"x-tangent-user-id": "rate_user", "x-tangent-workspace-id": "rate_workspace"}

    assert client.get("/api/v1/boards", headers=headers).status_code == 200
    limited_response = client.get("/api/v1/boards", headers=headers)

    assert limited_response.status_code == 429
    assert limited_response.json()["detail"] == "Too many requests. Please wait and try again."
    assert limited_response.headers["retry-after"]
    assert list_recent_security_events()[-1]["reason"] == "http_rate_limit_exceeded"
    reset_http_rate_limit_state()


def test_http_rate_limit_can_use_redis_counter(monkeypatch):
    reset_http_rate_limit_state()
    reset_security_events()
    calls = []
    def fake_increment_security_counter(*, scope: str, raw_key: str, ttl_seconds: int):
        calls.append({"rawKey": raw_key, "scope": scope, "ttlSeconds": ttl_seconds})
        return RedisCounterResult(count=len(calls), ttl_seconds=37)

    monkeypatch.setattr(rate_limits, "increment_security_counter", fake_increment_security_counter)
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "1")
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_PER_MINUTE", "1")
    client = TestClient(app)
    headers = {"x-tangent-user-id": "redis_rate_user", "x-tangent-workspace-id": "redis_rate_workspace"}

    assert client.get("/api/v1/boards", headers=headers).status_code == 200
    limited_response = client.get("/api/v1/boards", headers=headers)

    assert limited_response.status_code == 429
    assert limited_response.headers["retry-after"] == "37"
    assert calls[0]["scope"] == "http_rate_limit"
    assert calls[0]["ttlSeconds"] == 60
    assert list_recent_security_events()[-1]["reason"] == "http_rate_limit_exceeded"
    reset_http_rate_limit_state()


def test_public_share_routes_rate_limit_across_scanned_tokens(monkeypatch):
    reset_http_rate_limit_state()
    reset_security_events()
    monkeypatch.setenv("TANGENT_SECURITY_REDIS_ENABLED", "0")
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "1")
    monkeypatch.setenv("TANGENT_PUBLIC_RATE_LIMIT_PER_MINUTE", "1")
    client = TestClient(app)

    first = client.get("/api/v1/boards/share-links/missing_one")
    second = client.get("/api/v1/boards/share-links/missing_two")

    assert first.status_code == 404
    assert second.status_code == 429
    last_event = list_recent_security_events()[-1]
    assert last_event["reason"] == "http_rate_limit_exceeded"
    assert last_event["metadata"]["routeClass"] == "public"
    reset_http_rate_limit_state()


def test_cookie_session_write_rejects_disallowed_origin(monkeypatch):
    reset_http_rate_limit_state()
    reset_security_events()
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    monkeypatch.setenv("TANGENT_ALLOWED_ORIGINS", "https://app.example.com")
    client = TestClient(app)
    client.cookies.set("__session", "fake-session")

    response = client.post(
        "/api/v1/boards",
        headers={"origin": "https://evil.example"},
        json={"boardId": "csrf_board", "document": {"assets": [], "shapes": []}, "title": "CSRF Board"},
    )

    assert response.status_code == 403
    assert response.json()["detail"] == "Request origin is not allowed."
    assert list_recent_security_events()[-1]["reason"] == "csrf_origin_not_allowed"


def test_bearer_write_skips_cookie_csrf_origin_check(monkeypatch):
    reset_http_rate_limit_state()
    reset_security_events()
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    monkeypatch.setenv("TANGENT_ALLOWED_ORIGINS", "https://app.example.com")
    client = TestClient(app)

    response = client.post(
        "/api/v1/boards",
        headers={"authorization": "Bearer fake-token", "origin": "https://evil.example"},
        json={"boardId": "bearer_csrf_board", "document": {"assets": [], "shapes": []}, "title": "Bearer Board"},
    )

    assert response.status_code != 403
    assert not list_recent_security_events()


def test_staging_requires_websocket_origin_by_default(monkeypatch):
    monkeypatch.delenv("TANGENT_REQUIRE_WEBSOCKET_ORIGIN", raising=False)
    monkeypatch.setenv("APP_ENV", "staging")
    from tangent_api.security_origin import should_require_websocket_origin

    assert should_require_websocket_origin() is True


def test_board_realtime_websocket_rejects_disallowed_origin(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    monkeypatch.setenv("TANGENT_REQUIRE_WEBSOCKET_ORIGIN", "1")
    monkeypatch.setenv("TANGENT_ALLOWED_WEBSOCKET_ORIGINS", "https://app.example.com")
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={"boardId": "realtime_origin_board", "document": {"assets": [], "shapes": []}, "title": "Origin Board"},
    )
    assert save_response.status_code == 200
    room_key = client.get("/api/v1/boards/realtime_origin_board/collaboration").json()["roomKey"]

    with _expect_websocket_disconnect(4403):
        with client.websocket_connect(
            _realtime_url("realtime_origin_board", "tab_bad_origin", room_key),
            headers={"origin": "https://evil.example"},
        ):
            pass


def test_board_realtime_websocket_rate_limits_messages(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    monkeypatch.setenv("TANGENT_REALTIME_MESSAGES_PER_WINDOW", "1")
    monkeypatch.setenv("TANGENT_REALTIME_MESSAGE_RATE_WINDOW_SECONDS", "60")
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={"boardId": "realtime_rate_board", "document": {"assets": [], "shapes": []}, "title": "Rate Board"},
    )
    assert save_response.status_code == 200
    room_key = client.get("/api/v1/boards/realtime_rate_board/collaboration").json()["roomKey"]

    with client.websocket_connect(_realtime_url("realtime_rate_board", "tab_rate", room_key)) as websocket:
        assert websocket.receive_json()["type"] == "sync-state"
        assert websocket.receive_json()["type"] == "awareness-batch"
        websocket.send_json({"type": "awareness-remove"})
        websocket.send_json({"type": "awareness-remove"})
        with _expect_websocket_disconnect(4408):
            websocket.receive_json()


def test_ai_run_idempotency_replays_without_consuming_daily_quota(monkeypatch):
    reset_business_limit_state()
    reset_idempotency_state()
    reset_security_events()
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    monkeypatch.setenv("TANGENT_SECURITY_REDIS_ENABLED", "0")
    monkeypatch.setenv("TANGENT_AI_RUN_DAILY_LIMIT", "1")
    client = TestClient(app)
    payload = {
        "boardId": "board_security_idempotency",
        "inputAssetIds": ["asset_ref_1"],
        "nodeId": "node_image_gen",
        "nodeType": "image_gen_4",
        "params": {"count": 1, "resolution": "1K"},
        "prompt": "A quiet test image",
        "runType": "image_generation",
        "selectedModelId": "gpt-image-2",
    }
    headers = {"Idempotency-Key": "security-idem-1", "x-tangent-user-id": "idem-user"}

    first = client.post("/api/v1/ai/runs", json=payload, headers=headers)
    second = client.post("/api/v1/ai/runs", json=payload, headers=headers)
    third = client.post("/api/v1/ai/runs", json={**payload, "prompt": "Another image"}, headers={"x-tangent-user-id": "idem-user"})

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["run"]["runId"] == second.json()["run"]["runId"]
    assert third.status_code == 429
    assert list_recent_security_events()[-1]["reason"] == "daily_business_quota_exceeded"


def test_daily_business_quota_can_use_redis_counter(monkeypatch):
    reset_business_limit_state()
    reset_idempotency_state()
    reset_security_events()
    calls = []
    def fake_increment_security_counter(*, scope: str, raw_key: str, ttl_seconds: int):
        calls.append({"rawKey": raw_key, "scope": scope, "ttlSeconds": ttl_seconds})
        return RedisCounterResult(count=len(calls), ttl_seconds=3600)

    monkeypatch.setattr(business_limits, "increment_security_counter", fake_increment_security_counter)
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    monkeypatch.setenv("TANGENT_AI_RUN_DAILY_LIMIT", "1")
    client = TestClient(app)
    payload = {
        "boardId": "board_security_redis_quota",
        "inputAssetIds": ["asset_ref_1"],
        "nodeId": "node_image_gen",
        "nodeType": "image_gen_4",
        "params": {"count": 1, "resolution": "1K"},
        "prompt": "A quiet Redis quota test image",
        "runType": "image_generation",
        "selectedModelId": "gpt-image-2",
    }
    headers = {"x-tangent-user-id": "redis-quota-user", "x-tangent-workspace-id": "redis-quota-workspace"}
    first = client.post("/api/v1/ai/runs", json=payload, headers=headers)
    second = client.post("/api/v1/ai/runs", json={**payload, "prompt": "Another Redis quota image"}, headers=headers)

    assert first.status_code == 200
    assert second.status_code == 429
    assert calls[0]["scope"] == "business_daily_quota"
    assert calls[0]["ttlSeconds"] >= 3600
    assert list_recent_security_events()[-1]["reason"] == "daily_business_quota_exceeded"


def test_idempotency_key_conflict_is_rejected(monkeypatch):
    reset_business_limit_state()
    reset_idempotency_state()
    reset_security_events()
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    monkeypatch.setenv("TANGENT_SECURITY_REDIS_ENABLED", "0")
    client = TestClient(app)
    payload = {
        "boardId": "board_security_conflict",
        "inputAssetIds": ["asset_ref_1"],
        "nodeId": "node_image_gen",
        "nodeType": "image_gen_4",
        "params": {"count": 1, "resolution": "1K"},
        "prompt": "First image",
        "runType": "image_generation",
        "selectedModelId": "gpt-image-2",
    }
    headers = {"Idempotency-Key": "security-idem-conflict", "x-tangent-user-id": "conflict-user"}

    assert client.post("/api/v1/ai/runs", json=payload, headers=headers).status_code == 200
    conflict = client.post("/api/v1/ai/runs", json={**payload, "prompt": "Changed image"}, headers=headers)

    assert conflict.status_code == 409
    assert conflict.json()["detail"] == "Idempotency key was already used with a different request."
    assert list_recent_security_events()[-1]["reason"] == "idempotency_key_reused_with_different_payload"


def test_missing_public_share_access_records_hashed_event(monkeypatch):
    reset_http_rate_limit_state()
    reset_security_events()
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    client = TestClient(app)

    response = client.get("/api/v1/boards/share-links/missing_share_event")

    assert response.status_code == 404
    event = list_recent_security_events()[-1]
    assert event["action"] == "board_share.resolve"
    assert event["decision"] == "deny"
    assert event["reason"] == "share_link_404"
    assert event["resourceType"] == "board_share_link"
    assert event["resourceId"]
    assert "missing_share_event" not in str(event["metadata"])


class _expect_websocket_disconnect:
    def __init__(self, code: int) -> None:
        self.code = code

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback) -> bool:
        assert exc_type is WebSocketDisconnect
        assert exc.code == self.code
        return True


def _realtime_url(board_id: str, client_instance_id: str, room_key: str) -> str:
    return (
        f"/api/v1/boards/{board_id}/realtime?clientInstanceId={client_instance_id}&roomKey={room_key}"
        "&userId=dev-user&workspaceId=dev-workspace&workspaceKind=solo_workspace&workspaceName=Personal%20workspace&workspaceRole=owner"
    )
