# 暂时禁用 market 模块，避免启动错误
from app.api.v1 import ai, auth, tenants, strategies, backtests, trades, signals  # , market

__all__ = ["ai", "auth", "tenants", "strategies", "backtests", "trades", "signals"]  # , "market"