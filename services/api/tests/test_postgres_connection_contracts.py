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
