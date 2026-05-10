from typing import Optional

from pydantic import Field

from tangent_api.schema_base import TangentApiModel


class AdminAiRouteMetricRecord(TangentApiModel):
    average_attempts_per_run: float = Field(alias="averageAttemptsPerRun")
    avg_latency_ms: int = Field(alias="avgLatencyMs")
    capability: str
    calls: int
    credits_charged: float = Field(alias="creditsCharged")
    direct_win_rate: Optional[float] = Field(default=None, alias="directWinRate")
    direct_wins: int = Field(alias="directWins")
    failed_calls: int = Field(alias="failedCalls")
    fallback_wins: int = Field(alias="fallbackWins")
    last_called_at: Optional[str] = Field(default=None, alias="lastCalledAt")
    model_id: str = Field(alias="modelId")
    provider: str
    provider_cost: float = Field(alias="providerCost")
    provider_currency: Optional[str] = Field(default=None, alias="providerCurrency")
    route_attempt_success_rate: Optional[float] = Field(default=None, alias="routeAttemptSuccessRate")
    route_hit_runs: int = Field(alias="routeHitRuns")
    route_id: Optional[str] = Field(default=None, alias="routeId")
    route_key: str = Field(alias="routeKey")
    succeeded_calls: int = Field(alias="succeededCalls")
    terminal_failures: int = Field(alias="terminalFailures")


class AdminAiRouteMetricsTotals(TangentApiModel):
    average_attempts_per_run: float = Field(alias="averageAttemptsPerRun")
    calls: int
    credits_charged: float = Field(alias="creditsCharged")
    direct_win_rate: Optional[float] = Field(default=None, alias="directWinRate")
    direct_wins: int = Field(alias="directWins")
    failed_calls: int = Field(alias="failedCalls")
    fallback_wins: int = Field(alias="fallbackWins")
    provider_cost: float = Field(alias="providerCost")
    route_attempt_success_rate: Optional[float] = Field(default=None, alias="routeAttemptSuccessRate")
    route_hit_runs: int = Field(alias="routeHitRuns")
    succeeded_calls: int = Field(alias="succeededCalls")
    terminal_failures: int = Field(alias="terminalFailures")


class AdminAiRouteMetricsResponse(TangentApiModel):
    error: Optional[str] = None
    metrics: list[AdminAiRouteMetricRecord] = Field(default_factory=list)
    ok: bool
    totals: AdminAiRouteMetricsTotals
