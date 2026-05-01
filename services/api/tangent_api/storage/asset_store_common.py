import base64
import re
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetRecord

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ASSET_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
MAX_ASSET_BYTES = 30 * 1024 * 1024


@dataclass(frozen=True)
class ParsedDataUrl:
    content: bytes
    mime: str


def parse_image_data_url(data_url: str) -> ParsedDataUrl:
    match = re.match(r"^data:([^;,]+);base64,(.+)$", data_url, flags=re.DOTALL)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid image data URL.")
    try:
        content = base64.b64decode(match.group(2), validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid image data URL.") from exc
    return ParsedDataUrl(content=content, mime=match.group(1))


def assert_image_mime(mime: str) -> None:
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image MIME type.")


def assert_asset_size(byte_size: int) -> None:
    if byte_size > MAX_ASSET_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 30MB or smaller.")


def assert_workspace_access(record: AssetRecord, context: ApiRequestContext) -> None:
    if record.workspace_id != context.workspace_id:
        raise HTTPException(status_code=404, detail="Asset not found in workspace.")


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
