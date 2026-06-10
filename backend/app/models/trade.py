"""交易相关模型：账号/委托/持仓"""

from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import String, Integer, Boolean, DateTime, Numeric, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class TradeAccount(Base):
    __tablename__ = "trade_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    type: Mapped[str] = mapped_column(String(20), nullable=False)  # paper/live
    broker: Mapped[str | None] = mapped_column(String(50), nullable=True)  # qmt/...
    config: Mapped[dict] = mapped_column(JSONB, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class TradeOrder(Base):
    __tablename__ = "trade_orders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trade_accounts.id"), nullable=False)
    strategy_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("strategies.id"), nullable=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), nullable=False)  # buy/sell
    order_type: Mapped[str] = mapped_column(String(20), default="limit")  # limit/market
    price: Mapped[Decimal | None] = mapped_column(Numeric(16, 4), nullable=True)
    volume: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending/submitted/filled/cancelled/rejected
    filled_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 4), nullable=True)
    filled_volume: Mapped[int] = mapped_column(Integer, default=0)
    fee: Mapped[Decimal] = mapped_column(Numeric(16, 4), default=Decimal("0"))
    broker_order_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class TradePosition(Base):
    __tablename__ = "trade_positions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    account_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("trade_accounts.id"), nullable=False)
    strategy_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("strategies.id"), nullable=True)
    symbol: Mapped[str] = mapped_column(String(20), nullable=False)
    direction: Mapped[str] = mapped_column(String(10), default="long")  # long/short
    volume: Mapped[int] = mapped_column(Integer, nullable=False)
    avg_price: Mapped[Decimal] = mapped_column(Numeric(16, 4), nullable=False)
    current_price: Mapped[Decimal | None] = mapped_column(Numeric(16, 4), nullable=True)
    unrealized_pnl: Mapped[Decimal | None] = mapped_column(Numeric(16, 4), nullable=True)
    realized_pnl: Mapped[Decimal] = mapped_column(Numeric(16, 4), default=Decimal("0"))
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
