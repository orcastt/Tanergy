"""add ai run quote persistence facts

Revision ID: 20260506_0009
Revises: 20260506_0008
Create Date: 2026-05-06
"""

from alembic import op


revision = "20260506_0009"
down_revision = "20260506_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)


def constraint_sql(name: str, table: str, clause: str) -> str:
    return f"""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{name}') THEN
            ALTER TABLE {table} ADD CONSTRAINT {name} {clause};
        END IF;
    END
    $$;
    """


UPGRADE = [
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS estimated_credits NUMERIC(12, 4) NOT NULL DEFAULT 0",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS pricing_rule_id TEXT",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS route_id TEXT",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS route_key TEXT",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS selected_tier_key TEXT",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS preflight_status TEXT NOT NULL DEFAULT 'mock_contract_only'",
    "ALTER TABLE tangent_ai_api_calls ADD COLUMN IF NOT EXISTS route_id TEXT",
    "ALTER TABLE tangent_ai_api_calls ADD COLUMN IF NOT EXISTS pricing_rule_id TEXT",
    constraint_sql(
        "tangent_ai_runs_pricing_rule_fk",
        "tangent_ai_runs",
        "FOREIGN KEY (pricing_rule_id) REFERENCES tangent_model_pricing_rules(id) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_ai_runs_route_fk",
        "tangent_ai_runs",
        "FOREIGN KEY (route_id) REFERENCES tangent_model_provider_routes(id) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_ai_api_calls_pricing_rule_fk",
        "tangent_ai_api_calls",
        "FOREIGN KEY (pricing_rule_id) REFERENCES tangent_model_pricing_rules(id) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_ai_api_calls_route_fk",
        "tangent_ai_api_calls",
        "FOREIGN KEY (route_id) REFERENCES tangent_model_provider_routes(id) ON DELETE SET NULL NOT VALID",
    ),
    "CREATE INDEX IF NOT EXISTS tangent_ai_runs_pricing_idx ON tangent_ai_runs (pricing_rule_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_ai_runs_route_idx ON tangent_ai_runs (route_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_ai_api_calls_route_idx ON tangent_ai_api_calls (route_id, created_at DESC)",
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_ai_api_calls_route_idx",
    "DROP INDEX IF EXISTS tangent_ai_runs_route_idx",
    "DROP INDEX IF EXISTS tangent_ai_runs_pricing_idx",
    "ALTER TABLE IF EXISTS tangent_ai_api_calls DROP CONSTRAINT IF EXISTS tangent_ai_api_calls_route_fk",
    "ALTER TABLE IF EXISTS tangent_ai_api_calls DROP CONSTRAINT IF EXISTS tangent_ai_api_calls_pricing_rule_fk",
    "ALTER TABLE IF EXISTS tangent_ai_runs DROP CONSTRAINT IF EXISTS tangent_ai_runs_route_fk",
    "ALTER TABLE IF EXISTS tangent_ai_runs DROP CONSTRAINT IF EXISTS tangent_ai_runs_pricing_rule_fk",
    "ALTER TABLE tangent_ai_api_calls DROP COLUMN IF EXISTS pricing_rule_id",
    "ALTER TABLE tangent_ai_api_calls DROP COLUMN IF EXISTS route_id",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS preflight_status",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS selected_tier_key",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS route_key",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS route_id",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS pricing_rule_id",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS estimated_credits",
]
