"""权重管理服务层 - 基于 wmr"""

from __future__ import annotations

from app.config import get_settings

settings = get_settings()


class WeightService:
    """wmr 权重管理封装

    职责：
    - 回测权重落库（wbt weight_df → wmr）
    - 权重版本管理
    - 权重查询（快照/版本/归因）
    - 实盘权重同步
    """

    def __init__(self):
        self.backend = settings.WMR_BACKEND  # duckdb / clickhouse
        # TODO: 初始化 wmr 连接
        # if self.backend == "duckdb":
        #     self.wmr = wmr.DuckDBBackend(settings.WMR_DUCKDB_PATH)
        # else:
        #     self.wmr = wmr.ClickHouseBackend(settings.WMR_CLICKHOUSE_URL)

    async def save_weights(self, strategy_id: str, tenant_id: str, weight_df, source: str = "backtest"):
        """保存权重序列到 wmr"""
        # TODO: weight_df → wmr.save()
        pass

    async def get_snapshots(self, strategy_id: str, tenant_id: str, sdt: str = None, edt: str = None):
        """查询权重快照时序"""
        # TODO: wmr.query()
        pass

    async def get_versions(self, strategy_id: str, tenant_id: str):
        """查询权重版本列表"""
        # TODO: wmr.versions()
        pass

    async def get_attribution(self, strategy_id: str, tenant_id: str, version_id: str = None):
        """权重归因分析"""
        # TODO: wmr.attribution()
        pass

    async def get_latest_snapshot(self, strategy_id: str, tenant_id: str):
        """获取最新权重快照（供 trade-service 消费）"""
        # TODO: wmr.latest()
        pass
