from fastapi import HTTPException

from tangent_api.storage import postgres_connection


def test_require_database_url_accepts_pool_url(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_POOL_URL", "postgresql://pooling.example/tangent")

    assert postgres_connection.require_database_url() == "postgresql://pooling.example/tangent"


def test_resolve_database_connection_url_prefers_pool_url(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://direct.example/tangent")
    monkeypatch.setenv("DATABASE_POOL_URL", "postgresql://pooling.example/tangent")

    assert postgres_connection.resolve_database_connection_url() == "postgresql://pooling.example/tangent"


def test_require_database_url_reports_both_supported_envs(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("DATABASE_POOL_URL", raising=False)

    try:
        postgres_connection.require_database_url()
    except HTTPException as exc:
        assert exc.status_code == 501
        assert "DATABASE_URL" in exc.detail
        assert "DATABASE_POOL_URL" in exc.detail
    else:
        raise AssertionError("Expected missing database config to fail.")


def test_rollback_failure_does_not_mask_original_exception():
    class FakeConnection:
        def commit(self):
            raise AssertionError("commit should not run")

        def rollback(self):
            raise RuntimeError("connection is lost")

    class FakePool:
        def __init__(self):
            self.discard_calls: list[tuple[object, bool]] = []

        def acquire(self):
            return FakeConnection(), True

        def discard(self, connection, *, pooled):
            self.discard_calls.append((connection, pooled))

        def release(self, connection, *, pooled):
            raise AssertionError("release should not run")

    pool = FakePool()

    try:
        with postgres_connection._PooledPostgresConnection(pool):
            raise ValueError("original failure")
    except ValueError as exc:
        assert str(exc) == "original failure"
    else:
        raise AssertionError("Expected original failure to escape context manager.")

    assert len(pool.discard_calls) == 1
    assert pool.discard_calls[0][1] is True


def test_acquire_discards_idle_connection_that_fails_ping(monkeypatch):
    connect_calls: list[str] = []

    class FakeCursor:
        def __init__(self, *, should_fail: bool):
            self.should_fail = should_fail

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc, tb):
            return False

        def execute(self, query, params=None, *, prepare=None, binary=None):
            if self.should_fail:
                raise RuntimeError("stale connection")
            return None

    class FakeConnection:
        def __init__(self, *, label: str, should_fail: bool):
            self.label = label
            self.should_fail = should_fail
            self.closed = False
            self.broken = False
            self.rollback_calls = 0

        def cursor(self):
            return FakeCursor(should_fail=self.should_fail)

        def rollback(self):
            self.rollback_calls += 1

        def close(self):
            self.closed = True

    class FakePsycopg:
        Cursor = object

        @staticmethod
        def connect(*args, **kwargs):
            connect_calls.append("connect")
            return FakeConnection(label="fresh", should_fail=False)

    monkeypatch.setattr(postgres_connection, "_import_psycopg", lambda: FakePsycopg)

    pool = postgres_connection._ReusablePostgresPool("postgresql://pool.example/tangent", pool_size=1, max_overflow=0)
    stale = FakeConnection(label="stale", should_fail=True)
    pool._idle.append(stale)
    pool._total_connections = 1

    connection, pooled = pool.acquire()

    assert pooled is True
    assert connection.label == "fresh"
    assert stale.closed is True
    assert connect_calls == ["connect"]
