"""add plan catalog admin controls

Revision ID: 20260511_0015
Revises: 20260510_0014
Create Date: 2026-05-11
"""

from alembic import op


revision = "20260511_0015"
down_revision = "20260510_0014"
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
    CREATE TABLE IF NOT EXISTS tangent_plan_catalog (
        plan_key TEXT PRIMARY KEY,
        plan_family TEXT NOT NULL,
        name TEXT NOT NULL,
        billing_period TEXT NOT NULL DEFAULT 'monthly_or_annual',
        included_credits INTEGER NOT NULL DEFAULT 0,
        monthly_price_usd INTEGER,
        annual_price_usd INTEGER,
        seat_range TEXT,
        seat_min INTEGER,
        seat_max INTEGER,
        board_limit INTEGER,
        page_limit INTEGER,
        registration_credits INTEGER NOT NULL DEFAULT 0,
        group_workspace_limit INTEGER,
        group_member_limit INTEGER,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT tangent_plan_catalog_plan_family_ck CHECK (plan_family IN ('free', 'collaborate', 'team', 'enterprise')),
        CONSTRAINT tangent_plan_catalog_billing_period_ck CHECK (billing_period IN ('none', 'monthly_or_annual', 'contract')),
        CONSTRAINT tangent_plan_catalog_included_credits_ck CHECK (included_credits >= 0),
        CONSTRAINT tangent_plan_catalog_registration_credits_ck CHECK (registration_credits >= 0),
        CONSTRAINT tangent_plan_catalog_seat_min_ck CHECK (seat_min IS NULL OR seat_min >= 0),
        CONSTRAINT tangent_plan_catalog_seat_max_ck CHECK (seat_max IS NULL OR seat_max >= 0),
        CONSTRAINT tangent_plan_catalog_board_limit_ck CHECK (board_limit IS NULL OR board_limit >= 0),
        CONSTRAINT tangent_plan_catalog_page_limit_ck CHECK (page_limit IS NULL OR page_limit >= 0),
        CONSTRAINT tangent_plan_catalog_group_workspace_limit_ck CHECK (group_workspace_limit IS NULL OR group_workspace_limit >= 0),
        CONSTRAINT tangent_plan_catalog_group_member_limit_ck CHECK (group_member_limit IS NULL OR group_member_limit >= 0)
    )
    """,
    "CREATE INDEX IF NOT EXISTS tangent_plan_catalog_family_idx ON tangent_plan_catalog (plan_family, plan_key)",
    """
    INSERT INTO tangent_plan_catalog (
        plan_key, plan_family, name, billing_period, included_credits,
        monthly_price_usd, annual_price_usd, seat_range, seat_min, seat_max,
        board_limit, page_limit, registration_credits, group_workspace_limit,
        group_member_limit, metadata
    )
    VALUES
        ('free_canvas', 'free', 'Free Canvas', 'none', 0, 0, 0, NULL, 1, 1, 1, 3, 50, 0, 0, '{}'::jsonb),
        ('collaborate_start', 'collaborate', 'Collaborate Start', 'monthly_or_annual', 1500, 18, 15, '1+ users', 1, 1, NULL, NULL, 0, 10, 15, '{}'::jsonb),
        ('collaborate_plus', 'collaborate', 'Collaborate Plus', 'monthly_or_annual', 2000, 25, 20, '1+ users', 1, 1, NULL, NULL, 0, 20, 15, '{}'::jsonb),
        ('team_start', 'team', 'Team Start', 'monthly_or_annual', 2500, 25, 20, '1-15 seats', 1, 15, NULL, NULL, 0, 0, 0, '{}'::jsonb),
        ('team_growth', 'team', 'Team Growth', 'monthly_or_annual', 5500, 45, 40, '1-15 seats', 1, 15, NULL, NULL, 0, 0, 0, '{}'::jsonb),
        ('enterprise', 'enterprise', 'Enterprise', 'contract', 0, NULL, NULL, 'custom', NULL, NULL, NULL, NULL, 0, NULL, NULL, '{}'::jsonb)
    ON CONFLICT (plan_key) DO NOTHING
    """,
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_plan_catalog_family_idx",
    "DROP TABLE IF EXISTS tangent_plan_catalog",
]
