import os
from typing import Optional

from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import connect_to_postgres


def load_workspace_dashboard_seat_capacity(context: ApiRequestContext) -> Optional[int]:
    if context.workspace_kind != "team_workspace" or not os.getenv("DATABASE_URL"):
        return None
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT plan_key, seat_capacity, current_period_start, current_period_end
                FROM tangent_subscriptions
                WHERE owner_type = 'workspace'
                  AND owner_id = %s
                  AND plan_family = 'team'
                  AND status IN ('active', 'trialing')
                  AND (current_period_end IS NULL OR current_period_end > NOW())
                ORDER BY updated_at DESC
                LIMIT 1
                """,
                (context.workspace_id,),
            )
            row = cursor.fetchone()
    if not row or row[1] is None:
        return None
    return max(0, int(row[1]))
