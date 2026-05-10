from typing import Any, Optional

from pydantic import Field, field_validator

from tangent_api.board_schemas import BoardSummary
from tangent_api.schema_base import TangentApiModel
from tangent_api.workspace_schemas import WorkspaceInvitationRecord


class AdminOperatorCreditSummary(TangentApiModel):
    remaining_credits: float = Field(default=0, alias="remainingCredits")
    spent_credits: float = Field(default=0, alias="spentCredits")
    total_credits: float = Field(default=0, alias="totalCredits")


class AdminOperatorMemberSummary(TangentApiModel):
    display_name: str = Field(alias="displayName")
    email: Optional[str] = None
    role: str
    usage_credits: float = Field(default=0, alias="usageCredits")
    user_id: str = Field(alias="userId")


class AdminOperatorBoardSummary(TangentApiModel):
    id: str
    title: str
    visibility: str


class AdminOperatorWorkspacePlan(TangentApiModel):
    board_count: int = Field(default=0, alias="boardCount")
    boards: list[AdminOperatorBoardSummary] = Field(default_factory=list)
    created_at: str = Field(alias="createdAt")
    credit: AdminOperatorCreditSummary
    id: str
    kind: str
    member_count: int = Field(default=0, alias="memberCount")
    members: list[AdminOperatorMemberSummary] = Field(default_factory=list)
    invitations: list[WorkspaceInvitationRecord] = Field(default_factory=list)
    owner_email: Optional[str] = Field(default=None, alias="ownerEmail")
    owner_id: Optional[str] = Field(default=None, alias="ownerId")
    pause_reason: Optional[str] = Field(default=None, alias="pauseReason")
    paused_at: Optional[str] = Field(default=None, alias="pausedAt")
    paused_by: Optional[str] = Field(default=None, alias="pausedBy")
    plan_key: Optional[str] = Field(default=None, alias="planKey")
    plan_status: Optional[str] = Field(default=None, alias="planStatus")
    role: Optional[str] = None
    seat_capacity: int = Field(default=0, alias="seatCapacity")
    subscription_id: Optional[str] = Field(default=None, alias="subscriptionId")
    period_end: Optional[str] = Field(default=None, alias="periodEnd")
    period_start: Optional[str] = Field(default=None, alias="periodStart")
    usage_by_user: float = Field(default=0, alias="usageByUser")
    workspace_name: str = Field(alias="workspaceName")


class AdminOperatorUserPlan(TangentApiModel):
    pause_reason: Optional[str] = Field(default=None, alias="pauseReason")
    paused_at: Optional[str] = Field(default=None, alias="pausedAt")
    paused_by: Optional[str] = Field(default=None, alias="pausedBy")
    period_end: Optional[str] = Field(default=None, alias="periodEnd")
    period_start: Optional[str] = Field(default=None, alias="periodStart")
    plan_key: str = Field(alias="planKey")
    status: str
    subscription_id: str = Field(alias="subscriptionId")


class AdminOperatorUserRow(TangentApiModel):
    created_at: str = Field(alias="createdAt")
    display_name: str = Field(alias="displayName")
    email: str
    group_plans_active: list[AdminOperatorUserPlan] = Field(default_factory=list, alias="groupPlansActive")
    group_plans_expired: list[AdminOperatorUserPlan] = Field(default_factory=list, alias="groupPlansExpired")
    id: str
    ip_address: Optional[str] = Field(default=None, alias="ipAddress")
    last_login_at: Optional[str] = Field(default=None, alias="lastLoginAt")
    owned_group_count: int = Field(default=0, alias="ownedGroupCount")
    owned_team_count: int = Field(default=0, alias="ownedTeamCount")
    personal_credit: AdminOperatorCreditSummary = Field(alias="personalCredit")
    registration_state: str = Field(default="registered", alias="registrationState")
    status: str
    team_plans_active: list[AdminOperatorWorkspacePlan] = Field(default_factory=list, alias="teamPlansActive")
    team_plans_expired: list[AdminOperatorWorkspacePlan] = Field(default_factory=list, alias="teamPlansExpired")
    total_credits_spent: float = Field(default=0, alias="totalCreditsSpent")


class AdminOperatorBillingHistoryRow(TangentApiModel):
    amount_cents: Optional[int] = Field(default=None, alias="amountCents")
    created_at: str = Field(alias="createdAt")
    id: str
    item: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    personal_credits_delta: float = Field(default=0, alias="personalCreditsDelta")
    reason: Optional[str] = None
    team_credits_delta: float = Field(default=0, alias="teamCreditsDelta")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class AdminOperatorUserDetail(TangentApiModel):
    billing_history: list[AdminOperatorBillingHistoryRow] = Field(default_factory=list, alias="billingHistory")
    group_plans_active: list[AdminOperatorUserPlan] = Field(default_factory=list, alias="groupPlansActive")
    group_plans_expired: list[AdminOperatorUserPlan] = Field(default_factory=list, alias="groupPlansExpired")
    joined_groups: list[AdminOperatorWorkspacePlan] = Field(default_factory=list, alias="joinedGroups")
    joined_teams: list[AdminOperatorWorkspacePlan] = Field(default_factory=list, alias="joinedTeams")
    owned_groups: list[AdminOperatorWorkspacePlan] = Field(default_factory=list, alias="ownedGroups")
    owned_teams: list[AdminOperatorWorkspacePlan] = Field(default_factory=list, alias="ownedTeams")
    user: AdminOperatorUserRow


