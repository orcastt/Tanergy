from __future__ import annotations

import logging
import os
import threading
import time
from typing import Any, Optional

from fastapi import HTTPException

_LOGGER = logging.getLogger(__name__)
_POOL_LOCK = threading.Lock()
_POSTGRES_POOL: Optional["_ReusablePostgresPool"] = None
_SLOW_QUERY_CURSOR_CLASSES: dict[Any, type] = {}


def require_database_url() -> str:
    database_url = _configured_database_url()
    if not database_url:
        raise HTTPException(
            status_code=501,
            detail="Postgres persistence is not configured. Missing config: DATABASE_URL or DATABASE_POOL_URL.",
        )
    return database_url


def resolve_database_connection_url() -> str:
    database_url = require_database_url()
    pool_url = os.getenv("DATABASE_POOL_URL", "").strip()
    return pool_url or database_url


def should_auto_create_tables() -> bool:
    return os.getenv("TANGENT_POSTGRES_AUTO_CREATE_TABLES", "1") != "0"


def connect_to_postgres() -> "_PooledPostgresConnection":
    return _PooledPostgresConnection(_get_postgres_pool())


class _PooledPostgresConnection:
    def __init__(self, pool: "_ReusablePostgresPool") -> None:
        self._connection: Any | None = None
        self._pooled = False
        self._pool = pool

    def __enter__(self) -> Any:
        self._connection, self._pooled = self._pool.acquire()
        return self._connection

    def __exit__(self, exc_type, exc, tb) -> bool:
        if self._connection is None:
            return False

        connection = self._connection
        pooled = self._pooled
        self._connection = None
        self._pooled = False

        try:
            if exc_type is None:
                connection.commit()
            else:
                connection.rollback()
        except Exception:
            self._pool.discard(connection, pooled=pooled)
            if exc_type is None:
                raise
            return False

        self._pool.release(connection, pooled=pooled)
        return False


class _ReusablePostgresPool:
    def __init__(self, database_url: str, *, pool_size: int, max_overflow: int) -> None:
        self.database_url = database_url
        self._idle: list[Any] = []
        self._idle_target = max(1, pool_size)
        self._lock = threading.Lock()
        self._max_total = self._idle_target + max(0, max_overflow)
        self._psycopg = _import_psycopg()
        self._total_connections = 0

    def acquire(self) -> tuple[Any, bool]:
        while True:
            with self._lock:
                connection = self._idle.pop() if self._idle else None
                if connection is None and self._total_connections < self._max_total:
                    self._total_connections += 1
                    create_pooled = True
                else:
                    create_pooled = False

            if connection is not None:
                if _can_checkout_connection(connection):
                    return connection, True
                self._close_tracked_connection(connection)
                continue

            if create_pooled:
                try:
                    return self._create_connection(), True
                except Exception:
                    self._decrement_total_connections()
                    raise

            return self._create_connection(), False

    def release(self, connection: Any, *, pooled: bool) -> None:
        if not pooled:
            self._close_untracked_connection(connection)
            return

        if not _can_reuse_connection(connection):
            self._close_tracked_connection(connection)
            return

        with self._lock:
            if len(self._idle) < self._idle_target:
                self._idle.append(connection)
                return

        self._close_tracked_connection(connection)

    def discard(self, connection: Any, *, pooled: bool) -> None:
        if pooled:
            self._close_tracked_connection(connection)
            return
        self._close_untracked_connection(connection)

    def close_idle_connections(self) -> None:
        with self._lock:
            idle_connections = self._idle
            self._idle = []
            self._total_connections -= len(idle_connections)

        for connection in idle_connections:
            _close_connection(connection)

    def _create_connection(self) -> Any:
        return self._psycopg.connect(
            self.database_url,
            connect_timeout=_resolve_pool_integer("TANGENT_DATABASE_CONNECT_TIMEOUT", default=8, minimum=1),
            cursor_factory=_slow_query_cursor_class(self._psycopg),
        )

    def _close_tracked_connection(self, connection: Any) -> None:
        _close_connection(connection)
        self._decrement_total_connections()

    def _close_untracked_connection(self, connection: Any) -> None:
        _close_connection(connection)

    def _decrement_total_connections(self) -> None:
        with self._lock:
            self._total_connections = max(0, self._total_connections - 1)


def _get_postgres_pool() -> _ReusablePostgresPool:
    global _POSTGRES_POOL
    database_url = resolve_database_connection_url()
    with _POOL_LOCK:
        if _POSTGRES_POOL is None or _POSTGRES_POOL.database_url != database_url:
            if _POSTGRES_POOL is not None:
                _POSTGRES_POOL.close_idle_connections()
            _POSTGRES_POOL = _ReusablePostgresPool(
                database_url,
                pool_size=_resolve_pool_integer("DATABASE_POOL_SIZE", default=5, minimum=1),
                max_overflow=_resolve_pool_integer("DATABASE_MAX_OVERFLOW", default=5, minimum=0),
            )
        return _POSTGRES_POOL


def _can_reuse_connection(connection: Any) -> bool:
    return not bool(getattr(connection, "broken", False) or getattr(connection, "closed", False))


def _can_checkout_connection(connection: Any) -> bool:
    if not _can_reuse_connection(connection):
        return False

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        connection.rollback()
    except Exception:
        return False

    return _can_reuse_connection(connection)


def _close_connection(connection: Any) -> None:
    try:
        connection.close()
    except Exception:
        return


def _resolve_pool_integer(name: str, *, default: int, minimum: int) -> int:
    raw = os.getenv(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(minimum, value)


def _configured_database_url() -> str:
    return os.getenv("DATABASE_URL", "").strip() or os.getenv("DATABASE_POOL_URL", "").strip()


def _slow_query_cursor_class(psycopg: Any) -> type:
    cached = _SLOW_QUERY_CURSOR_CLASSES.get(psycopg)
    if cached is not None:
        return cached

    class SlowQueryCursor(psycopg.Cursor):
        def execute(self, query, params=None, *, prepare=None, binary=None):  # type: ignore[no-untyped-def]
            started_at = time.perf_counter()
            try:
                return super().execute(query, params, prepare=prepare, binary=binary)
            finally:
                elapsed_ms = (time.perf_counter() - started_at) * 1000
                threshold_ms = _resolve_pool_integer("TANGENT_DATABASE_SLOW_QUERY_MS", default=200, minimum=0)
                if threshold_ms and elapsed_ms >= threshold_ms:
                    _LOGGER.warning(
                        "Slow Postgres query %.1fms threshold=%sms query=%s",
                        elapsed_ms,
                        threshold_ms,
                        _summarize_sql(query),
                    )

    _SLOW_QUERY_CURSOR_CLASSES[psycopg] = SlowQueryCursor
    return SlowQueryCursor


def _summarize_sql(query: Any) -> str:
    if isinstance(query, bytes):
        raw = query.decode("utf-8", errors="replace")
    else:
        raw = str(query)
    summary = " ".join(raw.split())
    if len(summary) <= 240:
        return summary
    return f"{summary[:237]}..."


def _import_psycopg():
    try:
        import psycopg
    except ImportError as exc:
        raise HTTPException(
            status_code=501,
            detail="psycopg is required for Postgres persistence.",
        ) from exc
    return psycopg
