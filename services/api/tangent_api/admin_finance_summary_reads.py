from __future__ import annotations

import json

from tangent_api.admin_finance_rows import account_count_from_row, as_float, count_from_row, subscription_count_from_row
from tangent_api.admin_finance_schemas import AdminFinanceLedgerTotals, AdminFinanceSummaryRecord
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def load_admin_finance_summary() -> AdminFinanceSummaryRecord:
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH payment_status AS (
                    SELECT COALESCE(jsonb_agg(jsonb_build_array(status, count, amount_cents) ORDER BY status), '[]'::jsonb) AS rows
                    FROM (
                        SELECT status, COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS amount_cents
                        FROM tangent_payments
                        GROUP BY status
                    ) grouped
                ),
                payment_kind AS (
                    SELECT COALESCE(jsonb_agg(jsonb_build_array(kind, count, amount_cents) ORDER BY kind), '[]'::jsonb) AS rows
                    FROM (
                        SELECT COALESCE(kind, 'unknown') AS kind, COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS amount_cents
                        FROM tangent_payments
                        GROUP BY COALESCE(kind, 'unknown')
                    ) grouped
                ),
                payment_provider AS (
                    SELECT COALESCE(jsonb_agg(jsonb_build_array(provider, count, amount_cents) ORDER BY provider), '[]'::jsonb) AS rows
                    FROM (
                        SELECT provider, COUNT(*) AS count, COALESCE(SUM(amount_cents), 0) AS amount_cents
                        FROM tangent_payments
                        GROUP BY provider
                    ) grouped
                ),
                account_counts AS (
                    SELECT COALESCE(jsonb_agg(jsonb_build_array(owner_type, account_kind, status, count) ORDER BY owner_type, account_kind, status), '[]'::jsonb) AS rows
                    FROM (
                        SELECT owner_type, COALESCE(account_kind, 'personal_wallet') AS account_kind, status, COUNT(*) AS count
                        FROM tangent_credit_accounts
                        GROUP BY owner_type, COALESCE(account_kind, 'personal_wallet'), status
                    ) grouped
                ),
                ledger_totals AS (
                    SELECT jsonb_build_array(
                        COALESCE(SUM(credits_delta), 0),
                        COALESCE(SUM(CASE WHEN credits_delta > 0 THEN credits_delta ELSE 0 END), 0),
                        COALESCE(SUM(CASE WHEN credits_delta < 0 THEN -credits_delta ELSE 0 END), 0)
                    ) AS row
                    FROM tangent_credit_ledger
                ),
                subscription_counts AS (
                    SELECT COALESCE(jsonb_agg(jsonb_build_array(plan_family, status, count, seat_capacity) ORDER BY plan_family, status), '[]'::jsonb) AS rows
                    FROM (
                        SELECT plan_family, status, COUNT(*) AS count, COALESCE(SUM(seat_capacity), 0) AS seat_capacity
                        FROM tangent_subscriptions
                        GROUP BY plan_family, status
                    ) grouped
                )
                SELECT payment_status.rows, payment_kind.rows, payment_provider.rows, account_counts.rows, ledger_totals.row, subscription_counts.rows
                FROM payment_status, payment_kind, payment_provider, account_counts, ledger_totals, subscription_counts
                """
            )
            row = cursor.fetchone() or ([], [], [], [], [0, 0, 0], [])
    payment_status = _json_rows(row[0])
    payment_kind = _json_rows(row[1])
    payment_provider = _json_rows(row[2])
    account_counts = _json_rows(row[3])
    ledger_totals = _json_row(row[4])
    subscription_counts = _json_rows(row[5])
    return AdminFinanceSummaryRecord(
        accountCounts=[account_count_from_row(row) for row in account_counts],
        ledgerTotals=AdminFinanceLedgerTotals(
            balanceCredits=as_float(ledger_totals[0]),
            grantedCredits=as_float(ledger_totals[1]),
            spentCredits=as_float(ledger_totals[2]),
        ),
        paymentKindCounts=[count_from_row(row) for row in payment_kind],
        paymentProviderCounts=[count_from_row(row) for row in payment_provider],
        paymentStatusCounts=[count_from_row(row) for row in payment_status],
        subscriptionCounts=[subscription_count_from_row(row) for row in subscription_counts],
    )


def _json_rows(value: object) -> list[tuple[object, ...]]:
    rows = value
    if isinstance(value, str) and value:
        rows = json.loads(value)
    if not isinstance(rows, list):
        return []
    return [tuple(row) for row in rows if isinstance(row, list)]


def _json_row(value: object) -> tuple[object, ...]:
    row = value
    if isinstance(value, str) and value:
        row = json.loads(value)
    if isinstance(row, list):
        return tuple(row)
    return (0, 0, 0)
