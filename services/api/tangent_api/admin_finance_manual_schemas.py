from typing import Optional

from pydantic import Field

from tangent_api.schema_base import TangentApiModel


class AdminManualUserTopupRequest(TangentApiModel):
    amount_cents: int = Field(default=0, alias="amountCents", ge=0)
    credits: float = Field(gt=0)
    currency: str = "usd"
    note: Optional[str] = None
    user_id: str = Field(alias="userId", min_length=1)


class AdminManualWorkspaceTopupRequest(TangentApiModel):
    amount_cents: int = Field(default=0, alias="amountCents", ge=0)
    credits: float = Field(gt=0)
    currency: str = "usd"
    note: Optional[str] = None
    workspace_id: str = Field(alias="workspaceId", min_length=1)


class AdminManualCollaboratePlanRequest(TangentApiModel):
    grant_included_credits: bool = Field(default=True, alias="grantIncludedCredits")
    note: Optional[str] = None
    plan_key: str = Field(alias="planKey", min_length=1)
    status: str = "active"
    user_id: str = Field(alias="userId", min_length=1)


class AdminManualTeamPlanRequest(TangentApiModel):
    grant_included_credits: bool = Field(default=True, alias="grantIncludedCredits")
    note: Optional[str] = None
    plan_key: str = Field(alias="planKey", min_length=1)
    seat_capacity: int = Field(default=1, alias="seatCapacity", ge=1)
    status: str = "active"
    workspace_id: str = Field(alias="workspaceId", min_length=1)


class AdminManualSubscriptionCancelRequest(TangentApiModel):
    note: Optional[str] = None
    subscription_id: str = Field(alias="subscriptionId", min_length=1)


class AdminManualFinanceMutationResponse(TangentApiModel):
    account_id: Optional[str] = Field(default=None, alias="accountId")
    audit_id: Optional[str] = Field(default=None, alias="auditId")
    balance_credits: Optional[float] = Field(default=None, alias="balanceCredits")
    ledger_entry_id: Optional[str] = Field(default=None, alias="ledgerEntryId")
    message: str
    ok: bool
    payment_id: Optional[str] = Field(default=None, alias="paymentId")
    subscription_id: Optional[str] = Field(default=None, alias="subscriptionId")
