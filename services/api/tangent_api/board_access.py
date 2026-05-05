from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardRecord

READ_ROLES = {"owner", "admin", "member", "guest"}
WRITE_ROLES = {"owner", "admin", "member"}
MANAGE_ROLES = {"owner", "admin"}


def can_read_workspace(context: ApiRequestContext) -> bool:
    return context.workspace_role in READ_ROLES


def can_create_board(context: ApiRequestContext) -> bool:
    return context.workspace_role in WRITE_ROLES


def can_read_board(record: BoardRecord, context: ApiRequestContext) -> bool:
    if record.workspace_id != context.workspace_id:
        return False
    if context.workspace_role in {"owner", "admin", "member"}:
        return True
    if context.workspace_role == "guest":
        return record.owner_id == context.user_id or record.visibility in {"workspace", "public"}
    return False


def can_write_board(record: BoardRecord, context: ApiRequestContext) -> bool:
    if record.workspace_id != context.workspace_id:
        return False
    if context.workspace_role in WRITE_ROLES:
        return True
    return record.owner_id == context.user_id


def can_manage_board(record: BoardRecord, context: ApiRequestContext) -> bool:
    if record.workspace_id != context.workspace_id:
        return False
    if context.workspace_role in MANAGE_ROLES:
        return True
    return record.owner_id == context.user_id


def assert_can_create_board(context: ApiRequestContext) -> None:
    if not can_create_board(context):
        raise HTTPException(status_code=403, detail="Workspace role cannot create or save boards.")


def assert_can_read_board(record: BoardRecord, context: ApiRequestContext) -> None:
    if not can_read_board(record, context):
        raise HTTPException(status_code=404, detail="Board not found in workspace.")


def assert_can_write_board(record: BoardRecord, context: ApiRequestContext) -> None:
    if not can_write_board(record, context):
        raise HTTPException(status_code=403, detail="Workspace role cannot save this board.")


def assert_can_manage_board(record: BoardRecord, context: ApiRequestContext) -> None:
    if not can_manage_board(record, context):
        raise HTTPException(status_code=403, detail="Workspace role cannot manage this board.")
