from __future__ import annotations

import json
import logging
from collections import deque
from datetime import datetime, timezone
from typing import Any, Deque
from uuid import uuid4

from tangent_api.request_context import ApiRequestContext
from tangent_api.security_persistence import persist_security_event


logger = logging.getLogger("tangent.security")
_EVENTS: Deque[dict[str, Any]] = deque(maxlen=1000)


def record_security_event(
    *,
    action: str,
    decision: str,
    reason: str,
    context: ApiRequestContext | None = None,
    metadata: dict[str, Any] | None = None,
    resource_id: str | None = None,
    resource_type: str | None = None,
) -> dict[str, Any]:
    event = {
        "action": action,
        "actorUserId": context.user_id if context else None,
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "decision": decision,
        "id": f"security_event_{uuid4()}",
        "metadata": _safe_metadata(metadata or {}),
        "reason": reason,
        "resourceId": resource_id,
        "resourceType": resource_type,
        "workspaceId": context.workspace_id if context else None,
    }
    _EVENTS.append(event)
    persist_security_event(event)
    logger.info("security_event %s", json.dumps(event, sort_keys=True))
    return event


def list_recent_security_events() -> list[dict[str, Any]]:
    return list(_EVENTS)


def reset_security_events() -> None:
    _EVENTS.clear()


def _safe_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    safe: dict[str, Any] = {}
    blocked_keys = {"authorization", "cookie", "password", "secret", "token"}
    for key, value in metadata.items():
        if any(blocked in str(key).lower() for blocked in blocked_keys):
            safe[str(key)] = "[redacted]"
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            safe[str(key)] = value
        elif isinstance(value, list):
            safe[str(key)] = value[:20]
        elif isinstance(value, dict):
            safe[str(key)] = _safe_metadata(value)
        else:
            safe[str(key)] = str(value)
    return safe
