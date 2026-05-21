from typing import Optional

from pydantic import Field

from tangent_api.schema_base import TangentApiModel


class AdminAiRunRecord(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    charged_account_id: Optional[str] = Field(default=None, alias="chargedAccountId")
    charged_scope: Optional[str] = Field(default=None, alias="chargedScope")
    cost_credits: float = Field(alias="costCredits")
    created_at: str = Field(alias="createdAt")
    error_message: Optional[str] = Field(default=None, alias="errorMessage")
    estimated_credits: float = Field(alias="estimatedCredits")
    id: str
    input_asset_ids: list[str] = Field(default_factory=list, alias="inputAssetIds")
    latency_ms: int = Field(alias="latencyMs")
    model_id: str = Field(alias="modelId")
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    output_asset_ids: list[str] = Field(default_factory=list, alias="outputAssetIds")
    preflight_status: Optional[str] = Field(default=None, alias="preflightStatus")
    pricing_rule_id: Optional[str] = Field(default=None, alias="pricingRuleId")
    prompt_preview: Optional[str] = Field(default=None, alias="promptPreview")
    provider: str
    provider_cost: Optional[float] = Field(default=None, alias="providerCost")
    provider_currency: Optional[str] = Field(default=None, alias="providerCurrency")
    route_id: Optional[str] = Field(default=None, alias="routeId")
    route_key: Optional[str] = Field(default=None, alias="routeKey")
    run_type: str = Field(alias="runType")
    selected_tier_key: Optional[str] = Field(default=None, alias="selectedTierKey")
    status: str
    updated_at: str = Field(alias="updatedAt")
    user_id: Optional[str] = Field(default=None, alias="userId")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class AdminAiRunsResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    runs: list[AdminAiRunRecord] = Field(default_factory=list)


class AdminAiApiCallRecord(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    created_at: str = Field(alias="createdAt")
    credits_charged: float = Field(alias="creditsCharged")
    credits_refunded: float = Field(alias="creditsRefunded")
    error_code: Optional[str] = Field(default=None, alias="errorCode")
    id: str
    latency_ms: int = Field(alias="latencyMs")
    model_id: str = Field(alias="modelId")
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    pricing_rule_id: Optional[str] = Field(default=None, alias="pricingRuleId")
    provider: str
    provider_cost: Optional[float] = Field(default=None, alias="providerCost")
    provider_currency: Optional[str] = Field(default=None, alias="providerCurrency")
    route_id: Optional[str] = Field(default=None, alias="routeId")
    route_key: Optional[str] = Field(default=None, alias="routeKey")
    run_id: str = Field(alias="runId")
    status: str
    user_id: Optional[str] = Field(default=None, alias="userId")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class AdminAiApiCallsResponse(TangentApiModel):
    api_calls: list[AdminAiApiCallRecord] = Field(default_factory=list, alias="apiCalls")
    error: Optional[str] = None
    ok: bool
