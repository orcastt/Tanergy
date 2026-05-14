import base64
import binascii
import re
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, UploadFile

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetRecord

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ASSET_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
MAX_ASSET_BYTES = 100 * 1024 * 1024
UPLOAD_READ_CHUNK_BYTES = 1024 * 1024


@dataclass(frozen=True)
class ParsedDataUrl:
    content: bytes
    mime: str


def parse_image_data_url(data_url: str) -> ParsedDataUrl:
    match = re.match(r"^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$", data_url, flags=re.DOTALL)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid image data URL.")
    mime = match.group(1).lower()
    assert_image_mime(mime)
    base64_payload = re.sub(r"\s+", "", match.group(2))
    assert_asset_size(_estimate_base64_byte_length(base64_payload))
    try:
        content = base64.b64decode(base64_payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid image data URL.") from exc
    assert_asset_size(len(content))
    return ParsedDataUrl(content=content, mime=mime)


def assert_image_mime(mime: str) -> None:
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image MIME type.")


def assert_asset_size(byte_size: int) -> None:
    if byte_size > MAX_ASSET_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 100MB or smaller.")


async def read_upload_file_with_limit(file: UploadFile, max_bytes: int = MAX_ASSET_BYTES) -> bytes:
    content = bytearray()
    total = 0
    while True:
        chunk = await file.read(UPLOAD_READ_CHUNK_BYTES)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise HTTPException(status_code=400, detail="Image must be 100MB or smaller.")
        content.extend(chunk)
    return bytes(content)


def _estimate_base64_byte_length(value: str) -> int:
    if not value or len(value) % 4 != 0:
        raise HTTPException(status_code=400, detail="Invalid image data URL.")
    padding = 2 if value.endswith("==") else 1 if value.endswith("=") else 0
    return (len(value) * 3 // 4) - padding


def assert_workspace_access(record: AssetRecord, context: ApiRequestContext) -> None:
    if not can_access_workspace(record.workspace_id, context):
        raise HTTPException(status_code=404, detail="Asset not found in workspace.")


def can_access_workspace(workspace_id: str, context: ApiRequestContext) -> bool:
    return workspace_id in get_accessible_workspace_ids(context)


def get_accessible_workspace_ids(context: ApiRequestContext) -> list[str]:
    workspace_ids: list[str] = []
    seen = set()
    for workspace_id in [context.workspace_id, *(item.workspace_id for item in (context.workspace_memberships or []))]:
        if not workspace_id or workspace_id in seen:
            continue
        seen.add(workspace_id)
        workspace_ids.append(workspace_id)
    return workspace_ids


def assert_safe_path_segment(value: str) -> None:
    if not ASSET_ID_PATTERN.match(value) or ".." in value:
        raise HTTPException(status_code=400, detail="Invalid asset path.")


def extension_for_mime(mime: str) -> str:
    if mime == "image/png":
        return "png"
    if mime == "image/webp":
        return "webp"
    return "jpg"


def file_url(asset_id: str, file_name: str) -> str:
    return f"/api/v1/assets/files/{asset_id}/{file_name}"


def mime_for_file_name(file_name: str) -> Optional[str]:
    lowered = file_name.lower()
    if lowered.endswith(".png"):
        return "image/png"
    if lowered.endswith(".webp"):
        return "image/webp"
    if lowered.endswith(".jpg") or lowered.endswith(".jpeg"):
        return "image/jpeg"
    return None
