from fastapi import APIRouter, Depends, Query

from tangent_api.credit_ledger import build_credit_ledger_response, build_credit_preflight_response
from tangent_api.credit_schemas import CreditLedgerResponse, CreditPreflightResponse
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/api/v1/credits", tags=["credits"])


@router.get("/ledger", response_model=CreditLedgerResponse)
def get_credit_ledger(
    limit: int = Query(default=50, ge=1, le=100),
    context: ApiRequestContext = Depends(get_request_context),
) -> CreditLedgerResponse:
    return build_credit_ledger_response(context, limit)


@router.get("/preflight", response_model=CreditPreflightResponse)
def get_credit_preflight(
    required_credits: float = Query(default=0, alias="requiredCredits", ge=0),
    context: ApiRequestContext = Depends(get_request_context),
) -> CreditPreflightResponse:
    return build_credit_preflight_response(context, required_credits)
