from typing import Optional

from fastapi import APIRouter, Depends, Form, UploadFile
from fastapi.responses import FileResponse
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import AssetDataUrlRequest, AssetResponse
from tangent_api.storage.local_asset_store import (
    create_asset_from_data_url as create_local_asset_from_data_url,
)
from tangent_api.storage.local_asset_store import (
    create_asset_from_upload as create_local_asset_from_upload,
)
from tangent_api.storage.local_asset_store import get_asset_file_path, get_asset_record

router = APIRouter(prefix="/api/v1/assets", tags=["assets"])


@router.post("/from-data-url", response_model=AssetResponse)
def create_asset_from_data_url(
    payload: AssetDataUrlRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AssetResponse:
    return AssetResponse(asset=create_local_asset_from_data_url(payload, context))


@router.post("/upload", response_model=AssetResponse)
async def upload_asset(
    file: UploadFile,
    height: int = Form(default=0),
    origin: str = Form(default="upload"),
    title: Optional[str] = Form(default=None),
    width: int = Form(default=0),
    context: ApiRequestContext = Depends(get_request_context),
) -> AssetResponse:
    asset = await create_local_asset_from_upload(file, context, origin, title, width, height)
    return AssetResponse(asset=asset)


@router.get("/files/{asset_id}/{file_name}")
def read_asset_file(
    asset_id: str,
    file_name: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> FileResponse:
    path = get_asset_file_path(asset_id, file_name, context)
    return FileResponse(path)


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> AssetResponse:
    return AssetResponse(asset=get_asset_record(asset_id, context))
