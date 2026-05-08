from typing import Any, Optional

from pydantic import Field

from tangent_api.schema_base import TangentApiModel


class AdminFinanceCountRecord(TangentApiModel):
    amount_cents: int = Field(default=0, alias="amountCents")
    count: int
    key: str


class AdminFinanceAccountCountRecord(TangentApiModel):
    account_kind: str = Field(alias="accountKind")
    count: int
    owner_type: str = Field(alias="ownerType")
    status: str


class AdminFinanceSubscriptionCountRecord(TangentApiModel):
    count: int
    plan_family: str = Field(alias="planFamily")
    seat_capacity: int = Field(alias="seatCapacity")
    status: str


class AdminFinanceLedgerTotals(TangentApiModel):
    balance_credits: float = Field(alias="balanceCredits")
    granted_credits: float = Field(alias="grantedCredits")
    spent_credits: float = Field(alias="spentCredits")


class AdminFinanceSummaryRecord(TangentApiModel):
    account_counts: list[AdminFinanceAccountCountRecord] = Field(default_factory=list, alias="accountCounts")
    ledger_totals: AdminFinanceLedgerTotals = Field(alias="ledgerTotals")
    payment_kind_counts: list[AdminFinanceCountRecord] = Field(default_factory=list, alias="paymentKindCounts")
    payment_provider_counts: list[AdminFinanceCountRecord] = Field(default_factory=list, alias="paymentProviderCounts")
    payment_status_counts: list[AdminFinanceCountRecord] = Field(default_factory=list, alias="paymentStatusCounts")
    subscription_counts: list[AdminFinanceSubscriptionCountRecord] = Field(default_factory=list, alias="subscriptionCounts")


class AdminFinancePaymentRecord(TangentApiModel):
    account_id: Optional[str] = Field(default=None, alias="accountId")
    account_kind: Optional[str] = Field(default=None, alias="accountKind")
    amount_cents: int = Field(alias="amountCents")
    checkout_session_id: Optional[str] = Field(default=None, alias="checkoutSessionId")
    created_at: str = Field(alias="createdAt")
    currency: str
    id: str
    kind: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    owner_id: Optional[str] = Field(default=None, alias="ownerId")
    owner_type: Optional[str] = Field(default=None, alias="ownerType")
    provider: str
    provider_payment_id: Optional[str] = Field(default=None, alias="providerPaymentId")
    status: str


class AdminFinanceWalletRecord(TangentApiModel):
    account_id: str = Field(alias="accountId")
    account_kind: str = Field(alias="accountKind")
    balance_credits: float = Field(alias="balanceCredits")
    created_at: str = Field(alias="createdAt")
    owner_id: str = Field(alias="ownerId")
    owner_type: str = Field(alias="ownerType")
    status: str
    updated_at: str = Field(alias="updatedAt")


class AdminFinanceLedgerRecord(TangentApiModel):
    account_id: str = Field(alias="accountId")
    account_kind: Optional[str] = Field(default=None, alias="accountKind")
    actor_user_id: Optional[str] = Field(default=None, alias="actorUserId")
    created_at: str = Field(alias="createdAt")
    credits_delta: float = Field(alias="creditsDelta")
    id: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    owner_id: Optional[str] = Field(default=None, alias="ownerId")
    owner_type: Optional[str] = Field(default=None, alias="ownerType")
    reason: str
    source_id: Optional[str] = Field(default=None, alias="sourceId")
    source_type: str = Field(alias="sourceType")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class AdminFinanceSubscriptionRecord(TangentApiModel):
    account_id: str = Field(alias="accountId")
    created_at: str = Field(alias="createdAt")
    current_period_end: Optional[str] = Field(default=None, alias="currentPeriodEnd")
    current_period_start: Optional[str] = Field(default=None, alias="currentPeriodStart")
    id: str
    owner_id: str = Field(alias="ownerId")
    owner_type: str = Field(alias="ownerType")
    plan_family: str = Field(alias="planFamily")
    plan_key: str = Field(alias="planKey")
    provider: str
    provider_customer_id: Optional[str] = Field(default=None, alias="providerCustomerId")
    provider_subscription_id: Optional[str] = Field(default=None, alias="providerSubscriptionId")
    seat_capacity: int = Field(alias="seatCapacity")
    status: str
    updated_at: str = Field(alias="updatedAt")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class AdminFinanceMemberUsageRecord(TangentApiModel):
    charge_count: int = Field(alias="chargeCount")
    display_name: str = Field(alias="displayName")
    email: Optional[str] = None
    last_usage_at: Optional[str] = Field(default=None, alias="lastUsageAt")
    role: str
    usage_credits: float = Field(alias="usageCredits")
    user_id: str = Field(alias="userId")
    workspace_id: str = Field(alias="workspaceId")


class AdminFinanceSummaryResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    summary: Optional[AdminFinanceSummaryRecord] = None


class AdminFinancePaymentsResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    payments: list[AdminFinancePaymentRecord] = Field(default_factory=list)


class AdminFinanceWalletsResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    wallets: list[AdminFinanceWalletRecord] = Field(default_factory=list)


class AdminFinanceLedgerResponse(TangentApiModel):
    error: Optional[str] = None
    ledger: list[AdminFinanceLedgerRecord] = Field(default_factory=list)
    ok: bool


class AdminFinanceSubscriptionsResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    subscriptions: list[AdminFinanceSubscriptionRecord] = Field(default_factory=list)


class AdminFinanceMemberUsageResponse(TangentApiModel):
    error: Optional[str] = None
    member_usage: list[AdminFinanceMemberUsageRecord] = Field(default_factory=list, alias="memberUsage")
    ok: bool
