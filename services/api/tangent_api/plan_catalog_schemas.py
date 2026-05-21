from typing import Any, Optional

from pydantic import Field, field_validator

from tangent_api.schema_base import TangentApiModel


class PlanCatalogRecord(TangentApiModel):
    annual_price_usd: Optional[int] = Field(default=None, alias="annualPriceUsd")
    billing_period: str = Field(alias="billingPeriod")
    board_limit: Optional[int] = Field(default=None, alias="boardLimit")
    created_at: Optional[str] = Field(default=None, alias="createdAt")
    group_member_limit: Optional[int] = Field(default=None, alias="groupMemberLimit")
    group_workspace_limit: Optional[int] = Field(default=None, alias="groupWorkspaceLimit")
    included_credits: int = Field(alias="includedCredits")
    metadata: dict[str, Any] = Field(default_factory=dict)
    monthly_price_usd: Optional[int] = Field(default=None, alias="monthlyPriceUsd")
    name: str
    page_limit: Optional[int] = Field(default=None, alias="pageLimit")
    plan_family: str = Field(alias="planFamily")
    plan_key: str = Field(alias="planKey")
    registration_credits: int = Field(alias="registrationCredits")
    seat_max: Optional[int] = Field(default=None, alias="seatMax")
    seat_min: Optional[int] = Field(default=None, alias="seatMin")
    seat_range: Optional[str] = Field(default=None, alias="seatRange")
    updated_at: Optional[str] = Field(default=None, alias="updatedAt")


class PlanCatalogResponse(TangentApiModel):
    ok: bool
    plans: list[PlanCatalogRecord] = Field(default_factory=list)


class PlanCatalogUpdateRequest(TangentApiModel):
    annual_price_usd: Optional[int] = Field(default=None, alias="annualPriceUsd", ge=0)
    billing_period: Optional[str] = Field(default=None, alias="billingPeriod")
    board_limit: Optional[int] = Field(default=None, alias="boardLimit", ge=0)
    group_member_limit: Optional[int] = Field(default=None, alias="groupMemberLimit", ge=0)
    group_workspace_limit: Optional[int] = Field(default=None, alias="groupWorkspaceLimit", ge=0)
    included_credits: Optional[int] = Field(default=None, alias="includedCredits", ge=0)
    metadata: Optional[dict[str, Any]] = None
    monthly_price_usd: Optional[int] = Field(default=None, alias="monthlyPriceUsd", ge=0)
    name: Optional[str] = None
    page_limit: Optional[int] = Field(default=None, alias="pageLimit", ge=0)
    registration_credits: Optional[int] = Field(default=None, alias="registrationCredits", ge=0)
    seat_max: Optional[int] = Field(default=None, alias="seatMax", ge=0)
    seat_min: Optional[int] = Field(default=None, alias="seatMin", ge=0)
    seat_range: Optional[str] = Field(default=None, alias="seatRange")

    @field_validator("billing_period")
    @classmethod
    def validate_billing_period(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in {"contract", "monthly_or_annual", "none"}:
            raise ValueError("Invalid billing period.")
        return normalized

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        if not normalized:
            raise ValueError("Plan name is required.")
        return normalized[:120]

    @field_validator("seat_range")
    @classmethod
    def validate_seat_range(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip()
        return normalized[:120] if normalized else None


class PlanCatalogMutationResponse(TangentApiModel):
    audit_id: Optional[str] = Field(default=None, alias="auditId")
    ok: bool
    plan: PlanCatalogRecord
