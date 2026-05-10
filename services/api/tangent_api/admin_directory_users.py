from typing import Optional

from tangent_api.admin_directory_schemas import AdminDirectoryUserRecord
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

_USER_DIRECTORY_CTES = """
    WITH user_wallets AS (
        SELECT
            ca.owner_id,
            COALESCE(SUM(l.credits_delta), 0) AS personal_wallet_credits,
            COALESCE(SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END), 0) AS personal_credits_spent
        FROM tangent_credit_accounts ca
        LEFT JOIN tangent_credit_ledger l ON l.account_id = ca.id
        WHERE ca.owner_type = 'user'
        GROUP BY ca.owner_id
    ),
    collaborate_subscriptions AS (
        SELECT id, owner_id, plan_key, status, current_period_end
        FROM (
            SELECT
                s.id,
                s.owner_id,
                s.plan_key,
                s.status,
                s.current_period_end,
                ROW_NUMBER() OVER (
                    PARTITION BY s.owner_id
                    ORDER BY (s.status = 'active') DESC, s.updated_at DESC NULLS LAST, s.created_at DESC NULLS LAST
                ) AS row_num
            FROM tangent_subscriptions s
            WHERE s.owner_type = 'user' AND s.plan_family = 'collaborate'
        ) ranked
        WHERE row_num = 1
    ),
    team_workspaces AS (
        SELECT id, owner_id
        FROM tangent_workspaces
        WHERE kind = 'team_workspace' AND COALESCE(status, 'active') <> 'deleted'
    ),
    team_workspace_usage AS (
        SELECT
            tw.owner_id,
            COALESCE(SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END), 0) AS team_credits_spent
        FROM team_workspaces tw
        LEFT JOIN tangent_credit_ledger l ON l.workspace_id = tw.id
        GROUP BY tw.owner_id
    ),
    team_workspace_counts AS (
        SELECT owner_id, COUNT(*) AS team_count
        FROM team_workspaces
        GROUP BY owner_id
    ),
    group_workspace_counts AS (
        SELECT owner_id, COUNT(*) AS group_count
        FROM tangent_workspaces
        WHERE kind = 'group_workspace' AND COALESCE(status, 'active') <> 'deleted'
        GROUP BY owner_id
    ),
    owned_boards AS (
        SELECT owner_id, COUNT(*) AS board_count
        FROM tangent_boards
        WHERE deleted_at IS NULL
        GROUP BY owner_id
    ),
    team_subscriptions AS (
        SELECT id, owner_id, plan_key, status, current_period_end
        FROM (
            SELECT
                s.id,
                tw.owner_id,
                s.plan_key,
                s.status,
                s.current_period_end,
                ROW_NUMBER() OVER (
                    PARTITION BY tw.owner_id
                    ORDER BY (s.status = 'active') DESC, s.updated_at DESC NULLS LAST, s.created_at DESC NULLS LAST
                ) AS row_num
            FROM team_workspaces tw
            LEFT JOIN tangent_subscriptions s
              ON s.workspace_id = tw.id
              OR (s.owner_type = 'workspace' AND s.owner_id = tw.id)
        ) ranked
        WHERE row_num = 1
    )
"""

_USER_DIRECTORY_SELECT = """
    FROM tangent_users u
    LEFT JOIN user_wallets uw ON uw.owner_id = u.id
    LEFT JOIN collaborate_subscriptions cs ON cs.owner_id = u.id
    LEFT JOIN team_subscriptions ts ON ts.owner_id = u.id
    LEFT JOIN team_workspace_counts twc ON twc.owner_id = u.id
    LEFT JOIN team_workspace_usage twu ON twu.owner_id = u.id
    LEFT JOIN group_workspace_counts gwc ON gwc.owner_id = u.id
    LEFT JOIN owned_boards ob ON ob.owner_id = u.id
"""

_USER_DIRECTORY_FIELDS = """
    u.id,
    u.email,
    COALESCE(u.display_name, ''),
    COALESCE(u.status, 'active'),
    COALESCE(u.locale, 'en'),
    u.created_at,
    u.last_login_at,
    COALESCE(uw.personal_wallet_credits, 0),
    COALESCE(uw.personal_credits_spent, 0),
    cs.id,
    cs.plan_key,
    cs.status,
    cs.current_period_end,
    ts.id,
    ts.plan_key,
    ts.status,
    ts.current_period_end,
    COALESCE(twc.team_count, 0),
    COALESCE(gwc.group_count, 0),
    COALESCE(ob.board_count, 0),
    COALESCE(twu.team_credits_spent, 0)
"""


def list_admin_directory_users(
    *,
    limit: int,
    offset: int,
    search: Optional[str] = None,
) -> tuple[list[AdminDirectoryUserRecord], int]:
    where, params = _user_where(search)
    rows = _fetchall(
        f"""
        {_USER_DIRECTORY_CTES}
        SELECT
            COUNT(*) OVER() AS total_count,
            {_USER_DIRECTORY_FIELDS}
        {_USER_DIRECTORY_SELECT}
        WHERE {' AND '.join(where)}
        ORDER BY u.created_at DESC, u.id ASC
        LIMIT %s OFFSET %s
        """,
        (*params, limit, offset),
    )
    total_count = int(rows[0][0] or 0) if rows else 0
    return [_user_from_row(row[1:]) for row in rows], total_count


def get_admin_directory_user(user_id: str) -> Optional[AdminDirectoryUserRecord]:
    rows = _fetchall(
        f"""
        {_USER_DIRECTORY_CTES}
        SELECT {_USER_DIRECTORY_FIELDS}
        {_USER_DIRECTORY_SELECT}
        WHERE COALESCE(u.status, 'active') <> 'deleted' AND u.id = %s
        LIMIT 1
        """,
        (user_id,),
    )
    return _user_from_row(rows[0]) if rows else None


def _user_where(search: Optional[str]) -> tuple[list[str], list[object]]:
    where = ["COALESCE(u.status, 'active') <> 'deleted'"]
    params: list[object] = []
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        where.append("(u.email ILIKE %s OR COALESCE(u.display_name, '') ILIKE %s OR u.id ILIKE %s)")
        params.extend([pattern, pattern, pattern])
    return where, params


def _fetchall(query: str, params: tuple[object, ...]) -> list[tuple[object, ...]]:
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()


def _user_from_row(row: tuple[object, ...]) -> AdminDirectoryUserRecord:
    return AdminDirectoryUserRecord(
        collaboratePlanKey=row[10],
        collaboratePlanStatus=row[11],
        collaboratePeriodEnd=_to_iso(row[12]),
        collaborateSubscriptionId=row[9],
        createdAt=_to_iso(row[5]) or "",
        displayName=str(row[2] or ""),
        email=str(row[1] or ""),
        groupCount=int(row[18] or 0),
        id=str(row[0]),
        lastLoginAt=_to_iso(row[6]),
        locale=str(row[4] or "en"),
        ownedBoardCount=int(row[19] or 0),
        personalCreditsSpent=float(row[8] or 0),
        personalWalletCredits=float(row[7] or 0),
        status=str(row[3] or "active"),
        teamCount=int(row[17] or 0),
        teamCreditsSpent=float(row[20] or 0),
        teamPlanKey=row[14],
        teamPlanStatus=row[15],
        teamPeriodEnd=_to_iso(row[16]),
        teamSubscriptionId=row[13],
        totalCreditsSpent=float(row[8] or 0) + float(row[20] or 0),
    )


def _to_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
