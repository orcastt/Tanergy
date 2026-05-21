from typing import Optional

from fastapi import HTTPException

from tangent_api.plan_catalog import seat_max_for_plan
from tangent_api.request_context import ApiRequestContext
from tangent_api.team_subscription_lifecycle import TEAM_SEAT_MAX

TOPUP_CENTS_PER_CREDIT = {
    "collaborate_plus": 1,
    "collaborate_start": 1,
    "enterprise": 1,
    "free_canvas": 2,
    "team_growth": 1,
    "team_start": 1,
}


def resolve_payment_account_id(context: ApiRequestContext, kind: Optional[str], workspace_scoped: bool) -> str:
    if workspace_scoped or kind == "seat_purchase":
        return f"credit_workspace_{context.workspace_id}"
    return f"credit_user_{context.user_id}"


def topup_cents_per_credit(plan_key: Optional[str], fallback_plan_key: str) -> int:
    return TOPUP_CENTS_PER_CREDIT.get(plan_key or fallback_plan_key, 1)


def assert_team_seat_purchase_within_capacity(workspace_id: str, plan_key: str, quantity: int) -> None:
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
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
        raise HTTPException(status_code=402, detail="Active Team subscription is required to buy seats.")
    active_plan_key = str(row[0] or "")
    if active_plan_key != plan_key:
        raise HTTPException(status_code=400, detail="Seat purchase plan must match the active Team subscription.")
    current_capacity = int(row[1] or 0)
    max_seats = seat_max_for_plan(plan_key) or TEAM_SEAT_MAX
    if current_capacity + quantity > max_seats:
        raise HTTPException(status_code=400, detail=f"Team seat capacity cannot exceed {max_seats}.")
