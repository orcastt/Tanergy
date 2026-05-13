from datetime import datetime, timezone
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException, Response, UploadFile

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetDataUrlRequest, AssetRecord, AssetThumbnailInput
from tangent_api.storage.asset_metadata_adapter import get_asset_metadata_adapter
from tangent_api.storage.asset_store_common import (
    assert_asset_size,
    assert_image_mime,
    assert_safe_path_segment,
    extension_for_mime,
    file_url,
    mime_for_file_name,
    parse_image_data_url,
    read_upload_file_with_limit,
)
from tangent_api.storage.s3_client import (
    S3AssetStorageConfig,
    create_s3_client,
    is_missing_object_error,
)


class S3AssetStore:
    def __init__(self, config: S3AssetStorageConfig, client: Any) -> None:
        self.config = config
        self.client = client

    def create_asset_from_data_url(
        self,
        input_data: AssetDataUrlRequest,
        context: ApiRequestContext,
    ) -> AssetRecord:
        original = parse_image_data_url(input_data.data_url)
        assert_image_mime(original.mime)
        assert_asset_size(len(original.content))

        asset_id = f"asset_{uuid4()}"
        original_file_name = f"original.{extension_for_mime(original.mime)}"
        self._put_asset_file(context, asset_id, original_file_name, original.content, original.mime)

        thumbnail_urls = self._put_thumbnails(context, asset_id, input_data.thumbnails)
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
            storage="s3-compatible",
            title=input_data.title or input_data.file_name or "Image",
            width=input_data.width,
            workspaceId=context.workspace_id,
        )
        self._write_asset_record(context, asset_id, record)
        return record

    async def create_asset_from_upload(
        self,
        file: UploadFile,
        context: ApiRequestContext,
        origin: str,
        title: Optional[str],
        width: int,
        height: int,
    ) -> AssetRecord:
        mime = file.content_type or ""
        assert_image_mime(mime)
        content = await read_upload_file_with_limit(file)
        assert_asset_size(len(content))

        asset_id = f"asset_{uuid4()}"
        original_file_name = f"original.{extension_for_mime(mime)}"
        self._put_asset_file(context, asset_id, original_file_name, content, mime)

        record = AssetRecord(
            byteSize=len(content),
            createdAt=datetime.now(timezone.utc).isoformat(),
            createdBy=context.user_id,
            height=height,
            id=asset_id,
            mime=mime,
            origin=origin,
            originalUrl=file_url(asset_id, original_file_name),
            storage="s3-compatible",
            title=title or file.filename or "Image",
            width=width,
            workspaceId=context.workspace_id,
        )
        self._write_asset_record(context, asset_id, record)
        return record

    def create_asset_from_bytes(
        self,
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
        original_file_name = f"original.{extension_for_mime(mime)}"
        self._put_asset_file(context, asset_id, original_file_name, content, mime)

        record = AssetRecord(
            byteSize=len(content),
            createdAt=datetime.now(timezone.utc).isoformat(),
            createdBy=context.user_id,
            height=height,
            id=asset_id,
            mime=mime,
            origin=origin,
            originalUrl=file_url(asset_id, original_file_name),
            storage="s3-compatible",
            title=title or "Image",
            width=width,
            workspaceId=context.workspace_id,
        )
        self._write_asset_record(context, asset_id, record)
        return record

    def get_asset_record(self, asset_id: str, context: ApiRequestContext) -> AssetRecord:
        assert_safe_path_segment(asset_id)
        return get_asset_metadata_adapter(self).get_record(asset_id, context)

    def get_file_response(
        self,
        asset_id: str,
        file_name: str,
        context: ApiRequestContext,
    ) -> Response:
        assert_safe_path_segment(asset_id)
        assert_safe_path_segment(file_name)
        record = self.get_asset_record(asset_id, context)
        result = self._get_object(
            self._asset_key(context.workspace_id, asset_id, file_name),
            "Asset file not found.",
        )
        content = result["Body"].read()
        media_type = result.get("ContentType") or mime_for_file_name(file_name) or record.mime
        return Response(
            content=content,
            headers={"Cache-Control": "private, max-age=3600"},
            media_type=media_type,
        )

    def get_file_bytes(self, asset_id: str, file_name: str, context: ApiRequestContext) -> bytes:
        assert_safe_path_segment(asset_id)
        assert_safe_path_segment(file_name)
        self.get_asset_record(asset_id, context)
        return self._get_object_bytes(
            self._asset_key(context.workspace_id, asset_id, file_name),
            "Asset file not found.",
        )

    def _put_thumbnails(
        self,
        context: ApiRequestContext,
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
            self._put_asset_file(context, asset_id, file_name, parsed.content, parsed.mime)
            urls[f"thumbnail{size}Url"] = file_url(asset_id, file_name)
        return urls

    def _put_asset_file(
        self,
        context: ApiRequestContext,
        asset_id: str,
        file_name: str,
        content: bytes,
        mime: str,
    ) -> None:
        self._put_object(self._asset_key(context.workspace_id, asset_id, file_name), content, mime)

    def _write_asset_record(
        self,
        context: ApiRequestContext,
        asset_id: str,
        record: AssetRecord,
    ) -> None:
        _ = asset_id
        get_asset_metadata_adapter(self).save_record(record, context)

    def read_asset_metadata(self, asset_id: str, context: ApiRequestContext) -> bytes:
        return self._get_object_bytes(
            self._asset_key(context.workspace_id, asset_id, "metadata.json"),
            "Asset not found.",
        )

    def write_asset_metadata(
        self,
        asset_id: str,
        context: ApiRequestContext,
        content: bytes,
    ) -> None:
        self._put_object(
            self._asset_key(context.workspace_id, asset_id, "metadata.json"),
            content,
            "application/json",
        )

    def _put_object(self, key: str, content: bytes, mime: str) -> None:
        try:
            self.client.put_object(
                Body=content,
                Bucket=self.config.bucket,
                ContentType=mime,
                Key=key,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail="Asset storage write failed.") from exc

    def _get_object_bytes(self, key: str, not_found_detail: str) -> bytes:
        return self._get_object(key, not_found_detail)["Body"].read()

    def _get_object(self, key: str, not_found_detail: str) -> Any:
        try:
            return self.client.get_object(Bucket=self.config.bucket, Key=key)
        except Exception as exc:
            if is_missing_object_error(exc):
                raise HTTPException(status_code=404, detail=not_found_detail) from exc
            raise HTTPException(status_code=502, detail="Asset storage read failed.") from exc

    def _asset_key(self, workspace_id: str, asset_id: str, file_name: str) -> str:
        return f"workspaces/{workspace_id}/assets/{asset_id}/{file_name}"


def create_s3_asset_store() -> S3AssetStore:
    config = S3AssetStorageConfig.from_env()
    return S3AssetStore(config=config, client=create_s3_client(config))
