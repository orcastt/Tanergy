from typing import Optional

from pydantic import Field

from tangent_api.schema_base import TangentApiModel


class AdminDirectoryUserRecord(TangentApiModel):
    collaborate_plan_key: Optional[str] = Field(default=None, alias="collaboratePlanKey")
    collaborate_plan_status: Optional[str] = Field(default=None, alias="collaboratePlanStatus")
    collaborate_period_end: Optional[str] = Field(default=None, alias="collaboratePeriodEnd")
    created_at: str = Field(alias="createdAt")
    display_name: str = Field(alias="displayName")
    email: str
    group_count: int = Field(alias="groupCount")
    id: str
    last_login_at: Optional[str] = Field(default=None, alias="lastLoginAt")
    locale: str
    owned_board_count: int = Field(alias="ownedBoardCount")
    personal_wallet_credits: float = Field(alias="personalWalletCredits")
    status: str
    team_count: int = Field(alias="teamCount")


class AdminDirectoryWorkspaceRecord(TangentApiModel):
    board_count: int = Field(alias="boardCount")
    created_at: str = Field(alias="createdAt")
    id: str
    kind: str
    member_count: int = Field(alias="memberCount")
    name: str
    owner_collaborate_plan_key: Optional[str] = Field(default=None, alias="ownerCollaboratePlanKey")
    owner_display_name: str = Field(alias="ownerDisplayName")
    owner_email: str = Field(alias="ownerEmail")
    owner_id: Optional[str] = Field(default=None, alias="ownerId")
    plan_key: Optional[str] = Field(default=None, alias="planKey")
    plan_status: Optional[str] = Field(default=None, alias="planStatus")
    seat_capacity: int = Field(alias="seatCapacity")
    status: str
    subscription_period_end: Optional[str] = Field(default=None, alias="subscriptionPeriodEnd")
    usage_credits: float = Field(alias="usageCredits")
    wallet_credits: float = Field(alias="walletCredits")


class AdminDirectoryWorkspaceMemberRecord(TangentApiModel):
    charge_count: int = Field(alias="chargeCount")
    display_name: str = Field(alias="displayName")
    email: Optional[str] = None
    joined_at: Optional[str] = Field(default=None, alias="joinedAt")
    last_usage_at: Optional[str] = Field(default=None, alias="lastUsageAt")
    role: str
    usage_credits: float = Field(alias="usageCredits")
    user_id: str = Field(alias="userId")


class AdminDirectoryBoardRecord(TangentApiModel):
    id: str
    owner_id: str = Field(alias="ownerId")
    saved_at: str = Field(alias="savedAt")
    title: str
    visibility: str


class AdminDirectoryUsersResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    users: list[AdminDirectoryUserRecord] = Field(default_factory=list)


class AdminDirectoryWorkspacesResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    workspaces: list[AdminDirectoryWorkspaceRecord] = Field(default_factory=list)


class AdminDirectoryWorkspaceDetailResponse(TangentApiModel):
    boards: list[AdminDirectoryBoardRecord] = Field(default_factory=list)
    error: Optional[str] = None
    members: list[AdminDirectoryWorkspaceMemberRecord] = Field(default_factory=list)
    ok: bool
    workspace: Optional[AdminDirectoryWorkspaceRecord] = None
