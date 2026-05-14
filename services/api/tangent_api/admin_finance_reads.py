from typing import Optional

from tangent_api.admin_finance_schemas import (
    AdminFinanceLedgerRecord,
    AdminFinanceMemberUsageRecord,
    AdminFinancePaymentRecord,
    AdminFinanceSubscriptionRecord,
    AdminFinanceWalletRecord,
)
from tangent_api.admin_finance_rows import (
    ledger_from_row,
    member_usage_from_row,
    payment_from_row,
    subscription_from_row,
    wallet_from_row,
)
from tangent_api.admin_finance_summary_reads import load_admin_finance_summary
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def list_admin_finance_payments(
    *,
    kind: Optional[str] = None,
    limit: int = 50,
    provider: Optional[str] = None,
    status: Optional[str] = None,
    user_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> list[AdminFinancePaymentRecord]:
    where, params = _build_filters(
        {
            "p.kind = %s": kind,
            "p.provider = %s": provider,
            "p.status = %s": status,
            "ca.owner_type = 'user' AND ca.owner_id = %s": user_id,
            "(ca.owner_type = 'workspace' AND ca.owner_id = %s OR p.metadata ->> 'workspaceId' = %s)": (
                workspace_id,
                workspace_id,
            ) if workspace_id else None,
        }
    )
    rows = _fetchall(
        f"""
        SELECT p.id, p.account_id, ca.owner_type, ca.owner_id, COALESCE(ca.account_kind, 'personal_wallet'),
               p.provider, p.provider_payment_id, p.amount_cents, p.currency, p.status, p.created_at,
               p.checkout_session_id, p.kind, p.metadata
        FROM tangent_payments p
        LEFT JOIN tangent_credit_accounts ca ON ca.id = p.account_id
        {where}
        ORDER BY p.created_at DESC
        LIMIT %s
        """,
        (*params, limit),
    )
    return [payment_from_row(row) for row in rows]


def list_admin_finance_wallets(
    *,
    account_kind: Optional[str] = None,
    limit: int = 50,
    owner_id: Optional[str] = None,
    owner_type: Optional[str] = None,
    status: Optional[str] = None,
) -> list[AdminFinanceWalletRecord]:
    where, params = _build_filters(
        {
            "ca.account_kind = %s": account_kind,
            "ca.owner_id = %s": owner_id,
            "ca.owner_type = %s": owner_type,
            "ca.status = %s": status,
        }
    )
    rows = _fetchall(
        f"""
        SELECT ca.id, ca.owner_type, ca.owner_id, COALESCE(ca.account_kind, 'personal_wallet'),
               ca.status, ca.created_at, ca.updated_at, COALESCE(SUM(l.credits_delta), 0)
        FROM tangent_credit_accounts ca
        LEFT JOIN tangent_credit_ledger l ON l.account_id = ca.id
        {where}
        GROUP BY ca.id, ca.owner_type, ca.owner_id, COALESCE(ca.account_kind, 'personal_wallet'),
                 ca.status, ca.created_at, ca.updated_at
        ORDER BY ca.updated_at DESC
        LIMIT %s
        """,
        (*params, limit),
    )
    return [wallet_from_row(row) for row in rows]


def list_admin_finance_ledger(
    *,
    account_id: Optional[str] = None,
    actor_user_id: Optional[str] = None,
    limit: int = 50,
    reason: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> list[AdminFinanceLedgerRecord]:
    where, params = _build_filters(
        {
            "l.account_id = %s": account_id,
            "l.actor_user_id = %s": actor_user_id,
            "l.reason = %s": reason,
            "l.workspace_id = %s": workspace_id,
        }
    )
    rows = _fetchall(
        f"""
        SELECT l.id, l.account_id, ca.owner_type, ca.owner_id, COALESCE(ca.account_kind, 'personal_wallet'),
               l.workspace_id, l.actor_user_id, l.source_type, l.source_id, l.credits_delta,
               l.reason, l.metadata, l.created_at
        FROM tangent_credit_ledger l
        LEFT JOIN tangent_credit_accounts ca ON ca.id = l.account_id
        {where}
        ORDER BY l.created_at DESC
        LIMIT %s
        """,
        (*params, limit),
    )
    return [ledger_from_row(row) for row in rows]


def list_admin_finance_subscriptions(
    *,
    limit: int = 50,
    owner_id: Optional[str] = None,
    plan_family: Optional[str] = None,
    status: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> list[AdminFinanceSubscriptionRecord]:
    where, params = _build_filters(
        {
            "owner_id = %s": owner_id,
            "plan_family = %s": plan_family,
            "status = %s": status,
            "workspace_id = %s": workspace_id,
        }
    )
    rows = _fetchall(
        f"""
        SELECT id, account_id, owner_type, owner_id, workspace_id, plan_family, plan_key,
               provider, provider_customer_id, provider_subscription_id, status, seat_capacity,
               current_period_start, current_period_end, created_at, updated_at
        FROM tangent_subscriptions
        {where}
        ORDER BY updated_at DESC
        LIMIT %s
        """,
        (*params, limit),
    )
    return [subscription_from_row(row) for row in rows]


def list_admin_finance_member_usage(workspace_id: str, *, limit: int = 50) -> list[AdminFinanceMemberUsageRecord]:
    rows = _fetchall(
        """
        SELECT wm.workspace_id, wm.user_id, u.email, COALESCE(wm.display_name, u.display_name, u.email),
               wm.role,
               COALESCE(SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END), 0),
               COUNT(l.id) FILTER (WHERE l.credits_delta < 0),
               MAX(l.created_at)
        FROM tangent_workspace_members wm
        LEFT JOIN tangent_users u ON u.id = wm.user_id
        LEFT JOIN tangent_credit_ledger l ON l.workspace_id = wm.workspace_id
            AND l.actor_user_id = wm.user_id
            AND l.credits_delta < 0
        WHERE wm.workspace_id = %s
        GROUP BY wm.workspace_id, wm.user_id, u.email, COALESCE(wm.display_name, u.display_name, u.email), wm.role
        ORDER BY COALESCE(SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END), 0) DESC,
                 wm.user_id ASC
        LIMIT %s
        """,
        (workspace_id, limit),
    )
    return [member_usage_from_row(row) for row in rows]


def _build_filters(filters: dict[str, object]) -> tuple[str, tuple[object, ...]]:
    clauses: list[str] = []
    params: list[object] = []
    for clause, value in filters.items():
        if value is None or value == "":
            continue
        clauses.append(f"({clause})")
        if isinstance(value, tuple):
            params.extend(value)
        else:
            params.append(value)
    return (f"WHERE {' AND '.join(clauses)}" if clauses else "", tuple(params))


def _fetchall(query: str, params: tuple[object, ...]) -> list[tuple[object, ...]]:
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()
