"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";

interface GeneratedStrategy {
  name: string;
  description: string;
  strategy_type: string;
  freq: string;
  code: string;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const TEMPLATES = [
  { id: "third_buy", label: "三买做多", market: "A股/通用", desc: "30分钟三买信号做多，笔向下平仓" },
  { id: "bi_direction", label: "笔方向跟踪", market: "通用", desc: "笔向上做多，笔向下平仓" },
  { id: "dual_ma", label: "单均线多空", market: "通用", desc: "SMA5均线多头向上做多，空头向下平仓" },
  { id: "macd_diverge", label: "MACD底背离", market: "通用", desc: "MACD底背离信号做多" },
  { id: "crypto_third_buy", label: "加密货币三买高频", market: "加密货币", desc: "BTC/ETH 15分钟三买做多，多版本信号OR触发，T+0交易" },
  { id: "crypto_mtf", label: "加密货币多周期共振", market: "加密货币", desc: "日线笔向上+30分钟三买共振做多，减少假信号" },
  { id: "crypto_macd", label: "加密货币MACD+笔方向", market: "加密货币", desc: "MACD多头+笔向上做多，MACD空头+笔向下平仓" },
  { id: "vol_breakout", label: "放量突破", market: "通用", desc: "成交量放大突破阻力位做多" },
  { id: "custom", label: "自定义", market: "任意", desc: "用自然语言描述您的策略想法" },
];

const STEPS = [
  { label: "描述策略", hint: "输入想法" },
  { label: "审核代码", hint: "检查修改" },
  { label: "保存完成", hint: "完成" },
];

/** 检测用户消息是否为提问（而非修改代码请求） */
function isQuestion(msg: string): boolean {
  const questionPatterns = [
    /是什么意思/, /什么意思/, /是什么/, /解释/, /说明/, /含义/,
    /^什么是/, /^怎么/, /^如何/, /^为什么/, /^\?/, /？$/,
    /^BS/, /^V\d/, /信号.*意思/, /这个.*意思/,
  ];
  // 修改指令关键词（不当作提问）
  const modifyPatterns = [
    /添加/, /修改/, /删除/, /去掉/, /改成/, /增加/,
    /加.*止损/, /加.*止盈/, /换/, /调整/, /改/,
  ];
  if (modifyPatterns.some((p) => p.test(msg))) return false;
  return questionPatterns.some((p) => p.test(msg));
}

/** 安全的 JSON 解析，复用 api.ts 的 safeJson 逻辑 */
async function safeParseJson(res: Response) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  const text = await res.text().catch(() => `HTTP ${res.status}`);
  throw new Error(`服务器错误 (${res.status}): ${text.slice(0, 200)}`);
}

