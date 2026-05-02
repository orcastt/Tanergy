import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_guard import audit_board_document
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardRecord,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSummary,
    get_board_document_metrics,
    normalize_board_card_color,
    normalize_board_description,
    normalize_board_share_id,
    normalize_board_thumbnail_url,
    normalize_board_visibility,
    summarize_board_record,
)

BOARD_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


def save_board(input_data: BoardSaveRequest, context: ApiRequestContext) -> BoardSaveResponse:
    _assert_local_driver()
    audit = audit_board_document(input_data.document)
    if not audit.ok:
        return BoardSaveResponse(audit=audit, error="Board document failed save guard.", ok=False)

    board_id = _sanitize_board_id(input_data.board_id) or f"board_{uuid4()}"
    metrics = get_board_document_metrics(input_data.document)
    existing = _read_existing_board(board_id, context)
    saved_at = datetime.now(timezone.utc).isoformat()
    record = BoardRecord(
        assetCount=metrics["asset_count"],
        byteSize=audit.byte_size,
        cardColor=normalize_board_card_color(input_data.card_color or (existing.card_color if existing else None)),
        createdAt=existing.created_at if existing else saved_at,
        description=normalize_board_description(input_data.description or (existing.description if existing else None)),
        document=input_data.document,
        id=board_id,
        isPinned=existing.is_pinned if existing else False,
        isStarred=existing.is_starred if existing else False,
        lastOpenedAt=existing.last_opened_at if existing else None,
        ownerId=context.user_id,
        savedAt=saved_at,
        shapeCount=metrics["shape_count"],
        shareId=normalize_board_share_id(existing.share_id if existing else None),
        thumbnailUrl=normalize_board_thumbnail_url(input_data.thumbnail_url or (existing.thumbnail_url if existing else None)),
        title=(input_data.title or "Untitled Board").strip() or "Untitled Board",
        visibility=normalize_board_visibility(existing.visibility if existing else None),
        workspaceId=context.workspace_id,
    )

    path = _board_path(board_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(record.model_dump(by_alias=True), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return BoardSaveResponse(audit=audit, board=summarize_board_record(record), ok=True)


def load_board(board_id: str, context: ApiRequestContext) -> BoardRecord:
    _assert_local_driver()
    safe_board_id = _sanitize_board_id(board_id)
    if not safe_board_id:
        raise HTTPException(status_code=400, detail="Invalid board id.")

    path = _board_path(safe_board_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Board not found.")

    record = _read_board_record(safe_board_id)
    if record.workspace_id != context.workspace_id:
        raise HTTPException(status_code=404, detail="Board not found in workspace.")
    updated = record.model_copy(update={"last_opened_at": datetime.now(timezone.utc).isoformat()})
    _write_board_record(updated)
    return updated


def list_boards(context: ApiRequestContext) -> list[BoardSummary]:
    _assert_local_driver()
    boards_root = _storage_root() / "boards"
    if not boards_root.exists():
        return []

    summaries: list[BoardSummary] = []
    for path in boards_root.glob("*.json"):
        try:
            record = BoardRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))
        except Exception:
            continue
        if record.workspace_id != context.workspace_id:
            continue
        summaries.append(summarize_board_record(record))

    return sorted(summaries, key=lambda record: record.saved_at, reverse=True)


def rename_board(board_id: str, title: Optional[str], context: ApiRequestContext) -> BoardSummary:
    return update_board_metadata(board_id, title, None, None, None, None, None, None, None, context)


def update_board_metadata(
    board_id: str,
    title: Optional[str],
    description: Optional[str],
    card_color: Optional[str],
    thumbnail_url: Optional[str],
    is_starred: Optional[bool],
    is_pinned: Optional[bool],
    visibility: Optional[str],
    share_id: Optional[str],
    context: ApiRequestContext,
) -> BoardSummary:
    record = _load_board_without_touch(board_id, context)
    next_title = title.strip() if title is not None else record.title
    if not next_title:
        raise HTTPException(status_code=400, detail="Board title is required.")
    if len(next_title) > 80:
        raise HTTPException(status_code=400, detail="Board title must be 80 characters or fewer.")

    update_data = {"title": next_title, "saved_at": datetime.now(timezone.utc).isoformat()}
    if description is not None:
        update_data["description"] = normalize_board_description(description)
    if card_color is not None:
        update_data["card_color"] = normalize_board_card_color(card_color)
    if thumbnail_url is not None:
        update_data["thumbnail_url"] = normalize_board_thumbnail_url(thumbnail_url)
    if is_starred is not None:
        update_data["is_starred"] = bool(is_starred)
    if is_pinned is not None:
        update_data["is_pinned"] = bool(is_pinned)
    if visibility is not None:
        update_data["visibility"] = normalize_board_visibility(visibility)
    if share_id is not None:
        update_data["share_id"] = normalize_board_share_id(share_id)

    updated = record.model_copy(update=update_data)
    _write_board_record(updated)
    return summarize_board_record(updated)


def delete_board(board_id: str, context: ApiRequestContext) -> str:
    record = _load_board_without_touch(board_id, context)
    _board_path(record.id).unlink()
    return record.id


def _storage_root() -> Path:
    return Path(os.getenv("TANGENT_BOARD_STORAGE_DIR", ".tangent-boards"))


def _assert_local_driver() -> None:
    driver = os.getenv("TANGENT_BOARD_STORAGE_DRIVER", "local-dev")
    if driver != "local-dev":
        raise HTTPException(
            status_code=501,
            detail=f'Unsupported board storage driver "{driver}". Supported driver: local-dev.',
        )


def _board_path(board_id: str) -> Path:
    return _storage_root() / "boards" / f"{board_id}.json"


def _read_existing_board(board_id: str, context: ApiRequestContext) -> Optional[BoardRecord]:
    try:
        record = _read_board_record(board_id)
    except Exception:
        return None
    return record if record.workspace_id == context.workspace_id else None


def _load_board_without_touch(board_id: str, context: ApiRequestContext) -> BoardRecord:
    safe_board_id = _sanitize_board_id(board_id)
    if not safe_board_id:
        raise HTTPException(status_code=400, detail="Invalid board id.")
    record = _read_board_record(safe_board_id)
    if record.workspace_id != context.workspace_id:
        raise HTTPException(status_code=404, detail="Board not found in workspace.")
    return record


def _read_board_record(board_id: str) -> BoardRecord:
    path = _board_path(board_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Board not found.")
    return BoardRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))


def _write_board_record(record: BoardRecord) -> None:
    path = _board_path(record.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(record.model_dump(by_alias=True), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _sanitize_board_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if BOARD_ID_PATTERN.match(value) and ".." not in value:
        return value
    raise HTTPException(status_code=400, detail="Invalid board id.")
