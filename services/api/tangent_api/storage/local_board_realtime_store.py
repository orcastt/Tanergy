import json
import os
from datetime import datetime, timezone
from pathlib import Path

from tangent_api.realtime.board_realtime_limits import normalize_realtime_document_updates
from tangent_api.storage.local_board_collaboration_store import _normalize_session_identifier


def load_local_board_realtime_document(workspace_id: str, board_id: str) -> list[list[int]]:
    path = _document_path(workspace_id, board_id)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(payload, dict):
        return []
    return _normalize_updates(payload.get("documentUpdates"))


def write_local_board_realtime_document(
    workspace_id: str,
    board_id: str,
    room_key: str,
    document_updates: list[list[int]],
) -> None:
    path = _document_path(workspace_id, board_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "boardId": _normalize_session_identifier(board_id, "board id"),
        "documentUpdates": _normalize_updates(document_updates),
        "roomKey": _normalize_room_key(room_key),
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "workspaceId": _normalize_session_identifier(workspace_id, "workspace id"),
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _document_path(workspace_id: str, board_id: str) -> Path:
    return _realtime_root() / workspace_id / f"{board_id}.json"


def _normalize_updates(value: object) -> list[list[int]]:
    return normalize_realtime_document_updates(value)


def _normalize_room_key(value: str) -> str:
    trimmed = value.strip()
    if not trimmed:
        raise ValueError("room key is required")
    return trimmed[:240]


def _realtime_root() -> Path:
    storage_root = Path(os.getenv("TANGENT_BOARD_STORAGE_DIR") or Path.cwd() / ".tangent-boards")
    return storage_root / "realtime"
