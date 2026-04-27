from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class BalanceOut(BaseModel):
    user_id: UUID
    balance: int
    plan: str
    updated_at: datetime

    model_config = {"from_attributes": True}


class CreditGrantRequest(BaseModel):
    user_id: UUID
    amount: int
    reason: str = "admin_grant"
    description: str | None = None


class TransactionOut(BaseModel):
    id: UUID
    user_id: UUID
    amount: int
    type: str
    reason: str
    description: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatProxyRequest(BaseModel):
    provider: str
    model: str
    messages: list[dict]
    max_tokens: int = 4096
    temperature: float | None = None


class ChatProxyResponse(BaseModel):
    text: str
    credits_used: int
    tokens: int


class ImageProxyRequest(BaseModel):
    provider: str
    model: str = "gpt-image-2"
    prompt: str
    aspect_ratio: str | None = None
    negative_prompt: str | None = None
    image: str | list[str] | None = None
    strength: float | None = None
    size: str | None = None
    quality: str | None = None
    style_preset: str | None = None
    mask: str | None = None
    watermark: bool | None = None
    background: str | None = None
    extra_body: dict | None = None
    async_mode: bool = Field(default=False, alias="async")
    retries: int = 0


class ImageEditProxyRequest(BaseModel):
    provider: str
    model: str = "gemini-nano-banana"
    prompt: str
    image: str | list[str]
    aspect_ratio: str | None = None
    background: str | None = "auto"
    mask: str | None = None
    size: str | None = None
    n: int = 1
    quality: str | None = "auto"
    response_format: str = "url"
    output_format: str = "png"
    retries: int = 0


class ImageEnhanceProxyRequest(BaseModel):
    provider: str = "geekai"
    model: str = "jimeng-image-enhance-v2"
    image: str
    size: str = "720p"
    response_format: str = "url"
    output_format: str = "png"
    extra_body: dict | None = None
    retries: int = 0


class ModelConfigOut(BaseModel):
    id: UUID
    provider: str
    model: str
    display_name: str
    call_type: str
    is_active: bool
    credits_per_call: int
    credits_per_1k_tokens: float
    max_tokens: int

    model_config = {"from_attributes": True}


class ModelConfigCreate(BaseModel):
    provider: str
    model: str
    display_name: str
    call_type: str
    is_active: bool = True
    credits_per_call: int = 1
    credits_per_1k_tokens: float = 0.0
    max_tokens: int = 4096


class ApiCallLogOut(BaseModel):
    id: UUID
    user_id: UUID
    provider: str
    model: str
    call_type: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    credits_used: int
    latency_ms: int
    status: str
    error_message: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AdminUserOut(BaseModel):
    id: UUID
    email: str
    display_name: str
    role: str
    is_active: bool
    balance: int
    plan: str
    created_at: datetime
    last_login_at: datetime | None

    model_config = {"from_attributes": True}
