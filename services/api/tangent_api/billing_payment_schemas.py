from typing import Any, Optional

from pydantic import Field

from tangent_api.schema_base import TangentApiModel


class BillingPaymentRecord(TangentApiModel):
    account_id: Optional[str] = Field(default=None, alias="accountId")
    amount_cents: int = Field(alias="amountCents")
    checkout_session_id: Optional[str] = Field(default=None, alias="checkoutSessionId")
    created_at: str = Field(alias="createdAt")
    currency: str
    id: str
    kind: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    provider: str
    provider_payment_id: Optional[str] = Field(default=None, alias="providerPaymentId")
    status: str


class BillingPaymentsResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    payments: list[BillingPaymentRecord] = Field(default_factory=list)


class BillingTopupCheckoutRequest(TangentApiModel):
    credits: float
    currency: str = "usd"
    metadata: dict[str, Any] = Field(default_factory=dict)


class BillingSeatPurchaseCheckoutRequest(TangentApiModel):
    currency: str = "usd"
    metadata: dict[str, Any] = Field(default_factory=dict)
    plan_key: str = Field(alias="planKey")
    quantity: int = 1


class BillingCollaborateSubscriptionCheckoutRequest(TangentApiModel):
    currency: str = "usd"
    metadata: dict[str, Any] = Field(default_factory=dict)
    plan_key: str = Field(alias="planKey")


class BillingTeamSubscriptionCheckoutRequest(TangentApiModel):
    currency: str = "usd"
    metadata: dict[str, Any] = Field(default_factory=dict)
    plan_key: str = Field(alias="planKey")
    quantity: int = 1
    team_name: str = Field(alias="teamName")


class BillingPaymentMutationResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    payment: Optional[BillingPaymentRecord] = None
    topup_entry_id: Optional[str] = Field(default=None, alias="topupEntryId")
