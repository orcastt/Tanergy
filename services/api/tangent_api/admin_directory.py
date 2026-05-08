from typing import Optional

from tangent_api.admin_directory_schemas import (
    AdminDirectoryBoardRecord,
    AdminDirectoryUserRecord,
    AdminDirectoryWorkspaceMemberRecord,
    AdminDirectoryWorkspaceRecord,
)
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url


def list_admin_directory_users(limit: int) -> list[AdminDirectoryUserRecord]:
    rows = _fetchall(
        """
        SELECT u.id, u.email, COALESCE(u.display_name, ''), COALESCE(u.status, 'active'),
               COALESCE(u.locale, 'en'), u.created_at, u.last_login_at,
               COALESCE((
                   SELECT SUM(l.credits_delta)
                   FROM tangent_credit_accounts ca
                   LEFT JOIN tangent_credit_ledger l ON l.account_id = ca.id
                   WHERE ca.owner_type = 'user' AND ca.owner_id = u.id
               ), 0),
               (
                   SELECT s.plan_key
                   FROM tangent_subscriptions s
                   WHERE s.owner_type = 'user' AND s.owner_id = u.id AND s.plan_family = 'collaborate'
                   ORDER BY (s.status = 'active') DESC, s.updated_at DESC
                   LIMIT 1
               ),
               (
                   SELECT s.status
                   FROM tangent_subscriptions s
                   WHERE s.owner_type = 'user' AND s.owner_id = u.id AND s.plan_family = 'collaborate'
                   ORDER BY (s.status = 'active') DESC, s.updated_at DESC
                   LIMIT 1
               ),
               (
                   SELECT s.current_period_end
                   FROM tangent_subscriptions s
                   WHERE s.owner_type = 'user' AND s.owner_id = u.id AND s.plan_family = 'collaborate'
                   ORDER BY (s.status = 'active') DESC, s.updated_at DESC
                   LIMIT 1
               ),
               (SELECT COUNT(*) FROM tangent_workspaces w WHERE w.owner_id = u.id AND w.kind = 'team_workspace' AND w.status <> 'deleted'),
               (SELECT COUNT(*) FROM tangent_workspaces w WHERE w.owner_id = u.id AND w.kind = 'group_workspace' AND w.status <> 'deleted'),
               (SELECT COUNT(*) FROM tangent_boards b WHERE b.owner_id = u.id AND b.deleted_at IS NULL)
        FROM tangent_users u
        WHERE u.status <> 'deleted'
        ORDER BY u.created_at DESC
        LIMIT %s
        """,
        (limit,),
    )
    return [_user_from_row(row) for row in rows]


def list_admin_directory_workspaces(
    *,
    kind: Optional[str],
    limit: int,
    owner_id: Optional[str] = None,
) -> list[AdminDirectoryWorkspaceRecord]:
    where = ["w.status <> 'deleted'"]
    params: list[object] = []
    if kind:
        where.append("w.kind = %s")
        params.append(kind)
    if owner_id:
        where.append("w.owner_id = %s")
        params.append(owner_id)
    rows = _fetchall(f"{_workspace_query()} WHERE {' AND '.join(where)} ORDER BY w.created_at DESC LIMIT %s", (*params, limit))
    return [_workspace_from_row(row) for row in rows]


def get_admin_directory_workspace(workspace_id: str) -> Optional[AdminDirectoryWorkspaceRecord]:
    rows = _fetchall(f"{_workspace_query()} WHERE w.id = %s AND w.status <> 'deleted' LIMIT 1", (workspace_id,))
    return _workspace_from_row(rows[0]) if rows else None


def list_admin_directory_workspace_members(workspace_id: str, *, limit: int) -> list[AdminDirectoryWorkspaceMemberRecord]:
    rows = _fetchall(
        """
        SELECT wm.user_id, u.email, COALESCE(wm.display_name, u.display_name, u.email, wm.user_id),
               wm.role, wm.joined_at,
               COALESCE(SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END), 0),
               COUNT(l.id) FILTER (WHERE l.credits_delta < 0),
               MAX(l.created_at)
        FROM tangent_workspace_members wm
        LEFT JOIN tangent_users u ON u.id = wm.user_id
        LEFT JOIN tangent_credit_ledger l ON l.workspace_id = wm.workspace_id
            AND l.actor_user_id = wm.user_id
            AND l.credits_delta < 0
        WHERE wm.workspace_id = %s
        GROUP BY wm.user_id, u.email, COALESCE(wm.display_name, u.display_name, u.email, wm.user_id),
                 wm.role, wm.joined_at
        ORDER BY wm.joined_at ASC, wm.user_id ASC
        LIMIT %s
        """,
        (workspace_id, limit),
    )
    return [_member_from_row(row) for row in rows]


def list_admin_directory_workspace_boards(workspace_id: str, *, limit: int) -> list[AdminDirectoryBoardRecord]:
    rows = _fetchall(
        """
        SELECT id, owner_id, title, visibility, saved_at
        FROM tangent_boards
        WHERE workspace_id = %s AND deleted_at IS NULL
        ORDER BY saved_at DESC
        LIMIT %s
        """,
        (workspace_id, limit),
    )
    return [_board_from_row(row) for row in rows]


