from dataclasses import dataclass
from typing import Any, Optional

from tangent_api.auth_session_memberships import ResolvedWorkspaceMembership
from tangent_api.workspace_roles import preserve_workspace_role


@dataclass(frozen=True)
class ResolvedAuthSession:
    user_id: str
    workspace_id: str
    workspace_kind: str
    display_name: str
    email: str
    email_verified: bool
    avatar_initials: str
    workspace_name: str
    workspace_plan_key: Optional[str]
    workspace_role: str
    board_count: int
    workspaces: list[ResolvedWorkspaceMembership]
    profile_completed: bool = False


def row_to_auth_session(row: Any) -> ResolvedAuthSession:
    user_id, email, display_name, avatar_initials, email_verified, workspace_id, workspace_name, workspace_kind, workspace_role = row[:9]
    profile_completed = bool(row[10]) if len(row) > 10 else False
    return ResolvedAuthSession(
        user_id=user_id,
        workspace_id=workspace_id or "",
        workspace_kind=workspace_kind or "solo_workspace",
        display_name=display_name,
        email=email,
        email_verified=bool(email_verified),
        avatar_initials=avatar_initials,
        workspace_name=workspace_name or "Tanergy Workspace",
        workspace_plan_key=None,
        workspace_role=preserve_workspace_role(str(workspace_role or "owner")),
        board_count=0,
        workspaces=[],
        profile_completed=profile_completed,
    )
