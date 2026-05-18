import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardSaveRequest, BoardSnapshotCreateRequest
from tangent_api.storage.postgres_board_snapshot_store import PostgresBoardSnapshotStore
from tangent_api.storage.postgres_board_store import PostgresBoardStore
from tests.persistence_fakes import FakePostgresDatabase


def test_board_local_dev_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    client = TestClient(app)
    group_headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
    }

    save_response = client.post(
        "/api/v1/boards",
        headers=group_headers,
        json={
            "boardId": "api-smoke-board",
            "document": {"assets": [{"id": "asset_1"}], "shapes": [{"id": "shape_1"}, {"id": "shape_2"}]},
            "title": "API Smoke Board",
        },
    )

    assert save_response.status_code == 200
    saved = save_response.json()["board"]
    assert saved["assetCount"] == 1
    assert saved["createdAt"] is not None
    assert saved["isPinned"] is False
    assert saved["isStarred"] is False
    assert saved["lastOpenedAt"] is None
    assert saved["shapeCount"] == 2
    assert saved["thumbnailUrl"] is None
    assert saved["visibility"] == "private"
    assert saved["workspaceId"] == "workspace_group"
    assert "document" not in saved

    load_response = client.get("/api/v1/boards/api-smoke-board", headers=group_headers)
    assert load_response.status_code == 200
    loaded = load_response.json()["board"]
    assert loaded["assetCount"] == 1
    assert loaded["document"] == {"assets": [{"id": "asset_1"}], "shapes": [{"id": "shape_1"}, {"id": "shape_2"}]}
    assert loaded["lastOpenedAt"] is not None
    assert loaded["shapeCount"] == 2
    assert loaded["workspaceId"] == "workspace_group"

    list_response = client.get("/api/v1/boards", headers=group_headers)
    assert list_response.status_code == 200
    listed = list_response.json()["boards"]
    assert [board["id"] for board in listed] == ["api-smoke-board"]
    assert listed[0]["assetCount"] == 1
    assert listed[0]["lastOpenedAt"] == loaded["lastOpenedAt"]
    assert listed[0]["shapeCount"] == 2
    assert listed[0]["thumbnailUrl"] is None
    assert "document" not in listed[0]

    snapshot_response = client.post(
        "/api/v1/boards/api-smoke-board/snapshots",
        headers=group_headers,
        json={
            "document": {"assets": [{"id": "asset_1"}], "shapes": [{"id": "shape_1"}]},
            "reason": "manual_save",
            "thumbnailUrl": "https://example.com/history-thumb.webp",
            "title": "Manual save",
        },
    )
    assert snapshot_response.status_code == 200
    snapshot = snapshot_response.json()["snapshot"]
    assert snapshot["assetCount"] == 1
    assert snapshot["boardId"] == "api-smoke-board"
    assert snapshot["reason"] == "manual_save"
    assert snapshot["thumbnailUrl"] == "https://example.com/history-thumb.webp"
    assert "document" not in snapshot

    snapshot_list = client.get("/api/v1/boards/api-smoke-board/snapshots", headers=group_headers)
    assert snapshot_list.status_code == 200
    assert [item["id"] for item in snapshot_list.json()["snapshots"]] == [snapshot["id"]]

    snapshot_load = client.get(f"/api/v1/boards/api-smoke-board/snapshots/{snapshot['id']}", headers=group_headers)
    assert snapshot_load.status_code == 200
    assert snapshot_load.json()["snapshot"]["document"] == {"assets": [{"id": "asset_1"}], "shapes": [{"id": "shape_1"}]}
    assert snapshot_load.json()["snapshot"]["thumbnailUrl"] == "https://example.com/history-thumb.webp"

    monkeypatch.setenv("TANGENT_FREE_BOARD_SNAPSHOT_LIMIT", "2")
    for index in range(2):
        response = client.post(
            "/api/v1/boards/api-smoke-board/snapshots",
            headers=group_headers,
            json={"document": {"assets": [], "shapes": [{"id": f"shape_{index}"}]}, "reason": "autosave"},
        )
        assert response.status_code == 200
    snapshot_list = client.get("/api/v1/boards/api-smoke-board/snapshots", headers=group_headers)
    assert snapshot_list.status_code == 200
    snapshots = snapshot_list.json()["snapshots"]
    assert len(snapshots) == 3
    assert [item["reason"] for item in snapshots].count("autosave") == 2
    assert [item["reason"] for item in snapshots].count("manual_save") == 1

    clear_snapshots = client.delete("/api/v1/boards/api-smoke-board/snapshots", headers=group_headers)
    assert clear_snapshots.status_code == 200
    assert clear_snapshots.json()["deletedCount"] == 3
    snapshot_list = client.get("/api/v1/boards/api-smoke-board/snapshots", headers=group_headers)
    assert snapshot_list.status_code == 200
    assert snapshot_list.json()["snapshots"] == []

    rename_response = client.patch("/api/v1/boards/api-smoke-board", headers=group_headers, json={"title": "Renamed Board"})
    assert rename_response.status_code == 200
    renamed = rename_response.json()["board"]
    assert renamed["title"] == "Renamed Board"
    assert "document" not in renamed

    metadata_response = client.patch(
        "/api/v1/boards/api-smoke-board",
        headers=group_headers,
        json={
            "cardColor": "mint",
            "description": "  Campaign concepts  ",
            "isPinned": True,
            "isStarred": True,
            "shareId": "share_test_123",
            "thumbnailUrl": "https://example.com/thumb.webp",
            "visibility": "public",
        },
    )
    assert metadata_response.status_code == 200
    metadata = metadata_response.json()["board"]
    assert metadata["cardColor"] == "mint"
    assert metadata["description"] == "Campaign concepts"
    assert metadata["isPinned"] is True
    assert metadata["isStarred"] is True
    assert metadata["shareId"] == "share_test_123"
    assert metadata["thumbnailUrl"] == "https://example.com/thumb.webp"
    assert metadata["title"] == "Renamed Board"
    assert metadata["visibility"] == "public"

    empty_rename = client.patch("/api/v1/boards/api-smoke-board", headers=group_headers, json={"title": " "})
    assert empty_rename.status_code == 400

    blocked = client.get(
        "/api/v1/boards/api-smoke-board",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "other-workspace"},
    )
    assert blocked.status_code == 404

    blocked_list = client.get(
        "/api/v1/boards",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "other-workspace"},
    )
    assert blocked_list.status_code == 200
    assert blocked_list.json()["boards"] == []
    blocked_snapshots = client.get(
        "/api/v1/boards/api-smoke-board/snapshots",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "other-workspace"},
    )
    assert blocked_snapshots.status_code == 200
    assert blocked_snapshots.json()["snapshots"] == []

    delete_response = client.delete("/api/v1/boards/api-smoke-board", headers=group_headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["boardId"] == "api-smoke-board"
    assert client.get("/api/v1/boards/api-smoke-board", headers=group_headers).status_code == 404


def test_board_postgres_contract(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr(
        "tangent_api.storage.postgres_board_store.connect_to_postgres",
        fake_db.connect,
    )
    monkeypatch.setattr(
        "tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres",
        fake_db.connect,
    )
    client = TestClient(app)
    group_headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
    }

    save_response = client.post(
        "/api/v1/boards",
        headers=group_headers,
        json={
            "boardId": "api-postgres-board",
            "document": {"assets": [{"id": "asset_1"}, {"id": "asset_2"}], "shapes": [{"id": "shape_1"}]},
            "title": "Postgres Board",
        },
    )

    assert save_response.status_code == 200
    saved = save_response.json()["board"]
    assert saved["assetCount"] == 2
    assert saved["createdAt"] is not None
    assert saved["isPinned"] is False
    assert saved["isStarred"] is False
    assert saved["lastOpenedAt"] is None
    assert saved["shapeCount"] == 1
    assert saved["thumbnailUrl"] is None
    assert saved["visibility"] == "private"
    assert saved["workspaceId"] == "workspace_group"
    assert "document" not in saved
    assert ("workspace_group", "api-postgres-board") in fake_db.boards

    load_response = client.get("/api/v1/boards/api-postgres-board", headers=group_headers)
    assert load_response.status_code == 200
    loaded = load_response.json()["board"]
    assert loaded["assetCount"] == 2
    assert loaded["document"] == {"assets": [{"id": "asset_1"}, {"id": "asset_2"}], "shapes": [{"id": "shape_1"}]}
    assert loaded["lastOpenedAt"] is not None
    assert loaded["shapeCount"] == 1
    assert loaded["title"] == "Postgres Board"

    list_response = client.get("/api/v1/boards", headers=group_headers)
    assert list_response.status_code == 200
    listed = list_response.json()["boards"]
    assert [board["id"] for board in listed] == ["api-postgres-board"]
    assert listed[0]["assetCount"] == 2
    assert listed[0]["lastOpenedAt"] == loaded["lastOpenedAt"]
    assert listed[0]["shapeCount"] == 1
    assert listed[0]["thumbnailUrl"] is None
    assert "document" not in listed[0]

    snapshot_response = client.post(
        "/api/v1/boards/api-postgres-board/snapshots",
        headers=group_headers,
        json={
            "document": {"assets": [{"id": "asset_1"}], "shapes": [{"id": "shape_1"}]},
            "reason": "keyboard",
            "thumbnailUrl": "https://example.com/keyboard-history.webp",
            "title": "Keyboard snapshot",
        },
    )
    assert snapshot_response.status_code == 200
    snapshot = snapshot_response.json()["snapshot"]
    assert snapshot["reason"] == "keyboard"
    assert snapshot["thumbnailUrl"] == "https://example.com/keyboard-history.webp"
    assert ("workspace_group", "api-postgres-board", snapshot["id"]) in fake_db.snapshots

    snapshot_list = client.get("/api/v1/boards/api-postgres-board/snapshots", headers=group_headers)
    assert snapshot_list.status_code == 200
    assert [item["id"] for item in snapshot_list.json()["snapshots"]] == [snapshot["id"]]

    snapshot_load = client.get(f"/api/v1/boards/api-postgres-board/snapshots/{snapshot['id']}", headers=group_headers)
    assert snapshot_load.status_code == 200
    assert snapshot_load.json()["snapshot"]["document"] == {"assets": [{"id": "asset_1"}], "shapes": [{"id": "shape_1"}]}
    assert snapshot_load.json()["snapshot"]["thumbnailUrl"] == "https://example.com/keyboard-history.webp"

    monkeypatch.setenv("TANGENT_FREE_BOARD_SNAPSHOT_LIMIT", "2")
    for index in range(2):
        response = client.post(
            "/api/v1/boards/api-postgres-board/snapshots",
            headers=group_headers,
            json={"document": {"assets": [], "shapes": [{"id": f"shape_{index}"}]}, "reason": "autosave"},
        )
        assert response.status_code == 200
    snapshot_list = client.get("/api/v1/boards/api-postgres-board/snapshots", headers=group_headers)
    assert snapshot_list.status_code == 200
    snapshots = snapshot_list.json()["snapshots"]
    assert len(snapshots) == 3
    assert [item["reason"] for item in snapshots].count("autosave") == 2
    assert [item["reason"] for item in snapshots].count("keyboard") == 1

    clear_snapshots = client.delete("/api/v1/boards/api-postgres-board/snapshots", headers=group_headers)
    assert clear_snapshots.status_code == 200
    assert clear_snapshots.json()["deletedCount"] == 3
    assert fake_db.snapshots == {}
    snapshot_list = client.get("/api/v1/boards/api-postgres-board/snapshots", headers=group_headers)
    assert snapshot_list.status_code == 200
    assert snapshot_list.json()["snapshots"] == []

    rename_response = client.patch("/api/v1/boards/api-postgres-board", headers=group_headers, json={"title": "Renamed Postgres"})
    assert rename_response.status_code == 200
    assert rename_response.json()["board"]["title"] == "Renamed Postgres"
    assert fake_db.boards[("workspace_group", "api-postgres-board")][3] == "Renamed Postgres"

    metadata_response = client.patch(
        "/api/v1/boards/api-postgres-board",
        headers=group_headers,
        json={
            "cardColor": "peach",
            "description": "Launch wall",
            "isPinned": True,
            "isStarred": True,
            "shareId": "share_pg_123",
            "thumbnailUrl": "https://example.com/pg-thumb.webp",
            "visibility": "workspace",
        },
    )
    assert metadata_response.status_code == 200
    metadata = metadata_response.json()["board"]
    assert metadata["cardColor"] == "peach"
    assert metadata["description"] == "Launch wall"
    assert metadata["isPinned"] is True
    assert metadata["isStarred"] is True
    assert metadata["shareId"] == "share_pg_123"
    assert metadata["thumbnailUrl"] == "https://example.com/pg-thumb.webp"
    assert metadata["title"] == "Renamed Postgres"
    assert metadata["visibility"] == "workspace"
    assert fake_db.boards[("workspace_group", "api-postgres-board")][8] == "Launch wall"
    assert fake_db.boards[("workspace_group", "api-postgres-board")][9] == "peach"
    assert fake_db.boards[("workspace_group", "api-postgres-board")][14] is True
    assert fake_db.boards[("workspace_group", "api-postgres-board")][15] is True

    blocked = client.get(
        "/api/v1/boards/api-postgres-board",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "other-workspace"},
    )
    assert blocked.status_code == 404

    blocked_list = client.get(
        "/api/v1/boards",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "other-workspace"},
    )
    assert blocked_list.status_code == 200
    assert blocked_list.json()["boards"] == []

    delete_response = client.delete("/api/v1/boards/api-postgres-board", headers=group_headers)
    assert delete_response.status_code == 200
    assert delete_response.json()["boardId"] == "api-postgres-board"
    assert ("workspace_group", "api-postgres-board") in fake_db.deleted_boards
    assert client.get("/api/v1/boards/api-postgres-board", headers=group_headers).status_code == 404

    stale_save_response = client.post(
        "/api/v1/boards",
        headers=group_headers,
        json={
            "boardId": "api-postgres-board",
            "document": {"assets": [], "shapes": [{"id": "shape_stale"}]},
            "title": "Stale Save",
        },
    )
    assert stale_save_response.status_code == 404
    assert ("workspace_group", "api-postgres-board") in fake_db.deleted_boards


