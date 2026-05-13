from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from typing import Any

BOARD_REALTIME_DOCUMENT_COMPACTION_THRESHOLD = 48
BOARD_REALTIME_DOCUMENT_UPDATE_COUNT_LIMIT = 96
BOARD_REALTIME_DOCUMENT_TOTAL_BYTE_LIMIT = 8 * 1024 * 1024
BOARD_REALTIME_UPDATE_BYTE_LIMIT = 256 * 1024
BOARD_REALTIME_WEBSOCKET_MESSAGE_BYTE_LIMIT = 2 * 1024 * 1024
BOARD_REALTIME_AWARENESS_STATE_COUNT_LIMIT = 128
BOARD_REALTIME_AWARENESS_STATE_BYTE_LIMIT = 16 * 1024
BOARD_REALTIME_AWARENESS_TTL_SECONDS = 300


def normalize_realtime_update(value: Any) -> list[int] | None:
    if not isinstance(value, list):
        return None
    if len(value) > BOARD_REALTIME_UPDATE_BYTE_LIMIT:
        return None
    normalized: list[int] = []
    for item in value:
        if not isinstance(item, int) or item < 0 or item > 255:
            return None
        normalized.append(item)
    return normalized


def normalize_realtime_document_updates(value: object) -> list[list[int]]:
    if not isinstance(value, list):
        return []
    normalized: list[list[int]] = []
    total_bytes = 0
    for item in value[:BOARD_REALTIME_DOCUMENT_UPDATE_COUNT_LIMIT]:
        update = normalize_realtime_update(item)
        if update is None:
            continue
        total_bytes += len(update)
        if total_bytes > BOARD_REALTIME_DOCUMENT_TOTAL_BYTE_LIMIT:
            break
        normalized.append(update)
    return normalized


def get_realtime_document_total_bytes(updates: list[list[int]]) -> int:
    return sum(len(update) for update in updates)


def can_append_realtime_document_update(updates: list[list[int]], update: list[int]) -> bool:
    if len(updates) >= BOARD_REALTIME_DOCUMENT_UPDATE_COUNT_LIMIT:
        return False
    return get_realtime_document_total_bytes(updates) + len(update) <= BOARD_REALTIME_DOCUMENT_TOTAL_BYTE_LIMIT


def normalize_realtime_awareness_state(
    value: dict[str, Any],
    client_instance_id: str,
    now: datetime | None = None,
) -> dict[str, Any] | None:
    now = now or datetime.now(timezone.utc)
    expires_at = parse_realtime_awareness_expiry(value)
    if expires_at is None or expires_at <= now:
        return None
    max_expires_at = now + timedelta(seconds=BOARD_REALTIME_AWARENESS_TTL_SECONDS)
    if expires_at > max_expires_at:
        expires_at = max_expires_at

    normalized = dict(value)
    normalized["clientInstanceId"] = client_instance_id
    normalized["expiresAt"] = expires_at.isoformat()
    try:
        encoded = json.dumps(normalized, ensure_ascii=False, separators=(",", ":"))
    except (TypeError, ValueError):
        return None
    if len(encoded.encode("utf-8")) > BOARD_REALTIME_AWARENESS_STATE_BYTE_LIMIT:
        return None
    return normalized


def parse_realtime_awareness_expiry(state: dict[str, Any]) -> datetime | None:
    expires_at = state.get("expiresAt")
    if not isinstance(expires_at, str):
        return None
    try:
        parsed = datetime.fromisoformat(expires_at.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed
