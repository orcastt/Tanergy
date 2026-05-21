from dataclasses import dataclass
import os
from datetime import datetime, timezone
from typing import Optional

from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext


@dataclass(frozen=True)
class RunOwnerContext:
    user_id: str
    workspace_id: str
    workspace_kind: str


def should_charge_mock_ai_run() -> bool:
    return os.getenv("TANGENT_AI_MOCK_LEDGER_CHARGING") == "1"


def execution_start_delay_ms() -> int:
    raw = os.getenv("TANGENT_AI_EXECUTION_START_DELAY_MS", "").strip()
    if not raw:
        return 0
    try:
        return max(0, int(raw))
    except ValueError:
        return 0


def build_run_context_from_owner(owner: RunOwnerContext, fallback_context: ApiRequestContext) -> ApiRequestContext:
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


def cached_run_request(payload: AiRunRequest) -> AiRunRequest:
    return payload.model_copy(update={"prompt": payload.prompt[:240] if payload.prompt else payload.prompt, "system_prompt": None})


def cached_run_owner_context(context: ApiRequestContext) -> RunOwnerContext:
    return RunOwnerContext(
        user_id=context.user_id,
        workspace_id=context.workspace_id,
        workspace_kind=context.workspace_kind,
    )


def has_run_persistence() -> bool:
    return bool(os.getenv("DATABASE_URL"))


def prune_run_memory(
    *,
    run_contexts: dict[str, RunOwnerContext],
    run_memory_limit: int,
    run_memory_ttl_seconds: int,
    run_requests: dict[str, AiRunRequest],
    runs: dict[str, AiRunRecord],
    terminal_run_statuses: set[str],
) -> None:
    cutoff = datetime.now(timezone.utc).timestamp() - run_memory_ttl_seconds
    for run_id, run in list(runs.items()):
        if run.status in terminal_run_statuses and run_created_timestamp(run) < cutoff:
            forget_run(run_contexts=run_contexts, run_id=run_id, run_requests=run_requests, runs=runs)
    if len(runs) <= run_memory_limit:
        return
    oldest_terminal = [(run_id, run_created_timestamp(run)) for run_id, run in runs.items() if run.status in terminal_run_statuses]
    for run_id, _created_at in sorted(oldest_terminal, key=lambda item: item[1]):
        if len(runs) <= run_memory_limit:
            return
        forget_run(run_contexts=run_contexts, run_id=run_id, run_requests=run_requests, runs=runs)
    for run_id, _created_at in sorted(((run_id, run_created_timestamp(run)) for run_id, run in runs.items()), key=lambda item: item[1]):
        if len(runs) <= run_memory_limit:
            return
        forget_run(run_contexts=run_contexts, run_id=run_id, run_requests=run_requests, runs=runs)


def forget_run(
    *,
    run_contexts: dict[str, RunOwnerContext],
    run_id: str,
    run_requests: dict[str, AiRunRequest],
    runs: dict[str, AiRunRecord],
) -> None:
    runs.pop(run_id, None)
    run_requests.pop(run_id, None)
    run_contexts.pop(run_id, None)


def run_created_timestamp(run: AiRunRecord) -> float:
    try:
        parsed = datetime.fromisoformat(run.created_at.replace("Z", "+00:00"))
    except ValueError:
        return 0
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed.timestamp()
