import time
from uuid import UUID

import httpx
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.proxy.credits import deduct_credits, grant_credits, log_api_call
from app.services.proxy.image_payloads import (
    build_openai_image_body,
    build_openai_image_edit_body,
    merge_optional_image_fields,
    normalize_image_value,
)
from app.services.proxy.image_results import extract_image_bytes, poll_image_task
from app.services.proxy.provider import (
    auth_headers,
    get_env_key,
    get_provider_config,
    require_active_model,
)


async def _post_image_request(
    headers: dict,
    url: str,
    body: dict,
) -> dict:
    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(url, json=body, headers=headers)
    if resp.status_code != 200:
        raise ValueError(f"{resp.status_code}: {resp.text[:500]}")
    return resp.json()


async def _bytes_from_image_response(config: dict, headers: dict, data: dict) -> bytes | None:
    image_bytes = await extract_image_bytes(data)
    if image_bytes is None and data.get("task_id"):
        data = await poll_image_task(config, headers, data["task_id"])
        image_bytes = await extract_image_bytes(data)
    return image_bytes


async def proxy_image_generation(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    prompt: str,
    aspect_ratio: str | None = None,
    negative_prompt: str | None = None,
    image: str | list[str] | None = None,
    strength: float | None = None,
    size: str | None = None,
    quality: str | None = None,
    style_preset: str | None = None,
    mask: str | None = None,
    watermark: bool | None = None,
    background: str | None = None,
    extra_body: dict | None = None,
    async_mode: bool = False,
    retries: int = 0,
) -> bytes:
    active_model = await require_active_model(db, provider, model, {"image"})
    config, api_key = await _require_provider_key(db, provider)
    credits_to_deduct = active_model.credits_per_call
    await deduct_credits(db, user_id, credits_to_deduct, "api_call", f"{provider}/{model} image gen")

    headers = auth_headers(config, api_key)
    start = time.time()
    try:
        if provider in {"gpt", "geekai"}:
            url = f"{config['base_url']}/images/generations"
            body = build_openai_image_body(model, prompt, aspect_ratio)
            merge_optional_image_fields(body, {
                "negative_prompt": negative_prompt,
                "image": normalize_image_value(image) if image is not None else None,
                "strength": strength,
                "size": size,
                "quality": quality,
                "style_preset": style_preset,
                "mask": mask,
                "watermark": watermark,
                "background": background,
                "extra_body": extra_body,
            })
            body["async"] = async_mode
            body["retries"] = retries
        else:
            url = f"{config['base_url']}/image_generation"
            body = {"model": model, "prompt": prompt}
            if aspect_ratio:
                body["aspect_ratio"] = aspect_ratio

        data = await _post_image_request(headers, url, body)
        image_bytes = await _bytes_from_image_response(config, headers, data)
        if image_bytes is None:
            raise ValueError("Unexpected image response format")
        await _log_image_success(db, user_id, provider, model, "image", credits_to_deduct, start)
        return image_bytes
    except Exception as error:
        await _raise_refunded_image_error(
            db, user_id, provider, model, "image", credits_to_deduct,
            start, error, f"Image API error: {provider}/{model}", "Image request failed",
        )


async def proxy_image_edit(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    prompt: str,
    image: str | list[str],
    aspect_ratio: str | None = None,
    background: str | None = "auto",
    mask: str | None = None,
    size: str | None = None,
    n: int = 1,
    quality: str | None = "auto",
    response_format: str = "url",
    output_format: str = "png",
    retries: int = 0,
) -> bytes:
    active_model = await require_active_model(db, provider, model, {"image_edit"})
    config, api_key = await _require_provider_key(db, provider)
    credits_to_deduct = active_model.credits_per_call
    await deduct_credits(db, user_id, credits_to_deduct, "api_call", f"{provider}/{model} image edit")

    headers = auth_headers(config, api_key)
    start = time.time()
    try:
        use_edit_endpoint = model.startswith("gpt-image-1") or "nano-banana" in model
        body = build_openai_image_edit_body(model, prompt, image, aspect_ratio)
        merge_optional_image_fields(body, {
            "background": background,
            "mask": mask,
            "size": size,
            "quality": quality,
        })
        body["n"] = n
        body["response_format"] = response_format
        body["output_format"] = output_format
        body["retries"] = retries
        data = await _post_image_request(
            headers,
            f"{config['base_url']}/images/{'edits' if use_edit_endpoint else 'generations'}",
            body,
        )
        image_bytes = await _bytes_from_image_response(config, headers, data)
        if image_bytes is None:
            raise ValueError("Unexpected image edit response format")
        await _log_image_success(db, user_id, provider, model, "image", credits_to_deduct, start)
        return image_bytes
    except Exception as error:
        await _raise_refunded_image_error(
            db, user_id, provider, model, "image", credits_to_deduct,
            start, error, f"Image edit error: {provider}/{model}", "Image edit request failed",
        )


