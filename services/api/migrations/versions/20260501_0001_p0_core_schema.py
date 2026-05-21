"""create p0 core schema

Revision ID: 20260501_0001
Revises:
Create Date: 2026-05-01
"""

from typing import Sequence, Union

from alembic import op

revision: str = "20260501_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL,
            avatar_initials TEXT NOT NULL,
            email_verified BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_workspaces (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_workspace_memberships (
            workspace_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            PRIMARY KEY (workspace_id, user_id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_email_otps (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            purpose TEXT NOT NULL,
            code_hash TEXT NOT NULL,
            expires_at TIMESTAMPTZ NOT NULL,
            consumed_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_auth_sessions (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            revoked_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_boards (
            id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            title TEXT NOT NULL,
            document JSONB NOT NULL,
            byte_size INTEGER NOT NULL,
            asset_count INTEGER NOT NULL DEFAULT 0,
            shape_count INTEGER NOT NULL DEFAULT 0,
            thumbnail_url TEXT,
            last_opened_at TIMESTAMPTZ,
            saved_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (workspace_id, id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_assets (
            id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            created_by TEXT NOT NULL,
            title TEXT NOT NULL,
            origin TEXT NOT NULL,
            mime TEXT NOT NULL,
            byte_size INTEGER NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            storage TEXT NOT NULL,
            original_url TEXT NOT NULL,
            thumbnail_256_url TEXT,
            thumbnail_512_url TEXT,
            thumbnail_1024_url TEXT,
            created_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (workspace_id, id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_board_snapshots (
            id TEXT NOT NULL,
            workspace_id TEXT NOT NULL,
            board_id TEXT NOT NULL,
            created_by TEXT NOT NULL,
            title TEXT NOT NULL,
            document JSONB NOT NULL,
            document_hash TEXT NOT NULL,
            byte_size INTEGER NOT NULL,
            asset_count INTEGER NOT NULL DEFAULT 0,
            shape_count INTEGER NOT NULL DEFAULT 0,
            thumbnail_url TEXT,
            reason TEXT NOT NULL,
            retention_tier TEXT NOT NULL,
            expires_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL,
            PRIMARY KEY (workspace_id, board_id, id)
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_model_options (
            id TEXT PRIMARY KEY,
            provider TEXT NOT NULL,
            display_name TEXT NOT NULL,
            capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
            parameter_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
            is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            is_default BOOLEAN NOT NULL DEFAULT FALSE,
            cost_hint TEXT NOT NULL DEFAULT '',
            estimated_latency TEXT NOT NULL DEFAULT '',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_ai_runs (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            created_by TEXT NOT NULL,
            board_id TEXT,
            node_id TEXT,
            run_type TEXT NOT NULL,
            model_id TEXT NOT NULL,
            provider TEXT NOT NULL,
            status TEXT NOT NULL,
            input_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            output_asset_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
            params JSONB NOT NULL DEFAULT '{}'::jsonb,
            prompt_preview TEXT,
            cost_credits NUMERIC(12, 4) NOT NULL DEFAULT 0,
            latency_ms INTEGER NOT NULL DEFAULT 0,
            error_code TEXT,
            error_message TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS tangent_api_call_logs (
            id TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            run_id TEXT,
            provider TEXT,
            model_id TEXT,
            endpoint TEXT NOT NULL,
            status_code INTEGER,
            latency_ms INTEGER NOT NULL DEFAULT 0,
            cost_credits NUMERIC(12, 4) NOT NULL DEFAULT 0,
            error_code TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS tangent_boards_owner_idx "
        "ON tangent_boards (workspace_id, owner_id, saved_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS tangent_boards_opened_idx "
        "ON tangent_boards (workspace_id, last_opened_at DESC, saved_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS tangent_assets_created_idx "
        "ON tangent_assets (workspace_id, created_by, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS tangent_board_snapshots_created_idx "
        "ON tangent_board_snapshots (workspace_id, board_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS tangent_ai_runs_board_idx "
        "ON tangent_ai_runs (workspace_id, board_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS tangent_api_call_logs_workspace_idx "
        "ON tangent_api_call_logs (workspace_id, created_at DESC)"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS tangent_api_call_logs")
    op.execute("DROP TABLE IF EXISTS tangent_ai_runs")
    op.execute("DROP TABLE IF EXISTS tangent_model_options")
    op.execute("DROP TABLE IF EXISTS tangent_board_snapshots")
    op.execute("DROP TABLE IF EXISTS tangent_assets")
    op.execute("DROP TABLE IF EXISTS tangent_boards")
    op.execute("DROP TABLE IF EXISTS tangent_auth_sessions")
    op.execute("DROP TABLE IF EXISTS tangent_email_otps")
    op.execute("DROP TABLE IF EXISTS tangent_workspace_memberships")
    op.execute("DROP TABLE IF EXISTS tangent_workspaces")
    op.execute("DROP TABLE IF EXISTS tangent_users")
