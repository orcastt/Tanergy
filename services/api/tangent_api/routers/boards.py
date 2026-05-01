from typing import Any

from fastapi import APIRouter, Depends, Response, status

from tangent_api.board_guard import audit_board_document
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import BoardLoadResponse, BoardSaveRequest, BoardSaveResponse, BoardValidateResponse
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


@router.get("/{board_id}", response_model=BoardLoadResponse)
def get_board(
    board_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardLoadResponse:
    return BoardLoadResponse(board=get_board_storage_adapter().load_board(board_id, context), ok=True)
