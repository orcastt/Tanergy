from __future__ import annotations

import logging
import os
import resource
import time
from typing import Any

from fastapi import Request


_LOGGER = logging.getLogger(__name__)
_LAST_MEMORY_LOG_AT = 0.0


def observe_http_response(request: Request, response: Any, elapsed_ms: float) -> None:
    status_code = int(getattr(response, "status_code", 0) or 0)
    path = request.url.path
    slow_threshold = _env_float("TANGENT_API_SLOW_RESPONSE_MS", 1000.0)
    if slow_threshold and elapsed_ms >= slow_threshold:
        _LOGGER.warning(
            "Slow API response %.1fms threshold=%.0fms method=%s path=%s status=%s",
            elapsed_ms,
            slow_threshold,
            request.method.upper(),
            path,
            status_code,
        )
    _observe_memory(path)


def elapsed_ms_since(started_at: float) -> float:
    return (time.perf_counter() - started_at) * 1000


def _observe_memory(path: str) -> None:
    threshold_mb = _env_float("TANGENT_MEMORY_RSS_WARN_MB", 0.0)
    if threshold_mb <= 0:
        return
    rss_mb = _current_rss_mb()
    if rss_mb < threshold_mb:
        return

    global _LAST_MEMORY_LOG_AT
    now = time.monotonic()
    min_interval = _env_float("TANGENT_MEMORY_LOG_INTERVAL_SECONDS", 60.0)
    if now - _LAST_MEMORY_LOG_AT < min_interval:
        return
    _LAST_MEMORY_LOG_AT = now
    _LOGGER.warning(
        "High API memory RSS %.1fMB threshold=%.0fMB path=%s",
        rss_mb,
        threshold_mb,
        path,
    )


def _current_rss_mb() -> float:
    usage = resource.getrusage(resource.RUSAGE_SELF)
    rss = float(usage.ru_maxrss)
    if os.uname().sysname == "Darwin":
        return rss / (1024 * 1024)
    return rss / 1024


def _env_float(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(0.0, value)
