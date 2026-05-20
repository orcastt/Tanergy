from __future__ import annotations

import os
import time
from collections import deque
from typing import Deque

from tangent_api.security_redis import increment_security_counter


REALTIME_ROOM_CONNECTION_RATE_WINDOW_SECONDS = 10


class RealtimeMessageRateLimiter:
    def __init__(
        self,
        *,
        board_id: str | None = None,
        client_instance_id: str | None = None,
        room_key: str | None = None,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> None:
        self._timestamps: Deque[float] = deque()
        self._board_id = board_id
        self._client_instance_id = client_instance_id
        self._room_key = room_key
        self._user_id = user_id
        self._workspace_id = workspace_id

    def allow(self, *, now: float | None = None) -> bool:
        current_time = time.monotonic() if now is None else now
        window_seconds = _env_float("TANGENT_REALTIME_MESSAGE_RATE_WINDOW_SECONDS", 10.0)
        limit = _env_int("TANGENT_REALTIME_MESSAGES_PER_WINDOW", 240)
        if limit <= 0:
            return False
        distributed = _allow_distributed_rate(
            limit=limit,
            raw_key=_security_key(
                "message",
                self._board_id,
                self._room_key,
                self._workspace_id,
                self._user_id,
                self._client_instance_id,
            ),
            scope="realtime_message_rate",
            ttl_seconds=_ttl_seconds(window_seconds),
        )
        if distributed is not None:
            return distributed
        cutoff = current_time - window_seconds
        while self._timestamps and self._timestamps[0] <= cutoff:
            self._timestamps.popleft()
        if len(self._timestamps) >= limit:
            return False
        self._timestamps.append(current_time)
        return True


def allow_realtime_room_connection(
    *,
    board_id: str,
    room_key: str,
    user_id: str | None = None,
    workspace_id: str | None = None,
) -> bool:
    limit = realtime_room_connection_limit()
    if limit <= 0:
        return False
    distributed = _allow_distributed_rate(
        limit=limit,
        raw_key=_security_key("connection", board_id, room_key, workspace_id, user_id),
        scope="realtime_room_connection_rate",
        ttl_seconds=REALTIME_ROOM_CONNECTION_RATE_WINDOW_SECONDS,
    )
    return True if distributed is None else distributed


def realtime_room_connection_limit() -> int:
    return _env_int("TANGENT_REALTIME_ROOM_CONNECTION_LIMIT", 64)


def _allow_distributed_rate(
    *,
    limit: int,
    raw_key: str,
    scope: str,
    ttl_seconds: int,
) -> bool | None:
    if not _redis_security_enabled():
        return None
    result = increment_security_counter(
        scope=scope,
        raw_key=raw_key,
        ttl_seconds=ttl_seconds,
    )
    if result is None:
        return None
    return result.count <= limit


def _security_key(*parts: str | None) -> str:
    safe_parts = [part.strip() for part in parts if isinstance(part, str) and part.strip()]
    return "|".join(safe_parts) or "unknown"


def _ttl_seconds(window_seconds: float) -> int:
    return max(1, int(window_seconds))


def _redis_security_enabled() -> bool:
    value = os.getenv("TANGENT_SECURITY_REDIS_ENABLED", "0").strip().lower()
    return value not in {"0", "false", "off", "no"}


def _env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(0, value)


def _env_float(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(0.1, value)
