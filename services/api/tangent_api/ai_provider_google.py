import base64
from datetime import datetime, timezone
from typing import Optional

import httpx

from tangent_api.ai_provider_assets import (
    ProviderImageOutput,
    decode_b64_image,
    load_provider_input_assets,
    persist_provider_output_assets,
)
from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.request_context import ApiRequestContext

MAX_PROVIDER_JSON_BYTES = 8 * 1024 * 1024


def run_google_attempt(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
    *,
    api_key: Optional[str],
    base_url: Optional[str],
) -> AiProviderAttemptResult:
    if not api_key or not base_url:
        return _failure(route, "provider_not_configured", "Google route is missing API credentials.", retryable=True)

    started_at = datetime.now(timezone.utc)
    body = _request_body(payload, context)
    if body is None:
        return _failure(
            route,
            "provider_capability_not_implemented",
            f"Live provider execution is not implemented for {payload.run_type} on {route.provider_key}.",
            retryable=True,
        )

    timeout_seconds = max(1.0, route.timeout_ms / 1000)
    try:
        with httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout_seconds) as client:
            response = client.post(
                f"/models/{route.provider_model}:generateContent",
                params={"key": api_key},
                json=body,
            )
            response.raise_for_status()
            payload_body = _parse_provider_json(response)
    except httpx.HTTPStatusError as exc:
        return _http_failure(route, exc, started_at)
    except httpx.HTTPError as exc:
        return _failure(route, "provider_transport_error", str(exc), retryable=True, started_at=started_at, work_started=False)
    except ValueError as exc:
        return _failure(route, "provider_response_invalid", str(exc), retryable=True, started_at=started_at, work_started=True)

    text_output, image_outputs = _parse_google_response(payload_body)
    asset_ids = persist_provider_output_assets(image_outputs, context, payload, route.provider_key)
    if not asset_ids and not text_output:
        return _failure(route, "provider_empty_response", "Google route returned no usable content.", retryable=True, started_at=started_at, work_started=True)
    return AiProviderAttemptResult(
        created_at=_timestamp(),
        error_code=None,
        error_message=None,
        latency_ms=_latency_ms(started_at),
        output_asset_ids=asset_ids,
        provider=route.provider_key,
        provider_cost=_response_cost(payload_body),
        provider_currency=_response_currency(payload_body),
        retryable=False,
        route_id=route.route_id,
        route_key=route.route_key,
        status="succeeded",
        text_output=text_output,
        work_started=True,
    )


def _request_body(payload: AiRunRequest, context: ApiRequestContext) -> Optional[dict[str, object]]:
    if payload.run_type not in {"image_generation", "image_edit", "image_analysis"}:
        return None
    parts: list[dict[str, object]] = []
    prompt = (payload.prompt or "Untitled prompt").strip() or "Untitled prompt"
    parts.append({"text": prompt})
    for asset in load_provider_input_assets(payload, context):
        parts.append(
            {
                "inlineData": {
                    "data": base64.b64encode(asset.content).decode("ascii"),
                    "mimeType": asset.mime,
                }
            }
        )
    response_modalities = ["TEXT"]
    if payload.run_type in {"image_generation", "image_edit"}:
        response_modalities = ["TEXT", "IMAGE"]
    return {
        "contents": [{"parts": parts, "role": "user"}],
        "generationConfig": {"responseModalities": response_modalities},
    }


def _parse_google_response(body: dict[str, object]) -> tuple[Optional[str], list[ProviderImageOutput]]:
    texts: list[str] = []
    images: list[ProviderImageOutput] = []
    for candidate in body.get("candidates") or []:
        content = candidate.get("content") if isinstance(candidate, dict) else None
        parts = content.get("parts") if isinstance(content, dict) else None
        if not isinstance(parts, list):
            continue
        for part in parts:
            if not isinstance(part, dict):
                continue
            text = part.get("text")
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())
            inline_data = part.get("inlineData")
            if not isinstance(inline_data, dict):
                continue
            data = inline_data.get("data")
            mime = inline_data.get("mimeType")
            if isinstance(data, str) and data:
                images.append(
                    decode_b64_image(data, mime=str(mime or "image/png"))
                )
    text_output = "\n\n".join(texts) if texts else None
    return text_output, images


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


def _parse_provider_json(response: httpx.Response) -> dict[str, object]:
    content_length = response.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_PROVIDER_JSON_BYTES:
                raise ValueError("Provider response exceeded the JSON size limit.")
        except ValueError as exc:
            raise ValueError("Provider response exceeded the JSON size limit.") from exc
    if len(response.content) > MAX_PROVIDER_JSON_BYTES:
        raise ValueError("Provider response exceeded the JSON size limit.")
    body = response.json()
    if not isinstance(body, dict):
        raise ValueError("Provider response was not a JSON object.")
    return body


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
    usage = body.get("usageMetadata")
    if not isinstance(usage, dict):
        return None
    cost = usage.get("estimatedCost")
    try:
        return float(cost)
    except (TypeError, ValueError):
        return None


def _response_currency(body: dict[str, object]) -> Optional[str]:
    usage = body.get("usageMetadata")
    if not isinstance(usage, dict):
        return None
    currency = usage.get("currency")
    return str(currency) if currency else None


def _latency_ms(started_at: Optional[datetime]) -> int:
    if started_at is None:
        return 0
    return int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
