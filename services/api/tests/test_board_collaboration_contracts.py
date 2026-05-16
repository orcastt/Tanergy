from pathlib import Path

from fastapi.testclient import TestClient

from tangent_api.main import app
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardCollaborationSessionUpsertRequest, BoardRecord
from tangent_api.storage import local_board_collaboration_store
from tests.persistence_fakes import FakePostgresDatabase


def _make_context(user_id: str, workspace_id: str) -> ApiRequestContext:
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials="TU",
        user_display_name=f"User {user_id}",
        user_email=f"{user_id}@example.com",
        user_email_verified=True,
        user_id=user_id,
        workspace_board_count=0,
        workspace_id=workspace_id,
        workspace_name=f"Workspace {workspace_id}",
        workspace_role="owner",
    )


def _make_board_record(board_id: str, workspace_id: str, owner_id: str) -> BoardRecord:
    return BoardRecord(
        asset_count=0,
        byte_size=128,
        created_at="2026-05-12T00:00:00+00:00",
        description=None,
        document={"assets": [], "shapes": []},
        id=board_id,
        is_pinned=False,
        is_starred=False,
        last_opened_at=None,
        owner_id=owner_id,
        saved_at="2026-05-12T00:00:00+00:00",
        title=f"Board {board_id}",
        visibility="private",
        workspace_id=workspace_id,
    )


def _patch_local_board_access(monkeypatch, root: Path) -> None:
    monkeypatch.setattr(local_board_collaboration_store, "collaboration_root", root)
    monkeypatch.setattr(
        local_board_collaboration_store,
        "_load_board_without_touch",
        lambda board_id, context, required_access="read": _make_board_record(board_id, context.workspace_id, context.user_id),
    )
    monkeypatch.setattr(local_board_collaboration_store, "_get_board_member_role", lambda board_id, record, context: "owner")
    monkeypatch.setattr(local_board_collaboration_store, "resolve_effective_board_permission", lambda record, context, role: "owner")
    monkeypatch.setattr(local_board_collaboration_store, "can_write_board", lambda record, context, role: True)


def test_local_board_collaboration_session_contract(tmp_path, monkeypatch):
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DIR", str(tmp_path / "boards"))
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    client = TestClient(app)

    save_response = client.post(
        "/api/v1/boards",
        json={
            "boardId": "local_collab_board",
            "document": {"assets": [], "shapes": [{"id": "shape_1"}]},
            "title": "Local Collaboration Board",
        },
    )
    assert save_response.status_code == 200
    saved_at = save_response.json()["board"]["savedAt"]

    claim_response = client.post(
        "/api/v1/boards/local_collab_board/collaboration/sessions",
        json={
            "clientInstanceId": "tab_local_1",
            "presence": {
                "activePageId": "page_1",
                "connectionPreview": {
                    "dataType": "image",
                    "pointer": {"x": 42.1111, "y": 84.2222},
                    "source": {"portId": "image_out", "shapeId": "shape_1"},
                    "sources": [{"portId": "image_out", "shapeId": "shape_1"}],
                    "target": {"portId": "image_in", "shapeId": "shape_2"},
                },
                "cursor": {"x": 12.3456, "y": 78.9},
                "editingShapeIds": ["shape_1"],
                "hoveredShapeId": "shape_1",
                "selectedEdgeId": "edge_1",
                "selectionBox": {"minX": 10.1234, "minY": 20, "maxX": 42.9876, "maxY": 68},
                "selectionIds": ["shape_1"],
                "state": "selecting",
                "tool": "select",
                "transformBox": {"minX": 12, "minY": 24, "maxX": 40, "maxY": 72},
                "transformKind": "move",
            },
            "ttlSeconds": 60,
        },
    )
    assert claim_response.status_code == 200
    claimed = claim_response.json()
    assert claimed["permission"] == "owner"
    assert claimed["canEdit"] is True
    assert claimed["boardSavedAt"] == saved_at
    assert claimed["roomKey"] == "board:dev-workspace:local_collab_board"
    assert len(claimed["activeSessions"]) == 1
    assert claimed["selfSession"]["id"] == claimed["activeSessions"][0]["id"]
    assert claimed["activeSessions"][0]["presence"]["activePageId"] == "page_1"
    assert claimed["activeSessions"][0]["presence"]["connectionPreview"] == {
        "dataType": "image",
        "pointer": {"x": 42.111, "y": 84.222},
        "source": {"portId": "image_out", "shapeId": "shape_1"},
        "sources": [{"portId": "image_out", "shapeId": "shape_1"}],
        "target": {"portId": "image_in", "shapeId": "shape_2"},
    }
    assert claimed["activeSessions"][0]["presence"]["cursor"] == {"x": 12.346, "y": 78.9}
    assert claimed["activeSessions"][0]["presence"]["editingShapeIds"] == ["shape_1"]
    assert claimed["activeSessions"][0]["presence"]["hoveredShapeId"] == "shape_1"
    assert claimed["activeSessions"][0]["presence"]["selectedEdgeId"] == "edge_1"
    assert claimed["activeSessions"][0]["presence"]["selectionBox"] == {
        "minX": 10.123,
        "minY": 20.0,
        "maxX": 42.988,
        "maxY": 68.0,
    }
    assert claimed["activeSessions"][0]["presence"]["transformBox"] == {
        "minX": 12.0,
        "minY": 24.0,
        "maxX": 40.0,
        "maxY": 72.0,
    }
    assert claimed["activeSessions"][0]["presence"]["transformKind"] == "move"

    list_response = client.get("/api/v1/boards/local_collab_board/collaboration")
    assert list_response.status_code == 200
    listed = list_response.json()
    assert len(listed["activeSessions"]) == 1
    assert listed["boardSavedAt"] == saved_at
    assert listed["activeSessions"][0]["displayName"] == "Dev User"

    release_response = client.delete(
        f"/api/v1/boards/local_collab_board/collaboration/sessions/{claimed['selfSession']['id']}"
    )
    assert release_response.status_code == 200
    released = release_response.json()
    assert released["boardSavedAt"] == saved_at
    assert released["activeSessions"] == []


