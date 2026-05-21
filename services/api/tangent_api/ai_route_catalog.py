import os
from dataclasses import dataclass

from tangent_api import ai_control_plane
from tangent_api.ai_control_plane_defaults import DEFAULT_MODEL_ROWS, DEFAULT_ROUTE_ROWS


@dataclass(frozen=True)
class AiProviderRouteCandidate:
    health_status: str
    priority: int
    provider_key: str
    provider_model: str
    retry_policy: dict[str, object]
    route_id: str
    route_key: str
    timeout_ms: int
    weight: int


def list_route_candidates(model_id: str) -> list[AiProviderRouteCandidate]:
    models, routes = _load_model_and_route_rows()
    if not any(row["model_key"] == model_id and row.get("enabled", True) for row in models):
        return []
    matches = [
        row
        for row in routes
        if row["model_key"] == model_id
        and row.get("enabled", True)
        and str(row.get("health_status") or "unknown") != "failed"
    ]
    matches.sort(
        key=lambda row: (
            _health_rank(row.get("health_status")),
            int(row.get("priority", 9999)),
            -int(row.get("weight", 0)),
        )
    )
    return [
        AiProviderRouteCandidate(
            health_status=str(row.get("health_status") or "unknown"),
            priority=int(row.get("priority", 0)),
            provider_key=str(row.get("provider_key") or "unknown"),
            provider_model=str(row.get("provider_model") or model_id),
            retry_policy=dict(row.get("retry_policy") or {}),
            route_id=str(row["id"]),
            route_key=str(row.get("route_key") or row["id"]),
            timeout_ms=int(row.get("timeout_ms", 60000) or 60000),
            weight=int(row.get("weight", 0)),
        )
        for row in matches
    ]


def _load_model_and_route_rows() -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    if not os.getenv("DATABASE_URL"):
        return DEFAULT_MODEL_ROWS, DEFAULT_ROUTE_ROWS
    with ai_control_plane.connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
                       estimated_latency, enabled, is_default, provider_key, default_tier_key
                FROM tangent_model_registry
                ORDER BY is_default DESC, display_name ASC
                """
            )
            model_rows = [
                {
                    "model_key": row[0],
                    "enabled": bool(row[7]),
                }
                for row in cursor.fetchall()
            ]
            if not model_rows:
                return DEFAULT_MODEL_ROWS, DEFAULT_ROUTE_ROWS
            cursor.execute(
                """
                SELECT id, model_key, provider_key, provider_model, route_key, priority, weight, health_status,
                       timeout_ms, retry_policy, enabled, created_at, updated_at
                FROM tangent_model_provider_routes
                ORDER BY model_key ASC, priority ASC, weight DESC, updated_at DESC
                """
            )
            route_rows = [
                {
                    "id": row[0],
                    "model_key": row[1],
                    "provider_key": row[2],
                    "provider_model": row[3],
                    "route_key": row[4],
                    "priority": int(row[5] or 0),
                    "weight": int(row[6] or 0),
                    "health_status": row[7] or "unknown",
                    "timeout_ms": int(row[8] or 60000),
                    "retry_policy": row[9] or {},
                    "enabled": bool(row[10]),
                }
                for row in cursor.fetchall()
            ]
    return model_rows, route_rows


def _health_rank(status: object) -> int:
    normalized = str(status or "unknown")
    return {"healthy": 0, "unknown": 1, "degraded": 2, "disabled": 3, "failed": 4}.get(normalized, 5)