class AdminOperatorUsersResponse(TangentApiModel):
    error: Optional[str] = None
    limit: int
    offset: int
    ok: bool
    total_count: int = Field(default=0, alias="totalCount")
    users: list[AdminOperatorUserRow] = Field(default_factory=list)


class AdminOperatorUserDetailResponse(TangentApiModel):
    detail: Optional[AdminOperatorUserDetail] = None
    error: Optional[str] = None
    ok: bool


class AdminOperatorReasonRequest(TangentApiModel):
    reason: str = Field(min_length=1)

    @field_validator("reason")
    @classmethod
    def validate_reason(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Reason is required.")
        return normalized


class AdminOperatorUserStatusRequest(AdminOperatorReasonRequest):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"active", "suspended"}:
            raise ValueError("Status must be active or suspended.")
        return normalized


class AdminOperatorUserMutationResponse(TangentApiModel):
    audit_id: Optional[str] = Field(default=None, alias="auditId")
    message: str
    ok: bool
    status: str
    user_id: str = Field(alias="userId")


class AdminOperatorSubscriptionMutationResponse(TangentApiModel):
    audit_id: Optional[str] = Field(default=None, alias="auditId")
    message: str
    ok: bool
    status: str
    subscription_id: str = Field(alias="subscriptionId")
    user_id: Optional[str] = Field(default=None, alias="userId")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class AdminOperatorWorkspaceMemberRoleRequest(AdminOperatorReasonRequest):
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"admin", "editor", "viewer"}:
            raise ValueError("Role must be admin, editor or viewer.")
        return normalized


class AdminOperatorWorkspaceMemberCreateRequest(AdminOperatorReasonRequest):
    role: str
    user_id: str = Field(alias="userId")

    @field_validator("role")
    @classmethod
    def validate_create_role(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"admin", "editor", "viewer"}:
            raise ValueError("Role must be admin, editor or viewer.")
        return normalized

    @field_validator("user_id")
    @classmethod
    def validate_user_id(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("User ID is required.")
        return normalized


class AdminOperatorWorkspaceMemberMutationResponse(TangentApiModel):
    audit_id: Optional[str] = Field(default=None, alias="auditId")
    message: str
    ok: bool
    role: Optional[str] = None
    user_id: str = Field(alias="userId")
    workspace_id: str = Field(alias="workspaceId")


class AdminOperatorWorkspaceInvitationCreateRequest(AdminOperatorReasonRequest):
    email: Optional[str] = None
    expires_in_days: int = Field(default=7, alias="expiresInDays")
    metadata: dict[str, Any] = Field(default_factory=dict)
    role: str
    target_user_id: Optional[str] = Field(default=None, alias="targetUserId")

    @field_validator("expires_in_days")
    @classmethod
    def validate_expiry(cls, value: int) -> int:
        if value < 1 or value > 30:
            raise ValueError("Invite expiry must be between 1 and 30 days.")
        return value

    @field_validator("role")
    @classmethod
    def validate_invite_role(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"admin", "editor", "viewer"}:
            raise ValueError("Role must be admin, editor or viewer.")
        return normalized


class AdminOperatorWorkspaceInvitationCreateResponse(TangentApiModel):
    accept_path: str = Field(alias="acceptPath")
    audit_id: Optional[str] = Field(default=None, alias="auditId")
    invitation: WorkspaceInvitationRecord
    message: str
    ok: bool
    token: str
    workspace_id: str = Field(alias="workspaceId")


class AdminOperatorWorkspaceInvitationResponse(TangentApiModel):
    audit_id: Optional[str] = Field(default=None, alias="auditId")
    invitation: WorkspaceInvitationRecord
    message: str
    ok: bool
    workspace_id: str = Field(alias="workspaceId")


class AdminOperatorWorkspaceInvitationsResponse(TangentApiModel):
    invitations: list[WorkspaceInvitationRecord] = Field(default_factory=list)
    ok: bool
    workspace_id: str = Field(alias="workspaceId")


class AdminOperatorBoardMutationResponse(TangentApiModel):
    audit_id: Optional[str] = Field(default=None, alias="auditId")
    board: Optional[BoardSummary] = None
    board_id: str = Field(alias="boardId")
    message: str
    ok: bool
    workspace_id: str = Field(alias="workspaceId")
