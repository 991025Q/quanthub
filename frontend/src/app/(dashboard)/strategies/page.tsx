"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Strategy {
  id: string;
  name: string;
  status: string;
  version: number;
  updated_at: string;
  description: string;
  freq: string;
  strategy_type: string;
}

const statusMap: Record<string, { label: string; cls: string }> = {
  draft: { label: "草稿", cls: "bg-gray-100 text-gray-600" },
  validated: { label: "已验证", cls: "bg-green-100 text-green-700" },
  backtesting: { label: "回测中", cls: "bg-yellow-100 text-yellow-700" },
  published: { label: "已发布", cls: "bg-blue-100 text-blue-700" },
};

const demoStrategies = [
  { name: "缠论三买策略", description: "30分钟级别三买做多，笔向下平仓", strategy_type: "demo_third_buy", freq: "30分钟" },
  { name: "笔方向跟踪", description: "30分钟笔向上做多，涨停过滤", strategy_type: "demo_bi_direction", freq: "30分钟" },
  { name: "双均线交叉", description: "日线级别双均线金叉做多、死叉平仓", strategy_type: "demo_dual_ma", freq: "日线" },
];

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchStrategies = () => {
    apiFetch("/api/v1/strategies")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setStrategies(data))
      .catch(() => setStrategies([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStrategies(); }, []);

  const createDemoStrategy = async (demo: typeof demoStrategies[0]) => {
    setCreating(true);
    try {
      const res = await apiFetch("/api/v1/strategies", {
        method: "POST",
        body: JSON.stringify(demo),
      });
      if (res.ok) fetchStrategies();
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteStrategy = async (strategyId: string, strategyName: string) => {
    if (!confirm(`确定要删除策略「${strategyName}」吗？此操作不可恢复。`)) {
      return;
    }
    setDeletingId(strategyId);
    try {
      const res = await apiFetch(`/api/v1/strategies/${strategyId}`, {
        method: "DELETE",
      });
      if (res.ok) fetchStrategies();
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = filter === "all" ? strategies : strategies.filter((s) => s.status === filter);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">策略管理</h2>
        <a
          href="/strategies/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + 新建策略
        </a>
      </div>

      {/* Create demo strategies */}
      {strategies.length === 0 && !loading && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
          <h3 className="font-semibold text-blue-800 mb-3">快速创建 Demo 策略</h3>
          <p className="text-sm text-blue-600 mb-4">点击下方按钮快速创建演示策略，创建后可直接回测</p>
          <div className="flex gap-3 flex-wrap">
            {demoStrategies.map((d) => (
              <button
                key={d.name}
                onClick={() => createDemoStrategy(d)}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                + {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      {strategies.length > 0 && (
        <div className="flex gap-2">
          {["all", "draft", "validated", "backtesting", "published"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f === "all" ? "全部" : statusMap[f]?.label ?? f}
              <span className="ml-1 opacity-70">
                ({f === "all" ? strategies.length : strategies.filter((s) => s.status === f).length})
              </span>
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <p className="text-gray-400">加载中...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
          <p className="text-gray-500 text-lg">暂无策略</p>
          <p className="text-gray-400 mt-2">使用上方的 Demo 按钮快速创建</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">描述</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">周期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((s) => {
                const st = statusMap[s.status] ?? statusMap.draft;
                return (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-medium text-gray-900">{s.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{s.updated_at}</p>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{s.description}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">{s.freq}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <a href={`/strategies/${s.id}/editor`} className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 rounded text-sm hover:bg-gray-200 transition-colors">
                        编辑
                      </a>
                      <a href={`/strategies/${s.id}/backtest`} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
                        回测
                      </a>
                      <button
                        onClick={() => handleDeleteStrategy(s.id, s.name)}
                        disabled={deletingId === s.id}
                        className="inline-flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 rounded text-sm hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {deletingId === s.id ? "删除中..." : "删除"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
