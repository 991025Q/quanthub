# QuantHub 生产部署指南

## 服务器信息

| 项目 | 值 |
|------|------|
| 服务器 | `8.210.216.79` |
| 系统 | Ubuntu 22.04 LTS |
| 部署路径 | `/opt/quanthub` |
| 访问地址 | `http://8.210.216.79` (port 80) |
| API 地址 | `http://8.210.216.79:8000` |
| 前端直连 | `http://8.210.216.79:3000` |

## 架构概览

```
Client (Browser)
    │
    ▼
┌─────────────┐   port 80
│   Nginx     │ ──────────────────────────┐
│  (Alpine)   │                           │
└─────────────┘                           │
    │                                     │
    ├── /api/*  → api:8000                │
    ├── /       → web:3000 (Next.js)      │
    └── /_next/ → web:3000 (静态资源)      │
                                          │
┌─────────────┐    ┌─────────────┐        │
│ quanthub-api│    │ quanthub-web│        │
│  (FastAPI)  │    │  (Next.js)  │        │
│  port 8000  │    │  port 3000  │        │
└──────┬──────┘    └─────────────┘        │
       │                                  │
       ├── postgres:5432 (PostgreSQL 16)  │
       ├── redis:6379    (Redis 7)        │
       └── minio:9000    (MinIO)          │
                                          │
┌──────────────┐   ┌──────────────┐       │
│quanthub-worker│  │ quanthub-beat│       │
│ (Celery)     │   │ (定时任务)    │       │
└──────────────┘   └──────────────┘       │
```

## 前置条件

1. **SSH 免密登录** (已配置)
   ```powershell
   # Windows PowerShell 一键配置
   Get-Content "$env:USERPROFILE\.ssh\id_rsa.pub" | ssh root@8.210.216.79 "mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys; chmod 700 ~/.ssh"
   ```

2. **Docker & Docker Compose** (已安装)
   ```bash
   curl -fsSL https://get.docker.com | sh
   docker --version
   docker compose version
   ```

## 部署步骤

### 1. 打包上传项目

```powershell
# 在本地打包 (排除不必要的文件)
cd d:\learn\clun\quanthub
tar --exclude='node_modules' --exclude='.next' --exclude='.git' --exclude='__pycache__' --exclude='data_cache' --exclude='output' --exclude='quanthub.db' --exclude='*.pyc' -czf C:\temp\quanthub.tar.gz .

# 上传到服务器
scp C:\temp\quanthub.tar.gz root@8.210.216.79:/root/

# 在服务器解压
ssh root@8.210.216.79 "mkdir -p /opt/quanthub; cd /opt/quanthub; tar xzf /root/quanthub.tar.gz"
```

### 2. 配置环境变量

在服务器上创建 `/opt/quanthub/.env`:

```bash
ssh root@8.210.216.79 "cat > /opt/quanthub/.env << 'EOF'
DEBUG=false
SECRET_KEY=<your-random-64-char-string>

# PostgreSQL (Docker 内部网络)
POSTGRES_DB=quanthub
POSTGRES_USER=quanthub
POSTGRES_PASSWORD=quanthub
DATABASE_URL=postgresql+asyncpg://quanthub:quanthub@postgres:5432/quanthub

# Redis
REDIS_URL=redis://redis:6379/0
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2

# MinIO
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=quanthub

# 权重管理
WMR_BACKEND=duckdb

# AI (Dashscope)
DASHSCOPE_API_KEY=sk-xxx
DASHSCOPE_API_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
DASHSCOPE_MODEL=qwen-plus
DASHSCOPE_ENABLED=true

# 前端 (浏览器直接访问的公网地址)
NEXT_PUBLIC_API_URL=http://8.210.216.79
NEXT_PUBLIC_WS_URL=ws://8.210.216.79
EOF"
```

### 3. 启动服务

```bash
# 释放 port 80 (如果有 sshd 占用)
fuser -k 80/tcp

# 构建并启动所有服务
cd /opt/quanthub
docker compose up -d --build

# 检查状态
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

### 4. 验证

```bash
# 检查前端
curl -s -o /dev/null -w 'HTTP %{http_code}' http://localhost:80
# 期望: HTTP 200

# 检查 API 健康
curl http://localhost:8000/health
# 期望: {"status":"ok"}
```

## 常用运维命令

```bash
# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f              # 所有服务
docker compose logs -f api          # 仅 API
docker compose logs -f web          # 仅前端
docker compose logs -f nginx        # 仅 Nginx

# 重启单个服务
docker compose restart api
docker compose restart web
docker compose restart nginx

# 更新部署 (代码变更后)
cd /opt/quanthub
# 1. 重新上传变更文件 (scp)
# 2. 重新构建并启动
docker compose up -d --build

# 停止所有服务
docker compose down

# 停止并清除数据卷 (谨慎!)
docker compose down -v
```

## Nginx 配置要点

文件: `/opt/quanthub/nginx/nginx.conf`

关键设计决策:
- **Docker DNS 解析**: 使用 `resolver 127.0.0.11` + `set $upstream` 变量方式, 避免 nginx 启动时因上游服务未就绪而失败
- **limit_req_zone**: 必须放在 `server {}` 块外部
- **WebSocket**: `/api/v1/ws/` 路径需要单独配置 `Upgrade` 和 `Connection` 头

## 端口分配

| 服务 | 容器端口 | 宿主机端口 |
|------|---------|-----------|
| Nginx (前端入口) | 80 | **80** |
| Next.js | 3000 | 3000 |
| FastAPI | 8000 | 8000 |
| PostgreSQL | 5432 | 5432 |
| Redis | 6379 | 6379 |
| MinIO API | 9000 | 9000 |
| MinIO Console | 9001 | 9001 |

## 注意事项

1. **Port 80 冲突**: 服务器 sshd 可能监听 80 端口, 每次重启服务前需先 `fuser -k 80/tcp`
2. **Docker 内部 DNS**: nginx 配置必须使用变量 + resolver 模式, 否则容器启动顺序会导致解析失败
3. **前端 API 地址**: `.env` 中 `NEXT_PUBLIC_API_URL` 必须设为公网 IP, 因为前端在浏览器中运行
4. **后端 API 地址**: `.env` 中 `DATABASE_URL` 使用 `postgres` (Docker 服务名), 不是公网 IP
5. **Next.js standalone**: `next.config.ts` 中 `output: "standalone"` 确保 Docker 镜像包含所有依赖
