import re
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.workflow import Workflow
from app.schemas.workflow import WorkflowCreate, WorkflowUpdate


async def _get_owned(db: AsyncSession, workflow_id: str, user_id: str) -> Workflow:
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id, Workflow.owner_id == user_id))
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return wf


async def list_workflows(db: AsyncSession, user_id: str, page: int = 1, size: int = 20) -> dict:
    offset = (page - 1) * size
    count_q = select(func.count()).select_from(Workflow).where(Workflow.owner_id == user_id)
    total = (await db.execute(count_q)).scalar() or 0

    q = select(Workflow).where(Workflow.owner_id == user_id).order_by(Workflow.updated_at.desc()).offset(offset).limit(size)
    result = await db.execute(q)
    return {"workflows": result.scalars().all(), "total": total}


async def create_workflow(db: AsyncSession, user_id: str, data: WorkflowCreate) -> Workflow:
    name = data.name or await _auto_name(db, user_id)
    wf = Workflow(owner_id=user_id, name=name)
    db.add(wf)
    await db.commit()
    await db.refresh(wf)
    return wf


async def update_workflow(db: AsyncSession, workflow_id: str, user_id: str, data: WorkflowUpdate) -> Workflow:
    wf = await _get_owned(db, workflow_id, user_id)
    if data.name is not None:
        wf.name = data.name
    if data.graph_json is not None:
        wf.graph_json = data.graph_json
    wf.updated_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(wf)
    return wf


async def delete_workflow(db: AsyncSession, workflow_id: str, user_id: str) -> None:
    wf = await _get_owned(db, workflow_id, user_id)
    await db.delete(wf)
    await db.commit()


async def _auto_name(db: AsyncSession, user_id: str) -> str:
    q = select(Workflow.name).where(Workflow.owner_id == user_id, Workflow.name.op("~")(r"^未命名工作流 \d+$"))
    result = await db.execute(q)
    nums = [int(m.group(1)) for n in result.scalars() if (m := re.match(r"^未命名工作流 (\d+)$", n))]
    return f"未命名工作流 {max(nums, default=0) + 1}"
