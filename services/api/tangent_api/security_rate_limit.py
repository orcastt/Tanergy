from __future__ import annotations

import hashlib
import os
import time
from collections import deque
from dataclasses import dataclass
from typing import Deque

from fastapi import Request
from fastapi.responses import JSONResponse
from tangent_api.security_events import record_security_event
from tangent_api.security_redis import increment_security_counter


WINDOW_SECONDS = 60.0
_REQUESTS: dict[str, Deque[float]] = {}


@dataclass(frozen=True)
class RateLimitDecision:
    allowed: bool
    limit: int
    remaining: int
    retry_after_seconds: int


def check_http_rate_limit(request: Request) -> JSONResponse | None:
    if os.getenv("TANGENT_HTTP_RATE_LIMIT_ENABLED", "1").strip().lower() in {"0", "false", "off", "no"}:
        return None
    route_class = _route_class(request)
    if route_class == "unlimited":
        return None
    rate_key = _rate_key(request, route_class)
    limit = _limit_for_route_class(route_class)
    decision = _allow_distributed_request(rate_key, limit)
    if decision is None:
        decision = _allow_request(rate_key, limit, time.monotonic())
    if decision.allowed:
        return None
    record_security_event(
        action="http.rate_limit",
        decision="deny",
        metadata={
            "method": request.method.upper(),
            "path": request.url.path,
            "routeClass": route_class,
        },
        reason="http_rate_limit_exceeded",
    )
    response = JSONResponse(
        {"detail": "Too many requests. Please wait and try again."},
        status_code=429,
    )
    response.headers["Retry-After"] = str(decision.retry_after_seconds)
    response.headers["X-RateLimit-Limit"] = str(decision.limit)
    response.headers["X-RateLimit-Remaining"] = "0"
    return response


def reset_http_rate_limit_state() -> None:
    _REQUESTS.clear()


def _allow_distributed_request(key: str, limit: int) -> RateLimitDecision | None:
    if limit <= 0:
        return RateLimitDecision(False, 0, 0, int(WINDOW_SECONDS))
    result = increment_security_counter(
        scope="http_rate_limit",
        raw_key=key,
        ttl_seconds=int(WINDOW_SECONDS),
    )
    if result is None:
        return None
    remaining = max(0, limit - result.count)
    if result.count > limit:
        return RateLimitDecision(False, limit, 0, result.ttl_seconds)
    return RateLimitDecision(True, limit, remaining, 0)


def _allow_request(key: str, limit: int, now: float) -> RateLimitDecision:
    if limit <= 0:
        return RateLimitDecision(False, 0, 0, int(WINDOW_SECONDS))
    bucket = _REQUESTS.setdefault(key, deque())
    cutoff = now - WINDOW_SECONDS
    while bucket and bucket[0] <= cutoff:
        bucket.popleft()
    if len(bucket) >= limit:
        retry_after = max(1, int(bucket[0] + WINDOW_SECONDS - now))
        return RateLimitDecision(False, limit, 0, retry_after)
    bucket.append(now)
    return RateLimitDecision(True, limit, max(0, limit - len(bucket)), 0)


def _rate_key(request: Request, route_class: str) -> str:
    ip_address = request.client.host if request.client else "unknown"
    user_marker = request.headers.get("x-tangent-user-id") or _hash_header(request.headers.get("authorization"))
    workspace_id = request.headers.get("x-tangent-workspace-id") or "no-workspace"
    path_marker = _rate_path_marker(request.url.path, route_class)
    return "|".join([route_class, request.method.upper(), path_marker, ip_address, workspace_id, user_marker or "anonymous"])


def _hash_header(value: str | None) -> str | None:
    if not value:
        return None
    return hashlib.sha256(value.encode("utf-8", errors="replace")).hexdigest()[:16]


def _limit_for_route_class(route_class: str) -> int:
    if route_class == "auth":
        return _env_int("TANGENT_AUTH_RATE_LIMIT_PER_MINUTE", 20)
    if route_class == "high_cost":
        return _env_int("TANGENT_HIGH_COST_RATE_LIMIT_PER_MINUTE", 120)
    if route_class == "public":
        return _env_int("TANGENT_PUBLIC_RATE_LIMIT_PER_MINUTE", 120)
    if route_class == "asset_file":
        return _env_int("TANGENT_ASSET_FILE_RATE_LIMIT_PER_MINUTE", 300)
    if route_class == "admin_write":
        return _env_int("TANGENT_ADMIN_WRITE_RATE_LIMIT_PER_MINUTE", 60)
    return _env_int("TANGENT_HTTP_RATE_LIMIT_PER_MINUTE", 600)


def _route_class(request: Request) -> str:
    path = request.url.path
    method = request.method.upper()
    if path == "/health" or method == "OPTIONS" or path.startswith("/docs") or path.startswith("/openapi"):
        return "unlimited"
    if path.startswith("/api/v1/auth"):
        return "auth"
    if method != "GET" and path.startswith("/api/v1/admin/"):
        return "admin_write"
    if _is_high_cost_path(path, method):
        return "high_cost"
    if method == "GET" and path.startswith("/api/v1/assets/files/"):
        return "asset_file"
    if _is_public_path(path):
        return "public"
    return "default"


def _is_high_cost_path(path: str, method: str) -> bool:
    if method not in {"POST", "PUT", "PATCH"}:
        return False
    return (
        path.startswith("/api/v1/ai/")
        or path.startswith("/api/v1/image-ops/")
        or path.startswith("/api/v1/assets/")
        or path.startswith("/api/v1/billing/")
        or path.endswith("/invitations")
        or "/invitations/" in path
        or path.endswith("/invite")
        or path.endswith("/export")
    )


def _is_public_path(path: str) -> bool:
    return path.startswith("/api/v1/boards/share-links/") or "/share/" in path or path.startswith("/api/v1/public/")


def _rate_path_marker(path: str, route_class: str) -> str:
    if route_class == "public":
        if path.startswith("/api/v1/boards/share-links/"):
            return "/api/v1/boards/share-links/*"
        if "/share/" in path:
            return "/share/*"
        return "/api/v1/public/*"
    if route_class == "asset_file":
        return "/api/v1/assets/files/*"
    return path


def _env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(0, value)
