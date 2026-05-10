from tangent_api.admin_operator_billing_history_rows import (
    audit_history_from_row,
    ledger_history_from_row,
    payment_history_from_row,
    subscription_history_from_row,
)
from tangent_api.admin_operator_schemas import AdminOperatorBillingHistoryRow
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

RELEVANT_CONTEXT_CTE = """
WITH relevant_workspaces AS (
    SELECT id, COALESCE(name, 'Workspace') AS workspace_name
    FROM tangent_workspaces
    WHERE owner_id = %s
      AND COALESCE(status, 'active') <> 'deleted'
      AND kind IN ('team_workspace', 'group_workspace')
),
relevant_accounts AS (
    SELECT ca.id,
           ca.owner_type,
           ca.owner_id,
           COALESCE(ca.account_kind, CASE WHEN ca.owner_type = 'workspace' THEN 'team_wallet' ELSE 'personal_wallet' END) AS account_kind,
           CASE WHEN ca.owner_type = 'workspace' THEN COALESCE(rw.workspace_name, 'Workspace') ELSE '' END AS workspace_name
    FROM tangent_credit_accounts ca
    LEFT JOIN relevant_workspaces rw ON rw.id = ca.owner_id AND ca.owner_type = 'workspace'
    WHERE (ca.owner_type = 'user' AND ca.owner_id = %s)
       OR (ca.owner_type = 'workspace' AND ca.owner_id IN (SELECT id FROM relevant_workspaces))
)
"""


def load_admin_operator_billing_history(user_id: str, *, limit: int) -> list[AdminOperatorBillingHistoryRow]:
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            rows = [
                *_load_payment_rows(cursor, user_id, limit),
                *_load_ledger_rows(cursor, user_id, limit),
                *_load_subscription_rows(cursor, user_id, limit),
                *_load_audit_rows(cursor, user_id, limit),
            ]
    rows.sort(key=lambda row: f"{row.created_at}|{row.id}", reverse=True)
    return rows[:limit]


def _load_payment_rows(cursor: object, user_id: str, limit: int) -> list[AdminOperatorBillingHistoryRow]:
    cursor.execute(
        f"""
        {RELEVANT_CONTEXT_CTE}
        SELECT p.id, p.amount_cents, p.currency, p.status, p.created_at, p.kind, p.provider,
               p.provider_payment_id, p.checkout_session_id, p.metadata,
               ra.owner_type, ra.owner_id, ra.account_kind,
               CASE WHEN ra.owner_type = 'workspace' THEN ra.owner_id ELSE NULL END AS workspace_id,
               ra.workspace_name
        FROM tangent_payments p
        JOIN relevant_accounts ra ON ra.id = p.account_id
        ORDER BY p.created_at DESC
        LIMIT %s
        """,
        (user_id, user_id, limit),
    )
    return [payment_history_from_row(row) for row in cursor.fetchall()]


def _load_ledger_rows(cursor: object, user_id: str, limit: int) -> list[AdminOperatorBillingHistoryRow]:
    cursor.execute(
        f"""
        {RELEVANT_CONTEXT_CTE}
        SELECT l.id, l.reason, l.credits_delta, l.workspace_id, ra.owner_type, ra.owner_id, ra.account_kind,
               COALESCE(workspace_from_ledger.name, ra.workspace_name, ''),
               l.created_at, l.metadata, l.source_type, l.source_id
        FROM tangent_credit_ledger l
        JOIN relevant_accounts ra ON ra.id = l.account_id
        LEFT JOIN tangent_workspaces workspace_from_ledger ON workspace_from_ledger.id = l.workspace_id
        ORDER BY l.created_at DESC
        LIMIT %s
        """,
        (user_id, user_id, limit),
    )
    return [ledger_history_from_row(row) for row in cursor.fetchall()]


def _load_subscription_rows(cursor: object, user_id: str, limit: int) -> list[AdminOperatorBillingHistoryRow]:
    cursor.execute(
        """
        WITH relevant_workspaces AS (
            SELECT id, COALESCE(name, 'Workspace') AS workspace_name
            FROM tangent_workspaces
            WHERE owner_id = %s
              AND COALESCE(status, 'active') <> 'deleted'
              AND kind IN ('team_workspace', 'group_workspace')
        )
        SELECT s.id, s.plan_family, s.plan_key, s.status, s.seat_capacity,
               s.current_period_start, s.current_period_end, s.created_at, s.updated_at,
               s.workspace_id, COALESCE(rw.workspace_name, ''),
               s.owner_type, s.owner_id, s.provider, s.provider_subscription_id
        FROM tangent_subscriptions s
        LEFT JOIN relevant_workspaces rw ON rw.id = COALESCE(s.workspace_id, CASE WHEN s.owner_type = 'workspace' THEN s.owner_id ELSE NULL END)
        WHERE (s.owner_type = 'user' AND s.owner_id = %s AND s.plan_family = 'collaborate')
           OR (s.owner_type = 'workspace' AND COALESCE(s.workspace_id, s.owner_id) IN (SELECT id FROM relevant_workspaces))
        ORDER BY COALESCE(s.updated_at, s.created_at) DESC
        LIMIT %s
        """,
        (user_id, user_id, limit),
    )
    return [subscription_history_from_row(row) for row in cursor.fetchall()]


def _load_audit_rows(cursor: object, user_id: str, limit: int) -> list[AdminOperatorBillingHistoryRow]:
    cursor.execute(
        """
        WITH relevant_workspaces AS (
            SELECT id
            FROM tangent_workspaces
            WHERE owner_id = %s
              AND COALESCE(status, 'active') <> 'deleted'
              AND kind IN ('team_workspace', 'group_workspace')
        )
        SELECT a.id, a.action, a.metadata, a.created_at, a.workspace_id, COALESCE(w.name, '')
        FROM tangent_admin_audit_logs a
        LEFT JOIN tangent_workspaces w ON w.id = a.workspace_id
        WHERE a.target_user_id = %s
           OR a.workspace_id IN (SELECT id FROM relevant_workspaces)
        ORDER BY a.created_at DESC
        LIMIT %s
        """,
        (user_id, user_id, limit),
    )
    return [audit_history_from_row(row) for row in cursor.fetchall()]
