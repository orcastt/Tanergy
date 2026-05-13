import asyncio
from datetime import datetime, timedelta, timezone
from urllib.parse import urlencode

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from tangent_api.main import app
from tangent_api.realtime.board_realtime_hub import (
    BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
    BoardRealtimeRoom,
)
from tangent_api.realtime.board_realtime_limits import BOARD_REALTIME_DOCUMENT_UPDATE_COUNT_LIMIT
from tests.persistence_fakes import FakePostgresDatabase


def test_local_board_realtime_websocket_replays_updates_and_presence_cleanup(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "realtime_local_board",
            "document": {"assets": [], "shapes": [{"id": "shape_1"}]},
            "title": "Realtime Local Board",
        },
    )
    assert save_response.status_code == 200

    collaboration_response = client.get("/api/v1/boards/realtime_local_board/collaboration")
    assert collaboration_response.status_code == 200
    room_key = collaboration_response.json()["roomKey"]
    awareness_expires_at = (datetime.now(timezone.utc) + timedelta(seconds=60)).isoformat()

    with client.websocket_connect(_realtime_url("realtime_local_board", "tab_one", room_key)) as ws_one:
        assert ws_one.receive_json() == {
            "documentVersion": 0,
            "requestCompaction": False,
            "seedRoom": True,
            "type": "sync-state",
            "updates": [],
        }
        assert ws_one.receive_json() == {"states": [], "type": "awareness-batch"}

        ws_one.send_json({"documentVersion": 0, "type": "sync-state-publish", "update": [9, 9, 9]})
        assert ws_one.receive_json() == {
            "documentVersion": 1,
            "requestCompaction": False,
            "type": "sync-state-accepted",
            "updateCount": 1,
        }
        ws_one.send_json({"type": "yjs-update", "update": [1, 2, 3]})
        ws_one.send_json({
            "type": "awareness-state",
            "state": {
                "clientInstanceId": "tab_one",
                "expiresAt": awareness_expires_at,
                "presence": {
                    "activePageId": "page_1",
                    "editingShapeIds": ["shape_1"],
                    "hoveredShapeId": "shape_1",
                    "selectionIds": ["shape_1"],
                    "state": "typing",
                    "tool": "text",
                },
                "updatedAt": "2099-05-12T12:00:00+00:00",
            },
        })

        with client.websocket_connect(_realtime_url("realtime_local_board", "tab_two", room_key)) as ws_two:
            assert ws_two.receive_json() == {
                "documentVersion": 2,
                "requestCompaction": False,
                "seedRoom": False,
                "type": "sync-state",
                "updates": [[9, 9, 9], [1, 2, 3]],
            }
            assert ws_two.receive_json() == {
                "states": [
                    {
                        "clientInstanceId": "tab_one",
                        "expiresAt": awareness_expires_at,
                        "presence": {
                            "activePageId": "page_1",
                            "editingShapeIds": ["shape_1"],
                            "hoveredShapeId": "shape_1",
                            "selectionIds": ["shape_1"],
                            "state": "typing",
                            "tool": "text",
                        },
                        "updatedAt": "2099-05-12T12:00:00+00:00",
                    }
                ],
                "type": "awareness-batch",
            }

            ws_one.close()
            assert ws_two.receive_json() == {
                "clientInstanceId": "tab_one",
                "type": "awareness-remove",
            }

    with client.websocket_connect(_realtime_url("realtime_local_board", "tab_three", room_key)) as ws_three:
        assert ws_three.receive_json() == {
            "documentVersion": 2,
            "requestCompaction": False,
            "seedRoom": False,
            "type": "sync-state",
            "updates": [[9, 9, 9], [1, 2, 3]],
        }
        assert ws_three.receive_json() == {"states": [], "type": "awareness-batch"}


def test_board_realtime_websocket_rejects_room_key_mismatch(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "realtime_mismatch_board",
            "document": {"assets": [], "shapes": []},
            "title": "Realtime Mismatch Board",
        },
    )
    assert save_response.status_code == 200

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(
            _realtime_url("realtime_mismatch_board", "tab_mismatch", "board:dev-workspace:wrong_board")
        ):
            pass

    assert excinfo.value.code == 4403


def test_board_realtime_websocket_requires_room_key(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "realtime_missing_room_board",
            "document": {"assets": [], "shapes": []},
            "title": "Realtime Missing Room Board",
        },
    )
    assert save_response.status_code == 200

    query = urlencode({
        "clientInstanceId": "tab_missing_room",
        "userId": "dev-user",
        "workspaceId": "dev-workspace",
        "workspaceKind": "solo_workspace",
        "workspaceName": "Personal workspace",
        "workspaceRole": "owner",
    })
    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(f"/api/v1/boards/realtime_missing_room_board/realtime?{query}"):
            pass

    assert excinfo.value.code == 4400


