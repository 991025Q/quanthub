"""Demo 策略 1: 缠论三买策略

策略逻辑：
- 开仓：30分钟级别出现缠论第三类买点（三买），且不在涨停状态
- 平仓：30分钟级别笔方向转为向下

信号说明：
- 三买信号使用 cxt_third_buy_V230228
- 辅助信号 cxt_third_bs_V230318 / V230319 增强确认
- 涨停过滤使用 涨跌停V230331

使用方法：
    在 QuantHub 中创建新策略，选择"缠论三买策略"模板即可。

适用场景：
    - 适合趋势行情中的回调买入
    - 30分钟级别，持仓周期约 1-5 天
    - 适合流动性好的大盘股或 ETF
"""

from __future__ import annotations

from czsc import CzscStrategyBase, Position, Event


# ============================================================
# 信号定义（可根据需要修改频率）
# ============================================================

BASE_FREQ = "30分钟"

# 开仓信号：三买
SIG_THIRD_BUY = f"{BASE_FREQ}_D1_三买辅助V230228_三买_任意_任意_0"

# 辅助开仓信号（多事件版）
SIG_BS3_V230318 = f"{BASE_FREQ}_D1#SMA#34_BS3辅助V230318_三买_任意_任意_0"
SIG_BS3_V230319 = f"{BASE_FREQ}_D1#SMA#34_BS3辅助V230319_三买_均线新高_任意_0"

# 平仓信号：笔向下
SIG_BI_DOWN = f"{BASE_FREQ}_D1_表里关系V230101_向下_任意_任意_0"

# 过滤信号：涨停不开多
SIG_NOT_ZHANGTING = f"{BASE_FREQ}_D1_涨跌停V230331_涨停_任意_任意_0"


# ============================================================
# 策略定义
# ============================================================

class ChanThirdBuyStrategy(CzscStrategyBase):
    """缠论三买策略 - 单事件版"""

    @property
    def positions(self) -> list[Position]:
        open_event = Event.load({
            "name": "三买V230228_开多",
            "operate": "开多",
            "signals_all": [SIG_THIRD_BUY],
            "signals_not": [SIG_NOT_ZHANGTING],
        })

        exit_event = Event.load({
            "name": "笔向下_平多",
            "operate": "平多",
            "signals_all": [SIG_BI_DOWN],
        })

        return [
            Position(
                name="30min_三买",
                symbol=self.symbol,
                opens=[open_event],
                exits=[exit_event],
                interval=3600 * 4,       # 最小间隔 4 小时
                timeout=16 * 30,          # 超时 8 天（16 根 30 分钟 K 线）
                stop_loss=300,            # 止损 3%（300 BP）
                t0=False,                 # T+1
            )
        ]


class ChanThirdBuyMultiStrategy(CzscStrategyBase):
    """缠论三买策略 - 多事件版（更多开仓条件）"""

    @property
    def positions(self) -> list[Position]:
        opens = [
            Event.load({
                "name": "三买V230228_开多",
                "operate": "开多",
                "signals_all": [SIG_THIRD_BUY],
                "signals_not": [SIG_NOT_ZHANGTING],
            }),
            Event.load({
                "name": "三买V230318_开多",
                "operate": "开多",
                "signals_all": [SIG_BS3_V230318],
                "signals_not": [SIG_NOT_ZHANGTING],
            }),
            Event.load({
                "name": "三买V230319_开多",
                "operate": "开多",
                "signals_all": [SIG_BS3_V230319],
                "signals_not": [SIG_NOT_ZHANGTING],
            }),
        ]

        exit_event = Event.load({
            "name": "笔向下_平多",
            "operate": "平多",
            "signals_all": [SIG_BI_DOWN],
        })

        return [
            Position(
                name="30min_三买_multi",
                symbol=self.symbol,
                opens=opens,
                exits=[exit_event],
                interval=3600 * 4,
                timeout=16 * 30,
                stop_loss=300,
                t0=False,
            )
        ]
