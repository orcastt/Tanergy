import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException, UploadFile

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetDataUrlRequest, AssetRecord, AssetThumbnailInput
from tangent_api.storage.asset_store_common import (
    assert_asset_size,
    assert_image_mime,
    assert_safe_path_segment,
    assert_workspace_access,
    extension_for_mime,
    file_url,
    parse_image_data_url,
)


def create_asset_from_data_url(
    input_data: AssetDataUrlRequest,
    context: ApiRequestContext,
) -> AssetRecord:
    original = parse_image_data_url(input_data.data_url)
    assert_image_mime(original.mime)
    assert_asset_size(len(original.content))

    asset_id = f"asset_{uuid4()}"
    asset_dir = _asset_dir(asset_id)
    asset_dir.mkdir(parents=True, exist_ok=True)

    original_file_name = f"original.{extension_for_mime(original.mime)}"
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
        originalUrl=file_url(asset_id, original_file_name),
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
    assert_image_mime(mime)
    content = await file.read()
    assert_asset_size(len(content))

    asset_id = f"asset_{uuid4()}"
    asset_dir = _asset_dir(asset_id)
    asset_dir.mkdir(parents=True, exist_ok=True)

    original_file_name = f"original.{extension_for_mime(mime)}"
    (asset_dir / original_file_name).write_bytes(content)

    record = AssetRecord(
        byteSize=len(content),
        createdAt=datetime.now(timezone.utc).isoformat(),
        createdBy=context.user_id,
        height=height,
        id=asset_id,
        mime=mime,
        origin=origin,
        originalUrl=file_url(asset_id, original_file_name),
        storage="local-dev",
        title=title or file.filename or "Image",
        width=width,
        workspaceId=context.workspace_id,
    )
    _write_asset_record(asset_dir, record)
    return record


def create_asset_from_bytes(
    content: bytes,
    mime: str,
    context: ApiRequestContext,
    origin: str,
    title: Optional[str],
    width: int,
    height: int,
) -> AssetRecord:
    assert_image_mime(mime)
    assert_asset_size(len(content))

    asset_id = f"asset_{uuid4()}"
    asset_dir = _asset_dir(asset_id)
    asset_dir.mkdir(parents=True, exist_ok=True)

    original_file_name = f"original.{extension_for_mime(mime)}"
    (asset_dir / original_file_name).write_bytes(content)

    record = AssetRecord(
        byteSize=len(content),
        createdAt=datetime.now(timezone.utc).isoformat(),
        createdBy=context.user_id,
        height=height,
        id=asset_id,
        mime=mime,
        origin=origin,
        originalUrl=file_url(asset_id, original_file_name),
        storage="local-dev",
        title=title or "Image",
        width=width,
        workspaceId=context.workspace_id,
    )
    _write_asset_record(asset_dir, record)
    return record


def get_asset_record(asset_id: str, context: ApiRequestContext) -> AssetRecord:
    assert_safe_path_segment(asset_id)
    path = _asset_dir(asset_id) / "metadata.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail="Asset not found.")
    record = AssetRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))
    assert_workspace_access(record, context)
    return record


def get_asset_file_path(asset_id: str, file_name: str, context: ApiRequestContext) -> Path:
    assert_safe_path_segment(asset_id)
    assert_safe_path_segment(file_name)
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
        parsed = parse_image_data_url(thumbnail.data_url)
        assert_image_mime(parsed.mime)
        assert_asset_size(len(parsed.content))
        file_name = f"thumb-{size}.{extension_for_mime(parsed.mime)}"
        (asset_dir / file_name).write_bytes(parsed.content)
        urls[f"thumbnail{size}Url"] = file_url(asset_id, file_name)
    return urls


def _write_asset_record(asset_dir: Path, record: AssetRecord) -> None:
    asset_dir.joinpath("metadata.json").write_text(
        json.dumps(record.model_dump(by_alias=True), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def _storage_root() -> Path:
    return Path(os.getenv("TANGENT_ASSET_STORAGE_DIR", ".tangent-assets"))


def _asset_dir(asset_id: str) -> Path:
    return _storage_root() / "assets" / asset_id
