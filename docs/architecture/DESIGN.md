# QuantHub - SaaS 多租户量化交易平台架构设计

> **版本**: v1.0 | **日期**: 2026-05-26 | **状态**: 初稿

---

## 1. 项目概览

QuantHub 是一个面向普通量化爱好者的 SaaS 多租户量化交易平台，基于 czsc 生态构建，提供：

- **策略编写**：代码模式 / 可视化拖拽 / 自然语言输入
- **缠论支持**：内置 czsc 缠论信号库 + 回测引擎
- **回测验证**：基于 wbt 的专业权重回测 + 绩效分析
- **权重管理**：基于 wmr 的权重落库 / 版本管理 / 归因分析
- **交易执行**：纸盘模拟 + 国金证券 QMT 实盘

### 1.1 czsc 生态闭环

```
czsc（缠论分析 + 信号） → wbt（权重回测） → wmr（权重落地 + 版本管理） → 实盘消费
```

| 组件 | 角色 | 来源 |
|------|------|------|
| czsc | 缠论核心算法 + 信号/事件/交易体系 | github.com/waditu/czsc |
| wbt | 权重回测引擎（Weight Back Test） | github.com/zengbin93/wbt |
| wmr | 权重管理系统（Weight Manager） | github.com/zengbin93/wmr |
| talib-rs | TA-Lib Rust 替代（测试校验） | github.com/0xcjun/talib-rs |

---

## 2. 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                   用户浏览器 (Next.js)                     │
│  Monaco Editor · 可视化拖拽 · 自然语言输入 · K线图表       │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS / WSS
┌──────────────────────▼──────────────────────────────────┐
│              API Gateway (Nginx / Traefik)               │
│              反向代理 · 静态资源 · 限流 · TLS              │
└──────────────────────┬──────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────┐
│              FastAPI 应用 (多租户核心)                      │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐   │
│  │ auth-service│ │strategy-svc  │ │ backtest-service │   │
│  │ 用户/租户/  │ │ 策略编写/    │ │ wbt 回测引擎/   │   │
│  │ 权限/订阅   │ │ 校验/NL转策略│ │ 结果分析        │   │
│  └─────────────┘ └──────────────┘ └─────────────────┘   │
│  ┌─────────────┐ ┌──────────────┐ ┌─────────────────┐   │
│  │weight-svc   │ │ trade-service│ │ data-service     │   │
│  │ wmr 权重    │ │ 纸盘/实盘    │ │ 行情/K线/指标   │   │
│  │ 落地/版本   │ │ QMT 对接     │ │ 多数据源        │   │
│  └─────────────┘ └──────────────┘ └─────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ signal-service (信号函数注册/查询/预览)            │   │
│  └──────────────────────────────────────────────────┘   │
└──────────┬───────────────┬──────────────────┬───────────┘
           │               │                  │
    ┌──────▼──────┐ ┌──────▼──────┐ ┌────────▼────────┐
    │ PostgreSQL  │ │ Redis       │ │ MinIO           │
    │ 多租户数据  │ │ 缓存/队列   │ │ 策略文件/回测   │
    └─────────────┘ └─────────────┘ └─────────────────┘
    ┌─────────────┐ ┌─────────────┐
    │ DuckDB      │ │ ClickHouse  │
    │ 权重分析    │ │ 权重分析    │
    │ (默认)      │ │ (Enterprise)│
    └─────────────┘ └─────────────┘
           │
    ┌──────▼──────────────────────────────────────────┐
    │         Celery Workers (异步任务)                  │
    │  回测任务 · 交易执行 · 数据下载 · 权重同步          │
    └──────┬──────────────────────────────────────────┘
           │
    ┌──────▼──────────────────────────────────────────┐
    │  czsc 核心引擎 → wbt 回测 → wmr 权重管理          │
    └──────┬──────────────────────────────────────────┘
           │
    ┌──────▼──────────────────────────────────────────┐
    │         QMT Gateway (国金证券实盘)                  │
    │  xtdata (行情) · xttrader (交易)                   │
    └─────────────────────────────────────────────────┘
