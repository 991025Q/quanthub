"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { apiFetch, apiGet, apiPost, apiDelete } from "@/lib/api";

// ---------- Types ----------
interface PaperAccount {
  id: string;
  user_id: string;
  name: string;
  initial_capital: number;
  cash: number;
  equity: number;
  symbol: string;
  strategy_id: string | null;
  freq: string;
  status: string;
  last_bar_dt: string | null;
  created_at: string;
  updated_at: string;
}

interface PaperPosition {
  id: string;
  account_id: string;
  symbol: string;
  direction: string;
  volume: number;
  avg_price: number;
  current_price: number | null;
  unrealized_pnl: number;
  realized_pnl: number;
  opened_at: string;
  closed_at: string | null;
}

interface PaperOrder {
  id: string;
  account_id: string;
  symbol: string;
  direction: string;
  order_type: string;
  price: number | null;
  volume: number;
  filled_price: number | null;
  filled_volume: number;
  fee: number;
  status: string;
  signal: string | null;
  created_at: string;
}

interface PaperTrade {
  id: string;
  order_id: string;
  account_id: string;
  price: number;
  volume: number;
  fee: number;
  symbol?: string;
  direction?: string;
  signal?: string;
  created_at: string;
}

interface EquityPoint {
  dt: string;
  equity: number;
  cash: number;
}

interface Metrics {
  total_trades: number;
  total_return: number;
  annualized_return: number;
  max_drawdown: number;
  win_rate: number;
  profit_factor: number;
  total_realized_pnl: number;
  total_fees: number;
  wins: number;
  losses: number;
  days_trading: number;
}

interface StrategyOption {
  id: string;
  name: string;
  code: string;
  freq: string;
}

// ---------- Helpers ----------
function formatPnl(v: number): string {
  const prefix = v >= 0 ? "+" : "";
  return `${prefix}¥${v.toFixed(2)}`;
}

function pnlColor(v: number): string {
  return v >= 0 ? "text-red-600" : "text-green-600";
}

