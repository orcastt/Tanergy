from datetime import datetime
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field, field_validator, model_validator

from app.core.model_options import GEMINI_IMAGE_SIZES, GPT_IMAGE_2_QUALITIES, GPT_IMAGE_2_SIZES


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
    image: str | list[str] | None = Field(default=None, validation_alias=AliasChoices("image", "images"))
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

    @model_validator(mode="after")
    def validate_model_options(self):
        if self.model != "gpt-image-2":
            return self
        if self.size is not None:
            self.size = self.size.strip()
        if self.quality is not None:
            self.quality = self.quality.strip().lower()
        if self.size is not None and self.size not in GPT_IMAGE_2_SIZES:
            allowed = ", ".join(sorted(GPT_IMAGE_2_SIZES))
            raise ValueError(f"gpt-image-2 size must be one of: {allowed}")
        if self.quality is not None and self.quality not in GPT_IMAGE_2_QUALITIES:
            allowed = ", ".join(sorted(GPT_IMAGE_2_QUALITIES))
            raise ValueError(f"gpt-image-2 quality must be one of: {allowed}")
        return self


class ImageChatProxyRequest(BaseModel):
    provider: str = "geekai"
    model: str = "gemini-3.1-flash-image-preview"
    prompt: str
    images: list[str] | None = None
    aspect_ratio: str | None = "1:1"
    image_size: str | None = "0.5K"
    enable_search: bool = False
    background: bool = False

    @field_validator("image_size")
    @classmethod
    def validate_image_size(cls, value: str | None) -> str | None:
        if value is None:
            return value
        normalized = value.strip()
        if normalized.lower() == "0.5k":
            normalized = "0.5K"
        elif normalized.lower() in {"1k", "2k", "4k"}:
            normalized = normalized.upper()
        if normalized not in GEMINI_IMAGE_SIZES:
            allowed = ", ".join(sorted(GEMINI_IMAGE_SIZES))
            raise ValueError(f"image_size must be one of: {allowed}")
        return normalized


class ImageEditProxyRequest(BaseModel):
    provider: str
    model: str = "gpt-image-1"
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
    endpoint_type: str | None = None
    capabilities: dict = Field(default_factory=dict)
    parameter_schema: dict = Field(default_factory=dict)
    pricing_schema: dict = Field(default_factory=dict)
    smoke_test_payload: dict = Field(default_factory=dict)
    is_default: bool = False
    fallback_priority: int = 0

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
    endpoint_type: str | None = None
    capabilities: dict = Field(default_factory=dict)
    parameter_schema: dict = Field(default_factory=dict)
    pricing_schema: dict = Field(default_factory=dict)
    smoke_test_payload: dict = Field(default_factory=dict)
    is_default: bool = False
    fallback_priority: int = 0


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
    endpoint: str | None = None
    request_params: dict = Field(default_factory=dict)
    response_meta: dict = Field(default_factory=dict)
    upstream_task_id: str | None = None
    error_code: str | None = None
    refund_transaction_id: UUID | None = None
    upstream_cost: dict = Field(default_factory=dict)
    route_provider: str | None = None
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
