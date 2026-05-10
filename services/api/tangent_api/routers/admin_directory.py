from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from tangent_api.admin_access import require_admin_role, write_admin_audit_log
from tangent_api.admin_directory import (
    get_admin_directory_workspace,
    list_admin_directory_workspace_boards,
    list_admin_directory_workspace_members,
    list_admin_directory_workspaces_page,
)
from tangent_api.admin_directory_users import get_admin_directory_user, list_admin_directory_users
from tangent_api.admin_directory_schemas import (
    AdminDirectoryUserResponse,
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
    offset: int = Query(default=0, ge=0, le=5000),
    search: Optional[str] = Query(default=None, min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminDirectoryUsersResponse:
    roles = require_admin_role(context, allowed_roles=DIRECTORY_READ_ROLES)
    users, total_count = list_admin_directory_users(limit=limit, offset=offset, search=search)
    _audit(context, "admin.directory.users.list", roles, {"limit": limit, "offset": offset, "search": search})
    return AdminDirectoryUsersResponse(ok=True, limit=limit, offset=offset, totalCount=total_count, users=users)


@router.get("/users/{user_id}", response_model=AdminDirectoryUserResponse)
def get_admin_directory_user_detail(
    user_id: str,
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminDirectoryUserResponse:
    roles = require_admin_role(context, allowed_roles=DIRECTORY_READ_ROLES)
    user = get_admin_directory_user(user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found.")
    _audit(context, "admin.directory.user.read", roles, {"userId": user_id})
    return AdminDirectoryUserResponse(ok=True, user=user)


@router.get("/workspaces", response_model=AdminDirectoryWorkspacesResponse)
def get_admin_directory_workspaces(
    kind: Optional[str] = Query(default=None, min_length=1),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=5000),
    owner_id: Optional[str] = Query(default=None, alias="ownerId", min_length=1),
    search: Optional[str] = Query(default=None, min_length=1),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminDirectoryWorkspacesResponse:
    roles = require_admin_role(context, allowed_roles=DIRECTORY_READ_ROLES)
    workspaces, total_count = list_admin_directory_workspaces_page(
        kind=kind,
        limit=limit,
        offset=offset,
        owner_id=owner_id,
        search=search,
    )
    _audit(
        context,
        "admin.directory.workspaces.list",
        roles,
        {"kind": kind, "limit": limit, "offset": offset, "ownerId": owner_id, "search": search},
    )
    return AdminDirectoryWorkspacesResponse(ok=True, limit=limit, offset=offset, totalCount=total_count, workspaces=workspaces)


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
