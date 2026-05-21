"""add board realtime document state table

Revision ID: 20260512_0018
Revises: 20260512_0017
Create Date: 2026-05-12
"""

from alembic import op


revision = "20260512_0018"
down_revision = "20260512_0017"
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
    CREATE TABLE IF NOT EXISTS tangent_board_realtime_documents (
        workspace_id TEXT NOT NULL,
        board_id TEXT NOT NULL,
        room_key TEXT NOT NULL,
        document_updates JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT tangent_board_realtime_updates_bounded
            CHECK (
                CASE
                    WHEN jsonb_typeof(document_updates) = 'array'
                    THEN jsonb_array_length(document_updates) <= 96
                    ELSE FALSE
                END
            ),
        PRIMARY KEY (workspace_id, board_id),
        FOREIGN KEY (workspace_id, board_id)
            REFERENCES tangent_boards(workspace_id, id)
            ON DELETE CASCADE
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS tangent_board_realtime_updated_idx
    ON tangent_board_realtime_documents (updated_at DESC)
    """,
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_board_realtime_updated_idx",
    "DROP TABLE IF EXISTS tangent_board_realtime_documents",
]
