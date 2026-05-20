import base64
import binascii
import re
from dataclasses import dataclass
from typing import Optional

from fastapi import HTTPException, UploadFile

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetRecord

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
BLOCKED_ACTIVE_DOCUMENT_MIME_TYPES = {"application/pdf", "image/svg+xml"}
ACTIVE_DOCUMENT_REJECTION_DETAIL = "SVG and PDF assets are not accepted by the image pipeline."
ASSET_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
MAX_ASSET_BYTES = 100 * 1024 * 1024
UPLOAD_READ_CHUNK_BYTES = 1024 * 1024
ASSET_FILE_SECURITY_HEADERS = {
    "Cache-Control": "private, max-age=3600",
    "Cross-Origin-Resource-Policy": "same-site",
    "X-Robots-Tag": "noindex, nofollow",
}


@dataclass(frozen=True)
class ParsedDataUrl:
    content: bytes
    mime: str


def parse_image_data_url(data_url: str) -> ParsedDataUrl:
    match = re.match(r"^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$", data_url, flags=re.DOTALL)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid image data URL.")
    mime = _normalize_mime(match.group(1))
    assert_image_mime(mime)
    base64_payload = re.sub(r"\s+", "", match.group(2))
    assert_asset_size(_estimate_base64_byte_length(base64_payload))
    try:
        content = base64.b64decode(base64_payload, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid image data URL.") from exc
    assert_asset_size(len(content))
    assert_image_content_matches_mime(content, mime)
    return ParsedDataUrl(content=content, mime=mime)


def assert_image_mime(mime: str) -> None:
    mime = _normalize_mime(mime)
    if mime in BLOCKED_ACTIVE_DOCUMENT_MIME_TYPES:
        raise HTTPException(status_code=400, detail=ACTIVE_DOCUMENT_REJECTION_DETAIL)
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image MIME type.")


def assert_image_content_matches_mime(content: bytes, mime: str) -> None:
    mime = _normalize_mime(mime)
    assert_image_mime(mime)
    if detect_active_document_payload(content):
        raise HTTPException(status_code=400, detail=ACTIVE_DOCUMENT_REJECTION_DETAIL)
    detected = detect_image_mime(content)
    if detected != mime:
        raise HTTPException(status_code=400, detail="Image content does not match MIME type.")


def detect_image_mime(content: bytes) -> Optional[str]:
    if content.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if content.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if len(content) >= 12 and content.startswith(b"RIFF") and content[8:12] == b"WEBP":
        return "image/webp"
    return None


def detect_active_document_payload(content: bytes) -> Optional[str]:
    head = content[:512].lstrip(b"\xef\xbb\xbf\t\r\n ")
    lowered = head.lower()
    if lowered.startswith(b"%pdf-"):
        return "application/pdf"
    if lowered.startswith(b"<svg") or lowered.startswith(b"<!doctype svg"):
        return "image/svg+xml"
    if lowered.startswith(b"<?xml") and b"<svg" in lowered[:256]:
        return "image/svg+xml"
    return None


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
    mime = _normalize_mime(mime)
    assert_image_mime(mime)
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


def _normalize_mime(mime: str) -> str:
    return mime.split(";", 1)[0].strip().lower()
