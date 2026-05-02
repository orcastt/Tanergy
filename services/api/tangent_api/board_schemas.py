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
from tangent_api.schema_base import TangentApiModel


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


class BoardSaveRequest(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    card_color: Optional[str] = Field(default=None, alias="cardColor")
    description: Optional[str] = None
    document: Any
    thumbnail_url: Optional[str] = Field(default=None, alias="thumbnailUrl")
    title: Optional[str] = None


class BoardRenameRequest(TangentApiModel):
    card_color: Optional[str] = Field(default=None, alias="cardColor")
    description: Optional[str] = None
    is_pinned: Optional[bool] = Field(default=None, alias="isPinned")
    is_starred: Optional[bool] = Field(default=None, alias="isStarred")
    share_id: Optional[str] = Field(default=None, alias="shareId")
    thumbnail_url: Optional[str] = Field(default=None, alias="thumbnailUrl")
    title: Optional[str] = None
    visibility: Optional[str] = None


class BoardSummary(TangentApiModel):
    asset_count: int = Field(default=0, alias="assetCount")
    byte_size: int = Field(alias="byteSize")
    card_color: Optional[str] = Field(default=None, alias="cardColor")
    created_at: Optional[str] = Field(default=None, alias="createdAt")
    description: Optional[str] = None
    id: str
    is_pinned: bool = Field(default=False, alias="isPinned")
    is_starred: bool = Field(default=False, alias="isStarred")
    last_opened_at: Optional[str] = Field(default=None, alias="lastOpenedAt")
    owner_id: str = Field(alias="ownerId")
    saved_at: str = Field(alias="savedAt")
    shape_count: int = Field(default=0, alias="shapeCount")
    share_id: Optional[str] = Field(default=None, alias="shareId")
    thumbnail_url: Optional[str] = Field(default=None, alias="thumbnailUrl")
    title: str
    visibility: str = "private"
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


def summarize_board_record(record: BoardRecord) -> BoardSummary:
    metrics = get_board_document_metrics(record.document)
    return BoardSummary(
        assetCount=record.asset_count or metrics["asset_count"],
        byteSize=record.byte_size,
        cardColor=normalize_board_card_color(record.card_color),
        createdAt=record.created_at or record.saved_at,
        description=normalize_board_description(record.description),
        id=record.id,
        isPinned=bool(record.is_pinned),
        isStarred=bool(record.is_starred),
        lastOpenedAt=record.last_opened_at,
        ownerId=record.owner_id,
        savedAt=record.saved_at,
        shapeCount=record.shape_count or metrics["shape_count"],
        shareId=normalize_board_share_id(record.share_id),
        thumbnailUrl=normalize_board_thumbnail_url(record.thumbnail_url),
        title=record.title,
        visibility=normalize_board_visibility(record.visibility),
        workspaceId=record.workspace_id,
    )
