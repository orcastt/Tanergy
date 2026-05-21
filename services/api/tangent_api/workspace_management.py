from typing import Optional

from fastapi import HTTPException

from tangent_api.request_context import ApiRequestContext
from tangent_api.safe_text import normalize_safe_label
from tangent_api.storage.postgres_board_deletion import soft_delete_workspace_boards
from tangent_api.storage.postgres_connection import connect_to_postgres, require_database_url
from tangent_api.workspace_schemas import (
    BillingWorkspaceSummary,
    WorkspaceDeleteRecord,
)

MANAGEABLE_WORKSPACE_KINDS = {"group_workspace", "team_workspace"}


def rename_current_workspace(name: str, context: ApiRequestContext) -> BillingWorkspaceSummary:
    _assert_can_manage_workspace_settings(context)
    normalized_name = _normalize_workspace_name(name)
    require_database_url()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            workspace_kind, _ = _load_workspace_for_mutation(cursor, context)
            cursor.execute(
                """
                UPDATE tangent_workspaces
                SET name = %s
                WHERE id = %s
                """,
                (normalized_name, context.workspace_id),
            )
        connection.commit()

    return BillingWorkspaceSummary(
        id=context.workspace_id,
        kind=workspace_kind,
        name=normalized_name,
        role="owner",
    )


def delete_current_workspace(confirmation: str, context: ApiRequestContext) -> WorkspaceDeleteRecord:
    _assert_can_manage_workspace_settings(context)
    if confirmation.strip().upper() != "DELETE":
        raise HTTPException(status_code=400, detail="Type DELETE to confirm workspace deletion.")
    require_database_url()

    with connect_to_postgres() as connection:
        with connection.cursor() as cursor:
            workspace_kind, workspace_name = _load_workspace_for_mutation(cursor, context)
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM tangent_boards
                WHERE workspace_id = %s
                  AND deleted_at IS NULL
                """,
                (context.workspace_id,),
            )
            board_count = _read_count(cursor.fetchone())
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM tangent_workspace_members
                WHERE workspace_id = %s
                """,
                (context.workspace_id,),
            )
            member_count = _read_count(cursor.fetchone())
            cursor.execute(
                """
                SELECT COUNT(*)
                FROM tangent_workspace_invitations
                WHERE workspace_id = %s
                """,
                (context.workspace_id,),
            )
            invite_count = _read_count(cursor.fetchone())

            if workspace_kind == "team_workspace":
                cursor.execute(
                    """
                    UPDATE tangent_workspace_seat_assignments
                    SET status = 'revoked',
                        updated_at = NOW()
                    WHERE workspace_id = %s
                      AND status <> 'revoked'
                    """,
                    (context.workspace_id,),
                )
            cursor.execute("DELETE FROM tangent_workspace_invitations WHERE workspace_id = %s", (context.workspace_id,))
            cursor.execute("DELETE FROM tangent_workspace_members WHERE workspace_id = %s", (context.workspace_id,))
            soft_delete_workspace_boards(cursor, [context.workspace_id])
            cursor.execute(
                """
                UPDATE tangent_workspaces
                SET status = 'deleted'
                WHERE id = %s
                """,
                (context.workspace_id,),
            )
        connection.commit()

    return WorkspaceDeleteRecord(
        boardsRemoved=board_count,
        invitesRevoked=invite_count,
        membersRemoved=member_count,
        workspace=BillingWorkspaceSummary(
            id=context.workspace_id,
            kind=workspace_kind,
            name=workspace_name,
            role="owner",
        ),
    )


def _assert_can_manage_workspace_settings(context: ApiRequestContext) -> None:
    if context.workspace_kind not in MANAGEABLE_WORKSPACE_KINDS:
        raise HTTPException(status_code=403, detail="Workspace settings are unavailable for this workspace.")
    if context.workspace_role != "owner":
        raise HTTPException(status_code=403, detail="Only the workspace owner can rename or delete this workspace.")


def _load_workspace_for_mutation(cursor: object, context: ApiRequestContext) -> tuple[str, str]:
    cursor.execute(
        """
        SELECT kind, owner_id, name, status
        FROM tangent_workspaces
        WHERE id = %s
        LIMIT 1
        """,
        (context.workspace_id,),
    )
    row = cursor.fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    workspace_kind = str(row[0] or context.workspace_kind or "")
    owner_id = str(row[1] or "")
    workspace_name = str(row[2] or context.workspace_name or "Workspace")
    workspace_status = str(row[3] or "active")

    if workspace_status == "deleted":
        raise HTTPException(status_code=404, detail="Workspace not found.")
    if workspace_kind not in MANAGEABLE_WORKSPACE_KINDS:
        raise HTTPException(status_code=403, detail="Workspace settings are unavailable for this workspace.")
    if not owner_id or owner_id != context.user_id:
        raise HTTPException(status_code=403, detail="Only the workspace owner can rename or delete this workspace.")
    return workspace_kind, workspace_name


def _normalize_workspace_name(name: str) -> str:
    return normalize_safe_label(name, field_name="Workspace name")


def _read_count(row: Optional[tuple[object, ...]]) -> int:
    if not row:
        return 0
    return int(row[0] or 0)
