from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.admin import require_admin
from app.core.database import get_db
from app.models.credit import ApiCallLog, ModelConfig
from app.models.user import User
from app.schemas.admin_diagnostics import (
    AdminTestRequest,
    ApiLogDetailOut,
    ModelDetailOut,
    ProviderHealthOut,
    TestResultOut,
)
from app.schemas.credit import ApiCallLogOut, ModelConfigOut
from app.schemas.provider import ProviderOut
from app.services.admin.diagnostics import (
    get_model_or_none,
    get_provider_or_none,
    model_usage,
    pick_provider_test_model,
    run_model_test,
)
from app.services.proxy.provider import get_env_key

router = APIRouter()


@router.get("/api-logs/{log_id}", response_model=ApiLogDetailOut)
async def get_api_log_detail(
    log_id: UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ApiCallLog, User.email, User.display_name)
        .join(User, User.id == ApiCallLog.user_id)
        .where(ApiCallLog.id == log_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="API log not found")
    log, email, display_name = row
    return ApiLogDetailOut(
        log=ApiCallLogOut.model_validate(log),
        user_email=email,
        user_display_name=display_name,
        created_at=log.created_at,
    )


@router.get("/models/{model_id}", response_model=ModelDetailOut)
async def get_model_detail(
    model_id: UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    model = await get_model_or_none(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    recent_logs = (
        await db.execute(
            select(ApiCallLog)
            .where(ApiCallLog.provider == model.provider, ApiCallLog.model == model.model)
            .order_by(desc(ApiCallLog.created_at))
            .limit(10)
        )
    ).scalars().all()
    return ModelDetailOut(
        model=ModelConfigOut.model_validate(model),
        usage=await model_usage(db, model.provider, model.model),
        recent_logs=[ApiCallLogOut.model_validate(row) for row in recent_logs],
    )


@router.post("/models/{model_id}/test", response_model=TestResultOut)
async def test_model(
    model_id: UUID,
    req: AdminTestRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    model = await get_model_or_none(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    provider = await get_provider_or_none(db, model.provider)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return await run_model_test(
        db, admin, provider, model, req.execute, req.extra_payload, req.timeout_seconds
    )


@router.post("/models/{model_id}/set-default", response_model=ModelConfigOut)
async def set_default_model(
    model_id: UUID,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    model = await get_model_or_none(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    rows = (
        await db.execute(
            select(ModelConfig).where(
                ModelConfig.call_type.in_(_default_call_types(model.call_type))
            )
        )
    ).scalars().all()
    for row in rows:
        row.is_default = row.id == model.id
    await db.commit()
    await db.refresh(model)
    return ModelConfigOut.model_validate(model)


@router.get("/providers/{provider_id}/health", response_model=ProviderHealthOut)
async def provider_health(
    provider_id: str,
    _admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    provider = await get_provider_or_none(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    issues = []
    if not provider.is_active:
        issues.append("provider_inactive")
    if not provider.base_url:
        issues.append("missing_base_url")
    key_configured = bool(get_env_key(provider.key_env))
    if not key_configured:
        issues.append("missing_api_key")
    return ProviderHealthOut(
        provider=ProviderOut.model_validate(provider),
        key_configured=key_configured,
        key_env=provider.key_env,
        base_url=provider.base_url,
        is_active=provider.is_active,
        ready=not issues,
        issues=issues,
    )


def _default_call_types(call_type: str) -> list[str]:
    if call_type == "chat":
        return ["chat"]
    if call_type in {"image", "image_chat"}:
        return ["image", "image_chat"]
    if call_type == "image_edit":
        return ["image_edit"]
    if call_type == "image_enhance":
        return ["image_enhance"]
    return [call_type]


@router.post("/providers/{provider_id}/test", response_model=TestResultOut)
async def test_provider(
    provider_id: str,
    req: AdminTestRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    provider = await get_provider_or_none(db, provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    model = await pick_provider_test_model(db, provider_id, req.model_id)
    if not model:
        raise HTTPException(status_code=404, detail="No active test model found")
    return await run_model_test(
        db, admin, provider, model, req.execute, req.extra_payload, req.timeout_seconds
    )
