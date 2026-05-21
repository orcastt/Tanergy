"""persist security events quotas and idempotency responses

Revision ID: 20260520_0031
Revises: 20260518_0030
Create Date: 2026-05-20
"""

from alembic import op


revision = "20260520_0031"
down_revision = "20260518_0030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    connection = op.get_bind()
    for statement in UPGRADE:
        connection.exec_driver_sql(statement)


def downgrade() -> None:
    connection = op.get_bind()
    for statement in DOWNGRADE:
        connection.exec_driver_sql(statement)


UPGRADE = [
    """
    CREATE TABLE IF NOT EXISTS tangent_security_events (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT,
        workspace_id TEXT,
        resource_type TEXT,
        resource_id TEXT,
        action TEXT NOT NULL,
        decision TEXT NOT NULL,
        reason TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_security_daily_usage (
        usage_day DATE NOT NULL,
        actor_user_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        action TEXT NOT NULL,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (usage_day, actor_user_id, workspace_id, action)
    )
    """,
    "ALTER TABLE tangent_idempotency_keys ADD COLUMN IF NOT EXISTS request_fingerprint TEXT",
    "ALTER TABLE tangent_idempotency_keys ADD COLUMN IF NOT EXISTS response_json JSONB",
    "CREATE INDEX IF NOT EXISTS tangent_security_events_created_idx ON tangent_security_events (created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_security_events_actor_idx ON tangent_security_events (actor_user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_security_daily_usage_action_idx ON tangent_security_daily_usage (action, usage_day)",
    "CREATE INDEX IF NOT EXISTS tangent_idempotency_keys_scope_idx ON tangent_idempotency_keys (scope, created_at DESC)",
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_idempotency_keys_scope_idx",
    "DROP INDEX IF EXISTS tangent_security_daily_usage_action_idx",
    "DROP INDEX IF EXISTS tangent_security_events_actor_idx",
    "DROP INDEX IF EXISTS tangent_security_events_created_idx",
    "ALTER TABLE IF EXISTS tangent_idempotency_keys DROP COLUMN IF EXISTS response_json",
    "ALTER TABLE IF EXISTS tangent_idempotency_keys DROP COLUMN IF EXISTS request_fingerprint",
    "DROP TABLE IF EXISTS tangent_security_daily_usage",
    "DROP TABLE IF EXISTS tangent_security_events",
]
