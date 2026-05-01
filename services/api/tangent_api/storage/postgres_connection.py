import os
from typing import Any

from fastapi import HTTPException


def require_database_url() -> str:
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise HTTPException(
            status_code=501,
            detail="Postgres persistence is not configured. Missing config: DATABASE_URL.",
        )
    return database_url


def should_auto_create_tables() -> bool:
    return os.getenv("TANGENT_POSTGRES_AUTO_CREATE_TABLES", "1") != "0"


def connect_to_postgres() -> Any:
    database_url = require_database_url()
    try:
        import psycopg
    except ImportError as exc:
        raise HTTPException(
            status_code=501,
            detail="psycopg is required for Postgres persistence.",
        ) from exc
    return psycopg.connect(database_url)
