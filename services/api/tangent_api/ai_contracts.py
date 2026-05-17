from concurrent.futures import ThreadPoolExecutor
import os
from datetime import datetime, timezone
from threading import BoundedSemaphore
from time import sleep
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.ai_contracts_support import (
    RunOwnerContext,
    build_run_context_from_owner,
    cached_run_owner_context,
    cached_run_request,
    execution_start_delay_ms,
    forget_run,
    has_run_persistence,
    prune_run_memory,
    should_charge_mock_ai_run,
)
from tangent_api.ai_control_plane import list_models, resolve_ai_run_quote
from tangent_api.ai_cost_ledger import persist_ai_cost_ledger_entries
from tangent_api.ai_run_execution import finalize_mock_run, mock_cost_hint
from tangent_api.ai_run_persistence import (
    load_ai_run_owner_context,
    load_ai_run_record,
    load_ai_run_request,
    persist_ai_api_call_attempts,
    persist_ai_run_record,
)
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.credit_ledger import build_credit_preflight_response
from tangent_api.request_context import ApiRequestContext

RUNS: dict[str, AiRunRecord] = {}
RUN_REQUESTS: dict[str, AiRunRequest] = {}
RUN_CONTEXTS: dict[str, RunOwnerContext] = {}
RUN_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="tangent-ai")
RUN_QUEUE_LIMIT = int(os.getenv("TANGENT_AI_RUN_QUEUE_LIMIT", "64"))
RUN_QUEUE_SEMAPHORE = BoundedSemaphore(RUN_QUEUE_LIMIT)
RUN_MEMORY_LIMIT = 500
RUN_MEMORY_TTL_SECONDS = 6 * 60 * 60
TERMINAL_RUN_STATUSES = {"canceled", "failed", "succeeded"}


def create_mock_run(payload: AiRunRequest, context: ApiRequestContext) -> AiRunRecord:
    quote_bundle = resolve_ai_run_quote(payload, context)
    charge = quote_bundle.quote.charge
    persistence_enabled = has_run_persistence()
    run_id = f"run_mock_{uuid4()}"
    cost_credits = quote_bundle.quote.estimated_credits
    if should_charge_mock_ai_run() and not persistence_enabled:
        raise HTTPException(status_code=501, detail="AI credit ledger charging requires DATABASE_URL.")
    if should_charge_mock_ai_run():
        preflight = build_credit_preflight_response(context, cost_credits)
        if not preflight.can_run:
            raise HTTPException(status_code=402, detail="Insufficient credits for this AI run.")
    if not RUN_QUEUE_SEMAPHORE.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="AI run queue is full. Try again shortly.")
    run = AiRunRecord(
        boardId=payload.board_id,
        charge=charge,
        chargedAccountId=charge.charged_account_id,
        chargedScope=charge.charged_scope,
        costCredits=0,
        costHint=mock_cost_hint(charge, cost_credits, "queued", should_charge_mock_ai_run()),
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
    if not persistence_enabled:
        RUNS[run.run_id] = run
        RUN_REQUESTS[run.run_id] = cached_run_request(payload)
    RUN_CONTEXTS[run.run_id] = cached_run_owner_context(context)
    prune_run_memory(
        run_contexts=RUN_CONTEXTS,
        run_memory_limit=RUN_MEMORY_LIMIT,
        run_memory_ttl_seconds=RUN_MEMORY_TTL_SECONDS,
        run_requests=RUN_REQUESTS,
        runs=RUNS,
        terminal_run_statuses=TERMINAL_RUN_STATUSES,
    )
    try:
        persist_ai_run_record(run, payload, context)
        _schedule_run_execution(run, payload, context)
    except Exception:
        RUN_QUEUE_SEMAPHORE.release()
        raise
    return run


def create_ai_run(payload: AiRunRequest, context: ApiRequestContext) -> AiRunRecord:
    return create_mock_run(payload, context)


def get_mock_run(run_id: str, context: ApiRequestContext) -> AiRunRecord:
    prune_run_memory(
        run_contexts=RUN_CONTEXTS,
        run_memory_limit=RUN_MEMORY_LIMIT,
        run_memory_ttl_seconds=RUN_MEMORY_TTL_SECONDS,
        run_requests=RUN_REQUESTS,
        runs=RUNS,
        terminal_run_statuses=TERMINAL_RUN_STATUSES,
    )
    persisted = load_ai_run_record(run_id)
    if persisted is not None:
        return persisted
    run = RUNS.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="AI run not found.")
    return run


def get_ai_run(run_id: str, context: ApiRequestContext) -> AiRunRecord:
    return get_mock_run(run_id, context)


def cancel_mock_run(run_id: str, context: ApiRequestContext) -> AiRunRecord:
    run_context = _resolve_run_context(run_id, context)
    run = load_ai_run_record(run_id) or RUNS.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="AI run not found.")
    if run.status == "canceled":
        return run
    if run.status not in {"queued", "running"}:
        raise HTTPException(status_code=409, detail="Only queued or running AI runs can be canceled.")
    canceled = run.model_copy(update={"cost_hint": mock_cost_hint(run.charge, run.estimated_credits, "canceled", should_charge_mock_ai_run()), "status": "canceled"})
    RUNS[run_id] = canceled
    payload = RUN_REQUESTS.get(run_id) or load_ai_run_request(run_id)
    if payload is None:
        raise HTTPException(status_code=500, detail="AI run payload is unavailable for cancel persistence.")
    persist_ai_run_record(canceled, payload, run_context)
    if has_run_persistence():
        forget_run(run_contexts=RUN_CONTEXTS, run_id=run_id, run_requests=RUN_REQUESTS, runs=RUNS)
    prune_run_memory(
        run_contexts=RUN_CONTEXTS,
        run_memory_limit=RUN_MEMORY_LIMIT,
        run_memory_ttl_seconds=RUN_MEMORY_TTL_SECONDS,
        run_requests=RUN_REQUESTS,
        runs=RUNS,
        terminal_run_statuses=TERMINAL_RUN_STATUSES,
    )
    return canceled


