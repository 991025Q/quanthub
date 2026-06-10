"use client";

import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";

const navItems = [
  { href: "/", label: "仪表盘", icon: "📊" },
  { href: "/market", label: "行情", icon: "📈" },
  { href: "/strategies", label: "策略管理", icon: "📝" },
  { href: "/signals", label: "信号库", icon: "📡" },
  { href: "/trading", label: "交易", icon: "💹" },
  { href: "/settings", label: "设置", icon: "⚙️" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-10">
          <div className="flex items-center h-16 px-6 border-b border-gray-200">
            <h1 className="text-xl font-bold text-gray-900">QuantHub</h1>
          </div>
          <nav className="p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <span>{item.icon}</span>
                <span className="text-sm font-medium">{item.label}</span>
              </Link>
            ))}
          </nav>
          <div className="absolute bottom-4 left-4 right-4">
            <button
              onClick={() => {
                localStorage.removeItem("access_token");
                localStorage.removeItem("refresh_token");
                window.location.href = "/login";
              }}
              className="w-full px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-red-50 hover:text-red-600 transition-colors"
            >
              退出登录
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className="pl-64">
          <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
            <span className="text-sm text-gray-600">欢迎使用 QuantHub 量化交易平台</span>
            <span className="text-xs text-gray-400">API: {process.env.NEXT_PUBLIC_API_URL?.replace("http://", "") || "localhost:8002"}</span>
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
