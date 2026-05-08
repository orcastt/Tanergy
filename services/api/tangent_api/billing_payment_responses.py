from tangent_api.billing_checkout_sessions import build_checkout_session
from tangent_api.billing_payment_schemas import BillingPaymentMutationResponse, BillingPaymentRecord


def payment_checkout_response(payment: BillingPaymentRecord) -> BillingPaymentMutationResponse:
    return BillingPaymentMutationResponse(
        checkout=build_checkout_session(payment),
        ok=True,
        payment=payment,
    )