async def proxy_image_result(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    task_id: str,
) -> dict:
    config, api_key = await _require_provider_key(db, provider)
    headers = auth_headers(config, api_key)
    start = time.time()
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(f"{config['base_url']}/images/{task_id}", headers=headers)

        latency_ms = int((time.time() - start) * 1000)
        if resp.status_code != 200:
            error_text = resp.text[:500]
            await log_api_call(
                db, user_id, provider, task_id, "image_result",
                latency_ms=latency_ms, status="error", error_message=error_text,
            )
            raise ValueError(f"Image task error {resp.status_code}: {error_text}")

        data = resp.json()
        await log_api_call(db, user_id, provider, task_id, "image_result", latency_ms=latency_ms)
        return data
    except ValueError:
        raise
    except Exception as error:
        latency_ms = int((time.time() - start) * 1000)
        await log_api_call(
            db, user_id, provider, task_id, "image_result",
            latency_ms=latency_ms, status="error", error_message=str(error),
        )
        raise ValueError(f"Image task request failed: {error}")


async def proxy_image_enhance(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    image: str,
    size: str = "720p",
    response_format: str = "url",
    output_format: str = "png",
    extra_body: dict | None = None,
    retries: int = 0,
) -> bytes:
    active_model = await require_active_model(db, provider, model, {"image_enhance"})
    config, api_key = await _require_provider_key(db, provider)
    credits_to_deduct = active_model.credits_per_call
    await deduct_credits(db, user_id, credits_to_deduct, "api_call", f"{provider}/{model} image enhance")

    headers = auth_headers(config, api_key)
    body = {
        "model": model,
        "image": normalize_image_value(image),
        "size": size,
        "response_format": response_format,
        "output_format": output_format,
        "extra_body": extra_body or {},
        "retries": retries,
    }
    start = time.time()
    try:
        data = await _post_image_request(headers, f"{config['base_url']}/images/enhance", body)
        image_bytes = await _bytes_from_image_response(config, headers, data)
        if image_bytes is None:
            raise ValueError("Unexpected image enhance response format")
        await _log_image_success(db, user_id, provider, model, "image_enhance", credits_to_deduct, start)
        return image_bytes
    except Exception as error:
        await _raise_refunded_image_error(
            db, user_id, provider, model, "image_enhance", credits_to_deduct,
            start, error, f"Image enhance error: {provider}/{model}", "Image enhance request failed",
        )


async def _require_provider_key(db: AsyncSession, provider: str) -> tuple[dict, str]:
    config = await get_provider_config(db, provider)
    if not config:
        raise ValueError(f"Unknown provider: {provider}")
    api_key = get_env_key(config["key_env"])
    if not api_key:
        raise ValueError(f"No API key configured for provider: {provider}")
    return config, api_key


async def _log_image_success(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    call_type: str,
    credits_used: int,
    start: float,
) -> None:
    latency_ms = int((time.time() - start) * 1000)
    await log_api_call(
        db, user_id, provider, model, call_type,
        credits_used=credits_used, latency_ms=latency_ms,
    )


async def _log_image_error(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    call_type: str,
    credits_used: int,
    start: float,
    error_message: str,
) -> None:
    latency_ms = int((time.time() - start) * 1000)
    await log_api_call(
        db, user_id, provider, model, call_type,
        credits_used=credits_used, latency_ms=latency_ms,
        status="error", error_message=error_message,
    )


async def _raise_refunded_image_error(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    call_type: str,
    credits_used: int,
    start: float,
    error: Exception,
    refund_description: str,
    public_prefix: str,
) -> None:
    await _log_image_error(
        db, user_id, provider, model, call_type,
        credits_used, start, str(error),
    )
    await grant_credits(db, user_id, credits_used, "refund", refund_description)
    raise ValueError(f"{public_prefix}: {error}") from error
