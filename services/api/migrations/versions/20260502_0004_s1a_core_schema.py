"""add s1a core schema

Revision ID: 20260502_0004
Revises: 20260502_0003
Create Date: 2026-05-02
"""

from alembic import op


revision = "20260502_0004"
down_revision = "20260502_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    for statement in UPGRADE:
        op.execute(statement)


def downgrade() -> None:
    for statement in DOWNGRADE:
        op.execute(statement)


def constraint_sql(name: str, table: str, clause: str) -> str:
    return f"""
    DO $$
    BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = '{name}') THEN
            ALTER TABLE {table} ADD CONSTRAINT {name} {clause};
        END IF;
    END
    $$;
    """


UPGRADE = [
    "ALTER TABLE tangent_users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
    "ALTER TABLE tangent_users ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en'",
    "ALTER TABLE tangent_users ADD COLUMN IF NOT EXISTS timezone TEXT",
    "ALTER TABLE tangent_users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ",
    "ALTER TABLE tangent_workspaces ADD COLUMN IF NOT EXISTS slug TEXT",
    "ALTER TABLE tangent_workspaces ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'",
    "ALTER TABLE tangent_workspaces ADD COLUMN IF NOT EXISTS billing_owner_user_id TEXT",
    "ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ",
    "ALTER TABLE tangent_boards ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ",
    """
    CREATE TABLE IF NOT EXISTS tangent_workspace_members (
        workspace_id TEXT NOT NULL REFERENCES tangent_workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'guest')),
        display_name TEXT,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        invited_by TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        PRIMARY KEY (workspace_id, user_id)
    )
    """,
    """
    INSERT INTO tangent_workspace_members (workspace_id, user_id, role, joined_at)
    SELECT
        m.workspace_id,
        m.user_id,
        CASE
            WHEN m.role IN ('owner', 'admin', 'member', 'guest') THEN m.role
            ELSE 'member'
        END,
        m.created_at
    FROM tangent_workspace_memberships m
    WHERE EXISTS (SELECT 1 FROM tangent_workspaces w WHERE w.id = m.workspace_id)
      AND EXISTS (SELECT 1 FROM tangent_users u WHERE u.id = m.user_id)
    ON CONFLICT (workspace_id, user_id) DO NOTHING
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_user_identities (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL,
        provider_subject TEXT NOT NULL,
        email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (provider, provider_subject)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_oauth_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider IN ('google', 'apple', 'github', 'auth0')),
        provider_subject TEXT NOT NULL,
        email TEXT,
        linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        UNIQUE (provider, provider_subject)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_workspace_invitations (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES tangent_workspaces(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'member', 'guest')),
        invited_by TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        accepted_by TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        accepted_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_board_members (
        workspace_id TEXT NOT NULL,
        board_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'temporary_viewer')),
        invited_by TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ,
        last_seen_at TIMESTAMPTZ,
        PRIMARY KEY (workspace_id, board_id, user_id),
        FOREIGN KEY (workspace_id, board_id) REFERENCES tangent_boards(workspace_id, id) ON DELETE CASCADE
    )
    """,
    """
    INSERT INTO tangent_board_members (workspace_id, board_id, user_id, role)
    SELECT workspace_id, id, owner_id, 'owner'
    FROM tangent_boards
    WHERE EXISTS (SELECT 1 FROM tangent_users u WHERE u.id = owner_id)
    ON CONFLICT (workspace_id, board_id, user_id) DO NOTHING
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_board_user_preferences (
        workspace_id TEXT NOT NULL,
        board_id TEXT NOT NULL,
        user_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        is_starred BOOLEAN NOT NULL DEFAULT FALSE,
        is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
        last_opened_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (workspace_id, board_id, user_id),
        FOREIGN KEY (workspace_id, board_id) REFERENCES tangent_boards(workspace_id, id) ON DELETE CASCADE
    )
    """,
    """
    INSERT INTO tangent_board_user_preferences (workspace_id, board_id, user_id, is_starred, is_pinned, last_opened_at)
    SELECT workspace_id, id, owner_id, is_starred, is_pinned, last_opened_at
    FROM tangent_boards
    WHERE EXISTS (SELECT 1 FROM tangent_users u WHERE u.id = owner_id)
    ON CONFLICT (workspace_id, board_id, user_id) DO NOTHING
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_board_share_links (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        board_id TEXT NOT NULL,
        share_id TEXT NOT NULL,
        access_role TEXT NOT NULL CHECK (access_role IN ('viewer', 'editor')),
        created_by TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        expires_at TIMESTAMPTZ,
        revoked_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        FOREIGN KEY (workspace_id, board_id) REFERENCES tangent_boards(workspace_id, id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_asset_variants (
        workspace_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        variant_key TEXT NOT NULL,
        url TEXT NOT NULL,
        mime TEXT NOT NULL,
        byte_size INTEGER NOT NULL,
        width INTEGER,
        height INTEGER,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (workspace_id, asset_id, variant_key),
        FOREIGN KEY (workspace_id, asset_id) REFERENCES tangent_assets(workspace_id, id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_board_assets (
        workspace_id TEXT NOT NULL,
        board_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        usage TEXT NOT NULL CHECK (usage IN ('image_node', 'thumbnail', 'history_thumbnail', 'reference', 'ai_input', 'ai_output')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (workspace_id, board_id, asset_id, usage),
        FOREIGN KEY (workspace_id, board_id) REFERENCES tangent_boards(workspace_id, id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id, asset_id) REFERENCES tangent_assets(workspace_id, id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_collections (
        id TEXT NOT NULL,
        workspace_id TEXT NOT NULL REFERENCES tangent_workspaces(id) ON DELETE CASCADE,
        owner_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (workspace_id, id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_collection_boards (
        workspace_id TEXT NOT NULL,
        collection_id TEXT NOT NULL,
        board_id TEXT NOT NULL,
        added_by TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (workspace_id, collection_id, board_id),
        FOREIGN KEY (workspace_id, collection_id) REFERENCES tangent_collections(workspace_id, id) ON DELETE CASCADE,
        FOREIGN KEY (workspace_id, board_id) REFERENCES tangent_boards(workspace_id, id) ON DELETE CASCADE
    )
    """,
    "CREATE INDEX IF NOT EXISTS tangent_users_email_lower_idx ON tangent_users (lower(email))",
    "CREATE UNIQUE INDEX IF NOT EXISTS tangent_workspaces_slug_idx ON tangent_workspaces (slug) WHERE slug IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS tangent_workspace_members_user_idx ON tangent_workspace_members (user_id, workspace_id)",
    "CREATE INDEX IF NOT EXISTS tangent_board_members_user_idx ON tangent_board_members (user_id, workspace_id)",
    "CREATE INDEX IF NOT EXISTS tangent_board_preferences_opened_idx ON tangent_board_user_preferences (user_id, workspace_id, last_opened_at DESC, board_id)",
    "CREATE INDEX IF NOT EXISTS tangent_board_preferences_pinned_idx ON tangent_board_user_preferences (user_id, workspace_id, is_pinned DESC, last_opened_at DESC)",
    "CREATE UNIQUE INDEX IF NOT EXISTS tangent_board_share_links_active_idx ON tangent_board_share_links (share_id) WHERE revoked_at IS NULL",
    "CREATE INDEX IF NOT EXISTS tangent_board_assets_asset_idx ON tangent_board_assets (workspace_id, asset_id, created_at DESC)",
    constraint_sql("tangent_users_status_ck", "tangent_users", "CHECK (status IN ('active', 'suspended', 'deleted')) NOT VALID"),
    constraint_sql("tangent_workspaces_status_ck", "tangent_workspaces", "CHECK (status IN ('active', 'suspended', 'deleted')) NOT VALID"),
    constraint_sql("tangent_workspace_memberships_role_ck", "tangent_workspace_memberships", "CHECK (role IN ('owner', 'admin', 'member', 'guest')) NOT VALID"),
    constraint_sql("tangent_boards_visibility_ck", "tangent_boards", "CHECK (visibility IN ('private', 'workspace', 'public')) NOT VALID"),
    constraint_sql("tangent_assets_storage_ck", "tangent_assets", "CHECK (storage IN ('local-dev', 's3-compatible', 'external')) NOT VALID"),
    constraint_sql("tangent_snapshots_reason_ck", "tangent_board_snapshots", "CHECK (reason IN ('autosave', 'auto_interval', 'keyboard', 'manual', 'manual_save', 'pre_restore', 'restore')) NOT VALID"),
    constraint_sql("tangent_snapshots_retention_ck", "tangent_board_snapshots", "CHECK (retention_tier IN ('free', 'pro', 'team', 'enterprise')) NOT VALID"),
]


