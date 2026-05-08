import json
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.billing_payment_schemas import BillingPaymentMutationResponse, BillingPaymentRecord
from tangent_api.billing_payment_context import build_provider_completion_context
from tangent_api.billing_payment_rows import payment_from_row
from tangent_api.collaborate_subscription_lifecycle import (
    assert_collaborate_subscription_completion_allowed,
    subscription_credits_from_payment,
    upsert_collaborate_subscription,
)
from tangent_api.credit_ledger import grant_subscription_credits_to_account, record_topup_purchase_to_account
from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import require_database_url
from tangent_api.team_subscription_lifecycle import (
    assert_team_subscription_completion_allowed,
    provision_team_subscription_payment,
    upsert_team_workspace_subscription,
)


def complete_billing_payment(
    payment_id: str,
    context: ApiRequestContext,
) -> BillingPaymentMutationResponse:
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            payment = _load_payment_for_update(cursor, payment_id)
            if payment.provider != "manual_test":
                raise HTTPException(status_code=409, detail="Hosted provider payments complete through webhooks.")
            _assert_payment_completion_allowed(payment, context)
            response = _complete_loaded_payment(
                cursor,
                payment,
                context,
                provider_payment_id=f"payment_{uuid4()}",
            )
        connection.commit()
    return response


def complete_billing_payment_from_provider(
    *,
    checkout_session_id: Optional[str] = None,
    payment_id: Optional[str] = None,
    provider: str,
    provider_payment_id: str,
) -> BillingPaymentMutationResponse:
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            payment = _load_provider_payment_for_update(
                cursor,
                provider=provider,
                payment_id=payment_id,
                checkout_session_id=checkout_session_id,
            )
            if payment.provider != provider:
                raise HTTPException(status_code=400, detail="Payment provider mismatch.")
            context = build_provider_completion_context(cursor, payment)
            response = _complete_loaded_payment(
                cursor,
                payment,
                context,
                provider_payment_id=provider_payment_id,
            )
        connection.commit()
    return response


def _complete_loaded_payment(
    cursor: object,
    payment: BillingPaymentRecord,
    context: ApiRequestContext,
    *,
    provider_payment_id: str,
) -> BillingPaymentMutationResponse:
    if payment.status == "succeeded":
        return BillingPaymentMutationResponse(ok=True, payment=payment)

    cursor.execute(
        """
        UPDATE tangent_payments
        SET status = 'succeeded',
            provider_payment_id = %s
        WHERE id = %s
        RETURNING id, account_id, provider, provider_payment_id, amount_cents, currency,
                  status, created_at, checkout_session_id, kind, metadata
        """,
        (provider_payment_id, payment.id),
    )
    updated = payment_from_row(cursor.fetchone())
    topup_entry_id = None
    if updated.kind == "topup":
        topup_entry_id = _record_topup_payment(updated, context, workspace_id=context.workspace_id)
    elif updated.kind == "workspace_topup":
        topup_entry_id = _record_topup_payment(
            updated,
            context,
            workspace_id=str(updated.metadata.get("workspaceId") or context.workspace_id),
        )
    elif updated.kind == "seat_purchase":
        upsert_team_workspace_subscription(cursor, updated)
        _grant_team_subscription_credits(cursor, updated, context)
    elif updated.kind == "team_subscription":
        updated = provision_team_subscription_payment(cursor, updated, context)
        upsert_team_workspace_subscription(cursor, updated)
        _grant_team_subscription_credits(cursor, updated, context)
    elif updated.kind == "collaborate_subscription":
        upsert_collaborate_subscription(cursor, updated, context)
        _grant_collaborate_subscription_credits(updated, context)
    return BillingPaymentMutationResponse(ok=True, payment=updated, topupEntryId=topup_entry_id)


