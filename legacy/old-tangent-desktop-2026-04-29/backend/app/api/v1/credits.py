from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.credit import CreditBalance
from app.models.user import User
from app.schemas.credit import BalanceOut

router = APIRouter()


@router.get("/balance", response_model=BalanceOut)
async def get_balance(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(CreditBalance).where(CreditBalance.user_id == user.id)
    )
    balance = result.scalar_one_or_none()

    if balance is None:
        balance = CreditBalance(user_id=user.id, balance=0, plan="free")
        db.add(balance)
        await db.commit()
        await db.refresh(balance)

    return BalanceOut.model_validate(balance)
