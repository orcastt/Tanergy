"""add team group wallet contracts

Revision ID: 20260508_0012
Revises: 20260506_0011
Create Date: 2026-05-08
"""

from alembic import op


revision = "20260508_0012"
down_revision = "20260506_0011"
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
    "ALTER TABLE tangent_credit_accounts ADD COLUMN IF NOT EXISTS account_kind TEXT",
    """
    UPDATE tangent_credit_accounts ca
    SET account_kind = CASE
        WHEN ca.owner_type = 'user' THEN 'personal_wallet'
        WHEN ca.owner_type = 'workspace' AND w.kind = 'enterprise_workspace' THEN 'enterprise_pool'
        WHEN ca.owner_type = 'workspace' THEN 'team_wallet'
        ELSE 'personal_wallet'
    END
    FROM tangent_workspaces w
    WHERE ca.owner_type = 'workspace'
      AND ca.owner_id = w.id
      AND ca.account_kind IS NULL
    """,
    """
    UPDATE tangent_credit_accounts
    SET account_kind = CASE
        WHEN owner_type = 'user' THEN 'personal_wallet'
        WHEN owner_type = 'workspace' THEN 'team_wallet'
        ELSE 'personal_wallet'
    END
    WHERE account_kind IS NULL
    """,
    "ALTER TABLE tangent_credit_accounts ALTER COLUMN account_kind SET DEFAULT 'personal_wallet'",
    "ALTER TABLE tangent_credit_accounts ALTER COLUMN account_kind SET NOT NULL",
    constraint_sql(
        "tangent_credit_accounts_account_kind_ck",
        "tangent_credit_accounts",
        "CHECK (account_kind IN ('personal_wallet', 'team_wallet', 'enterprise_pool')) NOT VALID",
    ),
    "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS owner_type TEXT",
    "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS owner_id TEXT",
    "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS plan_family TEXT",
    "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS workspace_id TEXT REFERENCES tangent_workspaces(id) ON DELETE SET NULL",
    "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS seat_capacity INTEGER NOT NULL DEFAULT 1",
    "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ",
    """
    UPDATE tangent_subscriptions s
    SET owner_type = ca.owner_type,
        owner_id = ca.owner_id
    FROM tangent_credit_accounts ca
    WHERE s.account_id = ca.id
      AND (s.owner_type IS NULL OR s.owner_id IS NULL)
    """,
    """
    UPDATE tangent_subscriptions
    SET plan_family = CASE
        WHEN plan_key IN ('collaborate_start', 'collaborate_plus') THEN 'collaborate'
        WHEN plan_key IN ('team_start', 'team_growth') THEN 'team'
        WHEN plan_key = 'enterprise' THEN 'enterprise'
        ELSE 'free'
    END
    WHERE plan_family IS NULL
    """,
    """
    UPDATE tangent_subscriptions
    SET workspace_id = owner_id
    WHERE owner_type = 'workspace'
      AND workspace_id IS NULL
    """,
    "ALTER TABLE tangent_subscriptions ALTER COLUMN owner_type SET DEFAULT 'user'",
    "ALTER TABLE tangent_subscriptions ALTER COLUMN owner_id SET DEFAULT ''",
    "ALTER TABLE tangent_subscriptions ALTER COLUMN plan_family SET DEFAULT 'free'",
    "ALTER TABLE tangent_subscriptions ALTER COLUMN owner_type SET NOT NULL",
    "ALTER TABLE tangent_subscriptions ALTER COLUMN owner_id SET NOT NULL",
    "ALTER TABLE tangent_subscriptions ALTER COLUMN plan_family SET NOT NULL",
    constraint_sql(
        "tangent_subscriptions_owner_type_ck",
        "tangent_subscriptions",
        "CHECK (owner_type IN ('user', 'workspace')) NOT VALID",
    ),
    constraint_sql(
        "tangent_subscriptions_plan_family_ck",
        "tangent_subscriptions",
        "CHECK (plan_family IN ('free', 'collaborate', 'team', 'enterprise')) NOT VALID",
    ),
    constraint_sql(
        "tangent_subscriptions_seat_capacity_ck",
        "tangent_subscriptions",
        "CHECK (seat_capacity >= 0) NOT VALID",
    ),
    """
    CREATE UNIQUE INDEX IF NOT EXISTS tangent_subscriptions_one_active_collaborate_per_user_idx
    ON tangent_subscriptions (owner_id)
    WHERE owner_type = 'user'
      AND plan_family = 'collaborate'
      AND status IN ('active', 'trialing')
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS tangent_subscriptions_one_active_team_per_workspace_idx
    ON tangent_subscriptions (owner_id)
    WHERE owner_type = 'workspace'
      AND plan_family = 'team'
      AND status IN ('active', 'trialing')
    """,
    "CREATE INDEX IF NOT EXISTS tangent_subscriptions_owner_idx ON tangent_subscriptions (owner_type, owner_id, status, updated_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_subscriptions_workspace_idx ON tangent_subscriptions (workspace_id, status, updated_at DESC)",
    "ALTER TABLE tangent_workspace_invitations ADD COLUMN IF NOT EXISTS token_hash TEXT",
    "ALTER TABLE tangent_workspace_invitations ADD COLUMN IF NOT EXISTS target_user_id TEXT REFERENCES tangent_users(id) ON DELETE SET NULL",
    "ALTER TABLE tangent_workspace_invitations ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb",
    "CREATE UNIQUE INDEX IF NOT EXISTS tangent_workspace_invitations_token_hash_idx ON tangent_workspace_invitations (token_hash) WHERE token_hash IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS tangent_workspace_invitations_workspace_status_idx ON tangent_workspace_invitations (workspace_id, accepted_at, revoked_at, expires_at)",
    "ALTER TABLE IF EXISTS tangent_ai_runs DROP CONSTRAINT IF EXISTS tangent_ai_runs_charged_scope_ck",
    constraint_sql(
        "tangent_ai_runs_charged_scope_ck",
        "tangent_ai_runs",
        "CHECK (charged_scope IN ('actor_personal', 'team_wallet', 'workspace_pool')) NOT VALID",
    ),
]


