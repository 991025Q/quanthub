"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface Strategy {
  id: string;
  name: string;
  status: string;
  description: string;
  updated_at: string;
  version: number;
}

export default function DashboardPage() {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [user, setUser] = useState<{ email: string; role: string; tenant?: { name: string; plan: string } } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch("/api/v1/auth/me")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load user info (${r.status})`);
        return r.json();
      })
      .then((data) => setUser(data))
      .catch((err) => setError(err.message));
    apiFetch("/api/v1/strategies")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load strategies (${r.status})`);
        return r.json();
      })
      .then((data) => setStrategies(data))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">仪表盘</h2>
        {user && <span className="text-sm text-gray-500">{user.email} · {user.tenant?.name} ({user.tenant?.plan})</span>}
      </div>

      {/* Stats cards */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: "策略数", value: String(strategies.length), color: "bg-blue-50 text-blue-700", icon: "📝" },
          { label: "回测任务", value: "--", color: "bg-green-50 text-green-700", icon: "📊" },
          { label: "实盘账号", value: "0", color: "bg-purple-50 text-purple-700", icon: "💹" },
          { label: "今日收益", value: "--", color: "bg-orange-50 text-orange-700", icon: "📈" },
        ].map((card) => (
          <div key={card.label} className={`${card.color} rounded-xl p-6 shadow-sm`}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium opacity-80">{card.label}</p>
              <span className="text-xl">{card.icon}</span>
            </div>
            <p className="text-3xl font-bold mt-2">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Strategies list */}
      {strategies.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">我的策略</h3>
            <a href="/strategies" className="text-sm text-blue-600 hover:underline">查看全部 →</a>
          </div>
          <div className="divide-y divide-gray-100">
            {strategies.slice(0, 5).map((s) => (
              <div key={s.id} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{s.name}</p>
                  <p className="text-sm text-gray-500">{s.description}</p>
                </div>
                <a href={`/strategies/${s.id}/backtest`} className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition-colors">
                  ▶ 回测
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick actions */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">快速开始</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/strategies" className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group">
            <p className="font-medium group-hover:text-blue-600">🚀 创建策略</p>
            <p className="text-sm text-gray-500 mt-1">Demo / 代码 / 自然语言</p>
          </a>
          <a href="/signals" className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group">
            <p className="font-medium group-hover:text-blue-600">📡 浏览信号库</p>
            <p className="text-sm text-gray-500 mt-1">缠论 / 均线 / 量价 / 形态</p>
          </a>
          <a href="/trading" className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all group">
            <p className="font-medium group-hover:text-blue-600">💹 交易管理</p>
            <p className="text-sm text-gray-500 mt-1">纸盘模拟 / QMT 实盘</p>
          </a>
        </div>
      </div>
    </div>
  );
}
