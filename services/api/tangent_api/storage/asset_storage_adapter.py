import os
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetDataUrlRequest, AssetRecord
from tangent_api.storage.asset_store_common import ASSET_FILE_SECURITY_HEADERS
from tangent_api.storage.local_asset_store import (
    create_asset_from_data_url as create_local_asset_from_data_url,
)
from tangent_api.storage.local_asset_store import (
    create_asset_from_upload as create_local_asset_from_upload,
)
from tangent_api.storage.local_asset_store import create_asset_from_bytes as create_local_asset_from_bytes
from tangent_api.storage.local_asset_store import get_asset_file_path, get_asset_record
from tangent_api.storage.s3_asset_store import create_s3_asset_store


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

    def create_from_bytes(
        self,
        content: bytes,
        mime: str,
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

    def get_file_bytes(self, asset_id: str, file_name: str, context: ApiRequestContext) -> bytes:
        return self.get_file_path(asset_id, file_name, context).read_bytes()

    def get_file_response(
        self,
        asset_id: str,
        file_name: str,
        context: ApiRequestContext,
    ) -> Response:
        return FileResponse(self.get_file_path(asset_id, file_name, context), headers=ASSET_FILE_SECURITY_HEADERS)


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

    def create_from_bytes(
        self,
        content: bytes,
        mime: str,
        context: ApiRequestContext,
        origin: str,
        title: Optional[str],
        width: int,
        height: int,
    ) -> AssetRecord:
        return create_local_asset_from_bytes(content, mime, context, origin, title, width, height)

    def get_record(self, asset_id: str, context: ApiRequestContext) -> AssetRecord:
        return get_asset_record(asset_id, context)

    def get_file_path(self, asset_id: str, file_name: str, context: ApiRequestContext) -> Path:
        return get_asset_file_path(asset_id, file_name, context)


class S3CompatibleAssetStorageAdapter(AssetStorageAdapter):
    def __init__(self) -> None:
        self.store = create_s3_asset_store()

    def create_from_data_url(
        self,
        input_data: AssetDataUrlRequest,
        context: ApiRequestContext,
    ) -> AssetRecord:
        return self.store.create_asset_from_data_url(input_data, context)

    async def create_from_upload(
        self,
        file: UploadFile,
        context: ApiRequestContext,
        origin: str,
        title: Optional[str],
        width: int,
        height: int,
    ) -> AssetRecord:
        return await self.store.create_asset_from_upload(file, context, origin, title, width, height)

    def create_from_bytes(
        self,
        content: bytes,
        mime: str,
        context: ApiRequestContext,
        origin: str,
        title: Optional[str],
        width: int,
        height: int,
    ) -> AssetRecord:
        return self.store.create_asset_from_bytes(content, mime, context, origin, title, width, height)

    def get_record(self, asset_id: str, context: ApiRequestContext) -> AssetRecord:
        return self.store.get_asset_record(asset_id, context)

    def get_file_bytes(self, asset_id: str, file_name: str, context: ApiRequestContext) -> bytes:
        return self.store.get_file_bytes(asset_id, file_name, context)

    def get_file_response(
        self,
        asset_id: str,
        file_name: str,
        context: ApiRequestContext,
    ) -> Response:
        return self.store.get_file_response(asset_id, file_name, context)


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
