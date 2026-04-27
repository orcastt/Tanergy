import asyncio
import base64

import httpx


async def extract_image_bytes(data: dict) -> bytes | None:
    if "data" not in data:
        return None

    payload = data["data"]
    if isinstance(payload, list) and payload:
        item = payload[0]
        if "b64_json" in item:
            return base64.b64decode(item["b64_json"])
        if "url" in item:
            async with httpx.AsyncClient(timeout=60) as dl:
                img_resp = await dl.get(item["url"])
            return img_resp.content

    if isinstance(payload, dict):
        if "base64" in payload:
            return base64.b64decode(payload["base64"])
        urls = payload.get("image_urls")
        if urls:
            async with httpx.AsyncClient(timeout=60) as dl:
                img_resp = await dl.get(urls[0])
            return img_resp.content

    return None


async def poll_image_task(config: dict, headers: dict, task_id: str) -> dict:
    url = f"{config['base_url']}/images/{task_id}"
    async with httpx.AsyncClient(timeout=60) as client:
        for _ in range(20):
            resp = await client.get(url, headers=headers)
            if resp.status_code != 200:
                raise ValueError(f"Image task error {resp.status_code}: {resp.text[:500]}")
            data = resp.json()
            status = str(data.get("task_status") or data.get("status") or "").lower()
            has_result = bool(data.get("data"))
            if status in {"succeeded", "success", "completed", "done"} or has_result:
                return data
            if status in {"failed", "error", "cancelled"}:
                raise ValueError(f"Image task failed: {data}")
            await asyncio.sleep(2)
    raise ValueError(f"Image task timeout: {task_id}")
