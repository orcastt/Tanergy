from fastapi.testclient import TestClient

from tangent_api.main import app
from tests.persistence_fakes import FakePostgresDatabase


def test_board_routes_are_scoped_to_request_workspace(monkeypatch):
    fake_db = _setup_postgres_board_env(monkeypatch)
    client = TestClient(app)
    owner_headers = _headers("user_owner", "workspace_alpha", "owner")
    attacker_headers = _headers("user_attacker", "workspace_beta", "owner")

    saved = client.post(
        "/api/v1/boards",
        headers=owner_headers,
        json={"boardId": "shared_slug_board", "document": {"assets": [], "shapes": []}, "title": "Private"},
    )
    assert saved.status_code == 200
    snapshot = client.post(
        "/api/v1/boards/shared_slug_board/snapshots",
        headers=owner_headers,
        json={"document": {"assets": [], "shapes": [{"id": "shape_1"}]}, "reason": "manual_save"},
    ).json()["snapshot"]
    share = client.post(
        "/api/v1/boards/shared_slug_board/share-link",
        headers=owner_headers,
        json={"accessRole": "viewer"},
    ).json()["shareLink"]

    assert client.get("/api/v1/boards/shared_slug_board", headers=attacker_headers).status_code == 404
    assert client.patch(
        "/api/v1/boards/shared_slug_board",
        headers=attacker_headers,
        json={"title": "Stolen"},
    ).status_code == 404
    assert client.delete("/api/v1/boards/shared_slug_board", headers=attacker_headers).status_code == 404
    assert client.post("/api/v1/boards/shared_slug_board/copy", headers=attacker_headers).status_code == 404
    assert client.post(
        "/api/v1/boards/shared_slug_board/snapshots",
        headers=attacker_headers,
        json={"document": {"assets": [], "shapes": []}, "reason": "manual_save"},
    ).status_code == 404
    assert client.get("/api/v1/boards/shared_slug_board/snapshots", headers=attacker_headers).json()["snapshots"] == []
    assert client.get(
        f"/api/v1/boards/shared_slug_board/snapshots/{snapshot['id']}",
        headers=attacker_headers,
    ).status_code == 404
    assert client.post(
        "/api/v1/boards/shared_slug_board/restore",
        headers=attacker_headers,
        json={"snapshotId": snapshot["id"]},
    ).status_code == 404
    assert client.delete("/api/v1/boards/shared_slug_board/snapshots", headers=attacker_headers).status_code == 404
    assert client.get("/api/v1/boards/shared_slug_board/collaboration", headers=attacker_headers).status_code == 404
    assert client.get("/api/v1/boards/shared_slug_board/members", headers=attacker_headers).status_code == 404
    assert client.get(
        "/api/v1/boards/shared_slug_board/member-candidates?query=target",
        headers=attacker_headers,
    ).status_code == 404
    assert client.post(
        "/api/v1/boards/shared_slug_board/members",
        headers=attacker_headers,
        json={"displayName": "Target", "role": "viewer", "userId": "user_target"},
    ).status_code == 404
    assert client.patch(
        "/api/v1/boards/shared_slug_board/members/user_target",
        headers=attacker_headers,
        json={"role": "editor"},
    ).status_code == 404
    assert client.delete(
        "/api/v1/boards/shared_slug_board/members/user_target",
        headers=attacker_headers,
    ).status_code == 404
    assert client.delete(
        f"/api/v1/boards/shared_slug_board/share-link/{share['shareId']}",
        headers=attacker_headers,
    ).status_code == 404
    assert ("workspace_alpha", "shared_slug_board") in fake_db.boards


def test_board_viewer_cannot_escalate_to_write_or_manage_routes(monkeypatch):
    _setup_postgres_board_env(monkeypatch)
    client = TestClient(app)
    owner_headers = _headers("user_owner", "workspace_alpha", "owner")
    viewer_headers = _headers("user_viewer", "workspace_alpha", "viewer")

    assert client.post(
        "/api/v1/boards",
        headers=owner_headers,
        json={"boardId": "viewer_locked_board", "document": {"assets": [], "shapes": []}, "title": "Locked"},
    ).status_code == 200
    assert client.post(
        "/api/v1/boards/viewer_locked_board/members",
        headers=owner_headers,
        json={"displayName": "Viewer", "role": "viewer", "userId": "user_viewer"},
    ).status_code == 200
    snapshot = client.post(
        "/api/v1/boards/viewer_locked_board/snapshots",
        headers=owner_headers,
        json={"document": {"assets": [], "shapes": [{"id": "shape_1"}]}, "reason": "manual_save"},
    ).json()["snapshot"]

    assert client.get("/api/v1/boards/viewer_locked_board", headers=viewer_headers).status_code == 200
    assert client.get("/api/v1/boards/viewer_locked_board/members", headers=viewer_headers).status_code == 200
    assert client.get(
        "/api/v1/boards/viewer_locked_board/member-candidates?query=view",
        headers=viewer_headers,
    ).status_code == 403
    assert client.patch(
        "/api/v1/boards/viewer_locked_board",
        headers=viewer_headers,
        json={"title": "Viewer rename"},
    ).status_code == 403
    assert client.post(
        "/api/v1/boards/viewer_locked_board/snapshots",
        headers=viewer_headers,
        json={"document": {"assets": [], "shapes": []}, "reason": "manual_save"},
    ).status_code == 403
    assert client.post(
        "/api/v1/boards/viewer_locked_board/restore",
        headers=viewer_headers,
        json={"snapshotId": snapshot["id"]},
    ).status_code == 403
    assert client.post(
        "/api/v1/boards/viewer_locked_board/members",
        headers=viewer_headers,
        json={"displayName": "Escalated", "role": "admin", "userId": "user_viewer"},
    ).status_code == 403
    assert client.patch(
        "/api/v1/boards/viewer_locked_board/members/user_viewer",
        headers=viewer_headers,
        json={"role": "admin"},
    ).status_code == 403
    assert client.delete(
        "/api/v1/boards/viewer_locked_board/members/user_viewer",
        headers=viewer_headers,
    ).status_code == 403
    assert client.post(
        "/api/v1/boards/viewer_locked_board/share-link",
        headers=viewer_headers,
        json={"accessRole": "editor"},
    ).status_code == 403
    assert client.delete("/api/v1/boards/viewer_locked_board", headers=viewer_headers).status_code == 403


def _setup_postgres_board_env(monkeypatch) -> FakePostgresDatabase:
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {"id": "workspace_alpha", "kind": "group_workspace"},
        {"id": "workspace_beta", "kind": "group_workspace"},
    ]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    monkeypatch.setenv("TANGENT_SECURITY_PERSISTENCE_ENABLED", "0")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_collaboration_store.connect_to_postgres", fake_db.connect)
    return fake_db


def _headers(user_id: str, workspace_id: str, role: str) -> dict[str, str]:
    return {
        "x-tangent-user-id": user_id,
        "x-tangent-workspace-id": workspace_id,
        "x-tangent-workspace-kind": "group_workspace",
        "x-tangent-workspace-role": role,
    }
