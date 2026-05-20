from urllib.parse import urlencode

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

import tangent_api.realtime.board_realtime_abuse as realtime_abuse
from tangent_api.main import app
from tangent_api.security_events import list_recent_security_events, reset_security_events
from tangent_api.security_redis import RedisCounterResult


def test_board_realtime_websocket_uses_redis_room_connection_counter(tmp_path, monkeypatch):
    _configure_local_board_storage(tmp_path, monkeypatch)
    monkeypatch.setenv("TANGENT_SECURITY_REDIS_ENABLED", "1")
    monkeypatch.setenv("TANGENT_REALTIME_ROOM_CONNECTION_LIMIT", "1")
    reset_security_events()
    calls = []

    def fake_increment_security_counter(*, scope: str, raw_key: str, ttl_seconds: int):
        calls.append({"rawKey": raw_key, "scope": scope, "ttlSeconds": ttl_seconds})
        return RedisCounterResult(count=2, ttl_seconds=ttl_seconds)

    monkeypatch.setattr(
        realtime_abuse,
        "increment_security_counter",
        fake_increment_security_counter,
    )
    client = TestClient(app)
    room_key = _create_board_and_room_key(client, "realtime_redis_connection_board")

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(
            _realtime_url("realtime_redis_connection_board", "tab_one", room_key)
        ):
            pass

    assert excinfo.value.code == 4408
    assert calls[0]["scope"] == "realtime_room_connection_rate"
    assert calls[0]["ttlSeconds"] == 10
    assert list_recent_security_events()[-1]["reason"] == "websocket_room_connection_limit_exceeded"


def test_board_realtime_websocket_uses_redis_message_counter(tmp_path, monkeypatch):
    _configure_local_board_storage(tmp_path, monkeypatch)
    monkeypatch.setenv("TANGENT_SECURITY_REDIS_ENABLED", "1")
    monkeypatch.setenv("TANGENT_REALTIME_MESSAGES_PER_WINDOW", "1")
    monkeypatch.setenv("TANGENT_REALTIME_MESSAGE_RATE_WINDOW_SECONDS", "60")
    reset_security_events()
    message_calls = []

    def fake_increment_security_counter(*, scope: str, raw_key: str, ttl_seconds: int):
        if scope == "realtime_room_connection_rate":
            return RedisCounterResult(count=1, ttl_seconds=ttl_seconds)
        message_calls.append({"rawKey": raw_key, "scope": scope, "ttlSeconds": ttl_seconds})
        return RedisCounterResult(count=len(message_calls), ttl_seconds=ttl_seconds)

    monkeypatch.setattr(
        realtime_abuse,
        "increment_security_counter",
        fake_increment_security_counter,
    )
    client = TestClient(app)
    room_key = _create_board_and_room_key(client, "realtime_redis_message_board")

    with client.websocket_connect(
        _realtime_url("realtime_redis_message_board", "tab_one", room_key)
    ) as websocket:
        assert websocket.receive_json()["type"] == "sync-state"
        assert websocket.receive_json()["type"] == "awareness-batch"
        websocket.send_json({"type": "awareness-remove"})
        websocket.send_json({"type": "awareness-remove"})
        with pytest.raises(WebSocketDisconnect) as excinfo:
            websocket.receive_json()

    assert excinfo.value.code == 4408
    assert message_calls[0]["scope"] == "realtime_message_rate"
    assert message_calls[0]["ttlSeconds"] == 60
    assert list_recent_security_events()[-1]["reason"] == "websocket_message_rate_exceeded"


def test_realtime_message_limiter_falls_back_to_memory_when_redis_unavailable(monkeypatch):
    monkeypatch.setenv("TANGENT_REALTIME_MESSAGES_PER_WINDOW", "1")
    monkeypatch.setenv("TANGENT_REALTIME_MESSAGE_RATE_WINDOW_SECONDS", "60")
    monkeypatch.setenv("TANGENT_SECURITY_REDIS_ENABLED", "1")
    monkeypatch.setattr(realtime_abuse, "increment_security_counter", lambda **_kwargs: None)
    limiter = realtime_abuse.RealtimeMessageRateLimiter(
        board_id="fallback_board",
        client_instance_id="tab_fallback",
        room_key="board:workspace:fallback_board",
    )

    assert limiter.allow(now=1.0) is True
    assert limiter.allow(now=2.0) is False


def test_realtime_room_connection_falls_back_to_memory_limit(tmp_path, monkeypatch):
    _configure_local_board_storage(tmp_path, monkeypatch)
    monkeypatch.setenv("TANGENT_SECURITY_REDIS_ENABLED", "1")
    monkeypatch.setenv("TANGENT_REALTIME_ROOM_CONNECTION_LIMIT", "1")
    monkeypatch.setattr(realtime_abuse, "increment_security_counter", lambda **_kwargs: None)
    reset_security_events()
    client = TestClient(app)
    room_key = _create_board_and_room_key(client, "realtime_connection_fallback_board")

    with client.websocket_connect(
        _realtime_url("realtime_connection_fallback_board", "tab_one", room_key)
    ) as ws_one:
        assert ws_one.receive_json()["type"] == "sync-state"
        assert ws_one.receive_json()["type"] == "awareness-batch"
        with pytest.raises(WebSocketDisconnect) as excinfo:
            with client.websocket_connect(
                _realtime_url("realtime_connection_fallback_board", "tab_two", room_key)
            ) as ws_two:
                ws_two.receive_json()

    assert excinfo.value.code == 4408
    assert list_recent_security_events()[-1]["reason"] == "websocket_room_connection_limit_exceeded"


def _configure_local_board_storage(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")


def _create_board_and_room_key(client: TestClient, board_id: str) -> str:
    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": board_id,
            "document": {"assets": [], "shapes": []},
            "title": "Realtime Abuse Board",
        },
    )
    assert save_response.status_code == 200
    collaboration_response = client.get(f"/api/v1/boards/{board_id}/collaboration")
    assert collaboration_response.status_code == 200
    return collaboration_response.json()["roomKey"]


def _realtime_url(board_id: str, client_instance_id: str, room_key: str) -> str:
    query = urlencode({
        "clientInstanceId": client_instance_id,
        "roomKey": room_key,
        "userId": "dev-user",
        "workspaceId": "dev-workspace",
        "workspaceKind": "solo_workspace",
        "workspaceName": "Personal workspace",
        "workspaceRole": "owner",
    })
    return f"/api/v1/boards/{board_id}/realtime?{query}"
