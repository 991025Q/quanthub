"""信号服务层 — 提供 CZSC 信号函数查询和缓存"""

from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# 内置信号库（当 czsc 未安装时使用）
# 格式: {name, module, category, param_template, description}
# ---------------------------------------------------------------------------

_BUILTIN_SIGNALS: list[dict] = [
    # ===== 缠论结构信号 (chanlun) =====
    {"name": "cxt_bi_base_V230228", "module": "czsc.signals", "category": "chanlun",
     "param_template": "{freq}_{D1}_笔基础V230228_{v1}_{v2}_{v3}_0",
     "description": "判断当前笔的基础状态(向上/向下),用于识别趋势方向"},
    {"name": "cxt_bi_status_V230101", "module": "czsc.signals", "category": "chanlun",
     "param_template": "{freq}_{D1}_表里关系V230101_{v1}_{v2}_{v3}_0",
     "description": "笔方向判断(表里关系),向上/向下"},
    {"name": "cxt_third_bs_V230228", "module": "czsc.signals", "category": "chanlun",
     "param_template": "{freq}_{D1}_三买辅助V230228_{v1}_{v2}_{v3}_0",
     "description": "第三类买点识别,三买/其他"},
    {"name": "cxt_third_bs_V230318", "module": "czsc.signals", "category": "chanlun",
     "param_template": "{freq}_{D1}#{MA}#{period}_BS3辅助V230318_{v1}_{v2}_{v3}_0",
     "description": "三买三卖辅助确认(均线版),三买/三卖/其他"},
    {"name": "cxt_third_bs_V230319", "module": "czsc.signals", "category": "chanlun",
     "param_template": "{freq}_{D1}#{MA}#{period}_BS3辅助V230319_{v1}_{v2}_{v3}_0",
     "description": "三买三卖(均线新高版),三买/三卖/均线新高"},
    {"name": "cxt_third_bs_V230320", "module": "czsc.signals", "category": "chanlun",
     "param_template": "{freq}_{D1}#{MA}#{period}_BS2辅助V230320_{v1}_{v2}_{v3}_0",
     "description": "BS2辅助信号,三买/三卖/其他"},
    {"name": "cxt_first_bs_V240221", "module": "czsc.signals", "category": "chanlun",
     "param_template": "{freq}_{D1}_一买辅助V240221_{v1}_{v2}_{v3}_0",
     "description": "第一类买点识别,用于捕捉趋势反转"},
    {"name": "cxt_second_bs_V240221", "module": "czsc.signals", "category": "chanlun",
     "param_template": "{freq}_{D1}_二买辅助V240221_{v1}_{v2}_{v3}_0",
     "description": "第二类买点识别,确认趋势延续"},
    {"name": "cxt_limit_up_down_V230331", "module": "czsc.signals", "category": "chanlun",
     "param_template": "{freq}_{D1}_涨跌停V230331_{v1}_{v2}_{v3}_0",
     "description": "涨跌停状态检测,涨停/跌停/任意"},
    {"name": "cxt_bi_divergence_V240101", "module": "czsc.signals", "category": "chanlun",
     "param_template": "{freq}_{D1}_笔背离V240101_{v1}_{v2}_{v3}_0",
     "description": "笔背离信号,底背离/顶背离/无背离"},

    # ===== 均线信号 (ma) =====
    {"name": "cxt_ma_cross_V230101", "module": "czsc.signals", "category": "ma",
     "param_template": "{freq}_{D1}#{MA}#{period}_均线交叉V230101_{v1}_{v2}_{v3}_0",
     "description": "均线交叉检测,金叉/死叉/无交叉"},
    {"name": "cxt_ma_trend_V230101", "module": "czsc.signals", "category": "ma",
     "param_template": "{freq}_{D1}#{MA}#{period}_均线趋势V230101_{v1}_{v2}_{v3}_0",
     "description": "均线趋势方向判断,多头/空头/震荡"},
    {"name": "cxt_ma_slope_V230101", "module": "czsc.signals", "category": "ma",
     "param_template": "{freq}_{D1}#{MA}#{period}_均线斜率V230101_{v1}_{v2}_{v3}_0",
     "description": "均线斜率变化,加速/减速/平稳"},

    # ===== 趋势信号 (trend) =====
    {"name": "cxt_trend_follow_V240526", "module": "czsc.signals", "category": "trend",
     "param_template": "{freq}_趋势跟随_BS辅助V240526_{v1}_{v2}_{v3}_0",
     "description": "趋势跟随辅助信号,多头/空头/震荡"},
    {"name": "cxt_kcatr_V230823", "module": "czsc.signals", "category": "trend",
     "param_template": "{freq}_{D1}N{n}M{m}T{t}_KCATR多空V230823_{v1}_{v2}_{v3}_0",
     "description": "KCATR多空信号,多头/空头/震荡"},
    {"name": "cxt_atr_volatility_V230630", "module": "czsc.signals", "category": "trend",
     "param_template": "{freq}_{D1}ATR{n}_波动V230630_{v1}_{v2}_{v3}_0",
     "description": "ATR波动率状态,高波动/低波动/正常"},

    # ===== 量价信号 (volume) =====
    {"name": "cxt_volume_ratio_V230101", "module": "czsc.signals", "category": "volume",
     "param_template": "{freq}_{D1}_量比V230101_{v1}_{v2}_{v3}_0",
     "description": "量比状态,放量/缩量/正常"},
    {"name": "cxt_volume_price_V230101", "module": "czsc.signals", "category": "volume",
     "param_template": "{freq}_{D1}_量价V230101_{v1}_{v2}_{v3}_0",
     "description": "量价配合关系,量价齐升/量价背离/正常"},

    # ===== MACD 信号 (macd) =====
    {"name": "cxt_macd_cross_V240101", "module": "czsc.signals", "category": "macd",
     "param_template": "{freq}_{D1}_MACD交叉V240101_{v1}_{v2}_{v3}_0",
     "description": "MACD金叉死叉,金叉/死叉/无"},
    {"name": "cxt_macd_divergence_V240101", "module": "czsc.signals", "category": "macd",
     "param_template": "{freq}_{D1}_MACD背离V240101_{v1}_{v2}_{v3}_0",
     "description": "MACD背离检测,底背离/顶背离/无背离"},
    {"name": "cxt_macd_trend_V240101", "module": "czsc.signals", "category": "macd",
     "param_template": "{freq}_{D1}_MACD趋势V240101_{v1}_{v2}_{v3}_0",
     "description": "MACD趋势状态,多头/空头/震荡"},

    # ===== RSI 信号 (rsi) =====
    {"name": "cxt_rsi_level_V240101", "module": "czsc.signals", "category": "rsi",
     "param_template": "{freq}_{D1}_RSI水平V240101_{v1}_{v2}_{v3}_0",
     "description": "RSI超买超卖,超买/超卖/正常"},

    # ===== 布林带信号 (boll) =====
    {"name": "cxt_boll_band_V240101", "module": "czsc.signals", "category": "boll",
     "param_template": "{freq}_{D1}_布林带V240101_{v1}_{v2}_{v3}_0",
     "description": "布林带位置,上轨突破/下轨突破/中轨/正常"},
]

