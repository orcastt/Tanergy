import base64
from datetime import datetime, timezone
from typing import Optional

import httpx

from tangent_api.ai_provider_chat_streaming import parse_chat_completion_response
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

MAX_PROVIDER_JSON_BYTES = 8 * 1024 * 1024
MAX_TEXT_INPUT_ASSET_BYTES = 20 * 1024 * 1024


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
    if payload.run_type not in {"image_analysis", "image_generation", "image_edit", "text"}:
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
            if payload.run_type in {"image_analysis", "text"}:
                response = _post_text_completion(client, api_key, payload, route, context)
            elif payload.run_type == "image_edit" and payload.input_asset_ids:
                response = _post_image_edit(client, api_key, payload, route, context)
            else:
                response = _post_image_generation(client, api_key, payload, route)
            response.raise_for_status()
            if payload.run_type in {"image_analysis", "text"}:
                body = _parse_text_completion_response(response)
            else:
                body = _parse_provider_json(response)
    except httpx.HTTPStatusError as exc:
        return _http_failure(route, exc, started_at)
    except httpx.HTTPError as exc:
        return _failure(route, "provider_transport_error", str(exc), retryable=True, started_at=started_at, work_started=False)
    except ValueError as exc:
        return _failure(route, "provider_response_invalid", str(exc), retryable=True, started_at=started_at, work_started=True)

    if payload.run_type in {"image_analysis", "text"}:
        text_output = _response_text_output(body)
        if not text_output:
            return _failure(
                route,
                "provider_empty_response",
                "OpenAI-compatible route returned no text output.",
                retryable=True,
                started_at=started_at,
                work_started=True,
            )
        return AiProviderAttemptResult(
            created_at=_timestamp(),
            error_code=None,
            error_message=None,
            latency_ms=_latency_ms(started_at),
            output_asset_ids=[],
            provider=route.provider_key,
            provider_cost=_response_cost(body),
            provider_currency=_response_currency(body),
            retryable=False,
            route_id=route.route_id,
            route_key=route.route_key,
            status="succeeded",
            text_output=text_output,
            work_started=True,
        )

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


def _post_text_completion(
    client: httpx.Client,
    api_key: str,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
) -> httpx.Response:
    request_json = {
        "model": route.provider_model,
        "messages": _text_messages(payload, context, route),
        "stream": True,
    }
    max_completion_tokens = _optional_positive_int(payload.params.get("maxCompletionTokens"))
    if max_completion_tokens is not None:
        request_json["max_completion_tokens"] = max_completion_tokens
    temperature = _optional_float(payload.params.get("temperature"))
    if temperature is not None:
        request_json["temperature"] = temperature
    return client.post(
        "/chat/completions",
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


def _parse_text_completion_response(response: httpx.Response) -> dict[str, object]:
    return parse_chat_completion_response(
        response.content,
        content_length=response.headers.get("content-length"),
        content_type=response.headers.get("content-type"),
        max_bytes=MAX_PROVIDER_JSON_BYTES,
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


def _response_text_output(body: dict[str, object]) -> Optional[str]:
    choices = body.get("choices")
    if not isinstance(choices, list):
        return None
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        message = choice.get("message")
        if not isinstance(message, dict):
            continue
        content = _content_text(message.get("content"))
        if content:
            return content
    return None


def _count(payload: AiRunRequest) -> int:
    try:
        return max(1, min(4, int(payload.params.get("count", 1))))
    except (TypeError, ValueError):
        return 1


def _text_messages(
    payload: AiRunRequest,
    context: ApiRequestContext,
    route: Optional[AiProviderRouteCandidate] = None,
) -> list[dict[str, object]]:
    messages = _normalized_text_messages(payload)
    if not messages:
        prompt = (payload.prompt or "Untitled prompt").strip() or "Untitled prompt"
        messages.append({"role": "user", "content": prompt})
    if payload.system_prompt and not any(message.get("role") == "system" for message in messages):
        messages.insert(0, {"role": "system", "content": payload.system_prompt.strip()})
    image_parts = _inline_text_input_asset_parts(payload, context)
    if image_parts:
        _append_image_parts_to_last_user_message(messages, image_parts)
    if _requires_user_assistant_turns(route):
        messages = _fold_system_messages_into_user_turns(messages)
    return messages


def _normalized_text_messages(payload: AiRunRequest) -> list[dict[str, object]]:
    raw_messages = payload.params.get("messages")
    if not isinstance(raw_messages, list):
        return []
    normalized: list[dict[str, object]] = []
    for item in raw_messages[:32]:
        if not isinstance(item, dict):
            continue
        role = item.get("role")
        if role not in {"assistant", "system", "user"}:
            continue
        content = _normalized_message_content(item.get("content"))
        if content is None:
            continue
        normalized.append({"role": role, "content": content})
    return normalized


def _normalized_message_content(content: object) -> Optional[object]:
    if isinstance(content, str):
        trimmed = content.strip()
        return trimmed[:4000] if trimmed else None
    if not isinstance(content, list):
        return None
    text_parts: list[dict[str, str]] = []
    for item in content[:32]:
        if not isinstance(item, dict):
            continue
        if item.get("type") != "text":
            continue
        text = item.get("text")
        if not isinstance(text, str):
            continue
        trimmed = text.strip()
        if not trimmed:
            continue
        text_parts.append({"type": "text", "text": trimmed[:4000]})
    if not text_parts:
        return None
    return text_parts if len(text_parts) > 1 else text_parts[0]["text"]


def _inline_text_input_asset_parts(payload: AiRunRequest, context: ApiRequestContext) -> list[dict[str, object]]:
    if not payload.input_asset_ids:
        return []
    total_bytes = 0
    parts: list[dict[str, object]] = []
    for asset in load_provider_input_assets(payload, context, prefer_preview=True):
        total_bytes += len(asset.content)
        if total_bytes > MAX_TEXT_INPUT_ASSET_BYTES:
            raise ValueError("Text run input images exceed the provider attachment size limit.")
        parts.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{asset.mime};base64,{base64.b64encode(asset.content).decode('ascii')}",
                },
            }
        )
    return parts


