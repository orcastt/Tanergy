from typing import Any, Optional

from pydantic import Field

from tangent_api.schema_base import TangentApiModel


class AiModelOption(TangentApiModel):
    capabilities: list[str]
    cost_hint: str = Field(alias="costHint")
    display_name: str = Field(alias="displayName")
    estimated_latency: str = Field(alias="estimatedLatency")
    id: str
    is_default: bool = Field(alias="isDefault")
    is_enabled: bool = Field(alias="isEnabled")
    parameter_schema: dict[str, Any] = Field(alias="parameterSchema")
    provider: str


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
    input_asset_ids: list[str] = Field(default_factory=list, alias="inputAssetIds")
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    node_type: Optional[str] = Field(default=None, alias="nodeType")
    params: dict[str, Any] = Field(default_factory=dict)
    prompt: Optional[str] = None
    run_type: str = Field(alias="runType")
    selected_model_id: Optional[str] = Field(default=None, alias="selectedModelId")


class AiRunRecord(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    charge: AiRunChargeSummary
    charged_account_id: str = Field(alias="chargedAccountId")
    charged_scope: str = Field(alias="chargedScope")
    cost_credits: float = Field(alias="costCredits")
    cost_hint: str = Field(alias="costHint")
    created_at: str = Field(alias="createdAt")
    entitlement_source: str = Field(alias="entitlementSource")
    error: Optional[str] = None
    input_asset_ids: list[str] = Field(alias="inputAssetIds")
    latency_ms: int = Field(alias="latencyMs")
    model_id: str = Field(alias="modelId")
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    output_asset_ids: list[str] = Field(alias="outputAssetIds")
    provider: str
    run_id: str = Field(alias="runId")
    run_type: str = Field(alias="runType")
    status: str
    text_output: Optional[str] = Field(default=None, alias="textOutput")
    workspace_kind: str = Field(alias="workspaceKind")
    workspace_seat_id: Optional[str] = Field(default=None, alias="workspaceSeatId")


class AiRunResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    run: Optional[AiRunRecord] = None