# 缓存
_signal_cache: Optional[list[dict]] = None


def get_all_signals_cached() -> list[dict]:
    """获取所有信号函数列表（带缓存）

    优先从 czsc.signals 加载，不可用时使用内置信号库。

    Returns:
        list[dict]: 信号列表，每个 dict 包含 name, module, category, param_template, description
    """
    global _signal_cache

    if _signal_cache is not None:
        return _signal_cache

    # 尝试从 czsc 加载
    try:
        from czsc import signals
        all_names = signals.list_signal_names()
        logger.info(f"从 czsc.signals 加载了 {len(all_names)} 个信号")

        result = []
        for name in all_names:
            # 推断类别
            category = _infer_category(name)
            result.append({
                "name": name,
                "module": "czsc.signals",
                "category": category,
                "param_template": f"{{freq}}_{{params}}_{name}_{{v1}}_{{v2}}_{{v3}}_0",
                "description": f"CZSC 信号: {name}",
            })
        _signal_cache = result
        return result
    except ImportError:
        logger.warning("czsc 未安装，使用内置信号库")
    except Exception as e:
        logger.warning(f"从 czsc 加载信号失败: {e}，使用内置信号库")

    _signal_cache = _BUILTIN_SIGNALS
    return _BUILTIN_SIGNALS


