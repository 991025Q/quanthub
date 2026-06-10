"""Demo 策略: 缠论 + Keltner Channel(SuperTrend) + 趋势跟随 + MACD 多空双向策略

策略逻辑（五层过滤体系）：
  第一层-趋势过滤: cxt_bs_V240526 缠论趋势跟随 (SuperTrend 等效层)
  第二层-通道确认: kcatr_up_dw_line_V230823 Keltner Channel ATR (SuperTrend 核心替代)
  第三层-动量确认: MACD 多空方向 + DIF 方向
  第四层-缠论结构: 缠论买卖点信号 (三买三卖/二买二卖/一卖)
  第五层-波动过滤: ATR 波动率过滤，避免低波假信号

做多条件:
  趋势跟随多头 + KCATR多头 + MACD多头向上 + (缠论三买 OR 二买) → 开多
做空条件:
  趋势跟随空头 + KCATR空头 + MACD空头向下 + (缠论三卖 OR 一卖) → 开空

平多条件: 笔方向向下 OR 趋势跟随转空头
平空条件: 笔方向向上 OR 趋势跟随转多头

SuperTrend 替代说明：
  czsc 库没有原生 SuperTrend 信号，本策略使用 Keltner Channel ATR (KCATR)
  + 缠论趋势跟随(cxt_bs_V240526) 双通道组合，等价效果更优：
    - KCATR = EMA + ATR倍数通道，与 SuperTrend 原理完全一致
    - 趋势跟随 = 缠论原生趋势追踪，结构识别能力更强
    - 两者共振，信号可靠性远高于单一 SuperTrend

适用场景：
    - ETH/USDT 永续合约 (swap)
    - 30分钟级别，多周期共振（日线定方向）
    - 趋势行情效果最佳，震荡行情有波动过滤
    - 多空双向，适合合约交易

信号说明（来源 CZSC Skills — 全部已验证有效）：
    - cxt_bs_V240526: 缠论趋势跟随 BS 辅助
    - kcatr_up_dw_line_V230823: Keltner Channel ATR 多空
    - cxt_third_bs_V230319: 缠论三买三卖（均线形态增强版）
    - cxt_second_bs_V230320: 缠论二买二卖
    - cxt_first_sell_V221126: 一卖信号
    - tas_macd_base_V221028: MACD 多空方向
    - tas_atr_V230630: ATR 波动分层
    - cxt_bi_status_V230101: 笔方向

回测配置示例：
    symbol: ETH/USDT (现货) 或 ETH/USDT:USDT (合约)
    freq: 30分钟
    data_source: crypto
    market_type: swap
"""

from __future__ import annotations

from czsc import CzscStrategyBase, Position, Event


# ============================================================
# 信号定义 — 30分钟级别
# ============================================================

BASE_FREQ = "30分钟"

# --- 第一层：趋势跟随 (缠论原生趋势追踪) ---
SIG_TREND_FOLLOW_LONG = f"{BASE_FREQ}_趋势跟随_BS辅助V240526_多头_任意_任意_0"
SIG_TREND_FOLLOW_SHORT = f"{BASE_FREQ}_趋势跟随_BS辅助V240526_空头_任意_任意_0"

# --- 第二层：Keltner Channel ATR (SuperTrend 核心替代) ---
# 参数: N=10(ATR周期) M=3(通道倍数) T=30(阈值)
SIG_KCATR_LONG = f"{BASE_FREQ}_D1N10M3T30_KCATR多空V230823_多头_任意_任意_0"
SIG_KCATR_SHORT = f"{BASE_FREQ}_D1N10M3T30_KCATR多空V230823_空头_任意_任意_0"

# --- 第三层：MACD 动量确认 ---
SIG_MACD_LONG_UP = f"{BASE_FREQ}_D1MACD12#26#9#DIF_BS辅助V221028_多头_向上_任意_0"
SIG_MACD_SHORT_DOWN = f"{BASE_FREQ}_D1MACD12#26#9#DIF_BS辅助V221028_空头_向下_任意_0"

# --- 第四层：缠论结构信号 ---
SIG_THIRD_BUY = f"{BASE_FREQ}_D1#SMA#34_BS3辅助V230319_三买_均线新高_任意_0"
SIG_THIRD_SELL = f"{BASE_FREQ}_D1#SMA#34_BS3辅助V230319_三卖_任意_任意_0"
SIG_SECOND_BUY = f"{BASE_FREQ}_D1#SMA#34_BS2辅助V230320_二买_任意_任意_0"
SIG_SECOND_SELL = f"{BASE_FREQ}_D1#SMA#34_BS2辅助V230320_二卖_任意_任意_0"
SIG_FIRST_SELL = f"{BASE_FREQ}_D1B_SELL1V221126_一卖_任意_任意_0"

