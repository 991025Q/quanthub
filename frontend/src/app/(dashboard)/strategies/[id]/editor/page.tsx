"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Strategy {
  id: string;
  name: string;
  description: string;
  code: string;
  strategy_type: string;
  freq: string;
  status: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export default function StrategyEditorPage() {
  const params = useParams();
  const strategyId = params.id as string;

  const [strategy, setStrategy] = useState<Strategy | null>(null);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editingName, setEditingName] = useState(false);

  // AI assistant tabs
  const [activeTab, setActiveTab] = useState<"chat" | "explain">("chat");

  // AI chat
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // AI explain (knowledge base) - now supports conversation history
  const [explainHistory, setExplainHistory] = useState<ChatMsg[]>([]);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainQuestion, setExplainQuestion] = useState("");

  useEffect(() => {
    apiFetch(`/api/v1/strategies/${strategyId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject("Not found")))
      .then((data: Strategy) => {
        setStrategy(data);
        setCode(data.code || getDefaultCode(data.strategy_type, data.freq));
        setName(data.name || "");
        setDescription(data.description || "");
        setLoading(false);
      })
      .catch(() => {
        setError("策略加载失败");
        setLoading(false);
      });
  }, [strategyId]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const res = await apiFetch(`/api/v1/strategies/${strategyId}`, {
        method: "PUT",
        body: JSON.stringify({
          code,
          name,
          description,
        }),
      });
      if (res.ok) {
        setSuccess("保存成功");
        setTimeout(() => setSuccess(""), 3000);
      } else {
        const data = await res.json();
        setError(data.detail || "保存失败");
      }
    } catch (e) {
      setError(`保存失败: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  /** 安全的 JSON 解析 */
  async function safeParseJson(res: Response) {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      return res.json();
    }
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`服务器错误 (${res.status}): ${text.slice(0, 200)}`);
  }

  const handleChat = async () => {
    if (!chatInput.trim() || !code) return;
    setChatLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/v1/ai/chat", {
        method: "POST",
        body: JSON.stringify({ code, message: chatInput }),
      });
      const data = await safeParseJson(res);
      if (!res.ok) {
        throw new Error(data.detail || data.explanation || `服务器错误 (${res.status})`);
      }
      if (data.code) {
        setCode(data.code);
        setChatHistory((prev) => [
          ...prev,
          { role: "user" as const, content: chatInput },
          { role: "assistant" as const, content: data.explanation || "代码已更新" },
        ]);
        setChatInput("");

        // AI 修改代码后自动保存
        try {
          const saveRes = await apiFetch(`/api/v1/strategies/${strategyId}`, {
            method: "PUT",
            body: JSON.stringify({ code: data.code, name, description }),
          });
          if (saveRes.ok) {
            setSuccess("AI 已修改并保存");
            setTimeout(() => setSuccess(""), 3000);
          } else {
            setError("AI 代码已更新，但保存失败");
          }
        } catch {
          setError("AI 代码已更新，但自动保存失败");
        }
      }
    } catch (e: any) {
      setError(`AI 请求失败: ${e.message || e}`);
    } finally {
      setChatLoading(false);
    }
  };

  const handleExplain = async (question?: string) => {
    if (!code) return;
    const q = (question || "").trim();
    if (!q) {
      // 没有指定问题时，默认让 AI 解析整个策略
      question = "请分析当前策略代码，逐一解释每个信号的含义和策略逻辑";
    } else {
      question = q;
    }
    setExplainLoading(true);
    setError("");
    
    // Add user question to history
    setExplainHistory((prev) => [
      ...prev,
      { role: "user" as const, content: question! },
    ]);
    
    try {
      // 通过 Next.js 代理调用后端 API（已配置 X-Accel-Buffering: no 支持流式响应）
      const res = await fetch("/api/v1/ai/explain", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({ code, message: question }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`服务器错误 (${res.status}): ${errorText.slice(0, 200)}`);
      }

      // Stream the response
      const reader = res.body?.getReader();
      if (!reader) {
        throw new Error("无法接收流式响应");
      }

      const decoder = new TextDecoder();
      let fullContent = "";

      // Add placeholder assistant message
      setExplainHistory((prev) => [
        ...prev,
        { role: "assistant" as const, content: "" },
      ]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split(/\r?\n/);

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                fullContent += data.content;
                // Update last assistant message incrementally
                setExplainHistory((prev) => {
                  const updated = [...prev];
                  const lastMsg = updated[updated.length - 1];
                  if (lastMsg?.role === "assistant") {
                    lastMsg.content = fullContent;
                  }
                  return updated;
                });
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (e) {
              console.error("Failed to parse SSE data:", e);
            }
          }
        }
      }

      setExplainQuestion("");
    } catch (e: any) {
      setError(`AI 解析失败: ${e.message || e}`);
    } finally {
      setExplainLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="mt-4 text-gray-500">加载策略中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            {editingName ? (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => e.key === "Enter" && setEditingName(false)}
                className="text-2xl font-bold text-gray-900 border-b-2 border-blue-500 outline-none bg-transparent"
                autoFocus
              />
            ) : (
              <h2
                className="text-2xl font-bold text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                onClick={() => setEditingName(true)}
                title="点击编辑名称"
              >
                {name || strategyId}
              </h2>
            )}
            <span className="text-sm text-gray-400">| {strategy?.strategy_type} | {strategy?.freq}</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm text-gray-500 bg-transparent border-b border-dashed border-gray-300 focus:border-blue-500 outline-none max-w-xs"
              placeholder="添加描述..."
            />
          </div>
        </div>
        <div className="flex gap-2">
          <a href={`/strategies/${strategyId}/backtest`} className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
            回测
          </a>
          <a href="/strategies" className="px-3 py-1.5 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200">
            返回列表
          </a>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-green-600 text-sm">{success}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Code editor 60% */}
        <div className="lg:col-span-3">
          <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
            <div className="bg-gray-800 px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-400 font-mono">Python</span>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存"}
              </button>
            </div>
            <div className="flex">
              <div className="bg-gray-900 text-gray-600 text-right py-3 px-2 select-none text-xs font-mono leading-5 min-w-[36px]">
                {code.split("\n").map((_, i) => (
                  <div key={i}>{i + 1}</div>
                ))}
              </div>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="flex-1 p-3 font-mono text-sm bg-gray-900 text-green-400 leading-5 resize-none outline-none min-h-[500px]"
                spellCheck={false}
              />
            </div>
          </div>
        </div>

        {/* Right: AI assistant 40% */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col">
            {/* Tab headers */}
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => setActiveTab("chat")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "chat"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                ✨ AI 改代码
              </button>
              <button
                onClick={() => setActiveTab("explain")}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === "explain"
                    ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50/50"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                📖 信号知识库
              </button>
            </div>

            {/* Chat Tab */}
            {activeTab === "chat" && (
              <>
                {/* Chat history */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[350px]">
                  {chatHistory.length === 0 && (
                    <div className="text-center py-6 space-y-2">
                      <p className="text-xs text-gray-400">输入修改需求或点击快捷指令</p>
                      <p className="text-xs text-gray-300">需要配置 LLM_API_KEY 环境变量</p>
                    </div>
                  )}
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`text-xs p-2 rounded-lg ${
                        msg.role === "user" ? "bg-blue-50 text-blue-700" : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {msg.content}
                    </div>
                  ))}
                </div>

                {/* Quick commands */}
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {["添加止损", "修改平仓条件", "添加过滤信号", "多周期共振", "T+0交易", "加密货币适配"].map((cmd) => (
                    <button
                      key={cmd}
                      onClick={() => setChatInput(cmd)}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>

                {/* Chat input */}
                <div className="p-3 border-t border-gray-200 flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleChat()}
                    className="flex-1 p-2 border rounded text-sm"
                    placeholder="输入修改需求..."
                  />
                  <button
                    onClick={handleChat}
                    disabled={chatLoading || !chatInput.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {chatLoading ? "..." : "发送"}
                  </button>
                </div>
              </>
            )}

            {/* Explain Tab (Knowledge Base) */}
            {activeTab === "explain" && (
              <>
                {/* Chat history */}
                <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[400px]">
                  {explainHistory.length === 0 && !explainLoading && (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-400">使用下方的快捷按钮或输入问题来解析策略信号</p>
                    </div>
                  )}

                  {explainHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`text-xs p-2 rounded-lg ${
                        msg.role === "user"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-gray-50 text-gray-600"
                      }`}
                    >
                      {msg.role === "assistant" && <span className="font-semibold mr-1">🤖</span>}
                      <span className="whitespace-pre-wrap">{msg.content}</span>
                    </div>
                  ))}

                  {explainLoading && (
                    <div className="flex items-center justify-center py-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-xs text-gray-500 ml-2">AI 正在分析...</p>
                    </div>
                  )}
                </div>

                {/* Quick ask buttons */}
                <div className="px-3 pb-2 flex flex-wrap gap-1">
                  {["解释开仓信号", "解释平仓信号", "分析风控参数", "适合什么市场", "信号参数拆解"].map((q) => (
                    <button
                      key={q}
                      onClick={() => handleExplain(q)}
                      disabled={explainLoading}
                      className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-50"
                    >
                      {q}
                    </button>
                  ))}
                </div>

                {/* Follow-up question input */}
                <div className="p-3 border-t border-gray-200 flex gap-2">
                  <input
                    value={explainQuestion}
                    onChange={(e) => setExplainQuestion(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleExplain(explainQuestion)}
                    className="flex-1 p-2 border rounded text-sm"
                    placeholder="追问具体信号含义..."
                    disabled={explainLoading}
                  />
                  <button
                    onClick={() => handleExplain(explainQuestion)}
                    disabled={explainLoading || !explainQuestion.trim()}
                    className="px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
                  >
                    {explainLoading ? "..." : "问"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function getDefaultCode(strategyType: string, freq: string): string {
  return `from czsc import CzscStrategyBase, Event, Position

class MyStrategy(CzscStrategyBase):
    """${strategyType || "自定义策略"}"""

    @property
    def positions(self):
        return [Position(
            name="my_position", symbol=self.symbol,
            opens=[Event.load({
                "name": "开多",
                "operate": "开多",
                "signals_all": ["${freq}_D1_表里关系V230101_向上_任意_任意_0"],
            })],
            exits=[Event.load({
                "name": "平多",
                "operate": "平多",
                "signals_all": ["${freq}_D1_表里关系V230101_向下_任意_任意_0"],
            })],
            interval=3600 * 4,
            timeout=16 * 30,
            stop_loss=300,
            t0=False,
        )]
`;
}
