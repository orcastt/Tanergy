from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import WebSocket

from tangent_api.realtime.board_realtime_limits import (
    BOARD_REALTIME_AWARENESS_STATE_COUNT_LIMIT,
    BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD,
    parse_realtime_awareness_expiry,
)


@dataclass
class BoardRealtimeConnection:
    client_instance_id: str
    connection_id: str
    websocket: WebSocket


async def _broadcast_json(websockets: list[WebSocket], payload: dict[str, Any]) -> None:
    for websocket in websockets:
        try:
            await websocket.send_json(payload)
        except Exception:
            continue


def _parse_awareness_expiry(state: dict[str, Any]) -> datetime | None:
    return parse_realtime_awareness_expiry(state)


def _should_request_compaction(document_updates: list[list[int]]) -> bool:
    return len(document_updates) >= BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD


def _limit_awareness_states(awareness_states: dict[str, dict[str, Any]]) -> None:
    if len(awareness_states) <= BOARD_REALTIME_AWARENESS_STATE_COUNT_LIMIT:
        return
    stale_client_ids = [
        client_id
        for client_id, _state in sorted(
            awareness_states.items(),
            key=lambda item: _awareness_sort_timestamp(item[1]),
            reverse=True,
        )[BOARD_REALTIME_AWARENESS_STATE_COUNT_LIMIT:]
    ]
    for client_id in stale_client_ids:
        awareness_states.pop(client_id, None)


def _prune_expired_awareness_states(
    awareness_states: dict[str, dict[str, Any]],
    now: datetime | None = None,
) -> list[str]:
    current_time = now or datetime.now(timezone.utc)
    removed_client_ids: list[str] = []
    for client_instance_id, state in list(awareness_states.items()):
        expires_at = _parse_awareness_expiry(state)
        if expires_at is None or expires_at <= current_time:
            awareness_states.pop(client_instance_id, None)
            removed_client_ids.append(client_instance_id)
    return removed_client_ids


def _awareness_sort_timestamp(state: dict[str, Any]) -> float:
    updated_at = state.get("updatedAt")
    if not isinstance(updated_at, str):
        return 0
    try:
        parsed = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
    except ValueError:
        return 0
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()
