"""add providers table + seed

Revision ID: a00000000002
Revises: a00000000001
Create Date: 2026-04-23
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "a00000000002"
down_revision = "a00000000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "providers",
        sa.Column("id", sa.String(50), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("base_url", sa.String(500), nullable=False),
        sa.Column("key_env", sa.String(100), nullable=False),
        sa.Column("auth_style", sa.String(20), nullable=False, server_default="bearer"),
        sa.Column("extra_headers", JSONB, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Seed existing providers
    op.execute("""
        INSERT INTO providers (id, name, base_url, key_env, auth_style, extra_headers) VALUES
        ('minimax',  'MiniMax',  'https://api.minimax.chat/v1',                          'MINIMAX_API_KEY',  'bearer', '{}'),
        ('claude',   'Claude',   'https://api.anthropic.com/v1',                         'ANTHROPIC_API_KEY','x-api-key', '{"anthropic-version": "2023-06-01"}'),
        ('gpt',      'GPT',      'https://api.openai.com/v1',                            'OPENAI_API_KEY',   'bearer', '{}'),
        ('geekai',   'GeekAI',   'https://geekai.co/api/v1',                             'GEEKAI_API_KEY',   'bearer', '{}'),
        ('gemini',   'Gemini',   'https://generativelanguage.googleapis.com/v1beta/openai','GEMINI_API_KEY',  'bearer', '{}'),
        ('glm',      'GLM',      'https://open.bigmodel.cn/api/paas/v4',                 'GLM_API_KEY',      'bearer', '{}')
        ON CONFLICT (id) DO NOTHING;
    """)


def downgrade() -> None:
    op.drop_table("providers")
