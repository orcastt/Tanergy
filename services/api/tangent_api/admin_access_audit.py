import json
from typing import Any, Optional
from uuid import uuid4


def write_admin_audit_log(
    *,
    action: str,
    actor_user_id: Optional[str],
    metadata: Optional[dict[str, Any]] = None,
    target_user_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
    db_connect: Any,
    require_database_url: Any,
) -> str:
    require_database_url()

    with db_connect() as connection:
        with connection.cursor() as cursor:
            audit_id = _insert_admin_audit_log(
                cursor,
                action=action,
                actor_user_id=actor_user_id,
                metadata=metadata,
                target_user_id=target_user_id,
                workspace_id=workspace_id,
            )
        connection.commit()
    return audit_id


def _insert_admin_audit_log(
    cursor: Any,
    *,
    action: str,
    actor_user_id: Optional[str],
    metadata: Optional[dict[str, Any]] = None,
    target_user_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> str:
    audit_id = f"admin_audit_{uuid4()}"
    safe_workspace_id = _coerce_existing_workspace_id(cursor, workspace_id)
    cursor.execute(
        """
        INSERT INTO tangent_admin_audit_logs (
            id,
            actor_user_id,
            target_user_id,
            workspace_id,
            action,
            metadata
        ) VALUES (%s, %s, %s, %s, %s, %s::jsonb)
        """,
        (
            audit_id,
            actor_user_id,
            target_user_id,
            safe_workspace_id,
            action,
            json.dumps(_coerce_json_dict(metadata)),
        ),
    )
    return audit_id


def _coerce_json_dict(value: Optional[dict[str, Any]]) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


def _coerce_existing_workspace_id(cursor: Any, workspace_id: Optional[str]) -> Optional[str]:
    if not workspace_id:
        return None
    cursor.execute("SELECT 1 FROM tangent_workspaces WHERE id = %s", (workspace_id,))
    return workspace_id if cursor.fetchone() is not None else None
