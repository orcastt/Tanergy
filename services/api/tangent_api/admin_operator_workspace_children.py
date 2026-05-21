from tangent_api.admin_operator_schemas import (
    AdminOperatorBoardSummary,
    AdminOperatorMemberSummary,
    AdminOperatorWorkspacePlan,
)
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.workspace_invitations import _invitation_from_row
from tangent_api.workspace_schemas import WorkspaceInvitationRecord


def attach_workspace_children(plans: list[AdminOperatorWorkspacePlan]) -> None:
    workspace_ids = [plan.id for plan in plans]
    if not workspace_ids:
        return
    members = _load_members(workspace_ids)
    boards = _load_boards(workspace_ids)
    invitations = _load_invitations(workspace_ids)
    for plan in plans:
        plan.members = members.get(plan.id, [])
        plan.boards = boards.get(plan.id, [])
        plan.invitations = invitations.get(plan.id, [])


def _load_members(workspace_ids: list[str]) -> dict[str, list[AdminOperatorMemberSummary]]:
    rows = _fetchall(
        """
        SELECT wm.workspace_id, wm.user_id, u.email, COALESCE(wm.display_name, u.display_name, u.email, wm.user_id),
               wm.role, COALESCE(SUM(CASE WHEN l.credits_delta < 0 THEN -l.credits_delta ELSE 0 END), 0)
        FROM tangent_workspace_members wm
        LEFT JOIN tangent_users u ON u.id = wm.user_id
        LEFT JOIN tangent_credit_ledger l ON l.workspace_id = wm.workspace_id AND l.actor_user_id = wm.user_id AND l.credits_delta < 0
        WHERE wm.workspace_id = ANY(%s)
        GROUP BY wm.workspace_id, wm.user_id, u.email, COALESCE(wm.display_name, u.display_name, u.email, wm.user_id), wm.role
        ORDER BY wm.workspace_id ASC, wm.joined_at ASC, wm.user_id ASC
        """,
        (workspace_ids,),
    )
    result: dict[str, list[AdminOperatorMemberSummary]] = {}
    for row in rows:
        result.setdefault(str(row[0]), []).append(
            AdminOperatorMemberSummary(
                displayName=str(row[3] or ""),
                email=row[2],
                role=str(row[4] or "viewer"),
                usageCredits=float(row[5] or 0),
                userId=str(row[1]),
            )
        )
    return result


def _load_boards(workspace_ids: list[str]) -> dict[str, list[AdminOperatorBoardSummary]]:
    rows = _fetchall(
        """
        SELECT workspace_id, id, title, visibility
        FROM tangent_boards
        WHERE workspace_id = ANY(%s) AND deleted_at IS NULL
        ORDER BY workspace_id ASC, saved_at DESC
        """,
        (workspace_ids,),
    )
    result: dict[str, list[AdminOperatorBoardSummary]] = {}
    for row in rows:
        result.setdefault(str(row[0]), []).append(
            AdminOperatorBoardSummary(
                id=str(row[1]),
                title=str(row[2] or "Untitled board"),
                visibility=str(row[3] or "private"),
            )
        )
    return result


def _load_invitations(workspace_ids: list[str]) -> dict[str, list[WorkspaceInvitationRecord]]:
    rows = _fetchall(
        """
        SELECT id, workspace_id, email, role, invited_by, accepted_by, expires_at,
               accepted_at, revoked_at, created_at, token_hash, target_user_id, metadata
        FROM tangent_workspace_invitations
        WHERE workspace_id = ANY(%s)
          AND accepted_at IS NULL
          AND revoked_at IS NULL
        ORDER BY workspace_id ASC, created_at DESC
        """,
        (workspace_ids,),
    )
    result: dict[str, list[WorkspaceInvitationRecord]] = {}
    for row in rows:
        result.setdefault(str(row[1]), []).append(_invitation_from_row(row))
    return result


def _fetchall(query: str, params: tuple[object, ...]) -> list[tuple[object, ...]]:
    require_database_url()
    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            cursor.execute(query, params)
            return cursor.fetchall()
