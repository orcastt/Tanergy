import time
from uuid import UUID

import httpx
from sqlalchemy import case, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credit import ApiCallLog, ModelConfig
from app.models.provider import Provider
from app.models.user import User
from app.schemas.admin_diagnostics import ModelUsageOut, TestResultOut
from app.services.proxy.credits import log_api_call
from app.services.proxy.provider import auth_headers, get_env_key


def endpoint_for_model(model: ModelConfig) -> str | None:
    endpoint_type = model.endpoint_type or model.call_type
    return {
        "chat_completions": "/chat/completions",
        "images_generations": "/images/generations",
        "images_edits": "/images/edits",
        "images_enhance": "/images/enhance",
        "chat": "/chat/completions",
        "image": "/images/generations",
        "image_chat": "/chat/completions",
        "image_edit": "/images/edits",
        "image_enhance": "/images/enhance",
    }.get(endpoint_type)


async def get_provider_or_none(db: AsyncSession, provider_id: str) -> Provider | None:
    return (await db.execute(select(Provider).where(Provider.id == provider_id))).scalar_one_or_none()


async def get_model_or_none(db: AsyncSession, model_id: UUID) -> ModelConfig | None:
    return (await db.execute(select(ModelConfig).where(ModelConfig.id == model_id))).scalar_one_or_none()


async def pick_provider_test_model(db: AsyncSession, provider_id: str, model_id: UUID | None) -> ModelConfig | None:
    if model_id:
        model = await get_model_or_none(db, model_id)
        if model and model.provider == provider_id:
            return model
        return None
    return (
        await db.execute(
            select(ModelConfig)
            .where(ModelConfig.provider == provider_id, ModelConfig.is_active == True)
            .order_by(desc(ModelConfig.is_default), ModelConfig.fallback_priority, ModelConfig.sort_order)
        )
    ).scalars().first()


async def model_usage(db: AsyncSession, provider: str, model: str) -> ModelUsageOut:
    row = (
        await db.execute(
            select(
                func.count(ApiCallLog.id),
                func.sum(case((ApiCallLog.status == "success", 1), else_=0)),
                func.sum(case((ApiCallLog.status == "error", 1), else_=0)),
                func.coalesce(func.sum(ApiCallLog.credits_used), 0),
                func.coalesce(func.avg(ApiCallLog.latency_ms), 0),
            ).where(ApiCallLog.provider == provider, ApiCallLog.model == model)
        )
    ).one()
    total = int(row[0] or 0)
    success = int(row[1] or 0)
    error = int(row[2] or 0)
    return ModelUsageOut(
        total_calls=total,
        success_calls=success,
        error_calls=error,
        total_credits=int(row[3] or 0),
        avg_latency_ms=int(row[4] or 0),
        success_rate=round(success / total, 4) if total else 0,
    )


