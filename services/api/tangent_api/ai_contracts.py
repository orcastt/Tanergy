import re
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.ai_schemas import AiModelOption, AiRunRecord, AiRunRequest
from tangent_api.request_context import ApiRequestContext
from tangent_api.workspace_entitlements import resolve_ai_charge_summary

MOCK_AI_MODELS = [
    AiModelOption(
        capabilities=["image_generation", "image_edit"],
        costHint="Use low quality for early tests.",
        displayName="GPT Image 2",
        estimatedLatency="5-12s",
        id="gpt-image-2",
        isDefault=True,
        isEnabled=True,
        parameterSchema={
            "aspectRatio": ["auto", "1:1", "4:3", "16:9", "3:2"],
            "resolution": ["0.5K", "1K", "2K"],
        },
        provider="geekai",
    ),
    AiModelOption(
        capabilities=["image_generation", "image_edit", "image_reference"],
        costHint="Use 0.5K for fast mock validation.",
        displayName="Gemini 3.1 Flash Image Preview",
        estimatedLatency="4-10s",
        id="gemini-3.1-flash-image-preview",
        isDefault=False,
        isEnabled=True,
        parameterSchema={
            "aspectRatio": ["auto", "1:1", "4:3", "16:9"],
            "resolution": ["0.5K", "1K", "2K", "4K"],
        },
        provider="geekai",
    ),
]

RUNS: dict[str, AiRunRecord] = {}


def list_models(capability: Optional[str]) -> list[AiModelOption]:
    if not capability:
        return MOCK_AI_MODELS
    return [model for model in MOCK_AI_MODELS if capability in model.capabilities]


def create_mock_run(payload: AiRunRequest, context: ApiRequestContext) -> AiRunRecord:
    model = _find_model(payload.selected_model_id)
    charge = resolve_ai_charge_summary(context)
    run_id = f"run_mock_{uuid4()}"
    prompt = (payload.prompt or "Untitled prompt").strip() or "Untitled prompt"
    count = _clamp_count(payload.params.get("count", 1)) if payload.run_type == "image_generation" else 0
    output_asset_ids = [
        f"asset_mock_{run_id}_{index + 1}_{_slugify(prompt)}_refs{len(payload.input_asset_ids)}"
        for index in range(count)
    ]
    run = AiRunRecord(
        boardId=payload.board_id,
        charge=charge,
        chargedAccountId=charge.charged_account_id,
        chargedScope=charge.charged_scope,
        costCredits=0,
        costHint=f"Mock AI run · {charge.payer_label}",
        createdAt=datetime.now(timezone.utc).isoformat(),
        entitlementSource=charge.entitlement_source,
        error=None,
        inputAssetIds=payload.input_asset_ids,
        latencyMs=450 if payload.run_type == "image_generation" else 180,
        modelId=model.id,
        nodeId=payload.node_id,
        outputAssetIds=output_asset_ids,
        provider=model.provider,
        runId=run_id,
        runType=payload.run_type,
        status="succeeded",
        textOutput=_mock_analysis_text(prompt, payload.input_asset_ids) if payload.run_type == "image_analysis" else None,
        workspaceKind=charge.workspace_kind,
        workspaceSeatId=charge.workspace_seat_id,
    )
    RUNS[run.run_id] = run
    return run


def get_mock_run(run_id: str) -> AiRunRecord:
    run = RUNS.get(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="AI run not found.")
    return run


def _find_model(model_id: Optional[str]) -> AiModelOption:
    model = next((item for item in MOCK_AI_MODELS if item.id == model_id), None)
    if not model:
        model = next((item for item in MOCK_AI_MODELS if item.is_default), None)
    if not model or not model.is_enabled:
        raise HTTPException(status_code=400, detail="The selected image model is unavailable.")
    return model


def _clamp_count(value: object) -> int:
    try:
        numeric = int(value)
    except (TypeError, ValueError):
        return 1
    return max(1, min(4, numeric))


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return slug[:24] or "prompt"


def _mock_analysis_text(prompt: str, input_asset_ids: list[str]) -> str:
    asset_list = ", ".join(input_asset_ids) or "none"
    return f"Mock analysis: read {len(input_asset_ids)} image(s). Reverse prompt: {prompt}. Source assets: {asset_list}"
