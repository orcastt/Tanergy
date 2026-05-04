from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_board_local_dev_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
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
    assert saved["workspaceId"] == "dev-workspace"
    assert "document" not in saved

    load_response = client.get("/api/v1/boards/api-smoke-board")
    assert load_response.status_code == 200
    loaded = load_response.json()["board"]
    assert loaded["assetCount"] == 1
    assert loaded["document"] == {"assets": [{"id": "asset_1"}], "shapes": [{"id": "shape_1"}, {"id": "shape_2"}]}
    assert loaded["lastOpenedAt"] is not None
    assert loaded["shapeCount"] == 2
    assert loaded["workspaceId"] == "dev-workspace"

    list_response = client.get("/api/v1/boards")
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

    snapshot_list = client.get("/api/v1/boards/api-smoke-board/snapshots")
    assert snapshot_list.status_code == 200
    assert [item["id"] for item in snapshot_list.json()["snapshots"]] == [snapshot["id"]]

    snapshot_load = client.get(f"/api/v1/boards/api-smoke-board/snapshots/{snapshot['id']}")
    assert snapshot_load.status_code == 200
    assert snapshot_load.json()["snapshot"]["document"] == {"assets": [{"id": "asset_1"}], "shapes": [{"id": "shape_1"}]}
    assert snapshot_load.json()["snapshot"]["thumbnailUrl"] == "https://example.com/history-thumb.webp"

    monkeypatch.setenv("TANGENT_FREE_BOARD_SNAPSHOT_LIMIT", "2")
    for index in range(2):
        response = client.post(
            "/api/v1/boards/api-smoke-board/snapshots",
            json={"document": {"assets": [], "shapes": [{"id": f"shape_{index}"}]}, "reason": "autosave"},
        )
        assert response.status_code == 200
    snapshot_list = client.get("/api/v1/boards/api-smoke-board/snapshots")
    assert snapshot_list.status_code == 200
    snapshots = snapshot_list.json()["snapshots"]
    assert len(snapshots) == 3
    assert [item["reason"] for item in snapshots].count("autosave") == 2
    assert [item["reason"] for item in snapshots].count("manual_save") == 1

    clear_snapshots = client.delete("/api/v1/boards/api-smoke-board/snapshots")
    assert clear_snapshots.status_code == 200
    assert clear_snapshots.json()["deletedCount"] == 3
    snapshot_list = client.get("/api/v1/boards/api-smoke-board/snapshots")
    assert snapshot_list.status_code == 200
    assert snapshot_list.json()["snapshots"] == []

    rename_response = client.patch("/api/v1/boards/api-smoke-board", json={"title": "Renamed Board"})
    assert rename_response.status_code == 200
    renamed = rename_response.json()["board"]
    assert renamed["title"] == "Renamed Board"
    assert "document" not in renamed

    metadata_response = client.patch(
        "/api/v1/boards/api-smoke-board",
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

    empty_rename = client.patch("/api/v1/boards/api-smoke-board", json={"title": " "})
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

    delete_response = client.delete("/api/v1/boards/api-smoke-board")
    assert delete_response.status_code == 200
    assert delete_response.json()["boardId"] == "api-smoke-board"
    assert client.get("/api/v1/boards/api-smoke-board").status_code == 404


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

    save_response = client.post(
        "/api/v1/boards",
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
    assert saved["workspaceId"] == "dev-workspace"
    assert "document" not in saved
    assert ("dev-workspace", "api-postgres-board") in fake_db.boards

    load_response = client.get("/api/v1/boards/api-postgres-board")
    assert load_response.status_code == 200
    loaded = load_response.json()["board"]
    assert loaded["assetCount"] == 2
    assert loaded["document"] == {"assets": [{"id": "asset_1"}, {"id": "asset_2"}], "shapes": [{"id": "shape_1"}]}
    assert loaded["lastOpenedAt"] is not None
    assert loaded["shapeCount"] == 1
    assert loaded["title"] == "Postgres Board"

    list_response = client.get("/api/v1/boards")
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
    assert ("dev-workspace", "api-postgres-board", snapshot["id"]) in fake_db.snapshots

    snapshot_list = client.get("/api/v1/boards/api-postgres-board/snapshots")
    assert snapshot_list.status_code == 200
    assert [item["id"] for item in snapshot_list.json()["snapshots"]] == [snapshot["id"]]

    snapshot_load = client.get(f"/api/v1/boards/api-postgres-board/snapshots/{snapshot['id']}")
    assert snapshot_load.status_code == 200
    assert snapshot_load.json()["snapshot"]["document"] == {"assets": [{"id": "asset_1"}], "shapes": [{"id": "shape_1"}]}
    assert snapshot_load.json()["snapshot"]["thumbnailUrl"] == "https://example.com/keyboard-history.webp"

    monkeypatch.setenv("TANGENT_FREE_BOARD_SNAPSHOT_LIMIT", "2")
    for index in range(2):
        response = client.post(
            "/api/v1/boards/api-postgres-board/snapshots",
            json={"document": {"assets": [], "shapes": [{"id": f"shape_{index}"}]}, "reason": "autosave"},
        )
        assert response.status_code == 200
    snapshot_list = client.get("/api/v1/boards/api-postgres-board/snapshots")
    assert snapshot_list.status_code == 200
    snapshots = snapshot_list.json()["snapshots"]
    assert len(snapshots) == 3
    assert [item["reason"] for item in snapshots].count("autosave") == 2
    assert [item["reason"] for item in snapshots].count("keyboard") == 1

    clear_snapshots = client.delete("/api/v1/boards/api-postgres-board/snapshots")
    assert clear_snapshots.status_code == 200
    assert clear_snapshots.json()["deletedCount"] == 3
    assert fake_db.snapshots == {}
    snapshot_list = client.get("/api/v1/boards/api-postgres-board/snapshots")
    assert snapshot_list.status_code == 200
    assert snapshot_list.json()["snapshots"] == []

    rename_response = client.patch("/api/v1/boards/api-postgres-board", json={"title": "Renamed Postgres"})
    assert rename_response.status_code == 200
    assert rename_response.json()["board"]["title"] == "Renamed Postgres"
    assert fake_db.boards[("dev-workspace", "api-postgres-board")][3] == "Renamed Postgres"

    metadata_response = client.patch(
        "/api/v1/boards/api-postgres-board",
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
    assert fake_db.boards[("dev-workspace", "api-postgres-board")][8] == "Launch wall"
    assert fake_db.boards[("dev-workspace", "api-postgres-board")][9] == "peach"
    assert fake_db.boards[("dev-workspace", "api-postgres-board")][14] is True
    assert fake_db.boards[("dev-workspace", "api-postgres-board")][15] is True

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

    delete_response = client.delete("/api/v1/boards/api-postgres-board")
    assert delete_response.status_code == 200
    assert delete_response.json()["boardId"] == "api-postgres-board"
    assert ("dev-workspace", "api-postgres-board") not in fake_db.boards


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


def test_board_metrics_support_konva_v2_document(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    client = TestClient(app)
    document = {
        "assets": [{"id": "asset_1"}, {"id": "asset_2"}],
        "canvasDocument": {
            "camera": {"x": 0, "y": 0, "zoom": 1},
            "id": "canvas-document-test",
            "metadata": {"createdAt": "2026-05-04T00:00:00Z", "updatedAt": "2026-05-04T00:00:00Z"},
            "runtimeEdges": [],
            "schemaVersion": 1,
            "shapes": [{"id": "shape_1", "props": {}, "type": "rect", "x": 0, "y": 0}],
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
