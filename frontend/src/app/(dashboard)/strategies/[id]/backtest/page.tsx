"use client";

import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import { apiFetch, apiDelete } from "@/lib/api";

const API_BASE = "";

/** 回测历史记录接口类型 */
interface BacktestRecord {
  job_id: string;
  status: string;
  symbol: string;
  freq: string;
  sdt: string;
  edt: string;
  created_at: string;
  finished_at: string | null;
  error: string;
  has_wbt_report: boolean;
  has_lwc_report: boolean;
  stats: Record<string, unknown>;
  annual_return: number | null;
  sharpe_ratio: number | null;
  max_drawdown: number | null;
  win_rate: number | null;
  total_trades: number | null;
  profit_factor: number | null;
  long_pct: number | null;
  short_pct: number | null;
  data_source?: string;
  strategy_type?: string;
}

/** 从策略代码中解析 freqs 列表（多周期共振策略） */
function parseFreqsFromCode(code: string): string[] | null {
  // 匹配 def freqs(self): return ["30分钟", "日线"] 或 freqs = ["30分钟", "日线"]
  const m = code.match(/freqs[^\[]*\[([^\]]+)\]/);
  if (!m) return null;
  const items = m[1].match(/["']([^"']+)["']/g);
  if (!items) return null;
  return items.map((s) => s.replace(/["']/g, ""));
}

/** 对比表格组件 */
function CompareTable({ records, apiBase }: { records: BacktestRecord[]; apiBase: string }) {
  if (records.length === 0) return null;

  const metrics = [
    { label: "交易数", key: "total_trades", fmt: (v: number | null) => v != null ? String(v) : "-" },
    { label: "年化收益", key: "annual_return", fmt: (v: number | null) => v != null ? `${(v * 100).toFixed(2)}%` : "-", colorize: true },
    { label: "夏普比率", key: "sharpe_ratio", fmt: (v: number | null) => v != null ? v.toFixed(2) : "-" },
    { label: "最大回撤", key: "max_drawdown", fmt: (v: number | null) => v != null ? `${(v * 100).toFixed(2)}%` : "-", bad: true },
    { label: "胜率", key: "win_rate", fmt: (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : "-" },
    { label: "盈亏比", key: "profit_factor", fmt: (v: number | null) => v != null ? v.toFixed(2) : "-" },
    { label: "多头占比", key: "long_pct", fmt: (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : "-" },
    { label: "空头占比", key: "short_pct", fmt: (v: number | null) => v != null ? `${(v * 100).toFixed(1)}%` : "-" },
  ];

  // 找出每个指标的最优值索引
  const bestIdx: Record<string, number> = {};
  for (const m of metrics) {
    let best = -1;
    let bestVal = -Infinity;
    records.forEach((r, i) => {
      const v = (r as unknown as Record<string, number | null>)[m.key];
      if (v == null) return;
      const score = m.bad ? -v : v;
      if (score > bestVal) { bestVal = score; best = i; }
    });
    if (best >= 0) bestIdx[m.key] = best;
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className="text-left px-4 py-2 bg-gray-50 border border-gray-200 font-medium text-gray-600">指标</th>
          {records.map((r) => (
            <th key={r.job_id} className="text-center px-4 py-2 bg-gray-50 border border-gray-200">
              <div className="font-mono text-xs font-bold">{r.job_id.slice(3, 11)}</div>
              <div className="text-xs text-gray-400">{r.created_at ? new Date(r.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""}</div>
              <div className="text-xs text-gray-500">{r.sdt} ~ {r.edt}</div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {metrics.map((m) => (
          <tr key={m.key}>
            <td className="px-4 py-2 border border-gray-200 font-medium text-gray-700 bg-gray-50">{m.label}</td>
            {records.map((r, i) => {
              const v = (r as unknown as Record<string, number | null>)[m.key];
              const isBest = bestIdx[m.key] === i && records.length > 1;
              let textColor = "text-gray-800";
              if (m.colorize && v != null) textColor = v >= 0 ? "text-green-600" : "text-red-600";
              if (m.bad && v != null) textColor = "text-red-500";
              return (
                <td
                  key={r.job_id}
                  className={`px-4 py-2 border border-gray-200 text-center font-mono ${textColor} ${isBest ? "bg-yellow-50 font-bold" : ""}`}
                >
                  {m.fmt(v)}
                  {isBest && <span className="ml-1 text-yellow-600">★</span>}
                </td>
              );
            })}
          </tr>
        ))}
        <tr>
          <td className="px-4 py-2 border border-gray-200 font-medium text-gray-700 bg-gray-50">报告链接</td>
          {records.map((r) => (
            <td key={r.job_id} className="px-4 py-2 border border-gray-200 text-center">
              <div className="flex gap-1 justify-center">
                {r.has_lwc_report && (
                  <a
                    href={`${apiBase}/api/v1/backtests/${r.job_id}/lwc_report?token=${encodeURIComponent(typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                  >
                    K线
                  </a>
                )}
                {r.has_wbt_report && (
                  <a
                    href={`${apiBase}/api/v1/backtests/${r.job_id}/report?token=${encodeURIComponent(typeof window !== "undefined" ? localStorage.getItem("access_token") || "" : "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200"
                  >
                    报告
                  </a>
                )}
              </div>
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}

export default function BacktestPage() {
  const params = useParams();
  const strategyId = params.id as string;
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [htmlReportUrl, setHtmlReportUrl] = useState("");
  const [lwcReportUrl, setLwcReportUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  // 历史记录
  const [history, setHistory] = useState<BacktestRecord[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showCompare, setShowCompare] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // 策略元数据（从 API 加载）
  const [strategyName, setStrategyName] = useState("");
  const [strategyCode, setStrategyCode] = useState("");
  const [strategyType, setStrategyType] = useState("");
  const [strategyFreq, setStrategyFreq] = useState("");
  const [multiFreqs, setMultiFreqs] = useState<string[] | null>(null);

  // 回测参数
  const [symbol, setSymbol] = useState("SYM");
  const [freq, setFreq] = useState("30分钟");
  // 默认日期：加密货币默认回测1周，模拟数据默认3年
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(today.getDate() - 7);
  const fmtDate = (d: Date) => d.toISOString().split("T")[0];
  const [sdt, setSdt] = useState(fmtDate(weekAgo));
  const [edt, setEdt] = useState(fmtDate(today));
  const [dataSource, setDataSource] = useState<"mock" | "crypto">("mock");

  // 加载历史记录
  const loadHistory = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/v1/strategies/${strategyId}/backtests`);
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (e) {
      console.warn("历史记录加载失败", e);
    }
  }, [strategyId]);

  // 删除回测记录
  const handleDelete = async (jobId: string) => {
    if (!confirm(`确认删除回测记录 ${jobId}？`)) return;
    setDeletingId(jobId);
    try {
      await apiDelete(`/api/v1/backtests/${jobId}`);
      setHistory((prev) => prev.filter((r) => r.job_id !== jobId));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    } catch (e) {
      alert(`删除失败: ${e}`);
    } finally {
      setDeletingId(null);
    }
  };

  // 切换选中状态
  const toggleSelect = (jobId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  // 加载策略信息 → 自动填充所有参数
  useEffect(() => {
    apiFetch(`/api/v1/strategies/${strategyId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject("Not found")))
      .then((data) => {
        setStrategyName(data.name || "未命名策略");
        setStrategyType(data.strategy_type || "");
        setStrategyFreq(data.freq || "30分钟");

        // 自动识别数据源：加密货币策略 → crypto
        const isCrypto = (data.strategy_type || "").startsWith("demo_crypto");
        setDataSource(isCrypto ? "crypto" : "mock");
        setSymbol(isCrypto ? "BTC/USDT" : "SYM");
        setFreq(data.freq || (isCrypto ? "15分钟" : "30分钟"));

        // 日期默认值：加密货币1周，模拟数据3年
        const now = new Date();
        if (isCrypto) {
          const weekAgo = new Date(now);
          weekAgo.setDate(now.getDate() - 7);
          setSdt(fmtDate(weekAgo));
          setEdt(fmtDate(now));
        } else {
          const threeYearsAgo = new Date(now);
          threeYearsAgo.setFullYear(now.getFullYear() - 3);
          setSdt(fmtDate(threeYearsAgo));
          setEdt(fmtDate(now));
        }

        if (data.code) {
          setStrategyCode(data.code);
          // 检测多周期策略
          const freqs = parseFreqsFromCode(data.code);
          if (freqs && freqs.length > 1) {
            setMultiFreqs(freqs);
            // 多周期策略：基础周期取最小的
            setFreq(freqs[0]);
            // MTF 策略加密货币默认至少60天数据以保证日线周期有足够K线
            const minDays = 60;
            const minSdt = new Date(now);
            minSdt.setDate(now.getDate() - minDays);
            setSdt(fmtDate(minSdt));
            setEdt(fmtDate(now));
          }
        }
      })
      .catch((e) => {
        console.warn("策略加载失败", e);
      });
    // 加载历史记录
    loadHistory();
  }, [strategyId, loadHistory]);

  const handleBacktest = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    setHtmlReportUrl("");
    setLwcReportUrl("");
    try {
      const res = await apiFetch(`/api/v1/strategies/${strategyId}/backtest`, {
        method: "POST",
        body: JSON.stringify({
          symbol, freq, sdt, edt,
          fee_rate: 0.0002,
          strategy_type: strategyType,
          data_source: dataSource,
          code: strategyCode, // 发送用户自定义代码
        }),
      });
      const data = await res.json();
      if (data.status === "completed") {
        setResult(data.stats);
        if (data.html_report_url) {
          // 构建带 token 的完整 URL（iframe 无法携带 Authorization header）
          const accessToken = localStorage.getItem("access_token") || "";
          const fullUrl = `${API_BASE}${data.html_report_url}?token=${encodeURIComponent(accessToken)}`;
          setHtmlReportUrl(fullUrl);
        }
        if (data.lwc_report_url) {
          const accessToken = localStorage.getItem("access_token") || "";
          setLwcReportUrl(`${API_BASE}${data.lwc_report_url}?token=${encodeURIComponent(accessToken)}`);
        }
        // 回测成功后刷新历史记录
        loadHistory();
      } else {
        setError(data.error || "回测失败");
      }
    } catch (e) {
      setError(`API 连接失败: ${e}`);
    } finally {
      setRunning(false);
    }
  };

  const handleDataSourceChange = (ds: "mock" | "crypto") => {
    setDataSource(ds);
    if (ds === "crypto") {
      setSymbol("BTC/USDT");
      setFreq(strategyFreq || "15分钟");
      // 加密货币默认1周
      const now = new Date();
      const weekAgo = new Date(now);
      weekAgo.setDate(now.getDate() - 7);
      setSdt(fmtDate(weekAgo));
      setEdt(fmtDate(now));
    } else {
      setSymbol("SYM");
      setFreq(strategyFreq || "30分钟");
      // 模拟数据默认3年
      const now = new Date();
      const ago = new Date(now);
      ago.setFullYear(now.getFullYear() - 3);
      setSdt(fmtDate(ago));
      setEdt(fmtDate(now));
    }
  };

  return (
    <div className="space-y-6">
      {/* 页面标题：动态显示策略名 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {strategyName ? `${strategyName} · 回测` : "回测"}
          </h2>
          {strategyType && (
            <p className="text-sm text-gray-500 mt-1">
              策略类型: <span className="font-mono text-gray-700">{strategyType}</span>
              {multiFreqs && (
                <span className="ml-2 px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
                  多周期: {multiFreqs.join(" + ")}
                </span>
              )}
            </p>
          )}
        </div>
        <div className="flex gap-3">
          <a href={`/strategies/${strategyId}/editor`} className="text-sm text-blue-600 hover:underline">策略编辑器</a>
          <a href="/strategies" className="text-sm text-gray-400 hover:underline">返回列表</a>
        </div>
      </div>

      {/* 回测参数 */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4 shadow-sm">
        <h3 className="font-semibold text-gray-700">回测参数</h3>

        {/* 数据源切换 */}
        <div className="flex gap-2">
          <button
            onClick={() => handleDataSourceChange("mock")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              dataSource === "mock" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            模拟数据
          </button>
          <button
            onClick={() => handleDataSourceChange("crypto")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              dataSource === "crypto" ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            加密货币 (Gate.io)
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 标的 */}
          <div>
            <label className="text-xs text-gray-500">标的</label>
            <input
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              className="w-full p-2 border rounded mt-1 text-sm font-mono"
              placeholder={dataSource === "crypto" ? "BTC/USDT" : "SYM"}
            />
          </div>

          {/* 周期：单周期策略可选，多周期策略只读显示 */}
          <div>
            <label className="text-xs text-gray-500">
              基础周期
              {multiFreqs && <span className="text-purple-600 ml-1">(多周期策略)</span>}
            </label>
            {multiFreqs ? (
              <input
                value={multiFreqs.join(" + ")}
                readOnly
                className="w-full p-2 border rounded mt-1 text-sm bg-purple-50 text-purple-700 font-medium"
              />
            ) : (
              <select value={freq} onChange={(e) => setFreq(e.target.value)} className="w-full p-2 border rounded mt-1 text-sm">
                {dataSource === "crypto"
                  ? ["5分钟", "15分钟", "30分钟", "1小时", "4小时", "日线"].map((f) => <option key={f}>{f}</option>)
                  : ["30分钟", "日线", "60分钟", "15分钟"].map((f) => <option key={f}>{f}</option>)}
              </select>
            )}
          </div>

          {/* 回测日期 */}
          <div>
            <label className="text-xs text-gray-500">开始日期</label>
            <input type="date" value={sdt} onChange={(e) => setSdt(e.target.value)} className="w-full p-2 border rounded mt-1 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">结束日期</label>
            <input type="date" value={edt} onChange={(e) => setEdt(e.target.value)} className="w-full p-2 border rounded mt-1 text-sm" />
          </div>
        </div>

        {/* 提示：多周期策略说明 */}
        {multiFreqs && (
          <p className="text-xs text-purple-600 bg-purple-50 p-2 rounded">
            多周期共振策略：数据使用 <strong>{multiFreqs[0]}</strong> 为基础周期，策略内部自动生成
            {multiFreqs.slice(1).join("、")} 周期进行联合分析。
          </p>
        )}

        <button
          onClick={handleBacktest}
          disabled={running}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium disabled:opacity-50 transition-colors"
        >
          {running ? "回测执行中..." : "开始回测"}
        </button>
      </div>

      {/* Error (already in results section, skip standalone) */}

      {/* Running indicator */}
      {running && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-blue-600 font-medium">
            正在执行 czsc + wbt 回测...
          </p>
          <p className="text-blue-400 text-sm mt-1">
            {dataSource === "crypto"
              ? "从 Gate.io 获取真实数据 -> 策略信号匹配 -> 计算绩效"
              : "生成K线数据 -> 策略信号匹配 -> 计算绩效指标"}
          </p>
        </div>
      )}

      {/* Results: 只展示 HTML 报告，避免与报告内容重复 */}
      {(result || error) && (
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-600 font-medium">回测失败</p>
              <p className="text-red-500 text-sm mt-1">{error}</p>
            </div>
          )}

          {/* HTML Report iframe */}
          {htmlReportUrl && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="font-semibold">回测报告</h3>
                <div className="flex gap-3">
                  {lwcReportUrl && (
                    <a href={lwcReportUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      K线图表
                    </a>
                  )}
                  <a href={htmlReportUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                    新窗口打开
                  </a>
                </div>
              </div>
              <iframe
                src={htmlReportUrl}
                className="w-full border-0"
                style={{ height: "900px" }}
                title="Backtest Report"
              />
            </div>
          )}
        </>
      )}

      {/* 回测历史记录 */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h3 className="font-semibold">回测历史记录 <span className="text-gray-400 text-sm font-normal">({history.length})</span></h3>
            <div className="flex gap-2">
              {selectedIds.size >= 2 && (
                <button
                  onClick={() => setShowCompare(true)}
                  className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700"
                >
                  对比选中 ({selectedIds.size})
                </button>
              )}
              {selectedIds.size > 0 && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200"
                >
                  清除选择
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left w-8">
                    <input
                      type="checkbox"
                      checked={history.every((r) => selectedIds.has(r.job_id))}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedIds(new Set(history.map((r) => r.job_id)));
                        else setSelectedIds(new Set());
                      }}
                      className="rounded"
                    />
                  </th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">时间</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">标的</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">数据源</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">周期</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">回测区间</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">交易数</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">年化收益</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">夏普</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">最大回撤</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">胜率</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">多/空占比</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">报告</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">操作</th>
                </tr>
              </thead>
              <tbody>
                {history.map((rec) => (
                  <tr
                    key={rec.job_id}
                    className={`border-b border-gray-100 hover:bg-gray-50 ${selectedIds.has(rec.job_id) ? "bg-purple-50" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(rec.job_id)}
                        onChange={() => toggleSelect(rec.job_id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-3 py-2 text-gray-600 font-mono text-xs whitespace-nowrap">
                      {rec.created_at ? new Date(rec.created_at).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "-"}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{rec.symbol}</td>
                    <td className="px-3 py-2 text-xs">
                      {rec.data_source === "crypto" ? (
                        <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">加密货币</span>
                      ) : rec.data_source === "mock" ? (
                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">模拟</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{rec.freq}</td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">{rec.sdt} ~ {rec.edt}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{rec.total_trades ?? "-"}</td>
                    <td className={`px-3 py-2 text-right font-mono text-xs ${(rec.annual_return ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {rec.annual_return != null ? `${(rec.annual_return * 100).toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">{rec.sharpe_ratio != null ? rec.sharpe_ratio.toFixed(2) : "-"}</td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-red-500">
                      {rec.max_drawdown != null ? `${(rec.max_drawdown * 100).toFixed(2)}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs">
                      {rec.win_rate != null ? `${(rec.win_rate * 100).toFixed(1)}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-right text-xs whitespace-nowrap">
                      {rec.long_pct != null ? `${(rec.long_pct * 100).toFixed(0)}%` : "-"}
                      {" / "}
                      {rec.short_pct != null ? `${(rec.short_pct * 100).toFixed(0)}%` : "-"}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex gap-1 justify-center">
                        {rec.has_lwc_report && (
                          <a
                            href={`${API_BASE}/api/v1/backtests/${rec.job_id}/lwc_report?token=${encodeURIComponent(localStorage.getItem("access_token") || "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded hover:bg-blue-200"
                            title="K线图表"
                          >
                            K线
                          </a>
                        )}
                        {rec.has_wbt_report && (
                          <a
                            href={`${API_BASE}/api/v1/backtests/${rec.job_id}/report?token=${encodeURIComponent(localStorage.getItem("access_token") || "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded hover:bg-green-200"
                            title="缠论报告"
                          >
                            报告
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleDelete(rec.job_id)}
                        disabled={deletingId === rec.job_id}
                        className="text-red-500 hover:text-red-700 text-xs disabled:opacity-50"
                        title="删除"
                      >
                        {deletingId === rec.job_id ? "..." : "删除"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 对比弹窗 */}
      {showCompare && selectedIds.size >= 2 && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowCompare(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white z-10">
              <h3 className="font-semibold text-lg">回测结果对比</h3>
              <button onClick={() => setShowCompare(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="p-6 overflow-x-auto">
              <CompareTable
                records={history.filter((r) => selectedIds.has(r.job_id))}
                apiBase={API_BASE}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
