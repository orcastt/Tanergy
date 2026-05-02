"""add board management metadata

Revision ID: 20260502_0002
Revises: 20260501_0001
Create Date: 2026-05-02
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260502_0002"
down_revision: Union[str, None] = "20260501_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS description TEXT")
    op.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS card_color TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE tangent_boards DROP COLUMN IF EXISTS card_color")
    op.execute("ALTER TABLE tangent_boards DROP COLUMN IF EXISTS description")
