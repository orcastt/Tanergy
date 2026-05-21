from fastapi import HTTPException

from tangent_api.admin_access import _insert_admin_audit_log
from tangent_api.admin_operator_schemas import AdminOperatorWorkspaceMemberMutationResponse
from tangent_api.plan_catalog import included_credits_for_plan
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.workspace_invitations import (
    _assert_group_member_capacity,
    _normalize_id,
    _resolve_team_invite_seat_policy,
    _upsert_team_invite_seat_assignment,
)

ALLOWED_MEMBER_ROLES = {"admin", "editor", "viewer"}
MANAGEABLE_WORKSPACE_KINDS = {"group_workspace", "team_workspace", "enterprise_workspace"}


def create_admin_operator_workspace_member(
    *,
    actor_user_id: str,
    reason: str,
    role: str,
    user_id: str,
    workspace_id: str,
) -> AdminOperatorWorkspaceMemberMutationResponse:
    require_database_url()
    normalized_reason = _normalize_reason(reason)
    normalized_role = _normalize_role(role)
    normalized_user_id = _normalize_id(user_id, "user id")

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            workspace = _load_workspace(cursor, workspace_id)
            _assert_target_user_exists(cursor, normalized_user_id)
            cursor.execute(
                """
                SELECT role
                FROM tangent_workspace_members
                WHERE workspace_id = %s
                  AND user_id = %s
                LIMIT 1
                """,
                (workspace_id, normalized_user_id),
            )
            existing = cursor.fetchone()
            if existing is not None:
                raise HTTPException(status_code=400, detail="Workspace member already exists.")
            if workspace["workspace_kind"] == "group_workspace":
                _assert_group_member_capacity(cursor, workspace_id, normalized_user_id)
            seat_policy = _resolve_team_invite_seat_policy(
                cursor,
                workspace_id,
                normalized_user_id,
                workspace["workspace_kind"],
            )
            cursor.execute(
                """
                INSERT INTO tangent_workspace_members (
                    workspace_id,
                    user_id,
                    role,
                    display_name,
                    invited_by
                )
                VALUES (%s, %s, %s, NULL, %s)
                """,
                (workspace_id, normalized_user_id, normalized_role, actor_user_id),
            )
            if seat_policy is not None:
                _upsert_team_invite_seat_assignment(
                    cursor,
                    assigned_by=actor_user_id,
                    included_credits=int(seat_policy["included_credits"] or included_credits_for_plan(str(seat_policy["plan_key"])) or 0),
                    plan_key=str(seat_policy["plan_key"]),
                    user_id=normalized_user_id,
                    workspace_id=workspace_id,
                )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.workspace_member.add",
                actor_user_id=actor_user_id,
                metadata={
                    "reason": normalized_reason,
                    "role": normalized_role,
                    "workspaceKind": workspace["workspace_kind"],
                    "workspaceName": workspace["workspace_name"],
                },
                target_user_id=normalized_user_id,
                workspace_id=workspace_id,
            )
        connection.commit()

    return AdminOperatorWorkspaceMemberMutationResponse(
        auditId=audit_id,
        message="Workspace member added.",
        ok=True,
        role=normalized_role,
        userId=normalized_user_id,
        workspaceId=workspace_id,
    )


def update_admin_operator_workspace_member_role(
    *,
    actor_user_id: str,
    reason: str,
    role: str,
    user_id: str,
    workspace_id: str,
) -> AdminOperatorWorkspaceMemberMutationResponse:
    require_database_url()
    normalized_reason = _normalize_reason(reason)
    normalized_role = _normalize_role(role)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            member = _load_workspace_member(cursor, workspace_id, user_id)
            if member["role"] == "owner":
                raise HTTPException(status_code=400, detail="Owner role cannot be changed here.")
            if member["role"] == normalized_role:
                raise HTTPException(status_code=400, detail=f"Workspace member is already {normalized_role}.")
            cursor.execute(
                """
                UPDATE tangent_workspace_members
                SET role = %s
                WHERE workspace_id = %s
                  AND user_id = %s
                """,
                (normalized_role, workspace_id, user_id),
            )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.workspace_member.role",
                actor_user_id=actor_user_id,
                metadata={
                    "newRole": normalized_role,
                    "previousRole": member["role"],
                    "reason": normalized_reason,
                    "workspaceKind": member["workspace_kind"],
                    "workspaceName": member["workspace_name"],
                },
                target_user_id=user_id,
                workspace_id=workspace_id,
            )
        connection.commit()

    return AdminOperatorWorkspaceMemberMutationResponse(
        auditId=audit_id,
        message="Workspace member role updated.",
        ok=True,
        role=normalized_role,
        userId=user_id,
        workspaceId=workspace_id,
    )