def get_signal_example(signal_name: str, freq: str = "30分钟") -> str:
    """获取某个信号的示例字符串

    Args:
        signal_name: 信号函数名（如 cxt_bi_status_V230101）
        freq: K线周期（默认 30分钟）

    Returns:
        str: 示例信号字符串，如 "30分钟_D1_表里关系V230101_向上_任意_任意_0"
    """
    examples = {
        "cxt_bi_base_V230228": f"{freq}_D1_笔基础V230228_向上_任意_任意_0",
        "cxt_bi_status_V230101": f"{freq}_D1_表里关系V230101_向上_任意_任意_0",
        "cxt_third_bs_V230228": f"{freq}_D1_三买辅助V230228_三买_任意_任意_0",
        "cxt_third_bs_V230318": f"{freq}_D1#SMA#34_BS3辅助V230318_三买_任意_任意_0",
        "cxt_third_bs_V230319": f"{freq}_D1#SMA#34_BS3辅助V230319_三买_任意_任意_0",
        "cxt_first_bs_V240221": f"{freq}_D1_一买辅助V240221_一买_任意_任意_0",
        "cxt_second_bs_V240221": f"{freq}_D1_二买辅助V240221_二买_任意_任意_0",
        "cxt_limit_up_down_V230331": f"{freq}_D1_涨跌停V230331_涨停_任意_任意_0",
        "cxt_bi_divergence_V240101": f"{freq}_D1_笔背离V240101_底背离_任意_任意_0",
        "cxt_ma_cross_V230101": f"{freq}_D1#SMA#5_均线交叉V230101_金叉_任意_任意_0",
        "cxt_ma_trend_V230101": f"{freq}_D1#SMA#34_均线趋势V230101_多头_任意_任意_0",
        "cxt_trend_follow_V240526": f"{freq}_趋势跟随_BS辅助V240526_多头_任意_任意_0",
        "cxt_kcatr_V230823": f"{freq}_D1N10M3T30_KCATR多空V230823_多头_任意_任意_0",
        "cxt_atr_volatility_V230630": f"{freq}_D1ATR14_波动V230630_高波动_任意_任意_0",
        "cxt_volume_ratio_V230101": f"{freq}_D1_量比V230101_放量_任意_任意_0",
        "cxt_macd_cross_V240101": f"{freq}_D1_MACD交叉V240101_金叉_任意_任意_0",
        "cxt_macd_divergence_V240101": f"{freq}_D1_MACD背离V240101_底背离_任意_任意_0",
        "cxt_macd_trend_V240101": f"{freq}_D1_MACD趋势V240101_多头_任意_任意_0",
        "cxt_rsi_level_V240101": f"{freq}_D1_RSI水平V240101_超卖_任意_任意_0",
        "cxt_boll_band_V240101": f"{freq}_D1_布林带V240101_下轨突破_任意_任意_0",
    }
    return examples.get(signal_name, f"{freq}_未知信号_{signal_name}_任意_任意_0")


def _infer_category(name: str) -> str:
    """根据信号名推断类别"""
    name_lower = name.lower()
    if any(kw in name_lower for kw in ("bi", "bs", "三买", "三卖", "一买", "一卖", "二买", "二卖",
                                         "表里", "分型", "段", "笔", "chan", "czsc", "中枢", "线段")):
        return "chanlun"
    if any(kw in name_lower for kw in ("ma", "均线", "sma", "ema", "wma", "moving_average")):
        return "ma"
    if any(kw in name_lower for kw in ("macd", "dif", "dea")):
        return "macd"
    if any(kw in name_lower for kw in ("rsi",)):
        return "rsi"
    if any(kw in name_lower for kw in ("volume", "量", "vol")):
        return "volume"
    if any(kw in name_lower for kw in ("boll", "布林", "band")):
        return "boll"
    if any(kw in name_lower for kw in ("trend", "趋势", "kcatr", "atr", "adx", "多空")):
        return "trend"
    return "other"


def invalidate_cache():
    """清除缓存（用于信号更新后重新加载）"""
    global _signal_cache
    _signal_cache = None