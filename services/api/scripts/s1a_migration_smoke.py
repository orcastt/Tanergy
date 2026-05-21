"""Run S1A migration smoke checks against a disposable Postgres database."""

from __future__ import annotations

import os
from pathlib import Path

from alembic import command
from alembic.config import Config


API_ROOT = None
for candidate in Path(__file__).resolve().parents:
    if (candidate / "alembic.ini").exists() and (candidate / "migrations").exists():
        API_ROOT = candidate
        break
if API_ROOT is None:
    raise RuntimeError("Could not find services/api root for Alembic smoke.")
ALEMBIC_INI = API_ROOT / "alembic.ini"
S1A_HEAD = "20260502_0006"
P0_HEAD = "20260502_0003"
REQUIRED_TABLES = (
    "tangent_users",
    "tangent_workspaces",
    "tangent_workspace_members",
    "tangent_board_members",
    "tangent_board_user_preferences",
    "tangent_board_assets",
    "tangent_credit_accounts",
    "tangent_credit_ledger",
    "tangent_ai_api_calls",
    "tangent_analytics_events",
    "tangent_idempotency_keys",
)


def main() -> None:
    database_url = os.getenv("S1A_SMOKE_DATABASE_URL") or os.getenv("DATABASE_URL")
    if not database_url:
        raise SystemExit("Set S1A_SMOKE_DATABASE_URL or DATABASE_URL to a disposable Postgres database.")
    if os.getenv("S1A_SMOKE_ALLOW_RESET") != "1":
        raise SystemExit("Refusing to reset DB. Set S1A_SMOKE_ALLOW_RESET=1 for a disposable database.")

    os.environ["DATABASE_URL"] = database_url
    print("S1A smoke target configured. Resetting disposable database...")
    reset_database(database_url)

    print("Smoke 1/2: empty database -> S1A head")
    alembic_upgrade("head")
    assert_required_tables(database_url)
    assert_constraint(database_url, "tangent_boards_owner_fk")
    assert_constraint(database_url, "tangent_auth_sessions_user_fk")
    print("Smoke 1/2 passed.")

    print("Smoke 2/2: P0 scaffold with seed rows -> S1A head")
    reset_database(database_url)
    alembic_upgrade(P0_HEAD)
    insert_p0_seed(database_url)
    alembic_upgrade("head")
    assert_required_tables(database_url)
    assert_seed_backfill(database_url)
    print("Smoke 2/2 passed.")
    print("S1A migration smoke passed.")


def alembic_upgrade(revision: str) -> None:
    config = Config(str(ALEMBIC_INI))
    previous_cwd = Path.cwd()
    try:
        os.chdir(API_ROOT)
        command.upgrade(config, revision)
    finally:
        os.chdir(previous_cwd)


def reset_database(database_url: str) -> None:
    psycopg, pg_sql = import_psycopg()
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
                  AND (tablename LIKE 'tangent_%' OR tablename = 'alembic_version')
                """
            )
            table_names = [row[0] for row in cursor.fetchall()]
            for table_name in table_names:
                cursor.execute(
                    pg_sql.SQL("DROP TABLE IF EXISTS {} CASCADE").format(pg_sql.Identifier(table_name))
                )
        connection.commit()


def assert_required_tables(database_url: str) -> None:
    psycopg, _pg_sql = import_psycopg()
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            for table_name in REQUIRED_TABLES:
                cursor.execute("SELECT to_regclass(%s)", (f"public.{table_name}",))
                if cursor.fetchone()[0] != table_name:
                    raise AssertionError(f"Missing table: {table_name}")


def assert_constraint(database_url: str, constraint_name: str) -> None:
    psycopg, _pg_sql = import_psycopg()
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM pg_constraint WHERE conname = %s", (constraint_name,))
            if cursor.fetchone() is None:
                raise AssertionError(f"Missing constraint: {constraint_name}")


def insert_p0_seed(database_url: str) -> None:
    psycopg, _pg_sql = import_psycopg()
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tangent_users (
                    id, email, display_name, avatar_initials, email_verified
                )
                VALUES
                    ('seed-user-a', 'seed-a@example.test', 'Seed A', 'SA', TRUE),
                    ('seed-user-b', 'seed-b@example.test', 'Seed B', 'SB', TRUE)
                """
            )
            cursor.execute(
                """
                INSERT INTO tangent_workspaces (id, name, owner_id)
                VALUES
                    ('seed-workspace-a', 'Seed Workspace A', 'seed-user-a'),
                    ('seed-workspace-b', 'Seed Workspace B', 'seed-user-b')
                """
            )
            cursor.execute(
                """
                INSERT INTO tangent_workspace_memberships (workspace_id, user_id, role)
                VALUES
                    ('seed-workspace-a', 'seed-user-a', 'owner'),
                    ('seed-workspace-b', 'seed-user-b', 'owner')
                """
            )
            cursor.execute(
                """
                INSERT INTO tangent_boards (
                    id, workspace_id, owner_id, title, document, byte_size,
                    asset_count, shape_count, thumbnail_url, last_opened_at, saved_at
                )
                VALUES
                    (
                        'seed-board-a', 'seed-workspace-a', 'seed-user-a',
                        'Seed Board A', '{"assets": [], "shapes": []}'::jsonb,
                        29, 0, 0, NULL, NOW(), NOW()
                    ),
                    (
                        'seed-board-b', 'seed-workspace-b', 'seed-user-b',
                        'Seed Board B', '{"assets": [], "shapes": []}'::jsonb,
                        29, 0, 0, NULL, NOW(), NOW()
                    )
                """
            )
        connection.commit()


def assert_seed_backfill(database_url: str) -> None:
    checks = (
        ("workspace members", "SELECT COUNT(*) FROM tangent_workspace_members"),
        ("board members", "SELECT COUNT(*) FROM tangent_board_members"),
        ("board preferences", "SELECT COUNT(*) FROM tangent_board_user_preferences"),
    )
    psycopg, _pg_sql = import_psycopg()
    with psycopg.connect(database_url) as connection:
        with connection.cursor() as cursor:
            for label, query in checks:
                cursor.execute(query)
                count = cursor.fetchone()[0]
                if count != 2:
                    raise AssertionError(f"Expected 2 {label}, found {count}")


def import_psycopg():
    try:
        import psycopg
        from psycopg import sql as pg_sql
    except ModuleNotFoundError as exc:
        raise SystemExit(
            "psycopg is required for S1A smoke. Install services/api dependencies first."
        ) from exc
    return psycopg, pg_sql


if __name__ == "__main__":
    main()
