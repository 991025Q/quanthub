# Hybrid LLM Client 使用指南

## 概述

Hybrid LLM Client 是 QuantHub 的混合大模型客户端，支持多个 LLM 后端的智能切换和容错机制：

- **Ollama** - 本地/云端模型运行服务
  - 本地模型：在 Ollama 服务器上运行的模型（如 qwen3.5:4b、gemma4:cloud）
  - Cloud 模型：通过 Ollama 调用的云端模型
- **Moark** - OpenAI 兼容接口（兜底方案）
- **Dashscope** - 阿里云百炼平台（已启用）

## 配置方式

### 1. 环境变量 / .env 文件

复制 `.env.example` 为 `.env` 并修改配置：

```bash
cp .env.example .env
```

### 2. 配置项说明

#### Ollama 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `OLLAMA_HOST` | `http://127.0.0.1:11434` | Ollama 服务地址 |
| `OLLAMA_PRIMARY_MODEL` | `gemma4:cloud` | 主模型名称 |
| `OLLAMA_CLOUD_MODEL` | `gemma4:cloud` | 云端回退模型 |
| `OLLAMA_CONNECT_TIMEOUT_SECONDS` | `5` | 连接超时时间（秒） |
| `OLLAMA_LOCAL_TIMEOUT_SECONDS` | `160` | 本地模型推理超时（秒） |
| `OLLAMA_CLOUD_TIMEOUT_SECONDS` | `180` | 云端模型推理超时（秒） |

#### Moark 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `MOARK_API_KEY` | (空) | Moark API Key |
| `MOARK_API_URL` | `https://api.moark.com/v1/chat/completions` | Moark API 地址 |
| `MOARK_MODEL` | `gpt-4o-mini` | Moark 模型名称 |
| `MOARK_ENABLED` | `false` | 是否启用 |

#### Dashscope 配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DASHSCOPE_API_KEY` | `sk-...` | Dashscope API Key |
| `DASHSCOPE_API_URL` | `https://dashscope.aliyuncs.com/compatible-mode/v1` | Dashscope API 地址 |
| `DASHSCOPE_MODEL` | `qwen-plus` | Dashscope 模型名称 |
| `DASHSCOPE_ENABLED` | `true` | 是否启用 |

## 核心功能

### 1. 智能切换机制

默认的调用优先级（`backend_preference="auto"`）：

```
Ollama 本地模型
    ↓ (失败或模型不存在)
Ollama Cloud 模型
    ↓ (失败)
Moark (如果启用)
    ↓ (失败)
Dashscope (如果启用)
```

### 2. 后端指定

可以通过 `backend_preference` 参数指定后端：

```python
from app.services.hybrid_client import get_client

client = get_client()

# 强制使用 Ollama（本地 + cloud 回退）
response = client.chat(
    model="gemma4:cloud",
    messages=messages,
    backend_preference="ollama"
)

# 强制使用 Moark
response = client.chat(
    model="gpt-4o-mini",
    messages=messages,
    backend_preference="moark"
)

# 自动选择（推荐）
response = client.chat(
    model="qwen-plus",
    messages=messages,
    backend_preference="auto"
)
```

### 3. 批量并发请求

支持同时发送多个请求，智能分配到不同后端：

```python
requests_data = [
    {
        "index": 0,
        "model": "qwen3-max",
        "messages": [{"role": "user", "content": "策略1描述..."}],
        "kwargs": {"temperature": 0.1}
    },
    {
        "index": 1,
        "model": "gemma4:cloud",
        "messages": [{"role": "user", "content": "策略2描述..."}],
        "kwargs": {"temperature": 0.2}
    }
]

results = client.chat_batch_concurrent(requests_data)
```

## 使用示例

### 基本聊天

```python
from app.services.hybrid_client import get_client

client = get_client()

messages = [
    {"role": "system", "content": "你是 QuantHub 策略助手"},
    {"role": "user", "content": "帮我写一个缠论三买做多策略"}
]

response = client.chat(
    model="qwen3-max",
    messages=messages,
    temperature=0.1,
    max_tokens=2048
)

print(response["message"]["content"])
```

### AI 生成策略（配合 strategy_prompt.py）

```python
from app.services.hybrid_client import get_client
from strategy_prompt import build_messages

client = get_client()

# 用户描述策略
user_description = """
我想做一个 BTC/USDT 的 15分钟高频策略，
使用缠论三买信号做多，笔向下平仓，T+0交易。
"""

# 构建消息（包含系统提示词）
messages = build_messages(user_description)

# 调用 LLM
response = client.chat(
    model="qwen-plus",
    messages=messages,
    temperature=0.1,
    max_tokens=4096
)

# 解析返回的 JSON
import json
content = response["message"]["content"]
strategy = json.loads(content)

print(f"策略名称: {strategy['name']}")
print(f"策略代码:\n{strategy['code']}")
```

## API 端点映射

在 `api_server.py` 中已经集成了 AI 端点：

- `POST /api/v1/ai/generate-strategy` - 自然语言生成策略
- `POST /api/v1/ai/chat` - 多轮对话修改策略

这些端点会自动使用 Hybrid LLM Client。

## 测试

运行测试脚本验证配置：

```bash
cd quanthub/backend
python test_hybrid_llm.py
```

测试会验证：
1. 配置加载是否正确
2. Ollama 服务是否可用
3. 模型可用性检测
4. API 连通性
5. 基本聊天功能

## 故障排查

### Ollama 服务不可用

```
⚠️ Ollama服务不可用: Connection refused
```

解决方法：
1. 安装 Ollama: https://ollama.ai
2. 启动服务: `ollama serve`
3. 拉取模型: `ollama pull gemma4:cloud`

### Moark API Key 未配置

```
RuntimeError: Moark API 未启用或未配置 API Key
```

解决方法：在 `.env` 文件中配置 `MOARK_API_KEY` 并设置 `MOARK_ENABLED=true`

### Dashscope 调用失败

检查 `DASHSCOPE_API_KEY` 是否正确配置，API Key 是否在有效期内。

## 架构设计

```
HybridAPIClient
├── chat()                    # 主入口（智能切换）
│   ├── backend_preference="auto"   # 自动选择
│   ├── backend_preference="ollama" # 强制Ollama
│   ├── backend_preference="ollama_cloud"  # 强制Ollama Cloud
│   └── backend_preference="moark"   # 强制Moark
│
├── _chat_ollama()            # Ollama 调用（流式响应）
├── _chat_moark()             # Moark 调用（OpenAI 兼容）
├── _chat_dashscope()         # Dashscope 调用（OpenAI 兼容）
│
└── chat_batch_concurrent()   # 批量并发请求
    ├── 本地线程池分配
    ├── 云模型线程池分配
    └── Moark 线程池分配
```

## 依赖库

- `requests` - HTTP 请求
- `ollama` (可选) - Ollama Python SDK
- `openai` (可选) - OpenAI Python SDK（用于 Dashscope）
- `python-dotenv` (可选) - 环境变量加载

## 注意事项

1. **超时设置**: 本地模型建议设置较长的超时时间（160秒），因为推理可能需要较长时间
2. **模型名映射**: `qwen3-max` 会自动映射到 `OLLAMA_PRIMARY_MODEL`
3. **Cloud 模型**: 模型名以 `:cloud` 结尾的会被识别为云端模型
4. **资源隔离**: 批量请求会自动分配到不同后端，避免单个后端过载
5. **错误回退**: 当前端不可用时，自动回退到下一个可用后端
