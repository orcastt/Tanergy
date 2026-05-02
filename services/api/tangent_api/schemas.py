from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field


class TangentApiModel(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class BoardDocumentGuardIssue(TangentApiModel):
    blocking: bool
    code: str
    message: str
    path: str


class BoardDocumentGuardResult(TangentApiModel):
    byte_size: int = Field(alias="byteSize")
    issues: list[BoardDocumentGuardIssue]
    ok: bool


class BoardValidateResponse(TangentApiModel):
    audit: BoardDocumentGuardResult
    ok: bool


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


class BoardSaveRequest(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    document: Any
    title: Optional[str] = None


class BoardRenameRequest(TangentApiModel):
    title: str


class BoardSummary(TangentApiModel):
    asset_count: int = Field(default=0, alias="assetCount")
    byte_size: int = Field(alias="byteSize")
    id: str
    last_opened_at: Optional[str] = Field(default=None, alias="lastOpenedAt")
    owner_id: str = Field(alias="ownerId")
    saved_at: str = Field(alias="savedAt")
    shape_count: int = Field(default=0, alias="shapeCount")
    thumbnail_url: Optional[str] = Field(default=None, alias="thumbnailUrl")
    title: str
    workspace_id: str = Field(alias="workspaceId")


class BoardRecord(BoardSummary):
    document: Any


class BoardSaveResponse(TangentApiModel):
    audit: Optional[BoardDocumentGuardResult] = None
    board: Optional[BoardSummary] = None
    error: Optional[str] = None
    ok: bool


class BoardLoadResponse(TangentApiModel):
    board: Optional[BoardRecord] = None
    error: Optional[str] = None
    ok: bool


class BoardListResponse(TangentApiModel):
    boards: list[BoardSummary]
    error: Optional[str] = None
    ok: bool


class BoardRenameResponse(TangentApiModel):
    board: Optional[BoardSummary] = None
    error: Optional[str] = None
    ok: bool


class BoardDeleteResponse(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    error: Optional[str] = None
    ok: bool


class BoardSnapshotCreateRequest(TangentApiModel):
    document: Any
    reason: str
    title: Optional[str] = None


class BoardSnapshotSummary(TangentApiModel):
    asset_count: int = Field(default=0, alias="assetCount")
    board_id: str = Field(alias="boardId")
    byte_size: int = Field(alias="byteSize")
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    document_hash: str = Field(alias="documentHash")
    expires_at: Optional[str] = Field(default=None, alias="expiresAt")
    id: str
    reason: str
    retention_tier: str = Field(alias="retentionTier")
    shape_count: int = Field(default=0, alias="shapeCount")
    thumbnail_url: Optional[str] = Field(default=None, alias="thumbnailUrl")
    title: str
    workspace_id: str = Field(alias="workspaceId")


class BoardSnapshotRecord(BoardSnapshotSummary):
    document: Any


class BoardSnapshotCreateResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    snapshot: Optional[BoardSnapshotSummary] = None


class BoardSnapshotListResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    snapshots: list[BoardSnapshotSummary]


class BoardSnapshotLoadResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    snapshot: Optional[BoardSnapshotRecord] = None


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


def summarize_board_record(record: BoardRecord) -> BoardSummary:
    metrics = get_board_document_metrics(record.document)
    return BoardSummary(
        assetCount=record.asset_count or metrics["asset_count"],
        byteSize=record.byte_size,
        id=record.id,
        lastOpenedAt=record.last_opened_at,
        ownerId=record.owner_id,
        savedAt=record.saved_at,
        shapeCount=record.shape_count or metrics["shape_count"],
        thumbnailUrl=record.thumbnail_url,
        title=record.title,
        workspaceId=record.workspace_id,
    )


def get_board_document_metrics(document: Any) -> dict[str, int]:
    if not isinstance(document, dict):
        return {"asset_count": 0, "shape_count": 0}
    assets = document.get("assets")
    shapes = document.get("shapes")
    return {
        "asset_count": len(assets) if isinstance(assets, list) else 0,
        "shape_count": len(shapes) if isinstance(shapes, list) else 0,
    }
