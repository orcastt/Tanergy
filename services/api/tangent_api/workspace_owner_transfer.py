import re
from typing import Optional

from fastapi import HTTPException

from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.request_context import ApiRequestContext
from tangent_api.workspace_entitlement_members import load_workspace_member_row, workspace_dashboard_member_from_row
from tangent_api.workspace_schemas import BillingWorkspaceSummary, WorkspaceOwnerTransferRecord

ID_PATTERN = re.compile(r"^[a-zA-Z0-9._-]+$")


def transfer_workspace_owner(user_id: str, context: ApiRequestContext) -> WorkspaceOwnerTransferRecord:
    _assert_can_transfer_workspace_owner(context)
    normalized_user_id = _normalize_id(user_id, "user id")
    if normalized_user_id == context.user_id:
        raise HTTPException(status_code=400, detail="Workspace owner is already this user.")
    require_database_url()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            workspace_row = _load_workspace_row(cursor, context.workspace_id)
            if workspace_row is None:
                raise HTTPException(status_code=404, detail="Workspace not found.")
            workspace_kind = str(workspace_row[0] or context.workspace_kind)
            workspace_owner_id = str(workspace_row[1] or "")
            workspace_status = str(workspace_row[3] or "active")
            if workspace_status == "deleted":
                raise HTTPException(status_code=404, detail="Workspace not found.")
            if workspace_kind != "team_workspace":
                raise HTTPException(
                    status_code=409,
                    detail="Workspace owner transfer is only available for Team workspaces right now.",
                )
            if workspace_owner_id != context.user_id:
                raise HTTPException(status_code=403, detail="Only the current workspace owner can transfer ownership.")
            target_member = load_workspace_member_row(cursor, context.workspace_id, normalized_user_id)
            if target_member is None:
                raise HTTPException(status_code=404, detail="Workspace member not found.")
            if str(target_member[3] or "") == "owner":
                raise HTTPException(status_code=400, detail="Workspace owner is already this user.")

            cursor.execute(
                """
                UPDATE tangent_workspaces
                SET owner_id = %s,
                    billing_owner_user_id = %s
                WHERE id = %s
                """,
                (normalized_user_id, normalized_user_id, context.workspace_id),
            )
            cursor.execute(
                """
                UPDATE tangent_workspace_members
                SET role = %s
                WHERE workspace_id = %s
                  AND user_id = %s
                """,
                ("admin", context.workspace_id, context.user_id),
            )
            cursor.execute(
                """
                UPDATE tangent_workspace_members
                SET role = %s
                WHERE workspace_id = %s
                  AND user_id = %s
                """,
                ("owner", context.workspace_id, normalized_user_id),
            )
            transferred_member = load_workspace_member_row(cursor, context.workspace_id, normalized_user_id)
        connection.commit()

    if transferred_member is None:
        raise HTTPException(status_code=404, detail="Workspace member not found.")
    return WorkspaceOwnerTransferRecord(
        member=workspace_dashboard_member_from_row(transferred_member, None, False),
        previousOwnerUserId=context.user_id,
        workspace=BillingWorkspaceSummary(
            id=context.workspace_id,
            kind=context.workspace_kind,
            name=context.workspace_name,
            role="admin",
        ),
    )


def _assert_can_transfer_workspace_owner(context: ApiRequestContext) -> None:
    if context.workspace_kind != "team_workspace":
        raise HTTPException(
            status_code=409,
            detail="Workspace owner transfer is only available for Team workspaces right now.",
        )
    if context.workspace_role != "owner":
        raise HTTPException(status_code=403, detail="Only workspace owners can transfer ownership.")


def _load_workspace_row(cursor: object, workspace_id: str) -> Optional[tuple[object, ...]]:
    cursor.execute(
        """
        SELECT kind, owner_id, billing_owner_user_id, status
        FROM tangent_workspaces
        WHERE id = %s
        LIMIT 1
        """,
        (workspace_id,),
    )
    return cursor.fetchone()


def _normalize_id(value: str, label: str) -> str:
    normalized = value.strip()
    if not normalized or not ID_PATTERN.match(normalized) or ".." in normalized:
        raise HTTPException(status_code=400, detail=f"Invalid {label}.")
    return normalized
