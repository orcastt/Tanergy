from __future__ import annotations

import hashlib
import json
import os
import time
from dataclasses import dataclass
from typing import Any, Callable, TypeVar

from fastapi import HTTPException, Request

from tangent_api.request_context import ApiRequestContext
from tangent_api.security_events import record_security_event
from tangent_api.security_idempotency_store import (
    claim_idempotency_key,
    load_idempotency_response,
    release_idempotency_key,
    store_idempotency_response,
)


T = TypeVar("T")


@dataclass
class IdempotencyEntry:
    created_at: float
    fingerprint: str
    response: Any


_IDEMPOTENCY_CACHE: dict[str, IdempotencyEntry] = {}


def run_idempotent(
    request: Request,
    context: ApiRequestContext,
    *,
    action: str,
    fingerprint_payload: Any,
    produce: Callable[[], T],
) -> T:
    key = _normalize_idempotency_key(request.headers.get("Idempotency-Key"))
    if key is None:
        return produce()
    scope = "|".join([context.user_id, context.workspace_id, action])
    cache_key = _cache_key(scope, key)
    fingerprint = _fingerprint(fingerprint_payload)
    persisted = _run_persisted_idempotency(
        action=action,
        cache_key=cache_key,
        context=context,
        fingerprint=fingerprint,
        key=key,
        produce=produce,
        scope=scope,
    )
    if persisted.handled:
        return persisted.response
    _prune_idempotency_cache()
    existing = _IDEMPOTENCY_CACHE.get(cache_key)
    if existing is not None:
        if existing.fingerprint != fingerprint:
            _raise_idempotency_conflict(action, context, key)
        return existing.response
    response = produce()
    _IDEMPOTENCY_CACHE[cache_key] = IdempotencyEntry(
        created_at=time.monotonic(),
        fingerprint=fingerprint,
        response=_serialize_response(response),
    )
    return response


def reset_idempotency_state() -> None:
    _IDEMPOTENCY_CACHE.clear()


def _normalize_idempotency_key(value: str | None) -> str | None:
    if not isinstance(value, str):
        return None
    normalized = value.strip()
    if not normalized:
        return None
    if len(normalized) > 128:
        raise HTTPException(status_code=400, detail="Idempotency key is too long.")
    return normalized


def _fingerprint(value: Any) -> str:
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json", by_alias=True)
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


@dataclass
class PersistedResult:
    handled: bool
    response: Any = None


def _run_persisted_idempotency(
    *,
    action: str,
    cache_key: str,
    context: ApiRequestContext,
    fingerprint: str,
    key: str,
    produce: Callable[[], T],
    scope: str,
) -> PersistedResult:
    claim = claim_idempotency_key(
        cache_key=cache_key,
        fingerprint=fingerprint,
        scope=scope,
        ttl_seconds=_env_int("TANGENT_IDEMPOTENCY_TTL_SECONDS", 24 * 60 * 60),
    )
    if claim is None:
        return PersistedResult(False)
    if not claim:
        existing = load_idempotency_response(cache_key=cache_key, scope=scope)
        if existing is None:
            return PersistedResult(False)
        existing_fingerprint, response = existing
        if existing_fingerprint != fingerprint:
            _raise_idempotency_conflict(action, context, key)
        if response is None:
            raise HTTPException(status_code=409, detail="Idempotent request is already in progress.")
        return PersistedResult(True, response)
    try:
        response = produce()
    except Exception:
        release_idempotency_key(cache_key=cache_key, scope=scope)
        raise
    serialized = _serialize_response(response)
    store_idempotency_response(cache_key=cache_key, response=serialized, scope=scope)
    return PersistedResult(True, response)


def _raise_idempotency_conflict(action: str, context: ApiRequestContext, key: str) -> None:
    record_security_event(
        action=f"{action}.idempotency_conflict",
        context=context,
        decision="deny",
        metadata={"idempotencyKey": key},
        reason="idempotency_key_reused_with_different_payload",
    )
    raise HTTPException(status_code=409, detail="Idempotency key was already used with a different request.")


def _serialize_response(response: Any) -> Any:
    if hasattr(response, "model_dump"):
        return response.model_dump(mode="json", by_alias=True)
    return response


def _cache_key(scope: str, key: str) -> str:
    return hashlib.sha256(f"{scope}|{key}".encode("utf-8")).hexdigest()


def _prune_idempotency_cache() -> None:
    ttl_seconds = _env_int("TANGENT_IDEMPOTENCY_TTL_SECONDS", 24 * 60 * 60)
    cutoff = time.monotonic() - ttl_seconds
    for key, entry in list(_IDEMPOTENCY_CACHE.items()):
        if entry.created_at <= cutoff:
            _IDEMPOTENCY_CACHE.pop(key, None)


def _env_int(name: str, default: int) -> int:
    try:
        value = int(os.getenv(name, str(default)))
    except ValueError:
        return default
    return max(1, value)
