from dataclasses import dataclass
from typing import Any, Optional

from tangent_api.workspace_roles import normalize_workspace_role


@dataclass(frozen=True)
class ResolvedWorkspaceMembership:
    board_count: int
    workspace_id: str
    workspace_kind: str
    workspace_name: str
    workspace_plan_key: Optional[str]
    workspace_role: str


def default_workspace_membership(workspace_id: str, workspace_name: str) -> ResolvedWorkspaceMembership:
    return ResolvedWorkspaceMembership(
        board_count=0,
        workspace_id=workspace_id,
        workspace_kind="solo_workspace",
        workspace_name=workspace_name,
        workspace_plan_key="free_canvas",
        workspace_role="owner",
    )


def load_workspace_memberships(cursor: Any, user_id: str, active_workspace_id: str) -> list[ResolvedWorkspaceMembership]:
    cursor.execute(
        """
        SELECT
            wm.workspace_id,
            w.name,
            COALESCE(w.kind, 'solo_workspace'),
            CASE
                WHEN COALESCE(w.kind, 'solo_workspace') = 'team_workspace' THEN (
                    SELECT s.plan_key
                    FROM tangent_subscriptions s
                    WHERE s.workspace_id = wm.workspace_id
                      AND s.owner_type = 'workspace'
                      AND s.status IN ('active', 'trialing')
                    ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
                    LIMIT 1
                )
                WHEN COALESCE(w.kind, 'solo_workspace') = 'group_workspace' THEN (
                    SELECT s.plan_key
                    FROM tangent_subscriptions s
                    WHERE s.owner_type = 'user'
                      AND s.owner_id = wm.user_id
                      AND s.plan_family = 'collaborate'
                      AND s.status IN ('active', 'trialing')
                    ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
                    LIMIT 1
                )
                WHEN COALESCE(w.kind, 'solo_workspace') = 'enterprise_workspace' THEN (
                    SELECT s.plan_key
                    FROM tangent_subscriptions s
                    WHERE s.workspace_id = wm.workspace_id
                      AND s.owner_type = 'workspace'
                      AND s.status IN ('active', 'trialing')
                    ORDER BY s.updated_at DESC NULLS LAST, s.created_at DESC
                    LIMIT 1
                )
                ELSE 'free_canvas'
            END,
            wm.role,
            COUNT(b.id),
            wm.joined_at
        FROM tangent_workspace_members wm
        JOIN tangent_workspaces w ON w.id = wm.workspace_id
        LEFT JOIN tangent_boards b ON b.workspace_id = wm.workspace_id AND b.deleted_at IS NULL
        WHERE wm.user_id = %s
          AND COALESCE(w.status, 'active') <> 'deleted'
        GROUP BY wm.user_id, wm.workspace_id, w.name, w.kind, wm.role, wm.joined_at
        ORDER BY
            CASE wm.role
                WHEN 'owner' THEN 0
                WHEN 'admin' THEN 1
                WHEN 'editor' THEN 2
                WHEN 'member' THEN 2
                WHEN 'viewer' THEN 3
                WHEN 'guest' THEN 3
                ELSE 4
            END,
            wm.joined_at ASC NULLS LAST
        """,
        (user_id,),
    )
    memberships = [
        ResolvedWorkspaceMembership(
            board_count=int(row[5] or 0),
            workspace_id=str(row[0]),
            workspace_kind=str(row[2] or "solo_workspace"),
            workspace_name=str(row[1] or "Tanergy Workspace"),
            workspace_plan_key=str(row[3]) if row[3] else None,
            workspace_role=normalize_workspace_role(str(row[4] or "owner")),
        )
        for row in cursor.fetchall()
    ]
    active_first = [item for item in memberships if item.workspace_id == active_workspace_id]
    remaining = [item for item in memberships if item.workspace_id != active_workspace_id]
    return active_first + remaining
