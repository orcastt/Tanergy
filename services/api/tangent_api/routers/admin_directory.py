from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from tangent_api.admin_access import require_admin_role, write_admin_audit_log
from tangent_api.admin_directory import (
    get_admin_directory_workspace,
    list_admin_directory_users,
    list_admin_directory_workspace_boards,
    list_admin_directory_workspace_members,
    list_admin_directory_workspaces,
)
from tangent_api.admin_directory_schemas import (
    AdminDirectoryUsersResponse,
    AdminDirectoryWorkspaceDetailResponse,
    AdminDirectoryWorkspacesResponse,
)
from tangent_api.request_context import ApiRequestContext, get_request_context

router = APIRouter(prefix="/api/v1/admin/directory", tags=["admin"])

DIRECTORY_READ_ROLES = {"owner", "admin", "support", "analyst", "finance"}


@router.get("/users", response_model=AdminDirectoryUsersResponse)
def get_admin_directory_users(
    limit: int = Query(default=50, ge=1, le=200),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminDirectoryUsersResponse:
    roles = require_admin_role(context, allowed_roles=DIRECTORY_READ_ROLES)
    users = list_admin_directory_users(limit)
    _audit(context, "admin.directory.users.list", roles, {"limit": limit})
    return AdminDirectoryUsersResponse(ok=True, users=users)


@router.get("/workspaces", response_model=AdminDirectoryWorkspacesResponse)
def get_admin_directory_workspaces(
    kind: Optional[str] = Query(default=None, min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    owner_id: Optional[str] = Query(default=None, alias="ownerId", min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminDirectoryWorkspacesResponse:
    roles = require_admin_role(context, allowed_roles=DIRECTORY_READ_ROLES)
    workspaces = list_admin_directory_workspaces(kind=kind, limit=limit, owner_id=owner_id)
    _audit(context, "admin.directory.workspaces.list", roles, {"kind": kind, "limit": limit, "ownerId": owner_id})
    return AdminDirectoryWorkspacesResponse(ok=True, workspaces=workspaces)


@router.get("/workspaces/{workspace_id}", response_model=AdminDirectoryWorkspaceDetailResponse)
def get_admin_directory_workspace_detail(
    workspace_id: str,
    limit: int = Query(default=50, ge=1, le=200),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminDirectoryWorkspaceDetailResponse:
    roles = require_admin_role(context, allowed_roles=DIRECTORY_READ_ROLES)
    workspace = get_admin_directory_workspace(workspace_id)
    if workspace is None:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    members = list_admin_directory_workspace_members(workspace_id, limit=limit)
    boards = list_admin_directory_workspace_boards(workspace_id, limit=limit)
    _audit(context, "admin.directory.workspace.read", roles, {"limit": limit, "workspaceId": workspace_id})
    return AdminDirectoryWorkspaceDetailResponse(ok=True, workspace=workspace, members=members, boards=boards)


def _audit(context: ApiRequestContext, action: str, roles: list[object], metadata: dict[str, object]) -> None:
    write_admin_audit_log(
        action=action,
        actor_user_id=context.user_id,
        metadata={**{key: value for key, value in metadata.items() if value not in (None, "")}, "roles": [getattr(role, "role", "") for role in roles]},
        workspace_id=context.workspace_id,
    )
