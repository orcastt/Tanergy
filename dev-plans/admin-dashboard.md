# Admin 后台管理系统

**优先级**: P1 | **难度**: 高 | **预计**: 5-7 天 | **状态**: 🔄 后端 Provider Registry 完成，Admin Dashboard 前端开发中
**返回索引**: [phase2-commercial.md](phase2-commercial.md)

---

## 目标

搭建独立的管理后台 Web 应用，用于：
1. 查看所有 API 调用情况
2. 用户管理（查看/搜索/禁用）
3. 每个用户的 API 调用历史 + Token 消耗
4. 手动给用户充值积分
5. 统一模型管理（配置可用模型、定价、开关）
6. Provider 管理（CRUD，支持零代码新增 AI provider）
7. 订阅和支付状态管理

---

## 架构

```
┌─────────────────────────────────────────────────┐
│  Admin Dashboard (独立 Web App)                  │
│  Next.js 14 + React + TailwindCSS + shadcn/ui   │
│  部署: Vercel  域名: admin.tangent.ai            │
└─────────────┬───────────────────────────────────┘
              │ FastAPI REST API (Bearer JWT)
              ▼
┌─────────────────────────────────────────────────┐
│  FastAPI Backend (已有)                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐         │
│  │ Auth     │ │ Database │ │ Admin API│         │
│  │ (JWT +   │ │ (Postgre │ │ (/api/v1 │         │
│  │  OTP)    │ │  SQL)    │ │  /admin) │         │
│  └──────────┘ └──────────┘ └──────────┘         │
│  ┌──────────┐ ┌──────────┐                      │
│  │ Proxy    │ │ Billing  │                      │
│  │ (AI 调用 │ │ (Stripe  │                      │
│  │  代理)   │ │  支付)   │                      │
│  └──────────┘ └──────────┘                      │
└─────────────────────────────────────────────────┘
              │ API calls (API keys in env)
              ▼
┌─────────────────────────────────────────────────┐
│  AI Providers (Claude / GPT / Gemini / MiniMax) │
└─────────────────────────────────────────────────┘
```

---

## 已完成的 API

### FastAPI Admin 端点 (`backend/app/api/v1/admin.py`)

所有 admin 端点需要 JWT 认证 + `role=admin` 验证。

| 端点 | 方法 | 说明 | 状态 |
|------|------|------|------|
| `/api/v1/admin/stats` | GET | 仪表盘统计 (总用户/活跃/API调用量/积分) | ✅ |
| `/api/v1/admin/users` | GET | 用户列表 (分页 + 积分余额) | ✅ |
| `/api/v1/admin/users/{id}/toggle-active` | POST | 禁用/启用用户 | ✅ |
| `/api/v1/admin/credits/grant` | POST | 充值积分 | ✅ |
| `/api/v1/admin/credits/transactions` | GET | 积分流水 (按用户筛选) | ✅ |
| `/api/v1/admin/api-logs` | GET | API 调用日志 (按用户/provider/status 筛选) | ✅ |
| `/api/v1/admin/models` | GET/POST | 模型配置列表 + 新增 | ✅ |
| `/api/v1/admin/models/{id}` | PATCH/DELETE | 模型配置编辑 + 删除 | ✅ |

### 数据库表 (PostgreSQL)

| 表 | 说明 | 状态 |
|---|---|---|
| `users` | 用户表 (email, role, is_active, created_at) | ✅ |
| `credit_balances` | 积分余额 (user_id, balance, plan) | ✅ |
| `credit_transactions` | 积分流水 (user_id, amount, type, reason) | ✅ |
| `api_call_logs` | API 调用日志 (provider, model, tokens, latency, status) | ✅ |
| `model_configs` | 模型配置 (provider, model, pricing, is_active) | ✅ |

---

## Provider 可插拔架构 ✅ 已完成

### 设计

Provider 注册信息从硬编码迁移到 `providers` DB 表。新增 provider = Admin Dashboard 填表单 + 服务器加 env var，不需发版。

**providers 表字段**:
| 字段 | 类型 | 说明 |
|------|------|------|
| id | VARCHAR(50) PK | "deepseek" |
| name | VARCHAR(100) | "DeepSeek" |
| base_url | VARCHAR(500) | "https://api.deepseek.com/v1" |
| key_env | VARCHAR(100) | "DEEPSEEK_API_KEY" |
| auth_style | VARCHAR(20) | 'bearer' / 'x-api-key' / 'custom' |
| extra_headers | JSONB | {"anthropic-version": "2023-06-01"} |
| is_active | BOOLEAN | 启用/禁用 |

**新增 provider 流程（改造后）**:
1. Admin Dashboard 添加 provider → DB
2. 服务器 `.env` 加 API Key → 重启后端
3. Admin Dashboard 添加模型配置 → model_configs 表
4. 前端 `modelDefs.ts` 加模型条目 → 发版

