import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request

from tangent_api.billing_payment_schemas import (
    BillingCollaborateSubscriptionCheckoutRequest,
    BillingPaymentMutationResponse,
    BillingPaymentsResponse,
    BillingSeatPurchaseCheckoutRequest,
    BillingTeamSubscriptionCheckoutRequest,
    BillingTopupCheckoutRequest,
    BillingWebhookMutationResponse,
)
from tangent_api.billing_payment_completion import complete_billing_payment
from tangent_api.billing_payment_responses import payment_checkout_response
from tangent_api.billing_payments import (
    create_collaborate_subscription_checkout,
    create_team_subscription_checkout,
    create_topup_checkout,
    create_workspace_topup_checkout,
    create_workspace_seat_checkout,
    list_billing_payments,
)
from tangent_api.billing_webhooks import process_billing_webhook
from tangent_api.plan_catalog import list_plan_catalog
from tangent_api.plan_catalog_schemas import PlanCatalogResponse
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.security_business_limits import assert_daily_business_limit
from tangent_api.security_idempotency import run_idempotent
from tangent_api.workspace_entitlements import build_billing_me_response
from tangent_api.workspace_schemas import BillingMeResponse

MAX_BILLING_WEBHOOK_BYTES = 512 * 1024

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


@router.get("/plans", response_model=PlanCatalogResponse)
def get_billing_plans() -> PlanCatalogResponse:
    return PlanCatalogResponse(ok=True, plans=list_plan_catalog())


@router.post("/topups/checkout", response_model=BillingPaymentMutationResponse)
def post_topup_checkout(
    input_data: BillingTopupCheckoutRequest,
    request: Request,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    _require_self_serve_checkout_enabled()
    return run_billing_checkout_idempotent(
        request,
        context,
        action="billing.topup.checkout",
        fingerprint_payload=input_data,
        produce=lambda: payment_checkout_response(
            create_topup_checkout(
                context,
                credits=input_data.credits,
                currency=input_data.currency,
                metadata=input_data.metadata,
            )
        ),
    )


@router.post("/teams/checkout", response_model=BillingPaymentMutationResponse)
def post_team_subscription_checkout(
    input_data: BillingTeamSubscriptionCheckoutRequest,
    request: Request,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    _require_self_serve_checkout_enabled()
    return run_billing_checkout_idempotent(
        request,
        context,
        action="billing.team.checkout",
        fingerprint_payload=input_data,
        produce=lambda: payment_checkout_response(
            create_team_subscription_checkout(
                context,
                billing_interval=input_data.billing_interval,
                currency=input_data.currency,
                metadata=input_data.metadata,
                plan_key=input_data.plan_key,
                quantity=input_data.quantity,
                team_name=input_data.team_name,
            )
        ),
    )


@router.post("/collaborate/checkout", response_model=BillingPaymentMutationResponse)
def post_collaborate_subscription_checkout(
    input_data: BillingCollaborateSubscriptionCheckoutRequest,
    request: Request,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    _require_self_serve_checkout_enabled()
    return run_billing_checkout_idempotent(
        request,
        context,
        action="billing.collaborate.checkout",
        fingerprint_payload=input_data,
        produce=lambda: payment_checkout_response(
            create_collaborate_subscription_checkout(
                context,
                billing_interval=input_data.billing_interval,
                currency=input_data.currency,
                metadata=input_data.metadata,
                plan_key=input_data.plan_key,
            )
        ),
    )


@router.post("/payments/{payment_id}/complete", response_model=BillingPaymentMutationResponse)
def post_billing_payment_complete(
    payment_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    _require_self_serve_checkout_enabled()
    return complete_billing_payment(payment_id, context)


@router.post("/workspaces/current/seats/checkout", response_model=BillingPaymentMutationResponse)
def post_workspace_seat_checkout(
    input_data: BillingSeatPurchaseCheckoutRequest,
    request: Request,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    _require_self_serve_checkout_enabled()
    return run_billing_checkout_idempotent(
        request,
        context,
        action="billing.workspace_seat.checkout",
        fingerprint_payload=input_data,
        produce=lambda: payment_checkout_response(
            create_workspace_seat_checkout(
                context,
                currency=input_data.currency,
                metadata=input_data.metadata,
                plan_key=input_data.plan_key,
                quantity=input_data.quantity,
            )
        ),
    )


@router.post("/workspaces/current/topups/checkout", response_model=BillingPaymentMutationResponse)
def post_workspace_topup_checkout(
    input_data: BillingTopupCheckoutRequest,
    request: Request,
    context: ApiRequestContext = Depends(get_request_context),
) -> BillingPaymentMutationResponse:
    _require_self_serve_checkout_enabled()
    return run_billing_checkout_idempotent(
        request,
        context,
        action="billing.workspace_topup.checkout",
        fingerprint_payload=input_data,
        produce=lambda: payment_checkout_response(
            create_workspace_topup_checkout(
                context,
                credits=input_data.credits,
                currency=input_data.currency,
                metadata=input_data.metadata,
            )
        ),
    )


@router.post("/webhooks/{provider}", response_model=BillingWebhookMutationResponse)
async def post_billing_webhook(
    provider: str,
    request: Request,
    x_tangent_webhook_signature: Optional[str] = Header(default=None),
) -> BillingWebhookMutationResponse:
    return process_billing_webhook(
        provider,
        raw_body=await _read_billing_webhook_body(request),
        signature=x_tangent_webhook_signature,
    )


async def _read_billing_webhook_body(request: Request) -> bytes:
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_BILLING_WEBHOOK_BYTES:
                raise HTTPException(status_code=413, detail="Billing webhook body is too large.")
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="Invalid billing webhook content length.") from exc
    chunks: list[bytes] = []
    total = 0
    async for chunk in request.stream():
        if not chunk:
            continue
        total += len(chunk)
        if total > MAX_BILLING_WEBHOOK_BYTES:
            raise HTTPException(status_code=413, detail="Billing webhook body is too large.")
        chunks.append(chunk)
    return b"".join(chunks)


def _require_self_serve_checkout_enabled() -> None:
    if os.getenv("TANGENT_BILLING_SELF_SERVE_CHECKOUT", "").strip() == "1":
        return
    runtime_values = {
        os.getenv(name, "").strip().lower()
        for name in ("APP_ENV", "ENVIRONMENT", "TANGENT_ENV", "PYTHON_ENV")
        if os.getenv(name, "").strip()
    }
    if runtime_values.intersection({"prod", "production", "stage", "staging"}):
        raise HTTPException(
            status_code=403,
            detail="Self-serve billing checkout is disabled during beta. Admin Finance must enable plans manually.",
        )


def assert_billing_checkout_daily_limit(context: ApiRequestContext) -> None:
    assert_daily_business_limit(
        context,
        action="billing.checkout",
        default_limit=100,
        env_name="TANGENT_BILLING_CHECKOUT_DAILY_LIMIT",
    )


def run_billing_checkout_idempotent(
    request: Request,
    context: ApiRequestContext,
    *,
    action: str,
    fingerprint_payload: object,
    produce,
) -> BillingPaymentMutationResponse:
    return run_idempotent(
        request,
        context,
        action=action,
        fingerprint_payload=fingerprint_payload,
        produce=lambda: _produce_billing_checkout_with_quota(context, produce),
    )


def _produce_billing_checkout_with_quota(context: ApiRequestContext, produce) -> BillingPaymentMutationResponse:
    assert_billing_checkout_daily_limit(context)
    return produce()
