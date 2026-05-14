from typing import Optional

from tangent_api.admin_operator_billing_history import load_admin_operator_billing_history
from tangent_api.admin_operator_inventory_reads import list_admin_operator_inventory_users
from tangent_api.admin_operator_sql import (
    admin_operator_subscription_snapshot_sql,
    admin_operator_user_ip_field_sql,
)
from tangent_api.admin_operator_schemas import (
    AdminOperatorCreditSummary,
    AdminOperatorUserDetail,
    AdminOperatorUserPlan,
    AdminOperatorUserRow,
    AdminOperatorWorkspacePlan,
)
from tangent_api.admin_operator_rows import (
    credit_from_values,
    empty_credit,
    user_from_row,
    user_plan_from_row,
    workspace_from_row,
)
from tangent_api.admin_operator_workspace_children import attach_workspace_children
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

CURRENT_SUBSCRIPTION_STATUSES = {"active", "trialing", "paused"}


def list_admin_operator_users(
    *,
    limit: int,
    offset: int,
    search: Optional[str] = None,
) -> tuple[list[AdminOperatorUserRow], int]:
    return list_admin_operator_inventory_users(limit=limit, offset=offset, search=search)


def get_admin_operator_user_detail(user_id: str) -> Optional[AdminOperatorUserDetail]:
    rows = _fetchall(
        """
        SELECT id, email, COALESCE(display_name, ''), COALESCE(status, 'active'),
               created_at, last_login_at, COALESCE(email_verified, FALSE), {ip_field}
        FROM tangent_users
        WHERE id = %s AND COALESCE(status, 'active') <> 'deleted'
        LIMIT 1
        """.format(ip_field=admin_operator_user_ip_field_sql()),
        (user_id,),
    )
    if not rows:
        return None

    user = user_from_row(rows[0])
    _attach_user_collections([user], include_workspace_children=True)
    owned_teams = [*user.team_plans_active, *user.team_plans_expired]
    owned_groups = _load_owned_workspaces([user.id], "group_workspace", include_children=True).get(user.id, [])
    joined_teams = _load_joined_workspaces(user.id, "team_workspace", include_children=True)
    joined_groups = _load_joined_workspaces(user.id, "group_workspace", include_children=True)
    return AdminOperatorUserDetail(
        billingHistory=load_admin_operator_billing_history(user.id, limit=100),
        groupPlansActive=user.group_plans_active,
        groupPlansExpired=user.group_plans_expired,
        joinedGroups=joined_groups,
        joinedTeams=joined_teams,
        ownedGroups=owned_groups,
        ownedTeams=owned_teams,
        user=user,
    )


def _attach_user_collections(users: list[AdminOperatorUserRow], *, include_workspace_children: bool = False) -> None:
    user_ids = [user.id for user in users]
    if not user_ids:
        return
    personal_credit = _load_personal_credit(user_ids)
    actor_spend = _load_actor_spend(user_ids)
    team_plans = _load_owned_workspaces(user_ids, "team_workspace", include_children=include_workspace_children)
    group_plans = _load_group_plans(user_ids)
    owned_group_counts = _load_owned_workspace_counts(user_ids, "group_workspace")

    for user in users:
        user.personal_credit = personal_credit.get(user.id, empty_credit())
        user.total_credits_spent = actor_spend.get(user.id, user.personal_credit.spent_credits)
        user.owned_group_count = owned_group_counts.get(user.id, 0)
        user.team_plans_active = [plan for plan in team_plans.get(user.id, []) if _is_current(plan.plan_status)]
        user.team_plans_expired = [plan for plan in team_plans.get(user.id, []) if not _is_current(plan.plan_status)]
        user.group_plans_active = [plan for plan in group_plans.get(user.id, []) if _is_current(plan.status)]
        user.group_plans_expired = [plan for plan in group_plans.get(user.id, []) if not _is_current(plan.status)]
        user.owned_team_count = len(team_plans.get(user.id, []))


