"""Demo 策略: 加密货币三买高频策略

策略逻辑：
- 开仓：15分钟级别出现缠论第三类买点（三买），多版本信号 OR 触发
- 平仓：15分钟级别笔方向转为向下
- 止损：500 BP (5%)

信号说明（来源 CZSC Skills - rs_czsc 232信号函数）：
- 三买信号使用 cxt_third_buy_V230228: {freq}_D{di}_三买辅助V230228
- 三买信号使用 cxt_third_bs_V230319: {freq}_D{di}#{ma_type}#{timeperiod}_BS3辅助V230319
- 笔方向使用 cxt_bi_status_V230101: {freq}_D1_表里关系V230101
- 笔结束使用 cxt_bi_end_V230224: {freq}_D1_BE辅助V230224

加密货币策略特点：
- T+0 交易，可以当日买卖
- 24/7 交易，无需考虑涨跌停
- 使用更短周期 (15分钟/30分钟)
- interval 更短，适合高频交易
- 使用 CCXT 获取真实交易所数据 (Gate.io / Binance / OKX)
- 标的代码格式: BTC/USDT, ETH/USDT (现货) 或 BTC/USDT:USDT (合约)

适用场景：
    - BTC/USDT, ETH/USDT 等主流加密货币
    - 15分钟级别，持仓周期约数小时到2天
    - 适合波动较大的行情，趋势行情效果更好

回测配置：
    symbol: BTC/USDT 或 ETH/USDT
    freq: 15分钟
    data_source: crypto
    market_type: spot (现货) 或 swap (永续合约)
"""

from __future__ import annotations

from czsc import CzscStrategyBase, Position, Event


# ============================================================
# 信号定义 — 15分钟级别加密货币
# ============================================================

BASE_FREQ = "15分钟"

# 开仓信号：三买（多种变体，OR 触发）
SIG_THIRD_BUY = f"{BASE_FREQ}_D1_三买辅助V230228_三买_任意_任意_0"

# 三买辅助 V230319（带均线形态，推荐）
SIG_BS3_V230319 = f"{BASE_FREQ}_D1#SMA#34_BS3辅助V230319_三买_均线新高_任意_0"

# 笔方向信号
SIG_BI_DOWN = f"{BASE_FREQ}_D1_表里关系V230101_向下_任意_任意_0"

# 笔结束辅助信号
SIG_BI_END = f"{BASE_FREQ}_D1_BE辅助V230224_向下_任意_任意_0"


# ============================================================
# 策略 1: 加密货币三买高频（单事件版）
# ============================================================

class CryptoThirdBuyStrategy(CzscStrategyBase):
    """加密货币三买高频策略 - 单事件版

    适用: BTC/USDT, ETH/USDT 等 15分钟级别
    逻辑: 出现三买信号做多，笔向下平仓
    特点: T+0交易，更短的超时时间
    """

    @property
    def positions(self) -> list[Position]:
        open_event = Event.load({
            "name": "三买V230228_开多",
            "operate": "开多",
            "signals_all": [SIG_THIRD_BUY],
        })

        exit_event = Event.load({
            "name": "笔向下_平多",
            "operate": "平多",
            "signals_all": [SIG_BI_DOWN],
        })

        return [
            Position(
                name="15min_crypto_三买",
                symbol=self.symbol,
                opens=[open_event],
                exits=[exit_event],
                interval=900 * 2,      # 最小间隔 30分钟 (900秒 * 2)
                timeout=16 * 15,        # 超时 240根15分钟K线 ≈ 2.5天
                stop_loss=500,          # 止损 5% (500 BP)
                t0=True,                # T+0: 加密货币当日可买卖
            )
        ]


# ============================================================
# 策略 2: 加密货币三买高频（多事件版，更多开仓条件）
# ============================================================

class CryptoThirdBuyMultiStrategy(CzscStrategyBase):
    """加密货币三买高频策略 - 多事件版

    适用: BTC/USDT, ETH/USDT 等 15分钟级别
    逻辑: 三买V230228 或 三买V230319(均线形态) → 开多，笔向下平仓
    特点: 多个开仓条件 OR 触发，更多交易机会
    """

    @property
    def positions(self) -> list[Position]:
        opens = [
            Event.load({
                "name": "三买V230228_开多",
                "operate": "开多",
                "signals_all": [SIG_THIRD_BUY],
            }),
            Event.load({
                "name": "三买V230319_开多",
                "operate": "开多",
                "signals_all": [SIG_BS3_V230319],
            }),
        ]

        exit_event = Event.load({
            "name": "笔向下_平多",
            "operate": "平多",
            "signals_all": [SIG_BI_DOWN],
        })

        return [
            Position(
                name="15min_crypto_三买_multi",
                symbol=self.symbol,
                opens=opens,
                exits=[exit_event],
                interval=900 * 2,      # 最小间隔 30分钟
                timeout=16 * 15,        # 超时 2.5天
                stop_loss=500,          # 止损 5%
                t0=True,
            )
        ]


