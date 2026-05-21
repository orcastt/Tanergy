"""Add board management metadata fields.

Revision ID: 20260502_0003
Revises: 20260502_0002
Create Date: 2026-05-02
"""

from alembic import op


revision = "20260502_0003"
down_revision = "20260502_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ")
    op.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE")
    op.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'")
    op.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS share_id TEXT")
    op.execute("UPDATE tangent_boards SET created_at = saved_at WHERE created_at IS NULL")
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS tangent_boards_pinned_idx
        ON tangent_boards (workspace_id, is_pinned DESC, saved_at DESC)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS tangent_boards_pinned_idx")
    op.execute("ALTER TABLE tangent_boards DROP COLUMN IF EXISTS share_id")
    op.execute("ALTER TABLE tangent_boards DROP COLUMN IF EXISTS visibility")
    op.execute("ALTER TABLE tangent_boards DROP COLUMN IF EXISTS is_pinned")
    op.execute("ALTER TABLE tangent_boards DROP COLUMN IF EXISTS is_starred")
    op.execute("ALTER TABLE tangent_boards DROP COLUMN IF EXISTS created_at")
