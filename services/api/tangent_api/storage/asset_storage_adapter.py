import os
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetDataUrlRequest, AssetRecord
from tangent_api.storage.local_asset_store import (
    create_asset_from_data_url as create_local_asset_from_data_url,
)
from tangent_api.storage.local_asset_store import (
    create_asset_from_upload as create_local_asset_from_upload,
)
from tangent_api.storage.local_asset_store import get_asset_file_path, get_asset_record

S3_COMPATIBLE_REQUIRED_ENV = (
    "S3_ENDPOINT",
    "S3_BUCKET",
    "S3_ACCESS_KEY_ID",
    "S3_SECRET_ACCESS_KEY",
    "S3_PUBLIC_BASE_URL",
)


class AssetStorageAdapter:
    def create_from_data_url(
        self,
        input_data: AssetDataUrlRequest,
        context: ApiRequestContext,
    ) -> AssetRecord:
        raise NotImplementedError

    async def create_from_upload(
        self,
        file: UploadFile,
        context: ApiRequestContext,
        origin: str,
        title: Optional[str],
        width: int,
        height: int,
    ) -> AssetRecord:
        raise NotImplementedError

    def get_record(self, asset_id: str, context: ApiRequestContext) -> AssetRecord:
        raise NotImplementedError

    def get_file_path(self, asset_id: str, file_name: str, context: ApiRequestContext) -> Path:
        raise NotImplementedError


class LocalAssetStorageAdapter(AssetStorageAdapter):
    def create_from_data_url(
        self,
        input_data: AssetDataUrlRequest,
        context: ApiRequestContext,
    ) -> AssetRecord:
        return create_local_asset_from_data_url(input_data, context)

    async def create_from_upload(
        self,
        file: UploadFile,
        context: ApiRequestContext,
        origin: str,
        title: Optional[str],
        width: int,
        height: int,
    ) -> AssetRecord:
        return await create_local_asset_from_upload(file, context, origin, title, width, height)

    def get_record(self, asset_id: str, context: ApiRequestContext) -> AssetRecord:
        return get_asset_record(asset_id, context)

    def get_file_path(self, asset_id: str, file_name: str, context: ApiRequestContext) -> Path:
        return get_asset_file_path(asset_id, file_name, context)


class S3CompatibleAssetStorageAdapter(AssetStorageAdapter):
    def __init__(self) -> None:
        missing = [name for name in S3_COMPATIBLE_REQUIRED_ENV if not os.getenv(name)]
        missing_note = f" Missing config: {', '.join(missing)}." if missing else ""
        self.detail = (
            "S3-compatible asset storage driver is configured, but the upload/read adapter is "
            f"not implemented yet.{missing_note}"
        )

    def create_from_data_url(
        self,
        input_data: AssetDataUrlRequest,
        context: ApiRequestContext,
    ) -> AssetRecord:
        _ = (input_data, context)
        self._raise_not_implemented()

    async def create_from_upload(
        self,
        file: UploadFile,
        context: ApiRequestContext,
        origin: str,
        title: Optional[str],
        width: int,
        height: int,
    ) -> AssetRecord:
        _ = (file, context, origin, title, width, height)
        self._raise_not_implemented()

    def get_record(self, asset_id: str, context: ApiRequestContext) -> AssetRecord:
        _ = (asset_id, context)
        self._raise_not_implemented()

    def get_file_path(self, asset_id: str, file_name: str, context: ApiRequestContext) -> Path:
        _ = (asset_id, file_name, context)
        self._raise_not_implemented()

    def _raise_not_implemented(self) -> None:
        raise HTTPException(status_code=501, detail=self.detail)


def get_asset_storage_adapter() -> AssetStorageAdapter:
    driver = os.getenv("TANGENT_ASSET_STORAGE_DRIVER", "local-dev")
    if driver == "local-dev":
        return LocalAssetStorageAdapter()
    if driver == "s3-compatible":
        return S3CompatibleAssetStorageAdapter()
    raise HTTPException(
        status_code=501,
        detail=f'Unsupported asset storage driver "{driver}". Supported drivers: local-dev, s3-compatible.',
    )
