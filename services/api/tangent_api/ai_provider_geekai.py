import base64
from datetime import datetime, timezone
from time import monotonic, sleep
from typing import Optional
from urllib.parse import quote

import httpx

from tangent_api.ai_provider_assets import (
    ProviderImageOutput,
    decode_b64_image,
    download_provider_image,
    load_provider_input_assets,
    persist_provider_output_assets,
)
from tangent_api.ai_provider_openai_compatible import run_openai_compatible_attempt
from tangent_api.ai_provider_types import AiProviderAttemptResult
from tangent_api.ai_route_catalog import AiProviderRouteCandidate
from tangent_api.ai_schemas import AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext

MAX_PROVIDER_JSON_BYTES = 8 * 1024 * 1024
MAX_IMAGE_INPUTS = 8
MAX_TEXT_INPUT_ASSET_BYTES = 20 * 1024 * 1024
LEGACY_NANO_BANANA_MODEL_ID = "gemini-3.1-flash-image-preview"
NANO_BANANA_2_MODEL_ID = "nano-banana-2"
IMAGE_POLL_INTERVAL_SECONDS = 1.4


def run_geekai_attempt(
    run: AiRunRecord,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
    *,
    api_key: Optional[str],
    base_url: Optional[str],
) -> AiProviderAttemptResult:
    if not api_key or not base_url:
        return _failure(route, "provider_not_configured", "GeekAI route is missing API credentials.", retryable=False)
    if payload.run_type == "text":
        return run_openai_compatible_attempt(run, payload, route, context, api_key=api_key, base_url=base_url)
    if payload.run_type == "image_analysis" and str(route.provider_model or "").strip() == "gemini-2.5-flash":
        return run_openai_compatible_attempt(run, payload, route, context, api_key=api_key, base_url=base_url)
    if payload.run_type not in {"image_generation", "image_edit"}:
        if payload.run_type != "image_analysis":
            return _failure(
                route,
                "provider_capability_not_implemented",
                f"Live provider execution is not implemented for {payload.run_type} on {route.provider_key}.",
                retryable=False,
            )

    started_at = datetime.now(timezone.utc)
    timeout_seconds = max(1.0, route.timeout_ms / 1000)
    try:
        with httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout_seconds) as client:
            if payload.run_type == "image_analysis":
                text_output = _run_image_analysis(client, api_key, payload, route, context)
            else:
                outputs = _run_image_generation(client, api_key, payload, route, context, timeout_seconds)
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

    if payload.run_type == "image_analysis":
        if not text_output:
            return _failure(
                route,
                "provider_empty_response",
                "GeekAI route returned no analysis text.",
                retryable=False,
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
            provider_cost=None,
            provider_currency=None,
            retryable=False,
            route_id=route.route_id,
            route_key=route.route_key,
            status="succeeded",
            text_output=text_output,
            work_started=True,
        )

    if not outputs:
        return _failure(
            route,
            "provider_empty_response",
            "GeekAI route returned no image outputs.",
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


def _run_image_analysis(
    client: httpx.Client,
    api_key: str,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
) -> str:
    provider_model = str(route.provider_model or payload.selected_model_id or "gpt-5.5").strip() or "gpt-5.5"
    image_parts = _response_image_parts(payload, context)
    if not image_parts:
        raise ValueError("Image analysis requires at least one image input.")
    payload_body = _post_json(
        client,
        "/responses",
        api_key,
        {
            "input": [
                {
                    "content": [
                        {"text": _prompt_for_payload(payload), "type": "input_text"},
                        *image_parts,
                    ],
                    "role": "user",
                    "type": "message",
                },
            ],
            "max_output_tokens": 1200,
            "model": provider_model,
            "stream": False,
            "text": {
                "format": {
                    "type": "text",
                },
            },
        },
    )
    return _extract_response_text(payload_body).strip()


def _run_image_generation(
    client: httpx.Client,
    api_key: str,
    payload: AiRunRequest,
    route: AiProviderRouteCandidate,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    provider_model = _normalize_image_model_id(route.provider_model)
    if provider_model == NANO_BANANA_2_MODEL_ID:
        return _run_nano_banana_2_attempt(client, api_key, payload, provider_model, context, timeout_seconds)
    if provider_model == "doubao-seedream-5.0-lite":
        return _run_doubao_seedream_lite_attempt(client, api_key, payload, provider_model, context, timeout_seconds)
    if provider_model == "jimeng_t2i_v40":
        return _run_jimeng_image_40_attempt(client, api_key, payload, provider_model, context, timeout_seconds)
    return _run_gpt_image_attempt(client, api_key, payload, provider_model, context, timeout_seconds)


def _run_gpt_image_attempt(
    client: httpx.Client,
    api_key: str,
    payload: AiRunRequest,
    provider_model: str,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    input_images = _load_input_images(payload, context, prefer_preview=False)
    shared_body = {
        "background": "auto",
        "model": provider_model,
        "n": 1,
        "output_format": "png",
        "prompt": _prompt_for_payload(payload),
        "quality": _gpt_quality_for_payload(payload),
        "response_format": "url",
        "retries": 0,
        "size": _gpt_size_for_payload(payload),
    }

    outputs: list[ProviderImageOutput] = []
    for _ in range(_count(payload)):
        if not input_images:
            payload_body = _post_json(client, "/images/generations", api_key, shared_body)
            outputs.extend(_extract_image_outputs(_settle_image_task(client, api_key, payload_body, timeout_seconds), timeout_seconds, api_key))
            continue

        if len(input_images) == 1:
            payload_body = _post_json(client, "/images/edits", api_key, {**shared_body, "image": input_images[0]})
            outputs.extend(_extract_image_outputs(_settle_image_task(client, api_key, payload_body, timeout_seconds), timeout_seconds, api_key))
            continue

        try:
            payload_body = _post_json(client, "/images/generations", api_key, {**shared_body, "image": input_images})
            outputs.extend(_extract_image_outputs(_settle_image_task(client, api_key, payload_body, timeout_seconds), timeout_seconds, api_key))
            continue
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code not in {400, 404, 409, 422}:
                raise
        payload_body = _post_json(client, "/images/generations", api_key, {**shared_body, "images": input_images})
        outputs.extend(_extract_image_outputs(_settle_image_task(client, api_key, payload_body, timeout_seconds), timeout_seconds, api_key))
    return outputs


def _run_nano_banana_2_attempt(
    client: httpx.Client,
    api_key: str,
    payload: AiRunRequest,
    provider_model: str,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    input_images = _load_input_images(payload, context, prefer_preview=False)
    shared_body = {
        "aspect_ratio": _nano_banana_aspect_ratio_for_payload(payload),
        "model": provider_model,
        "prompt": _prompt_for_payload(payload),
        "retries": 0,
        "size": _nano_banana_image_size_for_payload(payload),
    }

    outputs: list[ProviderImageOutput] = []
    for _ in range(_count(payload)):
        if not input_images:
            payload_body = _post_json(client, "/images/generations", api_key, shared_body)
        else:
            payload_body = _post_json(client, "/images/edits", api_key, {
                **shared_body,
                "image": input_images[0] if len(input_images) == 1 else input_images,
            })
        outputs.extend(_extract_image_outputs(_settle_image_task(client, api_key, payload_body, timeout_seconds), timeout_seconds, api_key))
    return outputs


def _run_doubao_seedream_lite_attempt(
    client: httpx.Client,
    api_key: str,
    payload: AiRunRequest,
    provider_model: str,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    count = _count(payload)
    input_images = _load_input_images(payload, context, prefer_preview=False)
    shared_body = {
        "model": provider_model,
        "output_format": _seedream_output_format_for_payload(payload),
        "prompt": _prompt_for_payload(payload),
        "retries": 0,
        "size": _seedream_size_for_payload(payload),
        "watermark": False,
        **_create_image_reference_body(input_images),
    }

    if count <= 1:
        payload_body = _post_json(client, "/images/generations", api_key, shared_body)
        return _extract_image_outputs(_settle_image_task(client, api_key, payload_body, timeout_seconds), timeout_seconds, api_key)

    try:
        grouped_payload = _post_json(
            client,
            "/images/generations",
            api_key,
            {
                **shared_body,
                "extra_body": {
                    "sequential_image_generation": "auto",
                    "sequential_image_generation_options": {
                        "max_images": count,
                    },
                },
            },
        )
        grouped_outputs = _extract_image_outputs(_settle_image_task(client, api_key, grouped_payload, timeout_seconds), timeout_seconds, api_key)
        if len(grouped_outputs) >= count:
            return grouped_outputs[:count]
        return [
            *grouped_outputs,
            *_run_repeated_image_generations(client, api_key, shared_body, count - len(grouped_outputs), timeout_seconds),
        ][:count]
    except (httpx.HTTPError, ValueError):
        return _run_repeated_image_generations(client, api_key, shared_body, count, timeout_seconds)


def _run_jimeng_image_40_attempt(
    client: httpx.Client,
    api_key: str,
    payload: AiRunRequest,
    provider_model: str,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    input_images = _load_input_images(payload, context, prefer_preview=False)
    shared_body = {
        "model": provider_model,
        "prompt": _prompt_for_payload(payload),
        "retries": 0,
        "size": _jimeng_size_for_payload(payload),
        **({"strength": _jimeng_strength_for_payload(payload)} if input_images else {}),
        **_create_image_reference_body(input_images),
    }
    return _run_repeated_image_generations(client, api_key, shared_body, _count(payload), timeout_seconds)


def _run_repeated_image_generations(
    client: httpx.Client,
    api_key: str,
    shared_body: dict[str, object],
    count: int,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    outputs: list[ProviderImageOutput] = []
    for _ in range(max(1, count)):
        payload_body = _post_json(client, "/images/generations", api_key, shared_body)
        outputs.extend(_extract_image_outputs(_settle_image_task(client, api_key, payload_body, timeout_seconds), timeout_seconds, api_key))
    return outputs


def _settle_image_task(
    client: httpx.Client,
    api_key: str,
    payload: dict[str, object],
    timeout_seconds: float,
) -> dict[str, object]:
    status = str(payload.get("task_status") or "").strip().lower()
    if status == "succeed":
        return payload
    if status == "failed":
        raise ValueError(_provider_message(payload, "GeekAI image generation failed."))

    task_id = payload.get("task_id")
    if not isinstance(task_id, str) or not task_id.strip():
        return payload

    deadline = monotonic() + timeout_seconds
    while monotonic() < deadline:
        sleep(IMAGE_POLL_INTERVAL_SECONDS)
        next_payload = None
        for _ in range(3):
            try:
                next_payload = _get_json(client, f"/images/{quote(task_id.strip(), safe='')}", api_key)
                break
            except httpx.HTTPError:
                sleep(0.6)
        if next_payload is None:
            continue
        next_status = str(next_payload.get("task_status") or "").strip().lower()
        if next_status == "succeed":
            return next_payload
        if next_status == "failed":
            raise ValueError(_provider_message(next_payload, "GeekAI image generation failed."))

    raise ValueError("GeekAI image generation timed out.")


def _extract_image_outputs(payload: dict[str, object], timeout_seconds: float, api_key: str) -> list[ProviderImageOutput]:
    outputs: list[ProviderImageOutput] = []
    for item in payload.get("data") or []:
        if not isinstance(item, dict):
            continue
        b64_json = item.get("b64_json")
        if isinstance(b64_json, str) and b64_json.strip():
            outputs.append(decode_b64_image(b64_json))
            continue
        url = item.get("url")
        if isinstance(url, str) and url.strip():
            outputs.append(download_provider_image(url.strip(), timeout_seconds, headers={"Authorization": f"Bearer {api_key}"}))
    return outputs


def _post_json(client: httpx.Client, path: str, api_key: str, body: dict[str, object]) -> dict[str, object]:
    response = client.post(path, headers={"Authorization": f"Bearer {api_key}"}, json=body)
    response.raise_for_status()
    return _read_provider_json(response)


def _get_json(client: httpx.Client, path: str, api_key: str) -> dict[str, object]:
    response = client.get(path, headers={"Authorization": f"Bearer {api_key}"})
    response.raise_for_status()
    return _read_provider_json(response)


def _read_provider_json(response: httpx.Response) -> dict[str, object]:
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


def _load_input_images(payload: AiRunRequest, context: ApiRequestContext, *, prefer_preview: bool) -> list[str]:
    asset_ids = _unique_asset_ids(payload.input_asset_ids)
    if len(asset_ids) > MAX_IMAGE_INPUTS:
        raise ValueError(f"Image generation accepts up to {MAX_IMAGE_INPUTS} reference images.")
    images: list[str] = []
    total_bytes = 0
    for asset in load_provider_input_assets(payload, context, prefer_preview=prefer_preview):
        total_bytes += len(asset.content)
        if total_bytes > 48 * 1024 * 1024:
            raise ValueError("Image generation reference images exceed the total allowed size.")
        images.append(f"data:{asset.mime};base64,{base64.b64encode(asset.content).decode('ascii')}")
    return images


def _response_image_parts(payload: AiRunRequest, context: ApiRequestContext) -> list[dict[str, str]]:
    parts: list[dict[str, str]] = []
    total_bytes = 0
    for asset in load_provider_input_assets(payload, context, prefer_preview=True):
        total_bytes += len(asset.content)
        if total_bytes > MAX_TEXT_INPUT_ASSET_BYTES:
            raise ValueError("Image analysis reference images exceed the total allowed size.")
        parts.append(
            {
                "image_url": f"data:{asset.mime};base64,{base64.b64encode(asset.content).decode('ascii')}",
                "type": "input_image",
            }
        )
    return parts


def _extract_response_text(payload: dict[str, object]) -> str:
    output_text = payload.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text
    parts: list[str] = []
    for item in payload.get("output") or []:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        content = item.get("content")
        if not isinstance(content, list):
            continue
        for content_item in content:
            if not isinstance(content_item, dict):
                continue
            if content_item.get("type") != "output_text":
                continue
            text = content_item.get("text")
            if isinstance(text, str) and text.strip():
                parts.append(text.strip())
    return "\n".join(parts).strip()


def _unique_asset_ids(asset_ids: list[str]) -> list[str]:
    unique_ids: list[str] = []
    seen: set[str] = set()
    for asset_id in asset_ids:
        normalized = asset_id.strip()
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        unique_ids.append(normalized)
    return unique_ids


def _count(payload: AiRunRequest) -> int:
    try:
        return max(1, min(4, int(payload.params.get("count", 1))))
    except (TypeError, ValueError):
        return 1


def _normalize_image_model_id(model_id: str) -> str:
    if model_id == LEGACY_NANO_BANANA_MODEL_ID:
        return NANO_BANANA_2_MODEL_ID
    return model_id


def _prompt_for_payload(payload: AiRunRequest) -> str:
    return (payload.prompt or "Untitled prompt").strip() or "Untitled prompt"


def _gpt_quality_for_payload(payload: AiRunRequest) -> str:
    quality = str(payload.params.get("quality") or "").strip().lower()
    if quality in {"low", "medium", "high"}:
        return quality
    resolution = str(payload.params.get("resolution") or "").strip().lower()
    if resolution in {"0.5k", "0_5k"}:
        return "low"
    if resolution in {"2k", "4k"}:
        return "high"
    return "medium"


def _gpt_size_for_payload(payload: AiRunRequest) -> str:
    size = str(payload.params.get("size") or "").strip()
    if size in {"1024x1024", "1024x1536", "1536x1024"}:
        return size
    aspect_ratio = str(payload.params.get("aspectRatio") or "").strip()
    if aspect_ratio in {"4:3", "16:9", "3:2"}:
        return "1536x1024"
    return "1024x1024"


def _nano_banana_aspect_ratio_for_payload(payload: AiRunRequest) -> str:
    aspect_ratio = str(payload.params.get("aspectRatio") or "").strip()
    allowed = {"1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "9:21", "1:4", "4:1", "1:8", "8:1"}
    return aspect_ratio if aspect_ratio in allowed else "1:1"


def _nano_banana_image_size_for_payload(payload: AiRunRequest) -> str:
    image_size = str(payload.params.get("imageSize") or "").strip()
    if image_size in {"0.5K", "1K", "2K", "4K"}:
        return image_size
    resolution = str(payload.params.get("resolution") or "").strip()
    if resolution in {"0.5K", "1K", "2K", "4K"}:
        return resolution
    return "1K"


def _seedream_size_for_payload(payload: AiRunRequest) -> str:
    size = str(payload.params.get("seedreamSize") or payload.params.get("size") or "").strip()
    allowed = {
        "2K",
        "3K",
        "4K",
        "2048x2048",
        "2304x1728",
        "1728x2304",
        "2848x1600",
        "1600x2848",
        "2496x1664",
        "1664x2496",
        "3136x1344",
        "3072x3072",
        "3456x2592",
        "2592x3456",
        "4096x2304",
        "2304x4096",
        "3744x2496",
        "2496x3744",
        "4704x2016",
        "4096x4096",
        "3520x4704",
        "4704x3520",
        "5504x3040",
        "3040x5504",
        "3328x4992",
        "4992x3328",
        "6240x2656",
    }
    return size if size in allowed else "2K"


def _seedream_output_format_for_payload(payload: AiRunRequest) -> str:
    output_format = str(payload.params.get("seedreamOutputFormat") or "").strip().lower()
    return "jpeg" if output_format in {"jpeg", "jpg"} else "png"


def _jimeng_size_for_payload(payload: AiRunRequest) -> str:
    size = str(payload.params.get("jimengSize") or payload.params.get("size") or "").strip()
    allowed = {
        "1024x1024",
        "2048x2048",
        "2304x1728",
        "2560x1440",
        "2496x1664",
        "3024x1296",
        "4096x4096",
        "4694x3520",
        "4992x3328",
        "5404x3040",
        "6198x2656",
    }
    return size if size in allowed else "2048x2048"


def _jimeng_strength_for_payload(payload: AiRunRequest) -> float:
    try:
        strength = float(payload.params.get("jimengStrength") or 0.5)
    except (TypeError, ValueError):
        strength = 0.5
    return max(0.0, min(1.0, strength))


def _create_image_reference_body(input_images: list[str]) -> dict[str, object]:
    if not input_images:
        return {}
    return {"image": input_images[0] if len(input_images) == 1 else input_images}


def _provider_message(payload: dict[str, object], fallback: str) -> str:
    error = payload.get("error")
    if isinstance(error, dict):
        message = error.get("message")
        if isinstance(message, str) and message.strip():
            return message.strip()
    message = payload.get("message")
    if isinstance(message, str) and message.strip():
        return message.strip()
    return fallback


def _provider_cost(payload: Optional[dict[str, object]]) -> Optional[float]:
    if not isinstance(payload, dict):
        return None
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None
    cost = usage.get("cost") or usage.get("total_cost")
    try:
        return float(cost)
    except (TypeError, ValueError):
        return None


def _provider_currency(payload: Optional[dict[str, object]]) -> Optional[str]:
    if not isinstance(payload, dict):
        return None
    usage = payload.get("usage")
    if not isinstance(usage, dict):
        return None
    currency = usage.get("currency")
    return str(currency) if currency else None


def _http_failure(route: AiProviderRouteCandidate, exc: httpx.HTTPStatusError, started_at: datetime) -> AiProviderAttemptResult:
    status_code = exc.response.status_code
    message = exc.response.text[:400] if exc.response.text else f"Provider returned HTTP {status_code}."
    return _failure(
        route,
        f"provider_http_{status_code}",
        message,
        retryable=False,
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
