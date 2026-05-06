from typing import Any, Optional

from pydantic import Field

from tangent_api.ai_schemas import AiRunChargeSummary
from tangent_api.schema_base import TangentApiModel


class CreditLedgerEntryRecord(TangentApiModel):
    account_id: str = Field(alias="accountId")
    actor_user_id: Optional[str] = Field(default=None, alias="actorUserId")
    created_at: str = Field(alias="createdAt")
    credits_delta: float = Field(alias="creditsDelta")
    id: str
    metadata: dict[str, Any]
    reason: str
    source_id: Optional[str] = Field(default=None, alias="sourceId")
    source_type: str = Field(alias="sourceType")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class CreditLedgerResponse(TangentApiModel):
    account_id: str = Field(alias="accountId")
    balance_credits: float = Field(alias="balanceCredits")
    entries: list[CreditLedgerEntryRecord]
    error: Optional[str] = None
    ok: bool


class CreditPreflightResponse(TangentApiModel):
    account_id: str = Field(alias="accountId")
    available_credits: float = Field(alias="availableCredits")
    can_run: bool = Field(alias="canRun")
    charge: AiRunChargeSummary
    error: Optional[str] = None
    ok: bool
    preflight_status: str = Field(alias="preflightStatus")
    required_credits: float = Field(alias="requiredCredits")
    shortfall_credits: float = Field(alias="shortfallCredits")


class CreditLedgerMutationResponse(TangentApiModel):
    account_id: str = Field(alias="accountId")
    balance_credits: float = Field(alias="balanceCredits")
    entry: CreditLedgerEntryRecord
    error: Optional[str] = None
    ok: bool
