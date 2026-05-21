from typing import Optional

from fastapi import APIRouter, Depends, Form, UploadFile
from fastapi.responses import Response
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.remote_image_import import fetch_remote_image
from tangent_api.schemas import AssetDataUrlRequest, AssetFromUrlRequest, AssetResponse
from tangent_api.security_business_limits import assert_daily_business_limit
from tangent_api.storage.asset_storage_adapter import get_asset_storage_adapter

router = APIRouter(prefix="/api/v1/assets", tags=["assets"])


@router.post("/from-data-url", response_model=AssetResponse)
def create_asset_from_data_url(
    payload: AssetDataUrlRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AssetResponse:
    assert_daily_business_limit(
        context,
        action="asset.create",
        default_limit=500,
        env_name="TANGENT_ASSET_CREATE_DAILY_LIMIT",
    )
    return AssetResponse(asset=get_asset_storage_adapter().create_from_data_url(payload, context))


@router.post("/from-url", response_model=AssetResponse)
def create_asset_from_url(
    payload: AssetFromUrlRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AssetResponse:
    assert_daily_business_limit(
        context,
        action="asset.create",
        default_limit=500,
        env_name="TANGENT_ASSET_CREATE_DAILY_LIMIT",
    )
    remote = fetch_remote_image(payload.url)
    asset = get_asset_storage_adapter().create_from_bytes(
        remote.content,
        remote.mime,
        context,
        payload.origin or "remote_import",
        payload.title or "Image",
        remote.width,
        remote.height,
    )
    return AssetResponse(asset=asset)


@router.post("/upload", response_model=AssetResponse)
async def upload_asset(
    file: UploadFile,
    height: int = Form(default=0),
    origin: str = Form(default="upload"),
    title: Optional[str] = Form(default=None),
    width: int = Form(default=0),
    context: ApiRequestContext = Depends(get_request_context),
) -> AssetResponse:
    assert_daily_business_limit(
        context,
        action="asset.upload",
        default_limit=500,
        env_name="TANGENT_ASSET_UPLOAD_DAILY_LIMIT",
    )
    asset = await get_asset_storage_adapter().create_from_upload(file, context, origin, title, width, height)
    return AssetResponse(asset=asset)


@router.get("/files/{asset_id}/{file_name}")
def read_asset_file(
    asset_id: str,
    file_name: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> Response:
    return get_asset_storage_adapter().get_file_response(asset_id, file_name, context)


@router.get("/{asset_id}", response_model=AssetResponse)
def get_asset(
    asset_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> AssetResponse:
    return AssetResponse(asset=get_asset_storage_adapter().get_record(asset_id, context))
