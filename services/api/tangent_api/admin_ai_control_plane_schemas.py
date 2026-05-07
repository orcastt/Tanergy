from typing import Any, Optional

from pydantic import Field

from tangent_api.schema_base import TangentApiModel


class AdminAiControlPlaneVersionRecord(TangentApiModel):
    action: str
    actor_user_id: Optional[str] = Field(default=None, alias="actorUserId")
    created_at: str = Field(alias="createdAt")
    id: str
    note: Optional[str] = None
    published_at: Optional[str] = Field(default=None, alias="publishedAt")
    resource_id: str = Field(alias="resourceId")
    resource_type: str = Field(alias="resourceType")
    snapshot: dict[str, Any] = Field(default_factory=dict)
    version_number: int = Field(alias="versionNumber")
    workspace_id: Optional[str] = Field(default=None, alias="workspaceId")


class AdminAiControlPlaneVersionsResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    versions: list[AdminAiControlPlaneVersionRecord] = Field(default_factory=list)


class AdminAiPublishRequest(TangentApiModel):
    note: Optional[str] = None


class AdminAiVersionMutationResponse(TangentApiModel):
    error: Optional[str] = None
    ok: bool
    version: Optional[AdminAiControlPlaneVersionRecord] = None
