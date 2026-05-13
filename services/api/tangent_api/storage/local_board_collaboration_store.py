import json
import math
import os
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.board_access import can_write_board, resolve_effective_board_permission
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import (
    BoardCollaborationPresence,
    BoardCollaborationSessionDeleteResponse,
    BoardCollaborationSessionRecord,
    BoardCollaborationSessionsResponse,
    BoardCollaborationSessionUpsertRequest,
)
from tangent_api.storage.local_board_store import _get_board_member_role, _load_board_without_touch

SESSION_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]{1,120}$")
ACTIVE_STATES = {"idle", "viewing", "drawing", "typing", "selecting", "panning", "running"}
MAX_SELECTION_IDS = 50
MAX_TTL_SECONDS = 300
MIN_TTL_SECONDS = 15
MAX_ACTIVE_SESSIONS_PER_BOARD = 100

storage_root = Path(os.getenv("TANGENT_BOARD_STORAGE_DIR") or Path.cwd() / ".tangent-boards")
collaboration_root = storage_root / "collaboration"


def claim_local_board_collaboration_session(
    board_id: str,
    payload: BoardCollaborationSessionUpsertRequest,
    context: ApiRequestContext,
) -> BoardCollaborationSessionsResponse:
    record = _load_board_without_touch(board_id, context, required_access="read")
    permission = resolve_effective_board_permission(
        record,
        context,
        _get_board_member_role(record.id, record, context),
    )
    sessions = _read_active_sessions(record.workspace_id, record.id)
    ttl_seconds = _normalize_ttl_seconds(payload.ttl_seconds)
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(seconds=ttl_seconds)
    normalized_client_instance_id = _normalize_session_identifier(payload.client_instance_id, "client instance id")
    normalized_presence = _normalize_presence(payload.presence)
    existing = next(
        (
            item for item in sessions
            if item["userId"] == context.user_id and item["clientInstanceId"] == normalized_client_instance_id
        ),
        None,
    )
    next_session = {
        "avatarInitials": context.user_avatar_initials or "NA",
        "boardId": record.id,
        "clientInstanceId": normalized_client_instance_id,
        "createdAt": existing["createdAt"] if existing else now.isoformat(),
        "displayName": context.user_display_name or context.user_id,
        "expiresAt": expires_at.isoformat(),
        "id": existing["id"] if existing else f"collab_{uuid4()}",
        "lastHeartbeatAt": now.isoformat(),
        "permission": permission,
        "presence": normalized_presence,
        "userId": context.user_id,
        "workspaceId": record.workspace_id,
        "workspaceRole": context.workspace_role,
    }
    next_sessions = [
        item for item in sessions
        if not (item["userId"] == context.user_id and item["clientInstanceId"] == normalized_client_instance_id)
    ]
    next_sessions.append(next_session)
    next_sessions = _limit_active_sessions(next_sessions)
    _write_sessions(record.workspace_id, record.id, next_sessions)
    active_records = _to_session_records(next_sessions, context.user_id)
    self_session = next((item for item in active_records if item.id == next_session["id"]), None)
    return BoardCollaborationSessionsResponse(
        activeSessions=active_records,
        boardId=record.id,
        boardSavedAt=record.saved_at,
        canEdit=can_write_board(record, context, _get_board_member_role(record.id, record, context)),
        ok=True,
        permission=permission,
        roomKey=_room_key(record.workspace_id, record.id),
        selfSession=self_session,
        workspaceId=record.workspace_id,
    )


def list_local_board_collaboration_sessions(
    board_id: str,
    context: ApiRequestContext,
) -> BoardCollaborationSessionsResponse:
    record = _load_board_without_touch(board_id, context, required_access="read")
    permission = resolve_effective_board_permission(
        record,
        context,
        _get_board_member_role(record.id, record, context),
    )
    active_records = _to_session_records(_read_active_sessions(record.workspace_id, record.id), context.user_id)
    return BoardCollaborationSessionsResponse(
        activeSessions=active_records,
        boardId=record.id,
        boardSavedAt=record.saved_at,
        canEdit=can_write_board(record, context, _get_board_member_role(record.id, record, context)),
        ok=True,
        permission=permission,
        roomKey=_room_key(record.workspace_id, record.id),
        selfSession=None,
        workspaceId=record.workspace_id,
    )


