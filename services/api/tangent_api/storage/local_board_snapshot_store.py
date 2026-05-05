import hashlib
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
    BoardSnapshotCreateRequest,
    BoardSnapshotRecord,
    BoardSnapshotSummary,
    get_board_document_metrics,
)
from tangent_api.board_metadata import get_board_snapshot_display_title, normalize_board_thumbnail_url

BOARD_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


def create_board_snapshot(
    board_id: str,
    input_data: BoardSnapshotCreateRequest,
    context: ApiRequestContext,
) -> BoardSnapshotSummary:
    safe_board_id = _sanitize_id(board_id)
    if not safe_board_id:
        raise HTTPException(status_code=400, detail="Invalid board id.")
    audit = audit_board_document(input_data.document)
    if not audit.ok:
        issue = next((item for item in audit.issues if item.blocking), None)
        raise HTTPException(status_code=422, detail=issue.message if issue else "Board document is blocked.")

    metrics = get_board_document_metrics(input_data.document)
    snapshot = BoardSnapshotRecord(
        assetCount=metrics["asset_count"],
        boardId=safe_board_id,
        byteSize=audit.byte_size,
        createdAt=datetime.now(timezone.utc).isoformat(),
        createdBy=context.user_id,
        document=input_data.document,
        documentHash=_hash_document(input_data.document),
        expiresAt=None,
        id=f"snapshot_{uuid4()}",
        reason=_normalize_reason(input_data.reason),
        retentionTier="free",
        shapeCount=metrics["shape_count"],
        thumbnailUrl=normalize_board_thumbnail_url(input_data.thumbnail_url),
        title=get_board_snapshot_display_title(input_data.document, input_data.title),
        workspaceId=context.workspace_id,
    )
    _write_snapshot(snapshot)
    _enforce_snapshot_limit(context, safe_board_id)
    return _summarize_snapshot(snapshot)


def list_board_snapshots(board_id: str, context: ApiRequestContext) -> list[BoardSnapshotSummary]:
    safe_board_id = _sanitize_id(board_id)
    if not safe_board_id:
        raise HTTPException(status_code=400, detail="Invalid board id.")
    root = _snapshot_root(context.workspace_id, safe_board_id)
    if not root.exists():
        return []
    snapshots: list[BoardSnapshotSummary] = []
    for path in root.glob("*.json"):
        try:
            snapshot = BoardSnapshotRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))
        except Exception:
            continue
        snapshots.append(_summarize_snapshot(snapshot))
    return sorted(snapshots, key=lambda item: item.created_at, reverse=True)


def load_board_snapshot(
    board_id: str,
    snapshot_id: str,
    context: ApiRequestContext,
) -> BoardSnapshotRecord:
    safe_board_id = _sanitize_id(board_id)
    safe_snapshot_id = _sanitize_id(snapshot_id)
    if not safe_board_id or not safe_snapshot_id:
        raise HTTPException(status_code=400, detail="Invalid snapshot id.")
    path = _snapshot_path(context.workspace_id, safe_board_id, safe_snapshot_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="Board history entry not found.")
    snapshot = BoardSnapshotRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))
    if snapshot.workspace_id != context.workspace_id or snapshot.board_id != safe_board_id:
        raise HTTPException(status_code=404, detail="Board history entry not found in workspace.")
    return snapshot


def clear_board_snapshots(board_id: str, context: ApiRequestContext) -> int:
    safe_board_id = _sanitize_id(board_id)
    if not safe_board_id:
        raise HTTPException(status_code=400, detail="Invalid board id.")
    snapshots = list_board_snapshots(safe_board_id, context)
    root = _snapshot_root(context.workspace_id, safe_board_id)
    if root.exists():
        for path in root.glob("*.json"):
            path.unlink(missing_ok=True)
    return len(snapshots)


def _write_snapshot(snapshot: BoardSnapshotRecord) -> None:
    path = _snapshot_path(snapshot.workspace_id, snapshot.board_id, snapshot.id)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(snapshot.model_dump(by_alias=True), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _enforce_snapshot_limit(context: ApiRequestContext, board_id: str) -> None:
    limit = _snapshot_limit()
    snapshots = list_board_snapshots(board_id, context)
    autosaves = [snapshot for snapshot in snapshots if _snapshot_retention_kind(snapshot.reason) == "autosave"]
    user_saves = [snapshot for snapshot in snapshots if _snapshot_retention_kind(snapshot.reason) == "user"]
    for snapshot in [*autosaves[limit:], *user_saves[limit:]]:
        _snapshot_path(context.workspace_id, board_id, snapshot.id).unlink(missing_ok=True)


def _summarize_snapshot(snapshot: BoardSnapshotRecord) -> BoardSnapshotSummary:
    payload = snapshot.model_dump(by_alias=True, exclude={"document"})
    payload["title"] = get_board_snapshot_display_title(snapshot.document, snapshot.title)
    return BoardSnapshotSummary(**payload)


def _snapshot_root(workspace_id: str, board_id: str) -> Path:
    return _storage_root() / "snapshots" / workspace_id / board_id


def _snapshot_path(workspace_id: str, board_id: str, snapshot_id: str) -> Path:
    return _snapshot_root(workspace_id, board_id) / f"{snapshot_id}.json"


def _storage_root() -> Path:
    return Path(os.getenv("TANGENT_BOARD_STORAGE_DIR", ".tangent-boards"))


def _hash_document(document: object) -> str:
    return hashlib.sha256(json.dumps(document, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()


def _normalize_reason(value: str) -> str:
    reasons = {"autosave", "auto_interval", "keyboard", "manual", "manual_save", "pre_restore"}
    return value if value in reasons else "manual"


def _snapshot_retention_kind(reason: str) -> str:
    return "autosave" if reason in {"autosave", "auto_interval"} else "user"


def _snapshot_limit() -> int:
    try:
        value = int(os.getenv("TANGENT_FREE_BOARD_SNAPSHOT_LIMIT", "100"))
    except ValueError:
        value = 100
    return value if value > 0 else 100


def _sanitize_id(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    if BOARD_ID_PATTERN.match(value) and ".." not in value:
        return value
    raise HTTPException(status_code=400, detail="Invalid id.")
