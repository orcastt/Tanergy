from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.credit import (
    ChatProxyRequest,
    ChatProxyResponse,
    ImageEditProxyRequest,
    ImageEnhanceProxyRequest,
    ImageProxyRequest,
)
from app.services.proxy_service import (
    proxy_chat_completion,
    proxy_image_edit,
    proxy_image_enhance,
    proxy_image_generation,
    proxy_image_result,
)

router = APIRouter()


def _proxy_http_error(error: ValueError) -> HTTPException:
    detail = str(error)
    if "INSUFFICIENT_CREDITS" in detail:
        return HTTPException(status_code=402, detail="INSUFFICIENT_CREDITS")
    if detail.startswith("MODEL_NOT_ENABLED"):
        return HTTPException(status_code=400, detail=detail)
    if detail.startswith("Unknown provider"):
        return HTTPException(status_code=400, detail=detail)
    if detail.startswith("No API key configured"):
        return HTTPException(status_code=503, detail=detail)
    return HTTPException(status_code=502, detail=detail)


@router.post("/chat", response_model=ChatProxyResponse)
async def chat_proxy(
    req: ChatProxyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        result = await proxy_chat_completion(
            db=db,
            user_id=user.id,
            provider=req.provider,
            model=req.model,
            messages=req.messages,
            max_tokens=req.max_tokens,
            temperature=req.temperature,
        )
    except ValueError as error:
        raise _proxy_http_error(error) from error
    return ChatProxyResponse(**result)


@router.post("/image")
async def image_proxy(
    req: ImageProxyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import Response

    try:
        image_bytes = await proxy_image_generation(
            db=db,
            user_id=user.id,
            provider=req.provider,
            model=req.model,
            prompt=req.prompt,
            aspect_ratio=req.aspect_ratio,
            negative_prompt=req.negative_prompt,
            image=req.image,
            strength=req.strength,
            size=req.size,
            quality=req.quality,
            style_preset=req.style_preset,
            mask=req.mask,
            watermark=req.watermark,
            background=req.background,
            extra_body=req.extra_body,
            async_mode=req.async_mode,
            retries=req.retries,
        )
    except ValueError as error:
        raise _proxy_http_error(error) from error
    return Response(content=image_bytes, media_type="image/png")


@router.post("/image/edit")
async def image_edit_proxy(
    req: ImageEditProxyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import Response

    try:
        image_bytes = await proxy_image_edit(
            db=db,
            user_id=user.id,
            provider=req.provider,
            model=req.model,
            prompt=req.prompt,
            image=req.image,
            aspect_ratio=req.aspect_ratio,
            background=req.background,
            mask=req.mask,
            size=req.size,
            n=req.n,
            quality=req.quality,
            response_format=req.response_format,
            output_format=req.output_format,
            retries=req.retries,
        )
    except ValueError as error:
        raise _proxy_http_error(error) from error
    return Response(content=image_bytes, media_type="image/png")


@router.get("/image/{task_id}")
async def image_result_proxy(
    task_id: str,
    provider: str = "geekai",
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        return await proxy_image_result(
            db=db,
            user_id=user.id,
            provider=provider,
            task_id=task_id,
        )
    except ValueError as error:
        raise _proxy_http_error(error) from error


@router.post("/image/enhance")
async def image_enhance_proxy(
    req: ImageEnhanceProxyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import Response

    try:
        image_bytes = await proxy_image_enhance(
            db=db,
            user_id=user.id,
            provider=req.provider,
            model=req.model,
            image=req.image,
            size=req.size,
            response_format=req.response_format,
            output_format=req.output_format,
            extra_body=req.extra_body,
            retries=req.retries,
        )
    except ValueError as error:
        raise _proxy_http_error(error) from error
    return Response(content=image_bytes, media_type="image/png")
