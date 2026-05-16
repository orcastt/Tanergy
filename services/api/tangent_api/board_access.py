from typing import Literal, Optional

from fastapi import HTTPException

from tangent_api.plan_catalog import board_limit_for_plan, page_limit_for_plan
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardRecord
from tangent_api.workspace_roles import (
    workspace_role_can_manage,
    workspace_role_can_read,
    workspace_role_can_write,
    normalize_workspace_role,
)
READ_BOARD_MEMBER_ROLES = {"owner", "admin", "editor", "viewer", "temporary_viewer"}
WRITE_BOARD_MEMBER_ROLES = {"owner", "admin", "editor"}
MANAGE_BOARD_MEMBER_ROLES = {"owner", "admin"}
BOARD_PERMISSION_ORDER = {
    "none": 0,
    "view": 1,
    "edit": 2,
    "manage": 3,
    "owner": 4,
}
BoardPermission = Literal["none", "view", "edit", "manage", "owner"]


def can_read_workspace(context: ApiRequestContext) -> bool:
    return workspace_role_can_read(context.workspace_role)


def can_create_board(context: ApiRequestContext) -> bool:
    return workspace_role_can_write(context.workspace_role)


def resolve_effective_board_permission(
    record: BoardRecord,
    context: ApiRequestContext,
    board_member_role: Optional[str] = None,
) -> BoardPermission:
    if record.workspace_id != context.workspace_id:
        return "none"

    normalized_member_role = board_member_role.strip().lower() if isinstance(board_member_role, str) else None
    if record.owner_id == context.user_id or normalized_member_role == "owner":
        return "owner"
    if normalized_member_role in MANAGE_BOARD_MEMBER_ROLES:
        return "manage"
    if normalized_member_role in WRITE_BOARD_MEMBER_ROLES:
        return "edit"
    if normalized_member_role in READ_BOARD_MEMBER_ROLES:
        return "view"

    normalized_workspace_role = _normalize_workspace_role(context.workspace_role)
    if workspace_role_can_manage(normalized_workspace_role):
        return "manage"
    if workspace_role_can_write(normalized_workspace_role):
        return "edit"
    if normalized_workspace_role == "viewer" and record.visibility in {"workspace", "public"}:
        return "view"
    return "none"


def has_board_permission(
    permission: BoardPermission,
    required_permission: BoardPermission,
) -> bool:
    return BOARD_PERMISSION_ORDER[permission] >= BOARD_PERMISSION_ORDER[required_permission]


def can_read_board(
    record: BoardRecord,
    context: ApiRequestContext,
    board_member_role: Optional[str] = None,
) -> bool:
    return has_board_permission(resolve_effective_board_permission(record, context, board_member_role), "view")


def can_write_board(
    record: BoardRecord,
    context: ApiRequestContext,
    board_member_role: Optional[str] = None,
) -> bool:
    return has_board_permission(resolve_effective_board_permission(record, context, board_member_role), "edit")


def can_manage_board(
    record: BoardRecord,
    context: ApiRequestContext,
    board_member_role: Optional[str] = None,
) -> bool:
    return has_board_permission(resolve_effective_board_permission(record, context, board_member_role), "manage")


def can_own_board(
    record: BoardRecord,
    context: ApiRequestContext,
    board_member_role: Optional[str] = None,
) -> bool:
    if resolve_effective_board_permission(record, context, board_member_role) == "owner":
        return True
    return (
        record.workspace_id == context.workspace_id
        and context.workspace_kind == "solo_workspace"
        and context.workspace_role == "owner"
    )


def assert_can_create_board(context: ApiRequestContext) -> None:
    if not can_create_board(context):
        raise HTTPException(status_code=403, detail="Workspace role cannot create or save boards.")
    board_limit = board_limit_for_plan(context.workspace_plan_key or "free_canvas")
    if board_limit is not None and context.workspace_board_count >= board_limit:
        raise HTTPException(status_code=402, detail=f"Plan allows up to {board_limit} boards.")


def assert_board_page_limit(page_count: int, context: ApiRequestContext) -> None:
    page_limit = page_limit_for_plan(context.workspace_plan_key or "free_canvas")
    if page_limit is not None and page_count > page_limit:
        raise HTTPException(status_code=400, detail=f"Plan allows up to {page_limit} pages per board.")


def assert_can_read_board(
    record: BoardRecord,
    context: ApiRequestContext,
    board_member_role: Optional[str] = None,
) -> None:
    if not can_read_board(record, context, board_member_role):
        raise HTTPException(status_code=404, detail="Board not found in workspace.")


def assert_can_write_board(
    record: BoardRecord,
    context: ApiRequestContext,
    board_member_role: Optional[str] = None,
) -> None:
    if not can_write_board(record, context, board_member_role):
        raise HTTPException(status_code=403, detail="Workspace role cannot save this board.")


def assert_can_manage_board(
    record: BoardRecord,
    context: ApiRequestContext,
    board_member_role: Optional[str] = None,
) -> None:
    if not can_manage_board(record, context, board_member_role):
        raise HTTPException(status_code=403, detail="Workspace role cannot manage this board.")


def assert_can_own_board(
    record: BoardRecord,
    context: ApiRequestContext,
    board_member_role: Optional[str] = None,
) -> None:
    if not can_own_board(record, context, board_member_role):
        raise HTTPException(status_code=403, detail="Only the Board owner can copy or delete this board.")


def _normalize_workspace_role(value: str) -> str:
    try:
        return normalize_workspace_role(value)
    except ValueError:
        return "viewer"
