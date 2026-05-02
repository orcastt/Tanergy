import importlib.util
from pathlib import Path

import pytest


VERSIONS_DIR = Path(__file__).parents[1] / "migrations" / "versions"
SCRIPTS_DIR = Path(__file__).parents[1] / "scripts"


def load_migration(filename: str):
    path = VERSIONS_DIR / filename
    spec = importlib.util.spec_from_file_location(filename.removesuffix(".py"), path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_script(filename: str):
    path = SCRIPTS_DIR / filename
    spec = importlib.util.spec_from_file_location(filename.removesuffix(".py"), path)
    assert spec is not None
    assert spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_alembic_revision_chain_is_linear():
    migrations = [
        load_migration("20260501_0001_p0_core_schema.py"),
        load_migration("20260502_0002_board_metadata.py"),
        load_migration("20260502_0003_board_management_metadata.py"),
        load_migration("20260502_0004_s1a_core_schema.py"),
        load_migration("20260502_0005_s1a_future_systems_schema.py"),
        load_migration("20260502_0006_s1a_constraints_indexes.py"),
    ]

    for previous, current in zip(migrations, migrations[1:]):
        assert current.down_revision == previous.revision


def test_s1a_migrations_keep_required_schema_contracts():
    core = load_migration("20260502_0004_s1a_core_schema.py")
    future = load_migration("20260502_0005_s1a_future_systems_schema.py")
    hardening = load_migration("20260502_0006_s1a_constraints_indexes.py")
    core_sql = "\n".join(core.UPGRADE)
    future_sql = "\n".join(future.UPGRADE)
    hardening_sql = "\n".join(hardening.UPGRADE)

    for table_name in [
        "tangent_workspace_members",
        "tangent_board_members",
        "tangent_board_user_preferences",
        "tangent_board_assets",
        "tangent_collections",
    ]:
        assert table_name in core_sql

    for table_name in [
        "tangent_admin_roles",
        "tangent_credit_accounts",
        "tangent_credit_ledger",
        "tangent_ai_api_calls",
        "tangent_analytics_events",
        "tangent_idempotency_keys",
    ]:
        assert table_name in future_sql

    for contract in [
        "tangent_boards_owner_fk",
        "tangent_auth_sessions_user_fk",
        "tangent_assets_workspace_fk",
        "tangent_email_otps_purpose_ck",
        "tangent_ai_api_calls_user_idx",
    ]:
        assert contract in hardening_sql


def test_s1a_smoke_runner_requires_explicit_database(monkeypatch):
    smoke = load_script("s1a_migration_smoke.py")
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("S1A_SMOKE_DATABASE_URL", raising=False)
    monkeypatch.delenv("S1A_SMOKE_ALLOW_RESET", raising=False)

    with pytest.raises(SystemExit, match="disposable Postgres database"):
        smoke.main()
