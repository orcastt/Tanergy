from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Optional
from urllib.parse import urlparse

import httpx

from tangent_api.ai_schemas import AiRunRequest
from tangent_api.request_context import ApiRequestContext
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
    storage = get_asset_storage_adapter()
    assets: list[ProviderInputAsset] = []
    for asset_id in payload.input_asset_ids:
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
        response = client.get(url, headers=headers)
        response.raise_for_status()
    mime = response.headers.get("content-type", "").split(";")[0].strip() or detect_image_mime(response.content)
    return ProviderImageOutput(content=response.content, mime=mime or "image/png")


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

    content = base64.b64decode(data)
    return ProviderImageOutput(content=content, mime=mime or detect_image_mime(content) or "image/png")


def _even(value: int) -> int:
    return value if value % 2 == 0 else value + 1
