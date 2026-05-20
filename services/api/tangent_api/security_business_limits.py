from __future__ import annotations

import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.security_events import record_security_event
from tangent_api.security_persistence import increment_daily_usage
from tangent_api.security_redis import increment_security_counter


_DAILY_COUNTS: dict[tuple[str, str, str, str], int] = defaultdict(int)


def assert_daily_business_limit(
    context: ApiRequestContext,
    *,
    action: str,
    default_limit: int,
    env_name: str,
) -> None:
    if os.getenv("TANGENT_BUSINESS_QUOTAS_ENABLED", "1").strip().lower() in {"0", "false", "off", "no"}:
        return
    limit = _env_int(env_name, default_limit)
    if limit <= 0:
        _deny(context, action, limit)
    redis_count = _increment_redis_daily_count(context, action)
    if redis_count is not None:
        if redis_count > limit:
            _deny(context, action, limit)
        return
    persisted_count = increment_daily_usage(
        action=action,
        user_id=context.user_id,
        workspace_id=context.workspace_id,
    )
    if persisted_count is not None:
        if persisted_count > limit:
            _deny(context, action, limit)
        return
    key = (_utc_day(), context.user_id, context.workspace_id, action)
    if _DAILY_COUNTS[key] >= limit:
        _deny(context, action, limit)
    _DAILY_COUNTS[key] += 1


def reset_business_limit_state() -> None:
    _DAILY_COUNTS.clear()


def _deny(context: ApiRequestContext, action: str, limit: int) -> None:
    record_security_event(
        action=f"{action}.quota_denied",
        context=context,
        decision="deny",
        metadata={"dailyLimit": limit},
        reason="daily_business_quota_exceeded",
    )
    raise HTTPException(status_code=429, detail="Daily usage limit reached. Please wait or contact an administrator.")


def _utc_day() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _increment_redis_daily_count(context: ApiRequestContext, action: str) -> int | None:
    result = increment_security_counter(
        scope="business_daily_quota",
        raw_key="|".join([_utc_day(), context.user_id, context.workspace_id, action]),
        ttl_seconds=_seconds_until_next_utc_day() + 3600,
    )
    return result.count if result is not None else None


def _seconds_until_next_utc_day() -> int:
    now = datetime.now(timezone.utc)
    tomorrow = (now + timedelta(days=1)).date()
    next_day = datetime(tomorrow.year, tomorrow.month, tomorrow.day, tzinfo=timezone.utc)
    return max(60, int((next_day - now).total_seconds()))


def _env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(0, value)
