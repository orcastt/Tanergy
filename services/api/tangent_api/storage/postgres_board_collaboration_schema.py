from typing import Any

from tangent_api.storage.postgres_connection import should_auto_create_tables


BOARD_COLLABORATION_SELECT_COLUMNS = """
    id,
    workspace_id,
    board_id,
    user_id,
    client_instance_id,
    display_name,
    avatar_initials,
    workspace_role,
    permission,
    presence,
    created_at,
    last_heartbeat_at,
    expires_at
"""


def ensure_board_collaboration_schema(cursor: Any) -> None:
    if not should_auto_create_tables():
        return
    cursor.execute(
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
        """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS tangent_board_collaboration_active_idx
        ON tangent_board_collaboration_sessions (
            workspace_id,
            board_id,
            disconnected_at,
            expires_at DESC,
            last_heartbeat_at DESC
        )
        """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS tangent_board_collaboration_user_idx
        ON tangent_board_collaboration_sessions (user_id, last_heartbeat_at DESC)
        """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS tangent_board_collaboration_disconnected_idx
        ON tangent_board_collaboration_sessions (disconnected_at)
        WHERE disconnected_at IS NOT NULL
        """
    )
    cursor.execute(
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
        """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS tangent_board_realtime_updated_idx
        ON tangent_board_realtime_documents (updated_at DESC)
        """
    )
