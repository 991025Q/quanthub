# CZSC 信号函数目录

> 自动生成自 `czsc.signals.list_signal_names()`，按类别分组。
> 
> 信号名称格式：`{freq}_{周期}[_{MA类型}#{MA周期}]_{信号名}V{版本}_{状态1}_{状态2}_{状态3}_{序号}`

## 信号名称规范

```
{freq}_{周期}#{指标}#{参数}_{信号函数名}V{版本号}_{信号值1}_{信号值2}_{信号值3}_{序号}
```

示例：
- `30分钟_D1_表里关系V230101_向上_任意_任意_0` — 30分钟笔向上
- `30分钟_D1#SMA#34_BS3辅助V230318_三买_任意_任意_0` — 30分钟三买（SMA34辅助）

## 缠论结构信号 (chanlun)

| 信号名 | 说明 | 参数 | 示例信号值 |
|--------|------|------|-----------|
| `表里关系V230101` | 笔方向判断 | freq, D1 | 向上 / 向下 |
| `三买辅助V230228` | 第三类买点识别 | freq, D1 | 三买 / 其他 |
| `BS3辅助V230318` | 三买三卖辅助确认 | freq, D1, MA类型, MA周期 | 三买 / 三卖 / 其他 |
| `BS3辅助V230319` | 三买三卖（均线新高版） | freq, D1, MA类型, MA周期 | 三买 / 三卖 / 均线新高 |
| `涨跌停V230331` | 涨跌停状态检测 | freq, D1 | 涨停 / 跌停 / 任意 |

### 常用缠论信号组合

```python
# 三买开多 + 涨停过滤
signals_all = ["30分钟_D1_三买辅助V230228_三买_任意_任意_0"]
signals_not = ["30分钟_D1_涨跌停V230331_涨停_任意_任意_0"]

# 笔方向平仓
signals_all = ["30分钟_D1_表里关系V230101_向下_任意_任意_0"]
```

## 均线信号 (ma)

| 信号名 | 说明 | 参数 |
|--------|------|------|
| `均线交叉V230101` | 均线交叉检测 | freq, D1, MA类型, MA周期 |

### 均线交叉示例

```python
# 金叉开多
SIG_MA_GOLDEN = "日线_D1#SMA#5_均线交叉V230101_金叉_任意_任意_0"

# 死叉平多
SIG_MA_DEAD = "日线_D1#SMA#5_均线交叉V230101_死叉_任意_任意_0"
```

## 量价信号 (volume)

| 信号名 | 说明 | 参数 |
|--------|------|------|
| `量比V230101` | 量比状态 | freq, D1 |

## 如何查询可用信号

### Python 代码

```python
from czsc import signals

# 列出所有信号名
all_names = signals.list_signal_names()
print(f"共 {len(all_names)} 个信号")

# 按关键词筛选
chan_signals = [n for n in all_names if "三买" in n or "BS3" in n]
print(chan_signals)

# 查看信号模板
template = signals.get_signal_template("cxt_third_bs_V230318")
print(template)
```

### 信号参数说明

| 参数 | 说明 | 可选值 |
|------|------|--------|
| freq | K线周期 | 1分钟/5分钟/15分钟/30分钟/60分钟/日线/周线/月线 |
| D1 | 第一层级别 | D1 (固定) |
| MA类型 | 均线类型 | SMA / EMA / WMA / DEMA / TEMA / KAMA |
| MA周期 | 均线参数 | 5 / 10 / 20 / 34 / 55 / 89 等 |

## 在策略中使用信号

```python
from czsc import CzscStrategyBase, Position, Event

class MyStrategy(CzscStrategyBase):
    @property
    def positions(self):
        return [Position(
            name="my_position",
            symbol=self.symbol,
            opens=[Event.load({
                "name": "开多",
                "operate": "开多",
                "signals_all": ["30分钟_D1_三买辅助V230228_三买_任意_任意_0"],
                "signals_not": ["30分钟_D1_涨跌停V230331_涨停_任意_任意_0"],
            })],
            exits=[Event.load({
                "name": "平多",
                "operate": "平多",
                "signals_all": ["30分钟_D1_表里关系V230101_向下_任意_任意_0"],
            })],
            interval=3600 * 4,
            timeout=16 * 30,
            stop_loss=300,
            t0=False,
        )]
```
