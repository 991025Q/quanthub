"""
Hybrid LLM Client 使用示例

演示如何使用 QuantHub 的混合 LLM 客户端：
- Ollama (本地/云端模型)
- Moark (OpenAI 兼容接口)
- Dashscope (阿里云百炼)
"""

from app.services.hybrid_client import get_client


def example_basic_chat():
    """基本聊天示例"""
    client = get_client()
    
    messages = [
        {"role": "system", "content": "你是 QuantHub 策略助手，帮助用户创建量化交易策略。"},
        {"role": "user", "content": "帮我写一个缠论三买做多策略"}
    ]
    
    response = client.chat(
        model="qwen3-max",  # 会自动映射到 OLLAMA_PRIMARY_MODEL
        messages=messages,
        temperature=0.1,
        max_tokens=2048
    )
    
    print(response["message"]["content"])


def example_backend_preference():
    """指定后端示例"""
    client = get_client()
    
    messages = [
        {"role": "user", "content": "解释一下什么是缠论三买"}
    ]
    
    # 强制使用 Ollama 本地模型
    try:
        response = client.chat(
            model="gemma4:cloud",
            messages=messages,
            backend_preference="ollama"  # 仅使用 Ollama（本地+cloud回退）
        )
        print("Ollama:", response["message"]["content"][:100])
    except Exception as e:
        print(f"Ollama 失败: {e}")
    
    # 强制使用 Moark
    try:
        response = client.chat(
            model="gpt-4o-mini",
            messages=messages,
            backend_preference="moark"  # 仅使用 Moark
        )
        print("Moark:", response["message"]["content"][:100])
    except Exception as e:
        print(f"Moark 失败: {e}")
    
    # 自动选择（推荐）
    response = client.chat(
        model="qwen-plus",
        messages=messages,
        backend_preference="auto"  # Ollama → cloud → Moark → DashScope
    )
    print("Auto:", response["message"]["content"][:100])


def example_batch_concurrent():
    """批量并发请求示例"""
    client = get_client()
    
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
        },
        {
            "index": 2,
            "model": "qwen-plus",
            "messages": [{"role": "user", "content": "策略3描述..."}],
            "kwargs": {"temperature": 0.15}
        }
    ]
    
    results = client.chat_batch_concurrent(requests_data)
    
    for i, result in enumerate(results):
        if "error" in result:
            print(f"请求{i}失败: {result['error']}")
        else:
            content = result.get("message", {}).get("content", "")
            print(f"请求{i}: {content[:100]}...")


def example_strategy_generation():
    """AI 生成策略示例（配合 strategy_prompt.py）"""
    import sys
    import pathlib
    
    # 添加父目录到 path，以便导入 strategy_prompt
    current_dir = pathlib.Path(__file__).parent.parent.parent
    if str(current_dir) not in sys.path:
        sys.path.insert(0, str(current_dir))
    
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
        model=client._resolve_ollama_model_name("qwen3-max"),
        messages=messages,
        temperature=0.1,
        max_tokens=4096
    )
    
    # 解析返回的 JSON
    import json
    content = response["message"]["content"]
    
    try:
        strategy = json.loads(content)
        print(f"策略名称: {strategy['name']}")
        print(f"策略描述: {strategy['description']}")
        print(f"\n策略代码:\n{strategy['code']}")
    except json.JSONDecodeError:
        print("LLM 返回非 JSON 格式:")
        print(content)


if __name__ == "__main__":
    print("=" * 60)
    print("Hybrid LLM Client 使用示例")
    print("=" * 60)
    
    print("\n1️⃣  基本聊天示例")
    print("-" * 60)
    try:
        example_basic_chat()
    except Exception as e:
        print(f"❌ 错误: {e}")
    
    print("\n2️⃣  指定后端示例")
    print("-" * 60)
    try:
        example_backend_preference()
    except Exception as e:
        print(f"❌ 错误: {e}")
    
    print("\n3️⃣  批量并发请求示例")
    print("-" * 60)
    try:
        example_batch_concurrent()
    except Exception as e:
        print(f"❌ 错误: {e}")
    
    print("\n4️⃣  AI 生成策略示例")
    print("-" * 60)
    try:
        example_strategy_generation()
    except Exception as e:
        print(f"❌ 错误: {e}")
