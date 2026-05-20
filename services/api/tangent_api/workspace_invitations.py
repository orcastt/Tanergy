import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.security_business_limits import assert_daily_business_limit
from tangent_api.storage.postgres_connection import require_database_url
from tangent_api.workspace_access import assert_workspace_actor_role
from tangent_api.workspace_invitation_support import (
    assert_can_manage_workspace_invites,
    assert_group_member_capacity,
    assert_invitation_target,
    assert_team_invitation_capacity,
    assert_team_invite_workspace_ready,
    hash_token,
    invitation_from_row as _invitation_from_row,
    load_active_invitation_by_token_hash,
    load_workspace_kind,
    normalize_id,
    normalize_optional_email,
    normalize_optional_id,
    normalize_workspace_role,
    resolve_invitation_target_user_id,
    resolve_team_invite_seat_policy,
    upsert_team_invite_seat_assignment,
)
from tangent_api.workspace_schemas import (
    WorkspaceInvitationAcceptRecord,
    WorkspaceInvitationCreateRecord,
    WorkspaceInvitationRecord,
)

_assert_can_manage_workspace_invites = assert_can_manage_workspace_invites
_assert_group_member_capacity = assert_group_member_capacity
_assert_invitation_target = assert_invitation_target
_assert_team_invitation_capacity = assert_team_invitation_capacity
_assert_team_invite_workspace_ready = assert_team_invite_workspace_ready
_hash_token = hash_token
_load_active_invitation_by_token_hash = load_active_invitation_by_token_hash
_load_workspace_kind = load_workspace_kind
_normalize_id = normalize_id
_normalize_optional_email = normalize_optional_email
_normalize_optional_id = normalize_optional_id
_resolve_invitation_target_user_id = resolve_invitation_target_user_id
_resolve_team_invite_seat_policy = resolve_team_invite_seat_policy
_upsert_team_invite_seat_assignment = upsert_team_invite_seat_assignment


def create_workspace_invitation(
    *,
    email: Optional[str],
    expires_in_days: int,
    metadata: dict[str, object],
    role: str,
    target_user_id: Optional[str],
    context: ApiRequestContext,
) -> WorkspaceInvitationCreateRecord:
    assert_daily_business_limit(
        context,
        action="workspace.invite.create",
        default_limit=100,
        env_name="TANGENT_WORKSPACE_INVITE_DAILY_LIMIT",
    )
    normalized_role = normalize_workspace_role(role)
    normalized_email = normalize_optional_email(email)
    normalized_target_user_id = normalize_optional_id(target_user_id, "target user id")
    if expires_in_days < 1 or expires_in_days > 30:
        raise HTTPException(status_code=400, detail="Invite expiry must be between 1 and 30 days.")
    invite_metadata = {**metadata, "workspaceKind": context.workspace_kind}
    token = secrets.token_urlsafe(32)
    token_hash = hash_token(token)
    invite_id = f"invite_{uuid4()}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            workspace_kind, _actor_role = assert_workspace_actor_role(
                cursor,
                context,
                allowed_kinds={"group_workspace", "team_workspace"},
                allowed_roles={"admin", "owner"},
                feature_unavailable_detail="Workspace invitations are unavailable for this workspace.",
                forbidden_detail="Workspace role cannot manage workspace invitations.",
            )
            invite_metadata["workspaceKind"] = workspace_kind
            if normalized_target_user_id is None:
                normalized_target_user_id = resolve_invitation_target_user_id(cursor, normalized_email)
            if workspace_kind == "group_workspace":
                assert_group_member_capacity(cursor, context.workspace_id, normalized_target_user_id)
            elif workspace_kind == "team_workspace":
                assert_team_invitation_capacity(cursor, context.workspace_id, normalized_target_user_id)
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
                    context.workspace_id,
                    normalized_email,
                    normalized_role,
                    context.user_id,
                    expires_at,
                    token_hash,
                    normalized_target_user_id,
                    json.dumps(invite_metadata),
                ),
            )
            row = cursor.fetchone()
        connection.commit()
    return WorkspaceInvitationCreateRecord(
        invitation=_invitation_from_row(row),
        acceptPath=f"/api/v1/workspaces/invitations/{token}/accept",
        token=token,
    )


