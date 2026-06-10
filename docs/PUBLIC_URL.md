# QuantHub 公网访问部署指南

## 概述

前端运行在本地开发机（`localhost:3000`），通过 Cloudflare Tunnel 创建公网 URL，供外部访问。

---

## 方案一：Cloudflare 永久域名（推荐）✅

### 原理

```
用户浏览器 → Cloudflare CDN (https://quanthub.sbs) → cloudflared (本地) → localhost:3000
```

使用自定义域名 `quanthub.sbs`，通过 Named Tunnel 建立永久连接。

### 当前配置

- **域名**: https://quanthub.sbs
- **Tunnel ID**: `bd1b5e4d-a871-43f9-a3b2-fb831bdb829d`
- **SSL 模式**: Flexible
- **DNS 记录**: CNAME → `bd1b5e4d-a871-43f9-a3b2-fb831bdb829d.cfargotunnel.com`

### 快速启动

```powershell
# 1. 构建并启动前端（生产模式）
cd d:\learn\clun\quanthub\frontend
npx next build
npx next start

# 2. 新开一个终端，启动 Cloudflare 隧道
cd d:\learn\clun\quanthub
.\start_cloudflare_tunnel.ps1
```

启动后访问: **https://quanthub.sbs**

### 首次设置（仅一次）

如果还未配置永久域名，运行：

```powershell
.\setup_cloudflare_tunnel.ps1
```

脚本会自动：
1. 登录 Cloudflare（打开浏览器认证）
2. 创建 Named Tunnel
3. 配置 DNS 路由
4. 生成配置文件

### ⚠️ 重要：DNS 记录手动配置

如果自动 DNS 路由失败（已有记录冲突），需要手动配置：

1. 打开 **Cloudflare Dashboard**: https://dash.cloudflare.com
2. 选择域名: `quanthub.sbs`
3. 点击 **DNS** → **Records**
4. **删除**现有的 A/CNAME 记录（指向其他 IP 或域名的记录）
5. **添加新记录**:
   ```
   Type:          CNAME
   Name:          @
   Target:        bd1b5e4d-a871-43f9-a3b2-fb831bdb829d.cfargotunnel.com
   Proxy status:  Proxied (橙色云朵 ☁️)
   TTL:           Auto
   ```
6. 保存后等待 1-2 分钟

### 验证 DNS 配置

```powershell
# 应该返回 Cloudflare IP (104.21.x.x 或 172.67.x.x)
nslookup quanthub.sbs 1.1.1.1
```

### Cloudflare 设置检查清单

| 设置项 | 正确值 | 说明 |
|--------|--------|------|
| **SSL/TLS Mode** | `Flexible` | 不能用 Full (strict)，会导致 525 错误 |
| **DNS Record Type** | `CNAME` | 不能用 A 记录 |
| **DNS Target** | `[tunnel-id].cfargotunnel.com` | 必须指向隧道 |
| **Proxy Status** | `Proxied` (橙色) | 必须开启 CDN 代理 |
| **Tunnel Status** | `Running` | cloudflared 进程必须运行 |

---

## 方案二：Cloudflare Quick Tunnel（临时）

### 原理

```
用户浏览器 → Cloudflare CDN → cloudflared (本地) → localhost:3000
```

cloudflared 在本地建立一条到 Cloudflare 的加密出站连接（QUIC 协议），Cloudflare 分配一个临时域名指向这条隧道。

### 一键启动

```powershell
# 1. 构建生产版本（必须！不能用 dev 模式，WebSocket HMR 会报 502）
cd d:\learn\clun\quanthub\frontend
npx next build

# 2. 启动生产服务器（使用 npx next start，不用 standalone 模式）
npx next start

# 3. 新开一个终端，启动隧道
cd d:\learn\clun\quanthub
d:\learn\clun\quanthub\tmp\cloudflared.exe tunnel --url http://localhost:3000
```

启动成功后会看到：

```
Your quick Tunnel has been created! Visit it at:
https://xxxxx-xxxxx-xxxxx.trycloudflare.com
```

访问该 URL 即可打开前端页面。

### 特点

| 项目 | 说明 |
|------|------|
| 费用 | 免费，无需注册 Cloudflare 账号 |
| 域名 | 每次启动随机生成，重启后变化 |
| HTTPS | 自动提供 SSL 证书 |
| 有效期 | 进程运行期间有效，关闭即失效 |
| 适用场景 | 开发演示、临时分享 |

---

## 注意事项

### ⚠️ 必须使用生产模式，不能用 `npm run dev`

`next dev` 开发模式依赖 WebSocket 进行 HMR（热模块替换），Cloudflare 免费隧道不支持 WebSocket 升级，会返回 502 错误，导致页面卡在加载动画。