def test_board_postgres_requires_database_url(monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    client = TestClient(app)

    response = client.post(
        "/api/v1/boards",
        json={"boardId": "missing-db", "document": {"shapes": []}, "title": "Missing DB"},
    )

    assert response.status_code == 501
    assert "DATABASE_URL" in response.json()["detail"]


def test_board_guard_blocks_runtime_urls():
    client = TestClient(app)

    response = client.post(
        "/api/v1/boards/validate-document",
        json={"document": {"asset": "data:image/png;base64,AAAA"}},
    )

    assert response.status_code == 422
    assert response.json()["audit"]["issues"][0]["code"] == "runtime-url"


def test_board_guard_blocks_legacy_tldraw_documents():
    client = TestClient(app)
    legacy_document = {
        "camera": {"x": 0, "y": 0, "zoom": 1},
        "runtimeEdges": [],
        "shapes": [{"id": "shape_1", "type": "geo", "x": 0, "y": 0}],
        "version": 1,
    }

    validate_response = client.post("/api/v1/boards/validate-document", json={"document": legacy_document})

    assert validate_response.status_code == 422
    issues = validate_response.json()["audit"]["issues"]
    assert any(issue["code"] == "legacy-tldraw-document" for issue in issues)

    save_response = client.post(
        "/api/v1/boards",
        json={"boardId": "legacy-tldraw-board", "document": legacy_document, "title": "Legacy tldraw"},
    )

    assert save_response.status_code == 422
    assert save_response.json()["audit"]["ok"] is False


def test_board_metrics_support_konva_v2_document(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    client = TestClient(app)
    document = {
        "assets": [{"id": "asset_1", "type": "image"}, {"id": "asset_2", "type": "image"}],
        "canvasDocument": {
            "camera": {"x": 0, "y": 0, "zoom": 1},
            "id": "canvas-document-test",
            "metadata": {"createdAt": "2026-05-04T00:00:00Z", "updatedAt": "2026-05-04T00:00:00Z"},
            "runtimeEdges": [],
            "schemaVersion": 1,
            "shapes": [{"id": "shape_1", "props": {"height": 80, "width": 120}, "type": "rect", "x": 0, "y": 0}],
        },
        "renderer": "konva",
        "serializedAt": "2026-05-04T00:00:00Z",
        "version": 2,
    }

    save_response = client.post(
        "/api/v1/boards",
        json={"boardId": "api-konva-board", "document": document, "title": "Konva Board"},
    )

    assert save_response.status_code == 200
    saved = save_response.json()["board"]
    assert saved["assetCount"] == 2
    assert saved["shapeCount"] == 1

    snapshot_response = client.post(
        "/api/v1/boards/api-konva-board/snapshots",
        json={"document": document, "reason": "manual"},
    )

    assert snapshot_response.status_code == 200
    snapshot = snapshot_response.json()["snapshot"]
    assert snapshot["assetCount"] == 2
    assert snapshot["shapeCount"] == 1


def test_board_metrics_support_konva_v2_pages_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    client = TestClient(app)
    active_document = {
        "camera": {"x": 0, "y": 0, "zoom": 1},
        "id": "canvas-document-page-1",
        "metadata": {"createdAt": "2026-05-05T00:00:00Z", "updatedAt": "2026-05-05T00:00:00Z"},
        "runtimeEdges": [],
        "schemaVersion": 1,
        "shapes": [{"id": "shape_1", "props": {"height": 80, "width": 120}, "type": "rect", "x": 0, "y": 0}],
    }
    second_document = {
        "camera": {"x": 20, "y": 30, "zoom": 0.8},
        "id": "canvas-document-page-2",
        "metadata": {"createdAt": "2026-05-05T00:00:00Z", "updatedAt": "2026-05-05T00:00:00Z"},
        "runtimeEdges": [],
        "schemaVersion": 1,
        "shapes": [
            {"id": "shape_2", "props": {"height": 80, "width": 120}, "type": "rect", "x": 0, "y": 0},
            {"id": "shape_3", "props": {"height": 80, "width": 120}, "type": "rect", "x": 140, "y": 0},
        ],
    }
    document = {
        "activePageId": "page-1",
        "assets": [],
        "canvasDocument": active_document,
        "pages": [
            {
                "canvasDocument": active_document,
                "createdAt": "2026-05-05T00:00:00Z",
                "id": "page-1",
                "index": 0,
                "title": "Page 1",
                "updatedAt": "2026-05-05T00:00:00Z",
            },
            {
                "canvasDocument": second_document,
                "createdAt": "2026-05-05T00:00:00Z",
                "id": "page-2",
                "index": 1,
                "title": "Page 2",
                "updatedAt": "2026-05-05T00:00:00Z",
            },
        ],
        "renderer": "konva",
        "serializedAt": "2026-05-05T00:00:00Z",
        "version": 2,
    }

    save_response = client.post(
        "/api/v1/boards",
        json={"boardId": "api-konva-pages-board", "document": document, "title": "Konva Pages Board"},
    )

    assert save_response.status_code == 200
    saved = save_response.json()["board"]
    assert saved["shapeCount"] == 3


def test_board_guard_rejects_invalid_konva_v2_document(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    client = TestClient(app)
    invalid_document = {
        "assets": [{"id": "asset_1", "type": "image"}],
        "canvasDocument": {
            "camera": {"x": 0, "y": 0, "zoom": 1},
            "id": "canvas-document-invalid",
            "metadata": {"createdAt": "2026-05-05T00:00:00Z", "updatedAt": "2026-05-05T00:00:00Z"},
            "runtimeEdges": [
                {
                    "dataType": "image",
                    "id": "edge_1",
                    "sourcePortId": "image_out",
                    "sourceShapeId": "missing_source",
                    "targetPortId": "image_in_1",
                    "targetShapeId": "shape_1",
                }
            ],
            "schemaVersion": 1,
            "shapes": [{"id": "shape_1", "props": {"height": 0, "width": 120}, "type": "rect", "x": 0, "y": 0}],
        },
        "renderer": "konva",
        "serializedAt": "2026-05-05T00:00:00Z",
        "version": 2,
    }

    validate_response = client.post("/api/v1/boards/validate-document", json={"document": invalid_document})

    assert validate_response.status_code == 422
    issues = validate_response.json()["audit"]["issues"]
    assert any(issue["code"] == "konva-v2-invalid" and issue["path"].endswith(".height") for issue in issues)
    assert any(issue["code"] == "konva-v2-invalid" and issue["path"].endswith(".sourceShapeId") for issue in issues)

    save_response = client.post(
        "/api/v1/boards",
        json={"boardId": "api-invalid-konva-board", "document": invalid_document, "title": "Invalid Konva"},
    )

    assert save_response.status_code == 422
    assert save_response.json()["audit"]["ok"] is False


def test_board_guard_rejects_invalid_konva_v2_pages_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    client = TestClient(app)
    page_document = {
        "camera": {"x": 0, "y": 0, "zoom": 1},
        "id": "canvas-document-page-invalid",
        "metadata": {"createdAt": "2026-05-05T00:00:00Z", "updatedAt": "2026-05-05T00:00:00Z"},
        "runtimeEdges": [],
        "schemaVersion": 1,
        "shapes": [{"id": "shape_1", "props": {"height": 80, "width": 120}, "type": "rect", "x": 0, "y": 0}],
    }
    invalid_document = {
        "activePageId": "missing-page",
        "assets": [],
        "canvasDocument": page_document,
        "pages": [
            {
                "canvasDocument": page_document,
                "createdAt": "2026-05-05T00:00:00Z",
                "id": "page-1",
                "index": 0,
                "title": "Page 1",
                "updatedAt": "2026-05-05T00:00:00Z",
            }
        ],
        "renderer": "konva",
        "serializedAt": "2026-05-05T00:00:00Z",
        "version": 2,
    }

    response = client.post("/api/v1/boards/validate-document", json={"document": invalid_document})

    assert response.status_code == 422
    issues = response.json()["audit"]["issues"]
    assert any(issue["code"] == "konva-v2-invalid" and issue["path"] == "document.activePageId" for issue in issues)


def test_postgres_board_owner_is_preserved_on_collaborator_save(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()

    owner = make_context("user_owner", role="owner", workspace_id="workspace_group", workspace_kind="group_workspace")
    collaborator = make_context("user_editor", role="member", workspace_id="workspace_group", workspace_kind="group_workspace")

    store.save_board(
        BoardSaveRequest(
            boardId="shared_board",
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            title="Owner version",
        ),
        owner,
    )
    store.upsert_member("shared_board", "user_editor", "editor", "Editor", owner)
    store.save_board(
        BoardSaveRequest(
            boardId="shared_board",
            document={"assets": [], "shapes": [{"id": "shape_2"}]},
            title="Collaborator update",
        ),
        collaborator,
    )

    assert fake_db.boards[("workspace_group", "shared_board")][2] == "user_owner"


def test_postgres_board_save_rejects_deleted_workspace(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace", "status": "deleted"}]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()
    owner = make_context("user_owner", role="owner", workspace_id="workspace_group", workspace_kind="group_workspace")

    with pytest.raises(HTTPException) as save_error:
        store.save_board(
            BoardSaveRequest(
                boardId="deleted_workspace_board",
                document={"assets": [], "shapes": [{"id": "shape_1"}]},
                title="Deleted workspace board",
            ),
            owner,
        )

    assert save_error.value.status_code == 404
    assert fake_db.boards == {}


def test_postgres_board_guest_permissions_first_pass(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()

    owner = make_context("user_owner", role="owner", workspace_id="workspace_group", workspace_kind="group_workspace")
    guest = make_context("user_guest", role="guest", workspace_id="workspace_group", workspace_kind="group_workspace")

    store.save_board(
        BoardSaveRequest(
            boardId="private_board",
            document={"assets": [], "shapes": [{"id": "shape_private"}]},
            title="Private board",
        ),
        owner,
    )

    with pytest.raises(HTTPException) as create_error:
        store.save_board(
            BoardSaveRequest(
                boardId="guest_new_board",
                document={"assets": [], "shapes": [{"id": "shape_guest"}]},
                title="Guest board",
            ),
            guest,
        )
    assert create_error.value.status_code == 403

    assert store.list_boards(guest) == []

    store.update_board_metadata("private_board", None, None, None, None, None, None, "public", None, owner)
    assert store.list_boards(guest) == []

    with pytest.raises(HTTPException) as save_error:
        store.save_board(
            BoardSaveRequest(
                boardId="private_board",
                document={"assets": [], "shapes": [{"id": "shape_guest_update"}]},
                title="Guest update",
            ),
            guest,
        )
    assert save_error.value.status_code == 403

    with pytest.raises(HTTPException) as manage_error:
        store.delete_board("private_board", guest)
    assert manage_error.value.status_code == 404


def test_postgres_board_member_roles_enable_guest_access_first_pass(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()

    owner = make_context("user_owner", role="owner", workspace_id="workspace_group", workspace_kind="group_workspace")
    guest = make_context("user_guest", role="guest", workspace_id="workspace_group", workspace_kind="group_workspace")

    store.save_board(
        BoardSaveRequest(
            boardId="shared_private_board",
            document={"assets": [], "shapes": [{"id": "shape_owner"}]},
            title="Shared private board",
        ),
        owner,
    )

    with pytest.raises(HTTPException) as missing_access:
        store.load_board("shared_private_board", guest)
    assert missing_access.value.status_code == 404

    member = store.upsert_member("shared_private_board", "user_guest", "viewer", "Guest Viewer", owner)
    assert member.role == "viewer"

    visible = store.load_board("shared_private_board", guest)
    assert visible.id == "shared_private_board"
    assert [board.id for board in store.list_boards(guest)] == ["shared_private_board"]

    with pytest.raises(HTTPException) as viewer_write_error:
        store.save_board(
            BoardSaveRequest(
                boardId="shared_private_board",
                document={"assets": [], "shapes": [{"id": "shape_guest_edit"}]},
                title="Guest edit blocked",
            ),
            guest,
        )
    assert viewer_write_error.value.status_code == 403

    promoted = store.upsert_member("shared_private_board", "user_guest", "editor", "Guest Editor", owner)
    assert promoted.role == "editor"

    saved = store.save_board(
        BoardSaveRequest(
            boardId="shared_private_board",
            document={"assets": [], "shapes": [{"id": "shape_guest_edit"}]},
            title="Guest edit allowed",
        ),
        guest,
    )
    assert saved.ok is True

    with pytest.raises(HTTPException) as editor_manage_error:
        store.delete_board("shared_private_board", guest)
    assert editor_manage_error.value.status_code == 403


def test_postgres_snapshots_require_board_write_or_manage_access(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres", fake_db.connect)
    snapshot_store = PostgresBoardSnapshotStore()
    board_store = PostgresBoardStore()

    owner = make_context("user_owner", role="owner", workspace_id="workspace_group", workspace_kind="group_workspace")
    guest = make_context("user_guest", role="guest", workspace_id="workspace_group", workspace_kind="group_workspace")

    board_store.save_board(
        BoardSaveRequest(
            boardId="snapshot_board",
            document={"assets": [], "shapes": [{"id": "shape_public"}]},
            title="Snapshot board",
        ),
        owner,
    )
    board_store.update_board_metadata("snapshot_board", None, None, None, None, None, None, "public", None, owner)

    snapshot = snapshot_store.create_snapshot(
        "snapshot_board",
        BoardSnapshotCreateRequest(
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            reason="manual_save",
            title="Owner save",
        ),
        owner,
    )
    assert snapshot.board_id == "snapshot_board"

    with pytest.raises(HTTPException) as guest_create_error:
        snapshot_store.create_snapshot(
            "snapshot_board",
            BoardSnapshotCreateRequest(
                document={"assets": [], "shapes": [{"id": "shape_2"}]},
                reason="manual_save",
                title="Guest save",
            ),
            guest,
        )
    assert guest_create_error.value.status_code == 403

    assert snapshot_store.list_snapshots("snapshot_board", guest) == []

    with pytest.raises(HTTPException) as guest_clear_error:
        snapshot_store.clear_snapshots("snapshot_board", guest)
    assert guest_clear_error.value.status_code == 403


def make_context(
    user_id: str,
    role: str = "owner",
    workspace_id: str = "dev-workspace",
    workspace_kind: str = "solo_workspace",
) -> ApiRequestContext:
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
        workspace_kind=workspace_kind,
        workspace_name="Dev Workspace",
        workspace_role=role,
    )


def test_board_list_cursor_pagination_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    client = TestClient(app)

    for board_id in ["board_a", "board_b", "board_c"]:
        response = client.post(
            "/api/v1/boards",
            json={"boardId": board_id, "document": {"assets": [], "shapes": [{"id": board_id}]}, "title": board_id},
        )
        assert response.status_code == 200

    first_page = client.get("/api/v1/boards?limit=2")
    assert first_page.status_code == 200
    first_payload = first_page.json()
    assert len(first_payload["boards"]) == 2
    assert first_payload["nextCursor"] is not None

    second_page = client.get(f"/api/v1/boards?limit=2&cursor={first_payload['nextCursor']}")
    assert second_page.status_code == 200
    second_payload = second_page.json()
    assert len(second_payload["boards"]) == 1
    assert second_payload["nextCursor"] is None


def test_board_postgres_copy_and_restore_contract(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={"boardId": "restore_board", "document": {"assets": [], "shapes": [{"id": "shape_1"}]}, "title": "Restore Board"},
    )
    assert save_response.status_code == 200

    snapshot_response = client.post(
        "/api/v1/boards/restore_board/snapshots",
        json={"document": {"assets": [], "shapes": [{"id": "shape_old"}]}, "reason": "manual_save", "title": "Old"},
    )
    assert snapshot_response.status_code == 200
    source_snapshot_id = snapshot_response.json()["snapshot"]["id"]

    update_response = client.post(
        "/api/v1/boards",
        json={"boardId": "restore_board", "document": {"assets": [], "shapes": [{"id": "shape_new"}]}, "title": "Restore Board"},
    )
    assert update_response.status_code == 200

    restore_response = client.post(
        "/api/v1/boards/restore_board/restore",
        json={"snapshotId": source_snapshot_id},
    )
    assert restore_response.status_code == 200
    restored = restore_response.json()
    assert restored["sourceSnapshotId"] == source_snapshot_id
    assert restored["preRestoreSnapshotId"] is not None
    assert restored["board"]["document"] == {"assets": [], "shapes": [{"id": "shape_old"}]}

    copied = client.post("/api/v1/boards/restore_board/copy")
    assert copied.status_code == 200
    copied_board = copied.json()["board"]
    assert copied_board["id"] != "restore_board"
    assert copied_board["title"].endswith("Copy")


def test_board_members_scaffold_contract(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "dev-workspace", "kind": "group_workspace"}]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setenv("TANGENT_DEV_WORKSPACE_KIND", "group_workspace")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={"boardId": "members_board", "document": {"assets": [], "shapes": [{"id": "shape_1"}]}, "title": "Members Board"},
    )
    assert save_response.status_code == 200

    members = client.get("/api/v1/boards/members_board/members")
    assert members.status_code == 200
    assert [member["role"] for member in members.json()["members"]] == ["owner"]

    created = client.post(
        "/api/v1/boards/members_board/members",
        json={"userId": "user_member_2", "role": "viewer", "displayName": "Second User"},
    )
    assert created.status_code == 200
    assert created.json()["member"]["userId"] == "user_member_2"

    updated = client.patch(
        "/api/v1/boards/members_board/members/user_member_2",
        json={"role": "editor", "displayName": "Second User"},
    )
    assert updated.status_code == 200
    assert updated.json()["member"]["role"] == "editor"

    deleted = client.delete("/api/v1/boards/members_board/members/user_member_2")
    assert deleted.status_code == 200
    assert deleted.json()["userId"] == "user_member_2"


def test_board_member_candidates_invite_and_share_link_contract(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    fake_db.users = [
        {
            "id": "dev-user",
            "email": "dev@tangent.local",
            "display_name": "Dev User",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:00:00Z",
            "last_login_at": None,
        },
        {
            "id": "user_alice",
            "email": "alice@example.com",
            "display_name": "Alice Artist",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:01:00Z",
            "last_login_at": None,
        },
        {
            "id": "user_bob",
            "email": "bob@example.com",
            "display_name": "Bob Builder",
            "status": "active",
            "locale": "en",
            "created_at": "2026-05-05T00:02:00Z",
            "last_login_at": None,
        },
    ]
    fake_db.workspace_members = [
        {"workspace_id": "workspace_group", "user_id": "dev-user", "role": "owner", "display_name": "Dev User"},
        {"workspace_id": "workspace_group", "user_id": "user_alice", "role": "member", "display_name": "Alice Artist"},
        {"workspace_id": "workspace_group", "user_id": "user_bob", "role": "guest", "display_name": "Bob Builder"},
    ]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)
    headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
    }

    saved = client.post(
        "/api/v1/boards",
        headers=headers,
        json={"boardId": "share_board", "document": {"assets": [], "shapes": [{"id": "shape_1"}]}, "title": "Share Board"},
    )
    assert saved.status_code == 200
    visibility = client.patch(
        "/api/v1/boards/share_board",
        headers=headers,
        json={"visibility": "workspace"},
    )
    assert visibility.status_code == 200

    candidates = client.get("/api/v1/boards/share_board/member-candidates?query=ali", headers=headers)
    assert candidates.status_code == 200
    assert candidates.json()["candidates"] == [
        {
            "alreadyMember": False,
            "boardRole": None,
            "displayName": "Alice Artist",
            "email": "alice@example.com",
            "userId": "user_alice",
            "workspaceRole": "member",
        }
    ]

    invited = client.post(
        "/api/v1/boards/share_board/members",
        headers=headers,
        json={"userId": "user_alice", "role": "viewer", "displayName": "Alice Artist"},
    )
    assert invited.status_code == 200
    assert invited.json()["member"] == {
        "displayName": "Alice Artist",
        "email": "alice@example.com",
        "invitedBy": "dev-user",
        "joinedAt": "2026-05-05T00:00:01Z",
        "role": "viewer",
        "userId": "user_alice",
        "workspaceRole": "member",
    }

    members = client.get("/api/v1/boards/share_board/members", headers=headers)
    assert members.status_code == 200
    assert [member["userId"] for member in members.json()["members"]] == ["dev-user", "user_alice"]

    share = client.post(
        "/api/v1/boards/share_board/share-link",
        headers=headers,
        json={"accessRole": "viewer", "expiresAt": "2999-01-01T00:00:00Z"},
    )
    assert share.status_code == 200
    share_link = share.json()["shareLink"]
    assert share_link["boardId"] == "share_board"
    assert share_link["workspaceId"] == "workspace_group"
    assert share_link["accessRole"] == "viewer"
    assert share_link["expiresAt"] == "2999-01-01T00:00:00+00:00"
    assert share_link["shareId"] is not None

    resolved = client.get(f"/api/v1/boards/share-links/{share_link['shareId']}")
    assert resolved.status_code == 200
    assert resolved.json()["shareLink"] == {
        "accessRole": "viewer",
        "boardId": "share_board",
        "boardTitle": "Share Board",
        "shareId": share_link["shareId"],
        "workspaceId": "workspace_group",
    }

    shared_board = client.get(f"/api/v1/boards/share-links/{share_link['shareId']}/board")
    assert shared_board.status_code == 200
    assert shared_board.json()["board"]["id"] == "share_board"
    assert shared_board.json()["board"]["title"] == "Share Board"
    assert shared_board.json()["board"]["document"] == {"assets": [], "shapes": [{"id": "shape_1"}]}

    revoked = client.delete(f"/api/v1/boards/share_board/share-link/{share_link['shareId']}", headers=headers)
    assert revoked.status_code == 200
    assert revoked.json()["shareId"] == share_link["shareId"]

    missing = client.get(f"/api/v1/boards/share-links/{share_link['shareId']}")
    assert missing.status_code == 404