def _workspace_query() -> str:
    return """
        SELECT w.id, w.name, COALESCE(w.kind, 'solo_workspace'), w.owner_id, COALESCE(w.status, 'active'),
               w.created_at, COALESCE(u.email, ''), COALESCE(u.display_name, ''),
               (SELECT COUNT(*) FROM tangent_workspace_members wm WHERE wm.workspace_id = w.id),
               (SELECT COUNT(*) FROM tangent_boards b WHERE b.workspace_id = w.id AND b.deleted_at IS NULL),
               COALESCE((
                   SELECT SUM(l.credits_delta)
                   FROM tangent_credit_accounts ca
                   LEFT JOIN tangent_credit_ledger l ON l.account_id = ca.id
                   WHERE ca.owner_type = 'workspace' AND ca.owner_id = w.id
               ), 0),
               COALESCE((
                   SELECT SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END)
                   FROM tangent_credit_ledger l
                   WHERE l.workspace_id = w.id
               ), 0),
               (
                   SELECT s.plan_key
                   FROM tangent_subscriptions s
                   WHERE s.workspace_id = w.id OR (s.owner_type = 'workspace' AND s.owner_id = w.id)
                   ORDER BY (s.status = 'active') DESC, s.updated_at DESC
                   LIMIT 1
               ),
               (
                   SELECT s.status
                   FROM tangent_subscriptions s
                   WHERE s.workspace_id = w.id OR (s.owner_type = 'workspace' AND s.owner_id = w.id)
                   ORDER BY (s.status = 'active') DESC, s.updated_at DESC
                   LIMIT 1
               ),
               COALESCE((
                   SELECT s.seat_capacity
                   FROM tangent_subscriptions s
                   WHERE s.workspace_id = w.id OR (s.owner_type = 'workspace' AND s.owner_id = w.id)
                   ORDER BY (s.status = 'active') DESC, s.updated_at DESC
                   LIMIT 1
               ), 0),
               (
                   SELECT s.current_period_end
                   FROM tangent_subscriptions s
                   WHERE s.workspace_id = w.id OR (s.owner_type = 'workspace' AND s.owner_id = w.id)
                   ORDER BY (s.status = 'active') DESC, s.updated_at DESC
                   LIMIT 1
               ),
               (
                   SELECT s.plan_key
                   FROM tangent_subscriptions s
                   WHERE s.owner_type = 'user' AND s.owner_id = w.owner_id AND s.plan_family = 'collaborate'
                   ORDER BY (s.status = 'active') DESC, s.updated_at DESC
                   LIMIT 1
               )
        FROM tangent_workspaces w
        LEFT JOIN tangent_users u ON u.id = w.owner_id
    """


def _fetchall(query: str, params: tuple[object, ...]) -> list[tuple[object, ...]]:
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()


def _user_from_row(row: tuple[object, ...]) -> AdminDirectoryUserRecord:
    return AdminDirectoryUserRecord(
        collaboratePlanKey=row[8],
        collaboratePlanStatus=row[9],
        collaboratePeriodEnd=_to_iso(row[10]),
        createdAt=_to_iso(row[5]) or "",
        displayName=str(row[2] or ""),
        email=str(row[1] or ""),
        groupCount=int(row[12] or 0),
        id=str(row[0]),
        lastLoginAt=_to_iso(row[6]),
        locale=str(row[4] or "en"),
        ownedBoardCount=int(row[13] or 0),
        personalWalletCredits=float(row[7] or 0),
        status=str(row[3] or "active"),
        teamCount=int(row[11] or 0),
    )


def _workspace_from_row(row: tuple[object, ...]) -> AdminDirectoryWorkspaceRecord:
    return AdminDirectoryWorkspaceRecord(
        boardCount=int(row[9] or 0),
        createdAt=_to_iso(row[5]) or "",
        id=str(row[0]),
        kind=str(row[2] or "solo_workspace"),
        memberCount=int(row[8] or 0),
        name=str(row[1] or "Untitled workspace"),
        ownerCollaboratePlanKey=row[16],
        ownerDisplayName=str(row[7] or ""),
        ownerEmail=str(row[6] or ""),
        ownerId=str(row[3]) if row[3] is not None else None,
        planKey=row[12],
        planStatus=row[13],
        seatCapacity=int(row[14] or 0),
        status=str(row[4] or "active"),
        subscriptionPeriodEnd=_to_iso(row[15]),
        usageCredits=float(row[11] or 0),
        walletCredits=float(row[10] or 0),
    )


def _member_from_row(row: tuple[object, ...]) -> AdminDirectoryWorkspaceMemberRecord:
    return AdminDirectoryWorkspaceMemberRecord(
        chargeCount=int(row[6] or 0),
        displayName=str(row[2] or ""),
        email=row[1],
        joinedAt=_to_iso(row[4]),
        lastUsageAt=_to_iso(row[7]),
        role=str(row[3] or "viewer"),
        usageCredits=float(row[5] or 0),
        userId=str(row[0]),
    )


def _board_from_row(row: tuple[object, ...]) -> AdminDirectoryBoardRecord:
    return AdminDirectoryBoardRecord(
        id=str(row[0]),
        ownerId=str(row[1]),
        savedAt=_to_iso(row[4]) or "",
        title=str(row[2] or "Untitled board"),
        visibility=str(row[3] or "private"),
    )


def _to_iso(value: object) -> Optional[str]:
    if value is None:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
