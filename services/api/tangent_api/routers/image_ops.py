from fastapi import APIRouter, Depends

from tangent_api.image_ops import object_cutout_not_ready, remove_background_from_asset
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import ImageOpAssetRequest, ImageOpResponse
from tangent_api.storage.asset_storage_adapter import get_asset_storage_adapter

router = APIRouter(prefix="/api/v1/image-ops", tags=["image-ops"])


@router.post("/remove-background", response_model=ImageOpResponse)
def remove_background(
    payload: ImageOpAssetRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> ImageOpResponse:
    asset = remove_background_from_asset(payload.asset_id, get_asset_storage_adapter(), context)
    return ImageOpResponse(asset=asset, ok=True)


@router.post("/object-cutout", response_model=ImageOpResponse)
def object_cutout(
    payload: ImageOpAssetRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> ImageOpResponse:
    _ = payload, context
    object_cutout_not_ready()
    return ImageOpResponse(ok=False)
