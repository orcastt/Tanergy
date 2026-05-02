from typing import Any

from fastapi import APIRouter, Depends, Response, status

from tangent_api.board_guard import audit_board_document
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import (
    BoardDeleteResponse,
    BoardListResponse,
    BoardLoadResponse,
    BoardRenameRequest,
    BoardRenameResponse,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSnapshotCreateRequest,
    BoardSnapshotCreateResponse,
    BoardSnapshotListResponse,
    BoardSnapshotLoadResponse,
    BoardValidateResponse,
)
from tangent_api.storage.board_storage_adapter import get_board_storage_adapter

router = APIRouter(prefix="/api/v1/boards", tags=["boards"])


@router.post("/validate-document", response_model=BoardValidateResponse)
def validate_document(
    payload: dict[str, Any],
    response: Response,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardValidateResponse:
    _ = context
    document = payload["document"] if "document" in payload else payload
    audit = audit_board_document(document)
    if not audit.ok:
        response.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    return BoardValidateResponse(audit=audit, ok=audit.ok)


@router.post("", response_model=BoardSaveResponse)
def create_board(
    payload: BoardSaveRequest,
    response: Response,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardSaveResponse:
    result = get_board_storage_adapter().save_board(payload, context)
    if not result.ok:
        response.status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    return result


@router.get("", response_model=BoardListResponse)
def list_boards(
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardListResponse:
    return BoardListResponse(boards=get_board_storage_adapter().list_boards(context), ok=True)


@router.get("/{board_id}", response_model=BoardLoadResponse)
def get_board(
    board_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardLoadResponse:
    return BoardLoadResponse(board=get_board_storage_adapter().load_board(board_id, context), ok=True)


@router.patch("/{board_id}", response_model=BoardRenameResponse)
def rename_board(
    board_id: str,
    payload: BoardRenameRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardRenameResponse:
    board = get_board_storage_adapter().update_board_metadata(
        board_id,
        payload.title,
        payload.description,
        payload.card_color,
        payload.thumbnail_url,
        payload.is_starred,
        payload.is_pinned,
        payload.visibility,
        payload.share_id,
        context,
    )
    return BoardRenameResponse(board=board, ok=True)


@router.delete("/{board_id}", response_model=BoardDeleteResponse)
def delete_board(
    board_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardDeleteResponse:
    deleted_board_id = get_board_storage_adapter().delete_board(board_id, context)
    return BoardDeleteResponse(boardId=deleted_board_id, ok=True)


@router.post("/{board_id}/snapshots", response_model=BoardSnapshotCreateResponse)
def create_board_snapshot(
    board_id: str,
    payload: BoardSnapshotCreateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardSnapshotCreateResponse:
    snapshot = get_board_storage_adapter().create_snapshot(board_id, payload, context)
    return BoardSnapshotCreateResponse(ok=True, snapshot=snapshot)


@router.get("/{board_id}/snapshots", response_model=BoardSnapshotListResponse)
def list_board_snapshots(
    board_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardSnapshotListResponse:
    snapshots = get_board_storage_adapter().list_snapshots(board_id, context)
    return BoardSnapshotListResponse(ok=True, snapshots=snapshots)


@router.get("/{board_id}/snapshots/{snapshot_id}", response_model=BoardSnapshotLoadResponse)
def get_board_snapshot(
    board_id: str,
    snapshot_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardSnapshotLoadResponse:
    snapshot = get_board_storage_adapter().load_snapshot(board_id, snapshot_id, context)
    return BoardSnapshotLoadResponse(ok=True, snapshot=snapshot)
