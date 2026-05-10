from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException

from tangent_api.admin_access import _insert_admin_audit_log
from tangent_api.admin_operator_schemas import AdminOperatorSubscriptionMutationResponse
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.storage.postgres_schema import has_postgres_column

ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing"}


def freeze_admin_operator_subscription(
    *,
    actor_user_id: str,
    reason: str,
    subscription_id: str,
    workspace_id: Optional[str] = None,
) -> AdminOperatorSubscriptionMutationResponse:
    require_database_url()
    normalized_reason = _normalize_reason(reason)
    frozen_at = _utc_now()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            subscription = _load_subscription(cursor, subscription_id)
            if subscription["status"] not in ACTIVE_SUBSCRIPTION_STATUSES:
                raise HTTPException(status_code=400, detail="Only active or trialing subscriptions can be frozen.")
            if _supports_subscription_pause_metadata():
                cursor.execute(
                    """
                    UPDATE tangent_subscriptions
                    SET status = %s,
                        paused_at = %s,
                        paused_by = %s,
                        pause_reason = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    ("paused", frozen_at, actor_user_id, normalized_reason, subscription_id),
                )
            else:
                cursor.execute(
                    """
                    UPDATE tangent_subscriptions
                    SET status = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    ("paused", subscription_id),
                )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.subscription.freeze",
                actor_user_id=actor_user_id,
                metadata={
                    "currentPeriodEnd": _iso_value(subscription["current_period_end"]),
                    "planFamily": subscription["plan_family"],
                    "planKey": subscription["plan_key"],
                    "pausedAt": frozen_at.isoformat(),
                    "pauseReason": normalized_reason,
                    "reason": normalized_reason,
                    "status": "paused",
                    "subscriptionId": subscription_id,
                },
                target_user_id=subscription["target_user_id"],
                workspace_id=workspace_id or subscription["workspace_id"],
            )
        connection.commit()

    return AdminOperatorSubscriptionMutationResponse(
        auditId=audit_id,
        message="Subscription frozen.",
        ok=True,
        status="paused",
        subscriptionId=subscription_id,
        userId=subscription["target_user_id"],
        workspaceId=subscription["workspace_id"],
    )


