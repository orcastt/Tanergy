"""add partial unique index for usage_refund atomicity

Revision ID: 20260528_0034
Revises: 20260520_0033
Create Date: 2026-05-28
"""

from alembic import op


revision = "20260528_0034"
down_revision = "20260520_0033"
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
    CREATE UNIQUE INDEX IF NOT EXISTS tangent_credit_ledger_run_refund_uidx
        ON tangent_credit_ledger (account_id, source_id)
        WHERE source_type = 'ai_run' AND reason = 'usage_refund'
    """,
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_credit_ledger_run_refund_uidx",
]
