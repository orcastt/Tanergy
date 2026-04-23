import time
import logging
from uuid import UUID

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.credit import CreditBalance, CreditTransaction, ApiCallLog, ModelConfig
from app.models.provider import Provider

logger = logging.getLogger(__name__)

# Fallback presets when DB provider table is empty (first boot before migration)
_FALLBACK_PRESETS: dict[str, dict] = {
    "minimax": {"base_url": "https://api.minimax.chat/v1", "key_env": "MINIMAX_API_KEY"},
    "claude": {"base_url": "https://api.anthropic.com/v1", "key_env": "ANTHROPIC_API_KEY"},
    "gpt": {"base_url": "https://api.openai.com/v1", "key_env": "OPENAI_API_KEY"},
    "gemini": {"base_url": "https://generativelanguage.googleapis.com/v1beta/openai", "key_env": "GEMINI_API_KEY"},
    "glm": {"base_url": "https://open.bigmodel.cn/api/paas/v4", "key_env": "GLM_API_KEY"},
}


async def _get_provider_config(db: AsyncSession, provider_id: str) -> dict | None:
    """Get provider config from DB, fallback to hardcoded presets."""
    result = await db.execute(
        select(Provider).where(Provider.id == provider_id, Provider.is_active == True)
    )
    provider = result.scalar_one_or_none()
    if provider:
        return {
            "base_url": provider.base_url,
            "key_env": provider.key_env,
            "auth_style": provider.auth_style,
            "extra_headers": provider.extra_headers or {},
        }
    # Fallback
    preset = _FALLBACK_PRESETS.get(provider_id)
    if preset:
        return {**preset, "auth_style": "bearer" if provider_id != "claude" else "x-api-key", "extra_headers": {}}
    return None


def _get_env_key(key_env: str) -> str | None:
    """Resolve env var name to actual value."""
    return getattr(settings, key_env, None) or None


async def _get_model_pricing(db: AsyncSession, provider: str, model: str) -> int:
    """Get credits per call for a model from model_configs table. Default: 1."""
    result = await db.execute(
        select(ModelConfig.credits_per_call)
        .where(ModelConfig.provider == provider, ModelConfig.model == model, ModelConfig.is_active == True)
    )
    row = result.scalar_one_or_none()
    return row if row is not None else 1


async def deduct_credits(
    db: AsyncSession,
    user_id: UUID,
    amount: int,
    reason: str,
    description: str | None = None,
) -> CreditBalance:
    """Deduct credits from user balance. Raises ValueError if insufficient."""
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
    txn = CreditTransaction(
        user_id=user_id,
        amount=-amount,
        type="debit",
        reason=reason,
        description=description,
    )
    db.add(txn)
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
    """Add credits to user balance."""
    result = await db.execute(
        select(CreditBalance).where(CreditBalance.user_id == user_id).with_for_update()
    )
    balance = result.scalar_one_or_none()

    if balance is None:
        balance = CreditBalance(user_id=user_id, balance=0, plan="free")
        db.add(balance)
        await db.flush()

    balance.balance += amount
    txn = CreditTransaction(
        user_id=user_id,
        amount=amount,
        type="credit",
        reason=reason,
        description=description,
    )
    db.add(txn)
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
    )
    db.add(log)
    await db.commit()
    return log


async def proxy_chat_completion(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    messages: list[dict],
    max_tokens: int = 4096,
    temperature: float | None = None,
) -> dict:
    """Proxy chat completion to the AI provider, deduct credits, log the call."""
    config = await _get_provider_config(db, provider)
    if not config:
        raise ValueError(f"Unknown provider: {provider}")

    api_key = _get_env_key(config["key_env"])
    if not api_key:
        raise ValueError(f"No API key configured for provider: {provider}")

    url = f"{config['base_url']}/chat/completions"
    credits_to_deduct = await _get_model_pricing(db, provider, model)

    # Pre-deduct credits
    await deduct_credits(db, user_id, credits_to_deduct, "api_call", f"{provider}/{model} chat")

    start = time.time()
    try:
        body: dict = {
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        }
        if temperature is not None:
            body["temperature"] = temperature

        headers = {
            "Content-Type": "application/json",
            **config.get("extra_headers", {}),
        }
        auth_style = config.get("auth_style", "bearer")
        if auth_style == "x-api-key":
            headers["x-api-key"] = api_key
        else:
            headers["Authorization"] = f"Bearer {api_key}"

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(url, json=body, headers=headers)

        latency_ms = int((time.time() - start) * 1000)

        if resp.status_code != 200:
            error_text = resp.text[:500]
            await log_api_call(
                db, user_id, provider, model, "chat",
                credits_used=credits_to_deduct, latency_ms=latency_ms,
                status="error", error_message=error_text,
            )
            # Refund credits on error
            await grant_credits(db, user_id, credits_to_deduct, "refund", f"API error: {provider}/{model}")
            raise ValueError(f"API error {resp.status_code}: {error_text}")

        data = resp.json()
        text = ""
        total_tokens = 0

        # Standard OpenAI format
        if "choices" in data:
            text = data["choices"][0].get("message", {}).get("content", "")
            usage = data.get("usage", {})
            total_tokens = usage.get("total_tokens", 0)
        # Anthropic format
        elif "content" in data:
            text = data["content"][0].get("text", "")
            usage = data.get("usage", {})
            total_tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)

        # Strip <think/> tags (for models that include reasoning)
        if "</think" in text:
            import re
            text = re.sub(r"<think.*?</think\s*>", "", text, flags=re.DOTALL).strip()

        await log_api_call(
            db, user_id, provider, model, "chat",
            prompt_tokens=usage.get("prompt_tokens", usage.get("input_tokens", 0)),
            completion_tokens=usage.get("completion_tokens", usage.get("output_tokens", 0)),
            total_tokens=total_tokens,
            credits_used=credits_to_deduct,
            latency_ms=latency_ms,
        )

        return {"text": text, "credits_used": credits_to_deduct, "tokens": total_tokens}

    except ValueError:
        raise
    except Exception as e:
        latency_ms = int((time.time() - start) * 1000)
        await log_api_call(
            db, user_id, provider, model, "chat",
            credits_used=credits_to_deduct, latency_ms=latency_ms,
            status="error", error_message=str(e),
        )
        await grant_credits(db, user_id, credits_to_deduct, "refund", f"API error: {provider}/{model}")
        raise ValueError(f"API request failed: {e}")


