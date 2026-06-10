"""回测相关 Pydantic 模型"""

from __future__ import annotations

from pydantic import BaseModel


class BacktestRequest(BaseModel):
    symbol: str = "000001.XSHE"
    freq: str = "30分钟"
    sdt: str = "2025-01-01"
    edt: str = "2026-01-01"
    fee_rate: float = 0.0002


class BacktestResponse(BaseModel):
    job_id: str
    status: str
    stats: dict = {}
    result_ref: str | None = None