def test_local_board_collaboration_store_namespaces_sessions_by_workspace(tmp_path, monkeypatch):
    _patch_local_board_access(monkeypatch, tmp_path / "collaboration")
    first_context = _make_context("user_one", "workspace_one")
    second_context = _make_context("user_two", "workspace_two")

    payload = BoardCollaborationSessionUpsertRequest(clientInstanceId="shared_tab")
    local_board_collaboration_store.claim_local_board_collaboration_session("shared_board", payload, first_context)
    local_board_collaboration_store.claim_local_board_collaboration_session("shared_board", payload, second_context)

    first_list = local_board_collaboration_store.list_local_board_collaboration_sessions("shared_board", first_context)
    second_list = local_board_collaboration_store.list_local_board_collaboration_sessions("shared_board", second_context)

    assert [item.user_id for item in first_list.active_sessions] == ["user_one"]
    assert [item.user_id for item in second_list.active_sessions] == ["user_two"]
    assert (tmp_path / "collaboration" / "workspace_one" / "shared_board.json").exists()
    assert (tmp_path / "collaboration" / "workspace_two" / "shared_board.json").exists()


def test_local_board_collaboration_store_reuses_session_for_repeated_heartbeat(tmp_path, monkeypatch):
    _patch_local_board_access(monkeypatch, tmp_path / "collaboration")
    context = _make_context("user_one", "workspace_one")

    first_claim = local_board_collaboration_store.claim_local_board_collaboration_session(
        "board_one",
        BoardCollaborationSessionUpsertRequest(
            clientInstanceId="tab_1",
            presence={
                "connectionPreview": {
                    "dataType": "text",
                    "pointer": {"x": 12, "y": 24},
                    "source": {"portId": "text_out", "shapeId": "shape_1"},
                    "target": {"portId": "text_in", "shapeId": "shape_2"},
                },
                "editingShapeIds": ["shape_1"],
                "hoveredShapeId": "shape_1",
                "selectedEdgeId": "edge_1",
                "selectionBox": {"minX": 1, "minY": 2, "maxX": 3, "maxY": 4},
                "selectionIds": ["shape_1"],
                "state": "viewing",
                "tool": "hand",
                "transformBox": {"minX": 2, "minY": 3, "maxX": 4, "maxY": 5},
                "transformKind": "resize",
            },
            ttlSeconds=15,
        ),
        context,
    )
    second_claim = local_board_collaboration_store.claim_local_board_collaboration_session(
        "board_one",
        BoardCollaborationSessionUpsertRequest(
            clientInstanceId="tab_1",
            presence={
                "connectionPreview": {
                    "dataType": "image",
                    "pointer": {"x": 96, "y": 128},
                    "source": {"portId": "image_out", "shapeId": "shape_2"},
                    "sources": [{"portId": "image_out", "shapeId": "shape_2"}],
                    "target": {"portId": "image_in", "shapeId": "shape_3"},
                },
                "editingShapeIds": ["shape_2"],
                "hoveredShapeId": "shape_2",
                "selectedEdgeId": "edge_2",
                "selectionBox": {"minX": 4, "minY": 3, "maxX": 9, "maxY": 8},
                "selectionIds": ["shape_2"],
                "state": "drawing",
                "tool": "draw",
                "transformBox": {"minX": 5, "minY": 4, "maxX": 10, "maxY": 11},
                "transformKind": "rotate",
            },
            ttlSeconds=300,
        ),
        context,
    )

    assert len(second_claim.active_sessions) == 1
    assert second_claim.self_session is not None
    assert first_claim.self_session is not None
    assert second_claim.self_session.id == first_claim.self_session.id
    assert second_claim.self_session.created_at == first_claim.self_session.created_at
    assert second_claim.self_session.presence.editing_shape_ids == ["shape_2"]
    assert second_claim.self_session.presence.hovered_shape_id == "shape_2"
    assert second_claim.self_session.presence.selected_edge_id == "edge_2"
    assert second_claim.self_session.presence.connection_preview is not None
    assert second_claim.self_session.presence.connection_preview.data_type == "image"
    assert second_claim.self_session.presence.connection_preview.pointer.x == 96
    assert second_claim.self_session.presence.connection_preview.pointer.y == 128
    assert second_claim.self_session.presence.connection_preview.target is not None
    assert second_claim.self_session.presence.connection_preview.target.port_id == "image_in"
    assert second_claim.self_session.presence.connection_preview.target.shape_id == "shape_3"
    assert second_claim.self_session.presence.selection_box is not None
    assert second_claim.self_session.presence.selection_box.min_x == 4
    assert second_claim.self_session.presence.selection_box.min_y == 3
    assert second_claim.self_session.presence.selection_box.max_x == 9
    assert second_claim.self_session.presence.selection_box.max_y == 8
    assert second_claim.self_session.presence.transform_box is not None
    assert second_claim.self_session.presence.transform_box.min_x == 5
    assert second_claim.self_session.presence.transform_box.min_y == 4
    assert second_claim.self_session.presence.transform_box.max_x == 10
    assert second_claim.self_session.presence.transform_box.max_y == 11
    assert second_claim.self_session.presence.transform_kind == "rotate"
    assert second_claim.self_session.presence.selection_ids == ["shape_2"]
    assert second_claim.self_session.presence.state == "drawing"
    assert second_claim.self_session.presence.tool == "draw"


