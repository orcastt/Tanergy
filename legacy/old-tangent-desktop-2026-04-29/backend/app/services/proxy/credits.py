import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.credit import ApiCallLog, CreditBalance, CreditTransaction


async def deduct_credits(
    db: AsyncSession,
    user_id: UUID,
    amount: int,
    reason: str,
    description: str | None = None,
) -> CreditBalance:
    result = await db.execute(
        select(CreditBalance).where(CreditBalance.user_id == user_id).with_for_update()
    )
    balance = result.scalar_one_or_none()

    if balance is None:
        balance = CreditBalance(user_id=user_id, balance=0, plan="free")
        db.add(balance)

    if balance.balance < amount:
        raise ValueError("INSUFFICIENT_CREDITS")

    balance.balance -= amount
    db.add(
        CreditTransaction(
            user_id=user_id,
            amount=-amount,
            type="debit",
            reason=reason,
            description=description,
        )
    )
    await db.commit()
    await db.refresh(balance)
    return balance


async def grant_credits(
    db: AsyncSession,
    user_id: UUID,
    amount: int,
    reason: str = "admin_grant",
    description: str | None = None,
) -> CreditBalance:
    result = await db.execute(
        select(CreditBalance).where(CreditBalance.user_id == user_id).with_for_update()
    )
    balance = result.scalar_one_or_none()

    if balance is None:
        balance = CreditBalance(user_id=user_id, balance=0, plan="free")
        db.add(balance)
        await db.flush()

    balance.balance += amount
    db.add(
        CreditTransaction(
            user_id=user_id,
            amount=amount,
            type="credit",
            reason=reason,
            description=description,
        )
    )
    await db.commit()
    await db.refresh(balance)
    return balance


async def log_api_call(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    call_type: str,
    prompt_tokens: int = 0,
    completion_tokens: int = 0,
    total_tokens: int = 0,
    credits_used: int = 0,
    latency_ms: int = 0,
    status: str = "success",
    error_message: str | None = None,
    endpoint: str | None = None,
    request_params: dict | None = None,
    response_meta: dict | None = None,
    upstream_task_id: str | None = None,
    error_code: str | None = None,
    refund_transaction_id: UUID | None = None,
    upstream_cost: dict | None = None,
    route_provider: str | None = None,
) -> ApiCallLog:
    log = ApiCallLog(
        user_id=user_id,
        provider=provider,
        model=model,
        call_type=call_type,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        credits_used=credits_used,
        latency_ms=latency_ms,
        status=status,
        error_message=error_message,
        endpoint=endpoint or _endpoint_for_call_type(call_type),
        request_params=request_params or {},
        response_meta=response_meta or {},
        upstream_task_id=upstream_task_id,
        error_code=error_code or _error_code_from_message(error_message),
        refund_transaction_id=refund_transaction_id,
        upstream_cost=upstream_cost or {},
        route_provider=route_provider or provider,
    )
    db.add(log)
    await db.commit()
    return log


def _endpoint_for_call_type(call_type: str) -> str | None:
    return {
        "chat": "/chat/completions",
        "image": "/images/generations",
        "image_chat": "/chat/completions",
        "image_edit": "/images/edits",
        "image_enhance": "/images/enhance",
        "image_result": "/images/{task_id}",
    }.get(call_type)


def _error_code_from_message(error_message: str | None) -> str | None:
    if not error_message:
        return None
    match = re.match(r"^\\s*(\\d{3})\\b", error_message)
    return match.group(1) if match else None
