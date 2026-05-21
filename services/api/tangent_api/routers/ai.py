from typing import Optional

from fastapi import APIRouter, Depends, Request

from tangent_api.ai_contracts import cancel_ai_run, create_ai_run, get_ai_run, list_models
from tangent_api.ai_control_plane import build_ai_run_quote
from tangent_api.ai_schemas import AiModelsResponse, AiRunQuoteResponse, AiRunRequest, AiRunResponse
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.security_business_limits import assert_daily_business_limit
from tangent_api.security_idempotency import run_idempotent

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


@router.get("/models", response_model=AiModelsResponse)
def get_models(
    capability: Optional[str] = None,
    context: ApiRequestContext = Depends(get_request_context),
) -> AiModelsResponse:
    _ = context
    return AiModelsResponse(models=list_models(capability), ok=True)


@router.post("/runs/quote", response_model=AiRunQuoteResponse)
def quote_run(
    payload: AiRunRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AiRunQuoteResponse:
    return AiRunQuoteResponse(ok=True, quote=build_ai_run_quote(payload, context))


@router.post("/runs", response_model=AiRunResponse)
def create_run(
    payload: AiRunRequest,
    request: Request,
    context: ApiRequestContext = Depends(get_request_context),
) -> AiRunResponse:
    return run_idempotent(
        request,
        context,
        action="ai.run.create",
        fingerprint_payload=payload,
        produce=lambda: _create_run_with_quota(payload, context),
    )


@router.post("/runs/{run_id}/cancel", response_model=AiRunResponse)
def cancel_run(
    run_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> AiRunResponse:
    return AiRunResponse(ok=True, run=cancel_ai_run(run_id, context))


@router.get("/runs/{run_id}", response_model=AiRunResponse)
def get_run(
    run_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> AiRunResponse:
    return AiRunResponse(ok=True, run=get_ai_run(run_id, context))


def _create_run_with_quota(payload: AiRunRequest, context: ApiRequestContext) -> AiRunResponse:
    assert_daily_business_limit(
        context,
        action="ai.run.create",
        default_limit=200,
        env_name="TANGENT_AI_RUN_DAILY_LIMIT",
    )
    return AiRunResponse(ok=True, run=create_ai_run(payload, context))
