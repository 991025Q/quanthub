# QuantHub - SaaS 多租户量化交易平台

基于 czsc 生态构建的量化交易 SaaS 平台，支持缠论策略编写、自然语言策略生成、专业回测和实盘交易。

## 核心特性

- **策略编写**：代码模式 (Monaco Editor) / 可视化拖拽 / 自然语言 AI 生成
- **缠论支持**：内置 czsc 缠论信号库，三买/三卖/笔/线段等
- **专业回测**：基于 wbt 的权重回测引擎 + 绩效分析报告
- **权重管理**：基于 wmr 的权重落库 / 版本管理 / 归因分析（DuckDB/ClickHouse 双后端）
- **交易执行**：纸盘模拟 + 国金证券 QMT 实盘
- **多租户**：组织/团队/用户层级，Free/Pro/Enterprise 订阅计划

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js 14 + TypeScript + Tailwind CSS |
| 后端 | FastAPI + SQLAlchemy 2.0 + Celery |
| 数据库 | PostgreSQL 16 + Redis 7 |
| 对象存储 | MinIO |
| 权重存储 | DuckDB (默认) / ClickHouse (Enterprise) |
| 缠论引擎 | czsc + wbt + wmr |
| 实盘接口 | QMT (国金证券) |
| 部署 | Docker Compose |

## 快速开始

### 前置要求

- Docker & Docker Compose
- Node.js 18+ (前端开发)
- Python 3.12+ (后端开发)

### 1. 克隆并配置

```bash
cd quanthub
cp .env.example .env
# 编辑 .env 设置 SECRET_KEY 等
```

### 2. Docker 启动

```bash
# 开发模式（热重载）
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 生产模式
docker compose up -d

# Enterprise 模式（含 ClickHouse）
docker compose --profile enterprise up -d
```

### 3. 访问

- 前端: http://localhost:3000
- API 文档: http://localhost:8000/docs
- MinIO 控制台: http://localhost:9001

### 4. 本地开发（不使用 Docker）

```bash
# 后端
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
```

## 项目结构

```
quanthub/
├── docs/
│   └── architecture/
│       └── DESIGN.md              # 完整架构设计文档
├── backend/                       # FastAPI 后端
│   ├── app/
│   │   ├── main.py                # 应用入口
│   │   ├── config.py              # 配置管理
│   │   ├── database.py            # 数据库连接
│   │   ├── dependencies.py        # 依赖注入
│   │   ├── models/                # SQLAlchemy 模型
│   │   ├── schemas/               # Pydantic 模型
│   │   ├── api/v1/                # API 路由
│   │   ├── services/              # 业务逻辑
│   │   ├── tasks/                 # Celery 异步任务
│   │   ├── core/                  # 核心工具 (安全/租户/异常)
│   │   └── templates/             # 策略模板
│   ├── migrations/                # Alembic 迁移
│   ├── tests/
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/                      # Next.js 前端
│   ├── src/
│   │   ├── app/                   # 页面路由
│   │   ├── components/            # UI 组件
│   │   ├── lib/                   # API 客户端/工具
│   │   └── hooks/                 # React Hooks
│   └── Dockerfile
├── nginx/
│   └── nginx.conf
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
└── README.md
```

## czsc 生态闭环

```
czsc（缠论分析 + 信号） → wbt（权重回测） → wmr（权重落地 + 版本管理） → 实盘消费
```

| 组件 | 角色 |
|------|------|
| [czsc](https://github.com/waditu/czsc) | 缠论核心算法 + 信号/事件/交易体系 |
| [wbt](https://github.com/zengbin93/wbt) | 权重回测引擎 |
| [wmr](https://github.com/zengbin93/wmr) | 权重管理系统 (DuckDB/ClickHouse) |

## API 文档

启动后端后访问 http://localhost:8000/docs 查看自动生成的 OpenAPI 文档。

关键端点：

| 模块 | 端点 | 说明 |
|------|------|------|
| 认证 | `POST /api/v1/auth/register` | 注册 |
| 策略 | `POST /api/v1/strategies` | 创建策略 |
| 策略 | `POST /api/v1/strategies/from-natural-language` | NL 生成策略 |
| 回测 | `POST /api/v1/strategies/{id}/backtest` | 提交回测 |
| 权重 | `GET /api/v1/weights/{id}/snapshots` | 权重快照 |
| 交易 | `POST /api/v1/strategies/{id}/publish` | 发布策略 |
| 信号 | `GET /api/v1/signals` | 信号函数列表 |

## 策略 Demo

内置 3 个策略模板（`backend/app/templates/`）：

1. **缠论三买策略** - 基于 czsc 经典三买信号
2. **双均线策略** - 入门级均线交叉
3. **笔方向策略** - 基于缠论笔的方向判断

## 许可证

MIT License
