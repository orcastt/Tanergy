import json
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.billing_payment_schemas import BillingPaymentMutationResponse, BillingPaymentRecord
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
    payment_id: str,
    *,
    provider: str,
    provider_payment_id: str,
) -> BillingPaymentMutationResponse:
    require_database_url()
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            payment = _load_payment_for_update(cursor, payment_id)
            if payment.provider != provider:
                raise HTTPException(status_code=400, detail="Payment provider mismatch.")
            context = _build_provider_completion_context(cursor, payment)
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


def _build_provider_completion_context(cursor: object, payment: BillingPaymentRecord) -> ApiRequestContext:
    metadata = dict(payment.metadata or {})
    owner_type, owner_id = _load_payment_account_owner(cursor, payment)
    actor_user_id = str(
        metadata.get("ownerUserId")
        or (owner_id if owner_type == "user" else metadata.get("actorUserId") or "payment-webhook")
    )
    workspace_id = str(
        metadata.get("workspaceId")
        or metadata.get("checkoutWorkspaceId")
        or (owner_id if owner_type == "workspace" else f"workspace_{actor_user_id}")
    )
    workspace_kind = str(metadata.get("workspaceKind") or ("team_workspace" if owner_type == "workspace" else "solo_workspace"))
    return ApiRequestContext(
        auth_mode="provider_webhook",
        is_dev_fallback=False,
        user_avatar_initials="PW",
        user_display_name=str(metadata.get("ownerDisplayName") or "Payment Webhook"),
        user_email=str(metadata.get("ownerEmail") or "payment-webhook@tangent.local"),
        user_email_verified=True,
        user_id=actor_user_id,
        workspace_board_count=0,
        workspace_id=workspace_id,
        workspace_kind=workspace_kind,
        workspace_name=str(metadata.get("workspaceName") or metadata.get("teamName") or "Payment workspace"),
        workspace_plan_key=str(metadata.get("planKey")) if metadata.get("planKey") else None,
        workspace_role="owner",
    )


def _load_payment_account_owner(cursor: object, payment: BillingPaymentRecord) -> tuple[str, str]:
    if not payment.account_id:
        return "user", str(payment.metadata.get("ownerUserId") or "payment-webhook")
    cursor.execute(
        """
        SELECT owner_type, owner_id
        FROM tangent_credit_accounts
        WHERE id = %s
        LIMIT 1
        """,
        (payment.account_id,),
    )
    row = cursor.fetchone()
    if row:
        return str(row[0]), str(row[1])
    return "user", str(payment.metadata.get("ownerUserId") or "payment-webhook")


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
