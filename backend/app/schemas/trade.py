"""交易相关 Pydantic 模型"""

from __future__ import annotations

from decimal import Decimal
from pydantic import BaseModel


class TradeAccountCreate(BaseModel):
    name: str
    type: str  # paper/live
    broker: str | None = None
    config: dict = {}


class TradeAccountResponse(BaseModel):
    id: str
    name: str
    type: str
    broker: str | None
    is_active: bool

    class Config:
        from_attributes = True


class PublishRequest(BaseModel):
    account_id: str
    target: str  # paper/live


class OrderResponse(BaseModel):
    id: str
    symbol: str
    direction: str
    order_type: str
    price: Decimal | None
    volume: int
    status: str
    filled_price: Decimal | None
    filled_volume: int
    fee: Decimal

    class Config:
        from_attributes = True


class PositionResponse(BaseModel):
    id: str
    symbol: str
    direction: str
    volume: int
    avg_price: Decimal
    current_price: Decimal | None
    unrealized_pnl: Decimal | None
    realized_pnl: Decimal

    class Config:
        from_attributes = True
