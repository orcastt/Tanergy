import asyncio
import time
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
from tangent_api.security_events import list_recent_security_events, reset_security_events
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
                    "connectionPreview": {
                        "dataType": "image",
                        "pointer": {"x": 18, "y": 28},
                        "source": {"portId": "image_out", "shapeId": "shape_1"},
                        "target": {"portId": "image_in", "shapeId": "shape_2"},
                    },
                    "editingShapeIds": ["shape_1"],
                    "hoveredShapeId": "shape_1",
                    "selectedEdgeId": "edge_remote_1",
                    "selectionBox": {"minX": 4, "minY": 5, "maxX": 16, "maxY": 24},
                    "selectionIds": ["shape_1"],
                    "state": "typing",
                    "tool": "text",
                    "transformBox": {"minX": 6, "minY": 7, "maxX": 18, "maxY": 26},
                    "transformKind": "resize",
                },
                "updatedAt": "2099-05-12T12:00:00+00:00",
            },
        })
        assert ws_one.receive_json()["type"] == "awareness-state"

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
                            "connectionPreview": {
                                "dataType": "image",
                                "pointer": {"x": 18, "y": 28},
                                "source": {"portId": "image_out", "shapeId": "shape_1"},
                                "target": {"portId": "image_in", "shapeId": "shape_2"},
                            },
                            "editingShapeIds": ["shape_1"],
                            "hoveredShapeId": "shape_1",
                            "selectedEdgeId": "edge_remote_1",
                            "selectionBox": {"minX": 4, "minY": 5, "maxX": 16, "maxY": 24},
                            "selectionIds": ["shape_1"],
                            "state": "typing",
                            "tool": "text",
                            "transformBox": {"minX": 6, "minY": 7, "maxX": 18, "maxY": 26},
                            "transformKind": "resize",
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
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_collaboration_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_realtime_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)
    group_headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
        "x-tangent-workspace-name": "Group workspace",
    }

    save_response = client.post(
        "/api/v1/boards",
        headers=group_headers,
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
                "board:workspace_group:realtime_visibility_board",
                user_id="user_guest",
                workspace_id="workspace_group",
                workspace_kind="group_workspace",
                workspace_name="Group workspace",
                workspace_role="guest",
            )
        ):
            pass

    assert excinfo.value.code == 4403

    visibility_response = client.patch(
        "/api/v1/boards/realtime_visibility_board",
        headers=group_headers,
        json={"visibility": "workspace"},
    )
    assert visibility_response.status_code == 200

    with pytest.raises(WebSocketDisconnect) as second_excinfo:
        with client.websocket_connect(
            _realtime_url(
                "realtime_visibility_board",
                "tab_guest_workspace",
                "board:workspace_group:realtime_visibility_board",
                user_id="user_guest",
                workspace_id="workspace_group",
                workspace_kind="group_workspace",
                workspace_name="Group workspace",
                workspace_role="guest",
            )
        ):
            pass

    assert second_excinfo.value.code == 4403


