from datetime import datetime, timezone
from typing import Optional

from tangent_api.ai_schemas import AiRunChargeSummary, AiRunRecord, AiRunRequest


def build_ai_run_record_from_snapshot(snapshot: dict[str, object]) -> AiRunRecord:
    charge = build_charge(snapshot)
    text_output = snapshot["text_output"]
    if text_output is None and snapshot["run_type"] == "image_analysis" and snapshot["status"] == "succeeded":
        text_output = build_mock_analysis_text(snapshot["prompt_preview"], snapshot["input_asset_ids"])
    return AiRunRecord(
        boardId=snapshot["board_id"],
        charge=charge,
        chargedAccountId=str(snapshot["charged_account_id"]),
        chargedScope=str(snapshot["charged_scope"]),
        costCredits=float(snapshot["cost_credits"] or 0),
        costHint=build_cost_hint(
            charge,
            estimated_credits=float(snapshot["estimated_credits"] or 0),
            charged_credits=float(snapshot["cost_credits"] or 0),
            status=str(snapshot["status"]),
        ),
        createdAt=to_iso(snapshot["created_at"]),
        estimatedCredits=float(snapshot["estimated_credits"] or 0),
        entitlementSource=str(snapshot["entitlement_source"]),
        error=snapshot["error_message"],
        inputAssetIds=list(snapshot["input_asset_ids"]),
        latencyMs=int(snapshot["latency_ms"] or 0),
        modelId=str(snapshot["model_id"]),
        nodeId=snapshot["node_id"],
        outputAssetIds=list(snapshot["output_asset_ids"]),
        pricingRuleId=snapshot["pricing_rule_id"],
        provider=str(snapshot["provider"]),
        providerCost=float(snapshot["provider_cost"]) if snapshot["provider_cost"] is not None else None,
        providerCurrency=snapshot["provider_currency"],
        routeId=snapshot["route_id"],
        routeKey=snapshot["route_key"],
        runId=str(snapshot["id"]),
        runType=str(snapshot["run_type"]),
        selectedTierKey=snapshot["selected_tier_key"],
        status=str(snapshot["status"]),
        textOutput=text_output,
        workspaceKind=str(snapshot["workspace_kind"]),
        workspaceSeatId=snapshot["workspace_seat_id"],
    )


def build_ai_run_request_from_snapshot(snapshot: dict[str, object]) -> AiRunRequest:
    return AiRunRequest(
        boardId=snapshot["board_id"],
        inputAssetIds=list(snapshot["input_asset_ids"]),
        nodeId=snapshot["node_id"],
        nodeType=None,
        params=dict(snapshot["params"]),
        prompt=snapshot["prompt_preview"],
        runType=str(snapshot["run_type"]),
        selectedModelId=str(snapshot["model_id"]),
        systemPrompt=system_prompt_from_params(snapshot["params"]),
    )


def build_charge(snapshot: dict[str, object]) -> AiRunChargeSummary:
    workspace_kind = str(snapshot["workspace_kind"])
    charged_scope = str(snapshot["charged_scope"])
    return AiRunChargeSummary(
        chargedAccountId=str(snapshot["charged_account_id"]),
        chargedScope=charged_scope,
        entitlementSource=str(snapshot["entitlement_source"]),
        payerLabel=payer_label(charged_scope, workspace_kind),
        planKey="unknown",
        preflightStatus=str(snapshot["preflight_status"] or "mock_contract_only"),
        workspaceKind=workspace_kind,
        workspaceSeatId=snapshot["workspace_seat_id"],
    )


def prompt_preview(prompt: Optional[str]) -> Optional[str]:
    if prompt is None:
        return None
    trimmed = prompt.strip()
    return trimmed[:280] if trimmed else None


def persisted_params(payload: AiRunRequest) -> dict[str, object]:
    params = dict(payload.params)
    if payload.system_prompt:
        params.setdefault("systemPrompt", payload.system_prompt)
    return params


def system_prompt_from_params(params: object) -> Optional[str]:
    if not isinstance(params, dict):
        return None
    value = params.get("systemPrompt")
    return value if isinstance(value, str) and value.strip() else None


def build_cost_hint(charge: AiRunChargeSummary, estimated_credits: float, charged_credits: float, status: str) -> str:
    if status == "queued":
        return f"Mock AI run queued · {charge.payer_label}"
    if status == "running":
        return f"Mock AI run running · {charge.payer_label}"
    if status == "canceled":
        return f"Mock AI run canceled · {charge.payer_label}"
    if status == "failed":
        return f"Mock AI run failed · {charge.payer_label}"
    if charge.preflight_status == "settled":
        credits = charged_credits or estimated_credits
        return f"Mock AI run · charged {credits:g} credits · {charge.payer_label}"
    return f"Mock AI run · {charge.payer_label}"


def api_call_attempt_id(run_id: str, attempt_number: int) -> str:
    return f"ai_call_{run_id}_a{attempt_number}"


def build_mock_analysis_text(prompt: str, input_asset_ids: list[str]) -> str:
    asset_list = ", ".join(input_asset_ids) or "none"
    return f"Mock analysis: read {len(input_asset_ids)} image(s). Reverse prompt: {prompt or 'Untitled prompt'}. Source assets: {asset_list}"


def parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def to_iso(value: object) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def payer_label(charged_scope: str, workspace_kind: str) -> str:
    if charged_scope == "team_wallet":
        return "Charges Team wallet"
    if charged_scope == "workspace_pool" or workspace_kind == "enterprise_workspace":
        return "Charges enterprise workspace credits"
    return "Charges your credits"
