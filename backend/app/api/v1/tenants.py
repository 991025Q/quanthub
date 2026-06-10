"""租户管理 API"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundException
from app.database import get_db
from app.dependencies import get_current_user, get_current_tenant_id
from app.models.tenant import Tenant
from app.models.user import User

router = APIRouter()


@router.get("/{tenant_id}")
async def get_tenant(
    tenant_id: UUID,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
):
    """获取租户详情"""
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    tenant = result.scalar_one_or_none()
    if tenant is None:
        raise NotFoundException("Tenant not found")
    return {
        "id": str(tenant.id),
        "name": tenant.name,
        "slug": tenant.slug,
        "plan": tenant.plan,
        "max_strategies": tenant.max_strategies,
        "max_backtests_per_day": tenant.max_backtests_per_day,
        "max_trade_accounts": tenant.max_trade_accounts,
        "weight_backend": tenant.weight_backend,
    }
