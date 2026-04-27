from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.credit import ModelConfig
from app.models.user import User
from app.schemas.credit import ModelConfigOut

router = APIRouter()


@router.get("", response_model=list[ModelConfigOut])
async def list_active_models(
    _user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(ModelConfig)
        .where(ModelConfig.is_active == True)
        .order_by(ModelConfig.sort_order)
    )).scalars().all()
    return [ModelConfigOut.model_validate(row) for row in rows]
