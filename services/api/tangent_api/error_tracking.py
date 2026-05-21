from __future__ import annotations

import logging
import os
from typing import Any, Optional


_LOGGER = logging.getLogger(__name__)


def configure_error_tracking() -> bool:
    dsn = os.getenv("SENTRY_DSN", "").strip() or os.getenv("TANGENT_ERROR_TRACKING_DSN", "").strip()
    if not dsn:
        return False

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
    except ImportError:
        _LOGGER.warning("Error tracking DSN is configured but sentry-sdk is not installed.")
        return False

    sentry_sdk.init(
        before_send=_scrub_sentry_event,
        dsn=dsn,
        environment=_environment(),
        integrations=[FastApiIntegration()],
        release=_release(),
        send_default_pii=False,
        traces_sample_rate=_sample_rate(),
    )
    return True


def _environment() -> str:
    return (
        os.getenv("APP_ENV")
        or os.getenv("TANGENT_ENV")
        or os.getenv("ENVIRONMENT")
        or "development"
    )


def _release() -> Optional[str]:
    return os.getenv("SENTRY_RELEASE") or os.getenv("VERCEL_GIT_COMMIT_SHA")


def _sample_rate() -> float:
    try:
        value = float(os.getenv("SENTRY_TRACES_SAMPLE_RATE", "0.05"))
    except ValueError:
        return 0.05
    return min(1.0, max(0.0, value))


def _scrub_sentry_event(event: dict[str, Any], _hint: dict[str, Any]) -> dict[str, Any]:
    request = event.get("request")
    if isinstance(request, dict):
        request.pop("cookies", None)
        request.pop("query_string", None)
        headers = request.get("headers")
        if isinstance(headers, dict):
            for key in list(headers):
                if key.lower() in {
                    "authorization",
                    "cookie",
                    "set-cookie",
                    "x-tangent-share-password",
                }:
                    headers.pop(key, None)
    user = event.get("user")
    if isinstance(user, dict):
        event["user"] = {"id": str(user["id"])} if user.get("id") else {}
    return event
