import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.admin_access import _insert_admin_audit_log
from tangent_api.admin_operator_schemas import (
    AdminOperatorWorkspaceInvitationCreateResponse,
    AdminOperatorWorkspaceInvitationResponse,
)
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.workspace_invitations import (
    _hash_token,
    _invitation_from_row,
    _normalize_id,
    _normalize_optional_email,
    _normalize_optional_id,
    normalize_workspace_role,
)
from tangent_api.workspace_schemas import WorkspaceInvitationRecord

MANAGEABLE_INVITE_WORKSPACE_KINDS = {"group_workspace", "team_workspace", "enterprise_workspace"}


def list_admin_operator_workspace_invitations(workspace_id: str) -> list[WorkspaceInvitationRecord]:
    require_database_url()
    normalized_workspace_id = _normalize_id(workspace_id, "workspace id")

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            _load_workspace(cursor, normalized_workspace_id)
            cursor.execute(
                """
                SELECT id, workspace_id, email, role, invited_by, accepted_by, expires_at,
                       accepted_at, revoked_at, created_at, token_hash, target_user_id, metadata
                FROM tangent_workspace_invitations
                WHERE workspace_id = %s
                ORDER BY created_at DESC
                """,
                (normalized_workspace_id,),
            )
            rows = cursor.fetchall()

    return [_invitation_from_row(row) for row in rows]


def create_admin_operator_workspace_invitation(
    *,
    actor_user_id: str,
    email: Optional[str],
    expires_in_days: int,
    metadata: dict[str, object],
    reason: str,
    role: str,
    target_user_id: Optional[str],
    workspace_id: str,
) -> AdminOperatorWorkspaceInvitationCreateResponse:
    require_database_url()
    normalized_workspace_id = _normalize_id(workspace_id, "workspace id")
    normalized_reason = _normalize_reason(reason)
    normalized_role = normalize_workspace_role(role)
    normalized_email = _normalize_optional_email(email)
    normalized_target_user_id = _normalize_optional_id(target_user_id, "target user id")
    if normalized_email is None and normalized_target_user_id is None:
        raise HTTPException(status_code=400, detail="Invite email or target user id is required.")

    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    invite_id = f"invite_{uuid4()}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            workspace = _load_workspace(cursor, normalized_workspace_id)
            invite_metadata = {
                **metadata,
                "createdBy": "admin_operator",
                "workspaceKind": workspace["workspace_kind"],
            }
            cursor.execute(
                """
                INSERT INTO tangent_workspace_invitations (
                    id,
                    workspace_id,
                    email,
                    role,
                    invited_by,
                    accepted_by,
                    expires_at,
                    accepted_at,
                    revoked_at,
                    token_hash,
                    target_user_id,
                    metadata
                )
                VALUES (%s, %s, %s, %s, %s, NULL, %s, NULL, NULL, %s, %s, %s::jsonb)
                RETURNING id, workspace_id, email, role, invited_by, accepted_by, expires_at,
                          accepted_at, revoked_at, created_at, token_hash, target_user_id, metadata
                """,
                (
                    invite_id,
                    normalized_workspace_id,
                    normalized_email,
                    normalized_role,
                    actor_user_id,
                    expires_at,
                    token_hash,
                    normalized_target_user_id,
                    json.dumps(invite_metadata),
                ),
            )
            row = cursor.fetchone()
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.workspace_invitation.create",
                actor_user_id=actor_user_id,
                metadata={
                    "email": normalized_email,
                    "expiresInDays": expires_in_days,
                    "reason": normalized_reason,
                    "role": normalized_role,
                    "targetUserId": normalized_target_user_id,
                    "workspaceKind": workspace["workspace_kind"],
                    "workspaceName": workspace["workspace_name"],
                },
                target_user_id=normalized_target_user_id,
                workspace_id=normalized_workspace_id,
            )
        connection.commit()

    invitation = _invitation_from_row(row)
    return AdminOperatorWorkspaceInvitationCreateResponse(
        acceptPath=f"/api/v1/workspaces/invitations/{token}/accept",
        auditId=audit_id,
        invitation=invitation,
        message="Workspace invitation created.",
        ok=True,
        token=token,
        workspaceId=normalized_workspace_id,
    )


def revoke_admin_operator_workspace_invitation(
    *,
    actor_user_id: str,
    invitation_id: str,
    reason: str,
    workspace_id: str,
) -> AdminOperatorWorkspaceInvitationResponse:
    require_database_url()
    normalized_workspace_id = _normalize_id(workspace_id, "workspace id")
    normalized_invitation_id = _normalize_id(invitation_id, "invitation id")
    normalized_reason = _normalize_reason(reason)

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            workspace = _load_workspace(cursor, normalized_workspace_id)
            cursor.execute(
                """
                UPDATE tangent_workspace_invitations
                SET revoked_at = NOW()
                WHERE id = %s
                  AND workspace_id = %s
                  AND accepted_at IS NULL
                  AND revoked_at IS NULL
                RETURNING id, workspace_id, email, role, invited_by, accepted_by, expires_at,
                          accepted_at, revoked_at, created_at, token_hash, target_user_id, metadata
                """,
                (normalized_invitation_id, normalized_workspace_id),
            )
            row = cursor.fetchone()
            if row is None:
                raise HTTPException(status_code=404, detail="Workspace invitation not found.")
            invitation = _invitation_from_row(row)
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.workspace_invitation.revoke",
                actor_user_id=actor_user_id,
                metadata={
                    "email": invitation.email,
                    "reason": normalized_reason,
                    "role": invitation.role,
                    "workspaceKind": workspace["workspace_kind"],
                    "workspaceName": workspace["workspace_name"],
                },
                target_user_id=invitation.target_user_id,
                workspace_id=normalized_workspace_id,
            )
        connection.commit()

    return AdminOperatorWorkspaceInvitationResponse(
        auditId=audit_id,
        invitation=invitation,
        message="Workspace invitation revoked.",
        ok=True,
        workspaceId=normalized_workspace_id,
    )


def _load_workspace(cursor: object, workspace_id: str) -> dict[str, str]:
    cursor.execute(
        """
        SELECT COALESCE(kind, 'solo_workspace'), COALESCE(name, 'Workspace')
        FROM tangent_workspaces
        WHERE id = %s
          AND COALESCE(status, 'active') <> 'deleted'
        LIMIT 1
        """,
        (workspace_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    workspace_kind = str(row[0] or "solo_workspace")
    if workspace_kind not in MANAGEABLE_INVITE_WORKSPACE_KINDS:
        raise HTTPException(status_code=400, detail="Workspace invitations are unavailable for this workspace.")
    return {
        "workspace_kind": workspace_kind,
        "workspace_name": str(row[1] or "Workspace"),
    }


def _normalize_reason(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Reason is required.")
    return normalized
