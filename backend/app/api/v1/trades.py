"""交易 API"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.core.tenant import apply_tenant_filter
from app.database import get_db
from app.dependencies import get_current_user, get_current_tenant_id
from app.models.trade import TradeAccount, TradeOrder, TradePosition
from app.models.user import User
from app.schemas.trade import (
    TradeAccountCreate, TradeAccountResponse,
    PublishRequest, OrderResponse, PositionResponse,
)

router = APIRouter()


@router.get("/accounts", response_model=list[TradeAccountResponse])
async def list_accounts(
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """交易账号列表"""
    query = apply_tenant_filter(select(TradeAccount), tenant_id, TradeAccount)
    result = await db.execute(query)
    return [TradeAccountResponse.model_validate(a) for a in result.scalars().all()]


@router.post("/accounts", response_model=TradeAccountResponse)
async def create_account(
    req: TradeAccountCreate,
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """创建交易账号"""
    account = TradeAccount(
        tenant_id=tenant_id,
        user_id=user.id,
        name=req.name,
        type=req.type,
        broker=req.broker,
        config=req.config,
    )
    db.add(account)
    await db.flush()
    return TradeAccountResponse.model_validate(account)


@router.get("/orders", response_model=list[OrderResponse])
async def list_orders(
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """委托记录列表"""
    query = apply_tenant_filter(select(TradeOrder), tenant_id, TradeOrder)
    result = await db.execute(query)
    return [OrderResponse.model_validate(o) for o in result.scalars().all()]


@router.get("/positions", response_model=list[PositionResponse])
async def list_positions(
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """持仓列表"""
    query = apply_tenant_filter(
        select(TradePosition).where(TradePosition.closed_at.is_(None)),
        tenant_id, TradePosition,
    )
    result = await db.execute(query)
    return [PositionResponse.model_validate(p) for p in result.scalars().all()]


@router.post("/strategies/{strategy_id}/publish")
async def publish_strategy(
    strategy_id: UUID,
    req: PublishRequest,
    tenant_id: Annotated[UUID, Depends(get_current_tenant_id)],
    _user: Annotated[User, Depends(get_current_user)],
):
    """发布策略到纸盘/实盘"""
    # TODO: 实现策略发布逻辑
    return {"status": "published", "target": req.target, "account_id": req.account_id}
