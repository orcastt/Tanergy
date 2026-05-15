from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Optional
from urllib.parse import urlparse

import httpx

from tangent_api.ai_schemas import AiRunRequest
from tangent_api.image_dimensions import get_image_dimensions
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.asset_store_common import MAX_ASSET_BYTES
from tangent_api.storage.asset_storage_adapter import AssetStorageAdapter, get_asset_storage_adapter

_RESOLUTION_PIXELS = {
    "0.5k": 512,
    "0_5k": 512,
    "1k": 1024,
    "2k": 2048,
    "3k": 3072,
    "4k": 4096,
}
MAX_PROVIDER_INPUT_ASSETS = 8
MAX_PROVIDER_INPUT_TOTAL_BYTES = 48 * 1024 * 1024


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
class ProviderInputAssetRef:
    asset_id: str
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


def load_provider_input_assets(
    payload: AiRunRequest,
    context: ApiRequestContext,
    *,
    prefer_preview: bool = False,
) -> list[ProviderInputAsset]:
    asset_ids = _unique_input_asset_ids(payload.input_asset_ids)
    if len(asset_ids) > MAX_PROVIDER_INPUT_ASSETS:
        raise ValueError("Provider input image count exceeds the limit.")
    storage = get_asset_storage_adapter()
    assets: list[ProviderInputAsset] = []
    total_input_bytes = 0
    for asset_id in asset_ids:
        asset_ref = load_provider_input_asset_ref(asset_id, context, prefer_preview=prefer_preview, storage=storage)
        file_name = asset_ref.file_name
        content = storage.get_file_bytes(asset_id, file_name, context)
        total_input_bytes += len(content)
        if total_input_bytes > MAX_PROVIDER_INPUT_TOTAL_BYTES:
            raise ValueError("Provider input assets exceed the total size limit.")
        assets.append(
            ProviderInputAsset(
                asset_id=asset_id,
                content=content,
                file_name=file_name,
                height=asset_ref.height,
                mime=asset_ref.mime,
                title=asset_ref.title,
                width=asset_ref.width,
            )
        )
    return assets


def load_provider_input_asset_ref(
    asset_id: str,
    context: ApiRequestContext,
    *,
    prefer_preview: bool = False,
    storage: Optional[AssetStorageAdapter] = None,
) -> ProviderInputAssetRef:
    adapter = storage or get_asset_storage_adapter()
    record = adapter.get_record(asset_id, context)
    file_url = _resolve_provider_input_file_url(record, prefer_preview=prefer_preview)
    return ProviderInputAssetRef(
        asset_id=asset_id,
        file_name=original_file_name(file_url),
        height=record.height,
        mime=record.mime,
        title=record.title,
        width=record.width,
    )


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
    fallback_asset = _load_first_provider_input_asset_ref(payload, context)
    default_width, default_height = resolve_requested_dimensions(payload, fallback_asset)
    storage = get_asset_storage_adapter()
    asset_ids: list[str] = []
    for index, output in enumerate(outputs, start=1):
        width, height = resolve_provider_output_dimensions(output, default_width, default_height)
        asset = storage.create_from_bytes(
            content=output.content,
            mime=output.mime,
            context=context,
            origin=f"ai:{provider}",
            title=output.title or build_output_title(payload.prompt, index),
            width=width,
            height=height,
        )
        asset_ids.append(asset.id)
    return asset_ids


def download_provider_image(url: str, timeout_seconds: float, headers: Optional[dict[str, str]] = None) -> ProviderImageOutput:
    with httpx.Client(timeout=timeout_seconds) as client:
        with client.stream("GET", url, headers=headers) as response:
            response.raise_for_status()
            content = _read_provider_image_response(response)
    mime = response.headers.get("content-type", "").split(";")[0].strip() or detect_image_mime(content) or "image/png"
    width, height = get_image_dimensions(content, mime)
    return ProviderImageOutput(
        content=content,
        height=height or None,
        mime=mime,
        width=width or None,
    )


def resolve_requested_dimensions(
    payload: AiRunRequest,
    fallback_asset: Optional[object] = None,
) -> tuple[int, int]:
    explicit_size = _resolve_explicit_requested_size(payload)
    if explicit_size is not None:
        return explicit_size

    longest_edge = _resolve_requested_longest_edge(payload)
    aspect_ratio = str(payload.params.get("aspectRatio") or "1:1").strip()
    fallback_width = getattr(fallback_asset, "width", 0)
    fallback_height = getattr(fallback_asset, "height", 0)
    if aspect_ratio == "auto" and fallback_width > 0 and fallback_height > 0:
        return fallback_width, fallback_height
    ratio_width, ratio_height = _parse_ratio_value(aspect_ratio) or (1, 1)
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


