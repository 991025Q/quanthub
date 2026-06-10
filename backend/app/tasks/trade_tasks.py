"""交易异步任务"""

from __future__ import annotations

from app.tasks import celery_app


@celery_app.task(bind=True, name="execute_trade")
def execute_trade(self, order_id: str):
    """执行交易委托"""
    # TODO: 实现交易执行逻辑
    pass


@celery_app.task(bind=True, name="sync_positions")
def sync_positions(self, account_id: str):
    """同步持仓（从 QMT 拉取）"""
    # TODO: 实现持仓同步
    pass
