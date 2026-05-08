from typing import Optional

from fastapi import APIRouter, Depends, Query

from tangent_api.billing_payment_schemas import (
    BillingPaymentMutationResponse,
    BillingPaymentsResponse,
    BillingSeatPurchaseCheckoutRequest,
    BillingTeamSubscriptionCheckoutRequest,
    BillingTopupCheckoutRequest,
)
from tangent_api.billing_payments import (
    complete_billing_payment,
    create_team_subscription_checkout,
    create_topup_checkout,
    create_workspace_topup_checkout,
    create_workspace_seat_checkout,
    list_billing_payments,
)
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.workspace_entitlements import build_billing_me_response
from tangent_api.workspace_schemas import BillingMeResponse

router = APIRouter(prefix="/api/v1/billing", tags=["billing"])


@router.get("/me", response_model=BillingMeResponse)
def get_billing_me(
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingMeResponse:
    return build_billing_me_response(context)


@router.get("/payments", response_model=BillingPaymentsResponse)
def get_billing_payments(
    kind: Optional[str] = Query(default=None, min_length=1),
    limit: int = Query(default=25, ge=1, le=100),
    status: Optional[str] = Query(default=None, min_length=1),
    workspace_scoped: bool = Query(default=False, alias="workspaceScoped"),
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentsResponse:
    return BillingPaymentsResponse(
        ok=True,
        payments=list_billing_payments(
            context,
            kind=kind,
            limit=limit,
            status=status,
            workspace_scoped=workspace_scoped,
        ),
    )


@router.post("/topups/checkout", response_model=BillingPaymentMutationResponse)
def post_topup_checkout(
    input_data: BillingTopupCheckoutRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    return BillingPaymentMutationResponse(
        ok=True,
        payment=create_topup_checkout(
            context,
            credits=input_data.credits,
            currency=input_data.currency,
            metadata=input_data.metadata,
        ),
    )


@router.post("/teams/checkout", response_model=BillingPaymentMutationResponse)
def post_team_subscription_checkout(
    input_data: BillingTeamSubscriptionCheckoutRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    return BillingPaymentMutationResponse(
        ok=True,
        payment=create_team_subscription_checkout(
            context,
            currency=input_data.currency,
            metadata=input_data.metadata,
            plan_key=input_data.plan_key,
            quantity=input_data.quantity,
            team_name=input_data.team_name,
        ),
    )


@router.post("/payments/{payment_id}/complete", response_model=BillingPaymentMutationResponse)
def post_billing_payment_complete(
    payment_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    return complete_billing_payment(payment_id, context)


@router.post("/workspaces/current/seats/checkout", response_model=BillingPaymentMutationResponse)
def post_workspace_seat_checkout(
    input_data: BillingSeatPurchaseCheckoutRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    return BillingPaymentMutationResponse(
        ok=True,
        payment=create_workspace_seat_checkout(
            context,
            currency=input_data.currency,
            metadata=input_data.metadata,
            plan_key=input_data.plan_key,
            quantity=input_data.quantity,
        ),
    )


@router.post("/workspaces/current/topups/checkout", response_model=BillingPaymentMutationResponse)
def post_workspace_topup_checkout(
    input_data: BillingTopupCheckoutRequest,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    return BillingPaymentMutationResponse(
        ok=True,
        payment=create_workspace_topup_checkout(
            context,
            credits=input_data.credits,
            currency=input_data.currency,
            metadata=input_data.metadata,
        ),
    )