function formatDate(s: string): string {
  if (!s) return "-";
  try {
    const d = new Date(s);
    return d.toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch {
    return s;
  }
}

// ---------- Components ----------

function CreateAccountModal({
  onClose,
  onCreated,
  strategies,
}: {
  onClose: () => void;
  onCreated: (acc: PaperAccount) => void;
  strategies: StrategyOption[];
}) {
  const [name, setName] = useState("纸盘账号");
  const [capital, setCapital] = useState(1000000);
  const [symbol, setSymbol] = useState("BTC_USDT");
  const [freq, setFreq] = useState("30分钟");
  const [strategyId, setStrategyId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    setLoading(true);
    try {
      const acc = await apiPost<PaperAccount>("/api/v1/trade/paper/accounts", {
        name,
        initial_capital: capital,
        symbol,
        freq,
        strategy_id: strategyId || null,
      });
      onCreated(acc);
      onClose();
    } catch (e: any) {
      alert("创建失败: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">创建纸盘账号</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">名称</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">初始资金</label>
            <input type="number" className="w-full border rounded-lg px-3 py-2 text-sm" value={capital} onChange={(e) => setCapital(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">交易标的</label>
            <input className="w-full border rounded-lg px-3 py-2 text-sm" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="如 BTC_USDT, ETH_USDT" />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">K线周期</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={freq} onChange={(e) => setFreq(e.target.value)}>
              <option>1分钟</option>
              <option>5分钟</option>
              <option>15分钟</option>
              <option>30分钟</option>
              <option>1小时</option>
              <option>4小时</option>
              <option>日线</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">绑定策略 (可选)</label>
            <select className="w-full border rounded-lg px-3 py-2 text-sm" value={strategyId} onChange={(e) => setStrategyId(e.target.value)}>
              <option value="">不绑定</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({s.freq})</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">取消</button>
          <button onClick={handleCreate} disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-50">
            {loading ? "创建中..." : "创建"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EquityChart({ data }: { data: EquityPoint[] }) {
  if (!data || data.length < 2) {
    return <p className="text-sm text-gray-400 text-center py-8">权益曲线数据不足 (需要至少2个数据点)</p>;
  }

  const equities = data.map((d) => d.equity);
  const minEq = Math.min(...equities);
  const maxEq = Math.max(...equities);
  const range = maxEq - minEq || 1;

  const W = 600;
  const H = 150;
  const PAD = 10;

  const points = data.map((d, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - 2 * PAD);
    const y = H - PAD - ((d.equity - minEq) / range) * (H - 2 * PAD);
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(" L ")}`;
  const lastEq = equities[equities.length - 1];
  const firstEq = equities[0];
  const isUp = lastEq >= firstEq;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36">
      <path d={pathD} fill="none" stroke={isUp ? "#dc2626" : "#16a34a"} strokeWidth="2" />
      <text x={PAD} y={H - 2} fontSize="10" fill="#9ca3af">{`¥${minEq.toFixed(0)}`}</text>
      <text x={PAD} y={12} fontSize="10" fill="#9ca3af">{`¥${maxEq.toFixed(0)}`}</text>
    </svg>
  );
}

function AccountCard({
  account,
  isSelected,
  onSelect,
  onStart,
  onStop,
  onDelete,
  onTick,
}: {
  account: PaperAccount;
  isSelected: boolean;
  onSelect: () => void;
  onStart: () => void;
  onStop: () => void;
  onDelete: () => void;
  onTick: () => void;
}) {
  const totalPnl = account.equity - account.initial_capital;
  const pnlPct = ((totalPnl / account.initial_capital) * 100).toFixed(2);

  return (
    <div
      onClick={onSelect}
      className={`bg-white rounded-xl p-5 border-2 cursor-pointer transition-all hover:shadow-md ${
        isSelected ? "border-blue-500 shadow-md" : "border-gray-200"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{account.name}</h3>
          <p className="text-xs text-gray-500">{account.symbol} · {account.freq}</p>
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
          account.status === "active" ? "bg-green-100 text-green-700" :
          account.status === "paused" ? "bg-yellow-100 text-yellow-700" :
          "bg-gray-100 text-gray-600"
        }`}>
          {account.status === "active" ? "运行中" : account.status === "paused" ? "已暂停" : "已停止"}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div>
          <p className="text-xs text-gray-500">权益</p>
          <p className="text-sm font-bold">¥{account.equity.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">现金</p>
          <p className="text-sm font-medium">¥{account.cash.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">总盈亏</p>
          <p className={`text-sm font-bold ${pnlColor(totalPnl)}`}>
            {formatPnl(totalPnl)} ({pnlPct}%)
          </p>
        </div>
      </div>

      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        {account.status !== "active" ? (
          <button onClick={onStart} className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-xs hover:bg-green-700">启动</button>
        ) : (
          <>
            <button onClick={onTick} className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-xs hover:bg-blue-700">推进K线</button>
            <button onClick={onStop} className="flex-1 px-3 py-1.5 bg-yellow-600 text-white rounded text-xs hover:bg-yellow-700">暂停</button>
          </>
        )}
        <button onClick={onDelete} className="px-3 py-1.5 border border-red-200 text-red-600 rounded text-xs hover:bg-red-50">删除</button>
      </div>
    </div>
  );
}

// ---------- Main Page ----------
export default function TradingPage() {
  const [accounts, setAccounts] = useState<PaperAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [positions, setPositions] = useState<PaperPosition[]>([]);
  const [orders, setOrders] = useState<PaperOrder[]>([]);
  const [trades, setTrades] = useState<PaperTrade[]>([]);
  const [equityCurve, setEquityCurve] = useState<EquityPoint[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [strategies, setStrategies] = useState<StrategyOption[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"positions" | "orders" | "trades">("positions");
  const [orderDirection, setOrderDirection] = useState<"buy" | "sell">("buy");
  const [orderVolume, setOrderVolume] = useState(100);
  const [orderPrice, setOrderPrice] = useState("");
  const [tickLoading, setTickLoading] = useState(false);
  const [orderLoading, setOrderLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch accounts
  const fetchAccounts = useCallback(async () => {
    try {
      const data = await apiGet<PaperAccount[]>("/api/v1/trade/paper/accounts");
      setAccounts(data);
      if (data.length > 0 && !selectedId) {
        setSelectedId(data[0].id);
      }
    } catch {
      // ignore
    }
  }, [selectedId]);

  // Fetch strategies for dropdown
  const fetchStrategies = useCallback(async () => {
    try {
      const data = await apiGet<StrategyOption[]>("/api/v1/strategies");
      setStrategies(data);
    } catch {
      // ignore
    }
  }, []);

  // Fetch account details
  const fetchDetails = useCallback(async (accountId: string) => {
    try {
      const [pos, ord, trd, curve, met] = await Promise.all([
        apiGet<PaperPosition[]>(`/api/v1/trade/paper/accounts/${accountId}/positions`),
        apiGet<PaperOrder[]>(`/api/v1/trade/paper/accounts/${accountId}/orders`),
        apiGet<PaperTrade[]>(`/api/v1/trade/paper/accounts/${accountId}/trades`),
        apiGet<EquityPoint[]>(`/api/v1/trade/paper/accounts/${accountId}/equity-curve`),
        apiGet<Metrics>(`/api/v1/trade/paper/accounts/${accountId}/metrics`),
      ]);
      setPositions(pos);
      setOrders(ord);
      setTrades(trd);
      setEquityCurve(curve);
      setMetrics(met);
    } catch {
      // ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchAccounts();
    fetchStrategies();
  }, [fetchAccounts, fetchStrategies]);

  // Load details when selected
  useEffect(() => {
    if (selectedId) {
      fetchDetails(selectedId);
    }
  }, [selectedId, fetchDetails]);

  // Polling for active accounts
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const selected = accounts.find((a) => a.id === selectedId);
    if (selected?.status === "active") {
      pollRef.current = setInterval(() => {
        fetchAccounts();
        if (selectedId) fetchDetails(selectedId);
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [accounts, selectedId, fetchAccounts, fetchDetails]);

  const selectedAccount = accounts.find((a) => a.id === selectedId);

  // Actions
  const handleStart = async (id: string) => {
    try {
      await apiPost(`/api/v1/trade/paper/accounts/${id}/start`, {});
      fetchAccounts();
    } catch (e: any) {
      alert("启动失败: " + e.message);
    }
  };

  const handleStop = async (id: string) => {
    try {
      await apiPost(`/api/v1/trade/paper/accounts/${id}/stop`, {});
      fetchAccounts();
    } catch (e: any) {
      alert("暂停失败: " + e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除该纸盘账号？所有数据将丢失。")) return;
    try {
      await apiDelete(`/api/v1/trade/paper/accounts/${id}`);
      if (selectedId === id) setSelectedId(null);
      fetchAccounts();
    } catch (e: any) {
      alert("删除失败: " + e.message);
    }
  };

  const handleTick = async (id: string) => {
    setTickLoading(true);
    try {
      const result = await apiPost<any>(`/api/v1/trade/paper/accounts/${id}/tick`, {});
      if (result.error) {
        alert("推进失败: " + result.error);
      }
      fetchAccounts();
      if (selectedId === id) fetchDetails(id);
    } catch (e: any) {
      alert("推进失败: " + e.message);
    } finally {
      setTickLoading(false);
    }
  };

  const handleManualOrder = async () => {
    if (!selectedId) return;
    setOrderLoading(true);
    try {
      const result = await apiPost<any>(`/api/v1/trade/paper/accounts/${selectedId}/order`, {
        direction: orderDirection,
        volume: orderVolume,
        price: orderPrice ? Number(orderPrice) : null,
      });
      if (result.error) {
        alert("下单失败: " + result.error);
      }
      fetchAccounts();
      fetchDetails(selectedId);
    } catch (e: any) {
      alert("下单失败: " + e.message);
    } finally {
      setOrderLoading(false);
    }
  };

  // Summary stats
  const totalEquity = accounts.reduce((s, a) => s + a.equity, 0);
  const totalCapital = accounts.reduce((s, a) => s + a.initial_capital, 0);
  const totalPnl = totalEquity - totalCapital;
  const openPositions = positions.filter((p) => !p.closed_at && p.volume > 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">纸盘交易</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
        >
          + 创建纸盘账号
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-500">总权益</p>
          <p className="text-2xl font-bold mt-1">¥{totalEquity.toFixed(2)}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-500">总盈亏</p>
          <p className={`text-2xl font-bold mt-1 ${pnlColor(totalPnl)}`}>
            {formatPnl(totalPnl)}
          </p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-500">纸盘账号</p>
          <p className="text-2xl font-bold mt-1">{accounts.length}</p>
        </div>
        <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
          <p className="text-sm text-gray-500">当前持仓</p>
          <p className="text-2xl font-bold mt-1">{openPositions.length}</p>
        </div>
      </div>

      {/* Account cards */}
      {accounts.length === 0 ? (
        <div className="bg-white rounded-xl p-12 border border-gray-200 text-center">
          <p className="text-gray-400 mb-4">暂无纸盘账号</p>
          <button onClick={() => setShowCreateModal(true)} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
            创建第一个纸盘账号
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((acc) => (
            <AccountCard
              key={acc.id}
              account={acc}
              isSelected={acc.id === selectedId}
              onSelect={() => setSelectedId(acc.id)}
              onStart={() => handleStart(acc.id)}
              onStop={() => handleStop(acc.id)}
              onDelete={() => handleDelete(acc.id)}
              onTick={() => handleTick(acc.id)}
            />
          ))}
        </div>
      )}

      {/* Selected account detail */}
      {selectedAccount && (
        <>
          {/* Equity curve */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <h3 className="font-semibold mb-3">权益曲线</h3>
            <EquityChart data={equityCurve} />
          </div>

          {/* Metrics */}
          {metrics && metrics.total_trades > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">总收益率</p>
                <p className={`text-lg font-bold ${pnlColor(metrics.total_return)}`}>{metrics.total_return}%</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">年化收益</p>
                <p className={`text-lg font-bold ${pnlColor(metrics.annualized_return)}`}>{metrics.annualized_return}%</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">最大回撤</p>
                <p className="text-lg font-bold text-green-600">{metrics.max_drawdown}%</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">胜率</p>
                <p className="text-lg font-bold">{metrics.win_rate}%</p>
              </div>
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs text-gray-500">盈亏比</p>
                <p className="text-lg font-bold">{metrics.profit_factor}</p>
              </div>
            </div>
          )}

          {/* Manual order panel */}
          <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
            <h3 className="font-semibold mb-3">手动下单</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-xs text-gray-500 mb-1">方向</label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setOrderDirection("buy")}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      orderDirection === "buy" ? "bg-red-600 text-white" : "bg-red-50 text-red-600"
                    }`}
                  >
                    买入
                  </button>
                  <button
                    onClick={() => setOrderDirection("sell")}
                    className={`px-4 py-2 rounded text-sm font-medium ${
                      orderDirection === "sell" ? "bg-green-600 text-white" : "bg-green-50 text-green-600"
                    }`}
                  >
                    卖出
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">数量</label>
                <input
                  type="number"
                  className="w-24 border rounded-lg px-3 py-2 text-sm"
                  value={orderVolume}
                  onChange={(e) => setOrderVolume(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">价格 (留空=市价)</label>
                <input
                  type="number"
                  step="0.01"
                  className="w-28 border rounded-lg px-3 py-2 text-sm"
                  value={orderPrice}
                  onChange={(e) => setOrderPrice(e.target.value)}
                  placeholder="市价"
                />
              </div>
              <button
                onClick={handleManualOrder}
                disabled={orderLoading}
                className={`px-6 py-2 rounded-lg text-sm font-medium text-white ${
                  orderDirection === "buy" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"
                } disabled:opacity-50`}
              >
                {orderLoading ? "下单中..." : orderDirection === "buy" ? "买入" : "卖出"}
              </button>
            </div>
          </div>

          {/* Tabs: Positions / Orders / Trades */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200">
              {(["positions", "orders", "trades"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab === "positions" ? `持仓 (${positions.filter(p => !p.closed_at && p.volume > 0).length})` :
                   tab === "orders" ? `委托 (${orders.length})` : `成交 (${trades.length})`}
                </button>
              ))}
            </div>

            {/* Positions table */}
            {activeTab === "positions" && (
              <div>
                {positions.filter(p => !p.closed_at && p.volume > 0).length === 0 ? (
                  <p className="p-8 text-center text-gray-400">暂无持仓</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标的</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">方向</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">数量</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">成本价</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">现价</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">未实现盈亏</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">已实现盈亏</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {positions.filter(p => !p.closed_at && p.volume > 0).map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium">{p.symbol}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              p.direction === "long" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                            }`}>
                              {p.direction === "long" ? "多" : "空"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right">{p.volume}</td>
                          <td className="px-4 py-3 text-sm text-right">¥{p.avg_price.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right">{p.current_price ? `¥${p.current_price.toFixed(2)}` : "-"}</td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${pnlColor(p.unrealized_pnl)}`}>
                            {formatPnl(p.unrealized_pnl)}
                          </td>
                          <td className={`px-4 py-3 text-sm text-right font-medium ${pnlColor(p.realized_pnl)}`}>
                            {formatPnl(p.realized_pnl)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Orders table */}
            {activeTab === "orders" && (
              <div>
                {orders.length === 0 ? (
                  <p className="p-8 text-center text-gray-400">暂无委托记录</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标的</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">方向</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">数量</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">成交价</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">手续费</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">信号</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(o.created_at)}</td>
                          <td className="px-4 py-3 text-sm font-medium">{o.symbol}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              o.direction === "buy" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                            }`}>
                              {o.direction === "buy" ? "买入" : "卖出"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right">{o.filled_volume || o.volume}</td>
                          <td className="px-4 py-3 text-sm text-right">{o.filled_price ? `¥${o.filled_price.toFixed(2)}` : "-"}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">¥{o.fee.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{o.signal || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              o.status === "filled" ? "bg-green-100 text-green-700" :
                              o.status === "pending" ? "bg-yellow-100 text-yellow-700" :
                              "bg-gray-100 text-gray-600"
                            }`}>
                              {o.status === "filled" ? "已成交" : o.status === "pending" ? "待成交" : o.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            {/* Trades table */}
            {activeTab === "trades" && (
              <div>
                {trades.length === 0 ? (
                  <p className="p-8 text-center text-gray-400">暂无成交记录</p>
                ) : (
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">时间</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">标的</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">方向</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">数量</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">价格</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">手续费</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">信号</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {trades.map((t) => (
                        <tr key={t.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-500">{formatDate(t.created_at)}</td>
                          <td className="px-4 py-3 text-sm font-medium">{t.symbol || "-"}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              t.direction === "buy" ? "bg-red-50 text-red-600" : "bg-green-50 text-green-600"
                            }`}>
                              {t.direction === "buy" ? "买入" : "卖出"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-right">{t.volume}</td>
                          <td className="px-4 py-3 text-sm text-right">¥{t.price.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-right text-gray-500">¥{t.fee.toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-gray-500">{t.signal || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create modal */}
      {showCreateModal && (
        <CreateAccountModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(acc) => {
            setAccounts((prev) => [acc, ...prev]);
            setSelectedId(acc.id);
          }}
          strategies={strategies}
        />
      )}
    </div>
  );
}
