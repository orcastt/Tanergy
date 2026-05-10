from __future__ import annotations

from functools import lru_cache

from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def has_postgres_column(table_name: str, column_name: str) -> bool:
    database_url = require_database_url()
    return _has_postgres_column(database_url, table_name, column_name)


@lru_cache(maxsize=128)
def _has_postgres_column(database_url: str, table_name: str, column_name: str) -> bool:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = %s
                  AND column_name = %s
                LIMIT 1
                """,
                (table_name, column_name),
            )
            return cursor.fetchone() is not None
