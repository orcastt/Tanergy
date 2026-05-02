"""harden s1a constraints and indexes

Revision ID: 20260502_0006
Revises: 20260502_0005
Create Date: 2026-05-02
"""

from alembic import op


revision = "20260502_0006"
down_revision = "20260502_0005"
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
    constraint_sql(
        "tangent_workspaces_owner_fk",
        "tangent_workspaces",
        "FOREIGN KEY (owner_id) REFERENCES tangent_users(id) ON DELETE RESTRICT NOT VALID",
    ),
    constraint_sql(
        "tangent_workspaces_billing_owner_fk",
        "tangent_workspaces",
        "FOREIGN KEY (billing_owner_user_id) REFERENCES tangent_users(id) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_workspace_memberships_workspace_fk",
        "tangent_workspace_memberships",
        "FOREIGN KEY (workspace_id) REFERENCES tangent_workspaces(id) ON DELETE CASCADE NOT VALID",
    ),
    constraint_sql(
        "tangent_workspace_memberships_user_fk",
        "tangent_workspace_memberships",
        "FOREIGN KEY (user_id) REFERENCES tangent_users(id) ON DELETE CASCADE NOT VALID",
    ),
    constraint_sql(
        "tangent_auth_sessions_user_fk",
        "tangent_auth_sessions",
        "FOREIGN KEY (user_id) REFERENCES tangent_users(id) ON DELETE CASCADE NOT VALID",
    ),
    constraint_sql(
        "tangent_auth_sessions_workspace_fk",
        "tangent_auth_sessions",
        "FOREIGN KEY (workspace_id) REFERENCES tangent_workspaces(id) ON DELETE CASCADE NOT VALID",
    ),
    constraint_sql(
        "tangent_email_otps_purpose_ck",
        "tangent_email_otps",
        "CHECK (purpose IN ('signup', 'login', 'password_reset', 'email_verify')) NOT VALID",
    ),
    constraint_sql(
        "tangent_boards_workspace_fk",
        "tangent_boards",
        "FOREIGN KEY (workspace_id) REFERENCES tangent_workspaces(id) ON DELETE CASCADE NOT VALID",
    ),
    constraint_sql(
        "tangent_boards_owner_fk",
        "tangent_boards",
        "FOREIGN KEY (owner_id) REFERENCES tangent_users(id) ON DELETE RESTRICT NOT VALID",
    ),
    constraint_sql(
        "tangent_assets_workspace_fk",
        "tangent_assets",
        "FOREIGN KEY (workspace_id) REFERENCES tangent_workspaces(id) ON DELETE CASCADE NOT VALID",
    ),
    constraint_sql(
        "tangent_assets_created_by_fk",
        "tangent_assets",
        "FOREIGN KEY (created_by) REFERENCES tangent_users(id) ON DELETE RESTRICT NOT VALID",
    ),
    constraint_sql(
        "tangent_board_snapshots_board_fk",
        "tangent_board_snapshots",
        "FOREIGN KEY (workspace_id, board_id) REFERENCES tangent_boards(workspace_id, id) ON DELETE CASCADE NOT VALID",
    ),
    constraint_sql(
        "tangent_board_snapshots_created_by_fk",
        "tangent_board_snapshots",
        "FOREIGN KEY (created_by) REFERENCES tangent_users(id) ON DELETE RESTRICT NOT VALID",
    ),
    constraint_sql(
        "tangent_ai_runs_workspace_fk",
        "tangent_ai_runs",
        "FOREIGN KEY (workspace_id) REFERENCES tangent_workspaces(id) ON DELETE CASCADE NOT VALID",
    ),
    constraint_sql(
        "tangent_ai_runs_created_by_fk",
        "tangent_ai_runs",
        "FOREIGN KEY (created_by) REFERENCES tangent_users(id) ON DELETE RESTRICT NOT VALID",
    ),
    constraint_sql(
        "tangent_api_call_logs_workspace_fk",
        "tangent_api_call_logs",
        "FOREIGN KEY (workspace_id) REFERENCES tangent_workspaces(id) ON DELETE CASCADE NOT VALID",
    ),
    constraint_sql(
        "tangent_api_call_logs_user_fk",
        "tangent_api_call_logs",
        "FOREIGN KEY (user_id) REFERENCES tangent_users(id) ON DELETE RESTRICT NOT VALID",
    ),
    constraint_sql(
        "tangent_api_call_logs_run_fk",
        "tangent_api_call_logs",
        "FOREIGN KEY (run_id) REFERENCES tangent_ai_runs(id) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_model_routes_fallback_fk",
        "tangent_model_provider_routes",
        "FOREIGN KEY (fallback_route_id) REFERENCES tangent_model_provider_routes(id) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_admin_audit_workspace_fk",
        "tangent_admin_audit_logs",
        "FOREIGN KEY (workspace_id) REFERENCES tangent_workspaces(id) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_analytics_events_workspace_fk",
        "tangent_analytics_events",
        "FOREIGN KEY (workspace_id) REFERENCES tangent_workspaces(id) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_analytics_events_user_fk",
        "tangent_analytics_events",
        "FOREIGN KEY (user_id) REFERENCES tangent_users(id) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_moderation_workspace_fk",
        "tangent_moderation_items",
        "FOREIGN KEY (workspace_id) REFERENCES tangent_workspaces(id) ON DELETE SET NULL NOT VALID",
    ),
    constraint_sql(
        "tangent_moderation_created_by_fk",
        "tangent_moderation_items",
        "FOREIGN KEY (created_by) REFERENCES tangent_users(id) ON DELETE SET NULL NOT VALID",
    ),
    "CREATE INDEX IF NOT EXISTS tangent_auth_sessions_user_idx ON tangent_auth_sessions (user_id, expires_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_email_otps_email_idx ON tangent_email_otps (lower(email), purpose, expires_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_board_snapshots_user_idx ON tangent_board_snapshots (created_by, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_ai_runs_user_idx ON tangent_ai_runs (workspace_id, created_by, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_api_call_logs_user_idx ON tangent_api_call_logs (workspace_id, user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_admin_roles_active_idx ON tangent_admin_roles (user_id, role) WHERE revoked_at IS NULL",
    "CREATE INDEX IF NOT EXISTS tangent_admin_audit_actor_idx ON tangent_admin_audit_logs (actor_user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_admin_audit_target_idx ON tangent_admin_audit_logs (target_user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_admin_notes_user_idx ON tangent_admin_user_notes (user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_subscriptions_account_idx ON tangent_subscriptions (account_id, status, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_payments_account_idx ON tangent_payments (account_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_invoices_account_idx ON tangent_invoices (account_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_webhook_events_created_idx ON tangent_webhook_events (provider, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_model_routes_enabled_idx ON tangent_model_provider_routes (enabled, model_id, provider)",
    "CREATE INDEX IF NOT EXISTS tangent_ai_api_calls_user_idx ON tangent_ai_api_calls (workspace_id, user_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_api_cost_ledger_call_idx ON tangent_api_cost_ledger (ai_call_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS tangent_idempotency_keys_expires_idx ON tangent_idempotency_keys (expires_at)",
]