**改造文件**:
- `backend/app/models/provider.py` — Provider SQLAlchemy 模型 ✅
- `backend/app/schemas/provider.py` — ProviderCreate/Out schemas ✅
- `backend/app/api/v1/admin.py` — Provider CRUD 端点 ✅
- `backend/app/services/proxy_service.py` — 从 DB 读 provider 配置 ✅
- `backend/migrations/versions/a00000000002_providers.py` — 迁移 + seed ✅

### Stats API 增强 ✅

`GET /admin/stats` 现在返回:
```json
{
  "total_users": 892,
  "active_users": 650,
  "total_credits_outstanding": 15000,
  "total_api_calls": 12345,
  "today_api_calls": 234,
  "by_provider": [{"provider": "minimax", "count": 8000}],
  "by_model": [{"model": "MiniMax-M2.7", "count": 7000}],
  "daily_trends": [{"date": "2026-04-23", "calls": 234}]
}
```

---

## 待开发：Admin Dashboard 前端 🔄 开发中

### 技术栈

| 层 | 选型 |
|---|---|
| 框架 | Next.js 14 (App Router) |
| UI | shadcn/ui + TailwindCSS |
| 图表 | Recharts |
| 数据 | fetch FastAPI REST API (Bearer JWT) |
| 部署 | Vercel → admin.tangent.ai |

### 页面结构

```
admin/
├── /login                    → 管理员登录页 (email OTP)
├── /dashboard                → 总览仪表盘
│   ├── 今日 API 调用量
│   ├── 总用户数 / 活跃用户
│   ├── 积分余额
│   ├── 近 7 天调用趋势图 (折线图)
│   ├── Provider 调用分布 (饼图)
│   └── Top 模型排名
├── /users                    → 用户列表
│   ├── 搜索/分页
│   └── 用户详情 (点击进入)
│       ├── 基本信息 + 积分余额
│       ├── 积分充值
│       ├── API 调用历史
│       └── 积分流水
├── /api-logs                 → API 调用日志
│   ├── 全局日志列表 (分页 + 筛选)
│   └── 按 Provider / Status 筛选
├── /providers                → Provider 管理 (**新增**)
│   ├── Provider 列表 (ID/名称/Base URL/Auth Style/状态)
│   ├── 添加 Provider
│   └── 编辑/删除 Provider
├── /models                   → 模型管理
│   ├── 模型列表 (Provider/模型/定价/开关)
│   ├── 添加模型 (关联 Provider)
│   └── 编辑定价
└── /credits                  → 积分管理
    ├── 积分流水总览
    └── 按用户充值
```

### 核心页面 UI 规格

#### Dashboard 总览

```
┌─────────────────────────────────────────────────┐
│  Admin Dashboard                    [admin@...]  │
├─────────────────────────────────────────────────┤
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐        │
│  │ 今日  │  │ 今日  │  │ 总   │  │ 今日  │        │
│  │ 调用  │  │ Token │  │ 用户 │  │ 积分  │        │
│  │ 1,234 │  │ 500K │  │ 892  │  │ -12K │        │
│  └──────┘  └──────┘  └──────┘  └──────┘        │
│                                                   │
│  ┌───────────────────────────────────────────┐   │
│  │  近 7 天调用趋势 (折线图)                    │   │
│  └───────────────────────────────────────────┘   │
│                                                   │
│  ┌─────────────────┐  ┌─────────────────────┐   │
│  │ 模型分布 (饼图)  │  │ Top 消耗用户 (列表) │   │
│  └─────────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────┘
```

#### 用户详情页

```
┌─────────────────────────────────────────────────┐
│  ← 返回用户列表                                   │
│                                                   │
│  用户: user@example.com                           │
│  计划: Free  |  注册: 2026-03-15                  │
│  积分余额: 35  [充值积分]                          │
│                                                   │
│  [API 调用] [积分流水] [订阅]                      │
│  ┌─────────────────────────────────────────────┐ │
│  │ 时间       │ 模型           │ Token │ 积分   │ │
│  │ 10:23:45  │ claude-sonnet  │ 2.5K  │ -15    │ │
│  │ 10:20:12  │ MiniMax-M2.7   │ 1.2K  │ -3     │ │
│  │ 09:55:30  │ minimax-image  │ -     │ -10    │ │
│  └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

#### 模型管理页

```
┌──────────────────────────────────────────────────────┐
│  模型管理                                [+ 添加模型]  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 模型           │ 提供商   │ 类型  │ 定价        │开关│ │
│  │ MiniMax M2.7   │ minimax  │ chat  │ 1/call      │ ● │ │
│  │ Claude Sonnet  │ claude   │ chat  │ 5/call      │ ● │ │
│  │ GPT-4o         │ gpt      │ chat  │ 5/call      │ ● │ │
│  │ MiniMax Image  │ minimax  │ image │ 5/call      │ ● │ │
│  │ DALL-E 3       │ gpt      │ image │ 10/call     │ ● │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

