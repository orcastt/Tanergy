from __future__ import annotations

import hashlib
import os
import time
from collections import deque
from typing import Deque

from fastapi import HTTPException, Request

from tangent_api.security_events import record_security_event
from tangent_api.security_redis import increment_security_counter


_ATTEMPTS: dict[str, Deque[float]] = {}


def enforce_share_password_attempt_limit(
    request: Request,
    share_id: str,
    password: str | None,
) -> None:
    if not password or not password.strip():
        return
    limit = _env_int("TANGENT_SHARE_PASSWORD_ATTEMPT_LIMIT", 20)
    if limit <= 0:
        _raise_limited(limit, _window_seconds())
    key = _attempt_key(request, share_id)
    distributed = increment_security_counter(
        scope="share_password_attempt",
        raw_key=key,
        ttl_seconds=_window_seconds(),
    )
    if distributed is not None:
        if distributed.count > limit:
            _record_denial(share_id, distributed.ttl_seconds)
            _raise_limited(limit, distributed.ttl_seconds)
        return
    retry_after = _record_memory_attempt(key, limit)
    if retry_after is not None:
        _record_denial(share_id, retry_after)
        _raise_limited(limit, retry_after)


def reset_share_password_attempt_state() -> None:
    _ATTEMPTS.clear()


def _record_memory_attempt(key: str, limit: int) -> int | None:
    now = time.monotonic()
    window = _window_seconds()
    bucket = _ATTEMPTS.setdefault(key, deque())
    cutoff = now - window
    while bucket and bucket[0] <= cutoff:
        bucket.popleft()
    bucket.append(now)
    if len(bucket) <= limit:
        return None
    return max(1, int(bucket[0] + window - now))


def _attempt_key(request: Request, share_id: str) -> str:
    client_host = request.client.host if request.client else "unknown"
    share_hash = hashlib.sha256(share_id.encode("utf-8", errors="replace")).hexdigest()[:16]
    return f"{client_host}|{share_hash}"


def _record_denial(share_id: str, retry_after_seconds: int) -> None:
    share_hash = hashlib.sha256(share_id.encode("utf-8", errors="replace")).hexdigest()[:16]
    record_security_event(
        action="board_share.password_attempt",
        decision="deny",
        metadata={"retryAfterSeconds": retry_after_seconds, "shareHash": share_hash},
        reason="share_password_attempt_limit_exceeded",
        resource_id=share_hash,
        resource_type="board_share_link",
    )


def _raise_limited(limit: int, retry_after_seconds: int) -> None:
    raise HTTPException(
        status_code=429,
        detail="Too many share password attempts. Please wait and try again.",
        headers={
            "Retry-After": str(max(1, retry_after_seconds)),
            "X-RateLimit-Limit": str(limit),
            "X-RateLimit-Remaining": "0",
        },
    )


def _window_seconds() -> int:
    return _env_int("TANGENT_SHARE_PASSWORD_ATTEMPT_WINDOW_SECONDS", 900)


def _env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(0, value)
