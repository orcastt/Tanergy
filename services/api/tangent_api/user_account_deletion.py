from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Optional

from fastapi import HTTPException

from tangent_api.admin_access import _count_active_admin_roles, _insert_admin_audit_log, load_active_admin_roles
from tangent_api.clerk_admin import delete_clerk_user
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.user_account_deletion_blockers import (
    UserAccountDeletionBlocker,
    load_account_delete_blockers,
    raise_account_delete_blocked,
)
from tangent_api.user_account_deletion_store import (
    delete_user_credit_accounts,
    delete_user_owned_resources,
    delete_user_scoped_logs,
    load_owned_solo_workspace_ids,
    load_shared_workspace_ids,
    load_user_deletion_context,
    reassign_shared_workspace_content,
)

_delete_user_credit_accounts = delete_user_credit_accounts
_delete_user_owned_resources = delete_user_owned_resources
_delete_user_scoped_logs = delete_user_scoped_logs
_load_account_delete_blockers = load_account_delete_blockers
_load_owned_solo_workspace_ids = load_owned_solo_workspace_ids
_load_shared_workspace_ids = load_shared_workspace_ids
_load_user_deletion_context = load_user_deletion_context
_raise_account_delete_blocked = raise_account_delete_blocked
_reassign_shared_workspace_content = reassign_shared_workspace_content


@dataclass(frozen=True)
class UserAccountDeletionResult:
    audit_id: Optional[str]
    deleted_solo_workspace_ids: tuple[str, ...]
    message: str
    user_id: str
    warning: Optional[str] = None


def delete_user_account(
    *,
    actor_user_id: Optional[str],
    audit_action: Optional[str],
    audit_metadata: Optional[dict[str, Any]],
    reason: str,
    target_user_id: str,
    workspace_id: Optional[str] = None,
) -> UserAccountDeletionResult:
    require_database_url()
    normalized_reason = _normalize_reason(reason)
    deletion_context = _load_user_deletion_context(target_user_id)
    _guard_last_active_owner(target_user_id)

    if deletion_context.status == "deleted":
        raise HTTPException(status_code=400, detail="User is already deleted.")

    _raise_account_delete_blocked(_load_account_delete_blockers(target_user_id))
    owned_solo_workspace_ids = _load_owned_solo_workspace_ids(target_user_id)
    shared_workspace_ids = _load_shared_workspace_ids(target_user_id)

    audit_id = None
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            if actor_user_id and audit_action:
                metadata = dict(audit_metadata or {})
                metadata.update(
                    {
                        "deletedSoloWorkspaceIds": list(owned_solo_workspace_ids),
                        "deletedUserId": target_user_id,
                        "reason": normalized_reason,
                        "sharedWorkspaceIds": list(shared_workspace_ids),
                    }
                )
                audit_id = _insert_admin_audit_log(
                    cursor,
                    action=audit_action,
                    actor_user_id=actor_user_id,
                    metadata=metadata,
                    target_user_id=target_user_id,
                    workspace_id=workspace_id,
                )

            _reassign_shared_workspace_content(cursor, target_user_id, shared_workspace_ids)
            _delete_user_scoped_logs(cursor, target_user_id)
            _delete_user_owned_resources(cursor, target_user_id, owned_solo_workspace_ids)
            _delete_user_credit_accounts(cursor, target_user_id, owned_solo_workspace_ids)
            cursor.execute("DELETE FROM tangent_users WHERE id = %s", (target_user_id,))

        if deletion_context.clerk_user_id:
            delete_clerk_user(deletion_context.clerk_user_id)

    return UserAccountDeletionResult(
        audit_id=audit_id,
        deleted_solo_workspace_ids=tuple(owned_solo_workspace_ids),
        message="User deleted.",
        user_id=target_user_id,
        warning=None,
    )


def _guard_last_active_owner(user_id: str) -> None:
    roles = load_active_admin_roles(user_id)
    if not any(role.role == "owner" for role in roles):
        return
    if _count_active_admin_roles("owner") <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the last active owner.")


def _normalize_reason(value: str) -> str:
    normalized = " ".join(value.strip().split())
    if not normalized:
        raise HTTPException(status_code=400, detail="Reason is required.")
    return normalized[:500]


__all__ = [
    "UserAccountDeletionBlocker",
    "UserAccountDeletionResult",
    "delete_user_account",
]
