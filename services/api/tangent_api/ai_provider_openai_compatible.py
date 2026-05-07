from datetime import datetime, timezone
from typing import Optional

import httpx

from tangent_api.ai_provider_assets import (
    decode_b64_image,
    download_provider_image,
    load_provider_input_assets,
    persist_provider_output_assets,
    resolve_requested_dimensions,
)
from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.request_context import ApiRequestContext


def run_openai_compatible_attempt(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
    *,
    api_key: Optional[str],
    base_url: Optional[str],
) -> AiProviderAttemptResult:
    if not api_key or not base_url:
        return _failure(route, "provider_not_configured", "OpenAI-compatible route is missing API credentials.", retryable=True)
    if payload.run_type not in {"image_generation", "image_edit"}:
        return _failure(
            route,
            "provider_capability_not_implemented",
            f"Live provider execution is not implemented for {payload.run_type} on {route.provider_key}.",
            retryable=True,
        )

    started_at = datetime.now(timezone.utc)
    timeout_seconds = max(1.0, route.timeout_ms / 1000)
    try:
        with httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout_seconds) as client:
            if payload.run_type == "image_edit" and payload.input_asset_ids:
                response = _post_image_edit(client, api_key, payload, route, context)
            else:
                response = _post_image_generation(client, api_key, payload, route)
            response.raise_for_status()
            body = response.json()
    except httpx.HTTPStatusError as exc:
        return _http_failure(route, exc, started_at)
    except httpx.HTTPError as exc:
        return _failure(route, "provider_transport_error", str(exc), retryable=True, started_at=started_at, work_started=False)

    outputs = []
    for item in body.get("data") or []:
        if item.get("b64_json"):
            outputs.append(decode_b64_image(item["b64_json"]))
            continue
        url = item.get("url")
        if isinstance(url, str) and url:
            outputs.append(download_provider_image(url, timeout_seconds, headers={"Authorization": f"Bearer {api_key}"}))
    if not outputs:
        return _failure(
            route,
            "provider_empty_response",
            "OpenAI-compatible route returned no image outputs.",
            retryable=True,
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
        provider_cost=_response_cost(body),
        provider_currency=_response_currency(body),
        retryable=False,
        route_id=route.route_id,
        route_key=route.route_key,
        status="succeeded",
        text_output=None,
        work_started=True,
    )


def _post_image_generation(
    client: httpx.Client,
    api_key: str,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
) -> httpx.Response:
    request_json = {
        "model": route.provider_model,
        "n": _count(payload),
        "prompt": (payload.prompt or "Untitled prompt").strip() or "Untitled prompt",
        "response_format": "b64_json",
        **_image_request_fields(payload, route),
    }
    return client.post(
        "/images/generations",
        headers={"Authorization": f"Bearer {api_key}"},
        json=request_json,
    )


def _post_image_edit(
    client: httpx.Client,
    api_key: str,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
) -> httpx.Response:
    files = [
        ("image", (asset.file_name, asset.content, asset.mime))
        for asset in load_provider_input_assets(payload, context)
    ]
    data = {
        "model": route.provider_model,
        "n": str(_count(payload)),
        "prompt": (payload.prompt or "Untitled prompt").strip() or "Untitled prompt",
        "response_format": "b64_json",
        **_image_request_fields(payload, route),
    }
    return client.post(
        "/images/edits",
        headers={"Authorization": f"Bearer {api_key}"},
        data=data,
        files=files,
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
        work_started=status_code < 500,
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


def _response_cost(body: dict[str, object]) -> Optional[float]:
    usage = body.get("usage")
    if not isinstance(usage, dict):
        return None
    cost = usage.get("cost") or usage.get("total_cost")
    try:
        return float(cost)
    except (TypeError, ValueError):
        return None


def _response_currency(body: dict[str, object]) -> Optional[str]:
    usage = body.get("usage")
    if not isinstance(usage, dict):
        return None
    currency = usage.get("currency")
    return str(currency) if currency else None


def _count(payload: AiRunRequest) -> int:
    try:
        return max(1, min(4, int(payload.params.get("count", 1))))
    except (TypeError, ValueError):
        return 1


def _image_request_fields(payload: AiRunRequest, route: AiProviderRouteCandidate) -> dict[str, str]:
    if route.provider_key == "openai":
        return {
            "quality": _openai_quality_for_payload(payload),
            "size": _openai_size_for_payload(payload),
        }
    width, height = resolve_requested_dimensions(payload)
    return {"size": f"{width}x{height}"}


def _openai_quality_for_payload(payload: AiRunRequest) -> str:
    resolution = str(payload.params.get("resolution") or "").strip().lower()
    if resolution in {"0.5k", "0_5k"}:
        return "low"
    if resolution in {"2k", "4k"}:
        return "high"
    return "medium"


def _openai_size_for_payload(payload: AiRunRequest) -> str:
    aspect_ratio = str(payload.params.get("aspectRatio") or "1:1").strip()
    if aspect_ratio in {"16:9", "4:3", "3:2"}:
        return "1536x1024"
    if aspect_ratio == "9:16":
        return "1024x1536"
    return "1024x1024"


def _latency_ms(started_at: Optional[datetime]) -> int:
    if started_at is None:
        return 0
    return int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
