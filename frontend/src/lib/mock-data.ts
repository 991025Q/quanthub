/**
 * Mock 数据 - 用于前端开发和演示
 * 后端启动后，页面会优先使用 API 数据，API 不可用时 fallback 到此数据
 */

export interface MockStrategy {
  id: string;
  name: string;
  status: string;
  version: number;
  updated_at: string;
  description: string;
  freq: string;
}

export interface MockSignal {
  name: string;
  category: string;
  display_name: string;
  description: string;
  source: string;
  example?: string;
}

export interface MockPosition {
  id: string;
  symbol: string;
  direction: string;
  volume: number;
  avg_price: number;
  unrealized_pnl: number;
}

export interface MockOrder {
  id: string;
  symbol: string;
  direction: string;
  volume: number;
  price: number;
  status: string;
  created_at: string;
}

export interface MockBacktestResult {
  annual_return: number;
  sharpe_ratio: number;
  max_drawdown: number;
  win_rate: number;
  total_trades: number;
  profit_factor: number;
}

export const mockStrategies: MockStrategy[] = [
  {
    id: "s-001",
    name: "缠论三买策略",
    status: "validated",
    version: 3,
    updated_at: "2026-05-25 14:30",
    description: "30分钟级别三买做多，笔向下平仓",
    freq: "30分钟",
  },
  {
    id: "s-002",
    name: "双均线交叉",
    status: "draft",
    version: 1,
    updated_at: "2026-05-24 09:15",
    description: "日线级别双均线金叉做多、死叉平仓",
    freq: "日线",
  },
  {
    id: "s-003",
    name: "笔方向跟踪",
    status: "backtesting",
    version: 5,
    updated_at: "2026-05-25 10:00",
    description: "30分钟笔向上做多，涨停过滤",
    freq: "30分钟",
  },
  {
    id: "s-004",
    name: "MACD背离策略",
    status: "validated",
    version: 2,
    updated_at: "2026-05-23 16:45",
    description: "MACD底背离做多，顶背离平仓",
    freq: "60分钟",
  },
];

