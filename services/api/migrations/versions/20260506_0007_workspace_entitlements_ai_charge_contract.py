"""add workspace entitlements and ai charge contract

Revision ID: 20260506_0007
Revises: 20260502_0006
Create Date: 2026-05-06
"""

from alembic import op


revision = "20260506_0007"
down_revision = "20260502_0006"
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
    "ALTER TABLE tangent_workspaces ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'solo_workspace'",
    constraint_sql(
        "tangent_workspaces_kind_ck",
        "tangent_workspaces",
        "CHECK (kind IN ('solo_workspace', 'group_workspace', 'team_workspace', 'enterprise_workspace')) NOT VALID",
    ),
    """
    CREATE TABLE IF NOT EXISTS tangent_workspace_seat_assignments (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES tangent_workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        plan_key TEXT NOT NULL CHECK (plan_key IN (
            'team_start',
            'team_growth',
            'enterprise'
        )),
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'revoked')),
        included_credits INTEGER NOT NULL DEFAULT 0,
        current_period_start TIMESTAMPTZ,
        current_period_end TIMESTAMPTZ,
        assigned_by TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (workspace_id, user_id, plan_key)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_workspace_usage_rollups (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES tangent_workspaces(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        period_start TIMESTAMPTZ NOT NULL,
        period_end TIMESTAMPTZ NOT NULL,
        model_family TEXT,
        credits_used NUMERIC(14, 4) NOT NULL DEFAULT 0,
        run_count INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_workspace_dashboard_snapshots (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES tangent_workspaces(id) ON DELETE CASCADE,
        snapshot_kind TEXT NOT NULL CHECK (snapshot_kind IN ('group_structure', 'team_usage')),
        period_start TIMESTAMPTZ,
        period_end TIMESTAMPTZ,
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS workspace_kind TEXT NOT NULL DEFAULT 'solo_workspace'",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS workspace_seat_id TEXT",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS charged_account_id TEXT REFERENCES tangent_credit_accounts(id) ON DELETE SET NULL",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS charged_scope TEXT NOT NULL DEFAULT 'actor_personal'",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS entitlement_source TEXT NOT NULL DEFAULT 'personal_topup_or_free'",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS credits_charged NUMERIC(12, 4) NOT NULL DEFAULT 0",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS credits_refunded NUMERIC(12, 4) NOT NULL DEFAULT 0",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS provider_cost NUMERIC(12, 6)",
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS provider_currency TEXT",
    constraint_sql(
        "tangent_ai_runs_workspace_kind_ck",
        "tangent_ai_runs",
        "CHECK (workspace_kind IN ('solo_workspace', 'group_workspace', 'team_workspace', 'enterprise_workspace')) NOT VALID",
    ),
    constraint_sql(
        "tangent_ai_runs_charged_scope_ck",
        "tangent_ai_runs",
        "CHECK (charged_scope IN ('actor_personal', 'workspace_pool')) NOT VALID",
    ),
    "CREATE INDEX IF NOT EXISTS tangent_workspaces_kind_idx ON tangent_workspaces (kind, status)",
    "CREATE INDEX IF NOT EXISTS tangent_workspace_seats_workspace_idx ON tangent_workspace_seat_assignments (workspace_id, status, user_id)",
    "CREATE INDEX IF NOT EXISTS tangent_workspace_seats_user_idx ON tangent_workspace_seat_assignments (user_id, status, workspace_id)",
    "CREATE INDEX IF NOT EXISTS tangent_workspace_usage_workspace_idx ON tangent_workspace_usage_rollups (workspace_id, period_start DESC, user_id)",
    "CREATE INDEX IF NOT EXISTS tangent_workspace_dashboard_workspace_idx ON tangent_workspace_dashboard_snapshots (workspace_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_ai_runs_charge_idx ON tangent_ai_runs (workspace_id, charged_account_id, created_at DESC)",
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_ai_runs_charge_idx",
    "DROP INDEX IF EXISTS tangent_workspace_dashboard_workspace_idx",
    "DROP INDEX IF EXISTS tangent_workspace_usage_workspace_idx",
    "DROP INDEX IF EXISTS tangent_workspace_seats_user_idx",
    "DROP INDEX IF EXISTS tangent_workspace_seats_workspace_idx",
    "DROP INDEX IF EXISTS tangent_workspaces_kind_idx",
    "ALTER TABLE IF EXISTS tangent_ai_runs DROP CONSTRAINT IF EXISTS tangent_ai_runs_charged_scope_ck",
    "ALTER TABLE IF EXISTS tangent_ai_runs DROP CONSTRAINT IF EXISTS tangent_ai_runs_workspace_kind_ck",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS provider_currency",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS provider_cost",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS credits_refunded",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS credits_charged",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS entitlement_source",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS charged_scope",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS charged_account_id",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS workspace_seat_id",
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS workspace_kind",
    "DROP TABLE IF EXISTS tangent_workspace_dashboard_snapshots",
    "DROP TABLE IF EXISTS tangent_workspace_usage_rollups",
    "DROP TABLE IF EXISTS tangent_workspace_seat_assignments",
    "ALTER TABLE IF EXISTS tangent_workspaces DROP CONSTRAINT IF EXISTS tangent_workspaces_kind_ck",
    "ALTER TABLE tangent_workspaces DROP COLUMN IF EXISTS kind",
]