def unfreeze_admin_operator_subscription(
    *,
    actor_user_id: str,
    reason: str,
    subscription_id: str,
    workspace_id: Optional[str] = None,
) -> AdminOperatorSubscriptionMutationResponse:
    require_database_url()
    normalized_reason = _normalize_reason(reason)
    resumed_at = _utc_now()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            subscription = _load_subscription(cursor, subscription_id)
            if subscription["status"] != "paused":
                raise HTTPException(status_code=400, detail="Only paused subscriptions can be unfrozen.")
            _assert_no_conflicting_active_subscription(cursor, subscription_id, subscription)
            resumed_period_end = _resume_period_end(subscription["current_period_end"], subscription["paused_at"], resumed_at)
            if _supports_subscription_pause_metadata():
                cursor.execute(
                    """
                    UPDATE tangent_subscriptions
                    SET status = %s,
                        current_period_end = %s,
                        paused_at = NULL,
                        paused_by = NULL,
                        pause_reason = NULL,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    ("active", resumed_period_end, subscription_id),
                )
            else:
                cursor.execute(
                    """
                    UPDATE tangent_subscriptions
                    SET status = %s,
                        current_period_end = %s,
                        updated_at = NOW()
                    WHERE id = %s
                    """,
                    ("active", resumed_period_end, subscription_id),
                )
            audit_id = _insert_admin_audit_log(
                cursor,
                action="admin.operator.subscription.unfreeze",
                actor_user_id=actor_user_id,
                metadata={
                    "currentPeriodEnd": _iso_value(resumed_period_end),
                    "pauseDurationSeconds": _pause_duration_seconds(subscription["paused_at"], resumed_at),
                    "planFamily": subscription["plan_family"],
                    "planKey": subscription["plan_key"],
                    "reason": normalized_reason,
                    "resumedAt": resumed_at.isoformat(),
                    "status": "active",
                    "subscriptionId": subscription_id,
                },
                target_user_id=subscription["target_user_id"],
                workspace_id=workspace_id or subscription["workspace_id"],
            )
        connection.commit()

    return AdminOperatorSubscriptionMutationResponse(
        auditId=audit_id,
        message="Subscription unfrozen.",
        ok=True,
        status="active",
        subscriptionId=subscription_id,
        userId=subscription["target_user_id"],
        workspaceId=subscription["workspace_id"],
    )


def _load_subscription(cursor: object, subscription_id: str) -> dict[str, object]:
    cursor.execute(
        f"""
        SELECT id, owner_type, owner_id, workspace_id, plan_family, plan_key, status,
               current_period_end, {_subscription_pause_select_sql()}
        FROM tangent_subscriptions
        WHERE id = %s
        LIMIT 1
        """,
        (subscription_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Subscription not found.")
    owner_type = str(row[1] or "")
    owner_id = str(row[2]) if row[2] is not None else None
    workspace_id = str(row[3]) if row[3] is not None else None
    return {
        "id": str(row[0]),
        "owner_type": owner_type,
        "owner_id": owner_id,
        "plan_family": str(row[4] or ""),
        "plan_key": str(row[5] or ""),
        "status": str(row[6] or "active"),
        "current_period_end": row[7],
        "paused_at": row[8],
        "paused_by": str(row[9]) if row[9] is not None else None,
        "pause_reason": str(row[10]) if row[10] is not None else None,
        "target_user_id": owner_id if owner_type == "user" else None,
        "workspace_id": workspace_id,
    }


def _assert_no_conflicting_active_subscription(
    cursor: object,
    subscription_id: str,
    subscription: dict[str, object],
) -> None:
    owner_type = subscription["owner_type"] or ""
    owner_id = subscription["owner_id"]
    workspace_id = subscription["workspace_id"]
    plan_family = subscription["plan_family"] or ""

    if owner_type == "user" and owner_id:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM tangent_subscriptions
            WHERE id <> %s
              AND owner_type = 'user'
              AND owner_id = %s
              AND plan_family = %s
              AND status IN ('active', 'trialing')
            """,
            (subscription_id, owner_id, plan_family),
        )
    elif workspace_id:
        cursor.execute(
            """
            SELECT COUNT(*)
            FROM tangent_subscriptions
            WHERE id <> %s
              AND plan_family = %s
              AND status IN ('active', 'trialing')
              AND (
                workspace_id = %s
                OR (owner_type = 'workspace' AND owner_id = %s)
              )
            """,
            (subscription_id, plan_family, workspace_id, workspace_id),
        )
    else:
        return

    row = cursor.fetchone()
    if row and int(row[0] or 0) > 0:
        raise HTTPException(status_code=400, detail="Another active subscription already exists for this owner.")


def _normalize_reason(value: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Reason is required.")
    return normalized


def _pause_duration_seconds(paused_at: object, resumed_at: datetime) -> int:
    if not isinstance(paused_at, datetime):
        return 0
    normalized_paused_at = paused_at if paused_at.tzinfo is not None else paused_at.replace(tzinfo=timezone.utc)
    return max(0, int((resumed_at - normalized_paused_at.astimezone(timezone.utc)).total_seconds()))


def _resume_period_end(current_period_end: object, paused_at: object, resumed_at: datetime) -> object:
    if not isinstance(current_period_end, datetime) or not isinstance(paused_at, datetime):
        return current_period_end
    normalized_period_end = current_period_end if current_period_end.tzinfo is not None else current_period_end.replace(tzinfo=timezone.utc)
    normalized_paused_at = paused_at if paused_at.tzinfo is not None else paused_at.replace(tzinfo=timezone.utc)
    return normalized_period_end.astimezone(timezone.utc) + (resumed_at - normalized_paused_at.astimezone(timezone.utc))


def _iso_value(value: object) -> Optional[str]:
    if isinstance(value, datetime):
        normalized = value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)
        return normalized.astimezone(timezone.utc).isoformat()
    return None


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _subscription_pause_select_sql() -> str:
    return ", ".join([
        _subscription_optional_column_sql("paused_at", "timestamptz"),
        _subscription_optional_column_sql("paused_by", "text"),
        _subscription_optional_column_sql("pause_reason", "text"),
    ])


def _subscription_optional_column_sql(column_name: str, cast_name: str) -> str:
    if has_postgres_column("tangent_subscriptions", column_name):
        return column_name
    return f"NULL::{cast_name} AS {column_name}"


def _supports_subscription_pause_metadata() -> bool:
    return all(
        has_postgres_column("tangent_subscriptions", column_name)
        for column_name in ("paused_at", "paused_by", "pause_reason")
    )
