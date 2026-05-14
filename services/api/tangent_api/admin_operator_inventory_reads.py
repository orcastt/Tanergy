from __future__ import annotations

import json
from typing import Any, Optional

from tangent_api.admin_operator_rows import credit_from_values, user_from_row
from tangent_api.admin_operator_schemas import AdminOperatorUserPlan, AdminOperatorUserRow, AdminOperatorWorkspacePlan
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url

CURRENT_SUBSCRIPTION_STATUSES = {"active", "trialing", "paused"}


def list_admin_operator_inventory_users(
    *,
    limit: int,
    offset: int,
    search: Optional[str] = None,
) -> tuple[list[AdminOperatorUserRow], int]:
    rows = _fetchall(_inventory_query(search), _inventory_params(limit=limit, offset=offset, search=search))
    total_count = int(rows[0][0] or 0) if rows else 0
    users = [_user_from_inventory_row(row) for row in rows]
    return users, total_count


def _user_from_inventory_row(row: tuple[object, ...]) -> AdminOperatorUserRow:
    user = user_from_row(row[1:9])
    personal_credit = credit_from_values(row[9], row[10])
    actor_spend = float(row[11] or personal_credit.spent_credits)
    team_plans = _workspace_plans(row[13])
    group_plans = _user_plans(row[14])
    user.personal_credit = personal_credit
    user.total_credits_spent = actor_spend
    user.owned_group_count = int(row[12] or 0)
    user.owned_team_count = len(team_plans)
    user.team_plans_active = [plan for plan in team_plans if _is_current(plan.plan_status)]
    user.team_plans_expired = [plan for plan in team_plans if not _is_current(plan.plan_status)]
    user.group_plans_active = [plan for plan in group_plans if _is_current(plan.status)]
    user.group_plans_expired = [plan for plan in group_plans if not _is_current(plan.status)]
    return user


def _workspace_plans(value: object) -> list[AdminOperatorWorkspacePlan]:
    return [AdminOperatorWorkspacePlan.model_validate(item) for item in _json_list(value)]


def _user_plans(value: object) -> list[AdminOperatorUserPlan]:
    return [AdminOperatorUserPlan.model_validate(item) for item in _json_list(value)]


def _json_list(value: object) -> list[dict[str, Any]]:
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, str) and value:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [item for item in parsed if isinstance(item, dict)]
    return []