async def run_model_test(
    db: AsyncSession,
    admin: User,
    provider: Provider,
    model: ModelConfig,
    execute: bool,
    extra_payload: dict,
    timeout_seconds: int,
) -> TestResultOut:
    endpoint = endpoint_for_model(model)
    payload = {**(model.smoke_test_payload or {}), **extra_payload}
    request_params = safe_payload_summary(payload)
    if not endpoint:
        return TestResultOut(
            provider=provider.id, model=model.model, endpoint=None, execute=execute,
            ok=False, request_params=request_params, error_message="Model endpoint_type is not configured",
        )

    if not execute:
        return TestResultOut(
            provider=provider.id, model=model.model, endpoint=endpoint, execute=False,
            ok=True, request_params=request_params,
            response_meta={"mode": "dry_run", "key_configured": bool(get_env_key(provider.key_env))},
        )

    api_key = get_env_key(provider.key_env)
    if not api_key:
        return TestResultOut(
            provider=provider.id, model=model.model, endpoint=endpoint, execute=True,
            ok=False, request_params=request_params, error_code="missing_api_key",
            error_message=f"No API key configured for {provider.key_env}",
        )

    start = time.time()
    status_code: int | None = None
    try:
        async with httpx.AsyncClient(timeout=timeout_seconds) as client:
            resp = await client.post(
                f"{provider.base_url.rstrip('/')}{endpoint}",
                json=payload,
                headers=auth_headers(_provider_config(provider), api_key),
            )
        status_code = resp.status_code
        latency_ms = int((time.time() - start) * 1000)
        response_meta = response_summary(resp)
        ok = 200 <= resp.status_code < 300
        error_message = None if ok else resp.text[:500]
        log = await log_api_call(
            db, admin.id, provider.id, model.model, model.call_type,
            credits_used=0, latency_ms=latency_ms, status="success" if ok else "error",
            error_message=error_message, endpoint=endpoint, request_params=request_params,
            response_meta=response_meta, upstream_task_id=_task_id(response_meta),
            error_code=None if ok else str(resp.status_code), route_provider=provider.id,
        )
        return TestResultOut(
            provider=provider.id, model=model.model, endpoint=endpoint, execute=True, ok=ok,
            latency_ms=latency_ms, status_code=resp.status_code, request_params=request_params,
            response_meta=response_meta, error_code=None if ok else str(resp.status_code),
            error_message=error_message, api_log_id=log.id,
        )
    except Exception as error:
        latency_ms = int((time.time() - start) * 1000)
        log = await log_api_call(
            db, admin.id, provider.id, model.model, model.call_type,
            credits_used=0, latency_ms=latency_ms, status="error", error_message=str(error),
            endpoint=endpoint, request_params=request_params,
            error_code=str(status_code) if status_code else "request_failed", route_provider=provider.id,
        )
        return TestResultOut(
            provider=provider.id, model=model.model, endpoint=endpoint, execute=True, ok=False,
            latency_ms=latency_ms, status_code=status_code, request_params=request_params,
            error_code=str(status_code) if status_code else "request_failed",
            error_message=str(error), api_log_id=log.id,
        )


def safe_payload_summary(payload: dict) -> dict:
    result: dict = {"keys": sorted(payload.keys())}
    result["model"] = payload.get("model")
    if isinstance(payload.get("prompt"), str):
        result["prompt_chars"] = len(payload["prompt"])
    if isinstance(payload.get("messages"), list):
        result["messages_count"] = len(payload["messages"])
    if isinstance(payload.get("image"), dict):
        result["image"] = payload["image"]
    for key in ("size", "quality", "image_size", "aspect_ratio", "enable_search", "background", "async"):
        if key in payload:
            result[key] = payload[key]
    for key in ("image", "images"):
        if isinstance(payload.get(key), list):
            result[f"{key}_count"] = len(payload[key])
        elif isinstance(payload.get(key), str):
            result[f"{key}_present"] = True
    return result


def response_summary(resp: httpx.Response) -> dict:
    content_type = resp.headers.get("content-type", "")
    summary: dict = {"content_type": content_type}
    if content_type.startswith("image/"):
        summary["bytes"] = len(resp.content)
        return summary
    try:
        data = resp.json()
    except ValueError:
        summary["text_preview"] = resp.text[:300]
        return summary
    for key in ("id", "task_id", "status", "task_status", "model", "object", "created", "usage"):
        if key in data:
            summary[key] = data[key]
    if isinstance(data.get("data"), list):
        summary["data_count"] = len(data["data"])
    if isinstance(data.get("choices"), list):
        summary["choices_count"] = len(data["choices"])
    if "error" in data:
        summary["error"] = data["error"]
    if "message" in data and not isinstance(data["message"], (list, dict)):
        summary["message"] = str(data["message"])[:300]
    return summary


def _task_id(meta: dict) -> str | None:
    value = meta.get("task_id") or meta.get("id")
    return str(value) if value else None


def _provider_config(provider: Provider) -> dict:
    return {
        "auth_style": provider.auth_style,
        "extra_headers": provider.extra_headers or {},
    }