```

---

## 3. 多租户设计

### 3.1 隔离策略

**共享数据库 + tenant_id 隔离**（初期简单，后期可拆分为独立数据库）

- 所有业务表均包含 `tenant_id` 外键
- SQLAlchemy 查询自动注入 tenant_id 过滤（通过 `Query.filter_by` 中间件）
- wmr 权重存储按 tenant_id 分区

### 3.2 租户层级

```
Organization (租户)
  └── Team (团队，可选)
        └── User (用户)
```

### 3.3 订阅计划

| 计划 | 策略数 | 回测次数/日 | 实盘账号 | 数据源 | 权重后端 |
|------|--------|-------------|----------|--------|----------|
| Free | 3 | 10 | 0 (仅纸盘) | 延迟行情 | DuckDB |
| Pro | 20 | 100 | 1 | 实时行情 | DuckDB |
| Enterprise | 无限 | 无限 | 5+ | 实时行情 + 自定义 | ClickHouse |

### 3.4 角色权限

| 角色 | 策略编辑 | 回测 | 交易 | 成员管理 | 计费管理 |
|------|----------|------|------|----------|----------|
| admin | Yes | Yes | Yes | Yes | Yes |
| developer | Yes | Yes | Yes (纸盘) | No | No |
| viewer | No | Yes (查看) | No | No | No |

---

## 4. 核心模块设计

### 4.1 用户与租户模块 (auth-service)

**职责**：注册/登录/JWT 鉴权、租户管理、成员与权限

**核心 API**：
- `POST /api/v1/auth/register` — 注册（自动创建租户）
- `POST /api/v1/auth/login` — 登录，返回 JWT access + refresh token
- `POST /api/v1/auth/refresh` — 刷新 token
- `GET /api/v1/tenants/{id}` — 租户详情
- `PUT /api/v1/tenants/{id}/subscription` — 变更订阅计划
- `POST /api/v1/tenants/{id}/members` — 邀请成员

**安全**：
- 密码：bcrypt 哈希
- JWT：RS256 签名，access token 30 分钟，refresh token 7 天
- API Key：用于程序化接入（生成 + 轮换）

### 4.2 策略编辑器模块 (strategy-service)

**三种编辑模式**：

#### 代码模式
- Monaco Editor（VSCode 同款内核）
- Python 策略模板 + czsc API 自动补全
- 语法检查 + 类型提示

#### 可视化模式
- 拖拽信号/条件/操作组合
- 图形化构建 Event（开仓/平仓条件）
- 自动生成 Python 代码

#### 自然语言模式
- 用户输入自然语言描述，如：
  - "当30分钟出现三买且不在涨停时做多，笔向下时平仓"
  - "5日均线上穿20日均线时买入，跌破10日均线时卖出"
- LLM 解析 → 生成策略代码 → 用户确认 → 保存
- 需要 LLM API 接入（OpenAI / 本地模型）

**策略版本管理**：
- 每次保存自动创建版本快照
- 支持版本对比、回滚
- 类似 Git 的 commit 概念

**内置 Demo 模板**：
1. 缠论三买策略 — 复用 czsc 经典三买信号
2. 双均线策略 — 入门级均线交叉
3. 笔方向策略 — 基于缠论笔的中级策略

### 4.3 信号与指标库 (signal-service)

**信号注册表**：
- 从 `czsc.signals.list_signal_names()` 自动扫描所有可用信号
- 分类标签：缠论结构 / 均线 / 量价 / 形态 / 自定义
- 每个信号附带参数说明和使用示例

**信号查询 API**：
```
GET /api/v1/signals                     # 全部信号列表
GET /api/v1/signals/{name}              # 单个信号详情
GET /api/v1/signals?category=chanlun    # 按分类筛选
POST /api/v1/signals/preview            # 信号预览（输入参数，输出K线标记图）
```

**自定义信号**：
- 用户可上传 Python 函数注册自定义信号
- 沙箱执行（限制 import / 文件访问 / 执行时间）
- 注册后可在策略中引用

### 4.4 回测引擎模块 (backtest-service)

**基于 czsc + wbt 的专业回测**：

```
用户策略 → CzscStrategyBase → strategy.backtest(bars) →
    ├── pairs_df (交易对)
    ├── holds_df (持仓序列)
    └── WeightBacktest (wbt 绩效分析)
              │
              ▼
    generate_backtest_report (wbt HTML 报告)
              │
              ▼
    weight_df → wmr 落库 (版本化存储)
