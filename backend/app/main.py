"""FastAPI 应用入口"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import init_db

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期：启动时初始化数据库 + AI 客户端"""
    # 始终初始化数据库表（生产环境也需要）
    await init_db()
    # 启动时预初始化 AI 混合客户端（避免首次调用时卡顿等待）
    try:
        from app.services.hybrid_client import get_client
        get_client()
        print("[启动] AI 混合客户端已初始化（Dashscope+Ollama）")
    except Exception as e:
        print(f"[启动] AI 客户端初始化失败（不影响启动）: {e}")
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="SaaS 多租户量化交易平台 API",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
from app.api.router import api_router  # noqa: E402

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok", "version": settings.APP_VERSION}
