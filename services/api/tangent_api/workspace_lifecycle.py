from uuid import uuid4

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.storage.postgres_connection import require_database_url
from tangent_api.workspace_schemas import BillingWorkspaceSummary


def create_group_workspace(name: str, context: ApiRequestContext) -> BillingWorkspaceSummary:
    require_database_url()
    normalized_name = _normalize_workspace_name(name)
    from tangent_api.workspace_entitlements import connect_to_postgres

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            _assert_active_collaborate_subscription(cursor, context.user_id)
            workspace_id = f"workspace_{uuid4()}"
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
                VALUES (%s, %s, %s, %s, NULL, 'active', %s)
                """,
                (workspace_id, normalized_name, context.user_id, "group_workspace", context.user_id),
            )
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
        connection.commit()
    return BillingWorkspaceSummary(id=workspace_id, kind="group_workspace", name=normalized_name, role="owner")


def _assert_active_collaborate_subscription(cursor: object, user_id: str) -> None:
    cursor.execute(
        """
        SELECT ca.id, s.plan_key
        FROM tangent_credit_accounts ca
        JOIN tangent_subscriptions s ON s.account_id = ca.id
        WHERE ca.owner_type = %s
          AND ca.owner_id = %s
          AND ca.status = 'active'
          AND s.plan_family = 'collaborate'
          AND s.status IN ('active', 'trialing')
        ORDER BY s.updated_at DESC
        LIMIT 1
        """,
        ("user", user_id),
    )
    if cursor.fetchone() is None:
        raise HTTPException(status_code=402, detail="Collaborate subscription is required to create a Group workspace.")


def _normalize_workspace_name(name: str) -> str:
    normalized = " ".join(name.strip().split())
    if not normalized:
        raise HTTPException(status_code=400, detail="Workspace name is required.")
    if len(normalized) > 80:
        raise HTTPException(status_code=400, detail="Workspace name is too long.")
    return normalized
