"""add workspace invite role contract

Revision ID: 20260508_0013
Revises: 20260508_0012
Create Date: 2026-05-08
"""

from alembic import op


revision = "20260508_0013"
down_revision = "20260508_0012"
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


WORKSPACE_ROLE_CLAUSE = "CHECK (role IN ('owner', 'admin', 'editor', 'viewer', 'member', 'guest')) NOT VALID"
INVITE_ROLE_CLAUSE = "CHECK (role IN ('admin', 'editor', 'viewer', 'member', 'guest')) NOT VALID"


UPGRADE = [
    "ALTER TABLE IF EXISTS tangent_workspace_members DROP CONSTRAINT IF EXISTS tangent_workspace_members_role_check",
    "ALTER TABLE IF EXISTS tangent_workspace_members DROP CONSTRAINT IF EXISTS tangent_workspace_members_role_ck",
    constraint_sql("tangent_workspace_members_role_ck", "tangent_workspace_members", WORKSPACE_ROLE_CLAUSE),
    "ALTER TABLE IF EXISTS tangent_workspace_invitations DROP CONSTRAINT IF EXISTS tangent_workspace_invitations_role_check",
    "ALTER TABLE IF EXISTS tangent_workspace_invitations DROP CONSTRAINT IF EXISTS tangent_workspace_invitations_role_ck",
    "ALTER TABLE IF EXISTS tangent_workspace_invitations ALTER COLUMN email DROP NOT NULL",
    constraint_sql("tangent_workspace_invitations_role_ck", "tangent_workspace_invitations", INVITE_ROLE_CLAUSE),
    "CREATE INDEX IF NOT EXISTS tangent_workspace_members_workspace_role_idx ON tangent_workspace_members (workspace_id, role, joined_at DESC)",
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_workspace_members_workspace_role_idx",
    "ALTER TABLE IF EXISTS tangent_workspace_invitations DROP CONSTRAINT IF EXISTS tangent_workspace_invitations_role_ck",
    "UPDATE tangent_workspace_invitations SET role = 'member' WHERE role = 'editor'",
    "UPDATE tangent_workspace_invitations SET role = 'guest' WHERE role = 'viewer'",
    "UPDATE tangent_workspace_invitations SET email = COALESCE(email, 'invite@tangent.local') WHERE email IS NULL",
    "ALTER TABLE IF EXISTS tangent_workspace_invitations ALTER COLUMN email SET NOT NULL",
    constraint_sql(
        "tangent_workspace_invitations_role_ck",
        "tangent_workspace_invitations",
        "CHECK (role IN ('admin', 'member', 'guest')) NOT VALID",
    ),
    "ALTER TABLE IF EXISTS tangent_workspace_members DROP CONSTRAINT IF EXISTS tangent_workspace_members_role_ck",
    "UPDATE tangent_workspace_members SET role = 'member' WHERE role = 'editor'",
    "UPDATE tangent_workspace_members SET role = 'guest' WHERE role = 'viewer'",
    constraint_sql(
        "tangent_workspace_members_role_ck",
        "tangent_workspace_members",
        "CHECK (role IN ('owner', 'admin', 'member', 'guest')) NOT VALID",
    ),
]
