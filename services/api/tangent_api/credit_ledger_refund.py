import json
import os
from typing import Any, Callable, Optional
from uuid import uuid4

from tangent_api.credit_ledger_support import (
    credit_ledger_entry_from_row,
    load_credit_balance,
)
from tangent_api.credit_schemas import CreditLedgerMutationResponse
from tangent_api.request_context import ApiRequestContext
from tangent_api.workspace_entitlements import resolve_ai_charge_summary


def attempt_atomic_run_refund(
    account_id: str,
    actor_user_id: Optional[str],
    workspace_id: Optional[str],
    run_id: str,
    *,
    connect_db: Callable[[], object],
    metadata: Optional[dict[str, Any]] = None,
) -> Optional[CreditLedgerMutationResponse]:
    """Refund the outstanding debt for a run atomically and idempotently.

    Aggregates SUM(credits_delta) server-side for the (account_id, run_id, ai_run)
    tuple — eliminates LIMIT-bounded reads and float accumulation drift. The
    INSERT uses the partial unique index ``tangent_credit_ledger_run_refund_uidx``
    (migration 0034) on (account_id, source_id) WHERE source_type='ai_run'
    AND reason='usage_refund' together with ``ON CONFLICT ... DO NOTHING`` so
    concurrent callers that race the SUM step can never insert a second refund
    row: Postgres serializes the unique-index check and the loser becomes a
    no-op. On a successful insert we also bump
    tangent_ai_runs.credits_refunded so admin analytics stay aligned with the
    ledger (the ON CONFLICT DO UPDATE on tangent_ai_runs no longer touches
    that column — see ai_run_persistence_store.py).
    """
    entry_id = f"credit_ledger_{uuid4()}"
    with connect_db() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT COALESCE(SUM(credits_delta), 0)
                FROM tangent_credit_ledger
                WHERE account_id = %s AND source_id = %s AND source_type = 'ai_run'
                """,
                (account_id, run_id),
            )
            sum_row = cursor.fetchone()
            outstanding_debt = float(sum_row[0] or 0) if sum_row else 0.0
            if outstanding_debt >= 0:
                return None
            refund_amount = -outstanding_debt
            cursor.execute(
                """
                INSERT INTO tangent_credit_ledger (
                    id,
                    account_id,
                    workspace_id,
                    actor_user_id,
                    source_type,
                    source_id,
                    credits_delta,
                    reason,
                    metadata
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
                ON CONFLICT (account_id, source_id)
                    WHERE source_type = 'ai_run' AND reason = 'usage_refund'
                    DO NOTHING
                RETURNING id, account_id, workspace_id, actor_user_id, source_type, source_id,
                          credits_delta, reason, metadata, created_at
                """,
                (
                    entry_id,
                    account_id,
                    workspace_id,
                    actor_user_id,
                    "ai_run",
                    run_id,
                    refund_amount,
                    "usage_refund",
                    json.dumps(metadata or {}),
                ),
            )
            row = cursor.fetchone()
            if row is None:
                connection.commit()
                return None
            cursor.execute(
                """
                UPDATE tangent_ai_runs
                SET credits_refunded = COALESCE(credits_refunded, 0) + %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (refund_amount, run_id),
            )
            balance = load_credit_balance(cursor, account_id)
        connection.commit()
    return CreditLedgerMutationResponse(
        accountId=account_id,
        balanceCredits=balance,
        entry=credit_ledger_entry_from_row(row),
        ok=True,
    )


def refund_outstanding_run_charge(
    context: ApiRequestContext,
    run_id: str,
    metadata: Optional[dict[str, Any]] = None,
    *,
    account_id: Optional[str] = None,
    connect_db: Callable[[], object],
) -> Optional[CreditLedgerMutationResponse]:
    """Refund any outstanding usage_charge for ``run_id``.

    ``account_id`` MUST be supplied for any flow that already knows which
    account was charged (e.g. cancel paths reading
    ``tangent_ai_runs.charged_account_id`` for the run). Falling back to
    ``resolve_ai_charge_summary(context)`` is only safe when the run's
    billing context cannot have shifted since it was created — that
    resolver can raise 402 or pick a different account if Team seats or
    subscriptions changed in the meantime, which would leak the original
    charge.
    """
    if not os.getenv("DATABASE_URL"):
        return None
    resolved_account_id = account_id
    if not resolved_account_id:
        charge = resolve_ai_charge_summary(context)
        resolved_account_id = charge.charged_account_id
    return attempt_atomic_run_refund(
        account_id=resolved_account_id,
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        run_id=run_id,
        connect_db=connect_db,
        metadata=metadata,
    )
