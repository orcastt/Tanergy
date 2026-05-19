import pytest
from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardSaveRequest, BoardSnapshotCreateRequest
from tangent_api.storage.postgres_board_snapshot_store import PostgresBoardSnapshotStore
from tangent_api.storage.postgres_board_store import PostgresBoardStore
from tests.persistence_fakes import FakePostgresDatabase


def test_board_copy_is_owner_only_and_shared_delete_is_workspace_manager(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()

    owner = make_context("user_owner", role="owner", workspace_id="workspace_group", workspace_kind="group_workspace")
    workspace_admin = make_context("user_workspace_admin", role="admin", workspace_id="workspace_group", workspace_kind="group_workspace")
    workspace_member = make_context("user_workspace_member", role="member", workspace_id="workspace_group", workspace_kind="group_workspace")
    board_admin = make_context("user_board_admin", role="guest", workspace_id="workspace_group", workspace_kind="group_workspace")

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

    expected_copy_status_by_user = {
        workspace_admin.user_id: 403,
        workspace_member.user_id: 404,
        board_admin.user_id: 403,
    }
    for context in [workspace_admin, workspace_member, board_admin]:
        with pytest.raises(HTTPException) as copy_error:
            store.copy_board("owner_only_board", context)
        assert copy_error.value.status_code == expected_copy_status_by_user[context.user_id]

    deleted_by_admin = store.delete_board("owner_only_board", workspace_admin)
    assert deleted_by_admin == "owner_only_board"
    assert ("workspace_group", "owner_only_board") in fake_db.deleted_boards

    for context in [workspace_member, board_admin]:
        with pytest.raises(HTTPException) as delete_error:
            store.delete_board("owner_only_board", context)
        assert delete_error.value.status_code == 404

    store.save_board(
        BoardSaveRequest(
            boardId="owner_cleanup_board",
            document={"assets": [], "shapes": [{"id": "shape_2"}]},
            title="Owner Cleanup Board",
        ),
        owner,
    )
    copied = store.copy_board("owner_cleanup_board", owner)
    assert copied.id != "owner_only_board"
    assert copied.title == "Owner Cleanup Board Copy"

    share_link = store.ensure_share_link("owner_cleanup_board", "viewer", owner)
    fake_db.board_collaboration_sessions = [
        {"board_id": "owner_cleanup_board", "disconnected_at": None, "workspace_id": "workspace_group"}
    ]
    fake_db.board_realtime_documents = [{"board_id": "owner_cleanup_board", "workspace_id": "workspace_group"}]
    fake_db.snapshots[("workspace_group", "owner_cleanup_board", "snapshot_1")] = (
        "snapshot_1",
        "workspace_group",
        "owner_cleanup_board",
    )

    deleted_id = store.delete_board("owner_cleanup_board", owner)
    assert deleted_id == "owner_cleanup_board"
    assert ("workspace_group", "owner_cleanup_board") in fake_db.deleted_boards
    assert ("workspace_group", "owner_cleanup_board", "user_owner") not in fake_db.board_members
    assert fake_db.board_share_links[0]["share_id"] == share_link.share_id
    assert fake_db.board_share_links[0]["revoked_at"] is not None
    assert fake_db.board_collaboration_sessions[0]["disconnected_at"] is not None
    assert fake_db.board_realtime_documents == []
    assert fake_db.snapshots == {}


def test_team_editor_cannot_create_board_but_admin_can(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_team", "kind": "team_workspace"}]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()

    editor = make_context("user_editor", role="editor", workspace_id="workspace_team", workspace_kind="team_workspace")
    admin = make_context("user_admin", role="admin", workspace_id="workspace_team", workspace_kind="team_workspace")

    with pytest.raises(HTTPException) as editor_error:
        store.save_board(
            BoardSaveRequest(
                boardId="editor_created_board",
                document={"assets": [], "shapes": [{"id": "shape_1"}]},
                title="Editor Created Board",
            ),
            editor,
        )
    assert editor_error.value.status_code == 403

    response = store.save_board(
        BoardSaveRequest(
            boardId="admin_created_board",
            document={"assets": [], "shapes": [{"id": "shape_2"}]},
            title="Admin Created Board",
        ),
        admin,
    )
    assert response.ok is True
    assert response.board is not None
    assert response.board.id == "admin_created_board"


def test_solo_workspace_owner_cannot_copy_or_delete_stale_unowned_board(monkeypatch):
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

    with pytest.raises(HTTPException) as copy_error:
        store.copy_board("stale_private_board", solo_workspace_owner)
    assert copy_error.value.status_code == 403

    with pytest.raises(HTTPException) as delete_error:
        store.delete_board("stale_private_board", solo_workspace_owner)
    assert delete_error.value.status_code == 403
    assert ("dev-workspace", "stale_private_board") in fake_db.boards


def test_expired_share_link_blocks_resolve_and_shared_board_load(monkeypatch):
    fake_db = FakePostgresDatabase()
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()
    fake_db.workspaces = [{"id": "workspace_shared", "kind": "group_workspace"}]
    owner = make_context("user_owner", role="owner", workspace_id="workspace_shared", workspace_kind="group_workspace")

    store.save_board(
        BoardSaveRequest(
            boardId="expiring_share_board",
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            title="Expiring Share Board",
        ),
        owner,
    )
    store.update_board_metadata(
        "expiring_share_board",
        None,
        None,
        None,
        None,
        None,
        None,
        "workspace",
        None,
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


def test_solo_boards_stay_unshareable_but_group_boards_can_share(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [
        {"id": "workspace_solo", "kind": "solo_workspace"},
        {"id": "workspace_group", "kind": "group_workspace"},
    ]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()

    solo_owner = make_context("user_solo", role="owner", workspace_id="workspace_solo", workspace_kind="solo_workspace")
    group_owner = make_context("user_group", role="owner", workspace_id="workspace_group", workspace_kind="group_workspace")

    store.save_board(
        BoardSaveRequest(
            boardId="solo_private_board",
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            title="Solo Private Board",
        ),
        solo_owner,
    )
    store.save_board(
        BoardSaveRequest(
            boardId="group_private_board",
            document={"assets": [], "shapes": [{"id": "shape_2"}]},
            title="Group Private Board",
        ),
        group_owner,
    )

    with pytest.raises(HTTPException) as solo_share_error:
        store.ensure_share_link("solo_private_board", "viewer", solo_owner)
    assert solo_share_error.value.status_code == 403

    share_link = store.ensure_share_link("group_private_board", "viewer", group_owner)
    assert share_link.share_id
    assert share_link.workspace_id == "workspace_group"


def test_solo_workspace_board_cannot_become_public(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_solo", "kind": "solo_workspace"}]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    store = PostgresBoardStore()
    solo_owner = make_context("user_solo", role="owner", workspace_id="workspace_solo", workspace_kind="solo_workspace")

    store.save_board(
        BoardSaveRequest(
            boardId="solo_visibility_board",
            document={"assets": [], "shapes": [{"id": "shape_1"}]},
            title="Solo Visibility Board",
        ),
        solo_owner,
    )

    with pytest.raises(HTTPException) as public_error:
        store.update_board_metadata(
            "solo_visibility_board",
            None,
            None,
            None,
            None,
            None,
            None,
            "public",
            None,
            solo_owner,
        )
    assert public_error.value.status_code == 403


def test_effective_permission_resolver_allows_editor_snapshots_but_not_manage(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_snapshot_store.connect_to_postgres", fake_db.connect)
    board_store = PostgresBoardStore()
    snapshot_store = PostgresBoardSnapshotStore()
    owner = make_context("user_owner", role="owner", workspace_id="workspace_group", workspace_kind="group_workspace")
    guest_editor = make_context("user_editor", role="guest", workspace_id="workspace_group", workspace_kind="group_workspace")
    guest_viewer = make_context("user_viewer", role="guest", workspace_id="workspace_group", workspace_kind="group_workspace")

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
