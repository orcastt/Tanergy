import json
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.admin_ai_control_plane_schemas import AdminAiControlPlaneVersionRecord
from tangent_api.admin_ai_control_plane import connect_to_postgres
from tangent_api.storage.postgres_connection import require_database_url

RESOURCE_TYPES = {"model", "pricing_rule", "provider_route"}


def list_admin_ai_versions(resource_type: str, resource_id: str, limit: int) -> list[AdminAiControlPlaneVersionRecord]:
    normalized_type = _normalize_resource_type(resource_type)
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, resource_type, resource_id, version_number, action, snapshot, note,
                       actor_user_id, workspace_id, published_at, created_at
                FROM tangent_ai_control_plane_versions
                WHERE resource_type = %s
                  AND resource_id = %s
                ORDER BY version_number DESC, created_at DESC
                LIMIT %s
                """,
                (normalized_type, resource_id, limit),
            )
            rows = cursor.fetchall()
    return [_version_from_row(row) for row in rows]


def publish_admin_ai_version(
    resource_type: str,
    resource_id: str,
    *,
    actor_user_id: str,
    workspace_id: str,
    note: Optional[str],
) -> AdminAiControlPlaneVersionRecord:
    normalized_type = _normalize_resource_type(resource_type)
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            snapshot = _load_current_snapshot(cursor, normalized_type, resource_id)
            if normalized_type == "pricing_rule":
                _activate_pricing_rule(cursor, snapshot)
                snapshot = _load_current_snapshot(cursor, normalized_type, resource_id)
            version = _insert_version(cursor, normalized_type, resource_id, snapshot, "publish", actor_user_id, workspace_id, note)
        connection.commit()
    return version


def rollback_admin_ai_version(
    resource_type: str,
    resource_id: str,
    version_id: str,
    *,
    actor_user_id: str,
    workspace_id: str,
    note: Optional[str],
) -> AdminAiControlPlaneVersionRecord:
    normalized_type = _normalize_resource_type(resource_type)
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT snapshot
                FROM tangent_ai_control_plane_versions
                WHERE id = %s
                  AND resource_type = %s
                  AND resource_id = %s
                LIMIT 1
                """,
                (version_id, normalized_type, resource_id),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Control-plane version not found.")
            snapshot = dict(row[0] or {})
            _restore_snapshot(cursor, normalized_type, resource_id, snapshot)
            restored_snapshot = _load_current_snapshot(cursor, normalized_type, resource_id)
            version = _insert_version(cursor, normalized_type, resource_id, restored_snapshot, "rollback", actor_user_id, workspace_id, note)
        connection.commit()
    return version


def _insert_version(
    cursor: object,
    resource_type: str,
    resource_id: str,
    snapshot: dict[str, object],
    action: str,
    actor_user_id: str,
    workspace_id: str,
    note: Optional[str],
) -> AdminAiControlPlaneVersionRecord:
    cursor.execute(
        """
        SELECT COALESCE(MAX(version_number), 0)
        FROM tangent_ai_control_plane_versions
        WHERE resource_type = %s
          AND resource_id = %s
        """,
        (resource_type, resource_id),
    )
    next_version = int((cursor.fetchone() or [0])[0] or 0) + 1
    version_id = f"ai_cp_ver_{uuid4()}"
    cursor.execute(
        """
        INSERT INTO tangent_ai_control_plane_versions (
            id,
            resource_type,
            resource_id,
            version_number,
            action,
            snapshot,
            note,
            actor_user_id,
            workspace_id,
            published_at
        )
        VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s, NOW())
        RETURNING id, resource_type, resource_id, version_number, action, snapshot, note,
                  actor_user_id, workspace_id, published_at, created_at
        """,
        (
            version_id,
            resource_type,
            resource_id,
            next_version,
            action,
            json.dumps(snapshot),
            note,
            actor_user_id,
            workspace_id,
        ),
    )
    row = cursor.fetchone()
    return _version_from_row(row)


