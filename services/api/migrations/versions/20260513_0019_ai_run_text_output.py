"""persist ai run text output

Revision ID: 20260513_0019
Revises: 20260512_0018
Create Date: 2026-05-13
"""

from alembic import op


revision = "20260513_0019"
down_revision = "20260512_0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)


UPGRADE = [
    "ALTER TABLE tangent_ai_runs ADD COLUMN IF NOT EXISTS text_output TEXT",
]


DOWNGRADE = [
    "ALTER TABLE tangent_ai_runs DROP COLUMN IF EXISTS text_output",
]
