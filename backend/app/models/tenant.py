"""租户模型"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(20), default="free")  # free/pro/enterprise
    max_strategies: Mapped[int] = mapped_column(Integer, default=3)
    max_backtests_per_day: Mapped[int] = mapped_column(Integer, default=10)
    max_trade_accounts: Mapped[int] = mapped_column(Integer, default=0)
    weight_backend: Mapped[str] = mapped_column(String(20), default="duckdb")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # relationships
    users = relationship("User", back_populates="tenant", lazy="selectin")
