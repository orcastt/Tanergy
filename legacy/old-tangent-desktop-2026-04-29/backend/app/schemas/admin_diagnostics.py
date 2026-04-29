from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.credit import ApiCallLogOut, ModelConfigOut
from app.schemas.provider import ProviderOut


class AdminTestRequest(BaseModel):
    execute: bool = False
    model_id: UUID | None = None
    extra_payload: dict = Field(default_factory=dict)
    timeout_seconds: int = Field(default=60, ge=5, le=180)


class ProviderHealthOut(BaseModel):
    provider: ProviderOut
    key_configured: bool
    key_env: str
    base_url: str
    is_active: bool
    ready: bool
    issues: list[str] = Field(default_factory=list)


class TestResultOut(BaseModel):
    provider: str
    model: str | None = None
    endpoint: str | None = None
    execute: bool
    ok: bool
    latency_ms: int = 0
    status_code: int | None = None
    request_params: dict = Field(default_factory=dict)
    response_meta: dict = Field(default_factory=dict)
    error_code: str | None = None
    error_message: str | None = None
    api_log_id: UUID | None = None


class ModelUsageOut(BaseModel):
    total_calls: int = 0
    success_calls: int = 0
    error_calls: int = 0
    total_credits: int = 0
    avg_latency_ms: int = 0
    success_rate: float = 0


class ModelDetailOut(BaseModel):
    model: ModelConfigOut
    usage: ModelUsageOut
    recent_logs: list[ApiCallLogOut] = Field(default_factory=list)


class ApiLogDetailOut(BaseModel):
    log: ApiCallLogOut
    user_email: str | None = None
    user_display_name: str | None = None
    created_at: datetime