def release_local_board_collaboration_session(
    board_id: str,
    session_id: str,
    context: ApiRequestContext,
) -> BoardCollaborationSessionDeleteResponse:
    record = _load_board_without_touch(board_id, context, required_access="read")
    normalized_session_id = _normalize_session_identifier(session_id, "session id")
    active_sessions = _read_active_sessions(record.workspace_id, record.id)
    remaining_sessions: list[dict[str, object]] = []
    removed = False
    for item in active_sessions:
        if item["id"] == normalized_session_id and item["userId"] == context.user_id:
            removed = True
            continue
        remaining_sessions.append(item)
    if not removed:
        raise HTTPException(status_code=404, detail="Collaboration session not found.")
    _write_sessions(record.workspace_id, record.id, remaining_sessions)
    return BoardCollaborationSessionDeleteResponse(
        activeSessions=_to_session_records(remaining_sessions, context.user_id),
        boardId=record.id,
        boardSavedAt=record.saved_at,
        ok=True,
        sessionId=normalized_session_id,
        workspaceId=record.workspace_id,
    )


def _session_path(workspace_id: str, board_id: str) -> Path:
    return collaboration_root / workspace_id / f"{board_id}.json"


def _read_active_sessions(workspace_id: str, board_id: str) -> list[dict[str, object]]:
    path = _session_path(workspace_id, board_id)
    if not path.exists():
        return []
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    if not isinstance(payload, list):
        return []
    now = datetime.now(timezone.utc)
    active_sessions: list[dict[str, object]] = []
    for item in payload:
        if not isinstance(item, dict):
            continue
        expires_at = _parse_datetime(item.get("expiresAt"))
        if not expires_at or expires_at <= now:
            continue
        try:
            active_sessions.append(_normalize_stored_session(item))
        except HTTPException:
            continue
    active_sessions.sort(key=lambda item: str(item["lastHeartbeatAt"]), reverse=True)
    active_sessions = _limit_active_sessions(active_sessions)
    if len(active_sessions) != len(payload):
        _write_sessions(workspace_id, board_id, active_sessions)
    return active_sessions


