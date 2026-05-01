import base64
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetDataUrlRequest, AssetRecord, AssetThumbnailInput

ALLOWED_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ASSET_ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
MAX_ASSET_BYTES = 30 * 1024 * 1024


@dataclass(frozen=True)
class ParsedDataUrl:
    content: bytes
    mime: str


def create_asset_from_data_url(
    input_data: AssetDataUrlRequest,
    context: ApiRequestContext,
) -> AssetRecord:
    original = _parse_image_data_url(input_data.data_url)
    _assert_image_mime(original.mime)
    _assert_asset_size(len(original.content))

    asset_id = f"asset_{uuid4()}"
    asset_dir = _asset_dir(asset_id)
    asset_dir.mkdir(parents=True, exist_ok=True)

    original_file_name = f"original.{_extension_for_mime(original.mime)}"
    (asset_dir / original_file_name).write_bytes(original.content)

    thumbnail_urls = _write_thumbnails(asset_dir, asset_id, input_data.thumbnails)
    record = AssetRecord(
        **thumbnail_urls,
        byteSize=len(original.content),
        createdAt=datetime.now(timezone.utc).isoformat(),
        createdBy=context.user_id,
        height=input_data.height,
        id=asset_id,
        mime=original.mime,
        origin=input_data.origin,
        originalUrl=_file_url(asset_id, original_file_name),
        storage="local-dev",
        title=input_data.title or input_data.file_name or "Image",
        width=input_data.width,
        workspaceId=context.workspace_id,
    )
    _write_asset_record(asset_dir, record)
    return record


async def create_asset_from_upload(
    file: UploadFile,
    context: ApiRequestContext,
    origin: str,
    title: Optional[str],
    width: int,
    height: int,
) -> AssetRecord:
    mime = file.content_type or ""
    _assert_image_mime(mime)
    content = await file.read()
    _assert_asset_size(len(content))

    asset_id = f"asset_{uuid4()}"
    asset_dir = _asset_dir(asset_id)
    asset_dir.mkdir(parents=True, exist_ok=True)

    original_file_name = f"original.{_extension_for_mime(mime)}"
    (asset_dir / original_file_name).write_bytes(content)

    record = AssetRecord(
        byteSize=len(content),
        createdAt=datetime.now(timezone.utc).isoformat(),
        createdBy=context.user_id,
        height=height,
        id=asset_id,
        mime=mime,
        origin=origin,
        originalUrl=_file_url(asset_id, original_file_name),
        storage="local-dev",
        title=title or file.filename or "Image",
        width=width,
        workspaceId=context.workspace_id,
    )
    _write_asset_record(asset_dir, record)
    return record


def get_asset_record(asset_id: str, context: ApiRequestContext) -> AssetRecord:
    _assert_safe_path_segment(asset_id)
    path = _asset_dir(asset_id) / "metadata.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Asset not found.")
    record = AssetRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))
    _assert_workspace_access(record, context)
    return record


def get_asset_file_path(asset_id: str, file_name: str, context: ApiRequestContext) -> Path:
    _assert_safe_path_segment(asset_id)
    _assert_safe_path_segment(file_name)
    get_asset_record(asset_id, context)
    path = _asset_dir(asset_id) / file_name
    if not path.exists():
        raise HTTPException(status_code=404, detail="Asset file not found.")
    return path


def _write_thumbnails(
    asset_dir: Path,
    asset_id: str,
    thumbnails: Optional[dict[int, AssetThumbnailInput]],
) -> dict[str, str]:
    urls: dict[str, str] = {}
    for size in (256, 512, 1024):
        thumbnail = thumbnails.get(size) if thumbnails else None
        if not thumbnail:
            continue
        parsed = _parse_image_data_url(thumbnail.data_url)
        _assert_image_mime(parsed.mime)
        file_name = f"thumb-{size}.{_extension_for_mime(parsed.mime)}"
        (asset_dir / file_name).write_bytes(parsed.content)
        urls[f"thumbnail{size}Url"] = _file_url(asset_id, file_name)
    return urls


def _parse_image_data_url(data_url: str) -> ParsedDataUrl:
    match = re.match(r"^data:([^;,]+);base64,(.+)$", data_url, flags=re.DOTALL)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid image data URL.")
    try:
        content = base64.b64decode(match.group(2), validate=True)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Invalid image data URL.") from exc
    return ParsedDataUrl(content=content, mime=match.group(1))


def _write_asset_record(asset_dir: Path, record: AssetRecord) -> None:
    asset_dir.joinpath("metadata.json").write_text(
        json.dumps(record.model_dump(by_alias=True), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _storage_root() -> Path:
    return Path(os.getenv("TANGENT_ASSET_STORAGE_DIR", ".tangent-assets"))


def _asset_dir(asset_id: str) -> Path:
    return _storage_root() / "assets" / asset_id


def _file_url(asset_id: str, file_name: str) -> str:
    return f"/api/v1/assets/files/{asset_id}/{file_name}"


def _assert_image_mime(mime: str) -> None:
    if mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported image MIME type.")


def _assert_asset_size(byte_size: int) -> None:
    if byte_size > MAX_ASSET_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 30MB or smaller.")


def _assert_workspace_access(record: AssetRecord, context: ApiRequestContext) -> None:
    if record.workspace_id != context.workspace_id:
        raise HTTPException(status_code=404, detail="Asset not found in workspace.")


def _assert_safe_path_segment(value: str) -> None:
    if not ASSET_ID_PATTERN.match(value) or ".." in value:
        raise HTTPException(status_code=400, detail="Invalid asset path.")


def _extension_for_mime(mime: str) -> str:
    if mime == "image/png":
        return "png"
    if mime == "image/webp":
        return "webp"
    return "jpg"
