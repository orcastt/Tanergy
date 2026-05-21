import json
from typing import Any, Callable, Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.ai_schemas import AiRunChargeSummary
from tangent_api.credit_schemas import (
    CreditLedgerEntryRecord,
    CreditLedgerMutationResponse,
    CreditPreflightResponse,
)

LEDGER_REASONS = {
    "admin_adjustment",
    "plan_change_adjustment",
    "seat_change_adjustment",
    "subscription_grant",
    "topup_purchase",
    "usage_charge",
    "usage_refund",
}


def build_credit_preflight_for_account(
    account_id: str,
    required_credits: float,
    *,
    connect_db: Callable[[], object],
    has_database_url: bool,
) -> CreditPreflightResponse:
    available_credits = 0.0
    if has_database_url:
        with connect_db() as connection:
            with connection.cursor() as cursor:
                available_credits = load_credit_balance(cursor, account_id)
    can_run = available_credits >= required_credits
    shortfall = max(0.0, required_credits - available_credits)
    return CreditPreflightResponse(
        accountId=account_id,
        availableCredits=available_credits,
        canRun=can_run,
        charge=AiRunChargeSummary(
            chargedAccountId=account_id,
            chargedScope="actor_personal",
            entitlementSource="ledger_account_override",
            payerLabel="Charges your credits",
            planKey="unknown",
            preflightStatus="ok" if can_run else "insufficient_credits",
            workspaceKind="solo_workspace",
            workspaceSeatId=None,
        ),
        ok=True,
        preflightStatus="ok" if can_run else "insufficient_credits",
        requiredCredits=required_credits,
        shortfallCredits=shortfall,
    )


def load_credit_ledger_rows(
    account_id: str,
    limit: int,
    *,
    actor_user_id: Optional[str] = None,
    connect_db: Callable[[], object],
    reason: Optional[str] = None,
    source_id: Optional[str] = None,
    source_type: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> tuple[float, list[tuple[object, ...]]]:
    filters: list[str] = ["account_id = %s"]
    params: list[object] = [account_id]
    if actor_user_id:
        filters.append("actor_user_id = %s")
        params.append(actor_user_id.strip())
    if reason:
        filters.append("reason = %s")
        params.append(reason.strip())
    if source_id:
        filters.append("source_id = %s")
        params.append(source_id.strip())
    if source_type:
        filters.append("source_type = %s")
        params.append(source_type.strip())
    if workspace_id:
        filters.append("workspace_id = %s")
        params.append(workspace_id.strip())
    where_sql = " AND ".join(filters)

    with connect_db() as connection:
        with connection.cursor() as cursor:
            balance = load_credit_balance(cursor, account_id)
            cursor.execute(
                f"""
                SELECT id, account_id, workspace_id, actor_user_id, source_type, source_id,
                       credits_delta, reason, metadata, created_at
                FROM tangent_credit_ledger
                WHERE {where_sql}
                ORDER BY created_at DESC
                LIMIT %s
                """,
                tuple([*params, limit]),
            )
            rows = cursor.fetchall()
    return balance, rows


def write_credit_ledger_entry_for_account(
    account_id: str,
    actor_user_id: str,
    workspace_id: str,
    credits_delta: float,
    reason: str,
    source_id: Optional[str],
    source_type: str,
    *,
    connect_db: Callable[[], object],
    metadata: Optional[dict[str, Any]] = None,
) -> CreditLedgerMutationResponse:
    entry_id = f"credit_ledger_{uuid4()}"
    with connect_db() as connection:
        with connection.cursor() as cursor:
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
                RETURNING id, account_id, workspace_id, actor_user_id, source_type, source_id,
                          credits_delta, reason, metadata, created_at
                """,
                (
                    entry_id,
                    account_id,
                    workspace_id,
                    actor_user_id,
                    source_type,
                    source_id,
                    credits_delta,
                    reason,
                    json.dumps(metadata or {}),
                ),
            )
            row = cursor.fetchone()
            balance = load_credit_balance(cursor, account_id)
        connection.commit()
    return CreditLedgerMutationResponse(
        accountId=account_id,
        balanceCredits=balance,
        entry=credit_ledger_entry_from_row(row),
        ok=True,
    )


def load_credit_balance(cursor: object, account_id: str) -> float:
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


def positive_credits(value: float, label: str) -> float:
    if value <= 0:
        raise HTTPException(status_code=400, detail=f"{label} must be greater than zero.")
    return value


def credit_ledger_entry_from_row(row: tuple[object, ...]) -> CreditLedgerEntryRecord:
    return CreditLedgerEntryRecord(
        accountId=str(row[1]),
        actorUserId=row[3],
        createdAt=to_iso(row[9]),
        creditsDelta=float(row[6] or 0),
        id=str(row[0]),
        metadata=normalize_metadata(row[8]),
        reason=str(row[7]),
        sourceId=row[5],
        sourceType=str(row[4]),
        workspaceId=row[2],
    )


def normalize_limit(limit: int) -> int:
    if limit < 1:
        return 1
    return min(limit, 100)


def normalize_metadata(value: object) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
