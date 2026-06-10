"""API 路由汇总"""

from fastapi import APIRouter

# 暂时禁用 market 模块，避免启动错误
from app.api.v1 import ai, auth, tenants, strategies, backtests, trades, signals  # , market

api_router = APIRouter()

api_router.include_router(ai.router, prefix="/v1/ai", tags=["ai"])
api_router.include_router(auth.router, prefix="/v1/auth", tags=["auth"])
api_router.include_router(tenants.router, prefix="/v1/tenants", tags=["tenants"])
api_router.include_router(strategies.router, prefix="/v1/strategies", tags=["strategies"])
api_router.include_router(backtests.router, prefix="/v1/backtests", tags=["backtests"])
api_router.include_router(trades.router, prefix="/v1/trade", tags=["trade"])
api_router.include_router(signals.router, prefix="/v1/signals", tags=["signals"])
# api_router.include_router(market.router, prefix="/v1/market", tags=["market"])