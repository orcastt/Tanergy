from typing import Any, Optional

from pydantic import Field, field_validator

from tangent_api.schema_base import TangentApiModel


class AiModelOption(TangentApiModel):
    capabilities: list[str]
    cost_hint: str = Field(alias="costHint")
    default_tier_key: Optional[str] = Field(default=None, alias="defaultTierKey")
    display_name: str = Field(alias="displayName")
    estimated_latency: str = Field(alias="estimatedLatency")
    id: str
    is_default: bool = Field(alias="isDefault")
    is_enabled: bool = Field(alias="isEnabled")
    parameter_schema: dict[str, Any] = Field(alias="parameterSchema")
    provider: str
    tier_options: list[dict[str, Any]] = Field(default_factory=list, alias="tierOptions")


class AiModelsResponse(TangentApiModel):
    error: Optional[str] = None
    models: list[AiModelOption]
    ok: bool


class AiRunChargeSummary(TangentApiModel):
    charged_account_id: str = Field(alias="chargedAccountId")
    charged_scope: str = Field(alias="chargedScope")
    entitlement_source: str = Field(alias="entitlementSource")
    payer_label: str = Field(alias="payerLabel")
    plan_key: str = Field(alias="planKey")
    preflight_status: str = Field(alias="preflightStatus")
    workspace_kind: str = Field(alias="workspaceKind")
    workspace_seat_id: Optional[str] = Field(default=None, alias="workspaceSeatId")


class AiRunRequest(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    input_asset_ids: list[str] = Field(default_factory=list, alias="inputAssetIds", max_length=8)
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    node_type: Optional[str] = Field(default=None, alias="nodeType")
    params: dict[str, Any] = Field(default_factory=dict)
    prompt: Optional[str] = None
    run_type: str = Field(alias="runType")
    selected_model_id: Optional[str] = Field(default=None, alias="selectedModelId")
    system_prompt: Optional[str] = Field(default=None, alias="systemPrompt")

    @field_validator("input_asset_ids", mode="before")
    @classmethod
    def _normalize_input_asset_ids(cls, value):
        if value is None:
            return []
        if not isinstance(value, list):
            raise ValueError("inputAssetIds must be a list.")
        unique_ids: list[str] = []
        seen: set[str] = set()
        for item in value:
            if not isinstance(item, str):
                raise ValueError("inputAssetIds must contain asset ids.")
            asset_id = item.strip()
            if not asset_id or asset_id in seen:
                continue
            seen.add(asset_id)
            unique_ids.append(asset_id)
        if len(unique_ids) > 8:
            raise ValueError("inputAssetIds must contain at most 8 assets.")
        return unique_ids

    @field_validator("prompt", mode="before")
    @classmethod
    def _normalize_prompt(cls, value):
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("prompt must be a string.")
        prompt = value.strip()
        if len(prompt) > 8000:
            raise ValueError("prompt must be 8000 characters or fewer.")
        return prompt or None

    @field_validator("system_prompt", mode="before")
    @classmethod
    def _normalize_system_prompt(cls, value):
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError("systemPrompt must be a string.")
        system_prompt = value.strip()
        if len(system_prompt) > 4000:
            raise ValueError("systemPrompt must be 4000 characters or fewer.")
        return system_prompt or None

    @field_validator("run_type", mode="before")
    @classmethod
    def _normalize_run_type(cls, value):
        if not isinstance(value, str):
            raise ValueError("runType must be a string.")
        run_type = value.strip()
        if run_type not in {"image_analysis", "image_edit", "image_generation", "text"}:
            raise ValueError("runType is unsupported.")
        return run_type


class AiRunRecord(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    charge: AiRunChargeSummary
    charged_account_id: str = Field(alias="chargedAccountId")
    charged_scope: str = Field(alias="chargedScope")
    cost_credits: float = Field(alias="costCredits")
    cost_hint: str = Field(alias="costHint")
    created_at: str = Field(alias="createdAt")
    estimated_credits: float = Field(default=0, alias="estimatedCredits")
    entitlement_source: str = Field(alias="entitlementSource")
    error: Optional[str] = None
    input_asset_ids: list[str] = Field(alias="inputAssetIds")
    latency_ms: int = Field(alias="latencyMs")
    model_id: str = Field(alias="modelId")
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    output_asset_ids: list[str] = Field(alias="outputAssetIds")
    pricing_rule_id: Optional[str] = Field(default=None, alias="pricingRuleId")
    provider: str
    provider_cost: Optional[float] = Field(default=None, alias="providerCost")
    provider_currency: Optional[str] = Field(default=None, alias="providerCurrency")
    route_id: Optional[str] = Field(default=None, alias="routeId")
    route_key: Optional[str] = Field(default=None, alias="routeKey")
    run_id: str = Field(alias="runId")
    run_type: str = Field(alias="runType")
    selected_tier_key: Optional[str] = Field(default=None, alias="selectedTierKey")
    status: str
    text_output: Optional[str] = Field(default=None, alias="textOutput")
    workspace_kind: str = Field(alias="workspaceKind")
    workspace_seat_id: Optional[str] = Field(default=None, alias="workspaceSeatId")


class AiRunQuoteRecord(TangentApiModel):
    account_id: str = Field(alias="accountId")
    available_credits: float = Field(alias="availableCredits")
    billing_unit: str = Field(alias="billingUnit")
    can_run: bool = Field(alias="canRun")
    charge: AiRunChargeSummary
    cost_hint: str = Field(alias="costHint")
    estimated_credits: float = Field(alias="estimatedCredits")
    model_display_name: str = Field(alias="modelDisplayName")
    model_id: str = Field(alias="modelId")
    parameter_key: Optional[str] = Field(default=None, alias="parameterKey")
    preflight_status: str = Field(alias="preflightStatus")
    pricing_rule_id: Optional[str] = Field(default=None, alias="pricingRuleId")
    required_credits: float = Field(alias="requiredCredits")
    route_id: Optional[str] = Field(default=None, alias="routeId")
    route_key: Optional[str] = Field(default=None, alias="routeKey")
    selected_tier_key: Optional[str] = Field(default=None, alias="selectedTierKey")
    selected_tier_label: Optional[str] = Field(default=None, alias="selectedTierLabel")
    shortfall_credits: float = Field(alias="shortfallCredits")


class AiRunQuoteResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    quote: Optional[AiRunQuoteRecord] = None


class AiRunResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    run: Optional[AiRunRecord] = None
