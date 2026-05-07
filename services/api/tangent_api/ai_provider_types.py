from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class AiProviderAttemptResult:
    created_at: str
    error_code: Optional[str]
    error_message: Optional[str]
    latency_ms: int
    output_asset_ids: list[str]
    provider: str
    provider_cost: Optional[float]
    provider_currency: Optional[str]
    retryable: bool
    route_id: Optional[str]
    route_key: Optional[str]
    status: str
    text_output: Optional[str]
    work_started: bool