def _inventory_query(search: Optional[str]) -> str:
    where = ["COALESCE(status, 'active') <> 'deleted'"]
    if search and search.strip():
        where.append("(email ILIKE %s OR COALESCE(display_name, '') ILIKE %s OR id ILIKE %s)")
    return f"""
        WITH paged_users AS (
            SELECT COUNT(*) OVER() AS total_count,
                   id, email, COALESCE(display_name, '') AS display_name, COALESCE(status, 'active') AS status,
                   created_at, last_login_at, COALESCE(email_verified, FALSE) AS email_verified, last_ip_address
            FROM tangent_users
            WHERE {' AND '.join(where)}
            ORDER BY created_at DESC, id ASC
            LIMIT %s OFFSET %s
        ),
        personal_credit AS (
            SELECT ca.owner_id,
                   COALESCE(SUM(l.credits_delta), 0) AS balance_credits,
                   COALESCE(SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END), 0) AS spent_credits
            FROM tangent_credit_accounts ca
            LEFT JOIN tangent_credit_ledger l ON l.account_id = ca.id
            WHERE ca.owner_type = 'user' AND ca.owner_id IN (SELECT id FROM paged_users)
            GROUP BY ca.owner_id
        ),
        actor_spend AS (
            SELECT actor_user_id, COALESCE(SUM(-credits_delta), 0) AS spent_credits
            FROM tangent_credit_ledger
            WHERE actor_user_id IN (SELECT id FROM paged_users) AND credits_delta < 0
            GROUP BY actor_user_id
        ),
        owned_group_counts AS (
            SELECT owner_id, COUNT(*) AS group_count
            FROM tangent_workspaces
            WHERE kind = 'group_workspace'
              AND COALESCE(status, 'active') <> 'deleted'
              AND owner_id IN (SELECT id FROM paged_users)
            GROUP BY owner_id
        ),
        team_plan_rows AS (
            SELECT w.owner_id,
                   jsonb_agg(
                       jsonb_build_object(
                           'boardCount', COALESCE(board_counts.board_count, 0),
                           'createdAt', w.created_at,
                           'credit', jsonb_build_object(
                               'remainingCredits', COALESCE(wallet.balance_credits, 0),
                               'spentCredits', COALESCE(usage.usage_credits, 0),
                               'totalCredits', COALESCE(wallet.balance_credits, 0) + COALESCE(usage.usage_credits, 0)
                           ),
                           'id', w.id,
                           'kind', COALESCE(w.kind, 'solo_workspace'),
                           'memberCount', COALESCE(member_counts.member_count, 0),
                           'ownerEmail', COALESCE(owner_user.email, ''),
                           'ownerId', w.owner_id,
                           'pauseReason', workspace_sub.pause_reason,
                           'pausedAt', workspace_sub.paused_at,
                           'pausedBy', workspace_sub.paused_by,
                           'periodEnd', workspace_sub.current_period_end,
                           'periodStart', workspace_sub.current_period_start,
                           'planKey', workspace_sub.plan_key,
                           'planStatus', workspace_sub.status,
                           'seatCapacity', COALESCE(workspace_sub.seat_capacity, 0),
                           'subscriptionId', workspace_sub.subscription_id,
                           'usageByUser', 0,
                           'workspaceName', COALESCE(w.name, 'Untitled workspace')
                       )
                       ORDER BY w.created_at DESC
                   ) AS plans
            FROM tangent_workspaces w
            LEFT JOIN tangent_users owner_user ON owner_user.id = w.owner_id
            LEFT JOIN LATERAL (
                SELECT s.id AS subscription_id, s.plan_key, s.status, s.seat_capacity, s.current_period_start,
                       s.current_period_end, s.paused_at, s.paused_by, s.pause_reason
                FROM tangent_subscriptions AS s
                WHERE s.workspace_id = w.id OR (s.owner_type = 'workspace' AND s.owner_id = w.id)
                ORDER BY (s.status IN ('active', 'trialing', 'paused')) DESC,
                         s.updated_at DESC NULLS LAST,
                         s.created_at DESC NULLS LAST
                LIMIT 1
            ) workspace_sub ON TRUE
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
            WHERE w.kind = 'team_workspace'
              AND COALESCE(w.status, 'active') <> 'deleted'
              AND w.owner_id IN (SELECT id FROM paged_users)
            GROUP BY w.owner_id
        ),
        group_plan_rows AS (
            SELECT s.owner_id,
                   jsonb_agg(
                       jsonb_build_object(
                           'pauseReason', s.pause_reason,
                           'pausedAt', s.paused_at,
                           'pausedBy', s.paused_by,
                           'periodEnd', s.current_period_end,
                           'periodStart', s.current_period_start,
                           'planKey', s.plan_key,
                           'status', s.status,
                           'subscriptionId', s.id
                       )
                       ORDER BY (s.status IN ('active', 'trialing', 'paused')) DESC,
                                s.updated_at DESC NULLS LAST,
                                s.created_at DESC NULLS LAST
                   ) AS plans
            FROM tangent_subscriptions s
            WHERE s.owner_type = 'user'
              AND s.plan_family = 'collaborate'
              AND s.owner_id IN (SELECT id FROM paged_users)
            GROUP BY s.owner_id
        )
        SELECT pu.total_count, pu.id, pu.email, pu.display_name, pu.status, pu.created_at, pu.last_login_at,
               pu.email_verified, pu.last_ip_address,
               COALESCE(pc.balance_credits, 0), COALESCE(pc.spent_credits, 0),
               COALESCE(actor_spend.spent_credits, 0), COALESCE(owned_group_counts.group_count, 0),
               COALESCE(team_plan_rows.plans, '[]'::jsonb), COALESCE(group_plan_rows.plans, '[]'::jsonb)
        FROM paged_users pu
        LEFT JOIN personal_credit pc ON pc.owner_id = pu.id
        LEFT JOIN actor_spend ON actor_spend.actor_user_id = pu.id
        LEFT JOIN owned_group_counts ON owned_group_counts.owner_id = pu.id
        LEFT JOIN team_plan_rows ON team_plan_rows.owner_id = pu.id
        LEFT JOIN group_plan_rows ON group_plan_rows.owner_id = pu.id
        ORDER BY pu.created_at DESC, pu.id ASC
    """


def _inventory_params(*, limit: int, offset: int, search: Optional[str]) -> tuple[object, ...]:
    params: list[object] = []
    if search and search.strip():
        pattern = f"%{search.strip()}%"
        params.extend([pattern, pattern, pattern])
    params.extend([limit, offset])
    return tuple(params)


def _is_current(status: Optional[str]) -> bool:
    return str(status or "").strip().lower() in CURRENT_SUBSCRIPTION_STATUSES


def _fetchall(query: str, params: tuple[object, ...]) -> list[tuple[object, ...]]:
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()
