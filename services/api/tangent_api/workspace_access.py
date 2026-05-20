from typing import Optional

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext


def assert_workspace_actor_role(
    cursor: object,
    context: ApiRequestContext,
    *,
    allowed_kinds: set[str],
    allowed_roles: set[str],
    feature_unavailable_detail: str,
    forbidden_detail: str,
) -> tuple[str, str]:
    workspace_kind = _load_workspace_kind(cursor, context.workspace_id)
    if workspace_kind is None:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    if workspace_kind not in allowed_kinds:
        raise HTTPException(status_code=403, detail=feature_unavailable_detail)

    actor_role = _load_workspace_member_role(cursor, context.workspace_id, context.user_id)
    if actor_role not in allowed_roles:
        raise HTTPException(status_code=403, detail=forbidden_detail)
    return workspace_kind, actor_role


def _load_workspace_kind(cursor: object, workspace_id: str) -> Optional[str]:
    cursor.execute(
        """
        SELECT COALESCE(kind, 'solo_workspace'), COALESCE(status, 'active')
        FROM tangent_workspaces
        WHERE id = %s
        LIMIT 1
        """,
        (workspace_id,),
    )
    row = cursor.fetchone()
    if row is None:
        return None
    if str(row[1] or "active") == "deleted":
        raise HTTPException(status_code=404, detail="Workspace not found.")
    return str(row[0] or "solo_workspace")


def _load_workspace_member_role(cursor: object, workspace_id: str, user_id: str) -> Optional[str]:
    cursor.execute(
        """
        SELECT role
        FROM tangent_workspace_members
        WHERE workspace_id = %s
          AND user_id = %s
        LIMIT 1
        """,
        (workspace_id, user_id),
    )
    row = cursor.fetchone()
    return str(row[0]) if row else None
