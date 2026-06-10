"use client";

import { useEffect, useState } from "react";
import { mockSignals, type MockSignal } from "@/lib/mock-data";
import { apiFetch } from "@/lib/api";

const categoryLabels: Record<string, string> = {
  all: "全部",
  chanlun: "缠论",
  ma: "均线",
  volume: "量价",
  pattern: "形态",
  custom: "自定义",
};

const categoryDescriptions: Record<string, string> = {
  chanlun: "缠论结构信号(笔/中枢/买卖点)",
  ma: "均线系统(单均线/双均线/均线排列)",
  volume: "成交量分析(放量/缩量/量价配合)",
  pattern: "K线形态(分型/笔/蜡烛图形态)",
  custom: "用户自定义信号",
};

const categories = Object.keys(categoryLabels);

export default function SignalsPage() {
  const [signals, setSignals] = useState<MockSignal[]>([]);
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiFetch("/api/v1/signals/")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setSignals(data))
      .catch(() => setSignals(mockSignals))
      .finally(() => setLoading(false));
  }, []);



  const filtered = signals.filter(
    (s) =>
      (category === "all" || s.category === category) &&
      (search === "" ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.display_name.toLowerCase().includes(search.toLowerCase()) ||
        s.description.toLowerCase().includes(search.toLowerCase()))
  );

  const categoryCounts = categories.reduce(
    (acc, c) => {
      acc[c] = c === "all" ? signals.length : signals.filter((s) => s.category === c).length;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">信号函数库</h2>
          <p className="text-sm text-gray-500 mt-1">
            共 {loading ? "..." : signals.length} 个信号函数 · 点击信号查看详细说明
          </p>
        </div>
      </div>

      {/* 信号格式说明卡片 */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-5">
        <h3 className="font-bold text-gray-900 mb-3">📋 信号字符串格式说明</h3>
        <div className="bg-white rounded-lg p-4 font-mono text-sm">
          <div className="text-gray-700 mb-2">
            <span className="text-blue-600 font-bold">30分钟</span>
            <span className="text-gray-400">_</span>
            <span className="text-green-600 font-bold">D1</span>
            <span className="text-gray-400">_</span>
            <span className="text-purple-600 font-bold">表里关系V230101</span>
            <span className="text-gray-400">_</span>
            <span className="text-orange-600 font-bold">向上</span>
            <span className="text-gray-400">_</span>
            <span className="text-gray-500">任意</span>
            <span className="text-gray-400">_</span>
            <span className="text-gray-500">任意</span>
            <span className="text-gray-400">_</span>
            <span className="text-gray-500">0</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3 text-xs">
            <div><span className="text-blue-600 font-semibold">周期</span><br/>30分钟/60分钟/日线</div>
            <div><span className="text-green-600 font-semibold">参数</span><br/>D1=最近一根K线</div>
            <div><span className="text-purple-600 font-semibold">信号名</span><br/>表里关系/三买辅助</div>
            <div><span className="text-orange-600 font-semibold">状态值</span><br/>向上/向下/三买</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500">正在加载信号库...</p>
          </div>
        </div>
      ) : (
        <>
      {/* 分类筛选和搜索 */}
      <div className="flex gap-4 items-center flex-wrap">
        <div className="flex gap-1 flex-wrap">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                category === c ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {categoryLabels[c]} ({categoryCounts[c] ?? 0})
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索信号名称或描述..."
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-64 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* 信号列表 */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-900">
            {categoryLabels[category]}信号
            {category !== "all" && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                - {categoryDescriptions[category] || ""}
              </span>
            )}
          </h3>
        </div>
        {filtered.length === 0 ? (
          <p className="p-8 text-center text-gray-400">
            {search ? `未找到匹配“${search}”的信号` : "暂无信号数据"}
          </p>
        ) : (
          filtered.map((s) => (
            <div key={s.name} className="p-4 hover:bg-blue-50 transition-colors border-b border-gray-100 last:border-b-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="font-mono text-sm font-bold text-blue-600">{s.name}</span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
                      {categoryLabels[s.category] ?? s.category}
                    </span>
                    <span className="px-2 py-0.5 bg-green-50 rounded text-xs text-green-700 font-medium">
                      来源: {s.source}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 mb-2">
                    <span className="font-semibold text-gray-900">{s.display_name}</span>
                    <span className="text-gray-500 ml-2">- {s.description}</span>
                  </p>
                  {s.example && (
                    <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                      <div className="text-xs text-gray-500 mb-1">📝 信号示例:</div>
                      <code className="text-xs font-mono text-blue-600">{s.example}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
        </>
      )}
    </div>
  );
}
