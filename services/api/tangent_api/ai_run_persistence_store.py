import json
import os
from typing import Any, Optional

from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_run_persistence_support import (
    api_call_attempt_id,
    parse_datetime,
    persisted_params,
    prompt_preview,
)
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext


def persist_ai_run_record(
    *,
    connect_db: Any,
    context: ApiRequestContext,
    payload: AiRunRequest,
    run: AiRunRecord,
) -> None:
    if not os.getenv("DATABASE_URL"):
        return
    created_at = parse_datetime(run.created_at)
    charged_credits = float(run.cost_credits or 0)
    with connect_db() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO tangent_ai_runs (
                    id, workspace_id, created_by, board_id, node_id, run_type, model_id, provider,
                    status, input_asset_ids, output_asset_ids, params, prompt_preview, cost_credits,
                    latency_ms, error_code, error_message, workspace_kind, workspace_seat_id,
                    charged_account_id, charged_scope, entitlement_source, credits_charged,
                    credits_refunded, provider_cost, provider_currency, estimated_credits,
                    pricing_rule_id, route_id, route_key, selected_tier_key, preflight_status, text_output,
                    created_at, updated_at
                )
                VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s::jsonb, %s::jsonb, %s::jsonb, %s, %s,
                    %s, %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s,
                    %s, %s
                )
                ON CONFLICT (id) DO UPDATE SET
                    board_id = EXCLUDED.board_id,
                    node_id = EXCLUDED.node_id,
                    status = EXCLUDED.status,
                    output_asset_ids = EXCLUDED.output_asset_ids,
                    params = EXCLUDED.params,
                    prompt_preview = EXCLUDED.prompt_preview,
                    cost_credits = EXCLUDED.cost_credits,
                    latency_ms = EXCLUDED.latency_ms,
                    error_code = EXCLUDED.error_code,
                    error_message = EXCLUDED.error_message,
                    credits_charged = EXCLUDED.credits_charged,
                    credits_refunded = EXCLUDED.credits_refunded,
                    provider_cost = EXCLUDED.provider_cost,
                    provider_currency = EXCLUDED.provider_currency,
                    estimated_credits = EXCLUDED.estimated_credits,
                    pricing_rule_id = EXCLUDED.pricing_rule_id,
                    route_id = EXCLUDED.route_id,
                    route_key = EXCLUDED.route_key,
                    selected_tier_key = EXCLUDED.selected_tier_key,
                    preflight_status = EXCLUDED.preflight_status,
                    text_output = EXCLUDED.text_output,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    run.run_id,
                    context.workspace_id,
                    context.user_id,
                    run.board_id,
                    run.node_id,
                    run.run_type,
                    run.model_id,
                    run.provider,
                    run.status,
                    json.dumps(run.input_asset_ids),
                    json.dumps(run.output_asset_ids),
                    json.dumps(persisted_params(payload)),
                    prompt_preview(payload.prompt),
                    run.cost_credits,
                    run.latency_ms,
                    run.error,
                    run.error,
                    run.workspace_kind,
                    run.workspace_seat_id,
                    run.charged_account_id,
                    run.charged_scope,
                    run.entitlement_source,
                    charged_credits,
                    0,
                    run.provider_cost,
                    run.provider_currency,
                    run.estimated_credits,
                    run.pricing_rule_id,
                    run.route_id,
                    run.route_key,
                    run.selected_tier_key,
                    run.charge.preflight_status,
                    run.text_output,
                    created_at,
                    created_at,
                ),
            )
        connection.commit()


