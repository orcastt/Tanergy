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
    next_cursor: Optional[str] = Field(default=None, alias="nextCursor")
    ok: bool


class BoardRenameResponse(TangentApiModel):
    board: Optional[BoardSummary] = None
    error: Optional[str] = None
    ok: bool


class BoardDeleteResponse(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    error: Optional[str] = None
    ok: bool


class BoardCopyResponse(TangentApiModel):
    board: Optional[BoardSummary] = None
    error: Optional[str] = None
    ok: bool


class BoardRestoreRequest(TangentApiModel):
    snapshot_id: str = Field(alias="snapshotId")


class BoardRestoreResponse(TangentApiModel):
    board: Optional[BoardRecord] = None
    error: Optional[str] = None
    ok: bool
    pre_restore_snapshot_id: Optional[str] = Field(default=None, alias="preRestoreSnapshotId")
    source_snapshot_id: Optional[str] = Field(default=None, alias="sourceSnapshotId")


class BoardSnapshotCreateRequest(TangentApiModel):
    document: Any
    reason: str
    thumbnail_url: Optional[str] = Field(default=None, alias="thumbnailUrl")
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


class BoardSnapshotClearResponse(TangentApiModel):
    deleted_count: int = Field(alias="deletedCount")
    error: Optional[str] = None
    ok: bool


class BoardMemberRecord(TangentApiModel):
    display_name: Optional[str] = Field(default=None, alias="displayName")
    email: Optional[str] = None
    invited_by: Optional[str] = Field(default=None, alias="invitedBy")
    joined_at: str = Field(alias="joinedAt")
    role: str
    user_id: str = Field(alias="userId")
    workspace_role: Optional[str] = Field(default=None, alias="workspaceRole")


class BoardMemberCreateRequest(TangentApiModel):
    display_name: Optional[str] = Field(default=None, alias="displayName")
    role: str
    user_id: str = Field(alias="userId")


class BoardMemberUpdateRequest(TangentApiModel):
    display_name: Optional[str] = Field(default=None, alias="displayName")
    role: Optional[str] = None


class BoardMembersResponse(TangentApiModel):
    error: Optional[str] = None
    members: list[BoardMemberRecord]
    ok: bool


class BoardMemberResponse(TangentApiModel):
    error: Optional[str] = None
    member: Optional[BoardMemberRecord] = None
    ok: bool


class BoardMemberDeleteResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    user_id: Optional[str] = Field(default=None, alias="userId")


class BoardMemberCandidateRecord(TangentApiModel):
    already_member: bool = Field(alias="alreadyMember")
    board_role: Optional[str] = Field(default=None, alias="boardRole")
    display_name: Optional[str] = Field(default=None, alias="displayName")
    email: str
    user_id: str = Field(alias="userId")
    workspace_role: str = Field(alias="workspaceRole")


class BoardMemberCandidatesResponse(TangentApiModel):
    candidates: list[BoardMemberCandidateRecord]
    error: Optional[str] = None
    ok: bool


class BoardMemberInviteByEmailRequest(TangentApiModel):
    display_name: Optional[str] = Field(default=None, alias="displayName")
    email: str
    role: str


class BoardShareLinkRecord(TangentApiModel):
    access_role: str = Field(alias="accessRole")
    board_id: str = Field(alias="boardId")
    created_at: str = Field(alias="createdAt")
    created_by: str = Field(alias="createdBy")
    expires_at: Optional[str] = Field(default=None, alias="expiresAt")
    id: str
    share_id: str = Field(alias="shareId")
    workspace_id: str = Field(alias="workspaceId")


class BoardShareLinkCreateRequest(TangentApiModel):
    access_role: str = Field(default="viewer", alias="accessRole")
    expires_at: Optional[str] = Field(default=None, alias="expiresAt")


class BoardShareLinkResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    share_link: Optional[BoardShareLinkRecord] = Field(default=None, alias="shareLink")


class BoardShareLinkDeleteResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    share_id: Optional[str] = Field(default=None, alias="shareId")


class BoardShareLinkResolveRecord(TangentApiModel):
    access_role: str = Field(alias="accessRole")
    board_id: str = Field(alias="boardId")
    board_title: str = Field(alias="boardTitle")
    share_id: str = Field(alias="shareId")
    workspace_id: str = Field(alias="workspaceId")


class BoardShareLinkResolveResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    share_link: Optional[BoardShareLinkResolveRecord] = Field(default=None, alias="shareLink")


class BoardCollaborationPresenceCursor(TangentApiModel):
    x: float
    y: float


class BoardCollaborationPresence(TangentApiModel):
    active_page_id: Optional[str] = Field(default=None, alias="activePageId")
    cursor: Optional[BoardCollaborationPresenceCursor] = None
    editing_shape_ids: list[str] = Field(default_factory=list, alias="editingShapeIds")
    hovered_shape_id: Optional[str] = Field(default=None, alias="hoveredShapeId")
    selection_ids: list[str] = Field(default_factory=list, alias="selectionIds")
    state: Optional[str] = None
    tool: Optional[str] = None


class BoardCollaborationSessionUpsertRequest(TangentApiModel):
    client_instance_id: str = Field(alias="clientInstanceId")
    presence: BoardCollaborationPresence = Field(default_factory=BoardCollaborationPresence)
    ttl_seconds: Optional[int] = Field(default=45, alias="ttlSeconds")


class BoardCollaborationSessionRecord(TangentApiModel):
    avatar_initials: str = Field(alias="avatarInitials")
    board_id: str = Field(alias="boardId")
    client_instance_id: str = Field(alias="clientInstanceId")
    created_at: str = Field(alias="createdAt")
    display_name: str = Field(alias="displayName")
    expires_at: str = Field(alias="expiresAt")
    id: str
    is_self: bool = Field(alias="isSelf")
    last_heartbeat_at: str = Field(alias="lastHeartbeatAt")
    permission: str
    presence: BoardCollaborationPresence = Field(default_factory=BoardCollaborationPresence)
    user_id: str = Field(alias="userId")
    workspace_id: str = Field(alias="workspaceId")
    workspace_role: str = Field(alias="workspaceRole")


class BoardCollaborationSessionsResponse(TangentApiModel):
    active_sessions: list[BoardCollaborationSessionRecord] = Field(default_factory=list, alias="activeSessions")
    board_id: str = Field(alias="boardId")
    board_saved_at: str = Field(alias="boardSavedAt")
    can_edit: bool = Field(alias="canEdit")
    error: Optional[str] = None
    ok: bool
    permission: str
    room_key: str = Field(alias="roomKey")
    self_session: Optional[BoardCollaborationSessionRecord] = Field(default=None, alias="selfSession")
    workspace_id: str = Field(alias="workspaceId")


class BoardCollaborationSessionDeleteResponse(TangentApiModel):
    active_sessions: list[BoardCollaborationSessionRecord] = Field(default_factory=list, alias="activeSessions")
    board_id: str = Field(alias="boardId")
    board_saved_at: str = Field(alias="boardSavedAt")
    error: Optional[str] = None
    ok: bool
    session_id: str = Field(alias="sessionId")
    workspace_id: str = Field(alias="workspaceId")


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
