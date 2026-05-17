import os
import time
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.admin_access_audit import _insert_admin_audit_log, write_admin_audit_log as _write_admin_audit_log_impl
from tangent_api.admin_access_reads import (
    count_active_admin_roles as _count_active_admin_roles_impl,
    list_admin_audit_logs as _list_admin_audit_logs_impl,
    list_admin_boards as _list_admin_boards_impl,
    list_admin_users as _list_admin_users_impl,
    list_admin_workspaces as _list_admin_workspaces_impl,
    load_active_admin_roles as _load_active_admin_roles_impl,
    load_admin_summary as _load_admin_summary_impl,
)
from tangent_api.admin_access_writes import grant_admin_role as _grant_admin_role_impl, revoke_admin_role as _revoke_admin_role_impl
from tangent_api.request_context import ApiRequestContext
from tangent_api.schemas import AdminRoleRecord
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

ADMIN_ACCESS_ROLES = {"owner", "admin", "support", "analyst", "finance", "moderator"}
_ADMIN_ROLE_CACHE_MAX = 256
_ADMIN_ROLE_CACHE: dict[tuple[str, str, int], tuple[float, list[AdminRoleRecord]]] = {}


def load_active_admin_roles(user_id: str) -> list[AdminRoleRecord]:
    try:
        database_url = require_database_url()
    except HTTPException:
        return []

    cache_key = (database_url, user_id, id(connect_to_postgres))
    ttl_seconds = _admin_role_cache_seconds()
    if ttl_seconds > 0:
        cached = _ADMIN_ROLE_CACHE.get(cache_key)
        now = time.monotonic()
        if cached and now - cached[0] <= ttl_seconds:
            return list(cached[1])

    roles = _load_active_admin_roles_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        user_id=user_id,
    )
    if ttl_seconds > 0:
        if len(_ADMIN_ROLE_CACHE) >= _ADMIN_ROLE_CACHE_MAX:
            _ADMIN_ROLE_CACHE.clear()
        _ADMIN_ROLE_CACHE[cache_key] = (time.monotonic(), roles)
    return list(roles)


def is_global_admin(user_id: str) -> bool:
    return any(role.role in ADMIN_ACCESS_ROLES for role in load_active_admin_roles(user_id))


def require_admin_role(
    context: ApiRequestContext,
    allowed_roles: Optional[set[str]] = None,
) -> list[AdminRoleRecord]:
    try:
        require_database_url()
    except HTTPException as exc:
        raise HTTPException(status_code=503, detail="Admin access requires Postgres configuration.") from exc

    roles = load_active_admin_roles(context.user_id)
    if not roles:
        raise HTTPException(status_code=403, detail="Admin role required.")

    if allowed_roles and not any(role.role in allowed_roles for role in roles):
        raise HTTPException(status_code=403, detail="Admin role does not grant this action.")
    return roles


def load_admin_summary():
    return _load_admin_summary_impl(db_connect=connect_to_postgres, require_database_url=require_database_url)


def list_admin_users(limit: int):
    return _list_admin_users_impl(db_connect=connect_to_postgres, require_database_url=require_database_url, limit=limit)


def list_admin_workspaces(limit: int):
    return _list_admin_workspaces_impl(db_connect=connect_to_postgres, require_database_url=require_database_url, limit=limit)


def list_admin_boards(limit: int):
    return _list_admin_boards_impl(db_connect=connect_to_postgres, require_database_url=require_database_url, limit=limit)


def list_admin_audit_logs(
    *,
    limit: int,
    action: Optional[str] = None,
    actor_user_id: Optional[str] = None,
    target_user_id: Optional[str] = None,
):
    return _list_admin_audit_logs_impl(
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        limit=limit,
        action=action,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
    )


def grant_admin_role(
    *,
    actor_user_id: str,
    target_user_id: str,
    role: str,
    permissions: Optional[dict[str, Any]] = None,
    note: Optional[str] = None,
    reason: str,
    workspace_id: Optional[str] = None,
):
    return _grant_admin_role_impl(
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        role=role,
        permissions=permissions,
        note=note,
        reason=reason,
        workspace_id=workspace_id,
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        load_active_admin_roles=load_active_admin_roles,
        clear_admin_role_cache=clear_admin_role_cache,
        insert_admin_audit_log=_insert_admin_audit_log,
    )


def revoke_admin_role(
    *,
    actor_user_id: str,
    target_user_id: str,
    role: str,
    reason: str,
    workspace_id: Optional[str] = None,
):
    return _revoke_admin_role_impl(
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        role=role,
        reason=reason,
        workspace_id=workspace_id,
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
        load_active_admin_roles=load_active_admin_roles,
        count_active_admin_roles=_count_active_admin_roles,
        clear_admin_role_cache=clear_admin_role_cache,
        insert_admin_audit_log=_insert_admin_audit_log,
    )


def clear_admin_role_cache(user_id: Optional[str] = None) -> None:
    if user_id is None:
        _ADMIN_ROLE_CACHE.clear()
        return
    for key in [key for key in _ADMIN_ROLE_CACHE if key[1] == user_id]:
        _ADMIN_ROLE_CACHE.pop(key, None)


def write_admin_audit_log(
    *,
    action: str,
    actor_user_id: Optional[str],
    metadata: Optional[dict[str, Any]] = None,
    target_user_id: Optional[str] = None,
    workspace_id: Optional[str] = None,
) -> str:
    return _write_admin_audit_log_impl(
        action=action,
        actor_user_id=actor_user_id,
        metadata=metadata,
        target_user_id=target_user_id,
        workspace_id=workspace_id,
        db_connect=connect_to_postgres,
        require_database_url=require_database_url,
    )


def _admin_role_cache_seconds() -> float:
    raw = os.getenv("TANGENT_ADMIN_ROLE_CACHE_SECONDS", "5").strip()
    try:
        value = float(raw)
    except ValueError:
        return 5
    return max(0, min(value, 60))


def _count_active_admin_roles(role: str) -> int:
    return _count_active_admin_roles_impl(db_connect=connect_to_postgres, role=role)
