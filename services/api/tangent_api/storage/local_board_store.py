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
from tangent_api.schemas import BoardRecord, BoardSaveRequest, BoardSaveResponse, BoardSummary, summarize_board_record

BOARD_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


def save_board(input_data: BoardSaveRequest, context: ApiRequestContext) -> BoardSaveResponse:
    _assert_local_driver()
    audit = audit_board_document(input_data.document)
    if not audit.ok:
        return BoardSaveResponse(audit=audit, error="Board document failed save guard.", ok=False)

    board_id = _sanitize_board_id(input_data.board_id) or f"board_{uuid4()}"
    record = BoardRecord(
        byteSize=audit.byte_size,
        document=input_data.document,
        id=board_id,
        ownerId=context.user_id,
        savedAt=datetime.now(timezone.utc).isoformat(),
        title=(input_data.title or "Untitled Board").strip() or "Untitled Board",
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

    record = BoardRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))
    if record.workspace_id != context.workspace_id:
        raise HTTPException(status_code=404, detail="Board not found in workspace.")
    return record


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


def rename_board(board_id: str, title: str, context: ApiRequestContext) -> BoardSummary:
    record = load_board(board_id, context)
    next_title = title.strip()
    if not next_title:
        raise HTTPException(status_code=400, detail="Board title is required.")
    if len(next_title) > 80:
        raise HTTPException(status_code=400, detail="Board title must be 80 characters or fewer.")

    updated = record.model_copy(update={"title": next_title, "saved_at": datetime.now(timezone.utc).isoformat()})
    _board_path(updated.id).write_text(
        json.dumps(updated.model_dump(by_alias=True), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return summarize_board_record(updated)


def delete_board(board_id: str, context: ApiRequestContext) -> str:
    record = load_board(board_id, context)
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


def _sanitize_board_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if BOARD_ID_PATTERN.match(value) and ".." not in value:
        return value
    raise HTTPException(status_code=400, detail="Invalid board id.")
