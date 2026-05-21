import re
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.plan_catalog import included_credits_for_plan, seat_max_for_plan
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.workspace_access import assert_workspace_actor_role
from tangent_api.workspace_schemas import WorkspaceSeatAssignmentRecord, WorkspaceSeatAssignmentUpsertRequest

ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")
TEAM_SEAT_MAX = 15


def list_workspace_seat_assignments(context: ApiRequestContext) -> list[WorkspaceSeatAssignmentRecord]:
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_workspace_actor_role(
                cursor,
                context,
                allowed_kinds={"team_workspace"},
                allowed_roles={"admin", "owner"},
                feature_unavailable_detail="Seat assignment is only available for Team workspaces.",
                forbidden_detail="Workspace role cannot manage team seats.",
            )
            cursor.execute(
                """
                SELECT id, workspace_id, user_id, plan_key, status, included_credits,
                       current_period_start, current_period_end, assigned_by
                FROM tangent_workspace_seat_assignments
                WHERE workspace_id = %s
                  AND status <> 'revoked'
                ORDER BY updated_at DESC
                """,
                (context.workspace_id,),
            )
            rows = cursor.fetchall()
    return [_seat_assignment_from_row(row) for row in rows]


def upsert_workspace_seat_assignment(
    input_data: WorkspaceSeatAssignmentUpsertRequest,
    context: ApiRequestContext,
) -> WorkspaceSeatAssignmentRecord:
    require_database_url()
    user_id = _normalize_id(input_data.user_id, "user id")
    plan_key = _normalize_team_plan_key(input_data.plan_key)
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_workspace_actor_role(
                cursor,
                context,
                allowed_kinds={"team_workspace"},
                allowed_roles={"admin", "owner"},
                feature_unavailable_detail="Seat assignment is only available for Team workspaces.",
                forbidden_detail="Workspace role cannot manage team seats.",
            )
            _assert_active_workspace_member(cursor, context.workspace_id, user_id)
            included_credits = _assert_workspace_seat_capacity(cursor, context.workspace_id, plan_key, user_id)
            seat_id = f"seat_{uuid4()}"
            cursor.execute(
                """
                UPDATE tangent_workspace_seat_assignments
                SET status = 'revoked',
                    updated_at = NOW()
                WHERE workspace_id = %s
                  AND user_id = %s
                  AND plan_key <> %s
                  AND status <> 'revoked'
                """,
                (context.workspace_id, user_id, plan_key),
            )
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
                VALUES (%s, %s, %s, %s, 'active', %s, %s, %s, %s)
                ON CONFLICT (workspace_id, user_id, plan_key)
                DO UPDATE SET
                    status = 'active',
                    included_credits = EXCLUDED.included_credits,
                    current_period_start = EXCLUDED.current_period_start,
                    current_period_end = EXCLUDED.current_period_end,
                    assigned_by = EXCLUDED.assigned_by,
                    updated_at = NOW()
                RETURNING id, workspace_id, user_id, plan_key, status, included_credits,
                          current_period_start, current_period_end, assigned_by
                """,
                (
                    seat_id,
                    context.workspace_id,
                    user_id,
                    plan_key,
                    included_credits,
                    input_data.current_period_start,
                    input_data.current_period_end,
                    context.user_id,
                ),
            )
            row = cursor.fetchone()
        connection.commit()
    return _seat_assignment_from_row(row)


def revoke_workspace_seat_assignment(user_id: str, context: ApiRequestContext) -> str:
    require_database_url()
    normalized_user_id = _normalize_id(user_id, "user id")
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            assert_workspace_actor_role(
                cursor,
                context,
                allowed_kinds={"team_workspace"},
                allowed_roles={"admin", "owner"},
                feature_unavailable_detail="Seat assignment is only available for Team workspaces.",
                forbidden_detail="Workspace role cannot manage team seats.",
            )
            cursor.execute(
                """
                UPDATE tangent_workspace_seat_assignments
                SET status = 'revoked',
                    updated_at = NOW()
                WHERE workspace_id = %s
                  AND user_id = %s
                  AND status <> 'revoked'
                """,
                (context.workspace_id, normalized_user_id),
            )
        connection.commit()
    return normalized_user_id


def _assert_workspace_seat_capacity(cursor: object, workspace_id: str, plan_key: str, user_id: str) -> int:
    active_plan_key, max_seats = _load_active_team_subscription_capacity(cursor, workspace_id)
    if active_plan_key != plan_key:
        raise HTTPException(status_code=400, detail="Seat plan must match the active Team subscription.")
    if max_seats <= 0:
        raise HTTPException(status_code=402, detail="No Team seats are available for this plan.")
    cursor.execute(
        """
        SELECT COUNT(*)
        FROM tangent_workspace_seat_assignments
        WHERE workspace_id = %s
          AND plan_key = %s
          AND status = 'active'
          AND user_id <> %s
        """,
        (workspace_id, plan_key, user_id),
    )
    row = cursor.fetchone()
    active_assignments = int(row[0] or 0) if row else 0
    if active_assignments >= max_seats:
        raise HTTPException(status_code=402, detail="No purchased seats remain for this plan.")
    return included_credits_for_plan(plan_key)


def _load_active_team_subscription_capacity(cursor: object, workspace_id: str) -> tuple[str, int]:
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
        raise HTTPException(status_code=402, detail="Active Team subscription is required to assign seats.")
    plan_key = str(row[0] or "")
    seat_capacity = int(row[1] or 0)
    if plan_key not in {"team_start", "team_growth"}:
        raise HTTPException(status_code=402, detail="Active Team subscription is required to assign seats.")
    return plan_key, min(seat_capacity, seat_max_for_plan(plan_key) or TEAM_SEAT_MAX)


def _assert_can_manage_team_seats(context: ApiRequestContext) -> None:
    if context.workspace_kind != "team_workspace":
        raise HTTPException(status_code=403, detail="Seat assignment is only available for Team workspaces.")
    if context.workspace_role not in {"admin", "owner"}:
        raise HTTPException(status_code=403, detail="Workspace role cannot manage team seats.")


def _assert_active_workspace_member(cursor: object, workspace_id: str, user_id: str) -> None:
    cursor.execute(
        """
        SELECT 1
        FROM tangent_workspace_members
        WHERE workspace_id = %s
          AND user_id = %s
          AND role IN ('owner', 'admin', 'editor', 'viewer', 'member', 'guest')
        LIMIT 1
        """,
        (workspace_id, user_id),
    )
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Workspace member not found.")


def _ensure_workspace_credit_account(cursor: object, workspace_id: str) -> str:
    account_id = f"credit_workspace_{workspace_id}"
    cursor.execute(
        """
        INSERT INTO tangent_credit_accounts (
            id,
            owner_type,
            owner_id,
            account_kind,
            status
        )
        VALUES (%s, 'workspace', %s, 'team_wallet', 'active')
        ON CONFLICT (owner_type, owner_id)
        DO UPDATE SET
            status = 'active',
            account_kind = 'team_wallet',
            updated_at = NOW()
        RETURNING id
        """,
        (account_id, workspace_id),
    )
    row = cursor.fetchone()
    return str(row[0]) if row else account_id


def _normalize_id(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized or not ID_PATTERN.match(normalized) or ".." in normalized:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return normalized


def _normalize_team_plan_key(value: str) -> str:
    normalized = value.strip()
    if normalized not in {"team_start", "team_growth"}:
        raise HTTPException(status_code=400, detail="Invalid team plan key.")
    return normalized


def _seat_assignment_from_row(row: tuple[object, ...]) -> WorkspaceSeatAssignmentRecord:
    return WorkspaceSeatAssignmentRecord(
        assignedBy=row[8],
        currentPeriodEnd=_optional_iso(row[7]),
        currentPeriodStart=_optional_iso(row[6]),
        id=str(row[0]),
        includedCredits=int(row[5] or 0),
        planKey=str(row[3]),
        status=str(row[4]),
        userId=str(row[2]),
        workspaceId=str(row[1]),
    )


def _optional_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
