"""add ai control plane versions and payment checkout support

Revision ID: 20260506_0011
Revises: 20260506_0010
Create Date: 2026-05-06
"""

from alembic import op


revision = "20260506_0011"
down_revision = "20260506_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)


UPGRADE = [
    """
    CREATE TABLE IF NOT EXISTS tangent_ai_control_plane_versions (
        id TEXT PRIMARY KEY,
        resource_type TEXT NOT NULL,
        resource_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        action TEXT NOT NULL,
        snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        note TEXT,
        actor_user_id TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        workspace_id TEXT REFERENCES tangent_workspaces(id) ON DELETE SET NULL,
        published_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS tangent_ai_control_plane_versions_lookup_idx
    ON tangent_ai_control_plane_versions (resource_type, resource_id, version_number DESC, created_at DESC)
    """,
    "ALTER TABLE tangent_payments ADD COLUMN IF NOT EXISTS checkout_session_id TEXT",
    "ALTER TABLE tangent_payments ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'topup'",
    "ALTER TABLE tangent_payments ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb",
    "ALTER TABLE tangent_api_cost_ledger ADD COLUMN IF NOT EXISTS provider_cost NUMERIC(12, 6)",
    "ALTER TABLE tangent_api_cost_ledger ADD COLUMN IF NOT EXISTS provider_currency TEXT",
    "ALTER TABLE tangent_api_cost_ledger ADD COLUMN IF NOT EXISTS settlement_kind TEXT NOT NULL DEFAULT 'usage'",
]


DOWNGRADE = [
    "ALTER TABLE IF EXISTS tangent_api_cost_ledger DROP COLUMN IF EXISTS settlement_kind",
    "ALTER TABLE IF EXISTS tangent_api_cost_ledger DROP COLUMN IF EXISTS provider_currency",
    "ALTER TABLE IF EXISTS tangent_api_cost_ledger DROP COLUMN IF EXISTS provider_cost",
    "ALTER TABLE IF EXISTS tangent_payments DROP COLUMN IF EXISTS metadata",
    "ALTER TABLE IF EXISTS tangent_payments DROP COLUMN IF EXISTS kind",
    "ALTER TABLE IF EXISTS tangent_payments DROP COLUMN IF EXISTS checkout_session_id",
    "DROP INDEX IF EXISTS tangent_ai_control_plane_versions_lookup_idx",
    "DROP TABLE IF EXISTS tangent_ai_control_plane_versions",
]