def _load_current_snapshot(cursor: object, resource_type: str, resource_id: str) -> dict[str, object]:
    if resource_type == "model":
        cursor.execute(
            """
            SELECT model_key, display_name, capability, capabilities, parameter_schema, cost_hint,
                   estimated_latency, enabled, is_default, provider_key, default_tier_key,
                   default_pricing_rule_id
            FROM tangent_model_registry
            WHERE model_key = %s
            LIMIT 1
            """,
            (resource_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Model not found.")
        return {
            "model_key": row[0],
            "display_name": row[1],
            "capability": row[2],
            "capabilities": list(row[3] or []),
            "parameter_schema": row[4] or {},
            "cost_hint": row[5] or "",
            "estimated_latency": row[6] or "",
            "enabled": bool(row[7]),
            "is_default": bool(row[8]),
            "provider_key": row[9],
            "default_tier_key": row[10],
            "default_pricing_rule_id": row[11],
        }
    if resource_type == "provider_route":
        cursor.execute(
            """
            SELECT id, model_key, provider_key, provider_model, route_key, priority, weight,
                   health_status, timeout_ms, retry_policy, enabled
            FROM tangent_model_provider_routes
            WHERE id = %s
            LIMIT 1
            """,
            (resource_id,),
        )
        row = cursor.fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Provider route not found.")
        return {
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
    cursor.execute(
        """
        SELECT id, model_key, tier_key, billing_unit, estimated_credits, min_credits,
               credit_multiplier, provider_cost_formula, status, effective_from, effective_to
        FROM tangent_model_pricing_rules
        WHERE id = %s
        LIMIT 1
        """,
        (resource_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Pricing rule not found.")
    return {
        "id": row[0],
        "model_key": row[1],
        "tier_key": row[2],
        "billing_unit": row[3],
        "estimated_credits": float(row[4] or 0),
        "min_credits": float(row[5] or 0),
        "credit_multiplier": float(row[6] or 1),
        "provider_cost_formula": row[7] or {},
        "status": row[8],
        "effective_from": _to_iso(row[9]),
        "effective_to": _to_iso(row[10]) if row[10] else None,
    }


def _restore_snapshot(cursor: object, resource_type: str, resource_id: str, snapshot: dict[str, object]) -> None:
    if resource_type == "model":
        if snapshot.get("is_default"):
            cursor.execute(
                """
                UPDATE tangent_model_registry
                SET is_default = FALSE,
                    updated_at = NOW()
                WHERE model_key <> %s
                  AND is_default = TRUE
                """,
                (resource_id,),
            )
        cursor.execute(
            """
            UPDATE tangent_model_registry
            SET display_name = %s,
                capability = %s,
                capabilities = %s::jsonb,
                parameter_schema = %s::jsonb,
                cost_hint = %s,
                estimated_latency = %s,
                enabled = %s,
                is_default = %s,
                provider_key = %s,
                default_tier_key = %s,
                default_pricing_rule_id = %s,
                updated_at = NOW()
            WHERE model_key = %s
            """,
            (
                snapshot.get("display_name"),
                snapshot.get("capability"),
                json.dumps(snapshot.get("capabilities") or []),
                json.dumps(snapshot.get("parameter_schema") or {}),
                snapshot.get("cost_hint") or "",
                snapshot.get("estimated_latency") or "",
                bool(snapshot.get("enabled", True)),
                bool(snapshot.get("is_default", False)),
                snapshot.get("provider_key"),
                snapshot.get("default_tier_key"),
                snapshot.get("default_pricing_rule_id"),
                resource_id,
            ),
        )
        return
    if resource_type == "provider_route":
        cursor.execute(
            """
            UPDATE tangent_model_provider_routes
            SET model_key = %s,
                provider_key = %s,
                provider_model = %s,
                route_key = %s,
                priority = %s,
                weight = %s,
                health_status = %s,
                timeout_ms = %s,
                retry_policy = %s::jsonb,
                enabled = %s,
                updated_at = NOW()
            WHERE id = %s
            """,
            (
                snapshot.get("model_key"),
                snapshot.get("provider_key"),
                snapshot.get("provider_model"),
                snapshot.get("route_key"),
                int(snapshot.get("priority") or 0),
                int(snapshot.get("weight") or 0),
                snapshot.get("health_status") or "unknown",
                int(snapshot.get("timeout_ms") or 60000),
                json.dumps(snapshot.get("retry_policy") or {}),
                bool(snapshot.get("enabled", True)),
                resource_id,
            ),
        )
        return
    cursor.execute(
        """
        UPDATE tangent_model_pricing_rules
        SET model_key = %s,
            tier_key = %s,
            billing_unit = %s,
            estimated_credits = %s,
            min_credits = %s,
            credit_multiplier = %s,
            provider_cost_formula = %s::jsonb,
            status = %s,
            effective_from = %s,
            effective_to = %s,
            updated_at = NOW()
        WHERE id = %s
        """,
        (
            snapshot.get("model_key"),
            snapshot.get("tier_key"),
            snapshot.get("billing_unit"),
            float(snapshot.get("estimated_credits") or 0),
            float(snapshot.get("min_credits") or 0),
            float(snapshot.get("credit_multiplier") or 1),
            json.dumps(snapshot.get("provider_cost_formula") or {}),
            snapshot.get("status") or "draft",
            snapshot.get("effective_from"),
            snapshot.get("effective_to"),
            resource_id,
        ),
    )
    if snapshot.get("status") == "active":
        _activate_pricing_rule(cursor, snapshot)


def _activate_pricing_rule(cursor: object, snapshot: dict[str, object]) -> None:
    cursor.execute(
        """
        UPDATE tangent_model_pricing_rules
        SET status = CASE WHEN id = %s THEN 'active' ELSE 'retired' END,
            updated_at = NOW()
        WHERE model_key = %s
          AND COALESCE(tier_key, '') = COALESCE(%s, '')
          AND status IN ('draft', 'active')
        """,
        (
            snapshot["id"],
            snapshot["model_key"],
            snapshot.get("tier_key"),
        ),
    )


def _normalize_resource_type(value: str) -> str:
    normalized = value.strip()
    if normalized not in RESOURCE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid control-plane resource type.")
    return normalized


def _version_from_row(row: tuple[object, ...]) -> AdminAiControlPlaneVersionRecord:
    return AdminAiControlPlaneVersionRecord(
        action=str(row[4]),
        actorUserId=row[7],
        createdAt=_to_iso(row[10]),
        id=str(row[0]),
        note=row[6],
        publishedAt=_to_iso(row[9]) if row[9] else None,
        resourceId=str(row[2]),
        resourceType=str(row[1]),
        snapshot=dict(row[5] or {}),
        versionNumber=int(row[3] or 0),
        workspaceId=row[8],
    )


def _to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