def test_board_realtime_websocket_respects_board_visibility(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_collaboration_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_realtime_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "realtime_visibility_board",
            "document": {"assets": [], "shapes": [{"id": "shape_owner"}]},
            "title": "Realtime Visibility Board",
        },
    )
    assert save_response.status_code == 200

    with pytest.raises(WebSocketDisconnect) as excinfo:
        with client.websocket_connect(
            _realtime_url(
                "realtime_visibility_board",
                "tab_guest_private",
                "board:dev-workspace:realtime_visibility_board",
                user_id="user_guest",
                workspace_role="guest",
            )
        ):
            pass

    assert excinfo.value.code == 4403

    visibility_response = client.patch(
        "/api/v1/boards/realtime_visibility_board",
        json={"visibility": "workspace"},
    )
    assert visibility_response.status_code == 200

    with client.websocket_connect(
        _realtime_url(
            "realtime_visibility_board",
            "tab_guest_workspace",
            "board:dev-workspace:realtime_visibility_board",
            user_id="user_guest",
            workspace_role="guest",
        )
    ) as websocket:
        assert websocket.receive_json() == {
            "documentVersion": 0,
            "requestCompaction": False,
            "seedRoom": True,
            "type": "sync-state",
            "updates": [],
        }
        assert websocket.receive_json()["type"] == "awareness-batch"


def test_postgres_board_realtime_websocket_persists_document_state(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_collaboration_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_realtime_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "realtime_postgres_board",
            "document": {"assets": [], "shapes": [{"id": "shape_pg"}]},
            "title": "Realtime Postgres Board",
        },
    )
    assert save_response.status_code == 200

    visibility_response = client.patch(
        "/api/v1/boards/realtime_postgres_board",
        json={"visibility": "workspace"},
    )
    assert visibility_response.status_code == 200

    room_key = "board:dev-workspace:realtime_postgres_board"
    with client.websocket_connect(_realtime_url("realtime_postgres_board", "tab_owner_pg", room_key)) as websocket:
        assert websocket.receive_json() == {
            "documentVersion": 0,
            "requestCompaction": False,
            "seedRoom": True,
            "type": "sync-state",
            "updates": [],
        }
        assert websocket.receive_json() == {"states": [], "type": "awareness-batch"}
        websocket.send_json({"documentVersion": 0, "type": "sync-state-publish", "update": [7, 7, 7]})
        assert websocket.receive_json() == {
            "documentVersion": 1,
            "requestCompaction": False,
            "type": "sync-state-accepted",
            "updateCount": 1,
        }
        websocket.send_json({"type": "yjs-update", "update": [8, 8, 8]})

    with client.websocket_connect(
        _realtime_url(
            "realtime_postgres_board",
            "tab_guest_pg",
            room_key,
            user_id="user_guest",
            workspace_role="guest",
        )
    ) as websocket:
        assert websocket.receive_json() == {
            "documentVersion": 2,
            "requestCompaction": False,
            "seedRoom": False,
            "type": "sync-state",
            "updates": [[7, 7, 7], [8, 8, 8]],
        }
        assert websocket.receive_json() == {"states": [], "type": "awareness-batch"}


def test_local_board_realtime_websocket_requests_compaction_and_replaces_chain(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "realtime_compact_board",
            "document": {"assets": [], "shapes": [{"id": "shape_compact"}]},
            "title": "Realtime Compact Board",
        },
    )
    assert save_response.status_code == 200

    collaboration_response = client.get("/api/v1/boards/realtime_compact_board/collaboration")
    assert collaboration_response.status_code == 200
    room_key = collaboration_response.json()["roomKey"]

    with client.websocket_connect(_realtime_url("realtime_compact_board", "tab_compact", room_key)) as websocket:
        assert websocket.receive_json() == {
            "documentVersion": 0,
            "requestCompaction": False,
            "seedRoom": True,
            "type": "sync-state",
            "updates": [],
        }
        assert websocket.receive_json() == {"states": [], "type": "awareness-batch"}

        websocket.send_json({"documentVersion": 0, "type": "sync-state-publish", "update": [5, 5, 5]})
        assert websocket.receive_json() == {
            "documentVersion": 1,
            "requestCompaction": False,
            "type": "sync-state-accepted",
            "updateCount": 1,
        }
        for index in range(BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD - 1):
            websocket.send_json({"type": "yjs-update", "update": [index, index + 1]})

        assert websocket.receive_json() == {
            "documentVersion": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
            "requestCompaction": True,
            "type": "document-compact-request",
            "updateCount": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
        }

        websocket.send_json({
            "documentVersion": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
            "type": "sync-state-publish",
            "update": [4, 4, 4, 4],
        })
        assert websocket.receive_json() == {
            "documentVersion": 1,
            "requestCompaction": False,
            "type": "sync-state-accepted",
            "updateCount": 1,
        }

    with client.websocket_connect(_realtime_url("realtime_compact_board", "tab_compact_reconnect", room_key)) as websocket:
        assert websocket.receive_json() == {
            "documentVersion": 1,
            "requestCompaction": False,
            "seedRoom": False,
            "type": "sync-state",
            "updates": [[4, 4, 4, 4]],
        }
        assert websocket.receive_json() == {"states": [], "type": "awareness-batch"}


