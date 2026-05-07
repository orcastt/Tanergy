from concurrent.futures import ThreadPoolExecutor
import os
from datetime import datetime, timezone
from time import sleep
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.ai_control_plane import list_models, resolve_ai_run_quote
from tangent_api.ai_cost_ledger import persist_ai_cost_ledger_entries
from tangent_api.ai_run_execution import finalize_mock_run, mock_cost_hint
from tangent_api.ai_run_persistence import (
    persist_ai_api_call_attempts,
    load_ai_run_owner_context,
    load_ai_run_record,
    load_ai_run_request,
    persist_ai_run_record,
)
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.credit_ledger import build_credit_preflight_response
from tangent_api.request_context import ApiRequestContext

RUNS: dict[str, AiRunRecord] = {}
RUN_REQUESTS: dict[str, AiRunRequest] = {}
RUN_CONTEXTS: dict[str, ApiRequestContext] = {}
RUN_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="tangent-ai")


def create_mock_run(payload: AiRunRequest, context: ApiRequestContext) -> AiRunRecord:
    quote_bundle = resolve_ai_run_quote(payload, context)
    charge = quote_bundle.quote.charge
    run_id = f"run_mock_{uuid4()}"
    cost_credits = quote_bundle.quote.estimated_credits
    if _should_charge_mock_ai_run() and not os.getenv("DATABASE_URL"):
        raise HTTPException(status_code=501, detail="AI credit ledger charging requires DATABASE_URL.")
    if _should_charge_mock_ai_run():
        preflight = build_credit_preflight_response(context, cost_credits)
        if not preflight.can_run:
            raise HTTPException(status_code=402, detail="Insufficient credits for this AI run.")
    run = AiRunRecord(
        boardId=payload.board_id,
        charge=charge,
        chargedAccountId=charge.charged_account_id,
        chargedScope=charge.charged_scope,
        costCredits=0,
        costHint=mock_cost_hint(charge, cost_credits, "queued", _should_charge_mock_ai_run()),
        createdAt=datetime.now(timezone.utc).isoformat(),
        estimatedCredits=cost_credits,
        entitlementSource=charge.entitlement_source,
        error=None,
        inputAssetIds=payload.input_asset_ids,
        latencyMs=0,
        modelId=quote_bundle.model.id,
        nodeId=payload.node_id,
        outputAssetIds=[],
        pricingRuleId=quote_bundle.pricing_rule_id,
        provider=quote_bundle.provider,
        providerCost=None,
        providerCurrency=None,
        routeId=quote_bundle.route_id,
        routeKey=quote_bundle.route_key,
        runId=run_id,
        runType=payload.run_type,
        selectedTierKey=quote_bundle.quote.selected_tier_key,
        status="queued",
        textOutput=None,
        workspaceKind=charge.workspace_kind,
        workspaceSeatId=charge.workspace_seat_id,
    )
    RUNS[run.run_id] = run
    RUN_REQUESTS[run.run_id] = payload
    RUN_CONTEXTS[run.run_id] = context
    persist_ai_run_record(run, payload, context)
    _schedule_run_execution(run, payload, context)
    return run


def get_mock_run(run_id: str, context: ApiRequestContext) -> AiRunRecord:
    persisted = load_ai_run_record(run_id)
    if persisted is not None:
        return persisted
    run = RUNS.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="AI run not found.")
    return run


def cancel_mock_run(run_id: str, context: ApiRequestContext) -> AiRunRecord:
    run_context = _resolve_run_context(run_id, context)
    run = load_ai_run_record(run_id) or RUNS.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="AI run not found.")
    if run.status == "canceled":
        return run
    if run.status not in {"queued", "running"}:
        raise HTTPException(status_code=409, detail="Only queued or running AI runs can be canceled.")
    canceled = run.model_copy(
        update={
            "cost_hint": mock_cost_hint(run.charge, run.estimated_credits, "canceled", _should_charge_mock_ai_run()),
            "status": "canceled",
        }
    )
    RUNS[run_id] = canceled
    payload = RUN_REQUESTS.get(run_id) or load_ai_run_request(run_id)
    if payload is None:
        raise HTTPException(status_code=500, detail="AI run payload is unavailable for cancel persistence.")
    persist_ai_run_record(canceled, payload, run_context)
    return canceled


