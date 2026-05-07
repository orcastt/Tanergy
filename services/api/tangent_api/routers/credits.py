from typing import Optional

from fastapi import APIRouter, Depends, Query

from tangent_api.credit_ledger import (
    build_credit_ledger_response,
    build_credit_preflight_response,
    record_topup_purchase,
)
from tangent_api.credit_schemas import (
    CreditLedgerMutationResponse,
    CreditLedgerResponse,
    CreditPreflightResponse,
    CreditTopupRequest,
)
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/api/v1/credits", tags=["credits"])


@router.get("/ledger", response_model=CreditLedgerResponse)
def get_credit_ledger(
    actor_user_id: Optional[str] = Query(default=None, alias="actorUserId", min_length=1),
    limit: int = Query(default=50, ge=1, le=100),
    reason: Optional[str] = Query(default=None, min_length=1),
    source_id: Optional[str] = Query(default=None, alias="sourceId", min_length=1),
    source_type: Optional[str] = Query(default=None, alias="sourceType", min_length=1),
    workspace_id: Optional[str] = Query(default=None, alias="workspaceId", min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> CreditLedgerResponse:
    return build_credit_ledger_response(
        context,
        limit,
        actor_user_id=actor_user_id,
        reason=reason,
        source_id=source_id,
        source_type=source_type,
        workspace_id=workspace_id,
    )


@router.get("/preflight", response_model=CreditPreflightResponse)
def get_credit_preflight(
    required_credits: float = Query(default=0, alias="requiredCredits", ge=0),
    context: ApiRequestContext = Depends(get_request_context),
) -> CreditPreflightResponse:
    return build_credit_preflight_response(context, required_credits)


@router.post("/topups", response_model=CreditLedgerMutationResponse)
def create_credit_topup(
    input_data: CreditTopupRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> CreditLedgerMutationResponse:
    return record_topup_purchase(
        context,
        credits=input_data.credits,
        source_id=input_data.source_id or "manual_topup",
        metadata=input_data.metadata,
    )
