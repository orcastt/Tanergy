"""seed geekai provider

Revision ID: a00000000003
Revises: a00000000002
Create Date: 2026-04-26
"""

from alembic import op


revision = "a00000000003"
down_revision = "a00000000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
        INSERT INTO providers (id, name, base_url, key_env, auth_style, extra_headers) VALUES
        ('geekai', 'GeekAI', 'https://geekai.co/api/v1', 'GEEKAI_API_KEY', 'bearer', '{}')
        ON CONFLICT (id) DO NOTHING;
    """)


def downgrade() -> None:
    op.execute("DELETE FROM providers WHERE id = 'geekai';")
