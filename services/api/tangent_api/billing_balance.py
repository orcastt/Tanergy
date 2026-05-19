import os


def load_credit_balance_for_account(account_id: str) -> float:
    if not account_id or not os.getenv("DATABASE_URL"):
        return 0.0
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COALESCE(SUM(credits_delta), 0)
                FROM tangent_credit_ledger
                WHERE account_id = %s
                """,
                (account_id,),
            )
            row = cursor.fetchone()
    return float(row[0] or 0) if row else 0.0


def load_credit_reason_totals(account_id: str) -> dict[str, float]:
    if not account_id or not os.getenv("DATABASE_URL"):
        return {}
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT reason, COALESCE(SUM(credits_delta), 0)
                FROM tangent_credit_ledger
                WHERE account_id = %s
                GROUP BY reason
                """,
                (account_id,),
            )
            rows = cursor.fetchall()
    return {str(row[0]): float(row[1] or 0) for row in rows}


def load_credit_spent_for_account(account_id: str) -> float:
    if not account_id or not os.getenv("DATABASE_URL"):
        return 0.0
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COALESCE(SUM(CASE WHEN credits_delta < 0 THEN -credits_delta ELSE 0 END), 0)
                FROM tangent_credit_ledger
                WHERE account_id = %s
                """,
                (account_id,),
            )
            row = cursor.fetchone()
    return float(row[0] or 0) if row else 0.0


def split_credit_balance(total_balance: float, included_total: int) -> tuple[int, int]:
    normalized_balance = max(0.0, float(total_balance or 0))
    included_remaining = min(int(included_total or 0), int(normalized_balance))
    top_up_balance = max(0, int(round(normalized_balance - included_remaining)))
    return included_remaining, top_up_balance
