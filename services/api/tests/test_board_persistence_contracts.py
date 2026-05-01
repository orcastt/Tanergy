from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


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


def test_board_postgres_contract(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr(
        "tangent_api.storage.postgres_board_store.connect_to_postgres",
        fake_db.connect,
    )
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "api-postgres-board",
            "document": {"shapes": [{"id": "shape_1"}]},
            "title": "Postgres Board",
        },
    )

    assert save_response.status_code == 200
    saved = save_response.json()["board"]
    assert saved["workspaceId"] == "dev-workspace"
    assert "document" not in saved
    assert ("dev-workspace", "api-postgres-board") in fake_db.boards

    load_response = client.get("/api/v1/boards/api-postgres-board")
    assert load_response.status_code == 200
    loaded = load_response.json()["board"]
    assert loaded["document"] == {"shapes": [{"id": "shape_1"}]}
    assert loaded["title"] == "Postgres Board"

    blocked = client.get(
        "/api/v1/boards/api-postgres-board",
        headers={"x-tangent-user-id": "dev-user", "x-tangent-workspace-id": "other-workspace"},
    )
    assert blocked.status_code == 404


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