def test_postgres_board_realtime_websocket_persists_document_state(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_collaboration_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_realtime_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)
    group_headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
        "x-tangent-workspace-name": "Group workspace",
    }

    save_response = client.post(
        "/api/v1/boards",
        headers=group_headers,
        json={
            "boardId": "realtime_postgres_board",
            "document": {"assets": [], "shapes": [{"id": "shape_pg"}]},
            "title": "Realtime Postgres Board",
        },
    )
    assert save_response.status_code == 200

    visibility_response = client.patch(
        "/api/v1/boards/realtime_postgres_board",
        headers=group_headers,
        json={"visibility": "workspace"},
    )
    assert visibility_response.status_code == 200
    viewer_response = client.post(
        "/api/v1/boards/realtime_postgres_board/members",
        headers=group_headers,
        json={"userId": "user_guest", "role": "viewer", "displayName": "Guest Viewer"},
    )
    assert viewer_response.status_code == 200

    room_key = "board:workspace_group:realtime_postgres_board"
    with client.websocket_connect(
        _realtime_url(
            "realtime_postgres_board",
            "tab_owner_pg",
            room_key,
            workspace_id="workspace_group",
            workspace_kind="group_workspace",
            workspace_name="Group workspace",
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
            workspace_id="workspace_group",
            workspace_kind="group_workspace",
            workspace_name="Group workspace",
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


def test_postgres_board_realtime_websocket_skips_process_writes_until_room_empty(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.delenv("TANGENT_BOARD_REALTIME_PERSIST_MODE", raising=False)
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_collaboration_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_realtime_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)
    group_headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
        "x-tangent-workspace-name": "Group workspace",
    }

    save_response = client.post(
        "/api/v1/boards",
        headers=group_headers,
        json={
            "boardId": "realtime_final_snapshot_board",
            "document": {"assets": [], "shapes": [{"id": "shape_snapshot"}]},
            "title": "Realtime Final Snapshot Board",
        },
    )
    assert save_response.status_code == 200

    visibility_response = client.patch(
        "/api/v1/boards/realtime_final_snapshot_board",
        headers=group_headers,
        json={"visibility": "workspace"},
    )
    assert visibility_response.status_code == 200

    room_key = "board:workspace_group:realtime_final_snapshot_board"
    with client.websocket_connect(
        _realtime_url(
            "realtime_final_snapshot_board",
            "tab_owner_snapshot",
            room_key,
            workspace_id="workspace_group",
            workspace_kind="group_workspace",
            workspace_name="Group workspace",
        )
    ) as ws_owner:
        assert ws_owner.receive_json() == {
            "documentVersion": 0,
            "requestCompaction": False,
            "seedRoom": True,
            "type": "sync-state",
            "updates": [],
        }
        assert ws_owner.receive_json() == {"states": [], "type": "awareness-batch"}

        ws_owner.send_json({"type": "yjs-update", "update": [3, 3, 3]})
        time.sleep(0.35)
        assert fake_db.board_realtime_documents == []

        with client.websocket_connect(
            _realtime_url(
                "realtime_final_snapshot_board",
                "tab_observer_snapshot",
                room_key,
                workspace_id="workspace_group",
                workspace_kind="group_workspace",
                workspace_name="Group workspace",
            )
        ) as ws_observer:
            assert ws_observer.receive_json() == {
                "documentVersion": 1,
                "requestCompaction": False,
                "seedRoom": False,
                "type": "sync-state",
                "updates": [[3, 3, 3]],
            }
            assert ws_observer.receive_json() == {"states": [], "type": "awareness-batch"}

        time.sleep(0.1)
        assert fake_db.board_realtime_documents == []

    assert fake_db.board_realtime_documents[-1]["document_updates"] == [[3, 3, 3]]


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
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_collaboration_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_realtime_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)
    group_headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
        "x-tangent-workspace-name": "Group workspace",
    }

    save_response = client.post(
        "/api/v1/boards",
        headers=group_headers,
        json={
            "boardId": "realtime_guest_block_board",
            "document": {"assets": [], "shapes": [{"id": "shape_owner"}]},
            "title": "Realtime Guest Block Board",
        },
    )
    assert save_response.status_code == 200

    visibility_response = client.patch(
        "/api/v1/boards/realtime_guest_block_board",
        headers=group_headers,
        json={"visibility": "workspace"},
    )
    assert visibility_response.status_code == 200
    viewer_response = client.post(
        "/api/v1/boards/realtime_guest_block_board/members",
        headers=group_headers,
        json={"userId": "user_guest", "role": "viewer", "displayName": "Guest Viewer"},
    )
    assert viewer_response.status_code == 200

    room_key = "board:workspace_group:realtime_guest_block_board"
    with client.websocket_connect(
        _realtime_url(
            "realtime_guest_block_board",
            "tab_guest_block",
            room_key,
            user_id="user_guest",
            workspace_id="workspace_group",
            workspace_kind="group_workspace",
            workspace_name="Group workspace",
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

    with client.websocket_connect(
        _realtime_url(
            "realtime_guest_block_board",
            "tab_owner_verify",
            room_key,
            workspace_id="workspace_group",
            workspace_kind="group_workspace",
            workspace_name="Group workspace",
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


def test_postgres_board_realtime_revalidates_editor_after_member_removed(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_collaboration_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_realtime_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)
    group_headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
        "x-tangent-workspace-name": "Group workspace",
    }

    save_response = client.post(
        "/api/v1/boards",
        headers=group_headers,
        json={
            "boardId": "realtime_revoked_editor_board",
            "document": {"assets": [], "shapes": [{"id": "shape_owner"}]},
            "title": "Realtime Revoked Editor Board",
        },
    )
    assert save_response.status_code == 200
    editor_response = client.post(
        "/api/v1/boards/realtime_revoked_editor_board/members",
        headers=group_headers,
        json={"userId": "user_editor", "role": "editor", "displayName": "Editor User"},
    )
    assert editor_response.status_code == 200

    room_key = "board:workspace_group:realtime_revoked_editor_board"
    reset_security_events()
    with client.websocket_connect(
        _realtime_url(
            "realtime_revoked_editor_board",
            "tab_editor_revoked",
            room_key,
            user_id="user_editor",
            workspace_id="workspace_group",
            workspace_kind="group_workspace",
            workspace_name="Group workspace",
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

        delete_response = client.delete(
            "/api/v1/boards/realtime_revoked_editor_board/members/user_editor",
            headers=group_headers,
        )
        assert delete_response.status_code == 200

        websocket.send_json({"type": "yjs-update", "update": [4, 4, 4]})
        with pytest.raises(WebSocketDisconnect) as excinfo:
            websocket.receive_json()
        assert excinfo.value.code == 4403

    assert list_recent_security_events()[-1]["reason"] == "realtime_write_access_revoked"
    with client.websocket_connect(
        _realtime_url(
            "realtime_revoked_editor_board",
            "tab_owner_after_revoked",
            room_key,
            workspace_id="workspace_group",
            workspace_kind="group_workspace",
            workspace_name="Group workspace",
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


def test_local_board_realtime_websocket_resyncs_stale_compaction_after_room_already_compacted(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "realtime_resync_after_compaction_board",
            "document": {"assets": [], "shapes": [{"id": "shape_resync"}]},
            "title": "Realtime Resync After Compaction Board",
        },
    )
    assert save_response.status_code == 200

    collaboration_response = client.get("/api/v1/boards/realtime_resync_after_compaction_board/collaboration")
    assert collaboration_response.status_code == 200
    room_key = collaboration_response.json()["roomKey"]

    with client.websocket_connect(_realtime_url("realtime_resync_after_compaction_board", "tab_owner", room_key)) as websocket:
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

        websocket.send_json({
            "documentVersion": 99,
            "type": "sync-state-publish",
            "update": [8, 8, 8, 8],
        })
        assert websocket.receive_json() == {
            "documentVersion": 1,
            "requestCompaction": False,
            "seedRoom": False,
            "type": "sync-state",
            "updates": [[7, 7, 7]],
        }


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


def test_board_realtime_room_coalesces_compaction_request_to_editors():
    class FakeWebSocket:
        def __init__(self):
            self.messages = []

        async def send_json(self, payload):
            self.messages.append(payload)

    async def run_test():
        room = BoardRealtimeRoom("board:workspace:coalesced_compaction_board")
        editor_one = FakeWebSocket()
        editor_two = FakeWebSocket()
        viewer = FakeWebSocket()
        initial_updates = [[index % 256] for index in range(BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD - 1)]
        connection_id = await room.connect(editor_one, "tab_editor_one", initial_updates, can_edit=True)
        await room.connect(editor_two, "tab_editor_two", can_edit=True)
        await room.connect(viewer, "tab_viewer", can_edit=False)
        editor_one.messages.clear()
        editor_two.messages.clear()
        viewer.messages.clear()

        document_updates, request_compaction, document_version, accepted = await room.publish_document_update(
            connection_id,
            "tab_editor_one",
            [1, 2, 3],
        )

        assert accepted is True
        assert request_compaction is True
        assert document_version == BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD
        assert len(document_updates) == BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD
        assert editor_one.messages == [
            {
                "documentVersion": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
                "requestCompaction": True,
                "type": "document-compact-request",
                "updateCount": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
            }
        ]
        assert editor_two.messages[-1] == editor_one.messages[0]
        assert viewer.messages == [
            {
                "documentVersion": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
                "from": "tab_editor_one",
                "type": "yjs-update",
                "update": [1, 2, 3],
            }
        ]

        editor_one.messages.clear()
        editor_two.messages.clear()
        viewer.messages.clear()
        await room.publish_document_update(
            connection_id,
            "tab_editor_one",
            [4, 5, 6],
        )

        assert editor_one.messages == []
        assert [message["type"] for message in editor_two.messages] == ["yjs-update"]
        assert [message["type"] for message in viewer.messages] == ["yjs-update"]

    asyncio.run(run_test())


def test_board_realtime_room_rejects_stale_compaction_publish_after_new_update():
    class FakeWebSocket:
        def __init__(self):
            self.messages = []

        async def send_json(self, payload):
            self.messages.append(payload)

    async def run_test():
        room = BoardRealtimeRoom("board:workspace:stale_compaction_unit_board")
        compactor = FakeWebSocket()
        other = FakeWebSocket()
        initial_updates = [[5, 5, 5]] + [
            [index, index + 1]
            for index in range(BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD - 1)
        ]
        await room.connect(compactor, "tab_compactor", initial_updates, can_edit=True)
        other_connection_id = await room.connect(other, "tab_other", can_edit=True)
        compactor.messages.clear()
        other.messages.clear()

        document_updates, request_compaction, document_version, accepted = await room.publish_document_update(
            other_connection_id,
            "tab_other",
            [99, 100],
        )
        assert accepted is True
        assert request_compaction is True
        assert document_version == BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD + 1
        assert len(document_updates) == BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD + 1
        assert {
            "documentVersion": BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD + 1,
            "from": "tab_other",
            "type": "yjs-update",
            "update": [99, 100],
        } in compactor.messages

        stale_updates, compact_accepted, still_needs_compaction, current_version = await room.replace_document_state(
            [4, 4, 4, 4],
            BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
        )
        assert compact_accepted is False
        assert still_needs_compaction is True
        assert current_version == BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD + 1
        assert len(stale_updates) == BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD + 1
        assert stale_updates[0] == [5, 5, 5]
        assert stale_updates[-1] == [99, 100]

        verify_updates = await room.snapshot_document()
        assert verify_updates == stale_updates

    asyncio.run(run_test())


def test_board_realtime_room_serializes_concurrent_sends_per_connection():
    class FakeWebSocket:
        def __init__(self):
            self.active_sends = 0
            self.max_concurrent_sends = 0
            self.messages = []

        async def send_json(self, payload):
            self.active_sends += 1
            self.max_concurrent_sends = max(self.max_concurrent_sends, self.active_sends)
            await asyncio.sleep(0.001)
            self.messages.append(payload)
            self.active_sends -= 1

    async def run_test():
        room = BoardRealtimeRoom("board:workspace:concurrent_send_board")
        sockets = [FakeWebSocket() for _index in range(6)]
        connection_ids = []
        for index, socket in enumerate(sockets):
            connection_ids.append(await room.connect(socket, f"tab_{index}", can_edit=True))
        for socket in sockets:
            socket.messages.clear()

        await asyncio.gather(
            *[
                room.publish_document_update(connection_id, f"tab_{index}", [index, index + 1])
                for index, connection_id in enumerate(connection_ids)
            ]
        )

        for socket in sockets:
            received_updates = [message for message in socket.messages if message.get("type") == "yjs-update"]
            assert len(received_updates) == len(sockets) - 1
            assert socket.max_concurrent_sends == 1

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
