"""AI 策略生成 API"""

from __future__ import annotations

import json
import logging
import traceback
from typing import Annotated, AsyncGenerator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from app.dependencies import get_current_user
from app.models.user import User
from app.schemas.strategy import (
    NLStrategyRequest,
    NLStrategyResponse,
    ChatRequest,
    ExplainResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


async def explain_stream_generator(code: str, question: str) -> AsyncGenerator[str, None]:
    """Generate SSE stream for AI explanation - real streaming from LLM"""
    try:
        from app.services.nl_strategy import NLStrategyService

        service = NLStrategyService()

        # Use the new streaming method - yields chunks as they arrive from LLM
        async for chunk in service.explain_stream(code=code, question=question):
            yield f"data: {json.dumps({'content': chunk}, ensure_ascii=False)}\n\n"

        # Send completion signal
        yield f"data: {json.dumps({'done': True})}\n\n"

    except Exception as e:
        logger.exception(f"解释请求异常: {e}")
        yield f"data: {json.dumps({'error': str(e)})}\n\n"
        yield f"data: {json.dumps({'done': True})}\n\n"



@router.post("/generate-strategy", response_model=NLStrategyResponse)
async def generate_strategy(
    req: NLStrategyRequest,
    _user: Annotated[User, Depends(get_current_user)],
):
    """自然语言生成策略 — 调用 LLM 生成 czsc 策略代码"""
    try:
        from app.services.nl_strategy import NLStrategyService

        service = NLStrategyService()
        result = await service.generate(description=req.description, freq=req.freq)
    except Exception as e:
        logger.exception(f"策略生成异常: {e}")
        return NLStrategyResponse(
            code="# AI 服务暂时不可用",
            explanation=f"AI 服务异常: {e}",
            signals_used=[],
        )

    if "error" in result:
        logger.error(f"AI 策略生成失败: {result['error']}")
        return NLStrategyResponse(
            code=result.get("code", "# 生成失败"),
            explanation=result.get("explanation", "AI 服务调用失败，请稍后重试"),
            signals_used=result.get("signals_used", []),
        )

    return NLStrategyResponse(
        code=result.get("code", ""),
        explanation=result.get("explanation", ""),
        signals_used=result.get("signals_used", []),
    )


@router.post("/chat", response_model=NLStrategyResponse)
async def chat_modify_strategy(
    req: ChatRequest,
    _user: Annotated[User, Depends(get_current_user)],
):
    """AI 对话修改策略代码"""

    if not req.code or not req.message:
        return NLStrategyResponse(
            code=req.code,
            explanation="缺少代码或修改请求",
            signals_used=[],
        )

    try:
        from app.services.nl_strategy import NLStrategyService

        service = NLStrategyService()
        result = await service.modify(current_code=req.code, modify_request=req.message)
    except Exception as e:
        logger.exception(f"修改请求异常: {e}")
        return NLStrategyResponse(
            code=req.code,
            explanation=f"AI 服务暂时不可用: {e}",
            signals_used=[],
        )

    if "error" in result:
        return NLStrategyResponse(
            code=result.get("code", req.code),
            explanation=result.get("explanation", f"修改失败: {result['error']}"),
            signals_used=result.get("signals_used", []),
        )

    return NLStrategyResponse(
        code=result.get("code", req.code),
        explanation=result.get("explanation", ""),
        signals_used=result.get("signals_used", []),
    )


@router.post("/explain")
async def explain_strategy(
    req: ChatRequest,
    _user: Annotated[User, Depends(get_current_user)],
):
    """AI 解释策略代码或信号含义（流式响应）"""

    if not req.message:
        return JSONResponse(
            status_code=400,
            content={"detail": "缺少问题内容"},
        )

    return StreamingResponse(
        explain_stream_generator(req.code, req.message),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )