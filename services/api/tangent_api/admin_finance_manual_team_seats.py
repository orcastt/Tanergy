from typing import Optional
from uuid import uuid4

from tangent_api.plan_catalog import included_credits_for_plan


def sync_team_seat_assignments(
    cursor: object,
    *,
    actor_user_id: str,
    period_end: Optional[object],
    period_start: Optional[object],
    plan_key: str,
    seat_capacity: int,
    workspace_id: str,
) -> list[str]:
    cursor.execute(
        """
        SELECT user_id
        FROM tangent_workspace_members
        WHERE workspace_id = %s
          AND role IN ('owner', 'admin', 'editor', 'viewer', 'member', 'guest')
        ORDER BY
          CASE role
            WHEN 'owner' THEN 0
            WHEN 'admin' THEN 1
            WHEN 'editor' THEN 2
            WHEN 'viewer' THEN 3
            WHEN 'member' THEN 4
            ELSE 5
          END,
          created_at ASC NULLS LAST,
          user_id ASC
        LIMIT %s
        """,
        (workspace_id, max(0, seat_capacity)),
    )
    assigned_user_ids = [str(row[0]) for row in cursor.fetchall()]
    included_credits = included_credits_for_plan(plan_key)

    for user_id in assigned_user_ids:
        _upsert_team_seat(
            cursor,
            actor_user_id=actor_user_id,
            included_credits=included_credits,
            period_end=period_end,
            period_start=period_start,
            plan_key=plan_key,
            user_id=user_id,
            workspace_id=workspace_id,
        )

    _revoke_unassigned_team_seats(cursor, assigned_user_ids, workspace_id)
    return assigned_user_ids


def _upsert_team_seat(
    cursor: object,
    *,
    actor_user_id: str,
    included_credits: int,
    period_end: Optional[object],
    period_start: Optional[object],
    plan_key: str,
    user_id: str,
    workspace_id: str,
) -> None:
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
        (workspace_id, user_id, plan_key),
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
        """,
        (
            f"seat_{uuid4()}",
            workspace_id,
            user_id,
            plan_key,
            included_credits,
            period_start,
            period_end,
            actor_user_id,
        ),
    )


def _revoke_unassigned_team_seats(
    cursor: object,
    assigned_user_ids: list[str],
    workspace_id: str,
) -> None:
    if assigned_user_ids:
        cursor.execute(
            """
            UPDATE tangent_workspace_seat_assignments
            SET status = 'revoked',
                updated_at = NOW()
            WHERE workspace_id = %s
              AND status <> 'revoked'
              AND NOT (user_id = ANY(%s))
            """,
            (workspace_id, assigned_user_ids),
        )
        return
    cursor.execute(
        """
        UPDATE tangent_workspace_seat_assignments
        SET status = 'revoked',
            updated_at = NOW()
        WHERE workspace_id = %s
          AND status <> 'revoked'
        """,
        (workspace_id,),
    )
