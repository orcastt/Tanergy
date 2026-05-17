from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_access import assert_board_allows_share_links
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardRecord, BoardShareLinkRecord, BoardShareLinkResolveRecord
from tangent_api.storage.local_board_store_boards import update_board_metadata
from tangent_api.storage.local_board_store_records import (
    _load_board_without_touch,
    _read_board_record,
    _read_share_links,
    _write_board_record,
    _write_share_links,
)
from tangent_api.storage.local_board_store_support import (
    _create_share_id,
    _is_share_link_active,
    _normalize_board_share_access_role,
    _normalize_share_expires_at,
    _require_share_id,
    _storage_root,
)


def ensure_board_share_link(
    board_id: str,
    access_role: str,
    context: ApiRequestContext,
    expires_at: Optional[str] = None,
) -> BoardShareLinkRecord:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    assert_board_allows_share_links(record, context.workspace_kind)
    normalized_access_role = _normalize_board_share_access_role(access_role)
    normalized_expires_at = _normalize_share_expires_at(expires_at)
    share_links = _read_share_links(record.id)
    existing = next((item for item in share_links if item.share_id and _is_share_link_active(item)), None)
    if existing:
        updated = existing.model_copy(update={"access_role": normalized_access_role, "expires_at": normalized_expires_at})
        next_links = [updated, *[item for item in share_links if item.id != existing.id]]
        _write_share_links(record.id, next_links)
        update_board_metadata(record.id, None, None, None, None, None, None, None, updated.share_id, context)
        return updated

    now = datetime.now(timezone.utc).isoformat()
    created = BoardShareLinkRecord(
        accessRole=normalized_access_role,
        boardId=record.id,
        createdAt=now,
        createdBy=context.user_id,
        expiresAt=normalized_expires_at,
        id=f"board_share_{uuid4()}",
        shareId=_create_share_id(),
        workspaceId=record.workspace_id,
    )
    _write_share_links(record.id, [created])
    update_board_metadata(record.id, None, None, None, None, None, None, None, created.share_id, context)
    return created


def revoke_board_share_link(board_id: str, share_id: str, context: ApiRequestContext) -> str:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    normalized_share_id = _require_share_id(share_id)
    share_links = _read_share_links(record.id)
    next_links = [item for item in share_links if item.share_id != normalized_share_id]
    if len(next_links) == len(share_links):
        raise HTTPException(status_code=404, detail="Board share link not found.")
    _write_share_links(record.id, next_links)
    update_board_metadata(record.id, None, None, None, None, None, None, None, "", context)
    return normalized_share_id


def resolve_board_share_link(share_id: str) -> BoardShareLinkResolveRecord:
    normalized_share_id = _require_share_id(share_id)
    record, link = _find_shared_board(normalized_share_id)
    return BoardShareLinkResolveRecord(
        accessRole=link.access_role,
        boardId=record.id,
        boardTitle=record.title,
        shareId=link.share_id,
        workspaceId=record.workspace_id,
    )


def load_shared_board(share_id: str) -> BoardRecord:
    normalized_share_id = _require_share_id(share_id)
    record, _ = _find_shared_board(normalized_share_id)
    opened_at = datetime.now(timezone.utc).isoformat()
    updated = record.model_copy(update={"last_opened_at": opened_at})
    _write_board_record(updated)
    return updated


def _find_shared_board(share_id: str) -> tuple[BoardRecord, BoardShareLinkRecord]:
    boards_root = _storage_root() / "boards"
    if not boards_root.exists():
        raise HTTPException(status_code=404, detail="Board share link not found.")
    for path in boards_root.glob("*.shares.json"):
        board_id = path.name.removesuffix(".shares.json")
        for link in _read_share_links(board_id):
            if link.share_id != share_id or not _is_share_link_active(link):
                continue
            return _read_board_record(board_id), link
    raise HTTPException(status_code=404, detail="Board share link not found.")
