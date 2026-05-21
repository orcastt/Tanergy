from fastapi import APIRouter, Depends, Query

from tangent_api.admin_access import load_active_admin_roles, load_admin_summary
from tangent_api.admin_bootstrap_schemas import AdminPageBootstrapResponse, AdminUserDetailBootstrapResponse
from tangent_api.admin_directory import list_admin_directory_workspaces_page
from tangent_api.admin_directory_schemas import (
    AdminDirectoryUserResponse,
    AdminDirectoryUsersResponse,
    AdminDirectoryWorkspacesResponse,
)
from tangent_api.admin_directory_users import get_admin_directory_user, list_admin_directory_users
from tangent_api.admin_operator_reads import list_admin_operator_users
from tangent_api.admin_operator_schemas import AdminOperatorUsersResponse
from tangent_api.request_context import ApiRequestContext, get_request_context
from tangent_api.schemas import AdminMeResponse, AdminSummaryResponse

router = APIRouter(prefix="/api/v1/admin/bootstrap", tags=["admin"])

SUMMARY_READ_ROLES = {"owner", "admin", "finance"}
DIRECTORY_READ_ROLES = {"owner", "admin", "finance"}
OPERATOR_READ_ROLES = {"owner", "admin", "finance"}


@router.get("", response_model=AdminPageBootstrapResponse)
def get_admin_page_bootstrap(
    include_summary: bool = Query(default=False, alias="includeSummary"),
    include_users: bool = Query(default=False, alias="includeUsers"),
    include_operator_users: bool = Query(default=False, alias="includeOperatorUsers"),
    include_teams: bool = Query(default=False, alias="includeTeams"),
    include_groups: bool = Query(default=False, alias="includeGroups"),
    limit: int = Query(default=100, ge=1, le=200),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminPageBootstrapResponse:
    access = _load_access(context)
    if not access.can_access_admin:
        return AdminPageBootstrapResponse(
            access=access,
            groups=AdminDirectoryWorkspacesResponse(ok=False, limit=limit, offset=0, totalCount=0, workspaces=[]),
            ok=True,
            operatorUsers=AdminOperatorUsersResponse(ok=False, limit=limit, offset=0, totalCount=0, users=[]),
            summary=AdminSummaryResponse(ok=False, summary=None),
            teams=AdminDirectoryWorkspacesResponse(ok=False, limit=limit, offset=0, totalCount=0, workspaces=[]),
            users=AdminDirectoryUsersResponse(ok=False, limit=limit, offset=0, totalCount=0, users=[]),
        )

    summary = AdminSummaryResponse(ok=False, summary=None)
    if include_summary and _has_role(access, SUMMARY_READ_ROLES):
        summary = AdminSummaryResponse(ok=True, summary=load_admin_summary())

    users = AdminDirectoryUsersResponse(ok=False, limit=limit, offset=0, totalCount=0, users=[])
    if include_users and _has_role(access, DIRECTORY_READ_ROLES):
        user_rows, total_count = list_admin_directory_users(limit=limit, offset=0, search=None)
        users = AdminDirectoryUsersResponse(ok=True, limit=limit, offset=0, totalCount=total_count, users=user_rows)

    operator_users = AdminOperatorUsersResponse(ok=False, limit=limit, offset=0, totalCount=0, users=[])
    if include_operator_users and _has_role(access, OPERATOR_READ_ROLES):
        operator_rows, total_count = list_admin_operator_users(limit=limit, offset=0, search=None)
        operator_users = AdminOperatorUsersResponse(ok=True, limit=limit, offset=0, totalCount=total_count, users=operator_rows)

    teams = AdminDirectoryWorkspacesResponse(ok=False, limit=limit, offset=0, totalCount=0, workspaces=[])
    if include_teams and _has_role(access, DIRECTORY_READ_ROLES):
        team_rows, team_total_count = list_admin_directory_workspaces_page(
            kind="team_workspace",
            limit=limit,
            offset=0,
        )
        teams = AdminDirectoryWorkspacesResponse(
            ok=True,
            limit=limit,
            offset=0,
            totalCount=team_total_count,
            workspaces=team_rows,
        )

    groups = AdminDirectoryWorkspacesResponse(ok=False, limit=limit, offset=0, totalCount=0, workspaces=[])
    if include_groups and _has_role(access, DIRECTORY_READ_ROLES):
        group_rows, group_total_count = list_admin_directory_workspaces_page(
            kind="group_workspace",
            limit=limit,
            offset=0,
        )
        groups = AdminDirectoryWorkspacesResponse(
            ok=True,
            limit=limit,
            offset=0,
            totalCount=group_total_count,
            workspaces=group_rows,
        )

    return AdminPageBootstrapResponse(access=access, groups=groups, ok=True, operatorUsers=operator_users, summary=summary, teams=teams, users=users)


@router.get("/users/{user_id}", response_model=AdminUserDetailBootstrapResponse)
def get_admin_user_detail_bootstrap(
    user_id: str,
    limit: int = Query(default=100, ge=1, le=200),
    context: ApiRequestContext = Depends(get_request_context),
) -> AdminUserDetailBootstrapResponse:
    access = _load_access(context)
    if not access.can_access_admin:
        return AdminUserDetailBootstrapResponse(
            access=access,
            groups=AdminDirectoryWorkspacesResponse(ok=False, limit=limit, offset=0, totalCount=0, workspaces=[]),
            ok=True,
            teams=AdminDirectoryWorkspacesResponse(ok=False, limit=limit, offset=0, totalCount=0, workspaces=[]),
            user=AdminDirectoryUserResponse(ok=False, user=None),
        )

    team_rows, team_total_count = list_admin_directory_workspaces_page(
        kind="team_workspace",
        limit=limit,
        offset=0,
        owner_id=user_id,
    )
    group_rows, group_total_count = list_admin_directory_workspaces_page(
        kind="group_workspace",
        limit=limit,
        offset=0,
        owner_id=user_id,
    )
    user = AdminDirectoryUserResponse(ok=True, user=get_admin_directory_user(user_id))
    teams = AdminDirectoryWorkspacesResponse(
        ok=True,
        limit=limit,
        offset=0,
        totalCount=team_total_count,
        workspaces=team_rows,
    )
    groups = AdminDirectoryWorkspacesResponse(
        ok=True,
        limit=limit,
        offset=0,
        totalCount=group_total_count,
        workspaces=group_rows,
    )

    return AdminUserDetailBootstrapResponse(access=access, groups=groups, ok=True, teams=teams, user=user)


def _load_access(context: ApiRequestContext) -> AdminMeResponse:
    roles = load_active_admin_roles(context.user_id)
    return AdminMeResponse(
        canAccessAdmin=_has_any_bootstrap_access(roles),
        ok=True,
        roles=roles,
        userId=context.user_id,
    )


def _has_any_bootstrap_access(roles: list[object]) -> bool:
    return any(_role_name(role) in (SUMMARY_READ_ROLES | DIRECTORY_READ_ROLES | OPERATOR_READ_ROLES) for role in roles)


def _has_role(access: AdminMeResponse, allowed_roles: set[str]) -> bool:
    return any(role.role in allowed_roles for role in access.roles)


def _role_name(role: object) -> str:
    if isinstance(role, dict):
        return str(role.get("role", ""))
    return str(getattr(role, "role", ""))
