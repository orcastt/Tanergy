from typing import Optional

from pydantic import Field, field_validator

from tangent_api.schema_base import TangentApiModel


class AdminManualReasonModel(TangentApiModel):
    note: str = Field(min_length=1)

    @field_validator("note")
    @classmethod
    def validate_note(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Operation reason is required.")
        return normalized


class AdminManualUserTopupRequest(AdminManualReasonModel):
    amount_cents: int = Field(default=0, alias="amountCents", ge=0)
    credits: float = Field(gt=0)
    currency: str = "usd"
    user_id: str = Field(alias="userId", min_length=1)


class AdminManualCreditAdjustmentRequest(AdminManualReasonModel):
    credits_delta: float = Field(alias="creditsDelta")
    user_id: Optional[str] = Field(default=None, alias="userId")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class AdminManualWorkspaceTopupRequest(AdminManualReasonModel):
    amount_cents: int = Field(default=0, alias="amountCents", ge=0)
    credits: float = Field(gt=0)
    currency: str = "usd"
    workspace_id: str = Field(alias="workspaceId", min_length=1)


class AdminManualCollaboratePlanRequest(AdminManualReasonModel):
    duration_count: int = Field(default=1, alias="durationCount", ge=0)
    duration_unit_days: int = Field(default=30, alias="durationUnitDays", ge=1)
    effect_mode: str = Field(default="immediate", alias="effectMode")
    grant_included_credits: bool = Field(default=True, alias="grantIncludedCredits")
    plan_key: str = Field(alias="planKey", min_length=1)
    period_end: Optional[str] = Field(default=None, alias="periodEnd")
    status: str = "active"
    user_id: str = Field(alias="userId", min_length=1)


class AdminManualTeamPlanRequest(AdminManualReasonModel):
    duration_count: int = Field(default=1, alias="durationCount", ge=0)
    duration_unit_days: int = Field(default=30, alias="durationUnitDays", ge=1)
    effect_mode: str = Field(default="immediate", alias="effectMode")
    grant_included_credits: bool = Field(default=True, alias="grantIncludedCredits")
    plan_key: str = Field(alias="planKey", min_length=1)
    period_end: Optional[str] = Field(default=None, alias="periodEnd")
    seat_capacity: int = Field(default=1, alias="seatCapacity", ge=1)
    status: str = "active"
    workspace_id: str = Field(alias="workspaceId", min_length=1)


class AdminManualGroupPlanOperationRequest(AdminManualReasonModel):
    action: str
    duration_count: int = Field(default=1, alias="durationCount", ge=0)
    duration_unit_days: int = Field(default=30, alias="durationUnitDays", ge=1)
    effect_mode: str = Field(default="immediate", alias="effectMode")
    grant_included_credits: bool = Field(default=True, alias="grantIncludedCredits")
    plan_key: Optional[str] = Field(default=None, alias="planKey")
    status: str = "active"
    subscription_id: Optional[str] = Field(default=None, alias="subscriptionId")
    user_id: str = Field(alias="userId", min_length=1)

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"assign", "renew", "upgrade", "delete", "freeze", "unfreeze"}:
            raise ValueError("Invalid group plan action.")
        return normalized


class AdminManualTeamPlanOperationRequest(AdminManualReasonModel):
    action: str
    duration_count: int = Field(default=1, alias="durationCount", ge=0)
    duration_unit_days: int = Field(default=30, alias="durationUnitDays", ge=1)
    effect_mode: str = Field(default="immediate", alias="effectMode")
    grant_included_credits: bool = Field(default=True, alias="grantIncludedCredits")
    plan_key: Optional[str] = Field(default=None, alias="planKey")
    seat_capacity: Optional[int] = Field(default=None, alias="seatCapacity", ge=1)
    status: str = "active"
    subscription_id: Optional[str] = Field(default=None, alias="subscriptionId")
    workspace_id: str = Field(alias="workspaceId", min_length=1)

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in {"assign", "renew", "upgrade", "delete", "freeze", "unfreeze"}:
            raise ValueError("Invalid team plan action.")
        return normalized


class AdminManualCreateGroupWorkspaceRequest(AdminManualReasonModel):
    user_id: str = Field(alias="userId", min_length=1)
    workspace_name: str = Field(alias="workspaceName", min_length=1)


class AdminManualCreateTeamWorkspaceRequest(AdminManualReasonModel):
    duration_count: int = Field(default=1, alias="durationCount", ge=0)
    duration_unit_days: int = Field(default=30, alias="durationUnitDays", ge=1)
    effect_mode: str = Field(default="immediate", alias="effectMode")
    extra_credits: float = Field(default=0, alias="extraCredits", ge=0)
    grant_included_credits: bool = Field(default=True, alias="grantIncludedCredits")
    period_end: Optional[str] = Field(default=None, alias="periodEnd")
    plan_key: str = Field(alias="planKey", min_length=1)
    seat_capacity: int = Field(default=1, alias="seatCapacity", ge=1)
    status: str = "active"
    user_id: str = Field(alias="userId", min_length=1)
    workspace_name: str = Field(alias="workspaceName", min_length=1)


class AdminManualWorkspaceDeleteRequest(AdminManualReasonModel):
    workspace_id: str = Field(alias="workspaceId", min_length=1)


class AdminManualSubscriptionCancelRequest(AdminManualReasonModel):
    subscription_id: str = Field(alias="subscriptionId", min_length=1)


class AdminManualFinanceMutationResponse(TangentApiModel):
    account_id: Optional[str] = Field(default=None, alias="accountId")
    action: Optional[str] = None
    audit_id: Optional[str] = Field(default=None, alias="auditId")
    balance_credits: Optional[float] = Field(default=None, alias="balanceCredits")
    effective_at: Optional[str] = Field(default=None, alias="effectiveAt")
    granted_credits: Optional[float] = Field(default=None, alias="grantedCredits")
    ledger_entry_id: Optional[str] = Field(default=None, alias="ledgerEntryId")
    message: str
    ok: bool
    payment_id: Optional[str] = Field(default=None, alias="paymentId")
    period_end: Optional[str] = Field(default=None, alias="periodEnd")
    period_start: Optional[str] = Field(default=None, alias="periodStart")
    plan_key: Optional[str] = Field(default=None, alias="planKey")
    previous_plan_key: Optional[str] = Field(default=None, alias="previousPlanKey")
    seat_capacity: Optional[int] = Field(default=None, alias="seatCapacity")
    subscription_id: Optional[str] = Field(default=None, alias="subscriptionId")
    subscription_status: Optional[str] = Field(default=None, alias="subscriptionStatus")
    user_id: Optional[str] = Field(default=None, alias="userId")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")
