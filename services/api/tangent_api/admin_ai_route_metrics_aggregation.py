from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from tangent_api.admin_ai_analytics_schemas import AdminAiRouteMetricRecord, AdminAiRouteMetricsTotals


@dataclass(frozen=True)
class ApiCallRow:
    created_at: Optional[str]
    credits_charged: float
    id: str
    latency_ms: int
    model_id: str
    provider: str
    provider_cost: float
    provider_currency: Optional[str]
    route_id: Optional[str]
    route_key: str
    run_id: str
    status: str


@dataclass(frozen=True)
class RouteGroupKey:
    model_id: str
    provider: str
    route_id: Optional[str]
    route_key: str


@dataclass(frozen=True)
class RunOutcome:
    final_route: RouteGroupKey
    final_status: str


def api_call_from_row(row: tuple[object, ...]) -> ApiCallRow:
    return ApiCallRow(
        created_at=to_iso(row[18]),
        credits_charged=float(row[13] or 0),
        id=str(row[0]),
        latency_ms=int(row[12] or 0),
        model_id=str(row[6] or "unknown"),
        provider=str(row[7] or ""),
        provider_cost=float(row[15] or 0),
        provider_currency=str(row[16]) if row[16] not in (None, "") else None,
        route_id=str(row[9]) if row[9] not in (None, "") else None,
        route_key=str(row[8] or ""),
        run_id=str(row[3] or ""),
        status=str(row[11] or "unknown"),
    )


def build_capability_map(model_rows: list[tuple[object, ...]]) -> dict[str, str]:
    capability_map: dict[str, str] = {}
    for row in model_rows:
        capability_map[str(row[0])] = str(row[2] or "unknown")
    return capability_map


def build_metrics(
    api_calls: list[ApiCallRow],
    run_rows: list[tuple[object, ...]],
    capability_map: dict[str, str],
) -> list[AdminAiRouteMetricRecord]:
    run_outcomes = _build_run_outcomes(run_rows, api_calls)
    grouped_calls: dict[RouteGroupKey, list[ApiCallRow]] = {}
    for api_call in api_calls:
        key = route_group_key(api_call.route_id, api_call.route_key, api_call.provider, api_call.model_id)
        grouped_calls.setdefault(key, []).append(api_call)

    metrics: list[AdminAiRouteMetricRecord] = []
    for key, route_calls in grouped_calls.items():
        run_ids = {api_call.run_id for api_call in route_calls}
        direct_wins = 0
        fallback_wins = 0
        terminal_failures = 0
        for run_id in run_ids:
            outcome = run_outcomes.get(run_id)
            if outcome is None:
                terminal_failures += 1
                continue
            if outcome.final_status == "succeeded":
                if route_keys_match(key, outcome.final_route):
                    direct_wins += 1
                else:
                    fallback_wins += 1
            else:
                terminal_failures += 1

        succeeded_calls = sum(1 for api_call in route_calls if api_call.status == "succeeded")
        metrics.append(
            AdminAiRouteMetricRecord(
                averageAttemptsPerRun=round_float(ratio(len(route_calls), len(run_ids))),
                avgLatencyMs=average_latency(route_calls),
                capability=capability_map.get(key.model_id, infer_capability(key.model_id, key.route_key)),
                calls=len(route_calls),
                creditsCharged=sum(api_call.credits_charged for api_call in route_calls),
                directWinRate=rate(direct_wins, len(run_ids)),
                directWins=direct_wins,
                failedCalls=len(route_calls) - succeeded_calls,
                fallbackWins=fallback_wins,
                lastCalledAt=latest_created_at(route_calls),
                modelId=key.model_id,
                provider=key.provider,
                providerCost=sum(api_call.provider_cost for api_call in route_calls),
                providerCurrency=resolve_currency(route_calls),
                routeAttemptSuccessRate=rate(succeeded_calls, len(route_calls)),
                routeHitRuns=len(run_ids),
                routeId=key.route_id,
                routeKey=key.route_key,
                succeededCalls=succeeded_calls,
                terminalFailures=terminal_failures,
            )
        )
    return metrics


