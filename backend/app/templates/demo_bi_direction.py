"""Demo 策略 3: 笔方向策略

策略逻辑：
- 开仓：30分钟级别笔方向转为向上 + 成交量放大（量比 > 1.5）
- 平仓：笔方向转为向下 或 持仓超过 10 天

信号说明：
- 使用缠论笔方向判断趋势
- 结合量价关系过滤假突破
- 适合中级用户理解缠论 + 量价结合

适用场景：
    - 30分钟或60分钟级别
    - 适合活跃个股，量价配合好时效果更佳
    - 持仓周期 1-10 天
"""

from __future__ import annotations

from czsc import CzscStrategyBase, Position, Event


BASE_FREQ = "30分钟"

# 开仓信号：笔向上
SIG_BI_UP = f"{BASE_FREQ}_D1_表里关系V230101_向上_任意_任意_0"

# 辅助信号：量比放大（如果可用）
SIG_VOL_UP = f"{BASE_FREQ}_D1_量比V230101_放量_任意_任意_0"

# 平仓信号：笔向下
SIG_BI_DOWN = f"{BASE_FREQ}_D1_表里关系V230101_向下_任意_任意_0"

# 过滤信号：涨停不开多
SIG_NOT_ZHANGTING = f"{BASE_FREQ}_D1_涨跌停V230331_涨停_任意_任意_0"


class BiDirectionStrategy(CzscStrategyBase):
    """笔方向策略"""

    @property
    def positions(self) -> list[Position]:
        # 主开仓事件：笔向上
        open_event = Event.load({
            "name": "笔向上_开多",
            "operate": "开多",
            "signals_all": [SIG_BI_UP],
            "signals_not": [SIG_NOT_ZHANGTING],
        })

        exit_event = Event.load({
            "name": "笔向下_平多",
            "operate": "平多",
            "signals_all": [SIG_BI_DOWN],
        })

        return [
            Position(
                name="30min_笔方向",
                symbol=self.symbol,
                opens=[open_event],
                exits=[exit_event],
                interval=3600 * 2,       # 最小间隔 2 小时
                timeout=20 * 30,         # 超时 10 天（20 根 30 分钟 K 线 * 8 根/天）
                stop_loss=400,           # 止损 4%
                t0=False,
            )
        ]