def _append_image_parts_to_last_user_message(messages: list[dict[str, object]], image_parts: list[dict[str, object]]) -> None:
    for index in range(len(messages) - 1, -1, -1):
        message = messages[index]
        if message.get("role") != "user":
            continue
        content = message.get("content")
        if isinstance(content, str):
            parts: list[dict[str, object]] = [{"type": "text", "text": content}]
        elif isinstance(content, list):
            parts = list(content)
        else:
            parts = []
        message["content"] = [*parts, *image_parts]
        return
    messages.append({"role": "user", "content": image_parts})


def _requires_user_assistant_turns(route: Optional[AiProviderRouteCandidate]) -> bool:
    provider_model = str(route.provider_model if route else "").strip().lower()
    return provider_model.startswith("hunyuan-")


def _fold_system_messages_into_user_turns(messages: list[dict[str, object]]) -> list[dict[str, object]]:
    system_texts: list[str] = []
    normalized: list[dict[str, object]] = []

    for message in messages:
        role = str(message.get("role") or "").strip().lower()
        if role == "system":
            text = _content_text(message.get("content"))
            if text:
                system_texts.append(text)
            continue
        if role not in {"assistant", "user"}:
            continue
        content = message.get("content")
        if normalized and normalized[-1].get("role") == role:
            normalized[-1]["content"] = _merge_message_content(normalized[-1].get("content"), content)
            continue
        normalized.append({"role": role, "content": content})

    system_prefix = "\n\n".join(text for text in system_texts if text).strip()
    if not system_prefix:
        return normalized
    for message in normalized:
        if message.get("role") != "user":
            continue
        message["content"] = _prepend_text_to_message_content(message.get("content"), f"System instruction:\n{system_prefix}")
        return normalized
    return [{"role": "user", "content": f"System instruction:\n{system_prefix}"}, *normalized]


def _merge_message_content(base: object, next_content: object) -> object:
    base_parts = _as_message_parts(base)
    next_parts = _as_message_parts(next_content)
    if not base_parts:
        return next_parts if len(next_parts) > 1 else next_parts[0]["text"] if next_parts and next_parts[0]["type"] == "text" else next_parts
    merged_parts = [*base_parts, *next_parts]
    text_only = all(part.get("type") == "text" for part in merged_parts)
    if text_only:
        merged_text = "\n\n".join(part["text"].strip() for part in merged_parts if isinstance(part.get("text"), str) and part["text"].strip()).strip()
        return merged_text
    return merged_parts


def _prepend_text_to_message_content(content: object, text: str) -> object:
    prefix = text.strip()
    if not prefix:
        return content
    if isinstance(content, str):
        merged = "\n\n".join(part for part in [prefix, content.strip()] if part).strip()
        return merged
    parts = _as_message_parts(content)
    return [{"type": "text", "text": prefix}, *parts]


def _as_message_parts(content: object) -> list[dict[str, object]]:
    if isinstance(content, str):
        trimmed = content.strip()
        return [{"type": "text", "text": trimmed}] if trimmed else []
    if not isinstance(content, list):
        return []
    return [part for part in content if isinstance(part, dict)]


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


def _content_text(content: object) -> str:
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for item in content:
        if not isinstance(item, dict):
            continue
        if item.get("type") == "text" and isinstance(item.get("text"), str):
            parts.append(item["text"].strip())
    return "\n".join(part for part in parts if part).strip()


def _optional_float(value: object) -> Optional[float]:
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    return numeric


def _optional_positive_int(value: object) -> Optional[int]:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return None
    return numeric if numeric > 0 else None


def _latency_ms(started_at: Optional[datetime]) -> int:
    if started_at is None:
        return 0
    return int((datetime.now(timezone.utc) - started_at).total_seconds() * 1000)


def _timestamp() -> str:
    return datetime.now(timezone.utc).isoformat()
