/**
 * API 工具模块 - 统一处理 API 调用的认证头和基础 URL
 */

// 使用 Next.js rewrite 代理（同源，避免 CORS 问题）
const API_BASE = "";

/** 获取带认证的 headers */
export function authHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

/** 检查 JWT token 是否已过期 */
function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.exp && payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

/** 处理 401 未授权：仅在 token 确实过期/无效时清除并跳转 */
function handleUnauthorized(path: string) {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    // 如果是认证端点自身的 401（登录密码错误等），不跳转
    if (path.includes("/auth/login") || path.includes("/auth/register")) {
      return;
    }
    // 如果 token 未过期，说明可能是临时问题，仅打印警告
    if (token && !isTokenExpired(token)) {
      console.warn(`[API] 401 on ${path} but token is still valid, skipping redirect`);
      return;
    }
    // token 已过期或不存在，清除并跳转登录
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }
}

/** 封装 fetch，自动带上 API_BASE 和认证头 */
export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const headers = {
    ...authHeaders(),
    ...(init?.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    handleUnauthorized(path);
  }
  return res;
}

/** 安全解析 JSON，非 JSON 响应返回文本包装的错误 */
async function safeJson<T>(res: Response): Promise<T> {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  // 非 JSON 响应（如 "Internal Server Error" 纯文本）
  const text = await res.text().catch(() => `HTTP ${res.status}`);
  throw new Error(`服务器返回非 JSON 响应 (${res.status}): ${text.slice(0, 200)}`);
}

/** GET 请求 */
export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) {
    const err = await safeJson<{ detail?: string }>(res).catch(() => null);
    throw new Error(err?.detail || `API error: ${res.status}`);
  }
  return safeJson<T>(res);
}

/** POST 请求 */
export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const res = await apiFetch(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await safeJson<{ detail?: string; error?: string }>(res).catch(() => null);
    throw new Error(err?.detail || err?.error || `API error: ${res.status}`);
  }
  return safeJson<T>(res);
}

/** DELETE 请求 */
export async function apiDelete<T>(path: string): Promise<T> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) {
    const err = await safeJson<{ detail?: string }>(res).catch(() => null);
    throw new Error(err?.detail || `API error: ${res.status}`);
  }
  return safeJson<T>(res);
}
