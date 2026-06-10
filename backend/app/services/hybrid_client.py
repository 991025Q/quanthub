#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Hybrid LLM API 客户端模块

集成多个 LLM 后端：
- Ollama (本地/云端模型)
- Moark (OpenAI 兼容接口)
- Dashscope (阿里云百炼)

支持智能切换和容错机制。
"""

import json
import os
import requests
from typing import List, Dict, Callable, Any
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    import ollama
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False

try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False

# ---------------------------------------------------------------------------
# 从环境变量或配置文件加载设置
# ---------------------------------------------------------------------------

# 尝试从 .env 文件加载
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv 未安装时仅依赖环境变量

# 使用 Settings 获取配置（如果存在）
try:
    import sys
    import pathlib
    
    # 添加父目录到 path，以便导入 app.config
    current_dir = pathlib.Path(__file__).parent.parent
    parent_dir = current_dir.parent
    if str(parent_dir) not in sys.path:
        sys.path.insert(0, str(parent_dir))
    
    from app.config import get_settings
    settings = get_settings()
    
    CONFIG = {
        "ollama_host": settings.OLLAMA_HOST,
        "ollama_primary_model": settings.OLLAMA_PRIMARY_MODEL,
        "ollama_cloud_model": settings.OLLAMA_CLOUD_MODEL,
        "ollama_connect_timeout_seconds": settings.OLLAMA_CONNECT_TIMEOUT_SECONDS,
        "ollama_local_timeout_seconds": settings.OLLAMA_LOCAL_TIMEOUT_SECONDS,
        "ollama_cloud_timeout_seconds": settings.OLLAMA_CLOUD_TIMEOUT_SECONDS,
        "moark_api_key": settings.MOARK_API_KEY,
        "moark_api_url": settings.MOARK_API_URL,
        "moark_model": settings.MOARK_MODEL,
        "moark_enabled": settings.MOARK_ENABLED,
        "dashscope_api_key": settings.DASHSCOPE_API_KEY,
        "dashscope_api_url": settings.DASHSCOPE_API_URL,
        "dashscope_model": settings.DASHSCOPE_MODEL,
        "dashscope_enabled": settings.DASHSCOPE_ENABLED,
    }
except Exception:
    # 如果无法通过 Settings 获取，回退到 config.json 或环境变量
    try:
        with open('config.json', 'r', encoding='utf-8') as f:
            CONFIG = json.load(f)
    except Exception:
        CONFIG = {}

OLLAMA_PRIMARY_MODEL = CONFIG.get('ollama_primary_model', 'qwen3.5:4b')
OLLAMA_CLOUD_MODEL = CONFIG.get('ollama_cloud_model', OLLAMA_PRIMARY_MODEL)
MOARK_API_KEY = CONFIG.get('moark_api_key', '')
MOARK_API_URL = CONFIG.get('moark_api_url', 'https://api.moark.com/v1/chat/completions')
MOARK_MODEL = CONFIG.get('moark_model', 'gpt-4o-mini')
MOARK_ENABLED = CONFIG.get('moark_enabled', False)

# Dashscope 配置
DASHSCOPE_API_KEY = CONFIG.get('dashscope_api_key', os.getenv('DASHSCOPE_API_KEY', ''))
DASHSCOPE_API_URL = CONFIG.get('dashscope_api_url', 'https://dashscope.aliyuncs.com/compatible-mode/v1')
DASHSCOPE_MODEL = CONFIG.get('dashscope_model', 'qwen-plus')
DASHSCOPE_ENABLED = CONFIG.get('dashscope_enabled', bool(DASHSCOPE_API_KEY))

# 全局缓存 Dashscope OpenAI 客户端（启动时预创建，提高响应速度）
_dashscope_client = None

def _get_dashscope_client():
    """获取或创建 Dashscope OpenAI 客户端（启动时预创建）"""
    global _dashscope_client
    if _dashscope_client is None:
        if not OPENAI_AVAILABLE:
            raise RuntimeError("OpenAI SDK 未安装")
        _dashscope_client = OpenAI(  # type: ignore[name-defined]
            api_key=DASHSCOPE_API_KEY,
            base_url=DASHSCOPE_API_URL,
            timeout=180.0,
        )
        print(f"[Dashscope] OpenAI 客户端已初始化 (模型: {DASHSCOPE_MODEL})")
    return _dashscope_client


class HybridAPIClient:
    """Ollama 客户端：优先使用本地/可用的 Ollama 服务"""
    
    def __init__(self, ollama_host: str | None = None, **_ignored):
        self.ollama_host = ollama_host or "http://127.0.0.1:11434"
        self.ollama_connect_timeout_seconds = float(CONFIG.get("ollama_connect_timeout_seconds", 5.0))
        self.ollama_local_timeout_seconds = float(CONFIG.get("ollama_local_timeout_seconds", 60.0))
        self.ollama_cloud_timeout_seconds = float(CONFIG.get("ollama_cloud_timeout_seconds", 180.0))
        
        # 初始化Ollama客户端
        self.ollama_models = set()
        if OLLAMA_AVAILABLE:
            try:
                # 快速探测，避免在 Ollama 未启动/端口不可达时卡住应用启动
                probe_url = self.ollama_host.rstrip('/') + '/api/tags'
                probe_resp = requests.get(probe_url, timeout=3.0)
                probe_resp.raise_for_status()

                # 收集本地可用模型名（tag 原样 + 去掉 :latest 的简名）
                try:
                    tags_data = probe_resp.json() or {}
                    for m in tags_data.get("models", []) or []:
                        name = m.get("name") or m.get("model") or ""
                        if name:
                            self.ollama_models.add(name)
                            if name.endswith(":latest"):
                                self.ollama_models.add(name[:-len(":latest")])
                except Exception:
                    pass

                self.ollama_client = ollama.Client(host=self.ollama_host)
                self.ollama_available = True
                print(f"✅ Ollama服务已连接: {self.ollama_host} (本地模型数: {len(self.ollama_models)})")
                print(f"📋 本地可用模型: {', '.join(sorted(self.ollama_models))}")
            except Exception as e:
                self.ollama_available = False
                print(f"⚠️ Ollama服务不可用: {str(e)}")
        else:
            self.ollama_available = False
            print("⚠️ Ollama未安装")

    def has_ollama_model(self, model: str) -> bool:
        """判断Ollama是否可用指定模型（包含本地模型和 :cloud 云端模型）。

        - 本地模型：读取启动时缓存的 /api/tags 列表
        - 云端模型（如 kimi-k2.5:cloud）：通过 /api/show 实时探测，结果缓存
        """
        if not self.ollama_available or not model:
            return False
        if model in self.ollama_models:
            return True
        if f"{model}:latest" in self.ollama_models:
            return True

        # 云端模型通常不会出现在 /api/tags 中；只要 Ollama 服务可用且模型名
        # 符合 cloud 约定，就先认为可以尝试调用，实际失败后会在 chat() 中回退。
        if model.endswith(":cloud"):
            return True

        # 非本地模型：通过 /api/show 探测（云端模型不会出现在 /api/tags）
        if not hasattr(self, "_model_show_cache"):
            self._model_show_cache = {}
        if model in self._model_show_cache:
            return self._model_show_cache[model]

        try:
            show_url = self.ollama_host.rstrip('/') + '/api/show'
            resp = requests.post(show_url, json={"name": model}, timeout=3.0)
            ok = resp.status_code == 200
            self._model_show_cache[model] = ok
            if ok:
                # 缓存到集合，后续快速命中
                self.ollama_models.add(model)
            return ok
        except Exception:
            self._model_show_cache[model] = False
            return False

    def _resolve_ollama_model_name(self, model: str) -> str:
        """将别名模型名归一化为最终请求名。"""
        if model == "qwen3-max":
            return OLLAMA_PRIMARY_MODEL
        return model

    def _cloud_model_name(self, model: str) -> str:
        """返回配置的 cloud 回退模型。"""
        return OLLAMA_CLOUD_MODEL

    def _is_model_not_found_error(self, exc: Exception) -> bool:
        """判断异常是否属于模型未下载/未找到。"""
        text = str(exc).lower()
        return ("404" in text and "model" in text) or "model not found" in text or "not found" in text

    def _is_cloud_model(self, model: str) -> bool:
        """判断模型名是否为 cloud 模型。"""
        resolved = self._resolve_ollama_model_name(model)
        return bool(resolved) and resolved.endswith(":cloud")

    def _get_ollama_timeout_seconds(self, model: str, kwargs: dict) -> float:
        """根据模型类型与显式参数，计算 Ollama 请求超时。"""
        explicit_timeout = kwargs.pop("timeout", None)
        if explicit_timeout is not None:
            try:
                return float(explicit_timeout)
            except Exception:
                pass
        return self.ollama_cloud_timeout_seconds if self._is_cloud_model(model) else self.ollama_local_timeout_seconds
    
    def chat(self, model: str, messages: List[dict], stream: bool = False, **kwargs):
        """调用 LLM 生成回复（支持 dashscope/ollama/moark 后端）。"""

        backend_preference = str(kwargs.pop("backend_preference", "auto") or "auto").lower()
        if backend_preference not in {"auto", "ollama", "ollama_cloud", "moark", "dashscope"}:
            backend_preference = "auto"

        # ── 强制 Dashscope ────────────────────────────────────────────
        if backend_preference == "dashscope":
            if not DASHSCOPE_ENABLED or not DASHSCOPE_API_KEY:
                raise RuntimeError("Dashscope API 未启用或未配置 API Key")
            print(f"[API调用] 使用模型: {DASHSCOPE_MODEL} (后端: Dashscope)")
            # Handle streaming separately - don't call _ensure_message_format for generators
            response = self._chat_dashscope(model, messages, stream=stream, **kwargs)
            if stream and hasattr(response, '__iter__') and not isinstance(response, dict):
                return response  # Return generator as-is for streaming
            return self._ensure_message_format(response)

        # ── 强制 Moark ────────────────────────────────────────────────────
        if backend_preference == "moark":
            print(f"[API调用] 使用模型: {model} (后端: Moark)")
            return self._ensure_message_format(self._chat_moark(model, messages, **kwargs))

        # 强制 Ollama 云端模型
        if backend_preference == "ollama_cloud":
            if not self.ollama_available:
                raise RuntimeError("Ollama不可用：未安装/未启动/连接失败")
            cloud_model = self._cloud_model_name(model)
            if cloud_model:
                print(f"[API调用] 使用模型: {cloud_model} (后端: Ollama Cloud)")
                return self._ensure_message_format(self._chat_ollama(cloud_model, messages, **kwargs))
            raise RuntimeError("未配置Ollama云端模型")

        # ollama: 强制Ollama（本地+cloud回退）
        if backend_preference == "ollama":
            if not self.ollama_available:
                raise RuntimeError("Ollama不可用：未安装/未启动/连接失败")
            try:
                print(f"[API调用] 使用模型: {model} (后端: Ollama Local)")
                response = self._chat_ollama(model, messages, **kwargs)
                return self._ensure_message_format(response)
            except Exception as e:
                cloud_model = self._cloud_model_name(model)
                if cloud_model and cloud_model != self._resolve_ollama_model_name(model) and self._is_model_not_found_error(e):
                    print(f"⚠️ 本地模型不可用，回退到 Ollama cloud 模型: {cloud_model}")
                    print(f"[API调用] 使用模型: {cloud_model} (后端: Ollama Cloud)")
                    response = self._chat_ollama(cloud_model, messages, **kwargs)
                    return self._ensure_message_format(response)
                raise RuntimeError(f"Ollama调用失败: {str(e)}") from e

        # ═══════════════════════════════════════════════════════════════
        # auto 模式：Dashscope > Ollama Local > Ollama Cloud > Moark
        # ═══════════════════════════════════════════════════════════════
        last_error: Exception | None = None

        # 1) Dashscope 优先
        if DASHSCOPE_ENABLED and DASHSCOPE_API_KEY:
            try:
                print(f"[API调用] 使用模型: {DASHSCOPE_MODEL} (后端: Dashscope)")
                response = self._chat_dashscope(model, messages, stream=stream, **kwargs)
                if stream and hasattr(response, '__iter__') and not isinstance(response, dict):
                    return response  # Return generator as-is for streaming
                return self._ensure_message_format(response)
            except Exception as e:
                print(f"⚠️ Dashscope 调用失败: {e}")
                last_error = e

        # 2) Ollama Local + Cloud
        if self.ollama_available:
            try:
                print(f"[API调用] 使用模型: {model} (后端: Ollama Local)")
                response = self._chat_ollama(model, messages, **kwargs)
                return self._ensure_message_format(response)
            except Exception as e:
                last_error = e
                cloud_model = self._cloud_model_name(model)
                if cloud_model and cloud_model != self._resolve_ollama_model_name(model) and self._is_model_not_found_error(e):
                    try:
                        print(f"⚠️ 本地模型不可用，回退到 Ollama cloud: {cloud_model}")
                        print(f"[API调用] 使用模型: {cloud_model} (后端: Ollama Cloud)")
                        response = self._chat_ollama(cloud_model, messages, **kwargs)
                        return self._ensure_message_format(response)
                    except Exception as cloud_error:
                        last_error = cloud_error

        # 3) Moark 兜底
        if MOARK_ENABLED and MOARK_API_KEY:
            try:
                print(f"[API调用] 使用模型: {MOARK_MODEL} (后端: Moark)")
                response = self._chat_moark(model, messages, **kwargs)
                return self._ensure_message_format(response)
            except Exception as e:
                last_error = e

        raise RuntimeError(
            f"所有 API 后端均不可用 (Dashscope/Ollama/Moark)。最后错误: {last_error}"
        )

    def _ensure_message_format(self, response: dict) -> dict:
        """保证返回结构包含 response['message']['content']。"""
        if not isinstance(response, dict):
            raise TypeError(f"API响应类型异常: {type(response)}")

        # 部分兼容响应可能返回包装结构: {status, msg, body}
        if "body" in response and "message" not in response and "choices" not in response:
            body = response.get("body")
            if isinstance(body, dict):
                normalized_body = self._ensure_message_format(body)
                response["message"] = normalized_body.get("message")
                return response
            if isinstance(body, str):
                # body 可能是 JSON 字符串
                try:
                    body_obj = __import__("json").loads(body)
                    if isinstance(body_obj, dict):
                        normalized_body = self._ensure_message_format(body_obj)
                        response["message"] = normalized_body.get("message")
                        return response
                except Exception:
                    pass
                response["message"] = {"role": "assistant", "content": body}
                return response

            if body is None:
                # 失败响应时 body 可能为 null，用 msg 做兜底，便于上层记录错误
                response["message"] = {"role": "assistant", "content": str(response.get("msg", ""))}
                return response

        # 已经是 Ollama 风格
        if "message" in response and isinstance(response.get("message"), dict) and "content" in response["message"]:
            return response

        # OpenAI 兼容风格：choices[0].message.content
        choices = response.get("choices")
        if isinstance(choices, list) and choices:
            choice0 = choices[0]
            if isinstance(choice0, dict):
                msg = choice0.get("message")
                if isinstance(msg, dict) and "content" in msg:
                    # 不破坏原有字段，只补齐 message
                    response["message"] = msg
                    return response

                # 部分响应可能是 delta 结构（流式/兼容结构）
                delta = choice0.get("delta")
                if isinstance(delta, dict) and "content" in delta:
                    response["message"] = {"role": "assistant", "content": delta.get("content", "")}
                    return response

                # 少数实现可能直接返回 text 字段
                if "text" in choice0:
                    response["message"] = {"role": "assistant", "content": str(choice0.get("text", ""))}
                    return response

        # 少数实现可能在顶层直接返回 content/text
        if "content" in response:
            response["message"] = {"role": "assistant", "content": str(response.get("content", ""))}
            return response
        if "text" in response:
            response["message"] = {"role": "assistant", "content": str(response.get("text", ""))}
            return response

        raise KeyError(f"API响应缺少可用的 message/content 字段, keys={list(response.keys())}")
    
    def _chat_ollama(self, model: str, messages: List[dict], **kwargs):
        """使用Ollama API（stream模式，超时后关闭连接可让Ollama停止推理释放资源）"""
        # 映射模型名称
        ollama_model = self._resolve_ollama_model_name(model)
        timeout_seconds = self._get_ollama_timeout_seconds(ollama_model, kwargs)
        chat_url = self.ollama_host.rstrip('/') + '/api/chat'
        payload = {
            "model": ollama_model,
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": kwargs.get("temperature", 0.1),
                "num_predict": kwargs.get("max_tokens", 1024),
                "max_tokens": kwargs.get("max_tokens", 1024),
            }
        }

        resp = None
        try:
            resp = requests.post(
                chat_url,
                json=payload,
                timeout=(self.ollama_connect_timeout_seconds, timeout_seconds),
                stream=True,
            )
            resp.raise_for_status()

            # 逐行读取流式响应，收集完整结果
            chunks = []
            for line in resp.iter_lines(decode_unicode=True):
                if not line:
                    continue
                try:
                    chunk = json.loads(line)
                    chunks.append(chunk)
                    # 如果流结束，跳出
                    if chunk.get("done", False):
                        break
                except json.JSONDecodeError:
                    continue

            # 合并流式响应为标准格式
            if not chunks:
                raise TypeError("Ollama流式响应为空")

            # 最后一个 chunk 包含完整统计信息
            final_chunk = chunks[-1]
            # 拼接所有 content
            content_parts = []
            for c in chunks:
                msg = c.get("message", {})
                if isinstance(msg, dict) and msg.get("content"):
                    content_parts.append(msg["content"])

            result = {
                "model": final_chunk.get("model", ollama_model),
                "message": {
                    "role": "assistant",
                    "content": "".join(content_parts),
                },
                "done": True,
                "total_duration": final_chunk.get("total_duration"),
                "eval_count": final_chunk.get("eval_count"),
            }
            return result

        except requests.Timeout as e:
            # 超时后关闭连接，Ollama检测到连接断开会停止推理释放GPU资源
            if resp is not None:
                try:
                    resp.close()
                except Exception:
                    pass
            model_kind = "cloud" if self._is_cloud_model(ollama_model) else "local"
            raise TimeoutError(
                f"Ollama {model_kind} 模型 {ollama_model} 调用超时（{timeout_seconds:.0f}秒）"
            ) from e
        except requests.RequestException as e:
            if resp is not None:
                try:
                    resp.close()
                except Exception:
                    pass
            raise RuntimeError(f"Ollama HTTP请求失败: {str(e)}") from e
        except Exception as e:
            if resp is not None:
                try:
                    resp.close()
                except Exception:
                    pass
            raise RuntimeError(f"Ollama调用失败: {str(e)}") from e

    def _chat_moark(self, model: str, messages: List[dict], **kwargs):
        """使用 Moark API (OpenAI 兼容)"""
        if not MOARK_ENABLED or not MOARK_API_KEY:
            raise RuntimeError("Moark API 未启用或未配置 API Key")

        # Moark 使用自己的模型名，忽略 Ollama 模型名
        moark_model = kwargs.pop("moark_model", None) or MOARK_MODEL
        timeout_seconds = 180.0  # Moark 默认超时
        headers = {
            "Authorization": f"Bearer {MOARK_API_KEY}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": moark_model,
            "messages": messages,
            "temperature": kwargs.get("temperature", 0.1),
            "max_tokens": kwargs.get("max_tokens", 1024),
        }

        try:
            response = requests.post(
                MOARK_API_URL,
                headers=headers,
                json=payload,
                timeout=timeout_seconds,
            )
            response.raise_for_status()
            result = response.json()
            if not isinstance(result, dict):
                raise TypeError(f"Moark 响应格式异常: {type(result)}")
            # 转换为 Ollama 格式
            if "choices" in result and result["choices"]:
                choice = result["choices"][0]
                if "message" in choice:
                    return {"message": choice["message"]}
            raise KeyError("Moark 响应缺少 message 字段")
        except requests.Timeout as e:
            raise TimeoutError(f"Moark API 调用超时（{timeout_seconds:.0f}秒）") from e
        except requests.RequestException as e:
            raise RuntimeError(f"Moark HTTP 请求失败: {str(e)}") from e
        except Exception as e:
            raise RuntimeError(f"Moark 调用失败: {str(e)}") from e

    def _chat_dashscope(self, model: str, messages: List[dict], stream: bool = False, **kwargs):
        """使用 Dashscope API (阿里云百炼，OpenAI 兼容)"""
        if not DASHSCOPE_ENABLED or not DASHSCOPE_API_KEY:
            raise RuntimeError("Dashscope API 未启用或未配置 API Key")

        # Dashscope 使用自己的模型名
        dashscope_model = kwargs.pop("dashscope_model", None) or DASHSCOPE_MODEL
        timeout_seconds = 180.0  # Dashscope 默认超时
        
        # 使用缓存的 OpenAI 客户端（启动时预创建）
        try:
            client = _get_dashscope_client()
            
            completion = client.chat.completions.create(
                model=dashscope_model,
                messages=messages,
                temperature=kwargs.get("temperature", 0.1),
                max_tokens=kwargs.get("max_tokens", 1024),
                stream=stream,  # Support streaming
                extra_body={"enable_thinking": False},  # Dashscope 非流式调用必须设置
            )
            
            if stream:
                # Return generator for streaming
                def generate_chunks():
                    full_content = ""
                    for chunk in completion:
                        if chunk.choices and chunk.choices[0].delta.content:
                            delta = chunk.choices[0].delta.content
                            full_content += delta
                            yield {
                                "model": dashscope_model,
                                "message": {
                                    "role": "assistant",
                                    "content": delta,  # Send incrementally
                                    "full_content": full_content,  # Accumulated
                                },
                                "done": False
                            }
                    # Send final signal
                    yield {
                        "model": dashscope_model,
                        "message": {
                            "role": "assistant",
                            "content": "",
                            "full_content": full_content,
                        },
                        "done": True
                    }
                return generate_chunks()
            else:
                # Non-streaming mode
                if completion.choices:
                    choice = completion.choices[0]
                    return {
                        "model": dashscope_model,
                        "message": {
                            "role": choice.message.role,
                            "content": choice.message.content,
                        },
                        "done": True
                    }
                else:
                    raise KeyError("Dashscope 响应缺少 choices 字段")
                
        except Exception as e:
            raise RuntimeError(f"Dashscope 调用失败: {str(e)}") from e

    def chat_batch_concurrent(self, requests: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """批量并发处理多个聊天请求，智能分配到本地、云和 Moark 资源。

        Args:
            requests: 请求列表，每个元素包含:
                - index: 请求索引
                - model: 模型名
                - messages: 消息列表
                - kwargs: 其他参数

        Returns:
            响应列表，按请求顺序排列
        """
        if not requests:
            return []

        # 分配请求到本地、云和 Moark
        local_requests = []
        cloud_requests = []
        moark_requests = []
        cloud_model = OLLAMA_CLOUD_MODEL

        for req in requests:
            model = req.get("model", "")
            is_cloud = self._is_cloud_model(model)

            if is_cloud:
                cloud_requests.append(req)
            else:
                # 如果是本地模型，且配置了不同的云模型，可以考虑分配到云
                # 但为了保持结果一致性，这里还是优先用本地
                local_requests.append(req)

        # 如果启用 Moark，分配部分本地请求到 Moark
        if MOARK_ENABLED and MOARK_API_KEY:
            # 将部分本地请求分配到 Moark（每 3 个请求中 1 个给 Moark）
            moark_requests = [local_requests[i] for i in range(len(local_requests)) if i % 3 == 2]
            local_requests = [local_requests[i] for i in range(len(local_requests)) if i % 3 != 2]

        # 类型初始化：results 列表包含 None 和 dict
        results: list[Any] = [None] * len(requests)

        # 计算可用资源数量
        resources = []
        if local_requests:
            resources.append(("本地", local_requests, lambda req: self._safe_chat(req["model"], req["messages"], req.get("backend_preference", "auto"), **req.get("kwargs", {}))))
        if cloud_requests:
            resources.append(("云", cloud_requests, lambda req: self._safe_chat(cloud_model, req["messages"], "cloud", **req.get("kwargs", {}))))
        if moark_requests:
            resources.append(("Moark", moark_requests, lambda req: self._safe_chat_moark(req["model"], req["messages"], **req.get("kwargs", {}))))

        # 如果有多个资源，并发处理
        if len(resources) > 1:
            print(f"[HybridClient] 启用多资源并发: {', '.join([f'{name}{len(reqs)}个' for name, reqs, _ in resources])}")

            with ThreadPoolExecutor(max_workers=len(resources)) as executor:
                all_futures = {}

                for resource_name, resource_requests, call_fn in resources:
                    for req in resource_requests:
                        future = executor.submit(call_fn, req)
                        all_futures[future] = (req["index"], resource_name)

                for future in as_completed(all_futures):
                    index, resource_name = all_futures[future]
                    try:
                        results[index] = future.result()
                        print(f"[HybridClient] 请求{index}完成 ({resource_name})")
                    except Exception as e:
                        print(f"[HybridClient] 请求{index}失败 ({resource_name}): {e}")
                        results[index] = {"error": str(e)}
        else:
            # 串行处理
            print(f"[HybridClient] 串行处理: {resources[0][0]}{len(resources[0][1])}个" if resources else "无请求")
            for req in requests:
                try:
                    results[req["index"]] = self._safe_chat(
                        req["model"],
                        req["messages"],
                        req.get("backend_preference", "auto"),
                        **req.get("kwargs", {})
                    )
                except Exception as e:
                    print(f"[HybridClient] 请求{req['index']}失败: {e}")
                    results[req["index"]] = {"error": str(e)}

        return results

    def _safe_chat(self, model: str, messages: List[dict], backend_preference: str = "auto", **kwargs):
        """安全的chat调用，捕获异常"""
        try:
            return self.chat(model, messages, backend_preference=backend_preference, **kwargs)
        except Exception as e:
            return {"error": str(e)}

    def _safe_chat_moark(self, model: str, messages: List[dict], **kwargs):
        """安全的 Moark chat 调用，捕获异常"""
        try:
            return self._chat_moark(model, messages, **kwargs)
        except Exception as e:
            return {"error": str(e)}
    
# 全局客户端实例
_global_client = None

def get_client(ollama_host: str | None = None, **_ignored) -> HybridAPIClient:
    """获取全局混合API客户端实例"""
    global _global_client
    if _global_client is None:
        _global_client = HybridAPIClient(ollama_host)
    return _global_client

def reset_client():
    """重置全局客户端实例"""
    global _global_client
    _global_client = None
