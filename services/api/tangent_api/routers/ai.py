from typing import Optional

from fastapi import APIRouter, Depends

from tangent_api.ai_contracts import create_mock_run, get_mock_run, list_models
from tangent_api.ai_schemas import AiModelsResponse, AiRunRequest, AiRunResponse
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])


@router.get("/models", response_model=AiModelsResponse)
def get_models(
    capability: Optional[str] = None,
    context: ApiRequestContext = Depends(get_request_context),
) -> AiModelsResponse:
    _ = context
    return AiModelsResponse(models=list_models(capability), ok=True)


@router.post("/runs", response_model=AiRunResponse)
def create_run(
    payload: AiRunRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> AiRunResponse:
    return AiRunResponse(ok=True, run=create_mock_run(payload, context))


@router.get("/runs/{run_id}", response_model=AiRunResponse)
def get_run(
    run_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> AiRunResponse:
    _ = context
    return AiRunResponse(ok=True, run=get_mock_run(run_id))
