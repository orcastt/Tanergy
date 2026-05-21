import os
from typing import Optional

from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_schemas import AiRunRecord
from tangent_api.request_context import ApiRequestContext


def persist_ai_cost_ledger_entries(
    run: AiRunRecord,
    context: ApiRequestContext,
    attempts: list[AiProviderAttemptResult],
) -> None:
    if not os.getenv("DATABASE_URL") or not attempts:
        return
    from tangent_api.ai_run_persistence import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            for index, attempt in enumerate(attempts, start=1):
                ai_call_id = f"ai_call_{run.run_id}_a{index}"
                provider_cost = attempt.provider_cost
                provider_currency = attempt.provider_currency or run.provider_currency or "usd"
                amount_usd = _normalize_amount_usd(provider_cost, provider_currency)
                settlement_kind = _settlement_kind(run, attempt)
                cursor.execute(
                    """
                    INSERT INTO tangent_api_cost_ledger (
                        id,
                        workspace_id,
                        user_id,
                        ai_call_id,
                        provider,
                        amount_usd,
                        credits_charged,
                        provider_cost,
                        provider_currency,
                        settlement_kind
                    )
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (id) DO UPDATE SET
                        ai_call_id = EXCLUDED.ai_call_id,
                        provider = EXCLUDED.provider,
                        amount_usd = EXCLUDED.amount_usd,
                        credits_charged = EXCLUDED.credits_charged,
                        provider_cost = EXCLUDED.provider_cost,
                        provider_currency = EXCLUDED.provider_currency,
                        settlement_kind = EXCLUDED.settlement_kind
                    """,
                    (
                        f"api_cost_{run.run_id}_a{index}",
                        context.workspace_id,
                        context.user_id,
                        ai_call_id,
                        attempt.provider,
                        amount_usd,
                        float(run.cost_credits or 0) if attempt.status == "succeeded" and run.status == "succeeded" else 0,
                        provider_cost,
                        provider_currency,
                        settlement_kind,
                    ),
                )
        connection.commit()


def _settlement_kind(run: AiRunRecord, attempt: AiProviderAttemptResult) -> str:
    if attempt.status != "succeeded":
        return "attempt_failure"
    if run.status == "succeeded":
        return "usage"
    return "provider_cost_only"


def _normalize_amount_usd(provider_cost: Optional[float], provider_currency: str) -> float:
    if provider_cost is None:
        return 0.0
    normalized_currency = provider_currency.strip().lower()
    if normalized_currency in {"", "usd"}:
        return round(float(provider_cost), 6)
    return round(float(provider_cost), 6)