export default function NewStrategyPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [nlInput, setNlInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedStrategy | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // ─── Step Navigation ───────────────────────────────────────────────
  const canGoToStep = (target: number) => {
    if (target === 1) return true;
    if (target === 2) return !!generated;
    if (target === 3) return !!savedId;
    return false;
  };

  const handleStepClick = (target: number) => {
    if (canGoToStep(target)) setStep(target as 1 | 2 | 3);
  };

  const handleTemplateClick = (t: typeof TEMPLATES[0]) => {
    if (t.id === "custom") {
      setNlInput("");
    } else {
      setNlInput(
        `我想创建一个${t.label}策略：${t.desc}。适用市场：${t.market}。请帮我生成完整的 czsc 策略代码。`
      );
    }
  };

  const handleGenerate = async () => {
    if (!nlInput.trim()) return;
    setGenerating(true);
    setError("");
    try {
      const res = await apiFetch("/api/v1/ai/generate-strategy", {
        method: "POST",
        body: JSON.stringify({ description: nlInput }),
      });
      const data = await res.json();
      if (res.ok && data.code) {
        setGenerated(data);
        setCode(data.code);
        setStep(2);
      } else if (data.detail) {
        setError(data.detail);
      } else {
        if (data.raw_response) {
          setError("AI 返回格式异常，请重试。原始回复: " + data.raw_response.slice(0, 200));
        } else {
          setError("生成失败，请重试");
        }
      }
    } catch (e) {
      setError(`请求失败: ${e}`);
    } finally {
      setGenerating(false);
    }
  };

  /** 统一的 AI 对话处理：自动区分提问 / 修改 */
  const handleChatSend = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatLoading(true);
    setError("");

    // 判断是否为提问
    if (isQuestion(msg)) {
      try {
        // 通过 Next.js 代理调用后端 API（已配置 X-Accel-Buffering: no 支持流式响应）
        const res = await fetch("/api/v1/ai/explain", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem('access_token')}`,
          },
          body: JSON.stringify({ code, message: msg }),
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
                  setChatHistory((prev) => {
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

        // Ensure final message is set
        if (fullContent) {
          setChatHistory((prev) => [
            ...prev.filter(m => m.role !== "assistant" || m.content !== fullContent),
            { role: "assistant" as const, content: fullContent },
          ]);
        }

        setChatInput("");
      } catch (e: any) {
        setError(`请求失败: ${e.message || e}`);
      } finally {
        setChatLoading(false);
      }
      return;
    }

    // 修改请求：需要已有代码
    if (!code) {
      setChatHistory((prev) => [
        ...prev,
        { role: "user" as const, content: msg },
        { role: "assistant" as const, content: "请先生成策略代码，然后我才能帮你修改" },
      ]);
      setChatInput("");
      setChatLoading(false);
      return;
    }

    try {
      const res = await apiFetch("/api/v1/ai/chat", {
        method: "POST",
        body: JSON.stringify({ code, message: msg }),
      });
      const data = await safeParseJson(res);
      if (!res.ok) {
        throw new Error(data.detail || data.explanation || `服务器错误 (${res.status})`);
      }
      if (data.code) {
        setCode(data.code);
        if (data.name) setGenerated((prev) => ({ ...prev!, ...data }));
        setChatHistory((prev) => [
          ...prev,
          { role: "user" as const, content: msg },
          { role: "assistant" as const, content: data.explanation || "代码已更新" },
        ]);
        setChatInput("");
      } else {
        setError("修改失败，AI 未能返回有效代码");
      }
    } catch (e: any) {
      setError(`请求失败: ${e.message || e}`);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSave = async () => {
    if (!generated || !code) return;
    setSaving(true);
    setError("");
    try {
      const res = await apiFetch("/api/v1/strategies", {
        method: "POST",
        body: JSON.stringify({
          name: generated.name || "未命名策略",
          description: generated.description || "",
          code,
          strategy_type: generated.strategy_type || "custom",
          freq: generated.freq || "30分钟",
        }),
      });
      const data = await res.json();
      if (res.ok && data.id) {
        setSavedId(data.id);
        setStep(3);
      } else {
        setError(data.detail || "保存失败");
      }
    } catch (e) {
      setError(`保存失败: ${e}`);
    } finally {
      setSaving(false);
    }
  };

  // ─── Shared AI Assistant Panel ─────────────────────────────────────
  const aiPanel = (
    <div className="bg-white rounded-xl border-2 border-blue-300 shadow-sm h-full flex flex-col">
      <div className="p-3 border-b border-blue-200 bg-blue-50 rounded-t-xl">
        <h3 className="font-semibold text-sm text-blue-800 flex items-center gap-1.5">
          <span>🤖</span> AI 助手
        </h3>
        <p className="text-xs text-blue-500 mt-0.5">
          {code ? "提问解释信号 / 输入修改指令" : "提问信号含义或策略问题"}
        </p>
      </div>

      {/* Chat history */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[350px]">
        {chatHistory.length === 0 && (
          <div className="text-xs text-gray-400 text-center py-4 space-y-2">
            <p>💡 试试问我：</p>
            <p className="text-blue-500">"BS辅助V230803 是什么意思？"</p>
            <p className="text-blue-500">"三买和底背离有什么区别？"</p>
            {code && <p className="text-blue-500">"添加止损" "修改平仓条件"</p>}
          </div>
        )}
        {chatHistory.map((msg, i) => (
          <div
            key={i}
            className={`text-xs p-2.5 rounded-lg whitespace-pre-wrap ${
              msg.role === "user"
                ? "bg-blue-50 text-blue-700 ml-4"
                : "bg-gray-50 text-gray-700 mr-4 border border-gray-100"
            }`}
          >
            {msg.content}
          </div>
        ))}
      </div>

      {/* Quick commands */}
      <div className="px-3 pb-2 flex flex-wrap gap-1">
        {["BS辅助V230803是什么意思", "三买和一买有什么区别", "添加止损", "修改平仓条件", "多周期共振"].map((cmd) => (
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
          onKeyDown={(e) => e.key === "Enter" && handleChatSend()}
          className="flex-1 p-2 border rounded text-sm"
          placeholder={code ? "提问或输入修改需求..." : "提问信号含义..."}
        />
        <button
          onClick={handleChatSend}
          disabled={chatLoading || !chatInput.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50 font-medium"
        >
          {chatLoading ? "..." : "发送"}
        </button>
      </div>
    </div>
  );

  // ─── Step Indicator ────────────────────────────────────────────────
  const stepIndicator = (
    <div className="flex items-center gap-1">
      {STEPS.map((s, i) => {
        const stepNum = i + 1;
        const active = step >= stepNum;
        const current = step === stepNum;
        const clickable = canGoToStep(stepNum);
        return (
          <button
            key={stepNum}
            onClick={() => handleStepClick(stepNum)}
            disabled={!clickable}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              active
                ? "bg-blue-600 text-white shadow-sm"
                : "bg-gray-100 text-gray-400"
            } ${clickable ? "cursor-pointer hover:opacity-80" : "cursor-not-allowed opacity-60"}`}
            title={clickable ? `跳转到: ${s.label}` : s.hint}
          >
            <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
              active ? "bg-white/20" : "bg-gray-200"
            }`}>
              {stepNum}
            </span>
            <span className="hidden sm:inline">{s.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">新建策略</h2>
        {stepIndicator}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-red-600 text-sm">{error}</p>
        </div>
      )}

      {/* ── Step 1: Describe + AI Panel ──────────────────────────────── */}
      {step === 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: input */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
              <h3 className="font-semibold text-gray-900">描述您的策略想法</h3>
              <p className="text-sm text-gray-500">
                用自然语言描述交易逻辑，AI 将自动生成 czsc 缠论策略代码
              </p>
              <textarea
                value={nlInput}
                onChange={(e) => setNlInput(e.target.value)}
                className="w-full h-40 p-3 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder='例如："BTC/USDT 15分钟级别，当日线笔向上且30分钟出现三买信号时做多，笔向下平仓，T+0交易"'
              />
              <button
                onClick={handleGenerate}
                disabled={generating || !nlInput.trim()}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {generating ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    AI 正在生成...
                  </span>
                ) : (
                  "AI 生成策略"
                )}
              </button>
            </div>

            {/* Templates below input */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-700 text-sm">快捷模板</h3>
              <div className="grid grid-cols-1 gap-1.5">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTemplateClick(t)}
                    className="text-left bg-white border border-gray-200 rounded-lg p-2.5 hover:border-blue-400 hover:shadow-sm transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm text-gray-900 group-hover:text-blue-600">
                        {t.label}
                      </span>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {t.market}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: AI Assistant (always visible) */}
          <div className="lg:col-span-2">{aiPanel}</div>
        </div>
      )}

      {/* ── Step 2: Review + AI Panel ────────────────────────────────── */}
      {step === 2 && generated && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: code editor */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Strategy info */}
              <div className="p-4 border-b border-gray-200 bg-gray-50">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">名称</label>
                    <input
                      value={generated.name || ""}
                      onChange={(e) => setGenerated({ ...generated, name: e.target.value })}
                      className="w-full p-1.5 border rounded mt-0.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">策略类型</label>
                    <input
                      value={generated.strategy_type || ""}
                      onChange={(e) => setGenerated({ ...generated, strategy_type: e.target.value })}
                      className="w-full p-1.5 border rounded mt-0.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">周期</label>
                    <select
                      value={generated.freq || "30分钟"}
                      onChange={(e) => setGenerated({ ...generated, freq: e.target.value })}
                      className="w-full p-1.5 border rounded mt-0.5 text-sm"
                    >
                      {["1分钟", "5分钟", "15分钟", "30分钟", "1小时", "4小时", "日线"].map((f) => (
                        <option key={f}>{f}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">描述</label>
                    <input
                      value={generated.description || ""}
                      onChange={(e) => setGenerated({ ...generated, description: e.target.value })}
                      className="w-full p-1.5 border rounded mt-0.5 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Code editor with line numbers */}
              <div className="flex">
                <div className="bg-gray-800 text-gray-500 text-right py-3 px-2 select-none text-xs font-mono leading-5 min-w-[40px]">
                  {code.split("\n").map((_, i) => (
                    <div key={i}>{i + 1}</div>
                  ))}
                </div>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="flex-1 p-3 font-mono text-sm bg-gray-900 text-green-400 leading-5 resize-none outline-none min-h-[400px]"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium transition-colors"
              >
                {saving ? "保存中..." : "保存策略"}
              </button>
              <button
                onClick={() => setStep(1)}
                className="px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
              >
                返回修改描述
              </button>
            </div>
          </div>

          {/* Right: AI chat panel */}
          <div className="lg:col-span-2">{aiPanel}</div>
        </div>
      )}

      {/* ── Step 3: Success ──────────────────────────────────────────── */}
      {step === 3 && (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">策略保存成功</h3>
            <p className="text-gray-500 mt-2">
              策略 <span className="font-medium text-gray-700">{generated?.name}</span> 已保存，ID: {savedId}
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <a
              href={`/strategies/${savedId}/backtest`}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium transition-colors"
            >
              立即回测
            </a>
            <a
              href={`/strategies/${savedId}/editor`}
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              打开编辑器
            </a>
            <a
              href="/strategies"
              className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
            >
              返回列表
            </a>
          </div>
        </div>
      )}
    </div>
  );
}