def _load_payment_for_update(cursor: object, payment_id: str) -> BillingPaymentRecord:
    cursor.execute(
        """
        SELECT id, account_id, provider, provider_payment_id, amount_cents, currency,
               status, created_at, checkout_session_id, kind, metadata
        FROM tangent_payments
        WHERE id = %s
        LIMIT 1
        """,
        (payment_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Payment not found.")
    return payment_from_row(row)


def _load_provider_payment_for_update(
    cursor: object,
    *,
    checkout_session_id: Optional[str],
    payment_id: Optional[str],
    provider: str,
) -> BillingPaymentRecord:
    normalized_payment_id = (payment_id or "").strip()
    if normalized_payment_id:
        return _load_payment_for_update(cursor, normalized_payment_id)
    normalized_checkout_session_id = (checkout_session_id or "").strip()
    if not normalized_checkout_session_id:
        raise HTTPException(status_code=400, detail="Payment reference is required.")
    cursor.execute(
        """
        SELECT id, account_id, provider, provider_payment_id, amount_cents, currency,
               status, created_at, checkout_session_id, kind, metadata
        FROM tangent_payments
        WHERE provider = %s
          AND checkout_session_id = %s
        LIMIT 1
        FOR UPDATE
        """,
        (provider, normalized_checkout_session_id),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Payment not found.")
    return payment_from_row(row)


def _record_topup_payment(
    payment: BillingPaymentRecord,
    context: ApiRequestContext,
    *,
    workspace_id: str,
) -> str:
    credits = float(payment.metadata.get("credits") or 0)
    mutation = record_topup_purchase_to_account(
        account_id=str(payment.account_id),
        actor_user_id=context.user_id,
        workspace_id=workspace_id,
        credits=credits,
        source_id=payment.id,
        metadata={
            "checkoutSessionId": payment.checkout_session_id,
            "paymentId": payment.id,
            **payment.metadata,
        },
    )
    return mutation.entry.id


def _grant_team_subscription_credits(
    cursor: object,
    payment: BillingPaymentRecord,
    context: ApiRequestContext,
) -> None:
    credits = float(payment.metadata.get("includedCreditsPerSeat") or 0) * int(payment.metadata.get("quantity") or 0)
    if credits <= 0:
        return
    cursor.execute(
        """
        INSERT INTO tangent_credit_ledger (
            id,
            account_id,
            workspace_id,
            actor_user_id,
            source_type,
            source_id,
            credits_delta,
            reason,
            metadata
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb)
        """,
        (
            f"credit_ledger_{uuid4()}",
            str(payment.account_id),
            str(payment.metadata.get("workspaceId") or context.workspace_id),
            context.user_id,
            "subscription",
            payment.id,
            credits,
            "subscription_grant",
            json.dumps({
                "checkoutSessionId": payment.checkout_session_id,
                "paymentId": payment.id,
                **payment.metadata,
            }),
        ),
    )


def _grant_collaborate_subscription_credits(
    payment: BillingPaymentRecord,
    context: ApiRequestContext,
) -> None:
    credits = subscription_credits_from_payment(payment)
    if credits <= 0:
        return
    grant_subscription_credits_to_account(
        account_id=str(payment.account_id),
        actor_user_id=context.user_id,
        workspace_id=context.workspace_id,
        credits=credits,
        source_id=payment.id,
        metadata={
            "checkoutSessionId": payment.checkout_session_id,
            "paymentId": payment.id,
            **payment.metadata,
        },
    )


def _assert_payment_completion_allowed(payment: BillingPaymentRecord, context: ApiRequestContext) -> None:
    if payment.kind == "workspace_topup":
        if context.workspace_role not in {"owner", "admin"}:
            raise HTTPException(status_code=403, detail="Only workspace owners or admins may complete Team wallet payments.")
        if payment.metadata.get("workspaceId") != context.workspace_id:
            raise HTTPException(status_code=403, detail="Workspace payment does not belong to this workspace.")
        return
    if payment.kind == "seat_purchase":
        if context.workspace_role not in {"owner", "admin"}:
            raise HTTPException(status_code=403, detail="Only workspace owners or admins may complete seat payments.")
        if payment.metadata.get("workspaceId") != context.workspace_id:
            raise HTTPException(status_code=403, detail="Seat payment does not belong to this workspace.")
        return
    if payment.kind == "team_subscription":
        assert_team_subscription_completion_allowed(payment, context)
        return
    if payment.kind == "collaborate_subscription":
        assert_collaborate_subscription_completion_allowed(payment, context)
        return
    expected_account_id = f"credit_user_{context.user_id}"
    if payment.account_id != expected_account_id:
        raise HTTPException(status_code=403, detail="Payment does not belong to the current user.")
