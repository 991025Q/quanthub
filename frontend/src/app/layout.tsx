import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QuantHub - 量化交易平台",
  description: "SaaS 多租户量化交易平台，支持缠论策略编写、回测与实盘交易",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