# ============================================================
# 策略 3: 加密货币多周期三买共振（推荐）
# ============================================================

class CryptoMultiTimeframeStrategy(CzscStrategyBase):
    """加密货币多周期三买共振策略

    适用: BTC/USDT, ETH/USDT 等
    逻辑: 日线笔向上(大周期定方向) + 30分钟三买(小周期找买点) → 开多
    特点: 多周期共振，减少假信号；需要 signals_config 配合多周期分析
    """

    @property
    def freqs(self):
        return ["30分钟", "日线"]

    @property
    def positions(self) -> list[Position]:
        # 大周期定方向：日线笔向上
        SIG_DAILY_BI_UP = "日线_D1_表里关系V230101_向上_任意_任意_0"

        # 小周期找买点：30分钟三买
        SIG_30M_THIRD_BUY = "30分钟_D1_三买辅助V230228_三买_任意_任意_0"
        SIG_30M_BS3_V230319 = "30分钟_D1#SMA#34_BS3辅助V230319_三买_均线新高_任意_0"

        opens = [
            Event.load({
                "name": "多周期三买_开多",
                "operate": "开多",
                "signals_all": [
                    SIG_DAILY_BI_UP,     # 大周期方向向上
                    SIG_30M_THIRD_BUY,    # 小周期三买
                ],
            }),
            Event.load({
                "name": "多周期三买V230319_开多",
                "operate": "开多",
                "signals_all": [
                    SIG_DAILY_BI_UP,     # 大周期方向向上
                    SIG_30M_BS3_V230319,  # 小周期三买(均线形态)
                ],
            }),
        ]

        exit_event = Event.load({
            "name": "笔向下_平多",
            "operate": "平多",
            "signals_all": ["30分钟_D1_表里关系V230101_向下_任意_任意_0"],
        })

        return [
            Position(
                name="multi_tf_crypto_三买",
                symbol=self.symbol,
                opens=opens,
                exits=[exit_event],
                interval=3600 * 4,       # 最小间隔 4小时
                timeout=16 * 30,          # 超时 8天
                stop_loss=500,            # 止损 5%
                t0=True,
            )
        ]


# ============================================================
# 策略 4: 加密货币 MACD + 笔方向组合策略
# ============================================================

class CryptoMACDBiStrategy(CzscStrategyBase):
    """加密货币 MACD + 笔方向组合策略

    适用: BTC/USDT, ETH/USDT 等 30分钟级别
    逻辑: MACD多头方向 + 笔向上 → 开多，笔向下 + MACD空头 → 平多
    特点: MACD辅助确认趋势，笔方向作为主要触发
    """

    @property
    def positions(self) -> list[Position]:
        SIG_30M_BI_UP = "30分钟_D1_表里关系V230101_向上_任意_任意_0"
        SIG_30M_BI_DOWN = "30分钟_D1_表里关系V230101_向下_任意_任意_0"
        SIG_30M_MACD_LONG = "30分钟_D1MACD12#26#9#DIF_BS辅助V221028_多头_向上_任意_0"
        SIG_30M_MACD_SHORT = "30分钟_D1MACD12#26#9#DIF_BS辅助V221028_空头_向下_任意_0"

        open_event = Event.load({
            "name": "MACD多头_笔向上_开多",
            "operate": "开多",
            "signals_all": [SIG_30M_BI_UP, SIG_30M_MACD_LONG],
        })

        exit_event = Event.load({
            "name": "MACD空头_笔向下_平多",
            "operate": "平多",
            "signals_all": [SIG_30M_BI_DOWN, SIG_30M_MACD_SHORT],
        })

        return [
            Position(
                name="30min_crypto_MACD笔方向",
                symbol=self.symbol,
                opens=[open_event],
                exits=[exit_event],
                interval=3600 * 2,       # 最小间隔 2小时
                timeout=16 * 30,          # 超时 8天
                stop_loss=500,            # 止损 5%
                t0=True,
            )
        ]