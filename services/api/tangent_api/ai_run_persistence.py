from typing import Optional

from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_run_persistence_store import (
    load_ai_run_owner_context as _load_ai_run_owner_context_impl,
    load_ai_run_snapshot as _load_ai_run_snapshot_impl,
    persist_ai_api_call_attempts as _persist_ai_api_call_attempts_impl,
    persist_ai_run_record as _persist_ai_run_record_impl,
)
from tangent_api.ai_run_persistence_support import (
    build_ai_run_record_from_snapshot,
    build_ai_run_request_from_snapshot,
)
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres


def persist_ai_run_record(run: AiRunRecord, payload: AiRunRequest, context: ApiRequestContext) -> None:
    _persist_ai_run_record_impl(
        connect_db=connect_to_postgres,
        context=context,
        payload=payload,
        run=run,
    )


def persist_ai_api_call_attempts(
    run: AiRunRecord,
    context: ApiRequestContext,
    attempts: list[AiProviderAttemptResult],
) -> None:
    _persist_ai_api_call_attempts_impl(
        attempts=attempts,
        connect_db=connect_to_postgres,
        context=context,
        run=run,
    )


def load_ai_run_record(run_id: str) -> Optional[AiRunRecord]:
    snapshot = load_ai_run_snapshot(run_id)
    if snapshot is None:
        return None
    return build_ai_run_record_from_snapshot(snapshot)


def load_ai_run_request(run_id: str) -> Optional[AiRunRequest]:
    snapshot = load_ai_run_snapshot(run_id)
    if snapshot is None:
        return None
    return build_ai_run_request_from_snapshot(snapshot)


def load_ai_run_owner_context(run_id: str) -> Optional[dict[str, str]]:
    return _load_ai_run_owner_context_impl(connect_db=connect_to_postgres, run_id=run_id)


def load_ai_run_snapshot(run_id: str) -> Optional[dict[str, object]]:
    return _load_ai_run_snapshot_impl(connect_db=connect_to_postgres, run_id=run_id)
