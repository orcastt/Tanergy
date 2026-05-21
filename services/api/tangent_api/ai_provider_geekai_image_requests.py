import base64
import re
from typing import Optional

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
MAX_IMAGE_INPUTS = 8
MAX_IMAGE_INPUT_TOTAL_BYTES = 32 * 1024 * 1024

GPT_IMAGE_2_MODEL_ID = "gpt-image-2"
NANO_BANANA_2_MODEL_ID = "nano-banana-2"
GEEKAI_NANO_BANANA_2_MODEL_ID = "gemini-3.1-flash-image-preview"
NANO_BANANA_2_ASPECT_RATIOS = {
    "1:1",
    "2:3",
    "3:2",
    "3:4",
    "4:3",
    "4:5",
    "5:4",
    "9:16",
    "16:9",
    "21:9",
    "1:4",
    "4:1",
    "1:8",
    "8:1",
}
NANO_BANANA_2_PROVIDER_MODEL_IDS = {
    NANO_BANANA_2_MODEL_ID,
    GEEKAI_NANO_BANANA_2_MODEL_ID,
    "gemini-3.1-flash-image",
}


def run_geekai_image_attempt(
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
    return _run_openai_image_model(client, api_key, base_url, payload, provider_model, context, timeout_seconds)


def _run_openai_image_model(
    client: httpx.Client,
    api_key: str,
    base_url: str,
    payload: AiRunRequest,
    provider_model: str,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    input_images = _load_input_images(payload, context)
    count = _count(payload)
    request_body: dict[str, object] = {
        "background": "auto",
        "model": provider_model or GPT_IMAGE_2_MODEL_ID,
        "n": count,
        "output_format": "png",
        "prompt": _prompt_for_payload(payload),
        "quality": _gpt_quality_for_payload(payload),
        "response_format": "url",
        "size": _gpt_size_for_payload(payload),
    }
    if input_images:
        request_body["image"] = input_images[0] if len(input_images) == 1 else input_images
    path = "/images/edits" if input_images else "/images/generations"
    outputs = _extract_image_outputs(_post_json(client, _endpoint(base_url, path), api_key, request_body), timeout_seconds, api_key)
    if len(outputs) >= count:
        return outputs[:count]
    retry_body = {**request_body, "n": 1}
    return outputs + _run_repeated_json(client, api_key, base_url, path, retry_body, count - len(outputs), timeout_seconds)


def _run_nano_banana_2(
    client: httpx.Client,
    api_key: str,
    base_url: str,
    payload: AiRunRequest,
    context: ApiRequestContext,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    input_images = _load_input_images(payload, context)
    shared_body = {
        "image": {
            "aspect_ratio": _nano_banana_aspect_ratio_for_payload(payload),
            "image_size": _nano_banana_size_for_payload(payload),
        },
        "messages": [
            {
                "content": _message_content(_prompt_for_payload(payload), input_images),
                "role": "user",
            }
        ],
        "model": GEEKAI_NANO_BANANA_2_MODEL_ID,
        "stream": False,
    }
    return _run_repeated_json(client, api_key, base_url, "/chat/completions", shared_body, _count(payload), timeout_seconds)


def _run_repeated_json(
    client: httpx.Client,
    api_key: str,
    base_url: str,
    path: str,
    shared_body: dict[str, object],
    count: int,
    timeout_seconds: float,
) -> list[ProviderImageOutput]:
    outputs: list[ProviderImageOutput] = []
    for _ in range(max(1, count)):
        response_body = _post_json(client, _endpoint(base_url, path), api_key, shared_body)
        outputs.extend(_extract_image_outputs(response_body, timeout_seconds, api_key))
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
    raw_items = payload.get("image_urls") or payload.get("images") or payload.get("data") or []
    items = raw_items if isinstance(raw_items, list) else []
    outputs = [_decode_or_download_item(item, timeout_seconds, api_key) for item in items]
    outputs.extend(_decode_or_download_item(item, timeout_seconds, api_key) for item in _chat_image_items(payload))
    return [output for output in outputs if output is not None]


def _decode_or_download_item(item: object, timeout_seconds: float, api_key: str) -> Optional[ProviderImageOutput]:
    if isinstance(item, str):
        return _decode_or_download_string_image(item, timeout_seconds, api_key)
    if not isinstance(item, dict):
        return None
    b64_value = item.get("b64_json") or item.get("base64") or item.get("image_base64")
    if isinstance(b64_value, str) and b64_value.strip():
        return decode_b64_image(_strip_data_url_prefix(b64_value.strip()))
    url_value = item.get("url") or item.get("image_url")
    if isinstance(url_value, str) and url_value.strip():
        return _decode_or_download_string_image(url_value.strip(), timeout_seconds, api_key)
    return None


def _decode_or_download_string_image(value: str, timeout_seconds: float, api_key: str) -> ProviderImageOutput:
    normalized = value.strip()
    if normalized.startswith(("http://", "https://")):
        return download_provider_image(normalized, timeout_seconds, headers={"Authorization": f"Bearer {api_key}"})
    return decode_b64_image(_strip_data_url_prefix(normalized))


def _chat_image_items(payload: dict[str, object]) -> list[object]:
    choices = payload.get("choices")
    if not isinstance(choices, list):
        return []
    items: list[object] = []
    for choice in choices:
        message = choice.get("message") if isinstance(choice, dict) else None
        if not isinstance(message, dict):
            continue
        image = message.get("image")
        if isinstance(image, dict) and image.get("url"):
            items.append(str(image["url"]))
        content = message.get("content")
        if isinstance(content, str):
            items.extend(_markdown_image_urls(content))
        elif isinstance(content, list):
            items.extend(_content_part_image_items(content))
    return items


def _content_part_image_items(content: list[object]) -> list[object]:
    items: list[object] = []
    for part in content:
        if not isinstance(part, dict):
            continue
        if isinstance(part.get("text"), str):
            items.extend(_markdown_image_urls(str(part["text"])))
        image_url = part.get("image_url")
        if isinstance(image_url, dict) and image_url.get("url"):
            items.append(str(image_url["url"]))
    return items


def _markdown_image_urls(content: str) -> list[str]:
    return re.findall(r"!\[[^\]]*]\((https?://[^)\s]+)\)", content)


def _load_input_images(payload: AiRunRequest, context: ApiRequestContext) -> list[str]:
    if len(payload.input_asset_ids) > MAX_IMAGE_INPUTS:
        raise ValueError(f"Image generation accepts up to {MAX_IMAGE_INPUTS} reference images.")
    images: list[str] = []
    total_bytes = 0
    for asset in load_provider_input_assets(payload, context, prefer_preview=False):
        total_bytes += len(asset.content)
        if total_bytes > MAX_IMAGE_INPUT_TOTAL_BYTES:
            raise ValueError("Image generation reference images exceed the total allowed size.")
        encoded = base64.b64encode(asset.content).decode("ascii")
        images.append(f"data:{asset.mime};base64,{encoded}")
    return images


def _message_content(prompt: str, input_images: list[str]) -> list[dict[str, object]]:
    return [
        {"text": prompt, "type": "text"},
        *[{"image_url": {"url": image}, "type": "image_url"} for image in input_images],
    ]


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
    return size or "1024x1024"


def _nano_banana_aspect_ratio_for_payload(payload: AiRunRequest) -> str:
    aspect_ratio = str(payload.params.get("aspectRatio") or "").strip()
    return aspect_ratio if aspect_ratio in NANO_BANANA_2_ASPECT_RATIOS else "1:1"


def _nano_banana_size_for_payload(payload: AiRunRequest) -> str:
    image_size = str(payload.params.get("imageSize") or payload.params.get("resolution") or "").strip().upper()
    return image_size if image_size in {"0.5K", "1K", "2K", "4K"} else "1K"


def _endpoint(base_url: str, path: str) -> str:
    return f"{base_url.rstrip('/')}/{path.lstrip('/')}"


def _strip_data_url_prefix(value: str) -> str:
    return value.split(",", 1)[1] if value.startswith("data:") and "," in value else value


def _read_provider_json(response: httpx.Response) -> dict[str, object]:
    content_length = response.headers.get("content-length")
    if content_length and int(content_length) > MAX_PROVIDER_JSON_BYTES:
        raise ValueError("Provider response exceeded the JSON size limit.")
    if len(response.content) > MAX_PROVIDER_JSON_BYTES:
        raise ValueError("Provider response exceeded the JSON size limit.")
    body = response.json()
    if not isinstance(body, dict):
        raise ValueError("Provider response was not a JSON object.")
    return body
