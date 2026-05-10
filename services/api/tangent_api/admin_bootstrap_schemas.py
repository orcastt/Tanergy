from typing import Optional

from pydantic import Field

from tangent_api.admin_directory_schemas import (
    AdminDirectoryUserResponse,
    AdminDirectoryUsersResponse,
    AdminDirectoryWorkspacesResponse,
)
from tangent_api.admin_operator_schemas import AdminOperatorUsersResponse
from tangent_api.schema_base import TangentApiModel
from tangent_api.schemas import AdminMeResponse, AdminSummaryResponse


class AdminPageBootstrapResponse(TangentApiModel):
    access: AdminMeResponse
    error: Optional[str] = None
    groups: AdminDirectoryWorkspacesResponse
    ok: bool
    operator_users: AdminOperatorUsersResponse = Field(
        default_factory=lambda: AdminOperatorUsersResponse(ok=False, limit=0, offset=0, totalCount=0, users=[]),
        alias="operatorUsers",
    )
    summary: AdminSummaryResponse
    teams: AdminDirectoryWorkspacesResponse
    users: AdminDirectoryUsersResponse


class AdminUserDetailBootstrapResponse(TangentApiModel):
    access: AdminMeResponse
    error: Optional[str] = None
    groups: AdminDirectoryWorkspacesResponse
    ok: bool
    teams: AdminDirectoryWorkspacesResponse
    user: AdminDirectoryUserResponse = Field(default_factory=lambda: AdminDirectoryUserResponse(ok=False, user=None))
