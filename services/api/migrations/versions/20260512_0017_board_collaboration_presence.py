"""add board collaboration session presence table

Revision ID: 20260512_0017
Revises: 20260511_0016
Create Date: 2026-05-12
"""

from alembic import op


revision = "20260512_0017"
down_revision = "20260511_0016"
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
    CREATE TABLE IF NOT EXISTS tangent_board_collaboration_sessions (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        board_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        client_instance_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_initials TEXT NOT NULL,
        workspace_role TEXT NOT NULL,
        permission TEXT NOT NULL CHECK (permission IN ('view', 'edit', 'manage', 'owner')),
        presence JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_heartbeat_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL,
        disconnected_at TIMESTAMPTZ,
        UNIQUE (workspace_id, board_id, user_id, client_instance_id),
        FOREIGN KEY (workspace_id, board_id)
            REFERENCES tangent_boards(workspace_id, id)
            ON DELETE CASCADE
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS tangent_board_collaboration_active_idx
    ON tangent_board_collaboration_sessions (
        workspace_id,
        board_id,
        disconnected_at,
        expires_at DESC,
        last_heartbeat_at DESC
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS tangent_board_collaboration_user_idx
    ON tangent_board_collaboration_sessions (user_id, last_heartbeat_at DESC)
    """,
    """
    CREATE INDEX IF NOT EXISTS tangent_board_collaboration_disconnected_idx
    ON tangent_board_collaboration_sessions (disconnected_at)
    WHERE disconnected_at IS NOT NULL
    """,
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_board_collaboration_disconnected_idx",
    "DROP INDEX IF EXISTS tangent_board_collaboration_user_idx",
    "DROP INDEX IF EXISTS tangent_board_collaboration_active_idx",
    "DROP TABLE IF EXISTS tangent_board_collaboration_sessions",
]