def persist_ai_api_call_attempts(
    *,
    attempts: list[AiProviderAttemptResult],
    connect_db: Any,
    context: ApiRequestContext,
    run: AiRunRecord,
) -> None:
    if not os.getenv("DATABASE_URL") or not attempts:
        return
    charged_credits = float(run.cost_credits or 0)
    with connect_db() as connection:
        with connection.cursor() as cursor:
            for index, attempt in enumerate(attempts, start=1):
                attempt_provider_cost = attempt.provider_cost if attempt.provider_cost is not None else (run.provider_cost if attempt.status == "succeeded" else None)
                attempt_provider_currency = attempt.provider_currency if attempt.provider_currency is not None else (run.provider_currency if attempt.status == "succeeded" else None)
                cursor.execute(
                    """
                    INSERT INTO tangent_ai_api_calls (
                        id, workspace_id, user_id, run_id, board_id, node_id, model_id, provider,
                        route_key, route_id, pricing_rule_id, status, latency_ms, credits_charged,
                        credits_refunded, provider_cost, provider_currency, error_code, created_at
                    )
                    VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        board_id = EXCLUDED.board_id,
                        node_id = EXCLUDED.node_id,
                        model_id = EXCLUDED.model_id,
                        provider = EXCLUDED.provider,
                        route_key = EXCLUDED.route_key,
                        route_id = EXCLUDED.route_id,
                        pricing_rule_id = EXCLUDED.pricing_rule_id,
                        status = EXCLUDED.status,
                        latency_ms = EXCLUDED.latency_ms,
                        credits_charged = EXCLUDED.credits_charged,
                        credits_refunded = EXCLUDED.credits_refunded,
                        provider_cost = EXCLUDED.provider_cost,
                        provider_currency = EXCLUDED.provider_currency,
                        error_code = EXCLUDED.error_code
                    """,
                    (
                        api_call_attempt_id(run.run_id, index),
                        context.workspace_id,
                        context.user_id,
                        run.run_id,
                        run.board_id,
                        run.node_id,
                        run.model_id,
                        attempt.provider,
                        attempt.route_key,
                        attempt.route_id,
                        run.pricing_rule_id,
                        attempt.status,
                        attempt.latency_ms,
                        charged_credits if attempt.status == "succeeded" else 0,
                        0,
                        attempt_provider_cost,
                        attempt_provider_currency,
                        attempt.error_code,
                        parse_datetime(attempt.created_at),
                    ),
                )
        connection.commit()


def load_ai_run_owner_context(*, connect_db: Any, run_id: str) -> Optional[dict[str, str]]:
    if not os.getenv("DATABASE_URL"):
        return None
    with connect_db() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT workspace_id, created_by, workspace_kind
                FROM tangent_ai_runs
                WHERE id = %s
                """,
                (run_id,),
            )
            row = cursor.fetchone()
    if row is None:
        return None
    return {
        "created_by": str(row[1]),
        "workspace_id": str(row[0]),
        "workspace_kind": str(row[2] or "solo_workspace"),
    }


def load_ai_run_snapshot(*, connect_db: Any, run_id: str) -> Optional[dict[str, object]]:
    if not os.getenv("DATABASE_URL"):
        return None
    with connect_db() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, board_id, charged_account_id, charged_scope, cost_credits, workspace_kind,
                       workspace_seat_id, entitlement_source, input_asset_ids, latency_ms, model_id,
                       node_id, output_asset_ids, provider, run_type, status, prompt_preview,
                       created_at, pricing_rule_id, route_id, route_key, estimated_credits,
                       selected_tier_key, preflight_status, params, error_message, text_output,
                       provider_cost, provider_currency
                FROM tangent_ai_runs
                WHERE id = %s
                """,
                (run_id,),
            )
            row = cursor.fetchone()
    if row is None:
        return None
    return {
        "id": row[0],
        "board_id": row[1],
        "charged_account_id": row[2],
        "charged_scope": row[3],
        "cost_credits": row[4],
        "workspace_kind": row[5],
        "workspace_seat_id": row[6],
        "entitlement_source": row[7],
        "input_asset_ids": list(row[8] or []),
        "latency_ms": row[9],
        "model_id": row[10],
        "node_id": row[11],
        "output_asset_ids": list(row[12] or []),
        "provider": row[13],
        "run_type": row[14],
        "status": row[15],
        "prompt_preview": str(row[16] or ""),
        "created_at": row[17],
        "pricing_rule_id": row[18],
        "route_id": row[19],
        "route_key": row[20],
        "estimated_credits": row[21],
        "selected_tier_key": row[22],
        "preflight_status": row[23],
        "params": dict(row[24] or {}),
        "error_message": row[25],
        "text_output": row[26],
        "provider_cost": row[27],
        "provider_currency": row[28],
    }
