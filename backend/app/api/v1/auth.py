"""认证 API"""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedException, ValidationException
from app.core.security import (
    create_access_token, create_refresh_token, hash_password, verify_password, decode_token,
)
from app.database import get_db
from app.dependencies import get_current_user
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, UserResponse,
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(req: RegisterRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    """注册新用户（自动创建租户）"""
    # 检查邮箱是否已注册
    existing = await db.execute(select(User).where(User.email == req.email))
    if existing.scalar_one_or_none():
        raise ValidationException("Email already registered")

    # 创建租户
    tenant = Tenant(
        name=req.tenant_name or req.email.split("@")[0],
        slug=req.email.split("@")[0],
    )
    db.add(tenant)
    await db.flush()

    # 创建用户
    user = User(
        tenant_id=tenant.id,
        email=req.email,
        password_hash=hash_password(req.password),
        display_name=req.display_name,
        role="admin",
    )
    db.add(user)
    await db.flush()

    token_data = {"sub": str(user.id), "tenant_id": str(tenant.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/login", response_model=TokenResponse)
async def login(req: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    """登录"""
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalar_one_or_none()
    if user is None or not verify_password(req.password, user.password_hash):
        raise UnauthorizedException("Invalid email or password")
    if not user.is_active:
        raise UnauthorizedException("Account is disabled")

    token_data = {"sub": str(user.id), "tenant_id": str(user.tenant_id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(req: RefreshRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    """刷新 token"""
    payload = decode_token(req.refresh_token)
    if payload is None or payload.get("type") != "refresh":
        raise UnauthorizedException("Invalid refresh token")

    token_data = {"sub": payload["sub"], "tenant_id": payload.get("tenant_id")}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=UserResponse)
async def me(user: Annotated[User, Depends(get_current_user)]):
    """当前用户信息"""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        display_name=user.display_name,
        role=user.role,
        tenant_id=str(user.tenant_id) if user.tenant_id else None,
    )
