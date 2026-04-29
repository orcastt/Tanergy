from dataclasses import dataclass
import os

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.credit import ModelConfig
from app.models.provider import Provider


_FALLBACK_PRESETS: dict[str, dict] = {
    "minimax": {"base_url": "https://api.minimax.chat/v1", "key_env": "MINIMAX_API_KEY"},
    "claude": {"base_url": "https://api.anthropic.com/v1", "key_env": "ANTHROPIC_API_KEY"},
    "gpt": {"base_url": "https://api.openai.com/v1", "key_env": "OPENAI_API_KEY"},
    "gemini": {
        "base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "key_env": "GEMINI_API_KEY",
    },
    "glm": {"base_url": "https://open.bigmodel.cn/api/paas/v4", "key_env": "GLM_API_KEY"},
    "geekai": {"base_url": "https://geekai.co/api/v1", "key_env": "GEEKAI_API_KEY"},
}

_FALLBACK_MODELS: dict[tuple[str, str], tuple[str, int]] = {
    ("minimax", "MiniMax-M2.7"): ("chat", 1),
    ("glm", "glm-4-plus"): ("chat", 2),
    ("gemini", "gemini-2.5-pro"): ("chat", 3),
    ("gpt", "gpt-4o"): ("chat", 5),
    ("claude", "claude-sonnet-4-6"): ("chat", 5),
    ("minimax", "image-01"): ("image", 5),
    ("gpt", "dall-e-3"): ("image", 10),
    ("geekai", "hunyuan-3.0-preview"): ("chat", 1),
    ("geekai", "minimax-m2.7:free"): ("chat", 1),
    ("geekai", "nemotron-3-super-120b-a12b"): ("chat", 1),
    ("geekai", "gpt-image-2"): ("image", 8),
    ("geekai", "gemini-3.1-flash-image-preview"): ("image_chat", 5),
    ("geekai", "nano-banana-2"): ("image", 5),
    ("geekai", "nano-banana-hd"): ("image", 8),
    ("geekai", "jimeng_t2i_v40"): ("image", 5),
    ("geekai", "gpt-image-1"): ("image_edit", 6),
    ("geekai", "jimeng-image-enhance-v2"): ("image_enhance", 3),
}


@dataclass(frozen=True)
class ActiveModel:
    provider: str
    model: str
    call_type: str
    credits_per_call: int


async def get_provider_config(db: AsyncSession, provider_id: str) -> dict | None:
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

    preset = _FALLBACK_PRESETS.get(provider_id)
    if not preset:
        return None
    return {
        **preset,
        "auth_style": "x-api-key" if provider_id == "claude" else "bearer",
        "extra_headers": {},
    }


def get_env_key(key_env: str) -> str | None:
    return os.getenv(key_env) or getattr(settings, key_env, None) or None


def auth_headers(config: dict, api_key: str) -> dict:
    headers = {"Content-Type": "application/json", **config.get("extra_headers", {})}
    if config.get("auth_style", "bearer") == "x-api-key":
        headers["x-api-key"] = api_key
    else:
        headers["Authorization"] = f"Bearer {api_key}"
    return headers


async def require_active_model(
    db: AsyncSession,
    provider: str,
    model: str,
    allowed_call_types: set[str],
) -> ActiveModel:
    result = await db.execute(
        select(ModelConfig).where(ModelConfig.provider == provider, ModelConfig.model == model)
    )
    row = result.scalars().first()
    if row:
        if not row.is_active or row.call_type not in allowed_call_types:
            raise ValueError(f"MODEL_NOT_ENABLED: {provider}/{model}")
        return ActiveModel(provider, model, row.call_type, row.credits_per_call)

    fallback = _FALLBACK_MODELS.get((provider, model))
    if fallback and fallback[0] in allowed_call_types:
        return ActiveModel(provider, model, fallback[0], fallback[1])

    raise ValueError(f"MODEL_NOT_ENABLED: {provider}/{model}")
