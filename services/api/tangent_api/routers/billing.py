from fastapi import APIRouter, Depends

from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.workspace_entitlements import build_billing_me_response
from tangent_api.workspace_schemas import BillingMeResponse

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


@router.get("/me", response_model=BillingMeResponse)
def get_billing_me(
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingMeResponse:
    return build_billing_me_response(context)
