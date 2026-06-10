/**
 * 市场行情页面
 */

"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";

interface StockQuote {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap?: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  timestamp: string;
}

interface MarketData {
  usStocks: StockQuote[];
  hkStocks: StockQuote[];
  lastUpdated: string;
}

export default function MarketPage() {
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"us" | "hk">("us");
  const [searchTerm, setSearchTerm] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  useEffect(() => {
    fetchMarketData();
    
    // 设置自动刷新
    let interval: NodeJS.Timeout;
    if (autoRefresh) {
      interval = setInterval(fetchMarketData, 30000); // 每30秒刷新一次
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchMarketData = async () => {
    try {
      setLoading(true);
      
      // 获取美股数据
      const usResponse = await apiFetch("/api/v1/market/quotes?market_type=us");
      const usData = await usResponse.json();
      
      // 获取港股数据
      const hkResponse = await apiFetch("/api/v1/market/quotes?market_type=hk");
      const hkData = await hkResponse.json();
      
      if (usData.success && hkData.success) {
        setMarketData({
          usStocks: usData.data || [],
          hkStocks: hkData.data || [],
          lastUpdated: new Date().toLocaleString("zh-CN"),
        });
        setError(null);
      } else {
        setError("获取行情数据失败");
      }
    } catch (err) {
      setError("获取行情数据失败");
      console.error("Failed to fetch market data:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
    if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
    if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
    if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
    return num.toString();
  };

  const filteredStocks = marketData 
    ? activeTab === "us" 
      ? marketData.usStocks.filter(stock => 
          stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : marketData.hkStocks.filter(stock => 
          stock.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
          stock.name.toLowerCase().includes(searchTerm.toLowerCase())
        )
    : [];

  if (loading && !marketData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">加载行情数据中...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">实时行情</h2>
        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">自动刷新</span>
          </label>
          <button
            onClick={fetchMarketData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? "刷新中..." : "手动刷新"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">
          {error}
        </div>
      )}

      {/* 市场选择标签 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6" aria-label="Tabs">
            <button
              onClick={() => setActiveTab("us")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "us"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              美股 ({marketData?.usStocks.length || 0})
            </button>
            <button
              onClick={() => setActiveTab("hk")}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === "hk"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              港股 ({marketData?.hkStocks.length || 0})
            </button>
          </nav>
        </div>
        
        {/* 搜索框 */}
        <div className="p-6 border-b border-gray-200">
          <div className="relative">
            <input
              type="text"
              placeholder={`搜索${activeTab === "us" ? "美股" : "港股"}代码或名称...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* 股票列表 */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">股票代码</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">最新价</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">涨跌额</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">涨跌幅</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">成交量</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">市值</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">最高</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">最低</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredStocks.map((stock) => (
                <tr key={stock.symbol} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stock.symbol}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{stock.name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium">${stock.price.toFixed(2)}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${stock.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
                  </td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${stock.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {stock.changePercent >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">{formatNumber(stock.volume)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                    {stock.marketCap ? `$${formatNumber(stock.marketCap)}` : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${stock.high.toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">${stock.low.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 空状态 */}
        {filteredStocks.length === 0 && !loading && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-lg">未找到匹配的股票</div>
            <div className="text-gray-500 text-sm mt-1">请尝试其他搜索条件</div>
          </div>
        )}
      </div>

      {/* 最后更新时间 */}
      {marketData && (
        <div className="text-center text-sm text-gray-500">
          最后更新: {marketData.lastUpdated}
        </div>
      )}
    </div>
  );
}