"""用户等级配额配置

等级体系：
- free:     免费用户，AI 不可用，回测 5次/天
- verified: 实名用户，AI 3次/月，回测 10次/天
- vip1:     VIP1，AI 10次/月，回测 50次/天
- vip2:     VIP2，AI 50次/月，回测 200次/天
- vip3:     VIP3，AI 无限，回测 无限
"""

from __future__ import annotations

from dataclasses import dataclass

# AI 额度 = -1 表示无限
# 回测额度 = -1 表示无限

@dataclass(frozen=True)
class LevelQuota:
    """等级配额定义"""
    label: str           # 显示名称
    ai_enabled: bool     # 是否可以使用 AI 编写策略
    ai_credits: int      # 每月 AI 次数（-1=无限）
    backtests_per_day: int  # 每日回测次数（-1=无限）
    max_strategies: int  # 最大策略数量
    priority_support: bool  # 优先支持


LEVEL_QUOTAS: dict[str, LevelQuota] = {
    "free": LevelQuota(
        label="免费用户",
        ai_enabled=False,
        ai_credits=0,
        backtests_per_day=5,
        max_strategies=3,
        priority_support=False,
    ),
    "verified": LevelQuota(
        label="实名用户",
        ai_enabled=True,
        ai_credits=3,
        backtests_per_day=10,
        max_strategies=5,
        priority_support=False,
    ),
    "vip1": LevelQuota(
        label="VIP1",
        ai_enabled=True,
        ai_credits=10,
        backtests_per_day=50,
        max_strategies=20,
        priority_support=False,
    ),
    "vip2": LevelQuota(
        label="VIP2",
        ai_enabled=True,
        ai_credits=50,
        backtests_per_day=200,
        max_strategies=50,
        priority_support=True,
    ),
    "vip3": LevelQuota(
        label="VIP3",
        ai_enabled=True,
        ai_credits=-1,   # 无限
        backtests_per_day=-1,  # 无限
        max_strategies=999,
        priority_support=True,
    ),
}

# 有效等级列表（按级别排序）
VALID_LEVELS = ["free", "verified", "vip1", "vip2", "vip3"]


def get_quota(level: str) -> LevelQuota:
    """获取等级配额，未知等级降级为 free"""
    return LEVEL_QUOTAS.get(level, LEVEL_QUOTAS["free"])


def is_ai_available(level: str, is_verified: bool, ai_credits_used: int) -> tuple[bool, str]:
    """检查用户是否可以使用 AI

    Returns:
        (可用, 原因说明)
    """
    quota = get_quota(level)

    if not is_verified:
        return False, "请先完成实名认证才能使用 AI 编写策略"

    if not quota.ai_enabled:
        return False, f"当前等级「{quota.label}」不支持 AI 编写策略，请升级或完成实名认证"

    # 无限额度
    if quota.ai_credits == -1:
        return True, "无限额度"

    remaining = quota.ai_credits - ai_credits_used
    if remaining <= 0:
        return False, f"本月 AI 额度已用完（{quota.ai_credits}次/月），请下月再试或升级等级"

    return True, f"本月剩余 {remaining}/{quota.ai_credits} 次"


def is_backtest_available(level: str, backtest_count_today: int) -> tuple[bool, str]:
    """检查用户是否可以执行回测

    Returns:
        (可用, 原因说明)
    """
    quota = get_quota(level)

    if quota.backtests_per_day == -1:
        return True, "无限回测"

    remaining = quota.backtests_per_day - backtest_count_today
    if remaining <= 0:
        return False, f"今日回测次数已用完（{quota.backtests_per_day}次/天），请明天再试或升级等级"

    return True, f"今日剩余 {remaining}/{quota.backtests_per_day} 次"