def _should_charge_mock_ai_run() -> bool:
    return os.getenv("TANGENT_AI_MOCK_LEDGER_CHARGING") == "1"


def _schedule_run_execution(run: AiRunRecord, payload: AiRunRequest, context: ApiRequestContext) -> None:
    RUN_EXECUTOR.submit(_execute_scheduled_run, run.run_id, payload, context)


def _execute_scheduled_run(run_id: str, payload: AiRunRequest, context: ApiRequestContext) -> None:
    try:
        delay_ms = _execution_start_delay_ms()
        if delay_ms > 0:
            sleep(delay_ms / 1000)
        queued_run = load_ai_run_record(run_id) or RUNS.get(run_id)
        if queued_run is None or queued_run.status == "canceled":
            return
        running_run = queued_run.model_copy(
            update={
                "cost_hint": mock_cost_hint(
                    queued_run.charge,
                    queued_run.estimated_credits,
                    "running",
                    _should_charge_mock_ai_run(),
                ),
                "latency_ms": 0,
                "status": "running",
            }
        )
        RUNS[run_id] = running_run
        persist_ai_run_record(running_run, payload, context)
        latest = load_ai_run_record(run_id) or RUNS.get(run_id)
        if latest is None or latest.status == "canceled":
            return
        finalization = finalize_mock_run(
            running_run,
            payload,
            context,
            should_charge_mock_ai_run=_should_charge_mock_ai_run(),
        )
        if finalization.attempts:
            persist_ai_api_call_attempts(finalization.run, context, finalization.attempts)
            persist_ai_cost_ledger_entries(finalization.run, context, finalization.attempts)
        canceled = load_ai_run_record(run_id)
        if canceled is not None and canceled.status == "canceled":
            RUNS[run_id] = canceled
            return
        RUNS[run_id] = finalization.run
        persist_ai_run_record(finalization.run, payload, context)
    except Exception as exc:
        failed_context = _resolve_run_context(run_id, context)
        current = load_ai_run_record(run_id) or RUNS.get(run_id)
        if current is None:
            return
        failed_payload = RUN_REQUESTS.get(run_id) or load_ai_run_request(run_id)
        if failed_payload is None:
            return
        failed_run = current.model_copy(
            update={
                "cost_hint": mock_cost_hint(
                    current.charge,
                    current.estimated_credits,
                    "failed",
                    _should_charge_mock_ai_run(),
                ),
                "error": str(exc),
                "status": "failed",
            }
        )
        RUNS[run_id] = failed_run
        persist_ai_run_record(failed_run, failed_payload, failed_context)


def _execution_start_delay_ms() -> int:
    raw = os.getenv("TANGENT_AI_EXECUTION_START_DELAY_MS", "").strip()
    if not raw:
        return 0
    try:
        return max(0, int(raw))
    except ValueError:
        return 0


def _resolve_run_context(run_id: str, fallback_context: ApiRequestContext) -> ApiRequestContext:
    remembered = RUN_CONTEXTS.get(run_id)
    if remembered is not None:
        return remembered
    owner_context = load_ai_run_owner_context(run_id)
    if owner_context is None:
        return fallback_context
    recovered = ApiRequestContext(
        auth_mode=fallback_context.auth_mode,
        is_dev_fallback=fallback_context.is_dev_fallback,
        user_avatar_initials=fallback_context.user_avatar_initials,
        user_display_name=fallback_context.user_display_name,
        user_email=fallback_context.user_email,
        user_email_verified=fallback_context.user_email_verified,
        user_id=owner_context["created_by"],
        workspace_board_count=fallback_context.workspace_board_count,
        workspace_id=owner_context["workspace_id"],
        workspace_kind=owner_context["workspace_kind"],
        workspace_name=fallback_context.workspace_name,
        workspace_plan_key=fallback_context.workspace_plan_key,
        workspace_role=fallback_context.workspace_role,
    )
    RUN_CONTEXTS[run_id] = recovered
    return recovered
