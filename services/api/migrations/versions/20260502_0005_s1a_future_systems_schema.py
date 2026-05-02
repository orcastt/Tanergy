"""add s1a future systems schema

Revision ID: 20260502_0005
Revises: 20260502_0004
Create Date: 2026-05-02
"""

from alembic import op


revision = "20260502_0005"
down_revision = "20260502_0004"
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
    """
    CREATE TABLE IF NOT EXISTS tangent_admin_roles (
        user_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'support', 'analyst', 'finance', 'moderator')),
        permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
        note TEXT,
        granted_by TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        revoked_at TIMESTAMPTZ,
        PRIMARY KEY (user_id, role)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_admin_audit_logs (
        id TEXT PRIMARY KEY,
        actor_user_id TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        target_user_id TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        workspace_id TEXT,
        action TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_admin_user_notes (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        note TEXT NOT NULL,
        created_by TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_credit_accounts (
        id TEXT PRIMARY KEY,
        owner_type TEXT NOT NULL CHECK (owner_type IN ('user', 'workspace')),
        owner_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'closed')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (owner_type, owner_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_credit_ledger (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES tangent_credit_accounts(id) ON DELETE CASCADE,
        workspace_id TEXT REFERENCES tangent_workspaces(id) ON DELETE SET NULL,
        actor_user_id TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        source_type TEXT NOT NULL,
        source_id TEXT,
        credits_delta NUMERIC(14, 4) NOT NULL,
        reason TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_subscriptions (
        id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL REFERENCES tangent_credit_accounts(id) ON DELETE CASCADE,
        provider TEXT NOT NULL DEFAULT 'stripe',
        provider_customer_id TEXT,
        provider_subscription_id TEXT,
        plan_key TEXT NOT NULL,
        status TEXT NOT NULL,
        current_period_end TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_payments (
        id TEXT PRIMARY KEY,
        account_id TEXT REFERENCES tangent_credit_accounts(id) ON DELETE SET NULL,
        provider TEXT NOT NULL DEFAULT 'stripe',
        provider_payment_id TEXT,
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'usd',
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_invoices (
        id TEXT PRIMARY KEY,
        account_id TEXT REFERENCES tangent_credit_accounts(id) ON DELETE SET NULL,
        provider_invoice_id TEXT,
        hosted_invoice_url TEXT,
        amount_due_cents INTEGER NOT NULL DEFAULT 0,
        amount_paid_cents INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'usd',
        status TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_webhook_events (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        provider_event_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        payload JSONB NOT NULL,
        processed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (provider, provider_event_id)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_model_provider_routes (
        id TEXT PRIMARY KEY,
        model_id TEXT NOT NULL,
        provider TEXT NOT NULL,
        route_key TEXT NOT NULL,
        capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
        credit_cost NUMERIC(12, 4) NOT NULL DEFAULT 0,
        raw_cost_estimate NUMERIC(12, 6),
        timeout_ms INTEGER NOT NULL DEFAULT 60000,
        retry_policy JSONB NOT NULL DEFAULT '{}'::jsonb,
        fallback_route_id TEXT,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_ai_api_calls (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES tangent_workspaces(id) ON DELETE CASCADE,
        user_id TEXT NOT NULL REFERENCES tangent_users(id) ON DELETE CASCADE,
        run_id TEXT REFERENCES tangent_ai_runs(id) ON DELETE SET NULL,
        board_id TEXT,
        node_id TEXT,
        model_id TEXT,
        provider TEXT NOT NULL,
        route_key TEXT,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled')),
        latency_ms INTEGER NOT NULL DEFAULT 0,
        credits_charged NUMERIC(12, 4) NOT NULL DEFAULT 0,
        credits_refunded NUMERIC(12, 4) NOT NULL DEFAULT 0,
        input_tokens INTEGER,
        output_tokens INTEGER,
        provider_cost NUMERIC(12, 6),
        error_code TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_ai_run_assets (
        run_id TEXT NOT NULL REFERENCES tangent_ai_runs(id) ON DELETE CASCADE,
        workspace_id TEXT NOT NULL,
        asset_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('input', 'output', 'reference')),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (run_id, workspace_id, asset_id, role),
        FOREIGN KEY (workspace_id, asset_id) REFERENCES tangent_assets(workspace_id, id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_api_cost_ledger (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL REFERENCES tangent_workspaces(id) ON DELETE CASCADE,
        user_id TEXT REFERENCES tangent_users(id) ON DELETE SET NULL,
        ai_call_id TEXT REFERENCES tangent_ai_api_calls(id) ON DELETE SET NULL,
        provider TEXT NOT NULL,
        amount_usd NUMERIC(12, 6) NOT NULL DEFAULT 0,
        credits_charged NUMERIC(12, 4) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_analytics_events (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        user_id TEXT,
        session_id TEXT,
        event_name TEXT NOT NULL,
        properties JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_moderation_items (
        id TEXT PRIMARY KEY,
        workspace_id TEXT,
        created_by TEXT,
        item_type TEXT NOT NULL,
        item_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'approved', 'rejected', 'ignored')),
        reason TEXT,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS tangent_idempotency_keys (
        key TEXT PRIMARY KEY,
        scope TEXT NOT NULL,
        response_hash TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL
    )
    """,
    "CREATE INDEX IF NOT EXISTS tangent_credit_ledger_account_idx ON tangent_credit_ledger (account_id, created_at DESC, id)",
    "CREATE INDEX IF NOT EXISTS tangent_ai_api_calls_workspace_idx ON tangent_ai_api_calls (workspace_id, created_at DESC, id)",
    "CREATE INDEX IF NOT EXISTS tangent_ai_api_calls_run_idx ON tangent_ai_api_calls (run_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_analytics_events_workspace_idx ON tangent_analytics_events (workspace_id, event_name, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_moderation_items_status_idx ON tangent_moderation_items (status, created_at DESC)",
    constraint_sql("tangent_ai_runs_status_ck", "tangent_ai_runs", "CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'canceled')) NOT VALID"),
]


DOWNGRADE = [
    "ALTER TABLE IF EXISTS tangent_ai_runs DROP CONSTRAINT IF EXISTS tangent_ai_runs_status_ck",
    "DROP TABLE IF EXISTS tangent_idempotency_keys",
    "DROP TABLE IF EXISTS tangent_moderation_items",
    "DROP TABLE IF EXISTS tangent_analytics_events",
    "DROP TABLE IF EXISTS tangent_api_cost_ledger",
    "DROP TABLE IF EXISTS tangent_ai_run_assets",
    "DROP TABLE IF EXISTS tangent_ai_api_calls",
    "DROP TABLE IF EXISTS tangent_model_provider_routes",
    "DROP TABLE IF EXISTS tangent_webhook_events",
    "DROP TABLE IF EXISTS tangent_invoices",
    "DROP TABLE IF EXISTS tangent_payments",
    "DROP TABLE IF EXISTS tangent_subscriptions",
    "DROP TABLE IF EXISTS tangent_credit_ledger",
    "DROP TABLE IF EXISTS tangent_credit_accounts",
    "DROP TABLE IF EXISTS tangent_admin_user_notes",
    "DROP TABLE IF EXISTS tangent_admin_audit_logs",
    "DROP TABLE IF EXISTS tangent_admin_roles",
]
