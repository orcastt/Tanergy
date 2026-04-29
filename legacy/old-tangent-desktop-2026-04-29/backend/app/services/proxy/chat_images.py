import asyncio
import base64
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


async def proxy_chat_image_generation(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    prompt: str,
    images: list[str] | None = None,
    aspect_ratio: str | None = None,
    image_size: str | None = None,
    enable_search: bool = False,
    background: bool = False,
) -> bytes:
    active_model = await require_active_model(db, provider, model, {"image_chat"})
    config, api_key = await _require_provider_key(db, provider)
    credits_to_deduct = active_model.credits_per_call
    await deduct_credits(db, user_id, credits_to_deduct, "api_call", f"{provider}/{model} image chat")

    headers = auth_headers(config, api_key)
    body = _build_chat_image_body(
        model=model,
        prompt=prompt,
        images=images or [],
        aspect_ratio=aspect_ratio,
        image_size=image_size,
        enable_search=enable_search,
        background=background,
    )
    start = time.time()
    try:
        data = await _post_chat_image(config, headers, body)
        if background and data.get("id") and not data.get("choices"):
            data = await _poll_chat_task(config, headers, data["id"])
        image_bytes = await _extract_image_bytes(data)
        if image_bytes is None:
            raise ValueError("Unexpected chat image response format")
        await _log_chat_image(db, user_id, provider, model, credits_to_deduct, start)
        return image_bytes
    except Exception as error:
        latency_ms = int((time.time() - start) * 1000)
        await log_api_call(
            db, user_id, provider, model, "image_chat",
            credits_used=credits_to_deduct, latency_ms=latency_ms,
            status="error", error_message=str(error),
        )
        await grant_credits(db, user_id, credits_to_deduct, "refund", f"Chat image error: {provider}/{model}")
        raise ValueError(f"Chat image request failed: {error}") from error


def _build_chat_image_body(
    model: str,
    prompt: str,
    images: list[str],
    aspect_ratio: str | None,
    image_size: str | None,
    enable_search: bool,
    background: bool,
) -> dict:
    content: list[dict] = [{"type": "text", "text": prompt}]
    for image in images:
        content.append({"type": "image_url", "image_url": {"url": _normalize_image_url(image)}})

    body: dict = {
        "model": model,
        "messages": [{"role": "user", "content": content}],
    }
    if enable_search:
        body["enable_search"] = True
    image_options = {}
    if aspect_ratio:
        image_options["aspect_ratio"] = aspect_ratio
    if image_size:
        image_options["image_size"] = image_size
    if image_options:
        body["image"] = image_options
    if background:
        body["background"] = True
    return body


def _normalize_image_url(image: str) -> str:
    if image.startswith(("http://", "https://", "data:")):
        return image
    return f"data:image/png;base64,{image}"


async def _post_chat_image(config: dict, headers: dict, body: dict) -> dict:
    async with httpx.AsyncClient(timeout=180) as client:
        resp = await client.post(
            f"{config['base_url']}/chat/completions",
            json=body,
            headers=headers,
        )
    if resp.status_code not in {200, 201}:
        raise ValueError(f"{resp.status_code}: {resp.text[:500]}")
    return resp.json()


async def _poll_chat_task(config: dict, headers: dict, task_id: str) -> dict:
    url = f"{config['base_url']}/chat/{task_id}"
    async with httpx.AsyncClient(timeout=60) as client:
        for _ in range(30):
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                raise ValueError(f"Chat image task error {resp.status_code}: {resp.text[:500]}")
            data = resp.json()
            status = str(data.get("status") or "").lower()
            if status in {"succeed", "succeeded", "success", "completed", "done"} or data.get("choices"):
                return data
            if status in {"failed", "error", "cancelled"}:
                raise ValueError(f"Chat image task failed: {data}")
            await asyncio.sleep(2)
    raise ValueError(f"Chat image task timeout: {task_id}")


async def _extract_image_bytes(data: dict) -> bytes | None:
    for b64_value in _find_base64_values(data):
        try:
            return base64.b64decode(b64_value.split(",", 1)[-1])
        except Exception:
            continue

    for url in _find_image_urls(data):
        if url.startswith("data:image"):
            try:
                return base64.b64decode(url.split(",", 1)[-1])
            except Exception:
                continue
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.get(url)
        if resp.status_code == 200 and _looks_like_image(resp):
            return resp.content
    return None


def _find_base64_values(value) -> list[str]:
    found: list[str] = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key in {"b64_json", "base64"} and isinstance(child, str):
                found.append(child)
            else:
                found.extend(_find_base64_values(child))
    elif isinstance(value, list):
        for child in value:
            found.extend(_find_base64_values(child))
    return found


def _find_image_urls(value) -> list[str]:
    urls: list[str] = []
    if isinstance(value, dict):
        image_url = value.get("image_url")
        if isinstance(image_url, dict) and isinstance(image_url.get("url"), str):
            urls.append(image_url["url"])
        elif isinstance(image_url, str):
            urls.append(image_url)
        for child in value.values():
            urls.extend(_find_image_urls(child))
    elif isinstance(value, list):
        for child in value:
            urls.extend(_find_image_urls(child))
    elif isinstance(value, str):
        urls.extend(re.findall(r"data:image/[^\\s)]+|https?://[^\\s)]+", value))
    return _unique(urls)


def _unique(values: list[str]) -> list[str]:
    result: list[str] = []
    for value in values:
        clean = value.strip().strip('"').strip("'")
        if clean and clean not in result:
            result.append(clean)
    return result


def _looks_like_image(resp: httpx.Response) -> bool:
    content_type = resp.headers.get("content-type", "")
    return content_type.startswith("image/") or resp.content[:8].startswith(b"\\x89PNG")


async def _require_provider_key(db: AsyncSession, provider: str) -> tuple[dict, str]:
    config = await get_provider_config(db, provider)
    if not config:
        raise ValueError(f"Unknown provider: {provider}")
    api_key = get_env_key(config["key_env"])
    if not api_key:
        raise ValueError(f"No API key configured for provider: {provider}")
    return config, api_key


async def _log_chat_image(
    db: AsyncSession,
    user_id: UUID,
    provider: str,
    model: str,
    credits_used: int,
    start: float,
) -> None:
    latency_ms = int((time.time() - start) * 1000)
    await log_api_call(
        db, user_id, provider, model, "image_chat",
        credits_used=credits_used, latency_ms=latency_ms,
    )