**必须先用 `npx next build` 构建生产版本，再用 `node .next/standalone/server.js` 启动。** 生产模式没有 HMR，不依赖 WebSocket。

### 开发 vs 生产模式

| 模式 | 启动命令 | WebSocket | 隧道可用 |
|------|---------|-----------|---------|
| 开发 | `npm run dev` | 需要 | ❌ 不行 |
| 生产 | `next build` + `npx next start` | 不需要 | ✅ 可用 |

---

## 常见问题

### Q: Error 525 - SSL handshake failed

**原因**: Cloudflare SSL 模式设置为 `Full (strict)`，但本地应用没有 SSL 证书。

**解决**: 
1. 打开 Cloudflare Dashboard → SSL/TLS → Overview
2. 将 SSL 模式从 `Full (strict)` 改为 `Flexible`
3. 等待 1-2 分钟生效

### Q: 访问域名跳转到广告/停车页面

**原因**: DNS 记录未正确指向 Cloudflare Tunnel，仍指向域名停车服务。

**解决**: 
1. 打开 Cloudflare Dashboard → DNS → Records
2. 删除现有的 A 记录或错误的 CNAME 记录
3. 添加正确的 CNAME 记录（见上方"DNS 记录手动配置"部分）
4. 验证: `nslookup quanthub.sbs 1.1.1.1` 应返回 Cloudflare IP

### Q: 域名能固定吗？

可以，使用 Named Tunnel（见上方"方案一"）。需要：
1. 注册 Cloudflare 账号（免费）
2. 添加一个域名到 Cloudflare
3. 创建 Named Tunnel：`cloudflared tunnel create quanthub`
4. 配置 DNS 路由，之后域名就固定了

### Q: 隧道断了怎么自动重连？

cloudflared 内置自动重连机制，网络恢复后会自动重建连接。

### Q: 后端 API 也能通过这个 URL 访问吗？

可以。前端使用 Next.js rewrite 代理，所有 `/api/*` 请求由 Next.js 服务端转发到后端（`localhost:8002`），所以通过公网 URL 访问时 API 也能正常工作。

### ⚠️ AI 解析功能注意事项

AI 解析（策略解释）使用流式响应（SSE）。之前代码直接连接后端 API (`localhost:8002`)，在通过隧道访问时无法工作。现已修改为通过 Next.js 代理转发，确保流式响应也能正常工作。

配置了 `X-Accel-Buffering: no` 响应头来禁用代理缓冲，保证流式数据实时传输。

---

## 停止隧道

关闭运行 cloudflared 的终端窗口，或执行：

```powershell
# 查找进程
Get-Process cloudflared

# 强制关闭
taskkill /PID <进程号> /F
```

---

## cloudflared 下载

首次部署时需下载 cloudflared：

- **Windows**: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe
- 保存到 `d:\learn\clun\quanthub\tmp\cloudflared.exe`

---

## 废弃方案：SSH 反向隧道

之前尝试通过 SSH 反向隧道将远程服务器端口映射到本地，但 `connect.nmb1.seetacloud.com` 是 Docker 容器环境，仅暴露 SSH 端口（43648），HTTP 端口（80）未对外映射，因此无法使用。

如果后续有公网服务器（直接暴露 HTTP 端口），可使用：

```powershell
ssh -p <SSH_PORT> -R 80:127.0.0.1:3000 -N user@server
```

注意：必须用 `127.0.0.1` 而非 `localhost`，避免 IPv6 绑定问题。

## 当前公网 URL

### ✅ 永久域名（推荐）

- **URL**: https://quanthub.sbs
- **Tunnel ID**: `bd1b5e4d-a871-43f9-a3b2-fb831bdb829d`
- **配置时间**: 2026-06-02
- **状态**: ✅ 运行中

### 启动方式

```powershell
# 终端 1: 启动前端
cd frontend
npx next build
npx next start

# 终端 2: 启动隧道
..\start_cloudflare_tunnel.ps1
```

### 配置文件位置

- **隧道配置**: `C:\Users\aaron\.cloudflared\config.yml`
- **凭据文件**: `C:\Users\aaron\.cloudflared\bd1b5e4d-a871-43f9-a3b2-fb831bdb829d.json`
- **项目配置**: `d:\learn\clun\quanthub\cloudflared-config.yml`

### 管理脚本

| 脚本 | 用途 |
|------|------|
| `setup_cloudflare_tunnel.ps1` | 首次设置（仅运行一次） |
| `start_cloudflare_tunnel.ps1` | 启动隧道（每次使用） |
| `MANUAL_TUNNEL_SETUP.md` | 手动设置指南 | 