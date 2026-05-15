from dataclasses import dataclass
from typing import Any, Optional

from tangent_api.auth_session_memberships import ResolvedWorkspaceMembership


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
    gender: Optional[str] = None
    profile_completed: bool = False


def row_to_auth_session(row: Any) -> ResolvedAuthSession:
    user_id, email, display_name, avatar_initials, email_verified, workspace_id, workspace_name, workspace_kind, workspace_role = row[:9]
    gender = row[10] if len(row) > 10 else None
    profile_completed = bool(row[11]) if len(row) > 11 else False
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
        workspace_role=workspace_role or "owner",
        board_count=0,
        workspaces=[],
        gender=gender,
        profile_completed=profile_completed,
    )