def resolve_provider_output_dimensions(
    output: ProviderImageOutput,
    fallback_width: int,
    fallback_height: int,
) -> tuple[int, int]:
    if (output.width or 0) > 0 and (output.height or 0) > 0:
        return int(output.width), int(output.height)
    detected_mime = detect_image_mime(output.content) or output.mime
    detected_width, detected_height = get_image_dimensions(output.content, detected_mime)
    if detected_width > 0 and detected_height > 0:
        return detected_width, detected_height
    return fallback_width, fallback_height


def original_file_name(original_url: str) -> str:
    parsed = urlparse(original_url)
    path = parsed.path or original_url
    name = PurePosixPath(path).name
    return name or "original.png"


def _resolve_provider_input_file_url(record: object, *, prefer_preview: bool) -> str:
    if prefer_preview:
        for field_name in ("thumbnail1024_url", "thumbnail512_url", "thumbnail256_url"):
            value = getattr(record, field_name, None)
            if isinstance(value, str) and value:
                return value
    return str(getattr(record, "original_url"))


def _load_first_provider_input_asset_ref(
    payload: AiRunRequest,
    context: ApiRequestContext,
) -> Optional[ProviderInputAssetRef]:
    aspect_ratio = str(payload.params.get("aspectRatio") or "").strip().lower()
    if aspect_ratio != "auto":
        return None
    asset_ids = _unique_input_asset_ids(payload.input_asset_ids)
    if not asset_ids:
        return None
    return load_provider_input_asset_ref(asset_ids[0], context)


def _resolve_explicit_requested_size(payload: AiRunRequest) -> Optional[tuple[int, int]]:
    for field_name in _explicit_size_fields(payload):
        parsed = _parse_dimension_value(str(payload.params.get(field_name) or "").strip())
        if parsed is not None:
            return parsed
    return None


def _resolve_requested_longest_edge(payload: AiRunRequest) -> int:
    for field_name in _longest_edge_fields(payload):
        value = str(payload.params.get(field_name) or "").strip().lower().replace(".", "_")
        longest_edge = _RESOLUTION_PIXELS.get(value)
        if longest_edge:
            return longest_edge
    return 1024


def _explicit_size_fields(payload: AiRunRequest) -> tuple[str, ...]:
    model_id = _selected_generation_model_id(payload)
    if model_id == "nano-banana-2":
        return ()
    if model_id == "doubao-seedream-5.0-lite":
        return ("seedreamSize", "size")
    if model_id == "jimeng_t2i_v40":
        return ("jimengSize", "size")
    return ("size", "seedreamSize", "jimengSize")


def _longest_edge_fields(payload: AiRunRequest) -> tuple[str, ...]:
    model_id = _selected_generation_model_id(payload)
    if model_id == "nano-banana-2":
        return ("imageSize", "resolution")
    if model_id == "doubao-seedream-5.0-lite":
        return ("seedreamSize", "size", "resolution")
    if model_id == "jimeng_t2i_v40":
        return ("jimengSize", "size", "resolution")
    return ("imageSize", "seedreamSize", "jimengSize", "size", "resolution")


def _selected_generation_model_id(payload: AiRunRequest) -> str:
    model_id = payload.selected_model_id or payload.params.get("modelId") or ""
    return str(model_id).strip()


def _parse_dimension_value(value: str) -> Optional[tuple[int, int]]:
    if "x" not in value:
        return None
    left, right = value.lower().split("x", 1)
    try:
        width = int(left.strip())
        height = int(right.strip())
    except ValueError:
        return None
    if width <= 0 or height <= 0:
        return None
    return _even(width), _even(height)


def _parse_ratio_value(value: str) -> Optional[tuple[int, int]]:
    if ":" not in value:
        return None
    left, right = value.split(":", 1)
    try:
        width = float(left.strip())
        height = float(right.strip())
    except ValueError:
        return None
    if width <= 0 or height <= 0:
        return None
    return int(round(width * 1000)), int(round(height * 1000))


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
