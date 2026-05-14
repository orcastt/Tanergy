import pytest
from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardSaveRequest, BoardSnapshotCreateRequest
from tangent_api.storage.postgres_board_snapshot_store import PostgresBoardSnapshotStore
from tangent_api.storage.postgres_board_store import PostgresBoardStore
from tests.persistence_fakes import FakePostgresDatabase


def test_board_copy_and_delete_are_owner_only(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()

    owner = make_context("user_owner", role="owner")
    workspace_admin = make_context("user_workspace_admin", role="admin")
    workspace_member = make_context("user_workspace_member", role="member")
    board_admin = make_context("user_board_admin", role="guest")

    store.save_board(
        BoardSaveRequest(
            boardId="owner_only_board",
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            title="Owner Only Board",
        ),
        owner,
    )
    store.upsert_member("owner_only_board", "user_board_admin", "admin", "Board Admin", owner)

    store.update_board_metadata(
        "owner_only_board",
        "Managed title",
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        board_admin,
    )

    for context in [workspace_admin, workspace_member, board_admin]:
        with pytest.raises(HTTPException) as copy_error:
            store.copy_board("owner_only_board", context)
        assert copy_error.value.status_code == 403

        with pytest.raises(HTTPException) as delete_error:
            store.delete_board("owner_only_board", context)
        assert delete_error.value.status_code == 403

    copied = store.copy_board("owner_only_board", owner)
    assert copied.id != "owner_only_board"
    assert copied.title == "Managed title Copy"

    deleted_id = store.delete_board("owner_only_board", owner)
    assert deleted_id == "owner_only_board"
    assert ("dev-workspace", "owner_only_board") not in fake_db.boards


def test_solo_workspace_owner_can_copy_and_delete_stale_owned_board(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()

    original_owner = make_context("user_original_owner", role="owner")
    solo_workspace_owner = make_context("user_workspace_owner", role="owner")

    store.save_board(
        BoardSaveRequest(
            boardId="stale_private_board",
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            title="Stale Private Board",
        ),
        original_owner,
    )

    copied = store.copy_board("stale_private_board", solo_workspace_owner)
    assert copied.id != "stale_private_board"
    assert copied.title == "Stale Private Board Copy"

    deleted_id = store.delete_board("stale_private_board", solo_workspace_owner)
    assert deleted_id == "stale_private_board"
    assert ("dev-workspace", "stale_private_board") not in fake_db.boards


def test_expired_share_link_blocks_resolve_and_shared_board_load(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()
    owner = make_context("user_owner", role="owner")

    store.save_board(
        BoardSaveRequest(
            boardId="expiring_share_board",
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            title="Expiring Share Board",
        ),
        owner,
    )
    expired_share = store.ensure_share_link("expiring_share_board", "viewer", owner, "2999-01-01T00:00:00Z")
    assert expired_share.expires_at == "2999-01-01T00:00:00+00:00"
    fake_db.board_share_links[0]["expires_at"] = "2000-01-01T00:00:00Z"

    with pytest.raises(HTTPException) as resolve_error:
        store.resolve_share_link(expired_share.share_id)
    assert resolve_error.value.status_code == 404

    with pytest.raises(HTTPException) as load_error:
        store.load_shared_board(expired_share.share_id)
    assert load_error.value.status_code == 404

    active_share = store.ensure_share_link("expiring_share_board", "viewer", owner, "2999-01-02T00:00:00Z")
    assert active_share.share_id != expired_share.share_id
    assert len(fake_db.board_share_links) == 2
    assert store.resolve_share_link(active_share.share_id).board_id == "expiring_share_board"
    assert store.load_shared_board(active_share.share_id).id == "expiring_share_board"


def test_effective_permission_resolver_allows_editor_snapshots_but_not_manage(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres", fake_db.connect)
    board_store = PostgresBoardStore()
    snapshot_store = PostgresBoardSnapshotStore()
    owner = make_context("user_owner", role="owner")
    guest_editor = make_context("user_editor", role="guest")
    guest_viewer = make_context("user_viewer", role="guest")

    board_store.save_board(
        BoardSaveRequest(
            boardId="permission_snapshot_board",
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            title="Permission Snapshot Board",
        ),
        owner,
    )
    board_store.upsert_member("permission_snapshot_board", "user_editor", "editor", "Editor", owner)
    board_store.upsert_member("permission_snapshot_board", "user_viewer", "viewer", "Viewer", owner)

    snapshot = snapshot_store.create_snapshot(
        "permission_snapshot_board",
        BoardSnapshotCreateRequest(
            document={"assets": [], "shapes": [{"id": "shape_editor"}]},
            reason="manual_save",
            title="Editor save",
        ),
        guest_editor,
    )
    assert snapshot.board_id == "permission_snapshot_board"

    with pytest.raises(HTTPException) as viewer_snapshot_error:
        snapshot_store.create_snapshot(
            "permission_snapshot_board",
            BoardSnapshotCreateRequest(
                document={"assets": [], "shapes": [{"id": "shape_viewer"}]},
                reason="manual_save",
                title="Viewer save",
            ),
            guest_viewer,
        )
    assert viewer_snapshot_error.value.status_code == 403

    with pytest.raises(HTTPException) as editor_clear_error:
        snapshot_store.clear_snapshots("permission_snapshot_board", guest_editor)
    assert editor_clear_error.value.status_code == 403


def test_board_save_rejects_known_foreign_asset_refs(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()
    context = make_context("user_owner", role="owner")
    fake_db.assets[("other-workspace", "asset_foreign")] = ("asset_foreign", "other-workspace")

    with pytest.raises(HTTPException) as save_error:
        store.save_board(
            BoardSaveRequest(
                boardId="foreign_asset_board",
                document={
                    "assets": [{"id": "asset_foreign", "type": "image"}],
                    "shapes": [{"id": "shape_1", "assetId": "asset_foreign"}],
                },
                title="Foreign Asset Board",
            ),
            context,
        )

    assert save_error.value.status_code == 422
    assert "another workspace" in str(save_error.value.detail)
    assert ("dev-workspace", "foreign_asset_board") not in fake_db.boards


def test_board_save_allows_known_same_workspace_asset_refs(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()
    context = make_context("user_owner", role="owner")
    fake_db.assets[("dev-workspace", "asset_local")] = ("asset_local", "dev-workspace")

    response = store.save_board(
        BoardSaveRequest(
            boardId="local_asset_board",
            document={
                "assets": [{"id": "asset_local", "type": "image"}],
                "nodes": [{"id": "node_1", "inputAssetIds": ["asset_local"]}],
                "shapes": [{"id": "shape_1", "assetId": "asset_local"}],
            },
            title="Local Asset Board",
        ),
        context,
    )

    assert response.ok is True
    assert response.board is not None
    assert response.board.id == "local_asset_board"


def test_snapshot_create_rejects_known_foreign_asset_refs(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres", fake_db.connect)
    board_store = PostgresBoardStore()
    snapshot_store = PostgresBoardSnapshotStore()
    owner = make_context("user_owner", role="owner")
    fake_db.assets[("other-workspace", "asset_foreign")] = ("asset_foreign", "other-workspace")

    board_store.save_board(
        BoardSaveRequest(
            boardId="foreign_asset_snapshot_board",
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            title="Foreign Asset Snapshot Board",
        ),
        owner,
    )

    with pytest.raises(HTTPException) as snapshot_error:
        snapshot_store.create_snapshot(
            "foreign_asset_snapshot_board",
            BoardSnapshotCreateRequest(
                document={
                    "assets": [{"id": "asset_foreign", "type": "image"}],
                    "nodes": [{"id": "node_1", "inputAssetIds": ["asset_foreign"]}],
                    "shapes": [{"id": "shape_foreign", "assetId": "asset_foreign"}],
                },
                reason="manual_save",
                title="Foreign asset snapshot",
            ),
            owner,
        )

    assert snapshot_error.value.status_code == 422
    assert "another workspace" in str(snapshot_error.value.detail)


def make_context(user_id: str, role: str = "owner", workspace_id: str = "dev-workspace") -> ApiRequestContext:
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
        workspace_name="Dev Workspace",
        workspace_role=role,
    )
