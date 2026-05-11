import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.plan_catalog import group_member_limit_for_plan, included_credits_for_plan
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import require_database_url
from tangent_api.workspace_schemas import (
    WorkspaceInvitationAcceptRecord,
    WorkspaceInvitationCreateRecord,
    WorkspaceInvitationRecord,
)

ACTIVE_MEMBER_ROLES = {"owner", "admin", "editor", "viewer", "member", "guest"}
MANAGER_ROLES = {"owner", "admin"}
PRODUCT_INVITE_ROLES = {"admin", "editor", "viewer"}
LEGACY_INVITE_ROLES = {"member", "guest"}
GROUP_MEMBER_MAX = 15


def create_workspace_invitation(
    *,
    email: Optional[str],
    expires_in_days: int,
    metadata: dict[str, object],
    role: str,
    target_user_id: Optional[str],
    context: ApiRequestContext,
) -> WorkspaceInvitationCreateRecord:
    _assert_can_manage_workspace_invites(context)
    normalized_role = normalize_workspace_role(role)
    normalized_email = _normalize_optional_email(email)
    normalized_target_user_id = _normalize_optional_id(target_user_id, "target user id")
    if expires_in_days < 1 or expires_in_days > 30:
        raise HTTPException(status_code=400, detail="Invite expiry must be between 1 and 30 days.")
    invite_metadata = {**metadata, "workspaceKind": context.workspace_kind}
    token = secrets.token_urlsafe(32)
    token_hash = _hash_token(token)
    invite_id = f"invite_{uuid4()}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            if context.workspace_kind == "group_workspace":
                _assert_group_member_capacity(cursor, context.workspace_id, None)
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
    token_hash = _hash_token(normalized_token)
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            row = _load_active_invitation_by_token_hash(cursor, token_hash)
            if row is None:
                raise HTTPException(status_code=404, detail="Workspace invitation not found.")
            _assert_invitation_target(row, context)
            invitation = _invitation_from_row(row)
            workspace_kind = _load_workspace_kind(cursor, invitation.workspace_id, invitation.metadata)
            if workspace_kind == "group_workspace":
                _assert_group_member_capacity(cursor, invitation.workspace_id, context.user_id)
            seat_policy = _resolve_team_invite_seat_policy(
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
                _upsert_team_invite_seat_assignment(
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
    _assert_can_manage_workspace_invites(context)
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
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
    _assert_can_manage_workspace_invites(context)
    normalized_invitation_id = _normalize_id(invitation_id, "invitation id")
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
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


def normalize_workspace_role(role: str) -> str:
    normalized = role.strip()
    if normalized not in PRODUCT_INVITE_ROLES and normalized not in LEGACY_INVITE_ROLES:
        raise HTTPException(status_code=400, detail="Invalid workspace role.")
    return normalized


def _assert_can_manage_workspace_invites(context: ApiRequestContext) -> None:
    if context.workspace_kind not in {"group_workspace", "team_workspace", "enterprise_workspace"}:
        raise HTTPException(status_code=403, detail="Workspace invitations are unavailable for this workspace.")
    if context.workspace_role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Workspace role cannot manage workspace invitations.")


def _load_active_invitation_by_token_hash(cursor: object, token_hash: str) -> Optional[tuple[object, ...]]:
    cursor.execute(
        """
        SELECT id, workspace_id, email, role, invited_by, accepted_by, expires_at,
               accepted_at, revoked_at, created_at, token_hash, target_user_id, metadata
        FROM tangent_workspace_invitations
        WHERE token_hash = %s
          AND accepted_at IS NULL
          AND revoked_at IS NULL
          AND expires_at > NOW()
        LIMIT 1
        """,
        (token_hash,),
    )
    return cursor.fetchone()


def _load_workspace_kind(cursor: object, workspace_id: str, metadata: dict[str, object]) -> str:
    cursor.execute(
        """
        SELECT COALESCE(kind, 'solo_workspace')
        FROM tangent_workspaces
        WHERE id = %s
        LIMIT 1
        """,
        (workspace_id,),
    )
    row = cursor.fetchone()
    if row:
        return str(row[0] or "solo_workspace")
    return str(metadata.get("workspaceKind") or "solo_workspace")


def _resolve_team_invite_seat_policy(
    cursor: object,
    workspace_id: str,
    user_id: str,
    workspace_kind: str,
) -> Optional[dict[str, object]]:
    if workspace_kind != "team_workspace":
        return None
    cursor.execute(
        """
        SELECT plan_key, seat_capacity
        FROM tangent_subscriptions
        WHERE owner_type = 'workspace'
          AND owner_id = %s
          AND plan_family = 'team'
          AND status IN ('active', 'trialing')
          AND (current_period_end IS NULL OR current_period_end > NOW())
        ORDER BY updated_at DESC
        LIMIT 1
        """,
        (workspace_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=402, detail="Active Team subscription is required to accept this invite.")
    plan_key = str(row[0])
    seat_capacity = int(row[1] or 0)
    if plan_key not in {"team_start", "team_growth"} or seat_capacity < 1:
        raise HTTPException(status_code=402, detail="No Team seats are available for this invite.")
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM tangent_workspace_seat_assignments
        WHERE workspace_id = %s
          AND status = 'active'
          AND user_id <> %s
        """,
        (workspace_id, user_id),
    )
    count_row = cursor.fetchone()
    active_seats = int(count_row[0] or 0) if count_row else 0
    if active_seats >= seat_capacity:
        raise HTTPException(status_code=402, detail="No Team seats remain for this invite.")
    return {
        "included_credits": included_credits_for_plan(plan_key),
        "plan_key": plan_key,
    }


def _assert_group_member_capacity(cursor: object, workspace_id: str, target_user_id: Optional[str]) -> None:
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM tangent_workspace_members
        WHERE workspace_id = %s
          AND role IN ('owner', 'admin', 'editor', 'viewer', 'member', 'guest')
          AND (%s IS NULL OR user_id <> %s)
        """,
        (workspace_id, target_user_id, target_user_id),
    )
    row = cursor.fetchone()
    active_members = int(row[0] or 0) if row else 0
    group_member_max = group_member_limit_for_plan("collaborate_plus") or GROUP_MEMBER_MAX
    if active_members >= group_member_max:
        raise HTTPException(status_code=400, detail=f"Group member cap is {group_member_max}.")


def _upsert_team_invite_seat_assignment(
    cursor: object,
    *,
    assigned_by: Optional[str],
    included_credits: int,
    plan_key: str,
    user_id: str,
    workspace_id: str,
) -> None:
    seat_id = f"seat_{uuid4()}"
    cursor.execute(
        """
        INSERT INTO tangent_workspace_seat_assignments (
            id,
            workspace_id,
            user_id,
            plan_key,
            status,
            included_credits,
            current_period_start,
            current_period_end,
            assigned_by
        )
        VALUES (%s, %s, %s, %s, 'active', %s, NULL, NULL, %s)
        ON CONFLICT (workspace_id, user_id, plan_key)
        DO UPDATE SET
            status = 'active',
            included_credits = EXCLUDED.included_credits,
            assigned_by = EXCLUDED.assigned_by,
            updated_at = NOW()
        """,
        (seat_id, workspace_id, user_id, plan_key, included_credits, assigned_by),
    )


def _assert_invitation_target(row: tuple[object, ...], context: ApiRequestContext) -> None:
    email = str(row[2]).lower() if row[2] else None
    target_user_id = str(row[11]) if row[11] else None
    if target_user_id and target_user_id != context.user_id:
        raise HTTPException(status_code=403, detail="Workspace invitation is for another user.")
    if email and email != context.user_email.lower():
        raise HTTPException(status_code=403, detail="Workspace invitation is for another email.")


def _invitation_from_row(row: tuple[object, ...]) -> WorkspaceInvitationRecord:
    return WorkspaceInvitationRecord(
        acceptedAt=_optional_iso(row[7]),
        acceptedBy=str(row[5]) if row[5] else None,
        createdAt=_optional_iso(row[9]) or "",
        email=str(row[2]) if row[2] else None,
        expiresAt=_optional_iso(row[6]) or "",
        id=str(row[0]),
        invitedBy=str(row[4]) if row[4] else None,
        metadata=dict(row[12] or {}),
        revokedAt=_optional_iso(row[8]),
        role=str(row[3]),
        targetUserId=str(row[11]) if row[11] else None,
        workspaceId=str(row[1]),
    )


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _normalize_id(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized or ".." in normalized:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return normalized


def _normalize_optional_id(value: Optional[str], label: str) -> Optional[str]:
    if value is None or not value.strip():
        return None
    return _normalize_id(value, label)


def _normalize_optional_email(value: Optional[str]) -> Optional[str]:
    if value is None or not value.strip():
        return None
    normalized = value.strip().lower()
    if "@" not in normalized:
        raise HTTPException(status_code=400, detail="Invalid invite email.")
    return normalized


def _optional_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