```

**异步执行**：
- 通过 Celery 提交回测任务
- WebSocket 实时推送进度
- 大规模回测支持分片执行

**结果展示**：
- 绩效统计：年化收益/夏普/最大回撤/卡玛/胜率/盈亏比
- 收益曲线 + 回撤曲线
- 月度热力图
- 交易明细表
- 缠论 K 线图 + 买卖点标记（复用 lightweight-charts）

**策略对比**：
- 多策略同屏对比绩效指标
- 权重叠加分析

### 4.5 权重管理模块 (weight-service) -- 基于 wmr

**wmr 集成**：wmr（Weight Manager）提供权重的持久化、版本管理与查询能力。

**数据流**：
```
strategy 回测 → wbt 产出 weight_df → wmr 落库(versioned)
                                            ↓
trade-service 消费最新权重 → 生成交易指令 → QMT 下单
                                            ↓
实盘持仓 → 权重快照 → 同步回 wmr
```

**核心功能**：

| 功能 | 说明 |
|------|------|
| 权重落库 | 回测/实盘产出的权重序列自动持久化 |
| 版本管理 | 每次权重序列自动版本化，可追溯、对比、回滚 |
| 权重查询 | 按策略/标的/时间段查询持仓权重时序数据 |
| 归因分析 | 权重变动归因（signal / risk / manual） |
| 实盘消费 | trade-service 读取最新权重快照生成交易指令 |
| 多租户隔离 | wmr 按 tenant_id 分区存储 |

**API**：
```
GET  /api/v1/weights/{strategy_id}/snapshots      # 权重快照时序
GET  /api/v1/weights/{strategy_id}/versions        # 版本列表
GET  /api/v1/weights/{strategy_id}/attribution     # 归因分析
POST /api/v1/weights/compare                       # 多策略权重对比
WS   /api/v1/ws/weight-updates                     # 权重实时推送
```

**DuckDB vs ClickHouse 选型**：

| 维度 | DuckDB (默认) | ClickHouse (Enterprise) |
|------|---------------|-------------------------|
| 部署 | 单机嵌入式 | 分布式集群 |
| 数据规模 | < 1 亿行 | 数十亿行 |
| 运维 | 零运维 | 需专业运维 |
| 并发 | 中等 | 高并发 |
| wmr 支持 | 原生支持 | 原生支持 |
| 适用场景 | Free / Pro 租户 | Enterprise 租户 |

### 4.6 交易执行模块 (trade-service)

#### 纸盘交易
- 模拟撮合引擎：本地 tick 驱动
- 模拟滑点（可配置，默认 1 BP）
- 模拟手续费（可配置，默认 2 BP 单边）
- 成交延迟模拟（T+0 / T+1 可配）

#### 实盘交易 (QMT)
- 通过 xtdata 获取实时行情
- 通过 xttrader 执行交易指令
- 支持操作：下单/撤单/持仓查询/资金查询/委托查询

**风控体系**：
| 风控规则 | 说明 | 默认值 |
|----------|------|--------|
| 单笔限额 | 单笔委托最大金额 | 50 万 |
| 日交易限额 | 当日累计成交上限 | 200 万 |
| 持仓集中度 | 单标的最大持仓占比 | 30% |
| 止损线 | 组合净值止损触发 | -10% |
| 频率限制 | 每分钟最大下单次数 | 10 次 |

**告警通道**：飞书 Webhook / 微信 / 邮件 / 自定义 Webhook

### 4.7 行情数据模块 (data-service)

**统一数据接口**：

```python
class DataService:
    def get_kline(self, symbol: str, freq: str, sdt: str, edt: str) -> pd.DataFrame:
        """统一K线接口，返回标准格式 DataFrame"""
        ...

    def get_realtime_quote(self, symbols: list[str]) -> dict:
        """实时行情"""
        ...
