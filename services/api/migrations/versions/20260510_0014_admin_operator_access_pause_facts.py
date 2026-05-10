"""add admin operator access and pause facts

Revision ID: 20260510_0014
Revises: 20260508_0013
Create Date: 2026-05-10
"""

from alembic import op


revision = "20260510_0014"
down_revision = "20260508_0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)


UPGRADE = [
    "ALTER TABLE tangent_users ADD COLUMN IF NOT EXISTS last_ip_address TEXT",
    "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ",
    "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS paused_by TEXT REFERENCES tangent_users(id) ON DELETE SET NULL",
    "ALTER TABLE tangent_subscriptions ADD COLUMN IF NOT EXISTS pause_reason TEXT",
    "CREATE INDEX IF NOT EXISTS tangent_subscriptions_paused_idx ON tangent_subscriptions (status, paused_at DESC NULLS LAST, updated_at DESC)",
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_subscriptions_paused_idx",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP COLUMN IF EXISTS pause_reason",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP COLUMN IF EXISTS paused_by",
    "ALTER TABLE IF EXISTS tangent_subscriptions DROP COLUMN IF EXISTS paused_at",
    "ALTER TABLE IF EXISTS tangent_users DROP COLUMN IF EXISTS last_ip_address",
]
