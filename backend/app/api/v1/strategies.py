"""策略管理 API"""

from __future__ import annotations

import hashlib
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException, QuotaExceededException
from app.core.tenant import apply_tenant_filter
from app.database import get_db
from app.dependencies import get_current_user, get_current_tenant_id
from app.models.strategy import Strategy
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.strategy import (
    StrategyCreate, StrategyUpdate, StrategyResponse,
    ValidateRequest, ValidateResponse,
    NLStrategyRequest, NLStrategyResponse,
)

router = APIRouter()


@router.get("", response_model=list[StrategyResponse])
async def list_strategies(
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """策略列表"""
    query = apply_tenant_filter(select(Strategy), tenant_id, Strategy)
    result = await db.execute(query)
    strategies = result.scalars().all()
    return [StrategyResponse.model_validate(s) for s in strategies]


@router.post("", response_model=StrategyResponse)
async def create_strategy(
    req: StrategyCreate,
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """创建策略"""
    # 配额检查
    tenant_result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = tenant_result.scalar_one()
    count_result = await db.execute(
        select(Strategy).where(Strategy.tenant_id == tenant_id)
    )
    if len(count_result.scalars().all()) >= tenant.max_strategies:
        raise QuotaExceededException(f"Max strategies ({tenant.max_strategies}) reached")

    code = req.code or ""
    strategy = Strategy(
        tenant_id=tenant_id,
        user_id=user.id,
        name=req.name,
        description=req.description or "",
        code=code,
        code_hash=hashlib.sha256(code.encode()).hexdigest(),
        status="draft",
        version=1,
        config=req.config or {},
    )
    db.add(strategy)
    await db.flush()
    return StrategyResponse.model_validate(strategy)


@router.get("/{strategy_id}", response_model=StrategyResponse)
async def get_strategy(
    strategy_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """策略详情"""
    query = apply_tenant_filter(
        select(Strategy).where(Strategy.id == strategy_id), tenant_id, Strategy
    )
    result = await db.execute(query)
    strategy = result.scalar_one_or_none()
    if strategy is None:
        raise NotFoundException("Strategy not found")
    return StrategyResponse.model_validate(strategy)


@router.put("/{strategy_id}", response_model=StrategyResponse)
async def update_strategy(
    strategy_id: UUID,
    req: StrategyUpdate,
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """更新策略"""
    query = apply_tenant_filter(
        select(Strategy).where(Strategy.id == strategy_id), tenant_id, Strategy
    )
    result = await db.execute(query)
    strategy = result.scalar_one_or_none()
    if strategy is None:
        raise NotFoundException("Strategy not found")

    if req.name is not None:
        strategy.name = req.name
    if req.description is not None:
        strategy.description = req.description
    if req.code is not None:
        strategy.code = req.code
        strategy.code_hash = hashlib.sha256(req.code.encode()).hexdigest()
    if req.config is not None:
        strategy.config = req.config
    strategy.version += 1
    await db.flush()
    return StrategyResponse.model_validate(strategy)


@router.delete("/{strategy_id}")
async def delete_strategy(
    strategy_id: UUID,
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """删除策略"""
    query = apply_tenant_filter(
        select(Strategy).where(Strategy.id == strategy_id), tenant_id, Strategy
    )
    result = await db.execute(query)
    strategy = result.scalar_one_or_none()
    if strategy is None:
        raise NotFoundException("Strategy not found")
    await db.delete(strategy)
    return {"deleted": True}


@router.post("/{strategy_id}/validate", response_model=ValidateResponse)
async def validate_strategy(
    strategy_id: UUID,
    req: ValidateRequest,
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """校验策略（语法检查 + 信号有效性验证）"""
    # TODO: 实现策略校验逻辑
    return ValidateResponse(is_valid=True, errors=[], signals_used=[])


@router.post("/from-natural-language", response_model=NLStrategyResponse)
async def from_natural_language(
    req: NLStrategyRequest,
    _user: Annotated[User, Depends(get_current_user)],
):
    """自然语言生成策略 — 调用 NLStrategyService"""
    from app.services.nl_strategy import NLStrategyService

    service = NLStrategyService()
    result = await service.generate(description=req.description, freq=req.freq)

    return NLStrategyResponse(
        code=result.get("code", "# 生成失败"),
        explanation=result.get("explanation", ""),
        signals_used=result.get("signals_used", []),
    )