def build_totals(metrics: list[AdminAiRouteMetricRecord]) -> AdminAiRouteMetricsTotals:
    total_calls = sum(metric.calls for metric in metrics)
    total_route_hit_runs = sum(metric.route_hit_runs for metric in metrics)
    total_direct_wins = sum(metric.direct_wins for metric in metrics)
    total_succeeded_calls = sum(metric.succeeded_calls for metric in metrics)
    return AdminAiRouteMetricsTotals(
        averageAttemptsPerRun=round_float(ratio(total_calls, total_route_hit_runs)),
        calls=total_calls,
        creditsCharged=sum(metric.credits_charged for metric in metrics),
        directWinRate=rate(total_direct_wins, total_route_hit_runs),
        directWins=total_direct_wins,
        failedCalls=sum(metric.failed_calls for metric in metrics),
        fallbackWins=sum(metric.fallback_wins for metric in metrics),
        providerCost=sum(metric.provider_cost for metric in metrics),
        routeAttemptSuccessRate=rate(total_succeeded_calls, total_calls),
        routeHitRuns=total_route_hit_runs,
        succeededCalls=total_succeeded_calls,
        terminalFailures=sum(metric.terminal_failures for metric in metrics),
    )


def round_float(value: Optional[float]) -> float:
    return round(float(value or 0), 2)


def ratio(numerator: int, denominator: int) -> Optional[float]:
    if denominator <= 0:
        return None
    return round_float(numerator / denominator)


def rate(numerator: int, denominator: int) -> Optional[float]:
    if denominator <= 0:
        return None
    return round_float((numerator / denominator) * 100)


def to_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def average_latency(api_calls: list[ApiCallRow]) -> int:
    latencies = [api_call.latency_ms for api_call in api_calls if api_call.latency_ms > 0]
    if not latencies:
        return 0
    return int(sum(latencies) / len(latencies))


def latest_created_at(api_calls: list[ApiCallRow]) -> Optional[str]:
    if not api_calls:
        return None
    latest = max(api_calls, key=lambda api_call: timestamp(api_call.created_at))
    return latest.created_at


def resolve_currency(api_calls: list[ApiCallRow]) -> Optional[str]:
    for api_call in api_calls:
        if api_call.provider_currency:
            return api_call.provider_currency
    return None


def infer_capability(model_id: str, route_key: str) -> str:
    text = f"{model_id} {route_key}".lower()
    if "video" in text:
        return "video_generation"
    if "text" in text or "chat" in text:
        return "text"
    if "analysis" in text:
        return "image_analysis"
    if "edit" in text:
        return "image_edit"
    return "image_generation"


def route_group_key(route_id: Optional[str], route_key: str, provider: str, model_id: str) -> RouteGroupKey:
    return RouteGroupKey(
        model_id=str(model_id or "unknown"),
        provider=str(provider or ""),
        route_id=str(route_id) if route_id not in (None, "") else None,
        route_key=str(route_key or ""),
    )


def route_keys_match(left: RouteGroupKey, right: RouteGroupKey) -> bool:
    if left.route_id and right.route_id:
        return left.route_id == right.route_id
    return left.route_key == right.route_key and left.provider == right.provider and left.model_id == right.model_id


def timestamp(value: Optional[str]) -> float:
    if not value:
        return 0
    normalized = value.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(normalized).timestamp()
    except ValueError:
        return 0


def parse_attempt_number(call_id: str) -> int:
    prefix, marker, suffix = call_id.rpartition("_a")
    if not prefix or marker != "_a":
        return 1
    return int(suffix) if suffix.isdigit() else 1


def _build_run_outcomes(run_rows: list[tuple[object, ...]], api_calls: list[ApiCallRow]) -> dict[str, RunOutcome]:
    outcomes: dict[str, RunOutcome] = {}
    attempts_by_run: dict[str, list[ApiCallRow]] = {}
    for api_call in api_calls:
        attempts_by_run.setdefault(api_call.run_id, []).append(api_call)

    for run_id, attempts in attempts_by_run.items():
        sorted_attempts = sorted(attempts, key=lambda attempt: (timestamp(attempt.created_at), parse_attempt_number(attempt.id), attempt.id))
        final_attempt = sorted_attempts[-1]
        outcomes[run_id] = RunOutcome(
            final_route=route_group_key(final_attempt.route_id, final_attempt.route_key, final_attempt.provider, final_attempt.model_id),
            final_status=final_attempt.status,
        )

    for row in run_rows:
        run_id = str(row[0] or "")
        prior_outcome = outcomes.get(run_id)
        route_id = str(row[17]) if row[17] not in (None, "") else (prior_outcome.final_route.route_id if prior_outcome else None)
        route_key = str(row[18] or (prior_outcome.final_route.route_key if prior_outcome else ""))
        provider = str(row[7] or (prior_outcome.final_route.provider if prior_outcome else ""))
        model_id = str(row[6] or (prior_outcome.final_route.model_id if prior_outcome else "unknown"))
        outcomes[run_id] = RunOutcome(
            final_route=route_group_key(route_id, route_key, provider, model_id),
            final_status=str(row[8] or (prior_outcome.final_status if prior_outcome else "unknown")),
        )
    return outcomes
