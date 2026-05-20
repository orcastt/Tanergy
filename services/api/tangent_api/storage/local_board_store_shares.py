import json
from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_access import assert_board_allows_share_links
from tangent_api.board_metadata import create_board_share_password_hash, verify_board_share_password
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import BoardRecord, BoardShareLinkRecord, BoardShareLinkResolveRecord
from tangent_api.storage.local_board_store_boards import update_board_metadata
from tangent_api.storage.local_board_store_records import (
    _load_board_without_touch,
    _read_board_record,
    _write_board_record,
)
from tangent_api.storage.local_board_store_support import (
    _create_share_id,
    _is_share_link_active,
    _normalize_board_share_access_role,
    _normalize_share_expires_at,
    _require_share_id,
    _share_link_path,
    _storage_root,
)


def ensure_board_share_link(
    board_id: str,
    access_role: str,
    context: ApiRequestContext,
    expires_at: Optional[str] = None,
    password: Optional[str] = None,
    clear_password: bool = False,
    regenerate: bool = False,
) -> BoardShareLinkRecord:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    assert_board_allows_share_links(record, context.workspace_kind)
    normalized_access_role = _normalize_board_share_access_role(access_role)
    normalized_expires_at = _normalize_share_expires_at(expires_at)
    if clear_password and password is not None:
        raise HTTPException(status_code=400, detail="Board share password cannot be set and cleared together.")
    share_links = _read_share_entries(record.id)
    existing = next((item for item in share_links if _entry_is_active(item)), None)
    if existing and regenerate:
        existing["revokedAt"] = datetime.now(timezone.utc).isoformat()
        existing = None
    if existing:
        existing["accessRole"] = normalized_access_role
        existing["expiresAt"] = normalized_expires_at
        _set_entry_password(existing, password, clear_password)
        _write_share_entries(record.id, _move_entry_to_front(share_links, existing))
        share_record = _entry_to_record(existing)
        update_board_metadata(record.id, None, None, None, None, None, None, None, share_record.share_id, context)
        return share_record

    now = datetime.now(timezone.utc).isoformat()
    created = {
        "accessRole": normalized_access_role,
        "boardId": record.id,
        "createdAt": now,
        "createdBy": context.user_id,
        "expiresAt": normalized_expires_at,
        "id": f"board_share_{uuid4()}",
        "revokedAt": None,
        "shareId": _create_share_id(),
        "workspaceId": record.workspace_id,
    }
    _set_entry_password(created, password, clear_password)
    _write_share_entries(record.id, [created, *share_links])
    share_record = _entry_to_record(created)
    update_board_metadata(record.id, None, None, None, None, None, None, None, share_record.share_id, context)
    return share_record


def revoke_board_share_link(board_id: str, share_id: str, context: ApiRequestContext) -> str:
    record = _load_board_without_touch(board_id, context, required_access="manage")
    normalized_share_id = _require_share_id(share_id)
    share_links = _read_share_entries(record.id)
    target = next((item for item in share_links if item.get("shareId") == normalized_share_id), None)
    if not target:
        raise HTTPException(status_code=404, detail="Board share link not found.")
    target["revokedAt"] = datetime.now(timezone.utc).isoformat()
    _write_share_entries(record.id, share_links)
    update_board_metadata(record.id, None, None, None, None, None, None, None, "", context)
    return normalized_share_id


def resolve_board_share_link(share_id: str, password: Optional[str] = None) -> BoardShareLinkResolveRecord:
    normalized_share_id = _require_share_id(share_id)
    record, link = _find_shared_board(normalized_share_id, password)
    return BoardShareLinkResolveRecord(
        accessRole=link.access_role,
        boardId=record.id,
        boardTitle=record.title,
        passwordProtected=link.password_protected,
        shareId=link.share_id,
        workspaceId=record.workspace_id,
    )


def load_shared_board(share_id: str, password: Optional[str] = None) -> BoardRecord:
    normalized_share_id = _require_share_id(share_id)
    record, _ = _find_shared_board(normalized_share_id, password)
    opened_at = datetime.now(timezone.utc).isoformat()
    updated = record.model_copy(update={"last_opened_at": opened_at})
    _write_board_record(updated)
    return updated


def _find_shared_board(share_id: str, password: Optional[str]) -> tuple[BoardRecord, BoardShareLinkRecord]:
    boards_root = _storage_root() / "boards"
    if not boards_root.exists():
        raise HTTPException(status_code=404, detail="Board share link not found.")
    for path in boards_root.glob("*.shares.json"):
        board_id = path.name.removesuffix(".shares.json")
        for entry in _read_share_entries(board_id):
            if entry.get("shareId") != share_id or not _entry_is_active(entry):
                continue
            _assert_entry_password(entry, password)
            link = _entry_to_record(entry)
            return _read_board_record(board_id), link
    raise HTTPException(status_code=404, detail="Board share link not found.")


def _read_share_entries(board_id: str) -> list[dict[str, Any]]:
    path = _share_link_path(board_id)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    entries: list[dict[str, Any]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        try:
            record = BoardShareLinkRecord.model_validate(item)
        except Exception:
            continue
        entry = record.model_dump(by_alias=True)
        if item.get("passwordHash"):
            entry["passwordHash"] = item["passwordHash"]
        if "revokedAt" in item:
            entry["revokedAt"] = item.get("revokedAt")
        entry["passwordProtected"] = bool(entry.get("passwordHash"))
        entries.append(entry)
    return entries


def _write_share_entries(board_id: str, entries: list[dict[str, Any]]) -> None:
    path = _share_link_path(board_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(entries, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _entry_to_record(entry: dict[str, Any]) -> BoardShareLinkRecord:
    return BoardShareLinkRecord.model_validate({**entry, "passwordProtected": bool(entry.get("passwordHash"))})


def _entry_is_active(entry: dict[str, Any]) -> bool:
    if entry.get("revokedAt"):
        return False
    return _is_share_link_active(_entry_to_record(entry))


def _set_entry_password(entry: dict[str, Any], password: Optional[str], clear_password: bool) -> None:
    if clear_password:
        entry.pop("passwordHash", None)
    elif password is not None:
        entry["passwordHash"] = create_board_share_password_hash(password)
    entry["passwordProtected"] = bool(entry.get("passwordHash"))


def _assert_entry_password(entry: dict[str, Any], password: Optional[str]) -> None:
    if not verify_board_share_password(password, entry.get("passwordHash")):
        raise HTTPException(status_code=401, detail="Board share password is required.")


def _move_entry_to_front(entries: list[dict[str, Any]], target: dict[str, Any]) -> list[dict[str, Any]]:
    return [target, *[item for item in entries if item.get("id") != target.get("id")]]
