from __future__ import annotations

import os
from urllib.parse import urlparse


LOCAL_ORIGINS = {
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3100",
    "http://localhost:3000",
    "http://localhost:3100",
}


def configured_http_origins() -> list[str]:
    return _configured_origins("TANGENT_ALLOWED_ORIGINS", default=",".join(sorted(LOCAL_ORIGINS)))


def is_request_origin_allowed(origin: str | None, *, require_origin: bool = False) -> bool:
    if not origin:
        return not require_origin
    normalized_origin = _normalize_origin(origin)
    if normalized_origin is None:
        return False
    allowed_origins = {
        *_configured_origins("TANGENT_ALLOWED_ORIGINS", default=",".join(sorted(LOCAL_ORIGINS))),
        *_configured_origins("TANGENT_ALLOWED_WEBSOCKET_ORIGINS", default=""),
    }
    return normalized_origin in allowed_origins


def should_require_websocket_origin() -> bool:
    value = os.getenv("TANGENT_REQUIRE_WEBSOCKET_ORIGIN")
    if value is not None:
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return _is_production_like()


def _configured_origins(env_name: str, *, default: str) -> list[str]:
    origins: list[str] = []
    for raw_origin in os.getenv(env_name, default).split(","):
        normalized_origin = _normalize_origin(raw_origin)
        if normalized_origin is None:
            continue
        if normalized_origin == "*" and _is_production_like():
            continue
        origins.append(normalized_origin)
    return sorted(set(origins))


def _normalize_origin(origin: str | None) -> str | None:
    if not isinstance(origin, str):
        return None
    normalized = origin.strip().rstrip("/")
    if not normalized:
        return None
    if normalized == "*":
        return normalized
    parsed = urlparse(normalized)
    if parsed.scheme not in {"http", "https"}:
        return None
    if not parsed.netloc:
        return None
    return f"{parsed.scheme}://{parsed.netloc}"


def _is_production_like() -> bool:
    return any(
        os.getenv(name, "").strip().lower() in {"prod", "production", "staging"}
        for name in ("TANGENT_ENV", "ENVIRONMENT", "APP_ENV", "PYTHON_ENV")
    )
