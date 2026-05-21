import json
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.schemas import AdminRoleRecord


def grant_admin_role(
    *,
    actor_user_id: str,
    target_user_id: str,
    role: str,
    permissions: Optional[dict[str, Any]] = None,
    note: Optional[str] = None,
    reason: str,
    workspace_id: Optional[str] = None,
    db_connect: Any,
    require_database_url: Any,
    load_active_admin_roles: Any,
    clear_admin_role_cache: Any,
    insert_admin_audit_log: Any,
) -> tuple[AdminRoleRecord, str]:
    require_database_url()
    normalized_role = _normalize_admin_role_name(role)
    normalized_reason = _normalize_admin_mutation_reason(reason)
    coerced_permissions = _coerce_json_dict(permissions)

    with db_connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1 FROM tangent_users WHERE id = %s", (target_user_id,))
            if cursor.fetchone() is None:
                raise HTTPException(status_code=404, detail="Target user not found.")
            cursor.execute(
                """
                INSERT INTO tangent_admin_roles (
                    user_id,
                    role,
                    permissions,
                    note,
                    granted_by,
                    revoked_at
                ) VALUES (%s, %s, %s::jsonb, %s, %s, NULL)
                ON CONFLICT (user_id, role) DO UPDATE SET
                    permissions = EXCLUDED.permissions,
                    note = EXCLUDED.note,
                    granted_by = EXCLUDED.granted_by,
                    revoked_at = NULL
                """,
                (
                    target_user_id,
                    normalized_role,
                    json.dumps(coerced_permissions),
                    note,
                    actor_user_id,
                ),
            )
            audit_id = insert_admin_audit_log(
                cursor,
                action="admin.role.grant",
                actor_user_id=actor_user_id,
                metadata={"permissions": coerced_permissions, "reason": normalized_reason, "role": normalized_role},
                target_user_id=target_user_id,
                workspace_id=workspace_id,
            )
        connection.commit()

    clear_admin_role_cache(target_user_id)
    granted = next((item for item in load_active_admin_roles(user_id=target_user_id) if item.role == normalized_role), None)
    if granted is None:
        raise HTTPException(status_code=404, detail="Admin role grant failed.")
    return granted, audit_id


def revoke_admin_role(
    *,
    actor_user_id: str,
    target_user_id: str,
    role: str,
    reason: str,
    workspace_id: Optional[str] = None,
    db_connect: Any,
    require_database_url: Any,
    load_active_admin_roles: Any,
    count_active_admin_roles: Any,
    clear_admin_role_cache: Any,
    insert_admin_audit_log: Any,
) -> tuple[AdminRoleRecord, str]:
    require_database_url()
    normalized_role = _normalize_admin_role_name(role)
    normalized_reason = _normalize_admin_mutation_reason(reason)
    active_roles = load_active_admin_roles(user_id=target_user_id)
    target_role = next((item for item in active_roles if item.role == normalized_role), None)
    if target_role is None:
        raise HTTPException(status_code=404, detail="Active admin role not found.")
    if normalized_role == "owner" and count_active_admin_roles(role="owner") <= 1:
        raise HTTPException(status_code=400, detail="Cannot revoke the last active owner role.")

    with db_connect() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE tangent_admin_roles
                SET revoked_at = NOW()
                WHERE user_id = %s AND role = %s AND revoked_at IS NULL
                """,
                (target_user_id, normalized_role),
            )
            audit_id = insert_admin_audit_log(
                cursor,
                action="admin.role.revoke",
                actor_user_id=actor_user_id,
                metadata={"reason": normalized_reason, "role": normalized_role},
                target_user_id=target_user_id,
                workspace_id=workspace_id,
            )
        connection.commit()
    clear_admin_role_cache(target_user_id)
    return target_role, audit_id


def _normalize_admin_role_name(role: str) -> str:
    normalized = role.strip().lower()
    if normalized not in {"owner", "admin", "finance"}:
        raise HTTPException(status_code=400, detail="Invalid admin role.")
    return normalized


def _normalize_admin_mutation_reason(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized:
        raise HTTPException(status_code=400, detail="Admin role mutation reason is required.")
    return normalized[:500]


def _coerce_json_dict(value: Optional[dict[str, Any]]) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}
