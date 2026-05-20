from __future__ import annotations

import hashlib
import os
import re
import time
from dataclasses import dataclass
from typing import Any

try:
    from redis import Redis
except Exception:  # pragma: no cover - redis is optional in local/dev tests.
    Redis = None  # type: ignore[assignment]


_SCOPE_PATTERN = re.compile(r"[^a-zA-Z0-9_.-]+")
_CLIENT: Any | None = None
_CLIENT_URL: str | None = None
_DISABLED_UNTIL = 0.0
_INCREMENT_WITH_TTL_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('TTL', KEYS[1])
if ttl < 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
  ttl = tonumber(ARGV[1])
end
return {count, ttl}
"""


@dataclass(frozen=True)
class RedisCounterResult:
    count: int
    ttl_seconds: int


def increment_security_counter(
    *,
    scope: str,
    raw_key: str,
    ttl_seconds: int,
) -> RedisCounterResult | None:
    client = _redis_client()
    if client is None:
        return None
    ttl = max(1, int(ttl_seconds))
    key = _redis_key(scope, raw_key)
    try:
        count, current_ttl = client.eval(_INCREMENT_WITH_TTL_SCRIPT, 1, key, ttl)
        count = int(count)
        current_ttl = int(current_ttl)
        return RedisCounterResult(count=count, ttl_seconds=max(1, current_ttl))
    except Exception:
        _pause_redis_after_error()
        return None


def reset_security_redis_state_for_tests() -> None:
    global _CLIENT, _CLIENT_URL, _DISABLED_UNTIL
    _CLIENT = None
    _CLIENT_URL = None
    _DISABLED_UNTIL = 0.0


def _redis_client() -> Any | None:
    global _CLIENT, _CLIENT_URL
    if not _redis_enabled() or Redis is None:
        return None
    now = time.monotonic()
    if now < _DISABLED_UNTIL:
        return None
    redis_url = _redis_url()
    if not redis_url:
        return None
    if _CLIENT is not None and _CLIENT_URL == redis_url:
        return _CLIENT
    _CLIENT = Redis.from_url(
        redis_url,
        decode_responses=True,
        socket_connect_timeout=_env_float("TANGENT_REDIS_CONNECT_TIMEOUT_SECONDS", 0.3),
        socket_timeout=_env_float("TANGENT_REDIS_SOCKET_TIMEOUT_SECONDS", 0.5),
    )
    _CLIENT_URL = redis_url
    return _CLIENT


def _redis_key(scope: str, raw_key: str) -> str:
    prefix = os.getenv("TANGENT_REDIS_KEY_PREFIX", "tangent").strip() or "tangent"
    normalized_scope = _SCOPE_PATTERN.sub("_", scope.strip() or "default")[:80]
    digest = hashlib.sha256(raw_key.encode("utf-8", errors="replace")).hexdigest()
    return f"{prefix}:security:{normalized_scope}:{digest}"


def _redis_enabled() -> bool:
    value = os.getenv("TANGENT_SECURITY_REDIS_ENABLED", "0").strip().lower()
    return value not in {"0", "false", "off", "no"}


def _redis_url() -> str:
    return (
        os.getenv("TANGENT_REDIS_URL", "").strip()
        or os.getenv("REDIS_URL", "").strip()
        or os.getenv("UPSTASH_REDIS_URL", "").strip()
    )


def _pause_redis_after_error() -> None:
    global _DISABLED_UNTIL
    retry_seconds = _env_float("TANGENT_SECURITY_REDIS_RETRY_SECONDS", 5.0)
    _DISABLED_UNTIL = time.monotonic() + retry_seconds


def _env_float(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(0.05, value)
