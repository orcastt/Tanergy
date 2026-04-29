"""add credits, api_call_logs, model_configs, user role

Revision ID: a00000000001
Revises: 5d2c2ed6d391
Create Date: 2026-04-23

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "a00000000001"
down_revision = "5d2c2ed6d391"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add role column to users
    op.add_column("users", sa.Column("role", sa.String(20), nullable=False, server_default="user"))

    # Credit balances
    op.create_table(
        "credit_balances",
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("balance", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("plan", sa.String(20), nullable=False, server_default="free"),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Credit transactions
    op.create_table(
        "credit_transactions",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("amount", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(20), nullable=False),
        sa.Column("reason", sa.String(50), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # API call logs
    op.create_table(
        "api_call_logs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("call_type", sa.String(20), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), server_default="0"),
        sa.Column("total_tokens", sa.Integer(), server_default="0"),
        sa.Column("credits_used", sa.Integer(), server_default="0"),
        sa.Column("latency_ms", sa.Integer(), server_default="0"),
        sa.Column("status", sa.String(20), server_default="success"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), index=True),
    )

    # Model config
    op.create_table(
        "model_configs",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("provider", sa.String(50), nullable=False),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(100), nullable=False),
        sa.Column("call_type", sa.String(20), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true"),
        sa.Column("credits_per_call", sa.Integer(), server_default="1"),
        sa.Column("credits_per_1k_tokens", sa.Float(), server_default="0"),
        sa.Column("max_tokens", sa.Integer(), server_default="4096"),
        sa.Column("sort_order", sa.Integer(), server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # Seed default model pricing
    op.execute("""
        INSERT INTO model_configs (id, provider, model, display_name, call_type, credits_per_call, sort_order)
        VALUES
            (gen_random_uuid(), 'minimax',  'MiniMax-M2.7',    'MiniMax M2.7',      'chat',  1,  0),
            (gen_random_uuid(), 'glm',      'glm-4-plus',      'GLM-4 Plus',        'chat',  2,  1),
            (gen_random_uuid(), 'gemini',   'gemini-2.5-pro',  'Gemini 2.5 Pro',    'chat',  3,  2),
            (gen_random_uuid(), 'gpt',      'gpt-4o',          'GPT-4o',            'chat',  5,  3),
            (gen_random_uuid(), 'claude',   'claude-sonnet-4-6','Claude Sonnet 4.6', 'chat',  5,  4),
            (gen_random_uuid(), 'minimax',  'image-01',        'MiniMax Image',     'image', 5,  10),
            (gen_random_uuid(), 'gpt',      'dall-e-3',        'DALL-E 3',          'image', 10, 11)
        ON CONFLICT DO NOTHING
    """)


def downgrade() -> None:
    op.drop_table("model_configs")
    op.drop_table("api_call_logs")
    op.drop_table("credit_transactions")
    op.drop_table("credit_balances")
    op.drop_column("users", "role")
