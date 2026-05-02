from typing import Any

from tangent_api.storage.postgres_connection import should_auto_create_tables


BOARD_SELECT_COLUMNS = """
    id,
    workspace_id,
    owner_id,
    title,
    document,
    byte_size,
    asset_count,
    shape_count,
    description,
    card_color,
    thumbnail_url,
    last_opened_at,
    saved_at,
    created_at,
    is_starred,
    is_pinned,
    visibility,
    share_id
"""


def ensure_board_schema(cursor: Any) -> None:
    if not should_auto_create_tables():
        return
    cursor.execute(
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
            description TEXT,
            card_color TEXT,
            thumbnail_url TEXT,
            last_opened_at TIMESTAMPTZ,
            saved_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ,
            is_starred BOOLEAN NOT NULL DEFAULT FALSE,
            is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
            visibility TEXT NOT NULL DEFAULT 'private',
            share_id TEXT,
            PRIMARY KEY (workspace_id, id)
        )
        """
    )
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS asset_count INTEGER NOT NULL DEFAULT 0")
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS shape_count INTEGER NOT NULL DEFAULT 0")
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS description TEXT")
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS card_color TEXT")
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS thumbnail_url TEXT")
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS last_opened_at TIMESTAMPTZ")
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ")
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS is_starred BOOLEAN NOT NULL DEFAULT FALSE")
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT FALSE")
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'private'")
    cursor.execute("ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS share_id TEXT")
    cursor.execute("UPDATE tangent_boards SET created_at = saved_at WHERE created_at IS NULL")
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS tangent_boards_owner_idx
        ON tangent_boards (workspace_id, owner_id, saved_at DESC)
        """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS tangent_boards_opened_idx
        ON tangent_boards (workspace_id, last_opened_at DESC, saved_at DESC)
        """
    )
    cursor.execute(
        """
        CREATE INDEX IF NOT EXISTS tangent_boards_pinned_idx
        ON tangent_boards (workspace_id, is_pinned DESC, saved_at DESC)
        """
    )
