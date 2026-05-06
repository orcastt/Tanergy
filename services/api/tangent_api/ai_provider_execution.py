from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional

from tangent_api.ai_provider_adapters import AiProviderAttemptResult, execute_ai_provider_attempt
from tangent_api.ai_route_catalog import AiProviderRouteCandidate, list_route_candidates
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest


@dataclass(frozen=True)
class AiProviderExecutionOutcome:
    attempts: list[AiProviderAttemptResult]
    error_message: Optional[str]
    latency_ms: int
    output_asset_ids: list[str]
    provider: str
    provider_cost: Optional[float]
    route_id: Optional[str]
    route_key: Optional[str]
    status: str
    text_output: Optional[str]


PROVIDER_ATTEMPT_EXECUTOR = ThreadPoolExecutor(max_workers=8, thread_name_prefix="tangent-provider")


def run_ai_provider_execution(run: AiRunRecord, payload: AiRunRequest) -> AiProviderExecutionOutcome:
    route_candidates = list_route_candidates(run.model_id)
    if not route_candidates:
        return AiProviderExecutionOutcome(
            attempts=[],
            error_message=f"No enabled provider route is available for model {run.model_id}.",
            latency_ms=0,
            output_asset_ids=[],
            provider=run.provider,
            provider_cost=None,
            route_id=run.route_id,
            route_key=run.route_key,
            status="failed",
            text_output=None,
        )

    attempts: list[AiProviderAttemptResult] = []
    for route in route_candidates:
        max_attempts = _route_max_attempts(route.retry_policy)
        for _ in range(max_attempts):
            attempt = _execute_route_attempt(run, payload, route)
            attempts.append(attempt)
            if attempt.status == "succeeded":
                return _succeeded_execution_outcome(attempts, attempt)
            if not attempt.retryable:
                return _non_retryable_failure_outcome(run, attempts, attempt)
    return _exhausted_retryable_failures_outcome(run, attempts)


def _execute_route_attempt(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
) -> AiProviderAttemptResult:
    future = PROVIDER_ATTEMPT_EXECUTOR.submit(execute_ai_provider_attempt, run, payload, route)
    timeout_seconds = max(0.001, route.timeout_ms / 1000)
    try:
        return future.result(timeout=timeout_seconds)
    except TimeoutError:
        future.cancel()
        return AiProviderAttemptResult(
            created_at=_now_iso(),
            error_code="provider_timeout",
            error_message=f"Provider route timed out after {route.timeout_ms} ms.",
            latency_ms=route.timeout_ms,
            output_asset_ids=[],
            provider=route.provider_key,
            provider_cost=None,
            retryable=False,
            route_id=route.route_id,
            route_key=route.route_key,
            status="failed",
            text_output=None,
            work_started=True,
        )
    except Exception as exc:
        return AiProviderAttemptResult(
            created_at=_now_iso(),
            error_code="provider_adapter_exception",
            error_message=str(exc),
            latency_ms=0,
            output_asset_ids=[],
            provider=route.provider_key,
            provider_cost=None,
            retryable=False,
            route_id=route.route_id,
            route_key=route.route_key,
            status="failed",
            text_output=None,
            work_started=False,
        )


def _succeeded_execution_outcome(
    attempts: list[AiProviderAttemptResult],
    attempt: AiProviderAttemptResult,
) -> AiProviderExecutionOutcome:
    return AiProviderExecutionOutcome(
        attempts=attempts,
        error_message=None,
        latency_ms=attempt.latency_ms,
        output_asset_ids=attempt.output_asset_ids,
        provider=attempt.provider,
        provider_cost=attempt.provider_cost,
        route_id=attempt.route_id,
        route_key=attempt.route_key,
        status="succeeded",
        text_output=attempt.text_output,
    )


def _non_retryable_failure_outcome(
    run: AiRunRecord,
    attempts: list[AiProviderAttemptResult],
    attempt: AiProviderAttemptResult,
) -> AiProviderExecutionOutcome:
    failure_reason = attempt.error_message or attempt.error_code or "Provider route failed."
    if attempt.error_code == "provider_timeout":
        failure_reason = f"{failure_reason} Automatic failover stopped because provider work may already have started."
    elif attempt.work_started:
        failure_reason = f"{failure_reason} Automatic failover stopped because work already started on the provider."
    return AiProviderExecutionOutcome(
        attempts=attempts,
        error_message=failure_reason,
        latency_ms=attempt.latency_ms,
        output_asset_ids=[],
        provider=attempt.provider or run.provider,
        provider_cost=attempt.provider_cost,
        route_id=attempt.route_id or run.route_id,
        route_key=attempt.route_key or run.route_key,
        status="failed",
        text_output=None,
    )


def _exhausted_retryable_failures_outcome(
    run: AiRunRecord,
    attempts: list[AiProviderAttemptResult],
) -> AiProviderExecutionOutcome:
    route_failures = [
        f"{attempt.route_key}: {attempt.error_message or attempt.error_code or 'provider route failed'}"
        for attempt in attempts
    ]
    return AiProviderExecutionOutcome(
        attempts=attempts,
        error_message="All provider routes failed before work started. " + "; ".join(route_failures),
        latency_ms=0,
        output_asset_ids=[],
        provider=run.provider,
        provider_cost=None,
        route_id=run.route_id,
        route_key=run.route_key,
        status="failed",
        text_output=None,
    )


def _route_max_attempts(retry_policy: dict[str, object]) -> int:
    raw = retry_policy.get("maxAttempts", 1)
    try:
        value = int(raw)
    except (TypeError, ValueError):
        return 1
    return max(1, min(3, value))


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()
