from typing import Any, Optional

from fastapi import APIRouter, Depends, Response, status

from tangent_api.board_guard import audit_board_document
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import (
    BoardCopyResponse,
    BoardDeleteResponse,
    BoardMemberCandidatesResponse,
    BoardListResponse,
    BoardLoadResponse,
    BoardMemberCreateRequest,
    BoardMemberDeleteResponse,
    BoardMemberInviteByEmailRequest,
    BoardMemberResponse,
    BoardMembersResponse,
    BoardMemberUpdateRequest,
    BoardRenameRequest,
    BoardRenameResponse,
    BoardRestoreRequest,
    BoardRestoreResponse,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSnapshotCreateRequest,
    BoardSnapshotCreateResponse,
    BoardSnapshotClearResponse,
    BoardSnapshotListResponse,
    BoardSnapshotLoadResponse,
    BoardShareLinkCreateRequest,
    BoardShareLinkDeleteResponse,
    BoardShareLinkResolveResponse,
    BoardShareLinkResponse,
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
    cursor: Optional[str] = None,
    limit: int = 50,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardListResponse:
    boards, next_cursor = get_board_storage_adapter().list_boards(context, cursor, limit)
    return BoardListResponse(boards=boards, nextCursor=next_cursor, ok=True)


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


@router.post("/{board_id}/copy", response_model=BoardCopyResponse)
def copy_board(
    board_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardCopyResponse:
    board = get_board_storage_adapter().copy_board(board_id, context)
    return BoardCopyResponse(board=board, ok=True)


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


@router.delete("/{board_id}/snapshots", response_model=BoardSnapshotClearResponse)
def clear_board_snapshots(
    board_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardSnapshotClearResponse:
    deleted_count = get_board_storage_adapter().clear_snapshots(board_id, context)
    return BoardSnapshotClearResponse(deletedCount=deleted_count, ok=True)


@router.get("/{board_id}/snapshots/{snapshot_id}", response_model=BoardSnapshotLoadResponse)
def get_board_snapshot(
    board_id: str,
    snapshot_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardSnapshotLoadResponse:
    snapshot = get_board_storage_adapter().load_snapshot(board_id, snapshot_id, context)
    return BoardSnapshotLoadResponse(ok=True, snapshot=snapshot)


@router.post("/{board_id}/restore", response_model=BoardRestoreResponse)
def restore_board_snapshot(
    board_id: str,
    payload: BoardRestoreRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardRestoreResponse:
    return get_board_storage_adapter().restore_snapshot(board_id, payload.snapshot_id, context)


@router.get("/{board_id}/members", response_model=BoardMembersResponse)
def list_board_members(
    board_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardMembersResponse:
    return BoardMembersResponse(members=get_board_storage_adapter().list_members(board_id, context), ok=True)


@router.post("/{board_id}/members", response_model=BoardMemberResponse)
def create_board_member(
    board_id: str,
    payload: BoardMemberCreateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardMemberResponse:
    member = get_board_storage_adapter().upsert_member(
        board_id,
        payload.user_id,
        payload.role,
        payload.display_name,
        context,
    )
    return BoardMemberResponse(member=member, ok=True)


@router.get("/{board_id}/member-candidates", response_model=BoardMemberCandidatesResponse)
def search_board_member_candidates(
    board_id: str,
    query: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardMemberCandidatesResponse:
    candidates = get_board_storage_adapter().search_member_candidates(board_id, query, context)
    return BoardMemberCandidatesResponse(candidates=candidates, ok=True)


@router.post("/{board_id}/members/invite-by-email", response_model=BoardMemberResponse)
def invite_board_member_by_email(
    board_id: str,
    payload: BoardMemberInviteByEmailRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardMemberResponse:
    member = get_board_storage_adapter().invite_member_by_email(
        board_id,
        payload.email,
        payload.role,
        payload.display_name,
        context,
    )
    return BoardMemberResponse(member=member, ok=True)


@router.patch("/{board_id}/members/{user_id}", response_model=BoardMemberResponse)
def update_board_member(
    board_id: str,
    user_id: str,
    payload: BoardMemberUpdateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardMemberResponse:
    member = get_board_storage_adapter().upsert_member(
        board_id,
        user_id,
        payload.role or "viewer",
        payload.display_name,
        context,
    )
    return BoardMemberResponse(member=member, ok=True)


@router.delete("/{board_id}/members/{user_id}", response_model=BoardMemberDeleteResponse)
def delete_board_member(
    board_id: str,
    user_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardMemberDeleteResponse:
    deleted_user_id = get_board_storage_adapter().remove_member(board_id, user_id, context)
    return BoardMemberDeleteResponse(ok=True, userId=deleted_user_id)


@router.post("/{board_id}/share-link", response_model=BoardShareLinkResponse)
def ensure_board_share_link(
    board_id: str,
    payload: BoardShareLinkCreateRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardShareLinkResponse:
    share_link = get_board_storage_adapter().ensure_share_link(board_id, payload.access_role, context, payload.expires_at)
    return BoardShareLinkResponse(ok=True, shareLink=share_link)


@router.delete("/{board_id}/share-link/{share_id}", response_model=BoardShareLinkDeleteResponse)
def revoke_board_share_link(
    board_id: str,
    share_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BoardShareLinkDeleteResponse:
    revoked_share_id = get_board_storage_adapter().revoke_share_link(board_id, share_id, context)
    return BoardShareLinkDeleteResponse(ok=True, shareId=revoked_share_id)


@router.get("/share-links/{share_id}", response_model=BoardShareLinkResolveResponse)
def resolve_board_share_link(share_id: str) -> BoardShareLinkResolveResponse:
    share_link = get_board_storage_adapter().resolve_share_link(share_id)
    return BoardShareLinkResolveResponse(ok=True, shareLink=share_link)


@router.get("/share-links/{share_id}/board", response_model=BoardLoadResponse)
def load_shared_board(share_id: str) -> BoardLoadResponse:
    board = get_board_storage_adapter().load_shared_board(share_id)
    return BoardLoadResponse(board=board, ok=True)
