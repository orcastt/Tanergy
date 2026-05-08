from typing import Optional

from pydantic import Field

from tangent_api.schema_base import TangentApiModel


class AdminAiRouteMetricRecord(TangentApiModel):
    avg_latency_ms: int = Field(alias="avgLatencyMs")
    capability: str
    calls: int
    credits_charged: float = Field(alias="creditsCharged")
    failed_calls: int = Field(alias="failedCalls")
    last_called_at: Optional[str] = Field(default=None, alias="lastCalledAt")
    model_id: str = Field(alias="modelId")
    provider: str
    provider_cost: float = Field(alias="providerCost")
    provider_currency: Optional[str] = Field(default=None, alias="providerCurrency")
    route_key: str = Field(alias="routeKey")
    succeeded_calls: int = Field(alias="succeededCalls")


class AdminAiRouteMetricsTotals(TangentApiModel):
    calls: int
    credits_charged: float = Field(alias="creditsCharged")
    failed_calls: int = Field(alias="failedCalls")
    provider_cost: float = Field(alias="providerCost")
    succeeded_calls: int = Field(alias="succeededCalls")


class AdminAiRouteMetricsResponse(TangentApiModel):
    error: Optional[str] = None
    metrics: list[AdminAiRouteMetricRecord] = Field(default_factory=list)
    ok: bool
    totals: AdminAiRouteMetricsTotals
