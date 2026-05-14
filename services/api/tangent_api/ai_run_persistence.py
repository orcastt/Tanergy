import json
import os
from datetime import datetime, timezone
from typing import Optional

from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_schemas import AiRunChargeSummary, AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres


def persist_ai_run_record(
    run: AiRunRecord,
    payload: AiRunRequest,
    context: ApiRequestContext,
) -> None:
    if not os.getenv("DATABASE_URL"):
        return
    created_at = _parse_datetime(run.created_at)
    charged_credits = float(run.cost_credits or 0)
    with connect_to_postgres() as connection:
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
                    json.dumps(_persisted_params(payload)),
                    _prompt_preview(payload.prompt),
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
    run: AiRunRecord,
    context: ApiRequestContext,
    attempts: list[AiProviderAttemptResult],
) -> None:
    if not os.getenv("DATABASE_URL") or not attempts:
        return
    charged_credits = float(run.cost_credits or 0)
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            for index, attempt in enumerate(attempts, start=1):
                attempt_provider_cost = attempt.provider_cost
                attempt_provider_currency = attempt.provider_currency
                if attempt.status == "succeeded":
                    if attempt_provider_cost is None:
                        attempt_provider_cost = run.provider_cost
                    if attempt_provider_currency is None:
                        attempt_provider_currency = run.provider_currency
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
                        _api_call_attempt_id(run.run_id, index),
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
                        _parse_datetime(attempt.created_at),
                    ),
                )
        connection.commit()


def load_ai_run_record(run_id: str) -> Optional[AiRunRecord]:
    snapshot = load_ai_run_snapshot(run_id)
    if snapshot is None:
        return None
    charge = _build_charge(snapshot)
    text_output = snapshot["text_output"]
    if text_output is None and snapshot["run_type"] == "image_analysis" and snapshot["status"] == "succeeded":
        text_output = _build_mock_analysis_text(snapshot["prompt_preview"], snapshot["input_asset_ids"])
    return AiRunRecord(
        boardId=snapshot["board_id"],
        charge=charge,
        chargedAccountId=str(snapshot["charged_account_id"]),
        chargedScope=str(snapshot["charged_scope"]),
        costCredits=float(snapshot["cost_credits"] or 0),
        costHint=_build_cost_hint(
            charge,
            estimated_credits=float(snapshot["estimated_credits"] or 0),
            charged_credits=float(snapshot["cost_credits"] or 0),
            status=str(snapshot["status"]),
        ),
        createdAt=_to_iso(snapshot["created_at"]),
        estimatedCredits=float(snapshot["estimated_credits"] or 0),
        entitlementSource=str(snapshot["entitlement_source"]),
        error=snapshot["error_message"],
        inputAssetIds=list(snapshot["input_asset_ids"]),
        latencyMs=int(snapshot["latency_ms"] or 0),
        modelId=str(snapshot["model_id"]),
        nodeId=snapshot["node_id"],
        outputAssetIds=list(snapshot["output_asset_ids"]),
        pricingRuleId=snapshot["pricing_rule_id"],
        provider=str(snapshot["provider"]),
        providerCost=float(snapshot["provider_cost"]) if snapshot["provider_cost"] is not None else None,
        providerCurrency=snapshot["provider_currency"],
        routeId=snapshot["route_id"],
        routeKey=snapshot["route_key"],
        runId=str(snapshot["id"]),
        runType=str(snapshot["run_type"]),
        selectedTierKey=snapshot["selected_tier_key"],
        status=str(snapshot["status"]),
        textOutput=text_output,
        workspaceKind=str(snapshot["workspace_kind"]),
        workspaceSeatId=snapshot["workspace_seat_id"],
    )


def load_ai_run_request(run_id: str) -> Optional[AiRunRequest]:
    snapshot = load_ai_run_snapshot(run_id)
    if snapshot is None:
        return None
    return AiRunRequest(
        boardId=snapshot["board_id"],
        inputAssetIds=list(snapshot["input_asset_ids"]),
        nodeId=snapshot["node_id"],
        nodeType=None,
        params=dict(snapshot["params"]),
        prompt=snapshot["prompt_preview"],
        runType=str(snapshot["run_type"]),
        selectedModelId=str(snapshot["model_id"]),
        systemPrompt=_system_prompt_from_params(snapshot["params"]),
    )


def load_ai_run_owner_context(run_id: str) -> Optional[dict[str, str]]:
    if not os.getenv("DATABASE_URL"):
        return None
    with connect_to_postgres() as connection:
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


def load_ai_run_snapshot(run_id: str) -> Optional[dict[str, object]]:
    if not os.getenv("DATABASE_URL"):
        return None
    with connect_to_postgres() as connection:
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


def _build_charge(snapshot: dict[str, object]) -> AiRunChargeSummary:
    workspace_kind = str(snapshot["workspace_kind"])
    charged_scope = str(snapshot["charged_scope"])
    return AiRunChargeSummary(
        chargedAccountId=str(snapshot["charged_account_id"]),
        chargedScope=charged_scope,
        entitlementSource=str(snapshot["entitlement_source"]),
        payerLabel=_payer_label(charged_scope, workspace_kind),
        planKey="unknown",
        preflightStatus=str(snapshot["preflight_status"] or "mock_contract_only"),
        workspaceKind=workspace_kind,
        workspaceSeatId=snapshot["workspace_seat_id"],
    )


def _payer_label(charged_scope: str, workspace_kind: str) -> str:
    if charged_scope == "team_wallet":
        return "Charges Team wallet"
    if charged_scope == "workspace_pool" or workspace_kind == "enterprise_workspace":
        return "Charges enterprise workspace credits"
    return "Charges your credits"


def _prompt_preview(prompt: Optional[str]) -> Optional[str]:
    if prompt is None:
        return None
    trimmed = prompt.strip()
    return trimmed[:280] if trimmed else None


def _persisted_params(payload: AiRunRequest) -> dict[str, object]:
    params = dict(payload.params)
    if payload.system_prompt:
        params.setdefault("systemPrompt", payload.system_prompt)
    return params


def _system_prompt_from_params(params: object) -> Optional[str]:
    if not isinstance(params, dict):
        return None
    value = params.get("systemPrompt")
    return value if isinstance(value, str) and value.strip() else None


def _build_cost_hint(
    charge: AiRunChargeSummary,
    estimated_credits: float,
    charged_credits: float,
    status: str,
) -> str:
    if status == "queued":
        return f"Mock AI run queued · {charge.payer_label}"
    if status == "running":
        return f"Mock AI run running · {charge.payer_label}"
    if status == "canceled":
        return f"Mock AI run canceled · {charge.payer_label}"
    if status == "failed":
        return f"Mock AI run failed · {charge.payer_label}"
    if charge.preflight_status == "settled":
        credits = charged_credits or estimated_credits
        return f"Mock AI run · charged {credits:g} credits · {charge.payer_label}"
    return f"Mock AI run · {charge.payer_label}"


def _api_call_attempt_id(run_id: str, attempt_number: int) -> str:
    return f"ai_call_{run_id}_a{attempt_number}"


def _build_mock_analysis_text(prompt: str, input_asset_ids: list[str]) -> str:
    asset_list = ", ".join(input_asset_ids) or "none"
    return f"Mock analysis: read {len(input_asset_ids)} image(s). Reverse prompt: {prompt or 'Untitled prompt'}. Source assets: {asset_list}"


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
