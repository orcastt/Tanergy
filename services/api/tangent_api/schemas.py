from typing import Any, Optional

from pydantic import Field

from tangent_api.board_metadata import (
    get_board_document_metrics,
    normalize_board_card_color,
    normalize_board_description,
    normalize_board_share_id,
    normalize_board_thumbnail_url,
    normalize_board_visibility,
)
from tangent_api.board_schemas import (
    BoardCopyResponse,
    BoardDeleteResponse,
    BoardDocumentGuardIssue,
    BoardDocumentGuardResult,
    BoardListResponse,
    BoardLoadResponse,
    BoardMemberCandidateRecord,
    BoardMemberCandidatesResponse,
    BoardMemberCreateRequest,
    BoardMemberDeleteResponse,
    BoardMemberInviteByEmailRequest,
    BoardMemberRecord,
    BoardMemberResponse,
    BoardMembersResponse,
    BoardMemberUpdateRequest,
    BoardRecord,
    BoardRenameRequest,
    BoardRenameResponse,
    BoardRestoreRequest,
    BoardRestoreResponse,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSnapshotCreateRequest,
    BoardSnapshotCreateResponse,
    BoardSnapshotClearResponse,
    BoardSnapshotListResponse,
    BoardSnapshotLoadResponse,
    BoardSnapshotRecord,
    BoardSnapshotSummary,
    BoardShareLinkCreateRequest,
    BoardShareLinkDeleteResponse,
    BoardShareLinkRecord,
    BoardShareLinkResolveRecord,
    BoardShareLinkResolveResponse,
    BoardShareLinkResponse,
    BoardSummary,
    BoardValidateResponse,
    summarize_board_record,
)
from tangent_api.schema_base import TangentApiModel


class AdminRoleRecord(TangentApiModel):
    created_at: str = Field(alias="createdAt")
    granted_by: Optional[str] = Field(default=None, alias="grantedBy")
    note: Optional[str] = None
    permissions: dict[str, Any] = Field(default_factory=dict)
    role: str


class AdminMeResponse(TangentApiModel):
    can_access_admin: bool = Field(alias="canAccessAdmin")
    error: Optional[str] = None
    ok: bool
    roles: list[AdminRoleRecord] = Field(default_factory=list)
    user_id: str = Field(alias="userId")


class AdminSummaryRecord(TangentApiModel):
    admin_user_count: int = Field(alias="adminUserCount")
    boards_count: int = Field(alias="boardsCount")
    users_count: int = Field(alias="usersCount")
    workspaces_count: int = Field(alias="workspacesCount")


class AdminSummaryResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    summary: Optional[AdminSummaryRecord] = None


class AdminUserRecord(TangentApiModel):
    created_at: str = Field(alias="createdAt")
    display_name: str = Field(alias="displayName")
    email: str
    id: str
    last_login_at: Optional[str] = Field(default=None, alias="lastLoginAt")
    locale: str
    status: str


class AdminUsersResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    users: list[AdminUserRecord] = Field(default_factory=list)


class AdminWorkspaceRecord(TangentApiModel):
    created_at: Optional[str] = Field(default=None, alias="createdAt")
    id: str
    kind: str = "solo_workspace"
    name: str
    owner_id: Optional[str] = Field(default=None, alias="ownerId")
    status: str


class AdminWorkspacesResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    workspaces: list[AdminWorkspaceRecord] = Field(default_factory=list)


class AdminBoardRecord(TangentApiModel):
    id: str
    owner_id: str = Field(alias="ownerId")
    saved_at: str = Field(alias="savedAt")
    title: str
    visibility: str
    workspace_id: str = Field(alias="workspaceId")


class AdminBoardsResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    boards: list[AdminBoardRecord] = Field(default_factory=list)


class AdminAuditLogRecord(TangentApiModel):
    action: str
    actor_user_id: Optional[str] = Field(default=None, alias="actorUserId")
    created_at: str = Field(alias="createdAt")
    id: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    target_user_id: Optional[str] = Field(default=None, alias="targetUserId")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class AdminAuditLogsResponse(TangentApiModel):
    error: Optional[str] = None
    logs: list[AdminAuditLogRecord] = Field(default_factory=list)
    ok: bool


class AdminRoleListResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    roles: list[AdminRoleRecord] = Field(default_factory=list)
    user_id: str = Field(alias="userId")


class AdminRoleGrantRequest(TangentApiModel):
    note: Optional[str] = None
    permissions: dict[str, Any] = Field(default_factory=dict)
    role: str
    user_id: str = Field(alias="userId")


class AdminRoleMutationResponse(TangentApiModel):
    audit_id: Optional[str] = Field(default=None, alias="auditId")
    error: Optional[str] = None
    ok: bool
    role: Optional[AdminRoleRecord] = None
    user_id: str = Field(alias="userId")


class AssetRecord(TangentApiModel):
    byte_size: int = Field(alias="byteSize")
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    height: int
    id: str
    mime: str
    origin: str
    original_url: str = Field(alias="originalUrl")
    storage: str
    thumbnail1024_url: Optional[str] = Field(default=None, alias="thumbnail1024Url")
    thumbnail256_url: Optional[str] = Field(default=None, alias="thumbnail256Url")
    thumbnail512_url: Optional[str] = Field(default=None, alias="thumbnail512Url")
    title: str
    width: int
    workspace_id: str = Field(alias="workspaceId")


class AssetThumbnailInput(TangentApiModel):
    data_url: str = Field(alias="dataUrl")
    height: int
    width: int


class AssetDataUrlRequest(TangentApiModel):
    data_url: str = Field(alias="dataUrl")
    file_name: Optional[str] = Field(default=None, alias="fileName")
    height: int
    origin: str
    thumbnails: Optional[dict[int, AssetThumbnailInput]] = None
    title: Optional[str] = None
    width: int


class AssetFromUrlRequest(TangentApiModel):
    origin: str = "remote_import"
    title: Optional[str] = None
    url: str


class AssetResponse(TangentApiModel):
    asset: Optional[AssetRecord] = None
    error: Optional[str] = None


class ImageOpAssetRequest(TangentApiModel):
    asset_id: str = Field(alias="assetId")


class ImageOpResponse(TangentApiModel):
    asset: Optional[AssetRecord] = None
    error: Optional[str] = None
    ok: bool