---

## 文件结构

### Admin Dashboard (新项目)

```
admin/
├── package.json
├── next.config.js
├── tailwind.config.ts
├── .env.local                    # NEXT_PUBLIC_API_URL, ADMIN_JWT
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── users/
│   │   │   ├── page.tsx           # 用户列表
│   │   │   └── [id]/page.tsx      # 用户详情
│   │   ├── api-logs/page.tsx
│   │   ├── models/page.tsx
│   │   ├── credits/page.tsx
│   │   └── settings/page.tsx
│   ├── components/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   ├── StatsCard.tsx
│   │   ├── LineChart.tsx
│   │   ├── DataTable.tsx
│   │   └── ModelEditor.tsx
│   ├── lib/
│   │   ├── api.ts                 # FastAPI client (fetch wrapper)
│   │   └── auth.ts                # Admin auth helper
│   └── middleware.ts              # Auth guard
```

### FastAPI 后端 (已完成，需要补充)

```
backend/app/
├── api/v1/
│   ├── admin.py                   # ✅ 已完成
│   ├── auth.py                    # ✅ OTP + Google OAuth
│   ├── proxy.py                   # ✅ AI 代理
│   ├── credits.py                 # ✅ 积分查询
│   └── billing.py                 # ⬜ 待建: Stripe Checkout + Webhook
├── services/
│   ├── proxy_service.py           # ✅ AI 代理 + 积分扣减
│   └── otp_service.py             # ✅ OTP 服务
├── models/
│   ├── credit.py                  # ✅ CreditBalance/Transaction/ApiCallLog/ModelConfig
│   └── user.py                    # ✅ User (含 role 字段)
└── migrations/
    └── versions/
        └── a00000000001_*.py      # ✅ 积分+管理表迁移
```

---

## Admin 认证流程

1. 管理员在 Admin Dashboard 登录页输入邮箱
2. 后端 `/api/v1/auth/send-otp` 发送验证码
3. 后端 `/api/v1/auth/verify-otp` 验证 → 返回 JWT
4. Admin Dashboard 存储 JWT，后续请求带 `Authorization: Bearer <jwt>`
5. 后端 `require_admin` 依赖检查 `user.role == "admin"`

### 创建首个 Admin 用户

```bash
# 注册一个普通用户
# 然后在 PostgreSQL 中手动提升为 admin:
psql -U tangent -d tangent_db
UPDATE users SET role = 'admin' WHERE email = 'your@email.com';
```

---

## 实施步骤

### Phase 1: FastAPI Admin API ✅ 已完成

| 步骤 | 内容 | 状态 |
|------|------|------|
| 1.1 | 创建 credit/transaction/apicalllog/modelconfig 模型 | ✅ |
| 1.2 | 创建 Alembic 迁移 | ✅ |
| 1.3 | 实现 proxy_service.py (AI 代理 + 积分扣减) | ✅ |
| 1.4 | 实现 admin.py (所有管理端点) | ✅ |
| 1.5 | User 表加 role 字段 | ✅ |

### Phase 2: Admin Dashboard 前端（3-4天）

| 步骤 | 内容 |
|------|------|
| 2.1 | 初始化 Next.js 项目 (`admin/`) |
| 2.2 | 配置 FastAPI client (Bearer JWT auth) |
| 2.3 | Admin 登录页 (email OTP) |
| 2.4 | Layout: Sidebar + Header |
| 2.5 | Dashboard 总览页 (调用 `/admin/stats` + 图表) |
| 2.6 | 用户列表页 + 用户详情页 |

### Phase 3: 功能页面（2-3天）

| 步骤 | 内容 |
|------|------|
| 3.1 | API 调用日志页 (调用 `/admin/api-logs` + 筛选) |
| 3.2 | 模型管理页 (调用 `/admin/models` CRUD) |
| 3.3 | 积分管理页 (充值 + 流水) |

---

## 安全考虑

1. **Admin 认证**: 复用 FastAPI JWT Auth，`require_admin` 检查 `role == "admin"`
2. **JWT 传输**: Admin Dashboard 通过 Bearer token 传递 JWT
3. **CORS**: FastAPI CORS 允许 admin.tangent.ai 域名
4. **API Key 隔离**: AI provider API keys 仅存于后端 `.env`，不暴露给任何前端

---

## 不做的事

- 不做实时监控告警
- 不做审计日志
- 不做多租户
- 不做自动化运营
