import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from time import sleep
from typing import Callable, Optional

from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest


@dataclass(frozen=True)
class AiProviderAttemptResult:
    created_at: str
    error_code: Optional[str]
    error_message: Optional[str]
    latency_ms: int
    output_asset_ids: list[str]
    provider: str
    provider_cost: Optional[float]
    retryable: bool
    route_id: Optional[str]
    route_key: Optional[str]
    status: str
    text_output: Optional[str]
    work_started: bool


ProviderAdapter = Callable[[AiRunRecord, AiRunRequest, AiProviderRouteCandidate], AiProviderAttemptResult]


def execute_ai_provider_attempt(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
) -> AiProviderAttemptResult:
    adapter = _PROVIDER_ADAPTERS.get(route.provider_key, _run_stub_provider_adapter)
    return adapter(run, payload, route)


def _run_stub_provider_adapter(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
) -> AiProviderAttemptResult:
    if _should_fail_route(route):
        return AiProviderAttemptResult(
            created_at=_timestamp(),
            error_code="preflight_route_failure",
            error_message="Simulated preflight route failure.",
            latency_ms=0,
            output_asset_ids=[],
            provider=route.provider_key,
            provider_cost=None,
            retryable=True,
            route_id=route.route_id,
            route_key=route.route_key,
            status="failed",
            text_output=None,
            work_started=False,
        )
    latency_ms = _resolve_route_latency_ms(route, payload)
    if latency_ms > 0:
        sleep(latency_ms / 1000)
    if _should_fail_route_after_work(route):
        return AiProviderAttemptResult(
            created_at=_timestamp(),
            error_code="provider_execution_failed",
            error_message="Simulated provider execution failure after work started.",
            latency_ms=latency_ms,
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
    prompt = (payload.prompt or "Untitled prompt").strip() or "Untitled prompt"
    if payload.run_type == "image_analysis":
        return AiProviderAttemptResult(
            created_at=_timestamp(),
            error_code=None,
            error_message=None,
            latency_ms=latency_ms,
            output_asset_ids=[],
            provider=route.provider_key,
            provider_cost=None,
            retryable=False,
            route_id=route.route_id,
            route_key=route.route_key,
            status="succeeded",
            text_output=_mock_analysis_text(prompt, payload.input_asset_ids),
            work_started=True,
        )
    output_asset_ids = [
        f"asset_mock_{run.run_id}_{index + 1}_{_slugify(prompt)}_refs{len(payload.input_asset_ids)}"
        for index in range(_clamp_count(payload.params.get("count", 1)))
    ]
    return AiProviderAttemptResult(
        created_at=_timestamp(),
        error_code=None,
        error_message=None,
        latency_ms=latency_ms,
        output_asset_ids=output_asset_ids,
        provider=route.provider_key,
        provider_cost=None,
        retryable=False,
        route_id=route.route_id,
        route_key=route.route_key,
        status="succeeded",
        text_output=None,
        work_started=True,
    )


def _should_fail_route(route: AiProviderRouteCandidate) -> bool:
    configured = {
        token.strip()
        for token in os.getenv("TANGENT_AI_STUB_FAIL_ROUTE_KEYS", "").split(",")
        if token.strip()
    }
    return bool(configured.intersection({route.route_id, route.route_key}))


def _should_fail_route_after_work(route: AiProviderRouteCandidate) -> bool:
    configured = {
        token.strip()
        for token in os.getenv("TANGENT_AI_STUB_EXECUTION_FAIL_ROUTE_KEYS", "").split(",")
        if token.strip()
    }
    return bool(configured.intersection({route.route_id, route.route_key}))


def _resolve_route_latency_ms(route: AiProviderRouteCandidate, payload: AiRunRequest) -> int:
    override = _resolve_route_latency_override(route)
    if override is not None:
        return override
    if payload.run_type == "image_analysis":
        return 180
    return 450


def _resolve_route_latency_override(route: AiProviderRouteCandidate) -> Optional[int]:
    raw = os.getenv("TANGENT_AI_STUB_ROUTE_LATENCY_MS", "").strip()
    if not raw:
        return None
    for pair in raw.split(","):
        key, _, value = pair.partition("=")
        route_key = key.strip()
        if route_key not in {route.route_id, route.route_key}:
            continue
        try:
            return max(0, int(value.strip()))
        except ValueError:
            return None
    return None


def _clamp_count(value: object) -> int:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return 1
    return max(1, min(4, numeric))


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:24] or "prompt"


def _mock_analysis_text(prompt: str, input_asset_ids: list[str]) -> str:
    asset_list = ", ".join(input_asset_ids) or "none"
    return f"Mock analysis: read {len(input_asset_ids)} image(s). Reverse prompt: {prompt}. Source assets: {asset_list}"


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


_PROVIDER_ADAPTERS: dict[str, ProviderAdapter] = {
    "geekai": _run_stub_provider_adapter,
    "google": _run_stub_provider_adapter,
    "openai": _run_stub_provider_adapter,
}
