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


class AdminAiModelRecord(TangentApiModel):
    capabilities: list[str] = Field(default_factory=list)
    capability: str
    cost_hint: str = Field(alias="costHint")
    created_at: str = Field(alias="createdAt")
    default_pricing_rule_id: Optional[str] = Field(default=None, alias="defaultPricingRuleId")
    default_tier_key: Optional[str] = Field(default=None, alias="defaultTierKey")
    display_name: str = Field(alias="displayName")
    enabled: bool
    estimated_latency: str = Field(alias="estimatedLatency")
    is_default: bool = Field(alias="isDefault")
    model_key: str = Field(alias="modelKey")
    parameter_schema: dict[str, Any] = Field(default_factory=dict, alias="parameterSchema")
    provider_key: Optional[str] = Field(default=None, alias="providerKey")
    updated_at: str = Field(alias="updatedAt")


class AdminAiModelsResponse(TangentApiModel):
    error: Optional[str] = None
    models: list[AdminAiModelRecord] = Field(default_factory=list)
    ok: bool


class AdminAiModelUpdateRequest(TangentApiModel):
    capabilities: Optional[list[str]] = None
    capability: Optional[str] = None
    cost_hint: Optional[str] = Field(default=None, alias="costHint")
    default_pricing_rule_id: Optional[str] = Field(default=None, alias="defaultPricingRuleId")
    default_tier_key: Optional[str] = Field(default=None, alias="defaultTierKey")
    display_name: Optional[str] = Field(default=None, alias="displayName")
    enabled: Optional[bool] = None
    estimated_latency: Optional[str] = Field(default=None, alias="estimatedLatency")
    is_default: Optional[bool] = Field(default=None, alias="isDefault")
    parameter_schema: Optional[dict[str, Any]] = Field(default=None, alias="parameterSchema")
    provider_key: Optional[str] = Field(default=None, alias="providerKey")


class AdminAiModelMutationResponse(TangentApiModel):
    error: Optional[str] = None
    model: Optional[AdminAiModelRecord] = None
    ok: bool


class AdminAiProviderRouteRecord(TangentApiModel):
    created_at: str = Field(alias="createdAt")
    enabled: bool
    health_status: str = Field(alias="healthStatus")
    model_key: str = Field(alias="modelKey")
    priority: int
    provider_key: str = Field(alias="providerKey")
    provider_model: str = Field(alias="providerModel")
    retry_policy: dict[str, Any] = Field(default_factory=dict, alias="retryPolicy")
    route_id: str = Field(alias="routeId")
    route_key: str = Field(alias="routeKey")
    timeout_ms: int = Field(alias="timeoutMs")
    updated_at: str = Field(alias="updatedAt")
    weight: int


class AdminAiProviderRoutesResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    routes: list[AdminAiProviderRouteRecord] = Field(default_factory=list)


class AdminAiProviderRouteUpdateRequest(TangentApiModel):
    enabled: Optional[bool] = None
    health_status: Optional[str] = Field(default=None, alias="healthStatus")
    model_key: Optional[str] = Field(default=None, alias="modelKey")
    priority: Optional[int] = None
    provider_key: Optional[str] = Field(default=None, alias="providerKey")
    provider_model: Optional[str] = Field(default=None, alias="providerModel")
    retry_policy: Optional[dict[str, Any]] = Field(default=None, alias="retryPolicy")
    timeout_ms: Optional[int] = Field(default=None, alias="timeoutMs")
    route_key: Optional[str] = Field(default=None, alias="routeKey")
    weight: Optional[int] = None


class AdminAiProviderRouteMutationResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    route: Optional[AdminAiProviderRouteRecord] = None


class AdminAiPricingRuleRecord(TangentApiModel):
    billing_unit: str = Field(alias="billingUnit")
    created_at: str = Field(alias="createdAt")
    credit_multiplier: float = Field(alias="creditMultiplier")
    effective_from: str = Field(alias="effectiveFrom")
    effective_to: Optional[str] = Field(default=None, alias="effectiveTo")
    estimated_credits: float = Field(alias="estimatedCredits")
    id: str
    min_credits: float = Field(alias="minCredits")
    model_key: str = Field(alias="modelKey")
    provider_cost_formula: dict[str, Any] = Field(default_factory=dict, alias="providerCostFormula")
    status: str
    tier_key: Optional[str] = Field(default=None, alias="tierKey")
    updated_at: str = Field(alias="updatedAt")


class AdminAiPricingRulesResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    pricing_rules: list[AdminAiPricingRuleRecord] = Field(default_factory=list, alias="pricingRules")


class AdminAiPricingRuleUpdateRequest(TangentApiModel):
    billing_unit: Optional[str] = Field(default=None, alias="billingUnit")
    credit_multiplier: Optional[float] = Field(default=None, alias="creditMultiplier")
    effective_from: Optional[str] = Field(default=None, alias="effectiveFrom")
    effective_to: Optional[str] = Field(default=None, alias="effectiveTo")
    estimated_credits: Optional[float] = Field(default=None, alias="estimatedCredits")
    min_credits: Optional[float] = Field(default=None, alias="minCredits")
    model_key: Optional[str] = Field(default=None, alias="modelKey")
    provider_cost_formula: Optional[dict[str, Any]] = Field(default=None, alias="providerCostFormula")
    status: Optional[str] = None
    tier_key: Optional[str] = Field(default=None, alias="tierKey")


class AdminAiPricingRuleMutationResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    pricing_rule: Optional[AdminAiPricingRuleRecord] = Field(default=None, alias="pricingRule")


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
    reason: str = Field(min_length=1)
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
