"""deprecate gemini nano banana alias

Revision ID: a00000000008
Revises: a00000000007
Create Date: 2026-04-27
"""

from alembic import op


revision = "a00000000008"
down_revision = "a00000000007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE model_configs
        SET is_active = false,
            display_name = 'Gemini Nano Banana (legacy alias)'
        WHERE provider = 'geekai'
          AND model = 'gemini-nano-banana';
    """)
    op.execute("""
        UPDATE model_configs
        SET display_name = 'Gemini 3.1 Flash Image Preview',
            call_type = 'image_chat',
            credits_per_call = 5,
            sort_order = 20,
            is_active = true
        WHERE provider = 'geekai'
          AND model = 'gemini-3.1-flash-image-preview';
    """)
    op.execute("""
        UPDATE model_configs
        SET sort_order = 40,
            is_active = true
        WHERE provider = 'geekai'
          AND model = 'gpt-image-1';
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE model_configs
        SET is_active = true,
            display_name = 'Gemini Nano Banana',
            call_type = 'image_edit',
            credits_per_call = 6,
            sort_order = 40
        WHERE provider = 'geekai'
          AND model = 'gemini-nano-banana';
    """)
    op.execute("""
        UPDATE model_configs
        SET sort_order = 24
        WHERE provider = 'geekai'
          AND model = 'gemini-3.1-flash-image-preview';
    """)