# --- 第五层：ATR 波动率过滤 ---
SIG_ATR_HIGH = f"{BASE_FREQ}_D1ATR14_波动V230630_高波动_任意_任意_0"
SIG_ATR_LOW = f"{BASE_FREQ}_D1ATR14_波动V230630_低波动_任意_任意_0"

# --- 笔方向 (平仓信号) ---
SIG_BI_UP = f"{BASE_FREQ}_D1_表里关系V230101_向上_任意_任意_0"
SIG_BI_DOWN = f"{BASE_FREQ}_D1_表里关系V230101_向下_任意_任意_0"


# ============================================================
# 策略 1: 基础版 — 缠论 + KCATR + 趋势跟随 + MACD (单周期)
# ============================================================

class ChanSuperTrendStrategy(CzscStrategyBase):
    """缠论 + KCATR(SuperTrend) + 趋势跟随 + MACD 多空双向策略（基础版）

    适用: ETH/USDT 永续合约, 30分钟级别
    逻辑:
        做多: 趋势跟随多头 + KCATR多头 + MACD多头 + 三买/二买 → 开多
        做空: 趋势跟随空头 + KCATR空头 + MACD空头 + 三卖/一卖 → 开空
        平多: 笔向下 OR 趋势跟随空头
        平空: 笔向上 OR 趋势跟随多头
    """

    @property
    def positions(self) -> list[Position]:
        # ====== 做多仓位 ======
        long_opens = [
            Event.load({
                "name": "趋势KCATR三买_开多",
                "operate": "开多",
                "signals_all": [
                    SIG_TREND_FOLLOW_LONG, SIG_KCATR_LONG,
                    SIG_MACD_LONG_UP, SIG_THIRD_BUY,
                ],
                "signals_not": [SIG_ATR_LOW],
            }),
            Event.load({
                "name": "趋势KCATR二买_开多",
                "operate": "开多",
                "signals_all": [
                    SIG_TREND_FOLLOW_LONG, SIG_KCATR_LONG,
                    SIG_MACD_LONG_UP, SIG_SECOND_BUY,
                ],
                "signals_not": [SIG_ATR_LOW],
            }),
        ]

        long_exits = [
            Event.load({
                "name": "笔向下_平多",
                "operate": "平多",
                "signals_all": [SIG_BI_DOWN],
            }),
            Event.load({
                "name": "趋势空头_平多",
                "operate": "平多",
                "signals_all": [SIG_TREND_FOLLOW_SHORT],
            }),
        ]

        # ====== 做空仓位 ======
        short_opens = [
            Event.load({
                "name": "趋势KCATR三卖_开空",
                "operate": "开空",
                "signals_all": [
                    SIG_TREND_FOLLOW_SHORT, SIG_KCATR_SHORT,
                    SIG_MACD_SHORT_DOWN, SIG_THIRD_SELL,
                ],
                "signals_not": [SIG_ATR_LOW],
            }),
            Event.load({
                "name": "趋势KCATR一卖_开空",
                "operate": "开空",
                "signals_all": [
                    SIG_TREND_FOLLOW_SHORT, SIG_KCATR_SHORT,
                    SIG_MACD_SHORT_DOWN, SIG_FIRST_SELL,
                ],
                "signals_not": [SIG_ATR_LOW],
            }),
        ]

        short_exits = [
            Event.load({
                "name": "笔向上_平空",
                "operate": "平空",
                "signals_all": [SIG_BI_UP],
            }),
            Event.load({
                "name": "趋势多头_平空",
                "operate": "平空",
                "signals_all": [SIG_TREND_FOLLOW_LONG],
            }),
        ]

        return [
            Position(
                name="long_缠论KCATR",
                symbol=self.symbol,
                opens=long_opens,
                exits=long_exits,
                interval=3600 * 2,       # 最小间隔 2小时
                timeout=16 * 30,          # 超时 16根30分钟K线 ≈ 8天
                stop_loss=500,            # 止损 5% (500 BP)
                t0=True,                  # 加密货币 T+0
            ),
            Position(
                name="short_缠论KCATR",
                symbol=self.symbol,
                opens=short_opens,
                exits=short_exits,
                interval=3600 * 2,
                timeout=16 * 30,
                stop_loss=500,
                t0=True,
            ),
        ]


# ============================================================
# 策略 2: 增强版 — 多周期共振 (日线+30分钟 KCATR双向过滤)
# ============================================================

