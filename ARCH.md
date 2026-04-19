# TANVAS — Architecture Decision Document

**版本**: v0.1  
**日期**: 2026-04-19  
**状态**: 草稿  

> 本文档记录技术决策和工程约束。用户感受不到这些内容，但它们决定了产品怎么建。
> 每次重大技术决策变更必须更新本文档。

---

## 目录

1. [非功能需求](#1-非功能需求)
2. [技术栈决策](#2-技术栈决策)
3. [目录结构](#3-目录结构)
4. [核心模块划分](#4-核心模块划分)
5. [数据模型](#5-数据模型)
6. [服务端 vs 客户端边界](#6-服务端-vs-客户端边界)
7. [状态管理方案](#7-状态管理方案)
8. [API 设计](#8-api-设计)
9. [部署架构](#9-部署架构)
10. [安全规范](#10-安全规范)

---

## 1. 非功能需求

### 1.1 用户范围与并发

- **用户范围**：公开上线，面向全球（主要欧洲 + 东亚）
- **MVP 预估并发**：同时在线 50 人，同时执行任务 20 个
- **V1 预估并发**：同时在线 200 人，同时执行任务 80 个
- **决策依据**：AI 任务耗时 10-60 秒，并发不依赖 HTTP 连接数，依赖任务队列容量

### 1.2 性能上限

| 指标 | 目标 |
|------|------|
| 页面首次加载（FCP） | < 2 秒（Cloudflare CDN 缓存） |
| 画布打开（工作流加载） | < 1 秒（JSON ≤ 1MB） |
| API 接口响应（非 AI） | < 200ms P95 |
| AI 节点执行（图像生成） | 15-60 秒，WebSocket 实时推送进度 |
| WebSocket 消息延迟 | < 500ms |

### 1.3 成本上限

| 资源 | 月预算 | 超出处理 |
|------|--------|---------|
| Hetzner 服务器 | ≤ €100/月 | 升级实例规格 |
| MinIO 存储（Hetzner Volume） | ≤ €50/月（~1TB） | 清理超期资产 |
| Claude API | 按用量，与订阅收入对齐 | 设置 API 用量上限告警 |
| MJ API / Imagen3 | 按用量，与积分收入对齐 | 单用户每日 API 调用上限 |
| Stripe 手续费 | 收入的 ~2.9% + €0.25 | 计入毛利 |

### 1.4 隐私合规（GDPR）

- 部署在 **欧盟境内**（Hetzner 芬兰/德国），数据不出欧盟
- 用户数据：存储在 PostgreSQL（EU） + MinIO（EU），不使用欧盟以外服务存储个人数据
- 注册时需用户同意隐私政策和服务条款
- 用户有权申请：导出数据 / 删除账户及所有资产
- Cookie：仅 JWT token（必要 Cookie），不追踪，不 Analytics（MVP 阶段）
- 不向第三方出售用户数据
- 向 AI API 发送的 Prompt 内容不含个人身份信息（用户需自行注意）

### 1.5 可用性

| 指标 | 目标 |
|------|------|
| 月可用性 | ≥ 99.5%（允许约 3.6 小时/月停机） |
| 计划维护 | 提前 24h 公告，选择低峰时段（UTC 02:00-04:00） |
| 数据备份 | PostgreSQL 每日自动备份，保留 7 天 |
| MinIO 备份 | Hetzner Volume 快照，每周 1 次 |

### 1.6 第三方依赖风险

| 依赖 | 风险 | 降级方案 |
|------|------|---------|
| Midjourney API 不可用 | 图像节点无法执行 | 自动切换到 Imagen 3 |
| Claude API 不可用 | Chat/Optimize 节点失败 | 节点显示错误，用户手动重试 |
| Stripe 不可用 | 无法付款 | 订阅状态缓存，不影响已付费用户 |
| Tavily 不可用 | Search 节点失败 | 节点显示错误 |

### 1.7 上线平台

- **Web 应用**：桌面浏览器（Chrome 120+、Safari 17+、Firefox 120+、Edge 120+）
- **不支持**：移动端浏览器（画布操作依赖鼠标）
- **不做**：iOS App、Android App、桌面客户端

### 1.8 维护方式

- 开发+维护：小团队（1-3人）
- 故障响应：工作时间内 2 小时响应，非工作时间次日响应
- 监控：Hetzner 监控 + Sentry（前端错误捕获，Phase 2 接入）

---

## 2. 技术栈决策

### 2.1 最终选型

| 层级 | 选型 | 版本要求 | 选择理由 |
|------|------|---------|---------|
| **前端框架** | React + TypeScript | React 18, TS 5.x | 成熟生态，React Flow 官方支持 |
| **画布引擎** | React Flow (`@xyflow/react`) | v12+ | 专为节点画布设计，文档完善，维护活跃 |
| **子画布绘图** | Fabric.js | v6 | Draw/标注/Inpaint 遮罩，成熟稳定 |
| **状态管理** | Zustand | v4 | 轻量，适合画布复杂状态，无样板代码 |
| **UI 组件** | Tailwind CSS + Radix UI | Tailwind v3 | Cal.com 风格灰度系统，Radix 提供无样式原语 |
| **多语言** | i18next + react-i18next | latest | 行业标准，支持动态加载语言包 |
| **PPT 渲染** | Reveal.js | v5 | HTML 幻灯片，免费，嵌入方便 |
| **代码编辑** | Monaco Editor | latest | VS Code 同款，Prompt 编辑用 |
| **实时协同** | Yjs + y-websocket | latest | CRDT 算法，无冲突合并，成熟方案 |
| **构建工具** | Vite | v5 | 快，HMR 好用，TypeScript 原生支持 |
| **后端框架** | FastAPI (Python) | 0.115+ | AI 生态最好，异步支持好，类型安全 |
| **任务队列** | ARQ (Python) | latest | FastAPI 生态，基于 Redis，轻量 |
| **数据库** | PostgreSQL | v16 | 可靠，JSONB 支持工作流存储 |
| **ORM** | SQLAlchemy + Alembic | v2 | 成熟，迁移管理好 |
| **缓存/队列** | Redis | v7 | Session、任务队列、限流 |
| **对象存储** | MinIO | latest | S3 兼容，自托管，GDPR 友好 |
| **认证** | python-jose (JWT) | latest | 轻量 JWT，无需额外服务 |
| **支付** | Stripe Python SDK | latest | 欧洲合规，文档好 |
| **邮件发送** | Resend | latest | 简单可靠，免费额度够用 |
| **部署** | Docker + Docker Compose | Docker v25 | 简单，够用，后期迁移 K8s 容易 |
| **CDN** | Cloudflare | 免费计划 | 静态资源缓存，DDoS 防护 |

### 2.2 不选择的方案（及理由）

| 方案 | 不选理由 |
|------|---------|
| Vue + VueFlow | React Flow 生态更成熟，团队更熟悉 React |
| Next.js | 画布应用不需要 SSR，Vite 更轻量 |
| Prisma ORM | Python 后端，SQLAlchemy 更适合 |
| GraphQL | REST API 够用，不需要 GraphQL 的灵活性 |
| Kubernetes | MVP 阶段 Docker Compose 足够，减少运维复杂度 |
| MongoDB | 工作流数据有关联关系，JSONB + PostgreSQL 更合适 |
| Redux | Zustand 够用，Redux 样板代码太多 |

---

## 3. 目录结构

### 3.1 前端（`/frontend`）

```
frontend/
├── public/
│   └── locales/          ← i18n 语言包（zh.json, en.json）
├── src/
│   ├── components/       ← 可复用 UI 组件（与业务无关）
│   │   ├── ui/           ← shadcn/ui 基础组件（Button, Input, Modal...）
│   │   └── common/       ← 业务通用组件（NodeCard, PortDot, LoadingSpinner）
│   ├── nodes/            ← 各类节点组件
│   │   ├── base/         ← NodeBase（所有节点的基础外壳）
│   │   ├── prompt/       ← PromptNode
│   │   ├── chat/         ← ChatNode
│   │   ├── image/        ← ImageNode（MJ / Imagen）
│   │   ├── search/       ← SearchNode
│   │   ├── preview/      ← PreviewWechatNode, PreviewRedNode
│   │   └── index.ts      ← 节点类型注册表
│   ├── canvas/           ← 画布层
│   │   ├── Canvas.tsx    ← React Flow 主画布
│   │   ├── NodePicker.tsx← 节点选择面板
│   │   ├── Toolbar.tsx   ← 左侧工具栏
│   │   └── hooks/        ← useCanvas, useNodeDrop...
│   ├── skills/           ← Skills 系统
│   │   ├── SkillPanel.tsx
│   │   ├── definitions/  ← 每个 Skill 的节点图定义
│   │   └── hooks/        ← useSkillApply
│   ├── pages/            ← 页面（路由级组件）
│   │   ├── LandingPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── SignupPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── CanvasPage.tsx
│   │   ├── SettingsPage.tsx
│   │   └── UpgradePage.tsx
│   ├── store/            ← Zustand 状态
│   │   ├── canvasStore.ts    ← 节点/连线/选中/历史
│   │   ├── authStore.ts      ← 用户/token
│   │   ├── workflowStore.ts  ← 工作流列表/当前工作流
│   │   └── subscriptionStore.ts ← 套餐/时长
│   ├── services/         ← API 请求封装
│   │   ├── api.ts        ← axios 实例，含 token 拦截
│   │   ├── auth.ts
│   │   ├── workflow.ts
│   │   ├── execution.ts
│   │   └── subscription.ts
│   ├── hooks/            ← 通用业务 hooks
│   │   ├── useAuth.ts
│   │   ├── useWebSocket.ts
│   │   └── useExecution.ts
│   ├── types/            ← TypeScript 类型定义
│   │   ├── node.ts
│   │   ├── workflow.ts
│   │   └── api.ts
│   ├── lib/              ← 工具函数
│   │   ├── cn.ts         ← classnames 工具
│   │   └── dagUtils.ts   ← DAG 拓扑排序
│   ├── i18n/             ← 多语言配置
│   ├── App.tsx
│   └── main.tsx
├── reference/
│   └── theme.ts          ← 颜色/字号/间距统一定义
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**文件大小限制**：单文件不超过 300 行。超出时拆分为子组件或 hooks。

**300 行审查规则**（强制执行）：
- 每完成一个开发切片（slice），必须运行文件行数检查
- 发现超过 300 行的文件，立即拆分，不累积技术债
- 拆分优先级：
  1. **职责混杂**：一个文件同时做 UI 渲染 + 业务逻辑 → 拆出 hooks
  2. **多组件堆叠**：一个文件里定义了 2+ 个组件 → 每个组件独立文件
  3. **配置过长**：类型定义、常量枚举占大头 → 拆到 `types/` 或 `lib/`
  4. **样式内联**：大量 style 对象或 className 模板 → 拆到 `styles/` 或用 CSS Module
- 拆分时创建新文件，不修改已完成切片的逻辑（避免引入回归）
- 检查命令：`find src -name '*.ts' -o -name '*.tsx' -o -name '*.py' | xargs wc -l | sort -rn | head -20`

### 3.2 后端（`/backend`）

```
backend/
├── app/
│   ├── api/              ← 路由层（只处理 HTTP 请求/响应）
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── workflows.py
│   │   │   ├── executions.py
│   │   │   ├── assets.py
│   │   │   └── subscriptions.py
│   │   └── ws/
│   │       └── execution_ws.py ← WebSocket 端点
│   ├── services/         ← 业务逻辑层（核心规则）
│   │   ├── auth_service.py
│   │   ├── workflow_service.py
│   │   ├── execution_service.py   ← DAG 解析 + 调度
│   │   ├── storage_service.py     ← MinIO 操作
│   │   └── subscription_service.py
│   ├── nodes/            ← 节点执行器（每类节点一个文件）
│   │   ├── base.py       ← NodeExecutor 基类
│   │   ├── chat.py       ← Claude API 调用
│   │   ├── optimize.py
│   │   ├── analysis.py
│   │   ├── search.py     ← Tavily API 调用
│   │   ├── image_mj.py   ← MJ API 调用
│   │   └── image_imagen.py ← Imagen3 API 调用
│   ├── models/           ← SQLAlchemy ORM 模型
│   │   ├── user.py
│   │   ├── workflow.py
│   │   ├── asset.py
│   │   ├── execution_log.py
│   │   └── subscription.py
│   ├── schemas/          ← Pydantic 请求/响应模型
│   │   ├── auth.py
│   │   ├── workflow.py
│   │   └── execution.py
│   ├── workers/          ← ARQ 任务队列 worker
│   │   ├── execution_worker.py
│   │   └── cleanup_worker.py
│   ├── core/
│   │   ├── config.py     ← 环境变量读取（pydantic-settings）
│   │   ├── database.py   ← DB 连接池
│   │   ├── redis.py      ← Redis 连接
│   │   ├── security.py   ← JWT 生成/校验
│   │   └── rate_limit.py ← 频率限制
│   └── main.py           ← FastAPI app 入口
├── migrations/           ← Alembic 数据库迁移
├── tests/
│   ├── unit/
│   └── integration/
├── Dockerfile
├── requirements.txt
└── .env.example
```

---

## 4. 核心模块划分

### 4.1 画布模块（前端）

**职责**：节点的渲染、拖拽、连线、状态展示  
**边界**：不处理 AI 调用逻辑，只负责「用户看到什么 + 用户怎么操作」  
**关键文件**：`canvas/Canvas.tsx`、`store/canvasStore.ts`

### 4.2 节点模块（前后端）

**前端职责**：节点 UI 渲染 + 配置参数的本地状态  
**后端职责**：节点的实际执行（调用对应 AI API）  
**边界**：前端节点组件不调用 AI API，只显示数据和发 HTTP/WS 请求

### 4.3 执行引擎（后端）

**职责**：接收 DAG，解析拓扑顺序，分发任务到队列，推送进度  
**关键逻辑**：
1. 解析 DAG → 拓扑排序 → 得到执行层级
2. 同层节点并发提交到 ARQ 队列
3. 每个节点完成后检查是否有依赖的下游节点可以启动
4. 通过 WebSocket 推送每个节点的状态变化

### 4.4 认证模块（前后端）

**职责**：用户身份验证、JWT 管理  
**边界**：JWT 验证必须在服务端做，前端只存储 token（localStorage）

### 4.5 订阅计量模块（后端）

**职责**：记录执行时长、检查限额、每周重置  
**边界**：扣除时长必须在服务端执行，前端只展示剩余时长（从服务端拉取）

---

## 5. 数据模型

> 详见 PRD.md §10 数据字段约束，此处补充关系和索引说明

```sql
-- 关键索引
CREATE INDEX idx_workflows_owner ON workflows(owner_id);
CREATE INDEX idx_workflows_team ON workflows(team_id);
CREATE INDEX idx_assets_user ON assets(user_id);
CREATE INDEX idx_execution_logs_user_week ON execution_logs(user_id, week_start);
CREATE INDEX idx_email_otps_email ON email_otps(email);

-- 执行时长汇总视图（用于快速查剩余时长）
CREATE VIEW user_weekly_usage AS
  SELECT 
    user_id,
    week_start,
    SUM(duration_ms) / 1000 AS used_seconds
  FROM execution_logs
  WHERE status = 'success'
  GROUP BY user_id, week_start;
```

---

## 6. 服务端 vs 客户端边界

### 必须在服务端做（不可放前端）

| 操作 | 原因 |
|------|------|
| AI API 调用（MJ、Claude、Imagen3 等）| API Key 不能暴露到前端 |
| JWT 颁发与校验 | 安全，防伪造 |
| 执行时长扣除与检查 | 防客户端绕过 |
| MinIO 文件上传/读取 | S3 凭证不能暴露 |
| 邮件验证码生成发送 | 防止前端直接看到验证码 |
| Stripe Webhook 处理 | 验证签名必须在服务端 |
| 用户权限校验（资产是否属于本人） | 防越权访问 |
| 频率限制（验证码发送、登录尝试）| 防暴力攻击 |

### 可以在客户端做

| 操作 | 说明 |
|------|------|
| DAG 可视化渲染 | React Flow 前端渲染 |
| 节点连线校验（类型匹配）| 前端快速反馈，服务端执行前再校验 |
| Undo/Redo 历史 | 前端本地状态 |
| 主题/语言偏好 | localStorage |
| 工作流的临时编辑状态 | 未保存的变更在前端状态中 |

---

## 7. 状态管理方案

### 7.1 Zustand Store 划分

```typescript
// canvasStore.ts — 画布状态（最核心，最复杂）
interface CanvasStore {
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  history: CanvasSnapshot[]  // Undo/Redo
  historyIndex: number
  
  addNode: (node: Node) => void
  removeNode: (id: string) => void
  updateNode: (id: string, data: Partial<NodeData>) => void
  addEdge: (edge: Edge) => void
  removeEdge: (id: string) => void
  undo: () => void
  redo: () => void
}

// authStore.ts — 用户身份
interface AuthStore {
  user: User | null
  token: string | null
  isLoading: boolean
  login: (token: string, user: User) => void
  logout: () => void
}

// workflowStore.ts — 工作流数据
interface WorkflowStore {
  currentWorkflow: Workflow | null
  workflows: Workflow[]
  isSaving: boolean
  isDirty: boolean  // 有未保存变更
  saveWorkflow: () => Promise<void>
  loadWorkflow: (id: string) => Promise<void>
}

// subscriptionStore.ts — 订阅与时长
interface SubscriptionStore {
  plan: Plan
  weeklyLimitSeconds: number
  usedSeconds: number
  remainingSeconds: number
  refresh: () => Promise<void>
}
```

### 7.2 状态流向

```
用户操作（拖拽/连线）
    ↓
canvasStore 更新（本地）
    ↓
React Flow 重新渲染
    ↓
用户保存（Cmd+S）
    ↓
workflowStore.saveWorkflow()
    ↓
POST /api/v1/workflows/:id
    ↓
后端持久化到 PostgreSQL
```

```
用户点击 Run
    ↓
execution service 发 POST /api/v1/executions
    ↓
后端创建执行任务，推入 ARQ 队列
    ↓
Worker 执行节点（调 AI API）
    ↓
WebSocket 推送进度 → canvasStore.updateNode(status)
    ↓
React Flow 重新渲染节点状态
```

---

## 8. API 设计

### 8.1 认证相关

```
POST /api/v1/auth/send-otp        发送邮箱验证码
POST /api/v1/auth/verify-otp      验证码登录/注册
POST /api/v1/auth/google          Google OAuth 换 token
POST /api/v1/auth/logout          登出（清除 refresh token）
GET  /api/v1/auth/me              获取当前用户信息
```

### 8.2 工作流

```
GET    /api/v1/workflows           获取用户工作流列表
POST   /api/v1/workflows           创建工作流
GET    /api/v1/workflows/:id       获取工作流详情（含 graph_json）
PUT    /api/v1/workflows/:id       保存工作流（全量更新 graph_json）
DELETE /api/v1/workflows/:id       删除工作流
POST   /api/v1/workflows/:id/duplicate  复制工作流
```

### 8.3 执行

```
POST /api/v1/executions            提交执行请求（body: workflow_id, node_ids?）
GET  /api/v1/executions/:id        查询执行状态
POST /api/v1/executions/:id/cancel 取消执行

WS   /ws/executions/:execution_id  WebSocket 实时推送节点状态
```

**WebSocket 消息格式**：
```json
{
  "type": "node_status",
  "node_id": "img_1",
  "status": "running" | "success" | "failed",
  "progress": 45,
  "result": { "images": ["https://..."] },
  "error": null
}
```

### 8.4 资产

```
POST /api/v1/assets/upload         上传文件（multipart/form-data）
GET  /api/v1/assets/:id/download   下载资产（redirect to signed URL）
GET  /api/v1/assets?workflow_id=xx 获取工作流的所有资产
DELETE /api/v1/assets/:id          删除资产
```

### 8.5 订阅

```
GET  /api/v1/subscription          获取当前订阅信息 + 本周剩余时长
POST /api/v1/subscription/checkout 创建 Stripe Checkout Session
POST /api/v1/subscription/portal   获取 Stripe Customer Portal URL
POST /api/v1/webhooks/stripe       Stripe Webhook（订阅状态变更）
```

### 8.6 通用约定

**请求头**：
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
Accept-Language: zh-CN | en
```

**成功响应**：
```json
{
  "success": true,
  "data": { ... }
}
```

**错误响应**：
```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "登录已过期，请重新登录",
    "detail": "..."
  }
}
```

**HTTP 状态码约定**：
- 200：成功
- 201：创建成功
- 400：请求参数错误
- 401：未认证
- 403：无权限
- 404：资源不存在
- 429：请求过频
- 500：服务器内部错误

---

## 9. 部署架构

### 9.1 Hetzner EU 服务器规格（MVP）

```
生产服务器（1台）: Hetzner CX32
  - 4 vCPU, 8GB RAM
  - 运行: FastAPI + Redis + ARQ Worker

数据库服务器（1台）: Hetzner CX22
  - 2 vCPU, 4GB RAM
  - 运行: PostgreSQL 16

对象存储: Hetzner Volume
  - 100GB 起步，按需扩展
  - 运行: MinIO
```

### 9.2 Docker Compose 服务

```yaml
services:
  frontend:      # Nginx 静态文件服务
  backend:       # FastAPI（uvicorn）
  worker:        # ARQ Worker（AI 任务执行）
  postgres:      # PostgreSQL
  redis:         # Redis
  minio:         # MinIO 对象存储
  nginx:         # 反向代理（SSL 终止）
```

### 9.3 网络架构

```
用户浏览器
    ↓ HTTPS
Cloudflare（CDN + DDoS 防护）
    ↓
Nginx（Hetzner EU）
    ├── / → Frontend（静态文件）
    ├── /api → Backend（FastAPI）
    └── /ws → WebSocket（FastAPI）
         ↓
     Backend ←→ Redis ←→ ARQ Worker
         ↓
     PostgreSQL   MinIO
```

### 9.4 CI/CD（MVP 手动，V1 自动化）

MVP 阶段：手动 SSH + `docker compose pull && docker compose up -d`  
V1 阶段：GitHub Actions → 自动构建镜像 → 推送到 Hetzner Container Registry → 自动部署

---

## 10. 安全规范

### 10.1 API Key 管理

- 所有第三方 API Key 存储在服务器 `.env` 文件
- 前端**不得**包含任何 API Key
- 代码仓库中 `.env` 文件必须在 `.gitignore` 中
- 仓库中只提交 `.env.example`（含变量名，不含值）

### 10.2 JWT 安全

- Token 有效期：Access Token 7 天，无 Refresh Token（MVP 简化）
- Token 存储：前端 localStorage（非 httpOnly Cookie，因为跨域 SPA 架构）
- Token 吊销：MVP 阶段不实现（V1 用 Redis 实现黑名单）
- 敏感操作（删除账户、修改邮箱）需重新验证

### 10.3 数据库查询安全

- **所有**涉及用户数据的查询必须同时过滤 `user_id = current_user.id`
- 使用 ORM 参数绑定，禁止字符串拼接 SQL
- 示例（正确）：
  ```python
  # 正确：同时校验 user_id
  asset = db.query(Asset).filter(
      Asset.id == asset_id,
      Asset.user_id == current_user.id  # ← 必须有
  ).first()
  ```

### 10.4 频率限制

| 接口 | 限制 |
|------|------|
| POST /auth/send-otp | 1次/分钟/邮箱，5次/小时/IP |
| POST /auth/verify-otp | 5次/10分钟/邮箱 |
| POST /executions | 10次/分钟/用户 |
| 其他 API | 60次/分钟/用户 |

### 10.5 文件上传安全

- 校验 MIME type（不信任扩展名）
- 文件大小限制：图片 ≤ 20MB，视频 ≤ 500MB
- 存储路径格式：`/users/{user_id}/{year}/{month}/{uuid}.{ext}`（不含用户输入的文件名）
- 下载通过签名 URL（防止直接猜测路径）

---

*本文档是技术决策的权威来源。每次架构变更必须先更新此文档，再修改代码。*