DOWNGRADE = [
    "ALTER TABLE IF EXISTS tangent_ai_runs DROP CONSTRAINT IF EXISTS tangent_ai_runs_charged_scope_ck",
    constraint_sql(
        "tangent_ai_runs_charged_scope_ck",
        "tangent_ai_runs",
        "CHECK (charged_scope IN ('actor_personal', 'workspace_pool')) NOT VALID",
    ),
    "DROP INDEX IF EXISTS tangent_workspace_invitations_workspace_status_idx",
    "DROP INDEX IF EXISTS tangent_workspace_invitations_token_hash_idx",
    "ALTER TABLE IF EXISTS tangent_workspace_invitations DROP COLUMN IF EXISTS metadata",
    "ALTER TABLE IF EXISTS tangent_workspace_invitations DROP COLUMN IF EXISTS target_user_id",
    "ALTER TABLE IF EXISTS tangent_workspace_invitations DROP COLUMN IF EXISTS token_hash",
    "DROP INDEX IF EXISTS tangent_subscriptions_workspace_idx",
    "DROP INDEX IF EXISTS tangent_subscriptions_owner_idx",
    "DROP INDEX IF EXISTS tangent_subscriptions_one_active_team_per_workspace_idx",
    "DROP INDEX IF EXISTS tangent_subscriptions_one_active_collaborate_per_user_idx",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP CONSTRAINT IF EXISTS tangent_subscriptions_seat_capacity_ck",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP CONSTRAINT IF EXISTS tangent_subscriptions_plan_family_ck",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP CONSTRAINT IF EXISTS tangent_subscriptions_owner_type_ck",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP COLUMN IF EXISTS current_period_start",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP COLUMN IF EXISTS seat_capacity",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP COLUMN IF EXISTS workspace_id",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP COLUMN IF EXISTS plan_family",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP COLUMN IF EXISTS owner_id",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP COLUMN IF EXISTS owner_type",
    "ALTER TABLE IF EXISTS tangent_credit_accounts DROP CONSTRAINT IF EXISTS tangent_credit_accounts_account_kind_ck",
    "ALTER TABLE IF EXISTS tangent_credit_accounts DROP COLUMN IF EXISTS account_kind",
]
