"""add auth user profile fields

Revision ID: 20260515_0022
Revises: 20260514_0021
Create Date: 2026-05-15
"""

from alembic import op


revision = "20260515_0022"
down_revision = "20260514_0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)


UPGRADE = [
    "ALTER TABLE tangent_users ADD COLUMN IF NOT EXISTS gender TEXT",
    "ALTER TABLE tangent_users ADD COLUMN IF NOT EXISTS profile_completed_at TIMESTAMPTZ",
]


DOWNGRADE = [
    "ALTER TABLE IF EXISTS tangent_users DROP COLUMN IF EXISTS profile_completed_at",
    "ALTER TABLE IF EXISTS tangent_users DROP COLUMN IF EXISTS gender",
]
