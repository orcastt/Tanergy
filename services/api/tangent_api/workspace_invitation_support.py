import hashlib
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.plan_catalog import group_member_limit_for_plan, included_credits_for_plan
from tangent_api.request_context import ApiRequestContext
from tangent_api.workspace_roles import normalize_workspace_role as normalize_product_workspace_role
from tangent_api.workspace_schemas import WorkspaceInvitationRecord

MANAGER_ROLES = {"owner", "admin"}
PRODUCT_INVITE_ROLES = {"admin", "editor", "viewer"}
GROUP_MEMBER_MAX = 15


def normalize_workspace_role(role: str) -> str:
    try:
        normalized = normalize_product_workspace_role(role)
    except ValueError as error:
        raise HTTPException(status_code=400, detail="Invalid workspace role.") from error
    if normalized not in PRODUCT_INVITE_ROLES:
        raise HTTPException(status_code=400, detail="Invalid workspace role.")
    return normalized


def assert_can_manage_workspace_invites(context: ApiRequestContext) -> None:
    if context.workspace_kind not in {"group_workspace", "team_workspace"}:
        raise HTTPException(status_code=403, detail="Workspace invitations are unavailable for this workspace.")
    if context.workspace_role not in MANAGER_ROLES:
        raise HTTPException(status_code=403, detail="Workspace role cannot manage workspace invitations.")


def load_active_invitation_by_token_hash(cursor: object, token_hash: str) -> Optional[tuple[object, ...]]:
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


def load_workspace_kind(cursor: object, workspace_id: str, metadata: dict[str, object]) -> str:
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


def resolve_team_invite_seat_policy(
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


def assert_group_member_capacity(cursor: object, workspace_id: str, target_user_id: Optional[str]) -> None:
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


def upsert_team_invite_seat_assignment(
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


def assert_invitation_target(row: tuple[object, ...], context: ApiRequestContext) -> None:
    email = str(row[2]).lower() if row[2] else None
    target_user_id = str(row[11]) if row[11] else None
    if target_user_id and target_user_id != context.user_id:
        raise HTTPException(status_code=403, detail="Workspace invitation is for another user.")
    if email and email != context.user_email.lower():
        raise HTTPException(status_code=403, detail="Workspace invitation is for another email.")


def invitation_from_row(row: tuple[object, ...]) -> WorkspaceInvitationRecord:
    return WorkspaceInvitationRecord(
        acceptedAt=optional_iso(row[7]),
        acceptedBy=str(row[5]) if row[5] else None,
        createdAt=optional_iso(row[9]) or "",
        email=str(row[2]) if row[2] else None,
        expiresAt=optional_iso(row[6]) or "",
        id=str(row[0]),
        invitedBy=str(row[4]) if row[4] else None,
        metadata=dict(row[12] or {}),
        revokedAt=optional_iso(row[8]),
        role=normalize_workspace_role(str(row[3] or "viewer")),
        targetUserId=str(row[11]) if row[11] else None,
        workspaceId=str(row[1]),
    )


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def normalize_id(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized or ".." in normalized:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return normalized


def normalize_optional_id(value: Optional[str], label: str) -> Optional[str]:
    if value is None or not value.strip():
        return None
    return normalize_id(value, label)


def normalize_optional_email(value: Optional[str]) -> Optional[str]:
    if value is None or not value.strip():
        return None
    normalized = value.strip().lower()
    if "@" not in normalized:
        raise HTTPException(status_code=400, detail="Invalid invite email.")
    return normalized


def optional_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
