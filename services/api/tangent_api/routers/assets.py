from fastapi import APIRouter, Depends, HTTPException, UploadFile

from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import AssetDataUrlRequest

router = APIRouter(prefix="/api/v1/assets", tags=["assets"])


@router.post("/from-data-url")
def create_asset_from_data_url(
    payload: AssetDataUrlRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> None:
    _ = (payload, context)
    raise HTTPException(status_code=501, detail="Asset storage adapter is not implemented yet.")


@router.post("/upload")
def upload_asset(
    file: UploadFile,
    context: ApiRequestContext = Depends(get_request_context),
) -> None:
    _ = (file, context)
    raise HTTPException(status_code=501, detail="Asset storage adapter is not implemented yet.")


@router.get("/{asset_id}")
def get_asset(
    asset_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> None:
    _ = (asset_id, context)
    raise HTTPException(status_code=501, detail="Asset storage adapter is not implemented yet.")