def _load_personal_credit(user_ids: list[str]) -> dict[str, AdminOperatorCreditSummary]:
    rows = _fetchall(
        """
        SELECT ca.owner_id,
               COALESCE(SUM(l.credits_delta), 0),
               COALESCE(SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END), 0)
        FROM tangent_credit_accounts ca
        LEFT JOIN tangent_credit_ledger l ON l.account_id = ca.id
        WHERE ca.owner_type = 'user' AND ca.owner_id = ANY(%s)
        GROUP BY ca.owner_id
        """,
        (user_ids,),
    )
    return {str(row[0]): credit_from_values(row[1], row[2]) for row in rows}


def _load_actor_spend(user_ids: list[str]) -> dict[str, float]:
    rows = _fetchall(
        """
        SELECT actor_user_id, COALESCE(SUM(-credits_delta), 0)
        FROM tangent_credit_ledger
        WHERE actor_user_id = ANY(%s) AND credits_delta < 0
        GROUP BY actor_user_id
        """,
        (user_ids,),
    )
    return {str(row[0]): float(row[1] or 0) for row in rows}


def _load_group_plans(user_ids: list[str]) -> dict[str, list[AdminOperatorUserPlan]]:
    rows = _fetchall(
        f"""
        SELECT owner_id, subscription_id, plan_key, status, current_period_start, current_period_end,
               paused_at, paused_by, pause_reason
        FROM (
            SELECT owner_id, {admin_operator_subscription_snapshot_sql("s")}, updated_at, created_at
            FROM tangent_subscriptions AS s
            WHERE owner_type = 'user'
              AND plan_family = 'collaborate'
              AND owner_id = ANY(%s)
        ) AS subscription_rows
        ORDER BY (status IN ('active', 'trialing', 'paused')) DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
        """,
        (user_ids,),
    )
    result: dict[str, list[AdminOperatorUserPlan]] = {}
    for row in rows:
        result.setdefault(str(row[0]), []).append(user_plan_from_row(row[1:]))
    return result


def _load_owned_workspace_counts(user_ids: list[str], kind: str) -> dict[str, int]:
    rows = _fetchall(
        """
        SELECT owner_id, COUNT(*)
        FROM tangent_workspaces
        WHERE kind = %s AND COALESCE(status, 'active') <> 'deleted' AND owner_id = ANY(%s)
        GROUP BY owner_id
        """,
        (kind, user_ids),
    )
    return {str(row[0]): int(row[1] or 0) for row in rows}


def _load_owned_workspaces(
    user_ids: list[str],
    kind: str,
    *,
    include_children: bool,
) -> dict[str, list[AdminOperatorWorkspacePlan]]:
    rows = _fetchall(f"{_workspace_select()} WHERE w.kind = %s AND COALESCE(w.status, 'active') <> 'deleted' AND w.owner_id = ANY(%s) ORDER BY w.created_at DESC", (kind, user_ids))
    plans = [workspace_from_row(row) for row in rows]
    if include_children:
        attach_workspace_children(plans)
    result: dict[str, list[AdminOperatorWorkspacePlan]] = {}
    for plan in plans:
        if plan.owner_id:
            result.setdefault(plan.owner_id, []).append(plan)
    return result


def _load_joined_workspaces(user_id: str, kind: str, *, include_children: bool) -> list[AdminOperatorWorkspacePlan]:
    rows = _fetchall(
        f"""
        {_workspace_select(extra_select=", wm.role, COALESCE(user_usage.usage_credits, 0)", extra_join='''
        JOIN tangent_workspace_members wm ON wm.workspace_id = w.id AND wm.user_id = %s
        LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END), 0) AS usage_credits
            FROM tangent_credit_ledger l
            WHERE l.workspace_id = w.id AND l.actor_user_id = %s
        ) user_usage ON TRUE
        ''')}
        WHERE w.kind = %s
          AND COALESCE(w.status, 'active') <> 'deleted'
          AND COALESCE(w.owner_id, '') <> %s
        ORDER BY w.created_at DESC
        """,
        (user_id, user_id, kind, user_id),
    )
    plans = [workspace_from_row(row, role_index=-2, usage_index=-1) for row in rows]
    if include_children:
        attach_workspace_children(plans)
    return plans


