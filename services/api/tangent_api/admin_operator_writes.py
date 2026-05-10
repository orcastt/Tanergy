from typing import Optional

from fastapi import HTTPException

from tangent_api.admin_access import _count_active_admin_roles, _insert_admin_audit_log, load_active_admin_roles
from tangent_api.admin_operator_schemas import AdminOperatorUserMutationResponse
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def set_admin_operator_user_status(
    *,
    actor_user_id: str,
    reason: str,
    status: str,
    user_id: str,
    workspace_id: Optional[str] = None,
) -> AdminOperatorUserMutationResponse:
    require_database_url()
    normalized_status = _normalize_status(status)
    normalized_reason = _normalize_reason(reason)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            current_status = _load_user_status(cursor, user_id, include_deleted=False)
            if current_status == normalized_status:
                raise HTTPException(status_code=400, detail=f"User is already {normalized_status}.")
            _guard_last_active_owner(user_id, normalized_status)
            cursor.execute(
                """
                UPDATE tangent_users
                SET status = %s,
                    updated_at = NOW()
                WHERE id = %s
                """,
                (normalized_status, user_id),
            )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.user.status",
                actor_user_id=actor_user_id,
                metadata={"reason": normalized_reason, "status": normalized_status},
                target_user_id=user_id,
                workspace_id=workspace_id,
            )
        connection.commit()

    return AdminOperatorUserMutationResponse(
        auditId=audit_id,
        message=f"User status updated to {normalized_status}.",
        ok=True,
        status=normalized_status,
        userId=user_id,
    )


def soft_delete_admin_operator_user(
    *,
    actor_user_id: str,
    reason: str,
    user_id: str,
    workspace_id: Optional[str] = None,
) -> AdminOperatorUserMutationResponse:
    require_database_url()
    normalized_reason = _normalize_reason(reason)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            current_status = _load_user_status(cursor, user_id, include_deleted=True)
            if current_status == "deleted":
                raise HTTPException(status_code=400, detail="User is already deleted.")
            _guard_last_active_owner(user_id, "deleted")
            cursor.execute(
                """
                UPDATE tangent_users
                SET status = 'deleted',
                    updated_at = NOW()
                WHERE id = %s
                """,
                (user_id,),
            )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.user.delete",
                actor_user_id=actor_user_id,
                metadata={"reason": normalized_reason, "status": "deleted"},
                target_user_id=user_id,
                workspace_id=workspace_id,
            )
        connection.commit()

    return AdminOperatorUserMutationResponse(
        auditId=audit_id,
        message="User deleted.",
        ok=True,
        status="deleted",
        userId=user_id,
    )


def _load_user_status(cursor: object, user_id: str, *, include_deleted: bool) -> str:
    where = "WHERE id = %s" if include_deleted else "WHERE id = %s AND COALESCE(status, 'active') <> 'deleted'"
    cursor.execute(f"SELECT COALESCE(status, 'active') FROM tangent_users {where} LIMIT 1", (user_id,))
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="User not found.")
    return str(row[0] or "active")


def _guard_last_active_owner(user_id: str, next_status: str) -> None:
    if next_status == "active":
        return
    roles = load_active_admin_roles(user_id)
    if not any(role.role == "owner" for role in roles):
        return
    if _count_active_admin_roles("owner") <= 1:
        raise HTTPException(status_code=400, detail="Cannot suspend or delete the last active owner.")


def _normalize_reason(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Reason is required.")
    return normalized


def _normalize_status(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in {"active", "suspended"}:
        raise HTTPException(status_code=400, detail="Invalid user status.")
    return normalized
