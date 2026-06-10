"""策略相关 Pydantic 模型"""

from __future__ import annotations

from pydantic import BaseModel


class StrategyCreate(BaseModel):
    name: str
    description: str | None = None
    code: str
    config: dict = {}


class StrategyUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    code: str | None = None
    config: dict | None = None


class StrategyResponse(BaseModel):
    id: str
    name: str
    description: str | None
    code: str
    status: str
    publish_target: str | None
    version: int
    config: dict

    class Config:
        from_attributes = True


class ValidateRequest(BaseModel):
    code: str | None = None  # 不传则校验已保存的代码


class ValidateResponse(BaseModel):
    is_valid: bool
    errors: list[str] = []
    signals_used: list[str] = []


class NLStrategyRequest(BaseModel):
    description: str
    freq: str = "30分钟"
    extra_context: str | None = None


class NLStrategyResponse(BaseModel):
    code: str
    explanation: str
    signals_used: list[str]


class ChatRequest(BaseModel):
    code: str = ""
    message: str


class ExplainResponse(BaseModel):
    code: str
    explanation: str
    signals_used: list[str] = []