def _workspace_select(*, extra_select: str = "", extra_join: str = "") -> str:
    return f"""
        SELECT w.id, w.name, COALESCE(w.kind, 'solo_workspace'), w.owner_id, COALESCE(owner_user.email, ''),
               w.created_at,
               CASE WHEN COALESCE(w.kind, 'solo_workspace') = 'team_workspace' THEN workspace_sub.subscription_id ELSE owner_sub.subscription_id END,
               CASE WHEN COALESCE(w.kind, 'solo_workspace') = 'team_workspace' THEN workspace_sub.plan_key ELSE owner_sub.plan_key END,
               CASE WHEN COALESCE(w.kind, 'solo_workspace') = 'team_workspace' THEN workspace_sub.status ELSE owner_sub.status END,
               CASE WHEN COALESCE(w.kind, 'solo_workspace') = 'team_workspace' THEN workspace_sub.seat_capacity ELSE 1 END,
               CASE WHEN COALESCE(w.kind, 'solo_workspace') = 'team_workspace' THEN workspace_sub.current_period_start ELSE owner_sub.current_period_start END,
               CASE WHEN COALESCE(w.kind, 'solo_workspace') = 'team_workspace' THEN workspace_sub.current_period_end ELSE owner_sub.current_period_end END,
               CASE WHEN COALESCE(w.kind, 'solo_workspace') = 'team_workspace' THEN workspace_sub.paused_at ELSE owner_sub.paused_at END,
               CASE WHEN COALESCE(w.kind, 'solo_workspace') = 'team_workspace' THEN workspace_sub.paused_by ELSE owner_sub.paused_by END,
               CASE WHEN COALESCE(w.kind, 'solo_workspace') = 'team_workspace' THEN workspace_sub.pause_reason ELSE owner_sub.pause_reason END,
               COALESCE(member_counts.member_count, 0), COALESCE(board_counts.board_count, 0),
               COALESCE(wallet.balance_credits, 0), COALESCE(usage.usage_credits, 0)
               {extra_select}
        FROM tangent_workspaces w
        LEFT JOIN tangent_users owner_user ON owner_user.id = w.owner_id
        {extra_join}
        LEFT JOIN LATERAL (
            SELECT {admin_operator_subscription_snapshot_sql("s")}
            FROM tangent_subscriptions
            AS s
            WHERE workspace_id = w.id OR (owner_type = 'workspace' AND owner_id = w.id)
            ORDER BY (status IN ('active', 'trialing', 'paused')) DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
            LIMIT 1
        ) workspace_sub ON TRUE
        LEFT JOIN LATERAL (
            SELECT {admin_operator_subscription_snapshot_sql("s")}
            FROM tangent_subscriptions
            AS s
            WHERE owner_type = 'user' AND owner_id = w.owner_id AND plan_family = 'collaborate'
            ORDER BY (status IN ('active', 'trialing', 'paused')) DESC, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
            LIMIT 1
        ) owner_sub ON TRUE
        LEFT JOIN LATERAL (SELECT COUNT(*) AS member_count FROM tangent_workspace_members wm WHERE wm.workspace_id = w.id) member_counts ON TRUE
        LEFT JOIN LATERAL (SELECT COUNT(*) AS board_count FROM tangent_boards b WHERE b.workspace_id = w.id AND b.deleted_at IS NULL) board_counts ON TRUE
        LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(l.credits_delta), 0) AS balance_credits
            FROM tangent_credit_accounts ca
            LEFT JOIN tangent_credit_ledger l ON l.account_id = ca.id
            WHERE ca.owner_type = 'workspace' AND ca.owner_id = w.id
        ) wallet ON TRUE
        LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END), 0) AS usage_credits
            FROM tangent_credit_ledger l
            WHERE l.workspace_id = w.id
        ) usage ON TRUE
    """
def _is_current(status: Optional[str]) -> bool:
    return str(status or "").strip().lower() in CURRENT_SUBSCRIPTION_STATUSES


def _fetchall(query: str, params: tuple[object, ...]) -> list[tuple[object, ...]]:
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()