def accept_workspace_invitation(token: str, context: ApiRequestContext) -> WorkspaceInvitationAcceptRecord:
    normalized_token = token.strip()
    if not normalized_token:
        raise HTTPException(status_code=400, detail="Invite token is required.")
    token_hash = hash_token(normalized_token)
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            row = load_active_invitation_by_token_hash(cursor, token_hash)
            if row is None:
                raise HTTPException(status_code=404, detail="Workspace invitation not found.")
            assert_invitation_target(row, context)
            invitation = _invitation_from_row(row)
            workspace_kind = load_workspace_kind(cursor, invitation.workspace_id, invitation.metadata)
            if workspace_kind == "group_workspace":
                assert_group_member_capacity(cursor, invitation.workspace_id, context.user_id)
            seat_policy = resolve_team_invite_seat_policy(
                cursor,
                invitation.workspace_id,
                context.user_id,
                workspace_kind,
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
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (workspace_id, user_id)
                DO UPDATE SET
                    role = EXCLUDED.role,
                    display_name = COALESCE(EXCLUDED.display_name, tangent_workspace_members.display_name),
                    invited_by = EXCLUDED.invited_by
                """,
                (
                    invitation.workspace_id,
                    context.user_id,
                    invitation.role,
                    context.user_display_name,
                    invitation.invited_by,
                ),
            )
            if seat_policy is not None:
                upsert_team_invite_seat_assignment(
                    cursor,
                    workspace_id=invitation.workspace_id,
                    user_id=context.user_id,
                    plan_key=seat_policy["plan_key"],
                    included_credits=int(seat_policy["included_credits"]),
                    assigned_by=invitation.invited_by,
                )
            cursor.execute(
                """
                UPDATE tangent_workspace_invitations
                SET accepted_by = %s,
                    accepted_at = NOW()
                WHERE id = %s
                RETURNING id, workspace_id, email, role, invited_by, accepted_by, expires_at,
                          accepted_at, revoked_at, created_at, token_hash, target_user_id, metadata
                """,
                (context.user_id, invitation.id),
            )
            accepted_row = cursor.fetchone()
        connection.commit()
    return WorkspaceInvitationAcceptRecord(
        invitation=_invitation_from_row(accepted_row),
        workspaceId=invitation.workspace_id,
        role=invitation.role,
    )


def list_workspace_invitations(context: ApiRequestContext) -> list[WorkspaceInvitationRecord]:
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_workspace_actor_role(
                cursor,
                context,
                allowed_kinds={"group_workspace", "team_workspace"},
                allowed_roles={"admin", "owner"},
                feature_unavailable_detail="Workspace invitations are unavailable for this workspace.",
                forbidden_detail="Workspace role cannot manage workspace invitations.",
            )
            cursor.execute(
                """
                SELECT id, workspace_id, email, role, invited_by, accepted_by, expires_at,
                       accepted_at, revoked_at, created_at, token_hash, target_user_id, metadata
                FROM tangent_workspace_invitations
                WHERE workspace_id = %s
                ORDER BY created_at DESC
                """,
                (context.workspace_id,),
            )
            rows = cursor.fetchall()
    return [_invitation_from_row(row) for row in rows]


def revoke_workspace_invitation(invitation_id: str, context: ApiRequestContext) -> WorkspaceInvitationRecord:
    normalized_invitation_id = normalize_id(invitation_id, "invitation id")
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_workspace_actor_role(
                cursor,
                context,
                allowed_kinds={"group_workspace", "team_workspace"},
                allowed_roles={"admin", "owner"},
                feature_unavailable_detail="Workspace invitations are unavailable for this workspace.",
                forbidden_detail="Workspace role cannot manage workspace invitations.",
            )
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
                (normalized_invitation_id, context.workspace_id),
            )
            row = cursor.fetchone()
        connection.commit()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace invitation not found.")
    return _invitation_from_row(row)