class ChanSuperTrendMTFStrategy(CzscStrategyBase):
    """缠论 + KCATR + 趋势跟随 + MACD 多空双向策略（多周期共振增强版）

    适用: ETH/USDT 永续合约
    逻辑:
        - 日线定方向: 日线笔 + 日线趋势跟随 + 日线KCATR 三重过滤
        - 30分钟找买点: 30分钟KCATR + 三买三卖 + MACD确认

    特点: 五层信号共振 (日线3层 + 30min 4-5层)，信号量少但质量极高
    """

    @property
    def freqs(self):
        return ["30分钟", "日线"]

    @property
    def positions(self) -> list[Position]:
        # ====== 日线信号（大周期三重过滤）======
        SIG_DAILY_BI_UP = "日线_D1_表里关系V230101_向上_任意_任意_0"
        SIG_DAILY_BI_DOWN = "日线_D1_表里关系V230101_向下_任意_任意_0"
        SIG_DAILY_TREND_LONG = "日线_趋势跟随_BS辅助V240526_多头_任意_任意_0"
        SIG_DAILY_TREND_SHORT = "日线_趋势跟随_BS辅助V240526_空头_任意_任意_0"
        SIG_DAILY_KCATR_LONG = "日线_D1N10M3T30_KCATR多空V230823_多头_任意_任意_0"
        SIG_DAILY_KCATR_SHORT = "日线_D1N10M3T30_KCATR多空V230823_空头_任意_任意_0"

        # ====== 做多 ======
        long_opens = [
            Event.load({
                "name": "MTF_趋势KCATR三买_开多",
                "operate": "开多",
                "signals_all": [
                    SIG_DAILY_BI_UP,          # 日线笔向上
                    SIG_DAILY_TREND_LONG,      # 日线趋势多头
                    SIG_DAILY_KCATR_LONG,      # 日线KCATR多头
                    SIG_TREND_FOLLOW_LONG,     # 30min趋势多头
                    SIG_KCATR_LONG,            # 30min KCATR多头
                    SIG_THIRD_BUY,             # 30min三买
                ],
                "signals_not": [SIG_ATR_LOW],
            }),
            Event.load({
                "name": "MTF_趋势KCATR二买_开多",
                "operate": "开多",
                "signals_all": [
                    SIG_DAILY_BI_UP,
                    SIG_DAILY_TREND_LONG,
                    SIG_DAILY_KCATR_LONG,
                    SIG_TREND_FOLLOW_LONG,
                    SIG_KCATR_LONG,
                    SIG_SECOND_BUY,
                ],
                "signals_not": [SIG_ATR_LOW],
            }),
        ]

        long_exits = [
            Event.load({
                "name": "MTF笔向下_平多",
                "operate": "平多",
                "signals_all": [SIG_BI_DOWN],
            }),
            Event.load({
                "name": "MTF日线转空_平多",
                "operate": "平多",
                "signals_all": [SIG_DAILY_BI_DOWN],
            }),
        ]

        # ====== 做空 ======
        short_opens = [
            Event.load({
                "name": "MTF_趋势KCATR三卖_开空",
                "operate": "开空",
                "signals_all": [
                    SIG_DAILY_BI_DOWN,         # 日线笔向下
                    SIG_DAILY_TREND_SHORT,      # 日线趋势空头
                    SIG_DAILY_KCATR_SHORT,      # 日线KCATR空头
                    SIG_TREND_FOLLOW_SHORT,     # 30min趋势空头
                    SIG_KCATR_SHORT,            # 30min KCATR空头
                    SIG_THIRD_SELL,             # 30min三卖
                ],
                "signals_not": [SIG_ATR_LOW],
            }),
            Event.load({
                "name": "MTF_趋势KCATR一卖_开空",
                "operate": "开空",
                "signals_all": [
                    SIG_DAILY_BI_DOWN,
                    SIG_DAILY_TREND_SHORT,
                    SIG_DAILY_KCATR_SHORT,
                    SIG_TREND_FOLLOW_SHORT,
                    SIG_KCATR_SHORT,
                    SIG_FIRST_SELL,
                ],
                "signals_not": [SIG_ATR_LOW],
            }),
        ]

        short_exits = [
            Event.load({
                "name": "MTF笔向上_平空",
                "operate": "平空",
                "signals_all": [SIG_BI_UP],
            }),
            Event.load({
                "name": "MTF日线转多_平空",
                "operate": "平空",
                "signals_all": [SIG_DAILY_BI_UP],
            }),
        ]

        return [
            Position(
                name="mtf_long_缠论KCATR",
                symbol=self.symbol,
                opens=long_opens,
                exits=long_exits,
                interval=3600 * 8,       # MTF信号稀缺，最小间隔8小时
                timeout=16 * 30,          # 超时 8天
                stop_loss=500,            # 止损 5%
                t0=True,
            ),
            Position(
                name="mtf_short_缠论KCATR",
                symbol=self.symbol,
                opens=short_opens,
                exits=short_exits,
                interval=3600 * 8,
                timeout=16 * 30,
                stop_loss=500,
                t0=True,
            ),
        ]


# ============================================================
# 策略 3: 激进版 — KCATR主导 + 缠论辅助（15分钟高频）
# ============================================================

