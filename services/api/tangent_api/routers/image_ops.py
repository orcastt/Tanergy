from fastapi import APIRouter, Depends, Request

from tangent_api.image_ops import object_cutout_not_ready, remove_background_from_asset
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.security_business_limits import assert_daily_business_limit
from tangent_api.security_idempotency import run_idempotent
from tangent_api.schemas import ImageOpAssetRequest, ImageOpResponse
from tangent_api.storage.asset_storage_adapter import get_asset_storage_adapter

router = APIRouter(prefix="/api/v1/image-ops", tags=["image-ops"])


@router.post("/remove-background", response_model=ImageOpResponse)
def remove_background(
    payload: ImageOpAssetRequest,
    request: Request,
    context: ApiRequestContext = Depends(get_request_context),
) -> ImageOpResponse:
    return run_idempotent(
        request,
        context,
        action="image.remove_background",
        fingerprint_payload=payload,
        produce=lambda: _remove_background_with_quota(payload, context),
    )


@router.post("/object-cutout", response_model=ImageOpResponse)
def object_cutout(
    payload: ImageOpAssetRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> ImageOpResponse:
    _ = payload, context
    object_cutout_not_ready()
    return ImageOpResponse(ok=False)


def _remove_background_with_quota(payload: ImageOpAssetRequest, context: ApiRequestContext) -> ImageOpResponse:
    assert_daily_business_limit(
        context,
        action="image.remove_background",
        default_limit=100,
        env_name="TANGENT_REMOVE_BG_DAILY_LIMIT",
    )
    asset = remove_background_from_asset(payload.asset_id, get_asset_storage_adapter(), context)
    return ImageOpResponse(asset=asset, ok=True)
