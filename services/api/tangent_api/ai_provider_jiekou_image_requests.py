import base64

import httpx

from tangent_api.ai_provider_assets import (
    ProviderImageOutput,
    decode_b64_image,
    download_provider_image,
    load_provider_input_assets,
)
from tangent_api.ai_schemas import AiRunRequest
from tangent_api.request_context import ApiRequestContext

MAX_PROVIDER_JSON_BYTES = 8 * 1024 * 1024
MAX_IMAGE_INPUTS = 14
MAX_IMAGE_INPUT_TOTAL_BYTES = 48 * 1024 * 1024

GPT_IMAGE_2_MODEL_ID = "gpt-image-2"
NANO_BANANA_2_MODEL_ID = "nano-banana-2"
NANO_BANANA_2_PROVIDER_MODEL_IDS = {
    NANO_BANANA_2_MODEL_ID,
    "gemini-3.1-flash-image",
    "gemini-3.1-flash-image-edit",
    "gemini-3.1-flash-image-text-to-image",
}
SEEDREAM_5_0_LITE_MODEL_ID = "doubao-seedream-5.0-lite"


def run_jiekou_image_attempt(
    client: httpx.Client,
    api_key: str,
    base_url: str,
    payload: AiRunRequest,
    provider_model: str,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    model_id = provider_model.strip().lower()
    if model_id in NANO_BANANA_2_PROVIDER_MODEL_IDS:
        return _run_nano_banana_2(client, api_key, base_url, payload, context, timeout_seconds)
    if model_id == SEEDREAM_5_0_LITE_MODEL_ID:
        return _run_seedream_5_0_lite(client, api_key, base_url, payload, context, timeout_seconds)
    if model_id == GPT_IMAGE_2_MODEL_ID:
        return _run_gpt_image_2(client, api_key, base_url, payload, context, timeout_seconds)
    raise ValueError(f"Jiekou does not support provider model '{provider_model}'.")


def _run_gpt_image_2(
    client: httpx.Client,
    api_key: str,
    base_url: str,
    payload: AiRunRequest,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    input_images = _load_input_images(payload, context)
    endpoint = "gpt-image-2-edit" if input_images else "gpt-image-2-text-to-image"
    count = _count(payload)
    shared_body: dict[str, object] = {
        "background": "auto",
        "n": count,
        "output_format": "png",
        "prompt": _prompt_for_payload(payload),
        "quality": _gpt_quality_for_payload(payload),
        "size": _gpt_size_for_payload(payload),
    }
    if input_images:
        shared_body["image"] = input_images[0] if len(input_images) == 1 else input_images
    else:
        shared_body["moderation"] = "auto"
    outputs = _extract_image_outputs(_post_json(client, _endpoint(base_url, endpoint), api_key, shared_body), timeout_seconds, api_key)
    if len(outputs) >= count:
        return outputs[:count]
    retry_body = {**shared_body, "n": 1}
    return outputs + _run_repeated_generations(
        client,
        api_key,
        base_url,
        endpoint,
        retry_body,
        count - len(outputs),
        timeout_seconds,
    )


def _run_nano_banana_2(
    client: httpx.Client,
    api_key: str,
    base_url: str,
    payload: AiRunRequest,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    input_images = _load_input_images(payload, context)
    endpoint = "gemini-3.1-flash-image-edit" if input_images else "gemini-3.1-flash-image-text-to-image"
    shared_body: dict[str, object] = {
        "aspect_ratio": _nano_banana_aspect_ratio_for_payload(payload),
        "output_format": "image/png",
        "prompt": _prompt_for_payload(payload),
        "size": _nano_banana_size_for_payload(payload),
    }
    if input_images:
        shared_body["image_base64s"] = [image.split(",", 1)[1] if image.startswith("data:") and "," in image else image for image in input_images]
    return _run_repeated_generations(client, api_key, base_url, endpoint, shared_body, _count(payload), timeout_seconds)


def _run_seedream_5_0_lite(
    client: httpx.Client,
    api_key: str,
    base_url: str,
    payload: AiRunRequest,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    count = _count(payload)
    shared_body: dict[str, object] = {
        "optimize_prompt_options": {"mode": "standard"},
        "prompt": _prompt_for_payload(payload),
        "sequential_image_generation": "disabled",
        "size": _seedream_size_for_payload(payload),
        "watermark": False,
    }
    input_images = _load_input_images(payload, context)
    if input_images:
        shared_body["image"] = input_images
    if count <= 1:
        payload_body = _post_json(client, _endpoint(base_url, "seedream-5.0-lite"), api_key, shared_body)
        return _extract_image_outputs(payload_body, timeout_seconds, api_key)
    payload_body = _post_json(
        client,
        _endpoint(base_url, "seedream-5.0-lite"),
        api_key,
        {
            **shared_body,
            "sequential_image_generation": "auto",
            "sequential_image_generation_options": {"max_images": count},
        },
    )
    outputs = _extract_image_outputs(payload_body, timeout_seconds, api_key)
    if len(outputs) >= count:
        return outputs[:count]
    if outputs:
        count -= len(outputs)
    return outputs + _run_repeated_generations(
        client,
        api_key,
        base_url,
        "seedream-5.0-lite",
        shared_body,
        count,
        timeout_seconds,
    )


def _run_repeated_generations(
    client: httpx.Client,
    api_key: str,
    base_url: str,
    endpoint: str,
    shared_body: dict[str, object],
    count: int,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    outputs: list[ProviderImageOutput] = []
    for _ in range(max(1, count)):
        payload_body = _post_json(client, _endpoint(base_url, endpoint), api_key, shared_body)
        outputs.extend(_extract_image_outputs(payload_body, timeout_seconds, api_key))
    return outputs


def _post_json(client: httpx.Client, url: str, api_key: str, body: dict[str, object]) -> dict[str, object]:
    response = client.post(
        url,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        json=body,
    )
    response.raise_for_status()
    return _read_provider_json(response)


def _extract_image_outputs(payload: dict[str, object], timeout_seconds: float, api_key: str) -> list[ProviderImageOutput]:
    items = payload.get("image_urls") or payload.get("images") or payload.get("data") or []
    if not isinstance(items, list):
        raise ValueError("Jiekou image response did not include an images array.")
    outputs: list[ProviderImageOutput] = []
    for item in items:
        if isinstance(item, str):
            outputs.append(_decode_or_download_string_image(item, timeout_seconds, api_key))
            continue
        if not isinstance(item, dict):
            continue
        b64_value = item.get("b64_json") or item.get("base64") or item.get("image_base64")
        if isinstance(b64_value, str) and b64_value.strip():
            outputs.append(decode_b64_image(b64_value.strip()))
            continue
        url_value = item.get("url") or item.get("image_url")
        if isinstance(url_value, str) and url_value.strip():
            outputs.append(download_provider_image(url_value.strip(), timeout_seconds, headers={"Authorization": f"Bearer {api_key}"}))
    return outputs


def _decode_or_download_string_image(value: str, timeout_seconds: float, api_key: str) -> ProviderImageOutput:
    normalized = value.strip()
    if normalized.startswith(("http://", "https://")):
        return download_provider_image(normalized, timeout_seconds, headers={"Authorization": f"Bearer {api_key}"})
    if normalized.startswith("data:") and "," in normalized:
        _prefix, encoded = normalized.split(",", 1)
        return decode_b64_image(encoded)
    return decode_b64_image(normalized)


def _load_input_images(payload: AiRunRequest, context: ApiRequestContext) -> list[str]:
    if len(payload.input_asset_ids) > MAX_IMAGE_INPUTS:
        raise ValueError(f"Image generation accepts up to {MAX_IMAGE_INPUTS} reference images.")
    images: list[str] = []
    total_bytes = 0
    for asset in load_provider_input_assets(payload, context, prefer_preview=False):
        total_bytes += len(asset.content)
        if total_bytes > MAX_IMAGE_INPUT_TOTAL_BYTES:
            raise ValueError("Image generation reference images exceed the total allowed size.")
        images.append(f"data:{asset.mime};base64,{base64.b64encode(asset.content).decode('ascii')}")
    return images


def _prompt_for_payload(payload: AiRunRequest) -> str:
    return (payload.prompt or "Untitled prompt").strip() or "Untitled prompt"


def _count(payload: AiRunRequest) -> int:
    try:
        return max(1, min(4, int(payload.params.get("count", 1))))
    except (TypeError, ValueError):
        return 1


def _gpt_quality_for_payload(payload: AiRunRequest) -> str:
    quality = str(payload.params.get("quality") or "").strip().lower()
    return quality if quality in {"low", "medium", "high"} else "medium"


def _gpt_size_for_payload(payload: AiRunRequest) -> str:
    size = str(payload.params.get("size") or "").strip()
    allowed = {
        "1024x1024",
        "1024x1536",
        "1536x1024",
        "2048x2048",
        "2048x1152",
        "3840x2160",
        "2160x3840",
        "2048x1360",
        "1360x2048",
        "1152x2048",
        "2048x1536",
        "1536x2048",
        "2048x880",
        "880x2048",
        "688x2048",
        "2048x688",
        "2048x1024",
        "1024x2048",
    }
    return size if size in allowed else "1024x1024"


def _nano_banana_aspect_ratio_for_payload(payload: AiRunRequest) -> str:
    aspect_ratio = str(payload.params.get("aspectRatio") or "").strip()
    allowed = {"1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9", "1:4", "4:1", "1:8", "8:1"}
    return aspect_ratio if aspect_ratio in allowed else "1:1"


def _nano_banana_size_for_payload(payload: AiRunRequest) -> str:
    image_size = str(payload.params.get("imageSize") or payload.params.get("resolution") or "").strip().upper()
    return image_size if image_size in {"0.5K", "1K", "2K", "4K"} else "1K"


def _seedream_size_for_payload(payload: AiRunRequest) -> str:
    size = str(payload.params.get("seedreamSize") or payload.params.get("size") or "").strip()
    return size or "2048x2048"


def _endpoint(base_url: str, path: str) -> str:
    normalized = base_url.rstrip("/")
    if normalized.endswith("/v3"):
        return f"{normalized}/{path.lstrip('/')}"
    return f"{normalized}/v3/{path.lstrip('/')}"


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