async def proxy_image_generation(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    prompt: str,
    aspect_ratio: str | None = None,
) -> bytes:
    """Proxy image generation to the AI provider, deduct credits, return image bytes."""
    config = await _get_provider_config(db, provider)
    if not config:
        raise ValueError(f"Unknown provider: {provider}")

    api_key = _get_env_key(config["key_env"])
    if not api_key:
        raise ValueError(f"No API key configured for provider: {provider}")

    credits_to_deduct = await _get_model_pricing(db, provider, "image")
    if credits_to_deduct == 1:
        credits_to_deduct = 5  # Default for image if not configured

    # Pre-deduct credits
    await deduct_credits(db, user_id, credits_to_deduct, "api_call", f"{provider} image gen")

    headers = {"Content-Type": "application/json", **config.get("extra_headers", {})}
    auth_style = config.get("auth_style", "bearer")
    if auth_style == "x-api-key":
        headers["x-api-key"] = api_key
    else:
        headers["Authorization"] = f"Bearer {api_key}"

    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=180) as client:
            if provider == "gpt":
                # DALL-E 3
                url = f"{config['base_url']}/images/generations"
                body = {"model": "dall-e-3", "prompt": prompt, "response_format": "b64_json", "size": "1024x1024"}
            else:
                # Default: provider's image_generation endpoint
                url = f"{config['base_url']}/image_generation"
                body: dict = {"model": "image-01", "prompt": prompt}
                if aspect_ratio:
                    body["aspect_ratio"] = aspect_ratio
            resp = await client.post(url, json=body, headers=headers)

        latency_ms = int((time.time() - start) * 1000)

        if resp.status_code != 200:
            error_text = resp.text[:500]
            await log_api_call(
                db, user_id, provider, "image", "image",
                credits_used=credits_to_deduct, latency_ms=latency_ms,
                status="error", error_message=error_text,
            )
            await grant_credits(db, user_id, credits_to_deduct, "refund", f"Image API error: {provider}")
            raise ValueError(f"Image API error {resp.status_code}: {error_text}")

        data = resp.json()

        # Try base64 first
        import base64
        if "data" in data:
            d = data["data"]
            if isinstance(d, list) and d:
                item = d[0]
                if "b64_json" in item:
                    await log_api_call(db, user_id, provider, "image", "image", credits_used=credits_to_deduct, latency_ms=latency_ms)
                    return base64.b64decode(item["b64_json"])
                if "url" in item:
                    async with httpx.AsyncClient(timeout=60) as dl:
                        img_resp = await dl.get(item["url"])
                    await log_api_call(db, user_id, provider, "image", "image", credits_used=credits_to_deduct, latency_ms=latency_ms)
                    return img_resp.content
            elif isinstance(d, dict):
                if "base64" in d:
                    await log_api_call(db, user_id, provider, "image", "image", credits_used=credits_to_deduct, latency_ms=latency_ms)
                    return base64.b64decode(d["base64"])
                if "image_urls" in d:
                    urls = d["image_urls"]
                    if urls:
                        async with httpx.AsyncClient(timeout=60) as dl:
                            img_resp = await dl.get(urls[0])
                        await log_api_call(db, user_id, provider, "image", "image", credits_used=credits_to_deduct, latency_ms=latency_ms)
                        return img_resp.content

        raise ValueError(f"Unexpected image response format")

    except ValueError:
        raise
    except Exception as e:
        latency_ms = int((time.time() - start) * 1000)
        await log_api_call(
            db, user_id, provider, "image", "image",
            credits_used=credits_to_deduct, latency_ms=latency_ms,
            status="error", error_message=str(e),
        )
        await grant_credits(db, user_id, credits_to_deduct, "refund", f"Image API error: {provider}")
        raise ValueError(f"Image request failed: {e}")
