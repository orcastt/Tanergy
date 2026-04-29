"""reprioritize geekai text models

Revision ID: a00000000007
Revises: a00000000006
Create Date: 2026-04-27
"""

from alembic import op


revision = "a00000000007"
down_revision = "a00000000006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE model_configs
        SET sort_order = CASE model
            WHEN 'nemotron-3-super-120b-a12b' THEN 0
            WHEN 'minimax-m2.7:free' THEN 1
            WHEN 'hunyuan-3.0-preview' THEN 2
            ELSE sort_order
        END
        WHERE provider = 'geekai'
          AND model IN (
            'nemotron-3-super-120b-a12b',
            'minimax-m2.7:free',
            'hunyuan-3.0-preview'
          );
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE model_configs
        SET sort_order = CASE model
            WHEN 'hunyuan-3.0-preview' THEN 0
            WHEN 'minimax-m2.7:free' THEN 1
            WHEN 'nemotron-3-super-120b-a12b' THEN 2
            ELSE sort_order
        END
        WHERE provider = 'geekai'
          AND model IN (
            'nemotron-3-super-120b-a12b',
            'minimax-m2.7:free',
            'hunyuan-3.0-preview'
          );
    """)
