import json
from typing import Optional
from uuid import uuid4

from fastapi import HTTPException

from tangent_api.billing_payment_schemas import BillingPaymentRecord
from tangent_api.request_context import ApiRequestContext
from tangent_api.workspace_entitlements import PLAN_CATALOG

TEAM_PLAN_KEYS = {"team_start", "team_growth"}


def build_team_subscription_metadata(
    context: ApiRequestContext,
    *,
    metadata: dict[str, object],
    plan_key: str,
    quantity: int,
    team_name: str,
) -> dict[str, object]:
    normalized_plan = _normalize_team_plan_key(plan_key)
    normalized_quantity = _normalize_team_quantity(quantity)
    normalized_team_name = _normalize_team_name(team_name)
    included_credits = int(PLAN_CATALOG[normalized_plan]["included_credits"] or 0)
    return {
        **metadata,
        "includedCreditsPerSeat": included_credits,
        "ownerUserId": context.user_id,
        "planFamily": "team",
        "planKey": normalized_plan,
        "quantity": normalized_quantity,
        "teamName": normalized_team_name,
    }


def calculate_team_subscription_amount_cents(plan_key: str, quantity: int) -> int:
    normalized_plan = _normalize_team_plan_key(plan_key)
    normalized_quantity = _normalize_team_quantity(quantity)
    monthly_price_usd = int(PLAN_CATALOG[normalized_plan]["monthly_price_usd"] or 0)
    return monthly_price_usd * 100 * normalized_quantity


def assert_team_subscription_completion_allowed(payment: BillingPaymentRecord, context: ApiRequestContext) -> None:
    owner_user_id = str(payment.metadata.get("ownerUserId") or "")
    if owner_user_id != context.user_id:
        raise HTTPException(status_code=403, detail="Team payment does not belong to the current user.")


def provision_team_subscription_payment(
    cursor: object,
    payment: BillingPaymentRecord,
    context: ApiRequestContext,
) -> BillingPaymentRecord:
    assert_team_subscription_completion_allowed(payment, context)
    metadata = dict(payment.metadata or {})
    workspace_id = str(metadata.get("workspaceId") or f"workspace_{uuid4()}")
    team_name = _normalize_team_name(str(metadata.get("teamName") or "Team workspace"))
    plan_key = _normalize_team_plan_key(str(metadata.get("planKey") or ""))
    quantity = _normalize_team_quantity(int(metadata.get("quantity") or 1))
    account_id = f"credit_workspace_{workspace_id}"

    _upsert_team_workspace(cursor, workspace_id, team_name, context)
    _upsert_team_owner_membership(cursor, workspace_id, context)
    _ensure_team_wallet(cursor, workspace_id, account_id)

    provisioned_metadata = {
        **metadata,
        "planFamily": "team",
        "planKey": plan_key,
        "quantity": quantity,
        "workspaceId": workspace_id,
        "workspaceName": team_name,
    }
    cursor.execute(
        """
        UPDATE tangent_payments
        SET account_id = %s,
            metadata = %s::jsonb
        WHERE id = %s
        RETURNING id, account_id, provider, provider_payment_id, amount_cents, currency,
                  status, created_at, checkout_session_id, kind, metadata
        """,
        (account_id, json.dumps(provisioned_metadata), payment.id),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Payment not found.")
    return _payment_from_row(row)


def _upsert_team_workspace(cursor: object, workspace_id: str, team_name: str, context: ApiRequestContext) -> None:
    cursor.execute(
        """
        INSERT INTO tangent_workspaces (
            id,
            name,
            owner_id,
            kind,
            slug,
            status,
            billing_owner_user_id
        )
        VALUES (%s, %s, %s, 'team_workspace', NULL, 'active', %s)
        ON CONFLICT (id)
        DO UPDATE SET
            name = EXCLUDED.name,
            kind = 'team_workspace',
            status = 'active',
            billing_owner_user_id = EXCLUDED.billing_owner_user_id
        """,
        (workspace_id, team_name, context.user_id, context.user_id),
    )


def _upsert_team_owner_membership(cursor: object, workspace_id: str, context: ApiRequestContext) -> None:
    cursor.execute(
        """
        INSERT INTO tangent_workspace_members (
            workspace_id,
            user_id,
            role,
            display_name,
            invited_by
        )
        VALUES (%s, %s, 'owner', %s, NULL)
        ON CONFLICT (workspace_id, user_id)
        DO UPDATE SET
            role = 'owner',
            display_name = COALESCE(EXCLUDED.display_name, tangent_workspace_members.display_name)
        """,
        (workspace_id, context.user_id, context.user_display_name),
    )


def _ensure_team_wallet(cursor: object, workspace_id: str, account_id: str) -> None:
    cursor.execute(
        """
        INSERT INTO tangent_credit_accounts (
            id,
            owner_type,
            owner_id,
            account_kind,
            status
        )
        VALUES (%s, 'workspace', %s, 'team_wallet', 'active')
        ON CONFLICT (owner_type, owner_id)
        DO UPDATE SET
            status = 'active',
            account_kind = 'team_wallet',
            updated_at = NOW()
        """,
        (account_id, workspace_id),
    )


def _normalize_team_plan_key(plan_key: str) -> str:
    normalized = plan_key.strip()
    if normalized not in TEAM_PLAN_KEYS:
        raise HTTPException(status_code=400, detail="Invalid team plan key.")
    return normalized


def _normalize_team_quantity(quantity: int) -> int:
    if quantity < 1:
        raise HTTPException(status_code=400, detail="Team seat quantity must be at least one.")
    return quantity


def _normalize_team_name(team_name: str) -> str:
    normalized = " ".join(team_name.strip().split())
    if not normalized:
        raise HTTPException(status_code=400, detail="Team name is required.")
    if len(normalized) > 80:
        raise HTTPException(status_code=400, detail="Team name is too long.")
    return normalized


def _payment_from_row(row: tuple[object, ...]) -> BillingPaymentRecord:
    return BillingPaymentRecord(
        accountId=row[1],
        amountCents=int(row[4] or 0),
        checkoutSessionId=row[8],
        createdAt=_to_iso(row[7]),
        currency=str(row[5] or "usd"),
        id=str(row[0]),
        kind=str(row[9] or "topup"),
        metadata=dict(row[10] or {}),
        provider=str(row[2] or "manual_test"),
        providerPaymentId=row[3],
        status=str(row[6] or "pending"),
    )


def _to_iso(value: Optional[object]) -> str:
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)
