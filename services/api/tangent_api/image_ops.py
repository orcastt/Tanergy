from fastapi import HTTPException

from tangent_api.image_dimensions import get_image_dimensions
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AssetRecord
from tangent_api.storage.asset_storage_adapter import AssetStorageAdapter
from tangent_api.storage.asset_store_common import assert_image_content_matches_mime, assert_image_mime

MAX_IMAGE_OP_INPUT_BYTES = 30 * 1024 * 1024
MAX_IMAGE_OP_PIXELS = 24_000_000


def remove_background_from_asset(
    asset_id: str,
    storage: AssetStorageAdapter,
    context: ApiRequestContext,
) -> AssetRecord:
    source = storage.get_record(asset_id, context)
    _assert_image_op_asset_budget(source)
    content, mime = _read_original_asset_bytes(source, storage, context)
    output = _run_rembg(content)
    width, height = get_image_dimensions(output, "image/png")
    _assert_image_op_dimensions(width or source.width, height or source.height)
    return storage.create_from_bytes(
        output,
        "image/png",
        context,
        "background_removal",
        "Background removed",
        width or source.width,
        height or source.height,
    )


def object_cutout_not_ready() -> None:
    raise HTTPException(
        status_code=501,
        detail="Object Cutout is reserved for the Segment Anything point/box flow and is not enabled yet.",
    )


def _read_original_asset_bytes(
    asset: AssetRecord,
    storage: AssetStorageAdapter,
    context: ApiRequestContext,
) -> tuple[bytes, str]:
    assert_image_mime(asset.mime)
    file_name = asset.original_url.rsplit("/", 1)[-1]
    content = storage.get_file_bytes(asset.id, file_name, context)
    assert_image_content_matches_mime(content, asset.mime)
    if len(content) > MAX_IMAGE_OP_INPUT_BYTES:
        raise HTTPException(status_code=413, detail="Image operation input must be 30MB or smaller.")
    if asset.width <= 0 or asset.height <= 0:
        width, height = get_image_dimensions(content, asset.mime)
        _assert_image_op_dimensions(width, height)
    return content, asset.mime


def _run_rembg(content: bytes) -> bytes:
    try:
        from rembg import remove
    except ImportError as exc:
        raise HTTPException(
            status_code=501,
            detail="Remove BG requires the optional rembg dependency. Install services/api[image-ops].",
        ) from exc
    result = remove(content)
    if not isinstance(result, bytes):
        raise HTTPException(status_code=500, detail="Remove BG returned an unsupported image payload.")
    return result


def _assert_image_op_asset_budget(asset: AssetRecord) -> None:
    assert_image_mime(asset.mime)
    if asset.byte_size > MAX_IMAGE_OP_INPUT_BYTES:
        raise HTTPException(status_code=413, detail="Image operation input must be 30MB or smaller.")
    _assert_image_op_dimensions(asset.width, asset.height)


def _assert_image_op_dimensions(width: int, height: int) -> None:
    if width <= 0 or height <= 0:
        raise HTTPException(status_code=422, detail="Image dimensions are required before running image operations.")
    if width * height > MAX_IMAGE_OP_PIXELS:
        raise HTTPException(status_code=413, detail="Image operation input must be 24MP or smaller.")