def cancel_ai_run(run_id: str, context: ApiRequestContext) -> AiRunRecord:
    return cancel_mock_run(run_id, context)


def _schedule_run_execution(run: AiRunRecord, payload: AiRunRequest, context: ApiRequestContext) -> None:
    future = RUN_EXECUTOR.submit(_execute_scheduled_run, run.run_id, payload, context)
    future.add_done_callback(lambda _future: RUN_QUEUE_SEMAPHORE.release())


def _execute_scheduled_run(run_id: str, payload: AiRunRequest, context: ApiRequestContext) -> None:
    try:
        delay_ms = execution_start_delay_ms()
        if delay_ms > 0:
            sleep(delay_ms / 1000)
        queued_run = load_ai_run_record(run_id) or RUNS.get(run_id)
        if queued_run is None or queued_run.status == "canceled":
            return
        running_run = queued_run.model_copy(update={"cost_hint": mock_cost_hint(queued_run.charge, queued_run.estimated_credits, "running", should_charge_mock_ai_run()), "latency_ms": 0, "status": "running"})
        RUNS[run_id] = running_run
        persist_ai_run_record(running_run, payload, context)
        latest = load_ai_run_record(run_id) or RUNS.get(run_id)
        if latest is None or latest.status == "canceled":
            return
        finalization = finalize_mock_run(running_run, payload, context, should_charge_mock_ai_run=should_charge_mock_ai_run())
        if finalization.attempts:
            persist_ai_api_call_attempts(finalization.run, context, finalization.attempts)
            persist_ai_cost_ledger_entries(finalization.run, context, finalization.attempts)
        canceled = load_ai_run_record(run_id)
        if canceled is not None and canceled.status == "canceled":
            if has_run_persistence():
                forget_run(run_contexts=RUN_CONTEXTS, run_id=run_id, run_requests=RUN_REQUESTS, runs=RUNS)
            else:
                RUNS[run_id] = canceled
            prune_run_memory(run_contexts=RUN_CONTEXTS, run_memory_limit=RUN_MEMORY_LIMIT, run_memory_ttl_seconds=RUN_MEMORY_TTL_SECONDS, run_requests=RUN_REQUESTS, runs=RUNS, terminal_run_statuses=TERMINAL_RUN_STATUSES)
            return
        persist_ai_run_record(finalization.run, payload, context)
        if has_run_persistence():
            forget_run(run_contexts=RUN_CONTEXTS, run_id=run_id, run_requests=RUN_REQUESTS, runs=RUNS)
        else:
            RUNS[run_id] = finalization.run
        prune_run_memory(run_contexts=RUN_CONTEXTS, run_memory_limit=RUN_MEMORY_LIMIT, run_memory_ttl_seconds=RUN_MEMORY_TTL_SECONDS, run_requests=RUN_REQUESTS, runs=RUNS, terminal_run_statuses=TERMINAL_RUN_STATUSES)
    except Exception as exc:
        failed_context = _resolve_run_context(run_id, context)
        current = load_ai_run_record(run_id) or RUNS.get(run_id)
        if current is None:
            return
        failed_payload = RUN_REQUESTS.get(run_id) or load_ai_run_request(run_id)
        if failed_payload is None:
            return
        failed_run = current.model_copy(update={"cost_hint": mock_cost_hint(current.charge, current.estimated_credits, "failed", should_charge_mock_ai_run()), "error": str(exc), "status": "failed"})
        persist_ai_run_record(failed_run, failed_payload, failed_context)
        if has_run_persistence():
            forget_run(run_contexts=RUN_CONTEXTS, run_id=run_id, run_requests=RUN_REQUESTS, runs=RUNS)
        else:
            RUNS[run_id] = failed_run
        prune_run_memory(run_contexts=RUN_CONTEXTS, run_memory_limit=RUN_MEMORY_LIMIT, run_memory_ttl_seconds=RUN_MEMORY_TTL_SECONDS, run_requests=RUN_REQUESTS, runs=RUNS, terminal_run_statuses=TERMINAL_RUN_STATUSES)


def _resolve_run_context(run_id: str, fallback_context: ApiRequestContext) -> ApiRequestContext:
    remembered = RUN_CONTEXTS.get(run_id)
    if remembered is not None:
        return build_run_context_from_owner(remembered, fallback_context)
    owner_context = load_ai_run_owner_context(run_id)
    if owner_context is None:
        return fallback_context
    recovered_owner = RunOwnerContext(
        user_id=owner_context["created_by"],
        workspace_id=owner_context["workspace_id"],
        workspace_kind=owner_context["workspace_kind"],
    )
    RUN_CONTEXTS[run_id] = recovered_owner
    prune_run_memory(
        run_contexts=RUN_CONTEXTS,
        run_memory_limit=RUN_MEMORY_LIMIT,
        run_memory_ttl_seconds=RUN_MEMORY_TTL_SECONDS,
        run_requests=RUN_REQUESTS,
        runs=RUNS,
        terminal_run_statuses=TERMINAL_RUN_STATUSES,
    )
    return build_run_context_from_owner(recovered_owner, fallback_context)