```

**数据源**：

| 数据源 | 模块 | 市场 | 延迟 |
|--------|------|------|------|
| 聚宽 | jqdatasdk | A 股 | T+0 (有额度限制) |
| Tushare | tushare | A 股 / 港股 | T+0 |
| 天勤 | TQSDK | 期货 | 实时 |
| CCXT | ccxt | 加密货币 | 实时 |

**数据缓存**：
- 历史 K 线本地缓存（PostgreSQL + MinIO parquet）
- 增量更新：每日收盘后自动拉取新数据
- 缓存失效策略：按 symbol + freq + date 粒度

**实时行情**：
- WebSocket 推送到前端
- 支持订阅/退订
- 自动重连 + 心跳检测

---

## 5. 数据库设计

### 5.1 PostgreSQL（多租户关系数据）

```sql
-- 租户
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) UNIQUE NOT NULL,
    plan VARCHAR(20) DEFAULT 'free',  -- free/pro/enterprise
    max_strategies INT DEFAULT 3,
    max_backtests_per_day INT DEFAULT 10,
    max_trade_accounts INT DEFAULT 0,
    weight_backend VARCHAR(20) DEFAULT 'duckdb',  -- duckdb/clickhouse
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 用户
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    role VARCHAR(20) DEFAULT 'developer',  -- admin/developer/viewer
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 策略
CREATE TABLE strategies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    code TEXT NOT NULL,           -- Python 策略代码
    code_hash VARCHAR(64),       -- 代码 SHA256
    status VARCHAR(20) DEFAULT 'draft',  -- draft/validated/published/archived
    publish_target VARCHAR(20),  -- paper/live
    version INT DEFAULT 1,
    config JSONB DEFAULT '{}',   -- 策略参数配置
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 策略版本历史
CREATE TABLE strategy_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    strategy_id UUID REFERENCES strategies(id),
    version INT NOT NULL,
    code TEXT NOT NULL,
    change_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(strategy_id, version)
);

-- 回测任务
CREATE TABLE backtest_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    strategy_id UUID REFERENCES strategies(id),
    user_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',  -- pending/running/completed/failed
    params JSONB DEFAULT '{}',   -- 回测参数（时间范围/标的/费率等）
    result_ref VARCHAR(500),     -- MinIO 结果文件路径
    stats JSONB DEFAULT '{}',    -- 绩效摘要
    weight_version_id UUID,      -- wmr 权重版本 ID
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 交易账号
CREATE TABLE trade_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    user_id UUID REFERENCES users(id),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL,   -- paper/live
    broker VARCHAR(50),          -- qmt/...
    config JSONB DEFAULT '{}',   -- QMT 连接配置（加密存储）
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 委托单
CREATE TABLE trade_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    account_id UUID REFERENCES trade_accounts(id),
    strategy_id UUID REFERENCES strategies(id),
    symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,  -- buy/sell
    order_type VARCHAR(20) DEFAULT 'limit',  -- limit/market
    price DECIMAL(16,4),
    volume INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',  -- pending/submitted/filled/cancelled/rejected
    filled_price DECIMAL(16,4),
    filled_volume INT DEFAULT 0,
    fee DECIMAL(16,4) DEFAULT 0,
    broker_order_id VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 持仓
CREATE TABLE trade_positions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    account_id UUID REFERENCES trade_accounts(id),
    strategy_id UUID REFERENCES strategies(id),
    symbol VARCHAR(20) NOT NULL,
    direction VARCHAR(10) DEFAULT 'long',  -- long/short
    volume INT NOT NULL,
    avg_price DECIMAL(16,4) NOT NULL,
    current_price DECIMAL(16,4),
    unrealized_pnl DECIMAL(16,4),
    realized_pnl DECIMAL(16,4) DEFAULT 0,
    opened_at TIMESTAMPTZ DEFAULT NOW(),
    closed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 信号函数注册表
