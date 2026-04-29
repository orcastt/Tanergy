"""add geekai chat image model

Revision ID: a00000000006
Revises: a00000000005
Create Date: 2026-04-27
"""

from alembic import op


revision = "a00000000006"
down_revision = "a00000000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        UPDATE model_configs
        SET display_name = 'Gemini 3.1 Flash Image Preview',
            call_type = 'image_chat',
            credits_per_call = 5,
            sort_order = 24,
            is_active = true
        WHERE provider = 'geekai'
          AND model = 'gemini-3.1-flash-image-preview';
    """)
    op.execute("""
        INSERT INTO model_configs (id, provider, model, display_name, call_type, credits_per_call, sort_order)
        SELECT gen_random_uuid(), 'geekai', 'gemini-3.1-flash-image-preview',
               'Gemini 3.1 Flash Image Preview', 'image_chat', 5, 24
        WHERE NOT EXISTS (
            SELECT 1 FROM model_configs
            WHERE provider = 'geekai'
              AND model = 'gemini-3.1-flash-image-preview'
        );
    """)


def downgrade() -> None:
    op.execute("""
        DELETE FROM model_configs
        WHERE provider = 'geekai'
          AND model = 'gemini-3.1-flash-image-preview';
    """)
