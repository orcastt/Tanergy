from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.workflow import (
    WorkflowCreate, WorkflowDetail, WorkflowListResponse, WorkflowUpdate,
)
from app.services import workflow_service

router = APIRouter()


@router.get("", response_model=WorkflowListResponse)
async def list_workflows(
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await workflow_service.list_workflows(db, str(user.id), page, size)
    return WorkflowListResponse(workflows=result["workflows"], total=result["total"])


@router.post("", response_model=WorkflowDetail, status_code=201)
async def create_workflow(
    body: WorkflowCreate = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    body = body or WorkflowCreate()
    wf = await workflow_service.create_workflow(db, str(user.id), body)
    return wf


@router.get("/{workflow_id}", response_model=WorkflowDetail)
async def get_workflow(
    workflow_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await workflow_service._get_owned(db, workflow_id, str(user.id))


@router.put("/{workflow_id}", response_model=WorkflowDetail)
async def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await workflow_service.update_workflow(db, workflow_id, str(user.id), body)


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await workflow_service.delete_workflow(db, workflow_id, str(user.id))
    return {"success": True}
