from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.credit import CreditBalance, CreditTransaction, ApiCallLog, ModelConfig
from app.models.provider import Provider
from app.models.user import User
from app.schemas.credit import (
    AdminUserOut,
    ApiCallLogOut,
    BalanceOut,
    CreditGrantRequest,
    ModelConfigCreate,
    ModelConfigOut,
    TransactionOut,
)
from app.schemas.provider import ProviderCreate, ProviderOut, ProviderUpdate

router = APIRouter()


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# ── Dashboard stats ──

@router.get("/stats")
async def get_stats(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    total_users = (await db.execute(select(func.count(User.id)))).scalar() or 0
    active_users = (await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )).scalar() or 0
    total_credits = (await db.execute(
        select(func.sum(CreditBalance.balance))
    )).scalar() or 0
    total_calls = (await db.execute(
        select(func.count(ApiCallLog.id))
    )).scalar() or 0
    today_calls = (await db.execute(
        select(func.count(ApiCallLog.id)).where(
            ApiCallLog.created_at >= datetime.now(timezone.utc).replace(hour=0, minute=0, second=0)
        )
    )).scalar() or 0

    # By provider distribution
    _by_provider = [
        {"provider": r[0], "count": r[1]}
        for r in (await db.execute(
            select(ApiCallLog.provider, func.count(ApiCallLog.id))
            .group_by(ApiCallLog.provider)
            .order_by(desc(func.count(ApiCallLog.id)))
        )).all()
    ]

    # By model top 10
    _by_model = [
        {"model": r[0], "count": r[1]}
        for r in (await db.execute(
            select(ApiCallLog.model, func.count(ApiCallLog.id))
            .group_by(ApiCallLog.model)
            .order_by(desc(func.count(ApiCallLog.id)))
            .limit(10)
        )).all()
    ]

    # Daily trends last 7 days
    from sqlalchemy import cast, Date
    _daily = [
        {"date": r[0].isoformat() if r[0] else "", "calls": r[1]}
        for r in (await db.execute(
            select(cast(ApiCallLog.created_at, Date), func.count(ApiCallLog.id))
            .group_by(cast(ApiCallLog.created_at, Date))
            .order_by(desc(cast(ApiCallLog.created_at, Date)))
            .limit(7)
        )).all()
    ]

    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_credits_outstanding": total_credits,
        "total_api_calls": total_calls,
        "today_api_calls": today_calls,
        "by_provider": _by_provider,
        "by_model": _by_model,
        "daily_trends": _daily,
    }


# ── User management ──

@router.get("/users", response_model=list[AdminUserOut])
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(User, CreditBalance.balance, CreditBalance.plan)
        .outerjoin(CreditBalance, CreditBalance.user_id == User.id)
        .order_by(desc(User.created_at))
        .offset(skip)
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    results = []
    for user, balance, plan in rows:
        out = AdminUserOut(
            id=user.id,
            email=user.email,
            display_name=user.display_name,
            role=user.role,
            is_active=user.is_active,
            balance=balance or 0,
            plan=plan or "free",
            created_at=user.created_at,
            last_login_at=user.last_login_at,
        )
        results.append(out)
    return results


@router.post("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = not user.is_active
    await db.commit()
    return {"is_active": user.is_active}


# ── Credit management ──

@router.post("/credits/grant")
async def grant_credits(
    req: CreditGrantRequest,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    from app.services.proxy_service import grant_credits as do_grant
    balance = await do_grant(db, req.user_id, req.amount, req.reason, req.description)
    return BalanceOut.model_validate(balance)


@router.get("/credits/transactions", response_model=list[TransactionOut])
async def list_transactions(
    user_id: UUID | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(CreditTransaction).order_by(desc(CreditTransaction.created_at))
    if user_id:
        stmt = stmt.where(CreditTransaction.user_id == user_id)
    stmt = stmt.offset(skip).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return [TransactionOut.model_validate(r) for r in rows]


# ── API call logs ──

@router.get("/api-logs", response_model=list[ApiCallLogOut])
async def list_api_logs(
    user_id: UUID | None = None,
    provider: str | None = None,
    status: str | None = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(ApiCallLog).order_by(desc(ApiCallLog.created_at))
    if user_id:
        stmt = stmt.where(ApiCallLog.user_id == user_id)
    if provider:
        stmt = stmt.where(ApiCallLog.provider == provider)
    if status:
        stmt = stmt.where(ApiCallLog.status == status)
    stmt = stmt.offset(skip).limit(limit)
    rows = (await db.execute(stmt)).scalars().all()
    return [ApiCallLogOut.model_validate(r) for r in rows]


# ── Model config ──

@router.get("/models", response_model=list[ModelConfigOut])
async def list_models(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(
        select(ModelConfig).order_by(ModelConfig.sort_order)
    )).scalars().all()
    return [ModelConfigOut.model_validate(r) for r in rows]


@router.post("/models", response_model=ModelConfigOut)
async def create_model(
    req: ModelConfigCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    model = ModelConfig(**req.model_dump())
    db.add(model)
    await db.commit()
    await db.refresh(model)
    return ModelConfigOut.model_validate(model)


@router.patch("/models/{model_id}")
async def update_model(
    model_id: UUID,
    updates: dict,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    for k, v in updates.items():
        if hasattr(model, k):
            setattr(model, k, v)
    await db.commit()
    return ModelConfigOut.model_validate(model)


@router.delete("/models/{model_id}")
async def delete_model(
    model_id: UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))
    model = result.scalar_one_or_none()
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    await db.delete(model)
    await db.commit()
    return {"deleted": True}


# ── Provider management ──

@router.get("/providers", response_model=list[ProviderOut])
async def list_providers(
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    rows = (await db.execute(select(Provider).order_by(Provider.id))).scalars().all()
    return [ProviderOut.model_validate(r) for r in rows]


@router.post("/providers", response_model=ProviderOut)
async def create_provider(
    req: ProviderCreate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    provider = Provider(**req.model_dump())
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return ProviderOut.model_validate(provider)


@router.patch("/providers/{provider_id}", response_model=ProviderOut)
async def update_provider(
    provider_id: str,
    updates: ProviderUpdate,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Provider).where(Provider.id == provider_id))
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    for k, v in updates.model_dump(exclude_unset=True).items():
        if hasattr(provider, k):
            setattr(provider, k, v)
    await db.commit()
    await db.refresh(provider)
    return ProviderOut.model_validate(provider)


@router.delete("/providers/{provider_id}")
async def delete_provider(
    provider_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Provider).where(Provider.id == provider_id))
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    await db.delete(provider)
    await db.commit()
    return {"deleted": True}
