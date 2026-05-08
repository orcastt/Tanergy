from tangent_api.billing_payment_schemas import BillingPaymentRecord
from tangent_api.request_context import ApiRequestContext


def build_provider_completion_context(cursor: object, payment: BillingPaymentRecord) -> ApiRequestContext:
    metadata = dict(payment.metadata or {})
    owner_type, owner_id = load_payment_account_owner(cursor, payment)
    actor_user_id = str(
        metadata.get("ownerUserId")
        or (owner_id if owner_type == "user" else metadata.get("actorUserId") or "payment-webhook")
    )
    workspace_id = str(
        metadata.get("workspaceId")
        or metadata.get("checkoutWorkspaceId")
        or (owner_id if owner_type == "workspace" else f"workspace_{actor_user_id}")
    )
    workspace_kind = str(
        metadata.get("workspaceKind")
        or ("team_workspace" if owner_type == "workspace" else "solo_workspace")
    )
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


def load_payment_account_owner(cursor: object, payment: BillingPaymentRecord) -> tuple[str, str]:
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
