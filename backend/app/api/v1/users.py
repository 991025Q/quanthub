"""用户等级管理 API"""

from __future__ import annotations

from datetime import date, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    ForbiddenException, NotFoundException, ValidationException,
)
from app.core.level_quotas import VALID_LEVELS, get_quota
from app.database import get_db
from app.dependencies import get_current_user, require_role
from app.models.user import User
from app.schemas.auth import UpdateLevelRequest, QuotaResponse

router = APIRouter()


@router.get("/quota", response_model=QuotaResponse)
async def get_my_quota(
    user: Annotated[User, Depends(get_current_user)],
):
    """查看当前用户配额详情"""
    quota = get_quota(user.level)
    today = date.today()

    # 回测每日重置
    bt_today = user.backtest_count_today if user.last_backtest_date == today else 0
    bt_limit = quota.backtests_per_day
    bt_remaining = -1 if bt_limit == -1 else max(0, bt_limit - bt_today)

    # AI 每月重置
    ai_used = user.ai_credits_used
    if user.ai_credits_reset_at and user.ai_credits_reset_at < today:
        ai_used = 0
    ai_total = quota.ai_credits
    ai_remaining = -1 if ai_total == -1 else max(0, ai_total - ai_used)

    return QuotaResponse(
        level=user.level,
        level_label=quota.label,
        is_verified=user.is_verified,
        ai_enabled=quota.ai_enabled,
        ai_credits_total=ai_total,
        ai_credits_used=ai_used,
        ai_credits_remaining=ai_remaining,
        backtests_per_day=bt_limit,
        backtests_today=bt_today,
        backtests_remaining=bt_remaining,
        max_strategies=quota.max_strategies,
        priority_support=quota.priority_support,
    )


@router.post("/set-level")
async def set_user_level(
    req: UpdateLevelRequest,
    admin: Annotated[User, Depends(require_role("admin"))],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """管理员设置用户等级（仅 admin 可调用）"""
    if req.level not in VALID_LEVELS:
        raise ValidationException(f"无效等级: {req.level}，可选: {VALID_LEVELS}")

    result = await db.execute(select(User).where(User.id == UUID(req.user_id)))
    target = result.scalar_one_or_none()
    if target is None:
        raise NotFoundException("用户不存在")

    target.level = req.level

    # 实名升级：如果设置为 verified 且当前是 free，自动升级为 verified
    if req.is_verified is not None:
        target.is_verified = req.is_verified
        if req.is_verified and target.verified_at is None:
            target.verified_at = datetime.utcnow()
        # 如果设为实名但等级还是 free，自动升为 verified 等级
        if req.is_verified and target.level == "free":
            target.level = "verified"

    await db.flush()

    quota = get_quota(target.level)
    return {
        "message": f"用户 {target.email} 等级已更新为 {quota.label}",
        "user_id": str(target.id),
        "level": target.level,
        "is_verified": target.is_verified,
    }


@router.get("/levels")
async def list_levels(
    _user: Annotated[User, Depends(get_current_user)],
):
    """列出所有可用等级及其配额（任何登录用户可查看）"""
    from app.core.level_quotas import LEVEL_QUOTAS
    result = []
    for key, quota in LEVEL_QUOTAS.items():
        result.append({
            "level": key,
            "label": quota.label,
            "ai_enabled": quota.ai_enabled,
            "ai_credits": quota.ai_credits,
            "backtests_per_day": quota.backtests_per_day,
            "max_strategies": quota.max_strategies,
            "priority_support": quota.priority_support,
        })
    return result
