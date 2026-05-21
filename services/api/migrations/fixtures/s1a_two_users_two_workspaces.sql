-- S1A smoke fixture: two isolated users, workspaces and boards.
-- Run after Alembic revision 20260502_0006 on a disposable staging database.

INSERT INTO tangent_users (
    id,
    email,
    display_name,
    avatar_initials,
    email_verified,
    status
)
VALUES
    ('fixture-user-alice', 'alice@example.test', 'Alice Fixture', 'AF', TRUE, 'active'),
    ('fixture-user-bob', 'bob@example.test', 'Bob Fixture', 'BF', TRUE, 'active')
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    avatar_initials = EXCLUDED.avatar_initials,
    email_verified = EXCLUDED.email_verified,
    status = EXCLUDED.status;

INSERT INTO tangent_workspaces (
    id,
    name,
    owner_id,
    slug,
    status
)
VALUES
    ('fixture-workspace-alice', 'Alice Workspace', 'fixture-user-alice', 'fixture-alice', 'active'),
    ('fixture-workspace-bob', 'Bob Workspace', 'fixture-user-bob', 'fixture-bob', 'active')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    owner_id = EXCLUDED.owner_id,
    slug = EXCLUDED.slug,
    status = EXCLUDED.status;

INSERT INTO tangent_workspace_memberships (
    workspace_id,
    user_id,
    role
)
VALUES
    ('fixture-workspace-alice', 'fixture-user-alice', 'owner'),
    ('fixture-workspace-bob', 'fixture-user-bob', 'owner')
ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = EXCLUDED.role;

INSERT INTO tangent_workspace_members (
    workspace_id,
    user_id,
    role,
    display_name
)
VALUES
    ('fixture-workspace-alice', 'fixture-user-alice', 'owner', 'Alice'),
    ('fixture-workspace-bob', 'fixture-user-bob', 'owner', 'Bob')
ON CONFLICT (workspace_id, user_id) DO UPDATE SET
    role = EXCLUDED.role,
    display_name = EXCLUDED.display_name;

INSERT INTO tangent_boards (
    id,
    workspace_id,
    owner_id,
    title,
    document,
    byte_size,
    asset_count,
    shape_count,
    saved_at,
    created_at,
    visibility
)
VALUES
    (
        'fixture-board-alice',
        'fixture-workspace-alice',
        'fixture-user-alice',
        'Alice Private Board',
        '{"assets": [], "shapes": []}'::jsonb,
        29,
        0,
        0,
        NOW(),
        NOW(),
        'private'
    ),
    (
        'fixture-board-bob',
        'fixture-workspace-bob',
        'fixture-user-bob',
        'Bob Private Board',
        '{"assets": [], "shapes": []}'::jsonb,
        29,
        0,
        0,
        NOW(),
        NOW(),
        'private'
    )
ON CONFLICT (workspace_id, id) DO UPDATE SET
    owner_id = EXCLUDED.owner_id,
    title = EXCLUDED.title,
    document = EXCLUDED.document,
    byte_size = EXCLUDED.byte_size,
    asset_count = EXCLUDED.asset_count,
    shape_count = EXCLUDED.shape_count,
    visibility = EXCLUDED.visibility,
    saved_at = EXCLUDED.saved_at;

INSERT INTO tangent_board_members (
    workspace_id,
    board_id,
    user_id,
    role
)
VALUES
    ('fixture-workspace-alice', 'fixture-board-alice', 'fixture-user-alice', 'owner'),
    ('fixture-workspace-bob', 'fixture-board-bob', 'fixture-user-bob', 'owner')
ON CONFLICT (workspace_id, board_id, user_id) DO UPDATE SET role = EXCLUDED.role;