def _write_sessions(workspace_id: str, board_id: str, sessions: list[dict[str, object]]) -> None:
    path = _session_path(workspace_id, board_id)
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered = sorted(sessions, key=lambda item: str(item["lastHeartbeatAt"]), reverse=True)
    path.write_text(json.dumps(ordered, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _limit_active_sessions(sessions: list[dict[str, object]]) -> list[dict[str, object]]:
    ordered = sorted(sessions, key=lambda item: str(item["lastHeartbeatAt"]), reverse=True)
    return ordered[:MAX_ACTIVE_SESSIONS_PER_BOARD]


def _to_session_records(
    sessions: list[dict[str, object]],
    current_user_id: str,
) -> list[BoardCollaborationSessionRecord]:
    return [
        BoardCollaborationSessionRecord(
            avatarInitials=str(item["avatarInitials"]),
            boardId=str(item["boardId"]),
            clientInstanceId=str(item["clientInstanceId"]),
            createdAt=str(item["createdAt"]),
            displayName=str(item["displayName"]),
            expiresAt=str(item["expiresAt"]),
            id=str(item["id"]),
            isSelf=str(item["userId"]) == current_user_id,
            lastHeartbeatAt=str(item["lastHeartbeatAt"]),
            permission=str(item["permission"]),
            presence=BoardCollaborationPresence.model_validate(item.get("presence") or {}),
            userId=str(item["userId"]),
            workspaceId=str(item["workspaceId"]),
            workspaceRole=str(item["workspaceRole"]),
        )
        for item in sessions
    ]


def _normalize_stored_session(payload: dict[str, object]) -> dict[str, object]:
    return {
        "avatarInitials": str(payload.get("avatarInitials") or "NA")[:8],
        "boardId": _normalize_session_identifier(str(payload.get("boardId") or ""), "board id"),
        "clientInstanceId": _normalize_session_identifier(str(payload.get("clientInstanceId") or ""), "client instance id"),
        "createdAt": _require_datetime_string(payload.get("createdAt"), "createdAt"),
        "displayName": str(payload.get("displayName") or "Unknown")[:120],
        "expiresAt": _require_datetime_string(payload.get("expiresAt"), "expiresAt"),
        "id": _normalize_session_identifier(str(payload.get("id") or ""), "session id"),
        "lastHeartbeatAt": _require_datetime_string(payload.get("lastHeartbeatAt"), "lastHeartbeatAt"),
        "permission": _normalize_permission(str(payload.get("permission") or "view")),
        "presence": _normalize_presence(payload.get("presence") or {}),
        "userId": _normalize_session_identifier(str(payload.get("userId") or ""), "user id"),
        "workspaceId": _normalize_session_identifier(str(payload.get("workspaceId") or ""), "workspace id"),
        "workspaceRole": str(payload.get("workspaceRole") or "viewer")[:40],
    }


def _normalize_presence(payload: object) -> dict[str, object]:
    presence = BoardCollaborationPresence.model_validate(payload or {})
    editing_shape_ids = [
        _normalize_session_identifier(item, "editing shape id")
        for item in presence.editing_shape_ids[:MAX_SELECTION_IDS]
        if isinstance(item, str) and item.strip()
    ]
    selection_ids = [
        _normalize_session_identifier(item, "selection id")
        for item in presence.selection_ids[:MAX_SELECTION_IDS]
        if isinstance(item, str) and item.strip()
    ]
    tool = presence.tool.strip()[:40] if isinstance(presence.tool, str) and presence.tool.strip() else None
    state = presence.state.strip().lower()[:24] if isinstance(presence.state, str) and presence.state.strip() else None
    if state and state not in ACTIVE_STATES:
        state = "idle"
    active_page_id = None
    if isinstance(presence.active_page_id, str) and presence.active_page_id.strip():
        active_page_id = _normalize_session_identifier(presence.active_page_id, "active page id")
    hovered_shape_id = None
    if isinstance(presence.hovered_shape_id, str) and presence.hovered_shape_id.strip():
        hovered_shape_id = _normalize_session_identifier(presence.hovered_shape_id, "hovered shape id")
    cursor = None
    if presence.cursor is not None and _is_finite_number(presence.cursor.x) and _is_finite_number(presence.cursor.y):
        cursor = {
            "x": round(float(presence.cursor.x), 3),
            "y": round(float(presence.cursor.y), 3),
        }
    return {
        "activePageId": active_page_id,
        "cursor": cursor,
        "editingShapeIds": editing_shape_ids,
        "hoveredShapeId": hovered_shape_id,
        "selectionIds": selection_ids,
        "state": state,
        "tool": tool,
    }


def _normalize_permission(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in {"view", "edit", "manage", "owner"}:
        raise HTTPException(status_code=400, detail="Invalid collaboration permission.")
    return normalized


def _normalize_session_identifier(value: str, label: str) -> str:
    trimmed = value.strip()
    if not trimmed or not SESSION_ID_PATTERN.fullmatch(trimmed) or ".." in trimmed:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return trimmed


def _normalize_ttl_seconds(value: Optional[int]) -> int:
    if value is None:
        return 45
    return max(MIN_TTL_SECONDS, min(int(value), MAX_TTL_SECONDS))


def _require_datetime_string(value: object, label: str) -> str:
    parsed = _parse_datetime(value)
    if parsed is None:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return parsed.isoformat()


def _parse_datetime(value: object) -> Optional[datetime]:
    if not isinstance(value, str) or not value.strip():
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _is_finite_number(value: object) -> bool:
    if not isinstance(value, (float, int)):
        return False
    return math.isfinite(float(value))


def _room_key(workspace_id: str, board_id: str) -> str:
    return f"board:{workspace_id}:{board_id}"
