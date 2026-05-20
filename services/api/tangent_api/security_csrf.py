from __future__ import annotations

import os

from fastapi import Request
from fastapi.responses import JSONResponse

from tangent_api.security_events import record_security_event
from tangent_api.security_origin import is_request_origin_allowed

SAFE_METHODS = {"GET", "HEAD", "OPTIONS", "TRACE"}


def check_csrf_origin(request: Request) -> JSONResponse | None:
    if os.getenv("TANGENT_CSRF_ORIGIN_CHECK_ENABLED", "1").strip().lower() in {"0", "false", "off", "no"}:
        return None
    method = request.method.upper()
    if method in SAFE_METHODS or _is_csrf_exempt_path(request.url.path):
        return None
    if not _uses_cookie_session(request) or _has_bearer_authorization(request):
        return None
    origin = request.headers.get("origin") or request.headers.get("referer")
    if is_request_origin_allowed(origin, require_origin=True):
        return None
    record_security_event(
        action="http.csrf_origin",
        decision="deny",
        metadata={
            "method": method,
            "originPresent": bool(origin),
            "path": request.url.path,
        },
        reason="csrf_origin_not_allowed",
    )
    return JSONResponse({"detail": "Request origin is not allowed."}, status_code=403)


def _uses_cookie_session(request: Request) -> bool:
    return bool(request.cookies.get("__session"))


def _has_bearer_authorization(request: Request) -> bool:
    authorization = request.headers.get("authorization") or ""
    return authorization.strip().lower().startswith("bearer ")


def _is_csrf_exempt_path(path: str) -> bool:
    return path.startswith("/api/v1/billing/webhooks/")
