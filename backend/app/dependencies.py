"""FastAPI 公共依赖注入"""

from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenException, UnauthorizedException
from app.core.security import decode_token
from app.database import get_db
from app.models.user import User

security_scheme = HTTPBearer()


async def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """从 JWT 获取当前用户"""
    payload = decode_token(credentials.credentials)
    if payload is None or payload.get("type") != "access":
        raise UnauthorizedException("Invalid or expired token")

    user_id = payload.get("sub")
    if user_id is None:
        raise UnauthorizedException("Invalid token payload")

    result = await db.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise UnauthorizedException("User not found or inactive")
    return user


async def get_current_tenant_id(
    user: Annotated[User, Depends(get_current_user)],
) -> UUID:
    """获取当前用户的 tenant_id"""
    if user.tenant_id is None:
        raise ForbiddenException("User has no tenant")
    return user.tenant_id


def require_role(*roles: str):
    """角色权限检查工厂"""
    async def checker(user: Annotated[User, Depends(get_current_user)]):
        if user.role not in roles:
            raise ForbiddenException(f"Role {user.role} not permitted, required: {roles}")
        return user
    return checker
