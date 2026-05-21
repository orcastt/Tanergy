from typing import Optional

from pydantic import Field, field_validator

from tangent_api.schema_base import TangentApiModel


class AuthUser(TangentApiModel):
    avatar_initials: str = Field(alias="avatarInitials")
    display_name: str = Field(alias="displayName")
    email: str
    email_verified: bool = Field(alias="emailVerified")
    id: str
    profile_completed: bool = Field(default=True, alias="profileCompleted")


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


class AuthProfileUpdateRequest(TangentApiModel):
    display_name: str = Field(alias="displayName", min_length=1, max_length=80)


class AuthProfileUpdateResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    user: Optional[AuthUser] = None


class AuthAccountDeleteRequest(TangentApiModel):
    confirmation: str = Field(min_length=1)
    reason: Optional[str] = Field(default=None, max_length=200)

    @field_validator("confirmation")
    @classmethod
    def validate_confirmation(cls, value: str) -> str:
        normalized = value.strip().upper()
        if normalized != "DELETE":
            raise ValueError("Type DELETE to confirm account deletion.")
        return normalized


class AuthAccountDeleteResponse(TangentApiModel):
    error: Optional[str] = None
    message: str
    ok: bool
    warning: Optional[str] = None