def test_board_realtime_websocket_blocks_guest_document_writes(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_collaboration_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_realtime_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "realtime_guest_block_board",
            "document": {"assets": [], "shapes": [{"id": "shape_owner"}]},
            "title": "Realtime Guest Block Board",
        },
    )
    assert save_response.status_code == 200

    visibility_response = client.patch(
        "/api/v1/boards/realtime_guest_block_board",
        json={"visibility": "workspace"},
    )
    assert visibility_response.status_code == 200

    room_key = "board:dev-workspace:realtime_guest_block_board"
    with client.websocket_connect(
        _realtime_url(
            "realtime_guest_block_board",
            "tab_guest_block",
            room_key,
            user_id="user_guest",
            workspace_role="guest",
        )
    ) as websocket:
        assert websocket.receive_json() == {
            "documentVersion": 0,
            "requestCompaction": False,
            "seedRoom": True,
            "type": "sync-state",
            "updates": [],
        }
        assert websocket.receive_json() == {"states": [], "type": "awareness-batch"}
        websocket.send_json({"type": "yjs-update", "update": [8, 8, 8]})
        with pytest.raises(WebSocketDisconnect) as excinfo:
            websocket.receive_json()
        assert excinfo.value.code == 4403

    with client.websocket_connect(_realtime_url("realtime_guest_block_board", "tab_owner_verify", room_key)) as websocket:
        assert websocket.receive_json() == {
            "documentVersion": 0,
            "requestCompaction": False,
            "seedRoom": True,
            "type": "sync-state",
            "updates": [],
        }
        assert websocket.receive_json() == {"states": [], "type": "awareness-batch"}


def test_local_board_realtime_websocket_drops_expired_awareness_state(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "realtime_expired_awareness_board",
            "document": {"assets": [], "shapes": [{"id": "shape_1"}]},
            "title": "Realtime Expired Awareness Board",
        },
    )
    assert save_response.status_code == 200

    collaboration_response = client.get("/api/v1/boards/realtime_expired_awareness_board/collaboration")
    assert collaboration_response.status_code == 200
    room_key = collaboration_response.json()["roomKey"]

    with client.websocket_connect(_realtime_url("realtime_expired_awareness_board", "tab_one", room_key)) as ws_one:
        assert ws_one.receive_json()["type"] == "sync-state"
        assert ws_one.receive_json() == {"states": [], "type": "awareness-batch"}
        ws_one.send_json({
            "type": "awareness-state",
            "state": {
                "clientInstanceId": "tab_one",
                "expiresAt": "2000-01-01T00:00:00+00:00",
                "presence": {
                    "activePageId": "page_1",
                    "editingShapeIds": ["shape_1"],
                    "hoveredShapeId": "shape_1",
                    "selectionIds": ["shape_1"],
                    "state": "typing",
                    "tool": "text",
                },
                "updatedAt": "2000-01-01T00:00:00+00:00",
            },
        })

        with client.websocket_connect(_realtime_url("realtime_expired_awareness_board", "tab_two", room_key)) as ws_two:
            assert ws_two.receive_json() == {
                "documentVersion": 0,
                "requestCompaction": False,
                "seedRoom": True,
                "type": "sync-state",
                "updates": [],
            }
            assert ws_two.receive_json() == {"states": [], "type": "awareness-batch"}


