import json

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardSaveRequest
from tangent_api.security_events import list_recent_security_events, reset_security_events
from tangent_api.security_rate_limit import reset_http_rate_limit_state
from tangent_api.security_share_password import reset_share_password_attempt_state
from tangent_api.storage.postgres_board_store import PostgresBoardStore
from tests.persistence_fakes import FakePostgresDatabase


def test_postgres_share_password_revoke_and_regenerate_contract(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()
    owner = _context("user_owner")

    store.save_board(
        BoardSaveRequest(
            boardId="share_security_board",
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            title="Share Security Board",
        ),
        owner,
    )

    share = store.ensure_share_link("share_security_board", "viewer", owner, password="canvas secret")

    assert share.password_protected is True
    assert fake_db.board_share_links[0]["password_hash"]
    assert "canvas secret" not in fake_db.board_share_links[0]["password_hash"]
    with pytest.raises(HTTPException) as missing_password:
        store.resolve_share_link(share.share_id)
    assert missing_password.value.status_code == 401
    with pytest.raises(HTTPException) as wrong_password:
        store.load_shared_board(share.share_id, "wrong secret")
    assert wrong_password.value.status_code == 401
    assert store.resolve_share_link(share.share_id, "canvas secret").password_protected is True
    assert store.load_shared_board(share.share_id, "canvas secret").id == "share_security_board"

    regenerated = store.ensure_share_link(
        "share_security_board",
        "viewer",
        owner,
        password="rotated secret",
        regenerate=True,
    )

    assert regenerated.share_id != share.share_id
    assert fake_db.board_share_links[0]["revoked_at"] is not None
    with pytest.raises(HTTPException) as old_share:
        store.resolve_share_link(share.share_id, "canvas secret")
    assert old_share.value.status_code == 404
    assert store.resolve_share_link(regenerated.share_id, "rotated secret").board_id == "share_security_board"

    assert store.revoke_share_link("share_security_board", regenerated.share_id, owner) == regenerated.share_id
    with pytest.raises(HTTPException) as revoked_share:
        store.resolve_share_link(regenerated.share_id, "rotated secret")
    assert revoked_share.value.status_code == 404


def test_public_share_routes_require_password_header(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)
    headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
    }

    assert client.post(
        "/api/v1/boards",
        headers=headers,
        json={"boardId": "share_route_board", "document": {"assets": [], "shapes": []}, "title": "Route Share"},
    ).status_code == 200
    share = client.post(
        "/api/v1/boards/share_route_board/share-link",
        headers=headers,
        json={"accessRole": "viewer", "password": "route secret"},
    ).json()["shareLink"]

    assert share["passwordProtected"] is True
    assert client.get(f"/api/v1/boards/share-links/{share['shareId']}").status_code == 401
    resolved = client.get(
        f"/api/v1/boards/share-links/{share['shareId']}",
        headers={"x-tangent-share-password": "route secret"},
    )
    loaded = client.get(
        f"/api/v1/boards/share-links/{share['shareId']}/board",
        headers={"x-tangent-share-password": "route secret"},
    )

    assert resolved.status_code == 200
    assert resolved.json()["shareLink"]["passwordProtected"] is True
    assert loaded.status_code == 200
    assert loaded.json()["board"]["id"] == "share_route_board"


def test_public_share_password_attempts_are_limited_per_share(monkeypatch):
    reset_http_rate_limit_state()
    reset_share_password_attempt_state()
    reset_security_events()
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "0")
    monkeypatch.setenv("TANGENT_SECURITY_REDIS_ENABLED", "0")
    monkeypatch.setenv("TANGENT_SHARE_PASSWORD_ATTEMPT_LIMIT", "1")
    monkeypatch.setenv("TANGENT_SHARE_PASSWORD_ATTEMPT_WINDOW_SECONDS", "60")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)
    headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
    }

    assert client.post(
        "/api/v1/boards",
        headers=headers,
        json={"boardId": "share_password_limit_board", "document": {"assets": [], "shapes": []}, "title": "Limit"},
    ).status_code == 200
    share = client.post(
        "/api/v1/boards/share_password_limit_board/share-link",
        headers=headers,
        json={"accessRole": "viewer", "password": "correct secret"},
    ).json()["shareLink"]

    first = client.get(
        f"/api/v1/boards/share-links/{share['shareId']}",
        headers={"x-tangent-share-password": "wrong secret"},
    )
    limited = client.get(
        f"/api/v1/boards/share-links/{share['shareId']}",
        headers={"x-tangent-share-password": "correct secret"},
    )

    assert first.status_code == 401
    assert limited.status_code == 429
    assert limited.headers["retry-after"]
    last_event = list_recent_security_events()[-1]
    assert last_event["reason"] == "share_password_attempt_limit_exceeded"
    assert share["shareId"] not in str(last_event["metadata"])
    reset_share_password_attempt_state()


def test_local_legacy_share_without_new_fields_still_resolves(tmp_path, monkeypatch):
    storage_root = tmp_path / "boards"
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(storage_root))
    client = TestClient(app)
    headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
    }

    assert client.post(
        "/api/v1/boards",
        headers=headers,
        json={"boardId": "local_legacy_share", "document": {"assets": [], "shapes": []}, "title": "Legacy Share"},
    ).status_code == 200
    shares_path = storage_root / "boards" / "local_legacy_share.shares.json"
    shares_path.write_text(
        json.dumps(
            [
                {
                    "accessRole": "viewer",
                    "boardId": "local_legacy_share",
                    "createdAt": "2026-05-19T00:00:00Z",
                    "createdBy": "dev-user",
                    "id": "board_share_legacy",
                    "shareId": "legacy123",
                    "workspaceId": "workspace_group",
                }
            ]
        ),
        encoding="utf-8",
    )

    resolved = client.get("/api/v1/boards/share-links/legacy123")

    assert resolved.status_code == 200
    assert resolved.json()["shareLink"]["passwordProtected"] is False


def _context(user_id: str) -> ApiRequestContext:
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email=f"{user_id}@example.com",
        user_email_verified=True,
        user_id=user_id,
        workspace_board_count=0,
        workspace_id="workspace_group",
        workspace_kind="group_workspace",
        workspace_name="Group Workspace",
        workspace_role="owner",
    )
