from typing import Optional

from tangent_api.admin_ai_analytics_schemas import (
    AdminAiRouteMetricRecord,
    AdminAiRouteMetricsResponse,
    AdminAiRouteMetricsTotals,
)
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def list_admin_ai_route_metrics(
    *,
    capability: Optional[str] = None,
    limit: int = 25,
) -> AdminAiRouteMetricsResponse:
    require_database_url()
    rows = _fetchall(
        """
        SELECT c.route_key, c.provider, c.model_id, COALESCE(m.capability, 'unknown'),
               COUNT(*) AS calls,
               COALESCE(SUM(c.credits_charged), 0) AS credits_charged,
               COALESCE(SUM(c.credits_refunded), 0) AS credits_refunded,
               COALESCE(SUM(c.provider_cost), 0) AS provider_cost,
               COALESCE(MAX(c.provider_currency), '') AS provider_currency,
               COALESCE(SUM(CASE WHEN c.status = 'succeeded' THEN 1 ELSE 0 END), 0) AS succeeded_calls,
               COALESCE(SUM(CASE WHEN c.status <> 'succeeded' THEN 1 ELSE 0 END), 0) AS failed_calls,
               COALESCE(AVG(NULLIF(c.latency_ms, 0)), 0) AS avg_latency_ms,
               MAX(c.created_at) AS last_called_at
        FROM tangent_ai_api_calls c
        LEFT JOIN tangent_model_registry m ON m.model_key = c.model_id
        GROUP BY c.route_key, c.provider, c.model_id, COALESCE(m.capability, 'unknown')
        ORDER BY calls DESC, credits_charged DESC, c.route_key ASC
        LIMIT %s
        """,
        (limit,),
    )
    metrics = [_metric_from_row(row) for row in rows]
    if capability:
        metrics = [metric for metric in metrics if metric.capability == capability or capability in metric.capability]
    totals = AdminAiRouteMetricsTotals(
        calls=sum(metric.calls for metric in metrics),
        creditsCharged=sum(metric.credits_charged for metric in metrics),
        failedCalls=sum(metric.failed_calls for metric in metrics),
        providerCost=sum(metric.provider_cost for metric in metrics),
        succeededCalls=sum(metric.succeeded_calls for metric in metrics),
    )
    return AdminAiRouteMetricsResponse(ok=True, metrics=metrics[:limit], totals=totals)


def _fetchall(query: str, params: tuple[object, ...]) -> list[tuple[object, ...]]:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()


def _metric_from_row(row: tuple[object, ...]) -> AdminAiRouteMetricRecord:
    return AdminAiRouteMetricRecord(
        avgLatencyMs=int(row[11] or 0),
        capability=str(row[3] or 'unknown'),
        calls=int(row[4] or 0),
        creditsCharged=float(row[5] or 0),
        failedCalls=int(row[10] or 0),
        lastCalledAt=_to_iso(row[12]),
        modelId=str(row[2]),
        provider=str(row[1]),
        providerCost=float(row[7] or 0),
        providerCurrency=str(row[8]) if row[8] not in (None, '') else None,
        routeKey=str(row[0] or ''),
        succeededCalls=int(row[9] or 0),
    )


def _to_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
