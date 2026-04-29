import re
import time
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.proxy.credits import deduct_credits, grant_credits, log_api_call
from app.services.proxy.provider import (
    auth_headers,
    get_env_key,
    get_provider_config,
    require_active_model,
)


async def proxy_chat_completion(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    messages: list[dict],
    max_tokens: int = 4096,
    temperature: float | None = None,
) -> dict:
    active_model = await require_active_model(db, provider, model, {"chat"})
    config = await get_provider_config(db, provider)
    if not config:
        raise ValueError(f"Unknown provider: {provider}")

    api_key = get_env_key(config["key_env"])
    if not api_key:
        raise ValueError(f"No API key configured for provider: {provider}")

    credits_to_deduct = active_model.credits_per_call
    await deduct_credits(db, user_id, credits_to_deduct, "api_call", f"{provider}/{model} chat")

    start = time.time()
    try:
        body: dict = {"model": model, "messages": messages, "max_tokens": max_tokens}
        if temperature is not None:
            body["temperature"] = temperature

        async with httpx.AsyncClient(timeout=120) as client:
            resp = await client.post(
                f"{config['base_url']}/chat/completions",
                json=body,
                headers=auth_headers(config, api_key),
            )

        latency_ms = int((time.time() - start) * 1000)
        if resp.status_code != 200:
            error_text = resp.text[:500]
            await log_api_call(
                db, user_id, provider, model, "chat",
                credits_used=credits_to_deduct, latency_ms=latency_ms,
                status="error", error_message=error_text,
            )
            await grant_credits(db, user_id, credits_to_deduct, "refund", f"API error: {provider}/{model}")
            raise ValueError(f"API error {resp.status_code}: {error_text}")

        data = resp.json()
        usage = data.get("usage", {})
        text = ""
        total_tokens = 0

        if "choices" in data:
            text = data["choices"][0].get("message", {}).get("content", "")
            total_tokens = usage.get("total_tokens", 0)
        elif "content" in data:
            text = data["content"][0].get("text", "")
            total_tokens = usage.get("input_tokens", 0) + usage.get("output_tokens", 0)

        if "</think" in text:
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
