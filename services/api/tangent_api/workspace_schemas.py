from typing import Any, Optional

from pydantic import Field

from tangent_api.ai_schemas import AiRunChargeSummary
from tangent_api.schema_base import TangentApiModel


class WorkspacePlanSummary(TangentApiModel):
    billing_period: str = Field(alias="billingPeriod")
    included_credits: int = Field(alias="includedCredits")
    monthly_price_usd: Optional[int] = Field(default=None, alias="monthlyPriceUsd")
    name: str
    plan_key: str = Field(alias="planKey")
    seat_range: Optional[str] = Field(default=None, alias="seatRange")


class PersonalCreditSummary(TangentApiModel):
    included_remaining: int = Field(alias="includedRemaining")
    included_total: int = Field(alias="includedTotal")
    top_up_balance: int = Field(alias="topUpBalance")
    used_this_cycle: int = Field(alias="usedThisCycle")


class BillingWorkspaceSummary(TangentApiModel):
    id: str
    kind: str
    name: str
    role: str


class BillingMeResponse(TangentApiModel):
    charge_scope: str = Field(alias="chargeScope")
    credits: PersonalCreditSummary
    error: Optional[str] = None
    ok: bool
    payer_label: str = Field(alias="payerLabel")
    plan: WorkspacePlanSummary
    workspace: BillingWorkspaceSummary


class WorkspaceDashboardMember(TangentApiModel):
    display_name: str = Field(alias="displayName")
    email: Optional[str] = None
    invited_by: Optional[str] = Field(default=None, alias="invitedBy")
    joined_at: Optional[str] = Field(default=None, alias="joinedAt")
    role: str
    usage_this_cycle: Optional[int] = Field(default=None, alias="usageThisCycle")
    user_id: str = Field(alias="userId")


class WorkspaceDashboardRecord(TangentApiModel):
    board_count: int = Field(alias="boardCount")
    can_see_member_usage: bool = Field(alias="canSeeMemberUsage")
    dashboard_kind: str = Field(alias="dashboardKind")
    member_count: int = Field(alias="memberCount")
    members: list[WorkspaceDashboardMember]
    total_usage_this_cycle: Optional[int] = Field(default=None, alias="totalUsageThisCycle")
    workspace: BillingWorkspaceSummary


class WorkspaceDashboardResponse(TangentApiModel):
    dashboard: WorkspaceDashboardRecord
    error: Optional[str] = None
    ok: bool


class WorkspaceEntitlementResponse(TangentApiModel):
    charge: AiRunChargeSummary
    error: Optional[str] = None
    ok: bool
    plan: WorkspacePlanSummary
    workspace: BillingWorkspaceSummary


class WorkspaceSeatAssignmentRecord(TangentApiModel):
    assigned_by: Optional[str] = Field(default=None, alias="assignedBy")
    current_period_end: Optional[str] = Field(default=None, alias="currentPeriodEnd")
    current_period_start: Optional[str] = Field(default=None, alias="currentPeriodStart")
    id: str
    included_credits: int = Field(alias="includedCredits")
    plan_key: str = Field(alias="planKey")
    status: str
    user_id: str = Field(alias="userId")
    workspace_id: str = Field(alias="workspaceId")


class WorkspaceSeatAssignmentUpsertRequest(TangentApiModel):
    current_period_end: Optional[str] = Field(default=None, alias="currentPeriodEnd")
    current_period_start: Optional[str] = Field(default=None, alias="currentPeriodStart")
    included_credits: Optional[int] = Field(default=None, alias="includedCredits")
    plan_key: str = Field(alias="planKey")
    user_id: str = Field(alias="userId")


class WorkspaceSeatAssignmentResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    seat: WorkspaceSeatAssignmentRecord


class WorkspaceSeatAssignmentsResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    seats: list[WorkspaceSeatAssignmentRecord]


class WorkspaceMemberRoleUpdateRequest(TangentApiModel):
    role: str


class WorkspaceMemberResponse(TangentApiModel):
    error: Optional[str] = None
    member: WorkspaceDashboardMember
    ok: bool


class WorkspaceGroupCreateRequest(TangentApiModel):
    name: str


class WorkspaceCreateResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    workspace: BillingWorkspaceSummary


class WorkspaceInvitationRecord(TangentApiModel):
    accepted_at: Optional[str] = Field(default=None, alias="acceptedAt")
    accepted_by: Optional[str] = Field(default=None, alias="acceptedBy")
    created_at: str = Field(alias="createdAt")
    email: Optional[str] = None
    expires_at: str = Field(alias="expiresAt")
    id: str
    invited_by: Optional[str] = Field(default=None, alias="invitedBy")
    metadata: dict[str, Any] = Field(default_factory=dict)
    revoked_at: Optional[str] = Field(default=None, alias="revokedAt")
    role: str
    target_user_id: Optional[str] = Field(default=None, alias="targetUserId")
    workspace_id: str = Field(alias="workspaceId")


class WorkspaceInvitationCreateRequest(TangentApiModel):
    email: Optional[str] = None
    expires_in_days: int = Field(default=7, alias="expiresInDays")
    metadata: dict[str, Any] = Field(default_factory=dict)
    role: str
    target_user_id: Optional[str] = Field(default=None, alias="targetUserId")


class WorkspaceInvitationCreateRecord(TangentApiModel):
    accept_path: str = Field(alias="acceptPath")
    invitation: WorkspaceInvitationRecord
    token: str


class WorkspaceInvitationCreateResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    result: WorkspaceInvitationCreateRecord


class WorkspaceInvitationAcceptRecord(TangentApiModel):
    invitation: WorkspaceInvitationRecord
    role: str
    workspace_id: str = Field(alias="workspaceId")


class WorkspaceInvitationAcceptResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    result: WorkspaceInvitationAcceptRecord


class WorkspaceInvitationResponse(TangentApiModel):
    error: Optional[str] = None
    invitation: WorkspaceInvitationRecord
    ok: bool


class WorkspaceInvitationsResponse(TangentApiModel):
    error: Optional[str] = None
    invitations: list[WorkspaceInvitationRecord] = Field(default_factory=list)
    ok: bool