def test_postgres_board_collaboration_route_respects_visibility_and_presence(monkeypatch):
    fake_db = FakePostgresDatabase()
    fake_db.workspaces = [{"id": "workspace_group", "kind": "group_workspace"}]
    monkeypatch.setenv("TANGENT_BOARD_STORAGE_DRIVER", "postgres")
    monkeypatch.setattr("tangent_api.storage.postgres_board_store.connect_to_postgres", fake_db.connect)
    monkeypatch.setattr("tangent_api.storage.postgres_board_collaboration_store.connect_to_postgres", fake_db.connect)
    client = TestClient(app)
    owner_headers = {
        "x-tangent-user-id": "dev-user",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
        "x-tangent-workspace-name": "Group workspace",
    }

    save_response = client.post(
        "/api/v1/boards",
        headers=owner_headers,
        json={
            "boardId": "postgres_collab_board",
            "document": {"assets": [], "shapes": [{"id": "shape_owner"}]},
            "title": "Postgres Collaboration Board",
        },
    )
    assert save_response.status_code == 200

    guest_headers = {
        "x-tangent-user-id": "user_guest",
        "x-tangent-workspace-id": "workspace_group",
        "x-tangent-workspace-kind": "group_workspace",
        "x-tangent-workspace-name": "Group workspace",
        "x-tangent-workspace-role": "guest",
    }

    blocked = client.get("/api/v1/boards/postgres_collab_board/collaboration", headers=guest_headers)
    assert blocked.status_code == 404

    visibility_response = client.patch(
        "/api/v1/boards/postgres_collab_board",
        headers=owner_headers,
        json={"visibility": "workspace"},
    )
    assert visibility_response.status_code == 200
    expected_saved_at = visibility_response.json()["board"]["savedAt"]

    guest_claim = client.post(
        "/api/v1/boards/postgres_collab_board/collaboration/sessions",
        headers=guest_headers,
        json={
            "clientInstanceId": "tab_guest_1",
            "presence": {
                "activePageId": "page_guest",
                "selectionIds": ["shape_owner"],
                "state": "viewing",
                "tool": "hand",
            },
        },
    )
    assert guest_claim.status_code == 404

    owner_claim = client.post(
        "/api/v1/boards/postgres_collab_board/collaboration/sessions",
        headers=owner_headers,
        json={
            "clientInstanceId": "tab_owner_1",
            "presence": {
                "activePageId": "page_owner",
                "cursor": {"x": 48, "y": 96},
                "state": "drawing",
                "tool": "draw",
            },
        },
    )
    assert owner_claim.status_code == 200
    owner_body = owner_claim.json()
    assert owner_body["permission"] == "owner"
    assert owner_body["canEdit"] is True
    assert owner_body["boardSavedAt"] == expected_saved_at
    assert len(owner_body["activeSessions"]) == 1
    assert {item["userId"] for item in owner_body["activeSessions"]} == {"dev-user"}

    owner_list = client.get("/api/v1/boards/postgres_collab_board/collaboration", headers=owner_headers)
    assert owner_list.status_code == 200
    assert owner_list.json()["boardSavedAt"] == expected_saved_at

    owner_release = client.delete(
        f"/api/v1/boards/postgres_collab_board/collaboration/sessions/{owner_body['selfSession']['id']}",
        headers=owner_headers,
    )
    assert owner_release.status_code == 200
    released = owner_release.json()
    assert released["boardSavedAt"] == expected_saved_at
    assert released["activeSessions"] == []
    assert len(fake_db.board_collaboration_sessions) == 1