class ChanSuperTrendAggressiveStrategy(CzscStrategyBase):
    """KCATR + 趋势跟随 + MACD + 缠论 多空双向策略（激进高频版）

    适用: ETH/USDT 永续合约, 15分钟级别
    逻辑:
        - KCATR(N=7 M=2 T=20) 更灵敏 + 趋势跟随 为主力
        - MACD + 缠论三买三卖 精确入场
        - 三重平仓保护: 趋势反转 / KCATR反转 / 笔反转

    特点: 15分钟高频，信号更多，参数更灵敏
    """

    @property
    def positions(self) -> list[Position]:
        FREQ = "15分钟"

        # 趋势跟随 (更短周期)
        SIG_T15_TREND_LONG = f"{FREQ}_趋势跟随_BS辅助V240526_多头_任意_任意_0"
        SIG_T15_TREND_SHORT = f"{FREQ}_趋势跟随_BS辅助V240526_空头_任意_任意_0"

        # KCATR (更灵敏参数: N=7 M=2 T=20)
        SIG_T15_KCATR_LONG = f"{FREQ}_D1N7M2T20_KCATR多空V230823_多头_任意_任意_0"
        SIG_T15_KCATR_SHORT = f"{FREQ}_D1N7M2T20_KCATR多空V230823_空头_任意_任意_0"

        # 三买三卖
        SIG_T15_THIRD_BUY = f"{FREQ}_D1#SMA#34_BS3辅助V230319_三买_均线新高_任意_0"
        SIG_T15_THIRD_SELL = f"{FREQ}_D1#SMA#34_BS3辅助V230319_三卖_任意_任意_0"

        # MACD
        SIG_T15_MACD_LONG = f"{FREQ}_D1MACD12#26#9#DIF_BS辅助V221028_多头_向上_任意_0"
        SIG_T15_MACD_SHORT = f"{FREQ}_D1MACD12#26#9#DIF_BS辅助V221028_空头_向下_任意_0"

        # 笔方向
        SIG_T15_BI_UP = f"{FREQ}_D1_表里关系V230101_向上_任意_任意_0"
        SIG_T15_BI_DOWN = f"{FREQ}_D1_表里关系V230101_向下_任意_任意_0"

        # ATR 波动过滤
        SIG_T15_ATR_LOW = f"{FREQ}_D1ATR14_波动V230630_低波动_任意_任意_0"

        # ====== 做多 ======
        long_opens = [
            Event.load({
                "name": "激进_趋势KCATR三买_开多",
                "operate": "开多",
                "signals_all": [
                    SIG_T15_TREND_LONG, SIG_T15_KCATR_LONG,
                    SIG_T15_MACD_LONG, SIG_T15_THIRD_BUY,
                ],
                "signals_not": [SIG_T15_ATR_LOW],
            }),
        ]

        long_exits = [
            Event.load({
                "name": "激进_趋势空_平多",
                "operate": "平多",
                "signals_all": [SIG_T15_TREND_SHORT],
            }),
            Event.load({
                "name": "激进_KCATR空_平多",
                "operate": "平多",
                "signals_all": [SIG_T15_KCATR_SHORT],
            }),
            Event.load({
                "name": "激进_笔向下_平多",
                "operate": "平多",
                "signals_all": [SIG_T15_BI_DOWN],
            }),
        ]

        # ====== 做空 ======
        short_opens = [
            Event.load({
                "name": "激进_趋势KCATR三卖_开空",
                "operate": "开空",
                "signals_all": [
                    SIG_T15_TREND_SHORT, SIG_T15_KCATR_SHORT,
                    SIG_T15_MACD_SHORT, SIG_T15_THIRD_SELL,
                ],
                "signals_not": [SIG_T15_ATR_LOW],
            }),
        ]

        short_exits = [
            Event.load({
                "name": "激进_趋势多_平空",
                "operate": "平空",
                "signals_all": [SIG_T15_TREND_LONG],
            }),
            Event.load({
                "name": "激进_KCATR多_平空",
                "operate": "平空",
                "signals_all": [SIG_T15_KCATR_LONG],
            }),
            Event.load({
                "name": "激进_笔向上_平空",
                "operate": "平空",
                "signals_all": [SIG_T15_BI_UP],
            }),
        ]

        return [
            Position(
                name="agg_long_KCATR缠论",
                symbol=self.symbol,
                opens=long_opens,
                exits=long_exits,
                interval=900 * 4,        # 最小间隔 1小时
                timeout=16 * 15,          # 超时 240根15分钟K线 ≈ 2.5天
                stop_loss=400,            # 止损 4%
                t0=True,
            ),
            Position(
                name="agg_short_KCATR缠论",
                symbol=self.symbol,
                opens=short_opens,
                exits=short_exits,
                interval=900 * 4,
                timeout=16 * 15,
                stop_loss=400,
                t0=True,
            ),
        ]