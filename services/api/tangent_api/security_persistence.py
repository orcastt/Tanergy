from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from tangent_api.security_persistence_core import security_persistence_enabled
from tangent_api.storage.postgres_connection import connect_to_postgres


def persist_security_event(event: dict[str, Any]) -> bool:
    if not security_persistence_enabled():
        return False
    try:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO tangent_security_events (
                        id, actor_user_id, workspace_id, resource_type, resource_id,
                        action, decision, reason, metadata, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s)
                    """,
                    (
                        event["id"],
                        event.get("actorUserId"),
                        event.get("workspaceId"),
                        event.get("resourceType"),
                        event.get("resourceId"),
                        event["action"],
                        event["decision"],
                        event["reason"],
                        json.dumps(event.get("metadata") or {}),
                        _parse_timestamp(str(event["createdAt"])),
                    ),
                )
            connection.commit()
        return True
    except Exception:
        return False


def increment_daily_usage(*, action: str, user_id: str, workspace_id: str) -> int | None:
    if not security_persistence_enabled():
        return None
    try:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    INSERT INTO tangent_security_daily_usage (
                        usage_day, actor_user_id, workspace_id, action, count, updated_at
                    ) VALUES (CURRENT_DATE, %s, %s, %s, 1, NOW())
                    ON CONFLICT (usage_day, actor_user_id, workspace_id, action)
                    DO UPDATE SET
                        count = tangent_security_daily_usage.count + 1,
                        updated_at = NOW()
                    RETURNING count
                    """,
                    (user_id, workspace_id, action),
                )
                row = cursor.fetchone()
            connection.commit()
        return int(row[0]) if row else None
    except Exception:
        return None


def _parse_timestamp(value: str) -> datetime:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return datetime.now(timezone.utc)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=timezone.utc)
    return parsed
