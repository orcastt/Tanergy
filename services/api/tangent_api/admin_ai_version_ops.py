import json
from typing import Any, Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.admin_ai_control_plane_schemas import AdminAiControlPlaneVersionRecord
from tangent_api.admin_ai_version_support import (
    activate_pricing_rule,
    load_current_snapshot,
    normalize_resource_type,
    restore_snapshot,
    version_from_row,
)


def list_admin_ai_versions(
    *,
    db_connect: Any,
    require_database_url: Any,
    resource_type: str,
    resource_id: str,
    limit: int,
) -> list[AdminAiControlPlaneVersionRecord]:
    normalized_type = normalize_resource_type(resource_type)
    require_database_url()
    with db_connect() as connection:
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
    return [version_from_row(row) for row in rows]


def publish_admin_ai_version(
    *,
    db_connect: Any,
    require_database_url: Any,
    resource_type: str,
    resource_id: str,
    actor_user_id: str,
    workspace_id: str,
    note: Optional[str],
) -> AdminAiControlPlaneVersionRecord:
    normalized_type = normalize_resource_type(resource_type)
    require_database_url()
    with db_connect() as connection:
        with connection.cursor() as cursor:
            snapshot = load_current_snapshot(cursor, normalized_type, resource_id)
            if normalized_type == "pricing_rule":
                activate_pricing_rule(cursor, snapshot)
                snapshot = load_current_snapshot(cursor, normalized_type, resource_id)
            version = insert_version(cursor, normalized_type, resource_id, snapshot, "publish", actor_user_id, workspace_id, note)
        connection.commit()
    return version


def rollback_admin_ai_version(
    *,
    db_connect: Any,
    require_database_url: Any,
    resource_type: str,
    resource_id: str,
    version_id: str,
    actor_user_id: str,
    workspace_id: str,
    note: Optional[str],
) -> AdminAiControlPlaneVersionRecord:
    normalized_type = normalize_resource_type(resource_type)
    require_database_url()
    with db_connect() as connection:
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
            restore_snapshot(cursor, normalized_type, resource_id, snapshot)
            restored_snapshot = load_current_snapshot(cursor, normalized_type, resource_id)
            version = insert_version(cursor, normalized_type, resource_id, restored_snapshot, "rollback", actor_user_id, workspace_id, note)
        connection.commit()
    return version


def insert_version(
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
    return version_from_row(row)
