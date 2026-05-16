import os
import re
from datetime import datetime, timezone
from time import sleep
from typing import Callable, Optional

from tangent_api.ai_provider_google import run_google_attempt
from tangent_api.ai_provider_jiekou import run_jiekou_attempt
from tangent_api.ai_provider_openai_compatible import run_openai_compatible_attempt
from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext

ProviderAdapter = Callable[
    [AiRunRecord, AiRunRequest, AiProviderRouteCandidate, ApiRequestContext],
    AiProviderAttemptResult,
]

_DEFAULT_PROVIDER_BASE_URLS = {
    "google": "https://generativelanguage.googleapis.com/v1beta",
    "openai": "https://api.openai.com/v1",
}


def execute_ai_provider_attempt(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
) -> AiProviderAttemptResult:
    if _should_use_live_provider(route.provider_key, route.provider_model, payload.run_type):
        adapter = _LIVE_PROVIDER_ADAPTERS.get(route.provider_key)
        if adapter is not None:
            return adapter(run, payload, route, context)
    if not _should_allow_stub_provider_adapter():
        return _stub_provider_disabled_result(route)
    return _run_stub_provider_adapter(run, payload, route, context)


def _run_live_openai_compatible(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
) -> AiProviderAttemptResult:
    return run_openai_compatible_attempt(
        run,
        payload,
        route,
        context,
        api_key=_provider_api_key(route.provider_key, route.provider_model, payload.run_type),
        base_url=_provider_base_url(route.provider_key, route.provider_model, payload.run_type),
    )


def _run_live_google(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
) -> AiProviderAttemptResult:
    return run_google_attempt(
        run,
        payload,
        route,
        context,
        api_key=_provider_api_key(route.provider_key, route.provider_model, payload.run_type),
        base_url=_provider_base_url(route.provider_key, route.provider_model, payload.run_type),
    )


def _run_live_jiekou(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
) -> AiProviderAttemptResult:
    if payload.run_type in {"image_analysis", "text"}:
        return run_openai_compatible_attempt(
            run,
            payload,
            route,
            context,
            api_key=_provider_api_key(route.provider_key, route.provider_model, payload.run_type),
            base_url=_provider_base_url(route.provider_key, route.provider_model, payload.run_type),
        )
    return run_jiekou_attempt(
        run,
        payload,
        route,
        context,
        api_key=_provider_api_key(route.provider_key, route.provider_model, payload.run_type),
        base_url=_provider_base_url(route.provider_key, route.provider_model, payload.run_type),
    )


def _run_stub_provider_adapter(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
) -> AiProviderAttemptResult:
    _ = context
    if _should_fail_route(route):
        return AiProviderAttemptResult(
            created_at=_timestamp(),
            error_code="preflight_route_failure",
            error_message="Simulated preflight route failure.",
            latency_ms=0,
            output_asset_ids=[],
            provider=route.provider_key,
            provider_cost=None,
            provider_currency=None,
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
            provider_currency=None,
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
            provider_currency=None,
            retryable=False,
            route_id=route.route_id,
            route_key=route.route_key,
            status="succeeded",
            text_output=_mock_analysis_text(prompt, payload.input_asset_ids),
            work_started=True,
        )
    if payload.run_type == "text":
        return AiProviderAttemptResult(
            created_at=_timestamp(),
            error_code=None,
            error_message=None,
            latency_ms=latency_ms,
            output_asset_ids=[],
            provider=route.provider_key,
            provider_cost=None,
            provider_currency=None,
            retryable=False,
            route_id=route.route_id,
            route_key=route.route_key,
            status="succeeded",
            text_output=_mock_text_output(prompt, str(payload.system_prompt or "")),
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
        provider_currency=None,
        retryable=False,
        route_id=route.route_id,
        route_key=route.route_key,
        status="succeeded",
        text_output=None,
        work_started=True,
    )


def _should_use_live_provider(provider_key: str, provider_model: Optional[str] = None, run_type: Optional[str] = None) -> bool:
    normalized_key = provider_key.upper().replace("-", "_")
    provider_mode = os.getenv(f"TANGENT_AI_PROVIDER_{normalized_key}_MODE", "").strip().lower()
    global_mode = os.getenv(
        "TANGENT_AI_PROVIDER_EXECUTION_MODE",
        "",
    ).strip().lower()
    if provider_mode == "stub" or global_mode == "stub":
        return False
    if provider_mode == "live" or global_mode == "live":
        return True
    if _is_local_or_test_runtime():
        return False
    return bool(_provider_api_key(provider_key, provider_model, run_type) and _provider_base_url(provider_key, provider_model, run_type))


def _should_allow_stub_provider_adapter() -> bool:
    if os.getenv("TANGENT_AI_ALLOW_STUB_PROVIDER", "").strip() == "1":
        return True
    return _is_local_or_test_runtime()


def _is_local_or_test_runtime() -> bool:
    runtime_names = {"TANGENT_ENV", "ENVIRONMENT", "APP_ENV", "PYTHON_ENV"}
    runtime_values = {
        os.getenv(name, "").strip().lower()
        for name in runtime_names
        if os.getenv(name, "").strip()
    }
    if runtime_values.intersection({"prod", "production", "stage", "staging"}):
        return False
    if runtime_values.intersection({"dev", "development", "local", "test", "testing"}):
        return True
    return not runtime_values