export const mockSignals: MockSignal[] = [
  // 缠论信号
  { 
    name: "cxt_bi_base_V230228", 
    category: "chanlun", 
    display_name: "笔基础状态", 
    description: "判断当前笔的基础状态(向上/向下),用于识别趋势方向。当价格从低点持续上涨到高点形成向上的笔,或从高点下跌到低点形成向下的笔",
    source: "czsc.signals",
    example: "30分钟_D1_笔基础V230228_向上_任意_任意_0"
  },
  { 
    name: "cxt_bi_status_V230101", 
    category: "chanlun", 
    display_name: "笔方向(表里关系)", 
    description: "缠论笔方向信号,判断笔的向上/向下状态。向上表示多头趋势,向下表示空头趋势。最常用的趋势判断信号",
    source: "czsc.signals",
    example: "30分钟_D1_表里关系V230101_向上_任意_任意_0"
  },
  { 
    name: "cxt_third_buy_V230228", 
    category: "chanlun", 
    display_name: "缠论三买", 
    description: "第三类买点信号。在向上笔回调不创新低时出现,是强势回调买入点。表示趋势继续向上,是较好的做多时机",
    source: "czsc.signals",
    example: "30分钟_D1_三买辅助V230228_三买_任意_任意_0"
  },
  { 
    name: "cxt_third_bs_V230319", 
    category: "chanlun", 
    display_name: "三买三卖辅助(均线)", 
    description: "带均线形态确认的三买/三卖信号。结合均线新高/新低来判断买卖点,比单纯三买更可靠",
    source: "czsc.signals",
    example: "30分钟_D1#SMA#34_BS3辅助V230319_三买_均线新高_任意_0"
  },
  { 
    name: "cxt_first_buy_V221126", 
    category: "chanlun", 
    display_name: "缠论一买", 
    description: "第一类买点信号。趋势下跌末端出现的底部反转信号,适合左侧交易。风险较高但利润空间大",
    source: "czsc.signals",
    example: "30分钟_D1B_BUY1V221126_一买_任意_任意_0"
  },
  { 
    name: "cxt_first_sell_V221126", 
    category: "chanlun", 
    display_name: "缠论一卖", 
    description: "第一类卖点信号。趋势上涨末端出现的顶部反转信号,适合左侧平仓或做空",
    source: "czsc.signals",
    example: "30分钟_D1B_SELL1V221126_一卖_任意_任意_0"
  },
  { 
    name: "cxt_second_bs_V230320", 
    category: "chanlun", 
    display_name: "二买二卖辅助(均线)", 
    description: "带均线确认的第二类买卖点。在一买/一卖后的回拉确认点,比一买一卖更安全",
    source: "czsc.signals",
    example: "30分钟_D1#SMA#20_BS2辅助V230320_二买_任意_任意_0"
  },
  { 
    name: "cxt_bi_end_V230224", 
    category: "chanlun", 
    display_name: "笔结束辅助(量价)", 
    description: "量价配合判断笔是否结束。通过成交量和价格的关系来确认当前笔是否即将结束,辅助平仓决策",
    source: "czsc.signals",
    example: "30分钟_D1_BE辅助V230224_向下_任意_任意_0"
  },
  { 
    name: "bar_zdt_V230331", 
    category: "chanlun", 
    display_name: "涨跌停识别", 
    description: "识别涨停/跌停状态。用于过滤涨停时不开多、跌停时不开空,避免追高风险",
    source: "czsc.signals",
    example: "30分钟_D1_涨跌停V230331_涨停_任意_任意_0"
  },
  // 均线信号
  { 
    name: "tas_ma_base_V221101", 
    category: "ma", 
    display_name: "单均线多空", 
    description: "单均线判断多空方向。价格在均线上方为多头,下方为空头。可判断均线方向(向上/向下)",
    source: "czsc.signals",
    example: "日线_D1SMA#5_分类V221101_多头_向上_任意_0"
  },
  { 
    name: "tas_double_ma_V221203", 
    category: "ma", 
    display_name: "双均线交叉", 
    description: "双均线金叉/死叉信号。短期均线上穿长期均线为金叉(做多),下穿为死叉(平仓/做空)",
    source: "czsc.signals",
    example: "日线_D1T5#SMA#5#20_JX辅助V221203_多头_任意_任意_0"
  },
  { 
    name: "tas_ma_system_V230513", 
    category: "ma", 
    display_name: "均线系统排列", 
    description: "多根均线排列判断趋势。多头排列(短>中>长)为上涨趋势,空头排列为下跌趋势",
    source: "czsc.signals",
    example: "日线_D1SMA5#10#20#60_均线系统V230513_多头排列_任意_任意_0"
  },
  // 量价信号
  { 
    name: "tas_macd_base_V221028", 
    category: "volume", 
    display_name: "MACD多空", 
    description: "MACD指标判断多空方向。DIF>DEA为多头市场,DIF<DEA为空头市场。可判断DIF/DEA/MACD柱",
    source: "czsc.signals",
    example: "30分钟_D1MACD12#26#9_DIF_BS辅助V221028_多头_任意_任意_0"
  },
  { 
    name: "tas_atr_V230630", 
    category: "volume", 
    display_name: "ATR波动率", 
    description: "ATR波动率分层信号。判断当前市场波动是高/中/低,高波动适合趋势策略,低波动适合震荡策略",
    source: "czsc.signals",
    example: "30分钟_D1ATR14_波动V230630_高波动_任意_任意_0"
  },
  { 
    name: "vol_single_ma_V230214", 
    category: "volume", 
    display_name: "单均量多空", 
    description: "成交量与均量比较判断放量/缩量。放量突破确认趋势有效,缩量回调表示支撑有效",
    source: "czsc.signals",
    example: "30分钟_D1VOL#SMA#20_分类V230214_放量_任意_任意_0"
  },
  // 形态信号
  { 
    name: "tas_macd_bc_V221201", 
    category: "pattern", 
    display_name: "MACD背驰", 
    description: "MACD背驰辅助信号。价格创新高但MACD未创新高为顶背驰(做空),价格创新低但MACD未创新低为底背驰(做多)",
    source: "czsc.signals",
    example: "30分钟_D1N5M3#MACD12#26#9_BCV221201_底背驰_任意_任意_0"
  },
  { 
    name: "tas_rsi_base_V230227", 
    category: "pattern", 
    display_name: "RSI超买超卖", 
    description: "RSI相对强弱指标。RSI>70超买区(可能回调),RSI<30超卖区(可能反弹)。判断方向(向上/向下)",
    source: "czsc.signals",
    example: "30分钟_D1T70RSI14_RSI辅助V230227_超买_向上_任意_0"
  },
  { 
    name: "tas_kdj_base_V221101", 
    category: "pattern", 
    display_name: "KDJ指标", 
    description: "KDJ随机指标辅助信号。K/D/J值判断超买超卖和交叉信号。金叉做多,死叉平仓",
    source: "czsc.signals",
    example: "30分钟_D1K#KDJ9#3#3_KDJ辅助V221101_超买_任意_任意_0"
  },
  { 
    name: "tas_boll_power_V221112", 
    category: "pattern", 
    display_name: "布林带强弱", 
    description: "布林带强弱分层。极强/强/弱/极弱四个层级,判断趋势强度。极强时追多,极弱时做空",
    source: "czsc.signals",
    example: "30分钟_D1BOLL20_强弱V221112_极强_任意_任意_0"
  },
];

export const mockPositions: MockPosition[] = [
  { id: "p-001", symbol: "000001.XSHE", direction: "long", volume: 500, avg_price: 12.35, unrealized_pnl: 287.50 },
  { id: "p-002", symbol: "600519.XSHG", direction: "long", volume: 100, avg_price: 1680.20, unrealized_pnl: -1520.00 },
  { id: "p-003", symbol: "300750.XSHE", direction: "long", volume: 300, avg_price: 215.60, unrealized_pnl: 1248.00 },
];

export const mockOrders: MockOrder[] = [
  { id: "o-001", symbol: "000001.XSHE", direction: "buy", volume: 500, price: 12.35, status: "filled", created_at: "2026-05-25 09:35:12" },
  { id: "o-002", symbol: "600519.XSHG", direction: "buy", volume: 100, price: 1680.20, status: "filled", created_at: "2026-05-25 10:02:33" },
  { id: "o-003", symbol: "300750.XSHE", direction: "buy", volume: 300, price: 215.60, status: "filled", created_at: "2026-05-25 10:15:45" },
  { id: "o-004", symbol: "000001.XSHE", direction: "sell", volume: 200, price: 12.85, status: "pending", created_at: "2026-05-25 14:22:00" },
];

export const mockBacktestResult: MockBacktestResult = {
  annual_return: 23.67,
  sharpe_ratio: 1.82,
  max_drawdown: -12.35,
  win_rate: 58.33,
  total_trades: 48,
  profit_factor: 2.15,
};

export const mockDashboardStats = {
  strategy_count: 4,
  backtest_count: 12,
  trade_accounts: 2,
  today_pnl: 135.50,
  today_pnl_pct: 0.87,
};
