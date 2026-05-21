from __future__ import annotations

import json
from typing import Any

from tangent_api.security_persistence_core import security_persistence_enabled
from tangent_api.storage.postgres_connection import connect_to_postgres


def load_idempotency_response(*, cache_key: str, scope: str) -> tuple[str | None, Any] | None:
    if not security_persistence_enabled():
        return None
    try:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                _delete_expired_idempotency_rows(cursor)
                cursor.execute(
                    """
                    SELECT COALESCE(request_fingerprint, response_hash), response_json
                    FROM tangent_idempotency_keys
                    WHERE key = %s AND scope = %s AND expires_at > NOW()
                    """,
                    (cache_key, scope),
                )
                row = cursor.fetchone()
            connection.commit()
        if row is None:
            return None
        return str(row[0]) if row[0] else None, row[1]
    except Exception:
        return None


def claim_idempotency_key(*, cache_key: str, scope: str, fingerprint: str, ttl_seconds: int) -> bool | None:
    if not security_persistence_enabled():
        return None
    try:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                _delete_expired_idempotency_rows(cursor)
                cursor.execute(
                    """
                    INSERT INTO tangent_idempotency_keys (
                        key, scope, response_hash, request_fingerprint, response_json, expires_at
                    ) VALUES (%s, %s, %s, %s, NULL, NOW() + (%s || ' seconds')::interval)
                    ON CONFLICT (key) DO NOTHING
                    RETURNING key
                    """,
                    (cache_key, scope, fingerprint, fingerprint, ttl_seconds),
                )
                inserted = cursor.fetchone() is not None
            connection.commit()
        return inserted
    except Exception:
        return None


def store_idempotency_response(*, cache_key: str, scope: str, response: Any) -> bool:
    if not security_persistence_enabled():
        return False
    try:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    """
                    UPDATE tangent_idempotency_keys
                    SET response_json = %s::jsonb
                    WHERE key = %s AND scope = %s
                    """,
                    (json.dumps(response), cache_key, scope),
                )
            connection.commit()
        return True
    except Exception:
        return False


def release_idempotency_key(*, cache_key: str, scope: str) -> None:
    if not security_persistence_enabled():
        return
    try:
        with connect_to_postgres() as connection:
            with connection.cursor() as cursor:
                cursor.execute(
                    "DELETE FROM tangent_idempotency_keys WHERE key = %s AND scope = %s AND response_json IS NULL",
                    (cache_key, scope),
                )
            connection.commit()
    except Exception:
        return


def _delete_expired_idempotency_rows(cursor: Any) -> None:
    cursor.execute("DELETE FROM tangent_idempotency_keys WHERE expires_at <= NOW()")
