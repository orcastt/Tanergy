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
    BoardDeleteResponse,
    BoardDocumentGuardIssue,
    BoardDocumentGuardResult,
    BoardListResponse,
    BoardLoadResponse,
    BoardRecord,
    BoardRenameRequest,
    BoardRenameResponse,
    BoardSaveRequest,
    BoardSaveResponse,
    BoardSnapshotCreateRequest,
    BoardSnapshotCreateResponse,
    BoardSnapshotListResponse,
    BoardSnapshotLoadResponse,
    BoardSnapshotRecord,
    BoardSnapshotSummary,
    BoardSummary,
    BoardValidateResponse,
    summarize_board_record,
)
from tangent_api.schema_base import TangentApiModel


class AuthUser(TangentApiModel):
    avatar_initials: str = Field(alias="avatarInitials")
    display_name: str = Field(alias="displayName")
    email: str
    email_verified: bool = Field(alias="emailVerified")
    id: str


class AuthWorkspace(TangentApiModel):
    board_count: int = Field(alias="boardCount")
    id: str
    name: str
    role: str


class AuthSession(TangentApiModel):
    active_workspace: AuthWorkspace = Field(alias="activeWorkspace")
    auth_mode: str = Field(alias="authMode")
    is_dev_fallback: bool = Field(alias="isDevFallback")
    user: AuthUser
    workspaces: list[AuthWorkspace]


class AuthSessionResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    session: Optional[AuthSession] = None


class AiModelOption(TangentApiModel):
    capabilities: list[str]
    cost_hint: str = Field(alias="costHint")
    display_name: str = Field(alias="displayName")
    estimated_latency: str = Field(alias="estimatedLatency")
    id: str
    is_default: bool = Field(alias="isDefault")
    is_enabled: bool = Field(alias="isEnabled")
    parameter_schema: dict[str, Any] = Field(alias="parameterSchema")
    provider: str


class AiModelsResponse(TangentApiModel):
    error: Optional[str] = None
    models: list[AiModelOption]
    ok: bool


class AiRunRequest(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    input_asset_ids: list[str] = Field(default_factory=list, alias="inputAssetIds")
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    node_type: Optional[str] = Field(default=None, alias="nodeType")
    params: dict[str, Any] = Field(default_factory=dict)
    prompt: Optional[str] = None
    run_type: str = Field(alias="runType")
    selected_model_id: Optional[str] = Field(default=None, alias="selectedModelId")


class AiRunRecord(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    cost_credits: float = Field(alias="costCredits")
    cost_hint: str = Field(alias="costHint")
    created_at: str = Field(alias="createdAt")
    error: Optional[str] = None
    input_asset_ids: list[str] = Field(alias="inputAssetIds")
    latency_ms: int = Field(alias="latencyMs")
    model_id: str = Field(alias="modelId")
    node_id: Optional[str] = Field(default=None, alias="nodeId")
    output_asset_ids: list[str] = Field(alias="outputAssetIds")
    provider: str
    run_id: str = Field(alias="runId")
    run_type: str = Field(alias="runType")
    status: str
    text_output: Optional[str] = Field(default=None, alias="textOutput")


class AiRunResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    run: Optional[AiRunRecord] = None


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


class AssetResponse(TangentApiModel):
    asset: Optional[AssetRecord] = None
    error: Optional[str] = None