DOWNGRADE = [
    "DROP INDEX IF EXISTS tangent_idempotency_keys_expires_idx",
    "DROP INDEX IF EXISTS tangent_api_cost_ledger_call_idx",
    "DROP INDEX IF EXISTS tangent_ai_api_calls_user_idx",
    "DROP INDEX IF EXISTS tangent_model_routes_enabled_idx",
    "DROP INDEX IF EXISTS tangent_webhook_events_created_idx",
    "DROP INDEX IF EXISTS tangent_invoices_account_idx",
    "DROP INDEX IF EXISTS tangent_payments_account_idx",
    "DROP INDEX IF EXISTS tangent_subscriptions_account_idx",
    "DROP INDEX IF EXISTS tangent_admin_notes_user_idx",
    "DROP INDEX IF EXISTS tangent_admin_audit_target_idx",
    "DROP INDEX IF EXISTS tangent_admin_audit_actor_idx",
    "DROP INDEX IF EXISTS tangent_admin_roles_active_idx",
    "DROP INDEX IF EXISTS tangent_api_call_logs_user_idx",
    "DROP INDEX IF EXISTS tangent_ai_runs_user_idx",
    "DROP INDEX IF EXISTS tangent_board_snapshots_user_idx",
    "DROP INDEX IF EXISTS tangent_email_otps_email_idx",
    "DROP INDEX IF EXISTS tangent_auth_sessions_user_idx",
    "ALTER TABLE IF EXISTS tangent_moderation_items DROP CONSTRAINT IF EXISTS tangent_moderation_created_by_fk",
    "ALTER TABLE IF EXISTS tangent_moderation_items DROP CONSTRAINT IF EXISTS tangent_moderation_workspace_fk",
    "ALTER TABLE IF EXISTS tangent_analytics_events DROP CONSTRAINT IF EXISTS tangent_analytics_events_user_fk",
    "ALTER TABLE IF EXISTS tangent_analytics_events DROP CONSTRAINT IF EXISTS tangent_analytics_events_workspace_fk",
    "ALTER TABLE IF EXISTS tangent_admin_audit_logs DROP CONSTRAINT IF EXISTS tangent_admin_audit_workspace_fk",
    "ALTER TABLE IF EXISTS tangent_model_provider_routes DROP CONSTRAINT IF EXISTS tangent_model_routes_fallback_fk",
    "ALTER TABLE IF EXISTS tangent_api_call_logs DROP CONSTRAINT IF EXISTS tangent_api_call_logs_run_fk",
    "ALTER TABLE IF EXISTS tangent_api_call_logs DROP CONSTRAINT IF EXISTS tangent_api_call_logs_user_fk",
    "ALTER TABLE IF EXISTS tangent_api_call_logs DROP CONSTRAINT IF EXISTS tangent_api_call_logs_workspace_fk",
    "ALTER TABLE IF EXISTS tangent_ai_runs DROP CONSTRAINT IF EXISTS tangent_ai_runs_created_by_fk",
    "ALTER TABLE IF EXISTS tangent_ai_runs DROP CONSTRAINT IF EXISTS tangent_ai_runs_workspace_fk",
    "ALTER TABLE IF EXISTS tangent_board_snapshots DROP CONSTRAINT IF EXISTS tangent_board_snapshots_created_by_fk",
    "ALTER TABLE IF EXISTS tangent_board_snapshots DROP CONSTRAINT IF EXISTS tangent_board_snapshots_board_fk",
    "ALTER TABLE IF EXISTS tangent_assets DROP CONSTRAINT IF EXISTS tangent_assets_created_by_fk",
    "ALTER TABLE IF EXISTS tangent_assets DROP CONSTRAINT IF EXISTS tangent_assets_workspace_fk",
    "ALTER TABLE IF EXISTS tangent_boards DROP CONSTRAINT IF EXISTS tangent_boards_owner_fk",
    "ALTER TABLE IF EXISTS tangent_boards DROP CONSTRAINT IF EXISTS tangent_boards_workspace_fk",
    "ALTER TABLE IF EXISTS tangent_email_otps DROP CONSTRAINT IF EXISTS tangent_email_otps_purpose_ck",
    "ALTER TABLE IF EXISTS tangent_auth_sessions DROP CONSTRAINT IF EXISTS tangent_auth_sessions_workspace_fk",
    "ALTER TABLE IF EXISTS tangent_auth_sessions DROP CONSTRAINT IF EXISTS tangent_auth_sessions_user_fk",
    "ALTER TABLE IF EXISTS tangent_workspace_memberships DROP CONSTRAINT IF EXISTS tangent_workspace_memberships_user_fk",
    "ALTER TABLE IF EXISTS tangent_workspace_memberships DROP CONSTRAINT IF EXISTS tangent_workspace_memberships_workspace_fk",
    "ALTER TABLE IF EXISTS tangent_workspaces DROP CONSTRAINT IF EXISTS tangent_workspaces_billing_owner_fk",
    "ALTER TABLE IF EXISTS tangent_workspaces DROP CONSTRAINT IF EXISTS tangent_workspaces_owner_fk",
]
