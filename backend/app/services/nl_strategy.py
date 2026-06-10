"""自然语言策略生成服务 — 基于 CZSC Skills 的 strategy_prompt"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import sys
from pathlib import Path

logger = logging.getLogger(__name__)

# 添加 backend 目录到 path，以便导入 strategy_prompt
# 当前文件: backend/app/services/nl_strategy.py
# strategy_prompt.py: backend/strategy_prompt.py
# 需要向上 2 级到 backend 目录
PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from app.config import get_settings
from app.services.signal_service import get_all_signals_cached, get_signal_example

settings = get_settings()


class NLStrategyService:
    """自然语言 → 策略代码

    流程：
    1. 用户输入自然语言描述
    2. 构造 prompt（使用 strategy_prompt.py 的 SYSTEM_PROMPT，包含 CZSC Skills 信号参考）
    3. 调用 LLM API 生成代码
    4. 语法校验 + 信号有效性验证
    5. 返回代码 + 解释
    """

    def __init__(self):
        self.api_key = settings.LLM_API_KEY
        self.base_url = settings.LLM_BASE_URL
        self.model = settings.LLM_MODEL

    async def _call_llm(self, messages: list[dict]) -> dict:
        """在线程池中调用 LLM，带超时保护，避免阻塞事件循环"""
        from app.services.hybrid_client import get_client

        client = get_client()
        return await asyncio.wait_for(
            asyncio.to_thread(
                client.chat,
                model="dashscope",
                messages=messages,
                backend_preference="dashscope",
                temperature=0.7,
                max_tokens=4096,
            ),
            timeout=180.0,  # 3 分钟超时
        )

    async def generate(self, description: str, freq: str = "30分钟") -> dict:
        """生成策略代码"""
        try:
            from strategy_prompt import build_messages
            messages = build_messages(description)
            
            response = await self._call_llm(messages)
            
            content = response.get("message", {}).get("content", "")

            # 尝试提取 JSON
            result = _extract_strategy_json(content)

            if result:
                # 验证信号有效性
                signals_used = _extract_signals_from_code(result.get("code", ""))
                result["signals_used"] = signals_used
                result["explanation"] = result.get("description", "")
                return result

            # JSON 提取失败，返回原始内容
            return {
                "code": content,
                "explanation": "AI 生成的原始回复（非 JSON 格式）",
                "signals_used": [],
                "raw_response": content,
            }

        except asyncio.TimeoutError:
            return {
                "code": "# AI 生成超时：Dashscope API 在 3 分钟内未返回结果",
                "explanation": "生成超时，请简化策略描述后重试，或检查 Dashscope API 额度",
                "signals_used": [],
                "error": "LLM 调用超时（180秒）",
            }
        except Exception as e:
            return {
                "code": f"# AI 服务调用失败: {e}",
                "explanation": f"生成失败: {e}",
                "signals_used": [],
                "error": str(e),
            }

    async def modify(self, current_code: str, modify_request: str) -> dict:
        """修改已有策略"""
        # 调用 LLM（在线程池中执行，避免阻塞事件循环）
        try:
            from strategy_prompt import build_modify_messages

            messages = build_modify_messages(current_code, modify_request)
            response = await self._call_llm(messages)
        except asyncio.TimeoutError:
            return {
                "code": current_code,
                "explanation": "修改超时，请简化修改请求后重试",
                "error": "LLM 调用超时（180秒）",
            }
        except Exception as e:
            return {
                "code": current_code,
                "explanation": f"修改失败: {e}",
                "error": str(e),
            }

        content = response.get("message", {}).get("content", "")
        result = _extract_strategy_json(content)

        if result:
            result["signals_used"] = _extract_signals_from_code(result.get("code", ""))
            return result

        return {
            "code": content,
            "explanation": "AI 生成的原始回复（非 JSON 格式）",
            "raw_response": content,
        }

    async def explain(self, code: str, question: str) -> dict:
        """解释策略代码或信号含义（纯文本问答，不修改代码）"""
        try:
            from strategy_prompt import build_explain_messages

            messages = build_explain_messages(code, question)
            response = await self._call_llm(messages)
        except asyncio.TimeoutError:
            return {
                "code": code,
                "explanation": "解释超时，请简化问题后重试",
                "signals_used": [],
                "error": "LLM 调用超时（180秒）",
            }
        except Exception as e:
            return {
                "code": code,
                "explanation": f"解释失败: {e}",
                "signals_used": [],
                "error": str(e),
            }

        content = response.get("message", {}).get("content", "")
        return {
            "code": code,
            "explanation": content,
            "signals_used": [],
        }

    async def explain_stream(self, code: str, question: str):
        """流式解释策略代码或信号含义 - 生成器，逐 chunk 产出文本"""
        try:
            from strategy_prompt import build_explain_messages

            messages = build_explain_messages(code, question)

            from app.services.hybrid_client import get_client
            client = get_client()

            # 在线程池中调用同步的流式 API
            def _get_stream():
                return client.chat(
                    model="dashscope",
                    messages=messages,
                    backend_preference="dashscope",
                    temperature=0.7,
                    max_tokens=4096,
                    stream=True,
                )

            stream = await asyncio.to_thread(_get_stream)

            for chunk in stream:
                content = chunk.get("message", {}).get("content", "")
                if content:
                    yield content

        except asyncio.TimeoutError:
            yield f"\n\n[解释超时，请简化问题后重试]"
        except Exception as e:
            yield f"\n\n[解释失败: {e}]"


def _extract_strategy_json(content: str) -> dict | None:
    """从 AI 回复内容中提取策略 JSON"""
    try:
        json_start = content.find("{")
        json_end = content.rfind("}") + 1
        if json_start >= 0 and json_end > json_start:
            json_str = content[json_start:json_end]
            parsed = json.loads(json_str)
            if "code" in parsed:
                return parsed
    except json.JSONDecodeError:
        pass
    return None


def _extract_signals_from_code(code: str) -> list[str]:
    """从策略代码中提取使用的信号字符串"""
    # 匹配信号字符串格式: 7段式 freq_k2_k3_v1_v2_v3_score
    pattern = r'"([\w]+_[\w#]+_[\w]+V[\d]+_[\w]+_[\w]+_[\w]+_[\d]+)"'
    matches = re.findall(pattern, code)
    return matches


def get_signal_reference_for_prompt() -> str:
    """获取信号参考信息，用于增强 prompt（基于 CZSC Skills）"""
    all_signals = get_all_signals_cached()

    # 按模块分组
    modules = {}
    for s in all_signals:
        module = s.get("module", "other")
        if module not in modules:
            modules[module] = []
        modules[module].append(s)

    lines = ["# 可用信号函数参考（来源: CZSC Skills - 232个信号函数）"]
    for module_name, signals in sorted(modules.items()):
        category = signals[0].get("category", "other") if signals else "other"
        lines.append(f"\n## {module_name}模块 ({category}类 - {len(signals)}个信号)")
        lines.append("| 信号名 | 参数模板 | 说明 |")
        lines.append("|--------|----------|------|")
        for s in signals[:10]:  # 每模块最多显示10个（避免过长）
            name = s["name"]
            template = s.get("param_template", "")
            desc = s.get("description", "")
            lines.append(f"| {name} | {template} | {desc} |")
        if len(signals) > 10:
            lines.append(f"| ... | ... | (还有 {len(signals) - 10} 个信号) |")

    return "\n".join(lines)