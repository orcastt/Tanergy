from typing import Callable, Optional

from tangent_api.ai_provider_google import run_google_attempt
from tangent_api.ai_provider_geekai import run_geekai_attempt
from tangent_api.ai_provider_jiekou import run_jiekou_attempt
from tangent_api.ai_provider_openai_compatible import run_openai_compatible_attempt
from tangent_api.ai_provider_runtime_config import (
    provider_api_key,
    provider_base_url,
    should_allow_stub_provider_adapter,
    should_use_live_provider,
)
from tangent_api.ai_provider_stub_adapter import run_stub_provider_adapter, stub_provider_disabled_result
from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext

ProviderAdapter = Callable[
    [AiRunRecord, AiRunRequest, AiProviderRouteCandidate, ApiRequestContext],
    AiProviderAttemptResult,
]

def execute_ai_provider_attempt(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
) -> AiProviderAttemptResult:
    if should_use_live_provider(route.provider_key, route.provider_model, payload.run_type):
        adapter = _LIVE_PROVIDER_ADAPTERS.get(route.provider_key)
        if adapter is not None:
            return adapter(run, payload, route, context)
    if not should_allow_stub_provider_adapter():
        return stub_provider_disabled_result(route)
    return run_stub_provider_adapter(run, payload, route, context)


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
        api_key=provider_api_key(route.provider_key, route.provider_model, payload.run_type),
        base_url=provider_base_url(route.provider_key, route.provider_model, payload.run_type),
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
        api_key=provider_api_key(route.provider_key, route.provider_model, payload.run_type),
        base_url=provider_base_url(route.provider_key, route.provider_model, payload.run_type),
    )


def _run_live_geekai(
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
            api_key=provider_api_key(route.provider_key, route.provider_model, payload.run_type),
            base_url=provider_base_url(route.provider_key, route.provider_model, payload.run_type),
        )
    return run_geekai_attempt(
        run,
        payload,
        route,
        context,
        api_key=provider_api_key(route.provider_key, route.provider_model, payload.run_type),
        base_url=provider_base_url(route.provider_key, route.provider_model, payload.run_type),
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
            api_key=provider_api_key(route.provider_key, route.provider_model, payload.run_type),
            base_url=provider_base_url(route.provider_key, route.provider_model, payload.run_type),
        )
    return run_jiekou_attempt(
        run,
        payload,
        route,
        context,
        api_key=provider_api_key(route.provider_key, route.provider_model, payload.run_type),
        base_url=provider_base_url(route.provider_key, route.provider_model, payload.run_type),
    )


_LIVE_PROVIDER_ADAPTERS: dict[str, ProviderAdapter] = {
    "geekai": _run_live_geekai,
    "google": _run_live_google,
    "jiekou": _run_live_jiekou,
    "openai": _run_live_openai_compatible,
}
