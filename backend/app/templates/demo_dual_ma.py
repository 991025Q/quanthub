"""Demo 策略 2: 双均线交叉策略

策略逻辑：
- 开仓：5日均线上穿20日均线（金叉），且笔方向向上
- 平仓：5日均线下穿20日均线（死叉），或笔方向转为向下

信号说明：
- 使用 czsc 内置的均线交叉信号
- 结合缠论笔方向过滤，避免在下降趋势中做多

适用场景：
    - 入门级策略，适合理解 czsc 策略框架
    - 日线或 60 分钟级别
    - 趋势行情效果较好，震荡行情可能频繁止损
"""

from __future__ import annotations

from czsc import CzscStrategyBase, Position, Event


BASE_FREQ = "日线"

# 开仓信号：金叉 + 笔向上
SIG_MA_GOLDEN = f"{BASE_FREQ}_D1#SMA#5_均线交叉V230101_金叉_任意_任意_0"
SIG_BI_UP = f"{BASE_FREQ}_D1_表里关系V230101_向上_任意_任意_0"

# 平仓信号：死叉 或 笔向下
SIG_MA_DEAD = f"{BASE_FREQ}_D1#SMA#5_均线交叉V230101_死叉_任意_任意_0"
SIG_BI_DOWN = f"{BASE_FREQ}_D1_表里关系V230101_向下_任意_任意_0"


class DualMAStrategy(CzscStrategyBase):
    """双均线交叉策略"""

    @property
    def positions(self) -> list[Position]:
        open_event = Event.load({
            "name": "金叉_笔向上_开多",
            "operate": "开多",
            "signals_all": [SIG_MA_GOLDEN, SIG_BI_UP],
        })

        exit_events = [
            Event.load({
                "name": "死叉_平多",
                "operate": "平多",
                "signals_all": [SIG_MA_DEAD],
            }),
            Event.load({
                "name": "笔向下_平多",
                "operate": "平多",
                "signals_all": [SIG_BI_DOWN],
            }),
        ]

        return [
            Position(
                name="daily_双均线",
                symbol=self.symbol,
                opens=[open_event],
                exits=exit_events,
                interval=3600 * 24,      # 最小间隔 1 天
                timeout=60,               # 超时 60 天
                stop_loss=500,            # 止损 5%
                t0=False,
            )
        ]
