from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
import os
from datetime import datetime, timezone
from threading import BoundedSemaphore
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
RUN_CONTEXTS: dict[str, "_RunOwnerContext"] = {}
RUN_EXECUTOR = ThreadPoolExecutor(max_workers=4, thread_name_prefix="tangent-ai")
RUN_QUEUE_LIMIT = int(os.getenv("TANGENT_AI_RUN_QUEUE_LIMIT", "64"))
RUN_QUEUE_SEMAPHORE = BoundedSemaphore(RUN_QUEUE_LIMIT)
RUN_MEMORY_LIMIT = 500
RUN_MEMORY_TTL_SECONDS = 6 * 60 * 60
TERMINAL_RUN_STATUSES = {"canceled", "failed", "succeeded"}


@dataclass(frozen=True)
class _RunOwnerContext:
    user_id: str
    workspace_id: str
    workspace_kind: str


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
    if not RUN_QUEUE_SEMAPHORE.acquire(blocking=False):
        raise HTTPException(status_code=429, detail="AI run queue is full. Try again shortly.")
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
    if not _has_run_persistence():
        RUN_REQUESTS[run.run_id] = _cached_run_request(payload)
    RUN_CONTEXTS[run.run_id] = _cached_run_owner_context(context)
    _prune_run_memory()
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
    _prune_run_memory()
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
    if _has_run_persistence():
        _forget_run(run_id)
    _prune_run_memory()
    return canceled


def cancel_ai_run(run_id: str, context: ApiRequestContext) -> AiRunRecord:
    return cancel_mock_run(run_id, context)


def _should_charge_mock_ai_run() -> bool:
    return os.getenv("TANGENT_AI_MOCK_LEDGER_CHARGING") == "1"


def _schedule_run_execution(run: AiRunRecord, payload: AiRunRequest, context: ApiRequestContext) -> None:
    future = RUN_EXECUTOR.submit(_execute_scheduled_run, run.run_id, payload, context)
    future.add_done_callback(lambda _future: RUN_QUEUE_SEMAPHORE.release())


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
            if _has_run_persistence():
                _forget_run(run_id)
            else:
                RUNS[run_id] = canceled
            _prune_run_memory()
            return
        persist_ai_run_record(finalization.run, payload, context)
        if _has_run_persistence():
            _forget_run(run_id)
        else:
            RUNS[run_id] = finalization.run
        _prune_run_memory()
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
        persist_ai_run_record(failed_run, failed_payload, failed_context)
        if _has_run_persistence():
            _forget_run(run_id)
        else:
            RUNS[run_id] = failed_run
        _prune_run_memory()


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
        return _build_run_context_from_owner(remembered, fallback_context)
    owner_context = load_ai_run_owner_context(run_id)
    if owner_context is None:
        return fallback_context
    recovered_owner = _RunOwnerContext(
        user_id=owner_context["created_by"],
        workspace_id=owner_context["workspace_id"],
        workspace_kind=owner_context["workspace_kind"],
    )
    RUN_CONTEXTS[run_id] = recovered_owner
    _prune_run_memory()
    return _build_run_context_from_owner(recovered_owner, fallback_context)


def _build_run_context_from_owner(
    owner: _RunOwnerContext,
    fallback_context: ApiRequestContext,
) -> ApiRequestContext:
    return ApiRequestContext(
        auth_mode=fallback_context.auth_mode,
        is_dev_fallback=fallback_context.is_dev_fallback,
        user_avatar_initials=fallback_context.user_avatar_initials,
        user_display_name=fallback_context.user_display_name,
        user_email=fallback_context.user_email,
        user_email_verified=fallback_context.user_email_verified,
        user_id=owner.user_id,
        workspace_board_count=fallback_context.workspace_board_count,
        workspace_id=owner.workspace_id,
        workspace_kind=owner.workspace_kind,
        workspace_name=fallback_context.workspace_name,
        workspace_plan_key=fallback_context.workspace_plan_key,
        workspace_role=fallback_context.workspace_role,
    )


def _cached_run_request(payload: AiRunRequest) -> AiRunRequest:
    return payload.model_copy(
        update={
            "prompt": payload.prompt[:240] if payload.prompt else payload.prompt,
            "system_prompt": None,
        }
    )


def _cached_run_owner_context(context: ApiRequestContext) -> _RunOwnerContext:
    return _RunOwnerContext(
        user_id=context.user_id,
        workspace_id=context.workspace_id,
        workspace_kind=context.workspace_kind,
    )


def _has_run_persistence() -> bool:
    return bool(os.getenv("DATABASE_URL"))


def _prune_run_memory() -> None:
    cutoff = datetime.now(timezone.utc).timestamp() - RUN_MEMORY_TTL_SECONDS
    for run_id, run in list(RUNS.items()):
        created_at = _run_created_timestamp(run)
        if run.status in TERMINAL_RUN_STATUSES and created_at < cutoff:
            _forget_run(run_id)

    if len(RUNS) <= RUN_MEMORY_LIMIT:
        return

    oldest_terminal = [
        (run_id, _run_created_timestamp(run))
        for run_id, run in RUNS.items()
        if run.status in TERMINAL_RUN_STATUSES
    ]
    for run_id, _created_at in sorted(oldest_terminal, key=lambda item: item[1]):
        if len(RUNS) <= RUN_MEMORY_LIMIT:
            return
        _forget_run(run_id)

    for run_id, _created_at in sorted(
        ((run_id, _run_created_timestamp(run)) for run_id, run in RUNS.items()),
        key=lambda item: item[1],
    ):
        if len(RUNS) <= RUN_MEMORY_LIMIT:
            return
        _forget_run(run_id)


def _forget_run(run_id: str) -> None:
    RUNS.pop(run_id, None)
    RUN_REQUESTS.pop(run_id, None)
    RUN_CONTEXTS.pop(run_id, None)


def _run_created_timestamp(run: AiRunRecord) -> float:
    try:
        parsed = datetime.fromisoformat(run.created_at.replace("Z", "+00:00"))
    except ValueError:
        return 0
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()
