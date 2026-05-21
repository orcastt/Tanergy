from datetime import datetime, timezone
from typing import Optional

import httpx

from tangent_api.ai_provider_assets import persist_provider_output_assets
from tangent_api.ai_provider_jiekou_image_requests import run_jiekou_image_attempt
from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext


def run_jiekou_attempt(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
    *,
    api_key: Optional[str],
    base_url: Optional[str],
) -> AiProviderAttemptResult:
    _ = run
    if not api_key or not base_url:
        return _failure(route, "provider_not_configured", "Jiekou route is missing API credentials.", retryable=False)
    if payload.run_type not in {"image_generation", "image_edit"}:
        return _failure(
            route,
            "provider_capability_not_implemented",
            f"Live provider execution is not implemented for {payload.run_type} on {route.provider_key}.",
            retryable=False,
        )

    started_at = datetime.now(timezone.utc)
    timeout_seconds = max(1.0, route.timeout_ms / 1000)
    try:
        with httpx.Client(timeout=timeout_seconds) as client:
            outputs = run_jiekou_image_attempt(client, api_key, base_url, payload, route.provider_model, context, timeout_seconds)
    except httpx.HTTPStatusError as exc:
        return _http_failure(route, exc, started_at)
    except httpx.HTTPError as exc:
        return _failure(
            route,
            "provider_transport_error",
            str(exc),
            retryable=False,
            started_at=started_at,
            work_started=True,
        )
    except ValueError as exc:
        return _failure(
            route,
            "provider_response_invalid",
            str(exc),
            retryable=False,
            started_at=started_at,
            work_started=True,
        )

    if not outputs:
        return _failure(
            route,
            "provider_empty_response",
            "Jiekou route returned no image outputs.",
            retryable=False,
            started_at=started_at,
            work_started=True,
        )

    asset_ids = persist_provider_output_assets(outputs, context, payload, route.provider_key)
    return AiProviderAttemptResult(
        created_at=_timestamp(),
        error_code=None,
        error_message=None,
        latency_ms=_latency_ms(started_at),
        output_asset_ids=asset_ids,
        provider=route.provider_key,
        provider_cost=None,
        provider_currency=None,
        retryable=False,
        route_id=route.route_id,
        route_key=route.route_key,
        status="succeeded",
        text_output=None,
        work_started=True,
    )


def _http_failure(route: AiProviderRouteCandidate, exc: httpx.HTTPStatusError, started_at: datetime) -> AiProviderAttemptResult:
    status_code = exc.response.status_code
    message = exc.response.text[:400] if exc.response.text else f"Provider returned HTTP {status_code}."
    return _failure(
        route,
        f"provider_http_{status_code}",
        message,
        retryable=status_code >= 500 or status_code == 429,
        started_at=started_at,
        work_started=True,
    )


def _failure(
    route: AiProviderRouteCandidate,
    error_code: str,
    error_message: str,
    *,
    retryable: bool,
    started_at: Optional[datetime] = None,
    work_started: bool = False,
) -> AiProviderAttemptResult:
    return AiProviderAttemptResult(
        created_at=_timestamp(),
        error_code=error_code,
        error_message=error_message,
        latency_ms=_latency_ms(started_at),
        output_asset_ids=[],
        provider=route.provider_key,
        provider_cost=None,
        provider_currency=None,
        retryable=retryable,
        route_id=route.route_id,
        route_key=route.route_key,
        status="failed",
        text_output=None,
        work_started=work_started,
    )


def _latency_ms(started_at: Optional[datetime]) -> int:
    if started_at is None:
        return 0
    return int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
