from tangent_api.board_access import can_create_board, resolve_effective_board_permission
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardRecord
from tangent_api.workspace_roles import normalize_workspace_role


def _make_context(role: str) -> ApiRequestContext:
    return ApiRequestContext(
        auth_mode="required",
        is_dev_fallback=False,
        user_avatar_initials="TU",
        user_display_name="Test User",
        user_email="test@example.com",
        user_email_verified=True,
        user_id="user_test",
        workspace_board_count=0,
        workspace_id="workspace_test",
        workspace_kind="group_workspace",
        workspace_name="Workspace Test",
        workspace_role=role,
    )


def _make_board(visibility: str = "private") -> BoardRecord:
    return BoardRecord(
        asset_count=0,
        byte_size=128,
        created_at="2026-05-16T00:00:00+00:00",
        description=None,
        document={"assets": [], "shapes": []},
        id="board_test",
        is_pinned=False,
        is_starred=False,
        last_opened_at=None,
        owner_id="user_owner",
        saved_at="2026-05-16T00:00:00+00:00",
        title="Board Test",
        visibility=visibility,
        workspace_id="workspace_test",
    )


def test_normalize_workspace_role_maps_legacy_aliases_to_product_roles():
    assert normalize_workspace_role("member") == "editor"
    assert normalize_workspace_role("guest") == "viewer"


def test_board_access_preserves_legacy_member_and_guest_permissions():
    private_board = _make_board()
    workspace_board = _make_board("workspace")

    assert can_create_board(_make_context("member")) is True
    assert can_create_board(_make_context("guest")) is False
    assert resolve_effective_board_permission(private_board, _make_context("guest")) == "none"
    assert resolve_effective_board_permission(workspace_board, _make_context("guest")) == "view"
