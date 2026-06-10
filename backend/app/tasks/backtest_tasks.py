"""回测异步任务"""

from __future__ import annotations

from app.tasks import celery_app


@celery_app.task(bind=True, name="run_backtest")
def run_backtest(self, job_id: str):
    """执行回测任务

    流程：
    1. 从 DB 加载 job + strategy
    2. 下载行情数据
    3. 执行 CzscStrategyBase.backtest()
    4. 生成 wbt 报告
    5. 权重推送 wmr
    6. 更新 job 状态
    """
    # TODO: 实现回测逻辑
    pass
