from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Optional
from urllib.parse import urlparse

import httpx

from tangent_api.ai_schemas import AiRunRequest
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.asset_store_common import MAX_ASSET_BYTES
from tangent_api.storage.asset_storage_adapter import get_asset_storage_adapter

_RESOLUTION_PIXELS = {
    "0.5k": 512,
    "0_5k": 512,
    "1k": 1024,
    "2k": 2048,
    "4k": 4096,
}
_ASPECT_RATIOS = {
    "1:1": (1, 1),
    "4:3": (4, 3),
    "16:9": (16, 9),
    "3:2": (3, 2),
    "9:16": (9, 16),
}
MAX_PROVIDER_INPUT_ASSETS = 8


@dataclass(frozen=True)
class ProviderInputAsset:
    asset_id: str
    content: bytes
    file_name: str
    height: int
    mime: str
    title: str
    width: int


@dataclass(frozen=True)
class ProviderImageOutput:
    content: bytes
    mime: str
    height: Optional[int] = None
    title: Optional[str] = None
    width: Optional[int] = None


def load_provider_input_assets(payload: AiRunRequest, context: ApiRequestContext) -> list[ProviderInputAsset]:
    asset_ids = _unique_input_asset_ids(payload.input_asset_ids)
    if len(asset_ids) > MAX_PROVIDER_INPUT_ASSETS:
        raise ValueError("Provider input image count exceeds the limit.")
    storage = get_asset_storage_adapter()
    assets: list[ProviderInputAsset] = []
    for asset_id in asset_ids:
        record = storage.get_record(asset_id, context)
        file_name = original_file_name(record.original_url)
        assets.append(
            ProviderInputAsset(
                asset_id=asset_id,
                content=storage.get_file_bytes(asset_id, file_name, context),
                file_name=file_name,
                height=record.height,
                mime=record.mime,
                title=record.title,
                width=record.width,
            )
        )
    return assets


def _unique_input_asset_ids(input_asset_ids: list[str]) -> list[str]:
    unique_ids: list[str] = []
    seen: set[str] = set()
    for item in input_asset_ids:
        asset_id = item.strip()
        if not asset_id or asset_id in seen:
            continue
        seen.add(asset_id)
        unique_ids.append(asset_id)
    return unique_ids


def persist_provider_output_assets(
    outputs: list[ProviderImageOutput],
    context: ApiRequestContext,
    payload: AiRunRequest,
    provider: str,
) -> list[str]:
    if not outputs:
        return []
    input_assets = load_provider_input_assets(payload, context)
    default_width, default_height = resolve_requested_dimensions(payload, input_assets[0] if input_assets else None)
    storage = get_asset_storage_adapter()
    asset_ids: list[str] = []
    for index, output in enumerate(outputs, start=1):
        asset = storage.create_from_bytes(
            content=output.content,
            mime=output.mime,
            context=context,
            origin=f"ai:{provider}",
            title=output.title or build_output_title(payload.prompt, index),
            width=output.width or default_width,
            height=output.height or default_height,
        )
        asset_ids.append(asset.id)
    return asset_ids


def download_provider_image(url: str, timeout_seconds: float, headers: Optional[dict[str, str]] = None) -> ProviderImageOutput:
    with httpx.Client(timeout=timeout_seconds) as client:
        with client.stream("GET", url, headers=headers) as response:
            response.raise_for_status()
            content = _read_provider_image_response(response)
    mime = response.headers.get("content-type", "").split(";")[0].strip() or detect_image_mime(content)
    return ProviderImageOutput(content=content, mime=mime or "image/png")


def resolve_requested_dimensions(
    payload: AiRunRequest,
    fallback_asset: Optional[ProviderInputAsset] = None,
) -> tuple[int, int]:
    resolution = str(payload.params.get("resolution") or "").strip().lower().replace(".", "_")
    longest_edge = _RESOLUTION_PIXELS.get(resolution, 1024)
    aspect_ratio = str(payload.params.get("aspectRatio") or "1:1").strip()
    if aspect_ratio == "auto" and fallback_asset is not None and fallback_asset.width > 0 and fallback_asset.height > 0:
        return fallback_asset.width, fallback_asset.height
    ratio_width, ratio_height = _ASPECT_RATIOS.get(aspect_ratio, (1, 1))
    if ratio_width >= ratio_height:
        width = longest_edge
        height = max(1, round(longest_edge * ratio_height / ratio_width))
    else:
        height = longest_edge
        width = max(1, round(longest_edge * ratio_width / ratio_height))
    return _even(width), _even(height)


def detect_image_mime(content: bytes) -> Optional[str]:
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def original_file_name(original_url: str) -> str:
    parsed = urlparse(original_url)
    path = parsed.path or original_url
    name = PurePosixPath(path).name
    return name or "original.png"


def build_output_title(prompt: Optional[str], index: int) -> str:
    trimmed = (prompt or "").strip()
    if not trimmed:
        return f"Generated image {index}"
    preview = trimmed[:48].strip()
    return f"{preview} ({index})" if index > 1 else preview


def decode_b64_image(data: str, mime: Optional[str] = None) -> ProviderImageOutput:
    import base64
    import binascii

    normalized = "".join(data.split())
    if _estimate_base64_byte_length(normalized) > MAX_ASSET_BYTES:
        raise ValueError("Provider image output exceeds the asset size limit.")
    try:
        content = base64.b64decode(normalized, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Provider returned invalid base64 image output.") from exc
    if len(content) > MAX_ASSET_BYTES:
        raise ValueError("Provider image output exceeds the asset size limit.")
    return ProviderImageOutput(content=content, mime=mime or detect_image_mime(content) or "image/png")


def _read_provider_image_response(response: httpx.Response) -> bytes:
    content_length = response.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_ASSET_BYTES:
                raise ValueError("Provider image output exceeds the asset size limit.")
        except ValueError:
            raise ValueError("Provider image output exceeds the asset size limit.")
    chunks: list[bytes] = []
    total = 0
    for chunk in response.iter_bytes():
        if not chunk:
            continue
        total += len(chunk)
        if total > MAX_ASSET_BYTES:
            raise ValueError("Provider image output exceeds the asset size limit.")
        chunks.append(chunk)
    return b"".join(chunks)


def _even(value: int) -> int:
    return value if value % 2 == 0 else value + 1


def _estimate_base64_byte_length(value: str) -> int:
    if not value or len(value) % 4 != 0:
        raise ValueError("Provider returned invalid base64 image output.")
    padding = 2 if value.endswith("==") else 1 if value.endswith("=") else 0
    return (len(value) * 3 // 4) - padding
