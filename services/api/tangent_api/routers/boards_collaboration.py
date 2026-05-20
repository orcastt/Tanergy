from __future__ import annotations

import hashlib
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from tangent_api.board_guard import audit_board_document
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.security_events import record_security_event
from tangent_api.security_share_password import enforce_share_password_attempt_limit
from tangent_api.schemas import (
    BoardMemberCandidatesResponse,
    BoardMemberCreateRequest,
    BoardMemberDeleteResponse,
    BoardMemberInviteByEmailRequest,
    BoardMemberResponse,
    BoardMembersResponse,
    BoardMemberUpdateRequest,
    BoardShareLinkCreateRequest,
    BoardShareLinkDeleteResponse,
    BoardShareLinkResolveResponse,
    BoardShareLinkResponse,
    BoardValidateResponse,
    BoardLoadResponse,
)
from tangent_api.storage.board_storage_adapter import get_board_storage_adapter

router = APIRouter(tags=["boards"])


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
    _ = (board_id, payload, context)
    raise HTTPException(
        status_code=409,
        detail="Board invites now require an existing workspace member. Invite them to the workspace first, then assign boards.",
    )


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
    share_link = get_board_storage_adapter().ensure_share_link(
        board_id,
        payload.access_role,
        context,
        payload.expires_at,
        payload.password,
        payload.clear_password,
        payload.regenerate,
    )
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
def resolve_board_share_link(
    share_id: str,
    request: Request,
) -> BoardShareLinkResolveResponse:
    share_password = request.headers.get("x-tangent-share-password")
    enforce_share_password_attempt_limit(request, share_id, share_password)
    try:
        share_link = get_board_storage_adapter().resolve_share_link(share_id, share_password)
    except HTTPException as exc:
        _record_public_share_access(share_id, "board_share.resolve", "deny", f"share_link_{exc.status_code}")
        raise
    _record_public_share_access(share_id, "board_share.resolve", "allow", "share_link_resolved")
    return BoardShareLinkResolveResponse(ok=True, shareLink=share_link)


@router.get("/share-links/{share_id}/board", response_model=BoardLoadResponse)
def load_shared_board(
    share_id: str,
    request: Request,
) -> BoardLoadResponse:
    share_password = request.headers.get("x-tangent-share-password")
    enforce_share_password_attempt_limit(request, share_id, share_password)
    try:
        board = get_board_storage_adapter().load_shared_board(share_id, share_password)
    except HTTPException as exc:
        _record_public_share_access(share_id, "board_share.load_board", "deny", f"share_link_{exc.status_code}")
        raise
    _record_public_share_access(share_id, "board_share.load_board", "allow", "shared_board_loaded")
    return BoardLoadResponse(board=board, ok=True)


def _record_public_share_access(share_id: str, action: str, decision: str, reason: str) -> None:
    share_hash = hashlib.sha256(share_id.encode("utf-8", errors="replace")).hexdigest()[:16]
    record_security_event(
        action=action,
        decision=decision,
        metadata={"shareHash": share_hash},
        reason=reason,
        resource_id=share_hash,
        resource_type="board_share_link",
    )
