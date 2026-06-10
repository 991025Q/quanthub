import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  allowedDevOrigins: ["*"],
  async rewrites() {
    // 使用 NEXT_PUBLIC_API_URL 环境变量，如果未设置则使用默认值
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://api:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
  // Disable buffering for streaming API responses
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "X-Accel-Buffering", value: "no" },
        ],
      },
    ];
  },
};

export default nextConfig;