def test_local_board_realtime_websocket_rejects_stale_compaction_publish(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "realtime_stale_compaction_board",
            "document": {"assets": [], "shapes": [{"id": "shape_stale"}]},
            "title": "Realtime Stale Compaction Board",
        },
    )
    assert save_response.status_code == 200

    collaboration_response = client.get("/api/v1/boards/realtime_stale_compaction_board/collaboration")
    assert collaboration_response.status_code == 200
    room_key = collaboration_response.json()["roomKey"]

    with client.websocket_connect(_realtime_url("realtime_stale_compaction_board", "tab_compactor", room_key)) as ws_compactor:
        assert ws_compactor.receive_json()["type"] == "sync-state"
        assert ws_compactor.receive_json() == {"states": [], "type": "awareness-batch"}
        ws_compactor.send_json({"documentVersion": 0, "type": "sync-state-publish", "update": [5, 5, 5]})
        assert ws_compactor.receive_json() == {
            "documentVersion": 1,
            "requestCompaction": False,
            "type": "sync-state-accepted",
            "updateCount": 1,
        }

        with client.websocket_connect(_realtime_url("realtime_stale_compaction_board", "tab_other", room_key)) as ws_other:
            assert ws_other.receive_json() == {
                "documentVersion": 1,
                "requestCompaction": False,
                "seedRoom": False,
                "type": "sync-state",
                "updates": [[5, 5, 5]],
            }
            assert ws_other.receive_json() == {"states": [], "type": "awareness-batch"}

            for index in range(BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD - 1):
                ws_compactor.send_json({"type": "yjs-update", "update": [index, index + 1]})

            assert ws_compactor.receive_json() == {
                "documentVersion": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
                "requestCompaction": True,
                "type": "document-compact-request",
                "updateCount": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
            }

            ws_other.send_json({"type": "yjs-update", "update": [99, 100]})
            ws_compactor.send_json({
                "documentVersion": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
                "type": "sync-state-publish",
                "update": [4, 4, 4, 4],
            })

            assert ws_compactor.receive_json() == {
                "documentVersion": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD + 1,
                "from": "tab_other",
                "type": "yjs-update",
                "update": [99, 100],
            }
            assert ws_compactor.receive_json() == {
                "documentVersion": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD + 1,
                "requestCompaction": True,
                "type": "document-compact-request",
                "updateCount": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD + 1,
            }

    with client.websocket_connect(_realtime_url("realtime_stale_compaction_board", "tab_verify", room_key)) as websocket:
        sync_state = websocket.receive_json()
        assert sync_state["documentVersion"] == BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD + 1
        assert sync_state["requestCompaction"] is True
        assert sync_state["seedRoom"] is False
        assert sync_state["type"] == "sync-state"
        assert len(sync_state["updates"]) == BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD + 1
        assert sync_state["updates"][0] == [5, 5, 5]
        assert sync_state["updates"][-1] == [99, 100]
        assert websocket.receive_json() == {"states": [], "type": "awareness-batch"}


def test_board_realtime_room_rejects_update_chain_after_hard_limit():
    class FakeWebSocket:
        def __init__(self):
            self.messages = []

        async def send_json(self, payload):
            self.messages.append(payload)

    async def run_test():
        room = BoardRealtimeRoom("board:workspace:hard_limit_board")
        websocket = FakeWebSocket()
        initial_updates = [[index % 256] for index in range(BOARD_REALTIME_DOCUMENT_UPDATE_COUNT_LIMIT)]
        connection_id = await room.connect(websocket, "tab_limit", initial_updates)
        document_updates, request_compaction, document_version, accepted = await room.publish_document_update(
            connection_id,
            "tab_limit",
            [1, 2, 3],
        )

        assert accepted is False
        assert request_compaction is True
        assert document_version == BOARD_REALTIME_DOCUMENT_UPDATE_COUNT_LIMIT
        assert len(document_updates) == BOARD_REALTIME_DOCUMENT_UPDATE_COUNT_LIMIT

    asyncio.run(run_test())


def test_board_realtime_room_rejects_update_chain_after_total_byte_limit(monkeypatch):
    class FakeWebSocket:
        def __init__(self):
            self.messages = []

        async def send_json(self, payload):
            self.messages.append(payload)

    async def run_test():
        monkeypatch.setattr(
            "tangent_api.realtime.board_realtime_limits.BOARD_REALTIME_DOCUMENT_TOTAL_BYTE_LIMIT",
            3,
        )
        room = BoardRealtimeRoom("board:workspace:byte_limit_board")
        websocket = FakeWebSocket()
        initial_updates = [[1, 2, 3]]
        connection_id = await room.connect(websocket, "tab_byte_limit", initial_updates)
        document_updates, request_compaction, document_version, accepted = await room.publish_document_update(
            connection_id,
            "tab_byte_limit",
            [1],
        )

        assert accepted is False
        assert request_compaction is True
        assert document_version == 1
        assert len(document_updates) == 1
        assert sum(len(update) for update in document_updates) == 3

    asyncio.run(run_test())


def _realtime_url(
    board_id: str,
    client_instance_id: str,
    room_key: str,
    *,
    user_id: str = "dev-user",
    workspace_id: str = "dev-workspace",
    workspace_kind: str = "solo_workspace",
    workspace_name: str = "Personal workspace",
    workspace_role: str = "owner",
):
    query = urlencode({
        "clientInstanceId": client_instance_id,
        "roomKey": room_key,
        "userId": user_id,
        "workspaceId": workspace_id,
        "workspaceKind": workspace_kind,
        "workspaceName": workspace_name,
        "workspaceRole": workspace_role,
    })
    return f"/api/v1/boards/{board_id}/realtime?{query}"