CREATE TABLE signals_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID,  -- NULL 表示全局信号
    name VARCHAR(200) NOT NULL,
    category VARCHAR(50),        -- chanlun/ma/volume/pattern/custom
    display_name VARCHAR(200),
    description TEXT,
    params_schema JSONB DEFAULT '{}',  -- 参数 JSON Schema
    source VARCHAR(20) DEFAULT 'czsc',  -- czsc/custom
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 行情缓存元信息
CREATE TABLE market_data_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    symbol VARCHAR(20) NOT NULL,
    freq VARCHAR(20) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    row_count INT,
    storage_path VARCHAR(500),  -- MinIO 路径
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(symbol, freq)
);
```

### 5.2 wmr 权重存储（DuckDB / ClickHouse）

```sql
-- 权重快照（时序数据，高频写入）
CREATE TABLE weight_snapshots (
    version_id UUID,
    strategy_id UUID,
    tenant_id UUID,
    dt TIMESTAMP,
    symbol VARCHAR(20),
    weight DECIMAL(12,6),
    source VARCHAR(20),  -- backtest/paper/live
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 权重版本元数据
CREATE TABLE weight_versions (
    version_id UUID PRIMARY KEY,
    strategy_id UUID,
    tenant_id UUID,
    backtest_job_id UUID,
    status VARCHAR(20),  -- draft/active/archived
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSON  -- 回测参数摘要
);

-- 权重变动归因
CREATE TABLE weight_attribution (
    id UUID PRIMARY KEY,
    version_id UUID,
    dt TIMESTAMP,
    symbol VARCHAR(20),
    delta DECIMAL(12,6),
    reason VARCHAR(20),  -- signal/risk/manual/timeout/stop_loss
    detail TEXT
);
```

**DuckDB vs ClickHouse 选型**：
- **DuckDB**：单机嵌入式，零运维，wmr 原生支持，适合 Free/Pro 租户
- **ClickHouse**：分布式集群，高并发查询性能更优，适合 Enterprise 租户
- 通过 wmr 抽象层切换，应用代码无感知

---

## 6. API 设计 (OpenAPI 3.0)

### 6.1 认证与租户

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/auth/register` | 注册 |
| POST | `/api/v1/auth/login` | 登录 |
| POST | `/api/v1/auth/refresh` | 刷新 token |
| GET | `/api/v1/auth/me` | 当前用户信息 |
| GET | `/api/v1/tenants/{id}` | 租户详情 |
| PUT | `/api/v1/tenants/{id}` | 更新租户 |
| POST | `/api/v1/tenants/{id}/members` | 邀请成员 |
| DELETE | `/api/v1/tenants/{id}/members/{user_id}` | 移除成员 |
| PUT | `/api/v1/tenants/{id}/subscription` | 变更订阅 |

### 6.2 策略管理

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/strategies` | 策略列表 |
| POST | `/api/v1/strategies` | 创建策略 |
| GET | `/api/v1/strategies/{id}` | 策略详情 |
| PUT | `/api/v1/strategies/{id}` | 更新策略 |
| DELETE | `/api/v1/strategies/{id}` | 删除策略 |
| POST | `/api/v1/strategies/{id}/validate` | 校验策略 |
| GET | `/api/v1/strategies/{id}/versions` | 版本历史 |
| POST | `/api/v1/strategies/{id}/rollback/{version}` | 回滚到指定版本 |
| POST | `/api/v1/strategies/from-natural-language` | NL 生成策略 |

### 6.3 回测

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/strategies/{id}/backtest` | 提交回测任务 |
| GET | `/api/v1/backtests/{job_id}` | 回测结果 |
| GET | `/api/v1/backtests` | 回测历史列表 |
| POST | `/api/v1/backtests/compare` | 多策略对比 |

### 6.4 权重管理

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/weights/{strategy_id}/snapshots` | 权重快照时序 |
| GET | `/api/v1/weights/{strategy_id}/versions` | 版本列表 |
| GET | `/api/v1/weights/{strategy_id}/attribution` | 归因分析 |
| POST | `/api/v1/weights/compare` | 多策略权重对比 |

### 6.5 交易

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/v1/strategies/{id}/publish` | 发布策略（纸盘/实盘） |
| GET | `/api/v1/trade/accounts` | 交易账号列表 |
| POST | `/api/v1/trade/accounts` | 创建交易账号 |
| PUT | `/api/v1/trade/accounts/{id}` | 更新交易账号 |
| DELETE | `/api/v1/trade/accounts/{id}` | 删除交易账号 |
| GET | `/api/v1/trade/orders` | 委托记录 |
| GET | `/api/v1/trade/positions` | 持仓列表 |
| POST | `/api/v1/trade/orders/{id}/cancel` | 撤单 |

### 6.6 信号库

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/v1/signals` | 信号函数列表 |
| GET | `/api/v1/signals/{name}` | 信号详情 |
| POST | `/api/v1/signals/preview` | 信号预览 |

### 6.7 WebSocket

| Path | 说明 |
|------|------|
| `/api/v1/ws/market-data` | 实时行情推送 |
| `/api/v1/ws/trade-updates` | 交易状态推送 |
| `/api/v1/ws/weight-updates` | 权重变动推送 |
| `/api/v1/ws/backtest-progress` | 回测进度推送 |

---

## 7. 部署方案

### 7.1 Docker Compose 服务编排

```yaml
services:
  api:        # FastAPI 应用 (uvicorn)
  web:        # Next.js 前端
  worker:     # Celery worker (回测/交易/权重同步)
  beat:       # Celery beat (定时任务：数据更新/持仓检查)
  postgres:   # PostgreSQL 多租户关系数据
  redis:      # Redis 缓存 + Celery broker
  nginx:      # Nginx 反向代理 + 静态资源
  minio:      # MinIO 对象存储 (策略文件/回测结果)
  duckdb:     # DuckDB 权重分析后端 (默认, 通过 wmr)
  clickhouse: # ClickHouse 权重分析后端 (Enterprise 可选)
```

### 7.2 环境配置

关键环境变量：
- `DATABASE_URL` — PostgreSQL 连接串
- `REDIS_URL` — Redis 连接串
- `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY`
- `JWT_SECRET_KEY` — JWT 签名密钥
- `WMR_BACKEND` — wmr 后端选择（duckdb / clickhouse）
- `WMR_DUCKDB_PATH` — DuckDB 文件路径
- `WMR_CLICKHOUSE_URL` — ClickHouse 连接串
- `QMT_ACCOUNT` / `QMT_PASSWORD` — QMT 账号
- `LLM_API_KEY` — 自然语言策略生成 LLM API

### 7.3 开发环境

```bash
# 克隆项目
git clone <repo> && cd quanthub

# 复制环境变量
cp .env.example .env

# 启动所有服务
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d

# 查看日志
docker compose logs -f api worker
```

---

## 8. 安全设计

| 维度 | 措施 |
|------|------|
| 认证 | JWT RS256 + refresh token 轮换 |
| 授权 | RBAC (admin/developer/viewer) + tenant_id 隔离 |
| 数据加密 | 敏感字段（QMT 密码）AES-256 加密存储 |
| 传输安全 | HTTPS + WSS (TLS 1.3) |
| API 限流 | Nginx 层 + FastAPI 中间件双重限流 |
| 代码沙箱 | 策略执行在隔离的 Docker 容器中 |
| 审计日志 | 所有关键操作（交易/策略发布/成员变更）记录审计日志 |
| SQL 注入 | SQLAlchemy ORM 参数化查询 |
| XSS | React 默认转义 + CSP Header |

---

## 9. 技术选型

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | Next.js 14 (App Router) | SSR + RSC，SEO 友好 |
| UI 组件 | shadcn/ui + Tailwind CSS | 现代化设计系统 |
| 代码编辑器 | Monaco Editor | VSCode 同款 |
| K 线图表 | lightweight-charts | TradingView 开源轻量版 |
| 后端框架 | FastAPI | 异步高性能，自动 OpenAPI 文档 |
| ORM | SQLAlchemy 2.0 | 类型安全，异步支持 |
| 任务队列 | Celery + Redis | 成熟稳定，支持定时任务 |
| 数据库 | PostgreSQL 16 | 多租户关系数据 |
| 缓存 | Redis 7 | 缓存 + 消息队列 |
| 对象存储 | MinIO | S3 兼容，策略文件/回测结果 |
| 权重存储 | DuckDB / ClickHouse | wmr 双后端支持 |
| 容器化 | Docker + Docker Compose | 开发部署一致性 |
| 反向代理 | Nginx | 静态资源 + TLS 终止 |
| 数据库迁移 | Alembic | SQLAlchemy 配套 |
| 缠论引擎 | czsc + wbt + wmr | 完整生态闭环 |
| 实盘接口 | QMT (xtdata + xttrader) | 国金证券 |
