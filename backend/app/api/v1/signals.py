"""信号库 API"""

from __future__ import annotations

from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.signal import SignalRegistry
from app.models.user import User

router = APIRouter()

# SIGNALS.md 文档路径
SIGNALS_DOC_PATH = Path(__file__).parent.parent.parent / "templates" / "SIGNALS.md"


@router.get("")
async def list_signals(
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
):
    """信号函数列表"""
    # 全局信号 (tenant_id IS NULL) + 租户自定义信号
    result = await db.execute(select(SignalRegistry).where(SignalRegistry.is_active.is_(True)))
    signals = result.scalars().all()
    return [
        {
            "name": s.name,
            "category": s.category,
            "display_name": s.display_name,
            "description": s.description,
            "source": s.source,
            "params_schema": s.params_schema,
        }
        for s in signals
    ]


@router.get("/{name}")
async def get_signal(
    name: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
):
    """信号详情"""
    result = await db.execute(select(SignalRegistry).where(SignalRegistry.name == name))
    signal = result.scalar_one_or_none()
    if not signal:
        return {"error": "信号不存在"}
    return {
        "name": signal.name,
        "category": signal.category,
        "display_name": signal.display_name,
        "description": signal.description,
        "source": signal.source,
        "params_schema": signal.params_schema,
    }


@router.get("/documentation")
async def get_signals_documentation(
    _user: Annotated[User, Depends(get_current_user)],
):
    """获取 SIGNALS.md 文档内容"""
    if not SIGNALS_DOC_PATH.exists():
        return {"error": "文档不存在", "content": ""}
    
    content = SIGNALS_DOC_PATH.read_text(encoding="utf-8")
    return {"content": content}
