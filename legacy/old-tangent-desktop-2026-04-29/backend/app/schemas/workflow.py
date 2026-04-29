from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WorkflowOut(BaseModel):
    id: UUID
    name: str
    thumbnail_url: str | None = None
    is_public: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkflowDetail(WorkflowOut):
    graph_json: dict


class WorkflowCreate(BaseModel):
    name: str | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = None
    graph_json: dict | None = None


class WorkflowListResponse(BaseModel):
    workflows: list[WorkflowOut]
    total: int