DOWNGRADE = [
    "ALTER TABLE IF EXISTS tangent_board_snapshots DROP CONSTRAINT IF EXISTS tangent_snapshots_retention_ck",
    "ALTER TABLE IF EXISTS tangent_board_snapshots DROP CONSTRAINT IF EXISTS tangent_snapshots_reason_ck",
    "ALTER TABLE IF EXISTS tangent_assets DROP CONSTRAINT IF EXISTS tangent_assets_storage_ck",
    "ALTER TABLE IF EXISTS tangent_boards DROP CONSTRAINT IF EXISTS tangent_boards_visibility_ck",
    "ALTER TABLE IF EXISTS tangent_workspace_memberships DROP CONSTRAINT IF EXISTS tangent_workspace_memberships_role_ck",
    "ALTER TABLE IF EXISTS tangent_workspaces DROP CONSTRAINT IF EXISTS tangent_workspaces_status_ck",
    "ALTER TABLE IF EXISTS tangent_users DROP CONSTRAINT IF EXISTS tangent_users_status_ck",
    "DROP TABLE IF EXISTS tangent_collection_boards",
    "DROP TABLE IF EXISTS tangent_collections",
    "DROP TABLE IF EXISTS tangent_board_assets",
    "DROP TABLE IF EXISTS tangent_asset_variants",
    "DROP TABLE IF EXISTS tangent_board_share_links",
    "DROP TABLE IF EXISTS tangent_board_user_preferences",
    "DROP TABLE IF EXISTS tangent_board_members",
    "DROP TABLE IF EXISTS tangent_workspace_invitations",
    "DROP TABLE IF EXISTS tangent_oauth_accounts",
    "DROP TABLE IF EXISTS tangent_user_identities",
    "DROP TABLE IF EXISTS tangent_workspace_members",
    "DROP INDEX IF EXISTS tangent_workspaces_slug_idx",
    "DROP INDEX IF EXISTS tangent_users_email_lower_idx",
    "ALTER TABLE tangent_boards DROP COLUMN IF EXISTS deleted_at",
    "ALTER TABLE tangent_boards DROP COLUMN IF EXISTS archived_at",
    "ALTER TABLE tangent_workspaces DROP COLUMN IF EXISTS billing_owner_user_id",
    "ALTER TABLE tangent_workspaces DROP COLUMN IF EXISTS status",
    "ALTER TABLE tangent_workspaces DROP COLUMN IF EXISTS slug",
    "ALTER TABLE tangent_users DROP COLUMN IF EXISTS last_login_at",
    "ALTER TABLE tangent_users DROP COLUMN IF EXISTS timezone",
    "ALTER TABLE tangent_users DROP COLUMN IF EXISTS locale",
    "ALTER TABLE tangent_users DROP COLUMN IF EXISTS status",
]
