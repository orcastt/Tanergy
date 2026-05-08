from typing import Optional

from pydantic import Field

from tangent_api.schema_base import TangentApiModel


class AuthUser(TangentApiModel):
    avatar_initials: str = Field(alias="avatarInitials")
    display_name: str = Field(alias="displayName")
    email: str
    email_verified: bool = Field(alias="emailVerified")
    id: str


class AuthWorkspace(TangentApiModel):
    board_count: int = Field(alias="boardCount")
    id: str
    kind: str = "solo_workspace"
    name: str
    plan_key: Optional[str] = Field(default=None, alias="planKey")
    role: str


class AuthSession(TangentApiModel):
    active_workspace: AuthWorkspace = Field(alias="activeWorkspace")
    auth_mode: str = Field(alias="authMode")
    is_dev_fallback: bool = Field(alias="isDevFallback")
    user: AuthUser
    workspaces: list[AuthWorkspace]


class AuthSessionResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    session: Optional[AuthSession] = None