def remove_admin_operator_workspace_member(
    *,
    actor_user_id: str,
    reason: str,
    user_id: str,
    workspace_id: str,
) -> AdminOperatorWorkspaceMemberMutationResponse:
    require_database_url()
    normalized_reason = _normalize_reason(reason)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            member = _load_workspace_member(cursor, workspace_id, user_id)
            if member["role"] == "owner":
                raise HTTPException(status_code=400, detail="Owner role cannot be removed here.")
            cursor.execute(
                """
                DELETE FROM tangent_workspace_members
                WHERE workspace_id = %s
                  AND user_id = %s
                """,
                (workspace_id, user_id),
            )
            if member["workspace_kind"] == "team_workspace":
                cursor.execute(
                    """
                    UPDATE tangent_workspace_seat_assignments
                    SET status = 'revoked',
                        updated_at = NOW()
                    WHERE workspace_id = %s
                      AND user_id = %s
                      AND status <> 'revoked'
                    """,
                    (workspace_id, user_id),
                )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.workspace_member.remove",
                actor_user_id=actor_user_id,
                metadata={
                    "previousRole": member["role"],
                    "reason": normalized_reason,
                    "workspaceKind": member["workspace_kind"],
                    "workspaceName": member["workspace_name"],
                },
                target_user_id=user_id,
                workspace_id=workspace_id,
            )
        connection.commit()

    return AdminOperatorWorkspaceMemberMutationResponse(
        auditId=audit_id,
        message="Workspace member removed.",
        ok=True,
        role=None,
        userId=user_id,
        workspaceId=workspace_id,
    )


def _load_workspace(cursor: object, workspace_id: str) -> dict[str, str]:
    cursor.execute(
        """
        SELECT COALESCE(w.kind, 'solo_workspace'), COALESCE(w.name, 'Workspace')
        FROM tangent_workspaces w
        WHERE w.id = %s
          AND COALESCE(w.status, 'active') <> 'deleted'
        LIMIT 1
        """,
        (workspace_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    workspace_kind = str(row[0] or "solo_workspace")
    if workspace_kind not in MANAGEABLE_WORKSPACE_KINDS:
        raise HTTPException(status_code=400, detail="Workspace member action is unavailable for this workspace.")
    return {
        "workspace_kind": workspace_kind,
        "workspace_name": str(row[1] or "Workspace"),
    }


def _load_workspace_member(cursor: object, workspace_id: str, user_id: str) -> dict[str, str]:
    workspace = _load_workspace(cursor, workspace_id)
    cursor.execute(
        """
        SELECT role
        FROM tangent_workspace_members
        WHERE workspace_id = %s
          AND user_id = %s
        LIMIT 1
        """,
        (workspace_id, user_id),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace member not found.")
    return {
        "role": str(row[0] or "viewer"),
        "workspace_kind": workspace["workspace_kind"],
        "workspace_name": workspace["workspace_name"],
    }


def _assert_target_user_exists(cursor: object, user_id: str) -> None:
    cursor.execute(
        """
        SELECT 1
        FROM tangent_users
        WHERE id = %s
          AND COALESCE(status, 'active') <> 'deleted'
        LIMIT 1
        """,
        (user_id,),
    )
    if cursor.fetchone() is None:
        raise HTTPException(status_code=404, detail="Target user not found.")


def _normalize_reason(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Reason is required.")
    return normalized


def _normalize_role(value: str) -> str:
    normalized = value.strip().lower()
    if normalized not in ALLOWED_MEMBER_ROLES:
        raise HTTPException(status_code=400, detail="Role must be admin, editor or viewer.")
    return normalized
