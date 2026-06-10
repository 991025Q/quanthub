"""初始化信号库数据脚本

将内置信号库数据写入 signals_registry 表
"""

import asyncio
import sys
from pathlib import Path

# 添加项目根目录到路径
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings
from app.models.signal import SignalRegistry
from app.services.signal_service import get_all_signals_cached, get_signal_example

settings = get_settings()

# 创建数据库引擎
engine = create_async_engine(settings.DATABASE_URL, echo=False)
async_session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_signals():
    """将信号数据初始化到数据库"""
    print("🔄 开始初始化信号库数据...")
    
    # 获取所有信号
    signals = get_all_signals_cached()
    print(f"📚 共找到 {len(signals)} 个信号")
    
    async with async_session_factory() as session:
        # 检查是否已有数据
        result = await session.execute(select(SignalRegistry))
        existing = result.scalars().all()
        
        if existing:
            print(f"⚠️  数据库中已有 {len(existing)} 个信号，跳过初始化")
            return
        
        # 批量插入信号
        count = 0
        for signal in signals:
            # 检查是否已存在
            check = await session.execute(
                select(SignalRegistry).where(SignalRegistry.name == signal["name"])
            )
            if check.scalar_one_or_none():
                continue
            
            # 获取示例
            example = get_signal_example(signal["name"])
            
            # 创建信号记录
            signal_record = SignalRegistry(
                tenant_id=None,  # 全局信号
                name=signal["name"],
                category=signal.get("category", "other"),
                display_name=signal.get("name", ""),
                description=signal.get("description", ""),
                params_schema={"example": example},
                source=signal.get("module", "czsc"),
                is_active=True,
            )
            session.add(signal_record)
            count += 1
        
        await session.commit()
        print(f"✅ 成功初始化 {count} 个信号到数据库")
        print("🎉 信号库初始化完成！")


if __name__ == "__main__":
    asyncio.run(init_signals())