def _stub_provider_disabled_result(route: AiProviderRouteCandidate) -> AiProviderAttemptResult:
    return AiProviderAttemptResult(
        created_at=_timestamp(),
        error_code="provider_stub_disabled",
        error_message="Stub AI provider execution is disabled in production. Configure live provider mode and credentials.",
        latency_ms=0,
        output_asset_ids=[],
        provider=route.provider_key,
        provider_cost=None,
        provider_currency=None,
        retryable=False,
        route_id=route.route_id,
        route_key=route.route_key,
        status="failed",
        text_output=None,
        work_started=False,
    )


def _provider_api_key(provider_key: str, provider_model: Optional[str] = None, run_type: Optional[str] = None) -> Optional[str]:
    scope_override = _provider_scope_value("API_KEY", provider_key, run_type)
    if scope_override:
        return scope_override
    normalized_key = provider_key.upper().replace("-", "_")
    return (
        os.getenv(f"TANGENT_AI_PROVIDER_{normalized_key}_API_KEY")
        or os.getenv(f"TANGENT_AI_PROVIDER_{normalized_key}_KEY")
        or os.getenv(f"{normalized_key}_API_KEY")
        or os.getenv(f"{normalized_key}_KEY")
        or os.getenv(_legacy_provider_api_key_env(provider_key))
    )


def _provider_base_url(provider_key: str, provider_model: Optional[str] = None, run_type: Optional[str] = None) -> Optional[str]:
    scope_override = _provider_scope_value("BASE_URL", provider_key, run_type)
    if scope_override:
        return scope_override
    normalized_key = provider_key.upper().replace("-", "_")
    return (
        os.getenv(f"TANGENT_AI_PROVIDER_{normalized_key}_BASE_URL")
        or os.getenv(_legacy_provider_base_url_env(provider_key))
        or _default_provider_base_url(provider_key, run_type)
    )


def _provider_scope_value(value_suffix: str, provider_key: str, run_type: Optional[str]) -> Optional[str]:
    scope = _provider_scope_for_run_type(run_type)
    if scope is None:
        return None
    normalized_provider = provider_key.upper().replace("-", "_")
    normalized_scope = scope.upper()
    candidates = [
        f"TANGENT_AI_PROVIDER_{normalized_provider}_{normalized_scope}_{value_suffix}",
        f"{normalized_provider}_{normalized_scope}_{value_suffix}",
    ]
    if value_suffix == "API_KEY":
        candidates.extend(
            [
                f"TANGENT_AI_PROVIDER_{normalized_provider}_{normalized_scope}_KEY",
                f"{normalized_provider}_{normalized_scope}_KEY",
            ]
        )
    for candidate in candidates:
        value = os.getenv(candidate)
        if value:
            return value
    return None


def _provider_scope_for_run_type(run_type: Optional[str]) -> Optional[str]:
    normalized = str(run_type or "").strip().lower()
    if normalized in {"image_generation", "image_edit"}:
        return "image"
    if normalized in {"image_analysis", "text"}:
        return "text"
    if normalized == "video":
        return "video"
    return None


def _legacy_provider_api_key_env(provider_key: str) -> str:
    if provider_key == "google":
        return "GOOGLE_API_KEY"
    if provider_key == "jiekou":
        return "JIEKOU_API_KEY"
    if provider_key == "openai":
        return "OPENAI_API_KEY"
    return f"{provider_key.upper()}_API_KEY"


def _legacy_provider_base_url_env(provider_key: str) -> str:
    if provider_key == "openai":
        return "OPENAI_BASE_URL"
    if provider_key == "google":
        return "GOOGLE_BASE_URL"
    if provider_key == "jiekou":
        return "JIEKOU_BASE_URL"
    return f"{provider_key.upper()}_BASE_URL"


def _default_provider_base_url(provider_key: str, run_type: Optional[str]) -> Optional[str]:
    if provider_key == "jiekou":
        scope = _provider_scope_for_run_type(run_type)
        if scope == "text":
            return "https://api.jiekou.ai/openai/v1"
        return "https://api.jiekou.ai/v3"
    return _DEFAULT_PROVIDER_BASE_URLS.get(provider_key)


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
    if payload.run_type == "text":
        return 220
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


def _mock_text_output(prompt: str, system_prompt: str) -> str:
    trimmed_prompt = prompt.strip() or "Untitled prompt"
    normalized_system_prompt = system_prompt.lower()
    if "prompt optimizer" in normalized_system_prompt or "image-generation prompt" in normalized_system_prompt:
        return (
            f"{trimmed_prompt}. Cinematic composition, realistic materials, precise subject focus, "
            "layered lighting, rich color contrast, and production-ready visual detail."
        )
    return f"Optimized text output: {trimmed_prompt}"


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()


_LIVE_PROVIDER_ADAPTERS: dict[str, ProviderAdapter] = {
    "google": _run_live_google,
    "jiekou": _run_live_jiekou,
    "openai": _run_live_openai_compatible,
}
