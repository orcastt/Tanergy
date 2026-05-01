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


class BoardSaveRequest(TangentApiModel):
    board_id: Optional[str] = Field(default=None, alias="boardId")
    document: Any
    title: Optional[str] = None


class BoardSummary(TangentApiModel):
    byte_size: int = Field(alias="byteSize")
    id: str
    owner_id: str = Field(alias="ownerId")
    saved_at: str = Field(alias="savedAt")
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
    return BoardSummary(
        byteSize=record.byte_size,
        id=record.id,
        ownerId=record.owner_id,
        savedAt=record.saved_at,
        title=record.title,
        workspaceId=record.workspace_id,
    )
