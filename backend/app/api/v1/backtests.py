"""回测 API"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.core.tenant import apply_tenant_filter
from app.database import get_db
from app.dependencies import get_current_tenant_id
from app.models.backtest import BacktestJob
from app.schemas.backtest import BacktestRequest, BacktestResponse

router = APIRouter()


@router.post("/strategies/{strategy_id}/backtest", response_model=BacktestResponse)
async def submit_backtest(
    strategy_id: UUID,
    req: BacktestRequest,
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """提交回测任务"""
    job = BacktestJob(
        tenant_id=tenant_id,
        strategy_id=strategy_id,
        user_id=None,  # TODO: from current user
        params=req.model_dump(),
    )
    db.add(job)
    await db.flush()

    # TODO: 发送 Celery 任务
    # from app.tasks.backtest_tasks import run_backtest
    # run_backtest.delay(str(job.id))

    return BacktestResponse(job_id=str(job.id), status="pending")


@router.get("/{job_id}", response_model=BacktestResponse)
async def get_backtest(
    job_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """获取回测结果"""
    query = apply_tenant_filter(
        select(BacktestJob).where(BacktestJob.id == job_id), tenant_id, BacktestJob
    )
    result = await db.execute(query)
    job = result.scalar_one_or_none()
    if job is None:
        raise NotFoundException("Backtest job not found")
    return BacktestResponse(
        job_id=str(job.id),
        status=job.status,
        stats=job.stats,
        result_ref=job.result_ref,
    )


@router.get("")
async def list_backtests(
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """回测历史列表"""
    query = apply_tenant_filter(select(BacktestJob), tenant_id, BacktestJob)
    result = await db.execute(query)
    jobs = result.scalars().all()
    return [
        {"job_id": str(j.id), "status": j.status, "stats": j.stats, "created_at": str(j.created_at)}
        for j in jobs
    ]
