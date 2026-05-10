from typing import Optional

from tangent_api.admin_ai_analytics_schemas import (
    AdminAiRouteMetricsResponse,
)
from tangent_api.admin_ai_route_metrics_aggregation import api_call_from_row, build_capability_map, build_metrics, build_totals
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def list_admin_ai_route_metrics(
    *,
    capability: Optional[str] = None,
    limit: int = 25,
) -> AdminAiRouteMetricsResponse:
    require_database_url()
    api_call_rows, run_rows, model_rows = _load_metric_rows()
    capability_map = build_capability_map(model_rows)
    api_calls = [api_call_from_row(row) for row in api_call_rows]
    metrics = build_metrics(api_calls, run_rows, capability_map)
    if capability:
        normalized_capability = capability.strip().lower()
        metrics = [
            metric for metric in metrics
            if metric.capability.lower() == normalized_capability or normalized_capability in metric.capability.lower()
        ]
    metrics.sort(key=lambda metric: (-metric.calls, -metric.credits_charged, metric.route_key))
    return AdminAiRouteMetricsResponse(ok=True, metrics=metrics[:limit], totals=build_totals(metrics))


def _load_metric_rows() -> tuple[list[tuple[object, ...]], list[tuple[object, ...]], list[tuple[object, ...]]]:
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, workspace_id, user_id, run_id, board_id, node_id, model_id, provider,
                       route_key, route_id, pricing_rule_id, status, latency_ms, credits_charged,
                       credits_refunded, provider_cost, provider_currency, error_code, created_at
                FROM tangent_ai_api_calls
                ORDER BY created_at DESC
                """
            )
            api_call_rows = cursor.fetchall()
            cursor.execute(
                """
                SELECT id, workspace_id, created_by, board_id, node_id, run_type, model_id, provider,
                       status, input_asset_ids, output_asset_ids, prompt_preview, estimated_credits,
                       cost_credits, charged_account_id, charged_scope, pricing_rule_id, route_id,
                       route_key, selected_tier_key, preflight_status, latency_ms, error_message,
                       created_at, updated_at, provider_cost, provider_currency
                FROM tangent_ai_runs
                ORDER BY created_at DESC
                """
            )
            run_rows = cursor.fetchall()
            cursor.execute(
                """
                SELECT model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
                       estimated_latency, enabled, is_default, provider_key, default_tier_key,
                       default_pricing_rule_id, created_at, updated_at
                FROM tangent_model_registry
                ORDER BY updated_at DESC, model_key ASC
                """
            )
            model_rows = cursor.fetchall()
    return api_call_rows, run_rows, model_rows
