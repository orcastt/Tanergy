from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.credit import ChatProxyRequest, ChatProxyResponse
from app.services.proxy_service import proxy_chat_completion, proxy_image_generation

router = APIRouter()


@router.post("/chat", response_model=ChatProxyResponse)
async def chat_proxy(
    req: ChatProxyRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await proxy_chat_completion(
        db=db,
        user_id=user.id,
        provider=req.provider,
        model=req.model,
        messages=req.messages,
        max_tokens=req.max_tokens,
        temperature=req.temperature,
    )
    return ChatProxyResponse(**result)


@router.post("/image")
async def image_proxy(
    req: dict,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from fastapi.responses import Response

    image_bytes = await proxy_image_generation(
        db=db,
        user_id=user.id,
        provider=req.get("provider", "minimax"),
        prompt=req.get("prompt", ""),
        aspect_ratio=req.get("aspect_ratio"),
    )
    return Response(content=image_bytes, media_type="image/png")
