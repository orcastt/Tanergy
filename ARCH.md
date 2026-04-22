# TANGENT — Architecture Decision Document

**版本**: v0.3
**日期**: 2026-04-21
**状态**: Desktop pivot — Tauri + SQLite + 本地执行 + 用户自带 API Key

> 本文档记录技术决策和工程约束。用户感受不到这些内容，但它们决定了产品怎么建。
> 每次重大技术决策变更必须更新本文档。

---

## 目录

1. [非功能需求](#1-非功能需求)
2. [技术栈决策](#2-技术栈决策)
3. [目录结构](#3-目录结构)
4. [核心模块划分](#4-核心模块划分)
5. [数据模型](#5-数据模型)
6. [本地 vs 远程 API 边界](#6-本地-vs-远程-api-边界)
7. [状态管理方案](#7-状态管理方案)
8. [IPC 接口设计](#8-ipc-接口设计)
9. [构建与分发](#9-构建与分发)
10. [安全规范](#10-安全规范)

---

## 1. 非功能需求

### 1.1 用户范围与并发

- **应用类型**：单用户桌面应用
- **并发定义**：同一工作流中同时执行的节点数，目标最多 5 个并发 AI API 调用
- **决策依据**：AI 任务耗时 10-60 秒，并发受限于用户 API Key 的速率限制

### 1.2 性能上限

| 指标 | 目标 |
|------|------|
| 应用冷启动 | < 3 秒 |
| 画布打开（工作流加载） | < 500ms（SQLite 读取） |
| 本地操作（保存、Undo、节点 CRUD） | < 100ms |
| AI 节点执行 | 15-60 秒（取决于外部 API） |
| Tauri IPC 调用延迟 | < 10ms |

### 1.3 成本上限

| 资源 | 成本 | 说明 |
|------|------|------|
| 服务器 | **€0/月** | 无需服务器 |
| 代码签名证书（macOS） | ~$100/年 | Apple Developer Program |
| 代码签名证书（Windows） | ~$80/年 | 可选，无签名仅显示警告 |
| License 签名密钥 | €0 | 本地 Ed25519 密钥对 |

### 1.4 隐私合规

- 所有用户数据（工作流、生成内容、API Key）存储在用户本地设备
- AI API 调用：用户的 Prompt 直接从客户端发往 AI 提供商，用户自行承担数据传输责任
- 不发送任何个人数据到 TANGENT 服务器（无服务器）
- 无 Cookie、无 Analytics、无追踪
- License 验证完全本地（加密签名校验），不联网

### 1.5 可用性

| 指标 | 目标 |
|------|------|
| 应用可用性 | 始终可用（桌面应用，无服务器依赖） |
| 离线可用 | 画布编辑、工作流管理、本地操作全部离线可用 |
| 自动保存 | 每 30 秒自动保存到 SQLite |
| 自动更新 | Tauri updater，新版本发布时提示更新 |

### 1.6 第三方依赖风险

| 依赖 | 风险 | 降级方案 |
|------|------|---------|
| Claude API 不可用 | 文本 AI 节点失败 | 节点显示错误，用户手动重试 |
| Imagen 3 不可用 | 图像节点失败 | 节点显示错误 |
| Tavily 不可用 | Research 节点失败 | 节点显示错误 |
| 用户 API Key 无效/过期 | 对应节点失败 | 提示用户去 Settings 更新 Key |
| Tauri webview 兼容性 | 渲染差异 | macOS 用 WebKit，Windows 用 WebView2 |

### 1.7 目标平台

- **主要支持**：macOS 13+（Apple Silicon + Intel）
- **次要支持**：Windows 10/11
- **三级支持**：Linux（AppImage / deb）
- **不支持**：移动端、Web 浏览器（Phase 2 网页版另行规划）

### 1.8 维护方式

- 开发+维护：1人
- 自动更新：Tauri 内置 updater
- 无需服务器监控

---

## 2. 技术栈决策

### 2.1 最终选型

| 层级 | 选型 | 版本要求 | 选择理由 |
|------|------|---------|---------|
| **桌面壳** | **Tauri** | **v2.x** | Rust 内核，体积小（10-20MB），系统 webview，跨平台 |
| **前端框架** | React + TypeScript | React 18, TS 5.x | 成熟生态，React Flow 官方支持 |
| **画布引擎** | React Flow (`@xyflow/react`) | v12+ | 专为节点画布设计，文档完善 |
| **状态管理** | Zustand | v4 | 轻量，适合画布复杂状态 |
| **UI 组件** | Tailwind CSS + Radix UI | Tailwind v3 | Cal.com 风格灰度系统 |
| **本地数据库** | **SQLite** | **v3** | 嵌入式、零配置、单文件、可靠 |
| **ORM** | **Drizzle ORM** | **latest** | 轻量、类型安全、SQLite 支持好 |
| **AI API 调用** | **Tauri Rust 侧 reqwest** | — | 用户自带 Key，经 Rust 侧转发，不暴露给 JS |
| **文件存储** | **本地文件系统（Tauri fs API）** | — | 用户工作空间目录 |
| **授权验证** | **本地加密签名（Ed25519）** | — | 无服务器，Honor system |
| **API Key 加密** | **AES-256-GCM + OS keychain** | — | 安全存储用户的 API Key |
| **多语言** | i18next + react-i18next | latest | 行业标准 |
| **子画布绘图** | Fabric.js | v6 | Phase 2，Draw/标注/Inpaint |
| **代码编辑** | Monaco Editor | latest | VS Code 同款，Prompt 编辑用 |
| **构建/打包** | **Tauri CLI + GitHub Actions** | — | 跨平台安装器 |

### 2.2 不选择的方案（及理由）

| 方案 | 不选理由 |
|------|---------|
| Electron | 二进制体积 100MB+，内存占用高；Tauri 更轻量 |
| Vue + VueFlow | React Flow 生态更成熟，团队更熟悉 React |
| Next.js | 桌面应用不需要 SSR |
| PostgreSQL | 单用户桌面过重，SQLite 嵌入式更合适 |
| IndexedDB | 不适合关系型工作流数据，SQL 查询能力弱 |
| Redis | 单用户无需缓存/队列 |
| MinIO / S3 | 本地文件系统足够 |
| Stripe | 用户自带 Key，按时计费不适用 |
| Yjs | 单用户桌面无需协同（Phase 2 网页版再考虑） |
| MongoDB | 工作流数据有关联关系，SQLite 更合适 |
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
│   │   ├── image/        ← 图片编辑器（DrawingCanvas, ImageEditorModal, AiEditPopup 等）
│   │   ├── TextInputNode.tsx
│   │   ├── ImageListNode.tsx  ← 图片生成列表（双输入/动态端口/数量模型选择）
│   │   ├── GroupNode.tsx      ← 分组容器节点
│   │   └── index.ts      ← 节点类型注册表
│   ├── canvas/           ← 画布层
│   │   ├── Canvas.tsx    ← React Flow 主画布
│   │   ├── NodePicker.tsx← 节点选择面板
│   │   ├── Toolbar.tsx   ← 左侧工具栏（含主题切换）
│   │   ├── ContextMenu.tsx ← 右键菜单
│   │   └── CanvasControls.tsx ← 缩放/适应控件
│   ├── skills/           ← Skills 系统
│   │   ├── SkillPanel.tsx
│   │   ├── definitions/  ← 每个 Skill 的节点图定义
│   │   └── hooks/        ← useSkillApply
│   ├── pages/            ← 应用视图
│   │   ├── WelcomePage.tsx   ← 首次启动向导（License + API Key）
│   │   ├── DashboardPage.tsx ← 工作流列表
│   │   ├── CanvasPage.tsx    ← 核心画布编辑
│   │   └── SettingsPage.tsx  ← API Keys、License、偏好设置
│   ├── store/            ← Zustand 状态
│   │   ├── canvasStore.ts    ← 节点/连线/选中/历史
│   │   ├── canvasActions.ts  ← 剪贴板/打组操作
│   │   ├── themeStore.ts     ← 亮/暗主题
│   │   ├── licenseStore.ts   ← License 状态（激活/试用/过期）
│   │   ├── creditsStore.ts   ← 积分/订阅状态
│   │   └── workflowStore.ts  ← 工作流列表/当前工作流
│   ├── agent/            ← AI Agent 面板
│   │   ├── AgentPanel.tsx    ← 侧拉面板壳 + 展开/收回
│   │   ├── AgentChat.tsx     ← 对话 UI
│   │   ├── agentStore.ts     ← 对话历史/发送接收
│   │   └── nodeBuilder.ts    ← 解析 AI 指令 → 创建节点+连线
│   ├── services/         ← 服务层
│   │   ├── tauri.ts      ← Tauri IPC invoke 封装
│   │   └── aiProviders.ts← AI 提供商常量和类型定义
│   ├── hooks/            ← 通用业务 hooks
│   │   └── useExecution.ts
│   ├── types/            ← TypeScript 类型定义
│   │   ├── node.ts
│   │   ├── workflow.ts
│   │   └── license.ts
│   ├── lib/              ← 工具函数
│   │   ├── cn.ts         ← classnames 工具
│   │   ├── dagUtils.ts   ← DAG 拓扑排序
│   │   └── executionEngine.ts ← 执行引擎（DAG 解析 + 节点调度）
│   ├── i18n/             ← 多语言配置
│   ├── App.tsx
│   └── main.tsx
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

**文件大小限制**：单文件不超过 300 行。超出时拆分为子组件或 hooks。

**300 行审查规则**（强制执行）：
- 每完成一个 Slice，必须运行文件行数检查
- 发现超过 300 行的文件，立即拆分
- 拆分优先级：
  1. **职责混杂**：一个文件同时做 UI 渲染 + 业务逻辑 → 拆出 hooks
  2. **多组件堆叠**：一个文件里定义了 2+ 个组件 → 每个组件独立文件
  3. **配置过长**：类型定义、常量枚举占大头 → 拆到 `types/` 或 `lib/`
- 检查命令：`find src -name '*.ts' -o -name '*.tsx' -o -name '*.rs' | xargs wc -l | sort -rn | head -20`

### 3.2 Tauri Rust 侧（`/src-tauri`）

```
src-tauri/
├── src/
│   ├── main.rs           ← Tauri app 入口
│   ├── lib.rs            ← Command 注册
│   ├── commands/         ← Tauri IPC 命令处理器
│   │   ├── mod.rs
│   │   ├── agent.rs      ← AI Agent 对话（MiniMax → JSON actions）
│   │   ├── credits.rs    ← 积分/订阅/Supabase 代理
│   │   ├── workflow.rs   ← 工作流 CRUD（SQLite）
│   │   ├── asset.rs      ← 资产文件管理（本地文件系统）
│   │   ├── license.rs    ← License 密钥验证
│   │   ├── api_keys.rs   ← API Key 加密存储
│   │   └── execute/      ← 节点执行器
│   │       ├── mod.rs    ← 路由分发
│   │       └── media.rs  ← image_planner / image_list / html_formatter
│   ├── db/
│   │   ├── mod.rs
│   │   ├── schema.rs     ← SQLite schema 定义
│   │   └── migrations.rs ← 数据库迁移逻辑
│   ├── services/
│   │   ├── mod.rs
│   │   ├── ai_client.rs  ← HTTP 客户端（reqwest，调用 AI API）
│   │   └── license.rs    ← License 签名验证逻辑
│   └── crypto.rs         ← API Key 加解密工具
├── Cargo.toml
├── tauri.conf.json       ← Tauri 配置
├── icons/                ← 应用图标（各平台）
└── migrations/           ← SQL 迁移文件
```

### 3.3 已弃用（保留供参考）

```
backend/                   ← Legacy Web SaaS 后端（已弃用）
├── app/                  ← FastAPI 代码，不再维护
├── migrations/           ← Alembic 迁移，不再使用
└── DEPRECATED.md         ← 弃用说明
```

---

## 4. 核心模块划分

### 4.1 画布模块（前端）

**职责**：节点的渲染、拖拽、连线、状态展示
**边界**：不处理 AI 调用逻辑，只负责「用户看到什么 + 用户怎么操作」
**关键文件**：`canvas/Canvas.tsx`、`store/canvasStore.ts`

### 4.2 节点模块（前端 + Tauri IPC）

**前端职责**：节点 UI 渲染 + 配置参数的本地状态
**Tauri Rust 职责**：节点的实际执行（解密 API Key → 调用 AI API → 返回结果）
**边界**：前端节点组件不持有 API Key，通过 `invoke('execute_node')` 发请求到 Rust 侧

### 4.3 执行引擎（前端）

**职责**：接收 DAG，解析拓扑顺序，逐层调度节点执行，展示进度
**关键逻辑**：
1. 解析 DAG → 拓扑排序 → 得到执行层级（前端 JS，逻辑不变）
2. 同层节点并发调用 `invoke('execute_node')`
3. Rust 侧返回结果后，前端更新 canvasStore 节点状态
4. 通过 Tauri event 机制推送进度（替代 WebSocket）

### 4.4 Gate 节点执行模型

Gate 是唯一会暂停整条执行链的节点类型，引入了**人工决策门**机制。

```
用户点击 Run All
    ↓
前端：DAG 拓扑排序 → 执行层级
    ↓
执行到 Gate 节点：
    前端：不调用 execute_node，直接设为 waiting 状态
    canvasStore: setWaitingGate('gate_1')
    画布动态生成「临时交互节点」（AnimatedTempNode）
    ↓
用户操作（选择/输入）→ 点击确认
    ↓
前端：canvasStore.resolveGate('gate_1', value)
      临时交互节点淡出消失，Gate 折叠显示「✓ 已选：xxx」
    ↓
继续执行下游节点（调用 invoke('execute_node')）
```

**前端 canvasStore 新增字段**：
```typescript
waitingGates: string[]          // 当前处于 waiting 状态的 Gate 节点 ID
tempNodes: EphemeralNode[]      // 动态生成的临时交互节点（不存入 graph_json）
```

**Gate 临时节点不存入 graph_json**，只存在于运行时画布状态。

### 4.5 节点执行器注册表

```typescript
// 前端侧：每个执行器知道如何调用对应的 Tauri command
const NODE_EXECUTORS: Record<NodeType, NodeExecutor> = {
  "text_input":        TextInputExecutor,       // 纯前端，无 API 调用
  "research":          ResearchExecutor,         // Tavily + Claude（经 Tauri）
  "outline_generator": OutlineGeneratorExecutor, // Claude（经 Tauri）
  "gate":              GateExecutor,             // 特殊：触发 waiting 状态
  "writer":            WriterExecutor,           // Claude（经 Tauri）
  "reviewer":          ReviewerExecutor,         // Claude（经 Tauri）
  "image_planner":     ImagePlannerExecutor,     // Claude（经 Tauri）
  "image_list":        ImageListExecutor,        // 多模型图片生成（经 Tauri，动态输出端口）
  "image_gallery":     ImageGalleryExecutor,     // 纯前端
  "html_formatter":    HtmlFormatterExecutor,    // 纯前端（模板引擎）
  "preview_wechat":    PreviewWechatExecutor,    // 纯前端展示
}
```

### 4.6 License 模块（Tauri Rust 侧）

**职责**：License 密钥验证、试用管理、过期检测
**机制**：
- License 密钥 = Ed25519 签名的数据包（包含计划类型、过期时间、功能列表）
- 验证：用内嵌公钥验证签名，完全本地，不联网
- 试用：首次启动记录时间戳，14 天后转为只读模式
- 过期：可查看/编辑工作流，不可执行节点

### 4.7 API Key 模块（Tauri Rust 侧）

**职责**：API Key 加密存储、解密使用、有效性检测
**机制**：
- 用户在 Settings 输入 API Key → Rust 侧 AES-256-GCM 加密 → 存入 SQLite
- 执行节点时 → Rust 侧从 SQLite 读取 → 解密到内存 → 调用 AI API → 清除内存
- API Key 永不暴露给前端 JS
- 支持的提供商：Anthropic (Claude)、Tavily (Search)、Google Cloud (Imagen 3)

---

## 5. 数据模型

> SQLite 本地数据库，单用户，无多租户字段。

```sql
-- Schema 版本追踪
CREATE TABLE schema_version (
  version INTEGER PRIMARY KEY
);

-- 应用配置（替代 users 表）
CREATE TABLE app_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
-- 存储项：license_key, first_launch_date, workspace_path, theme, language

-- API Keys（加密存储）
CREATE TABLE api_keys (
  provider      TEXT PRIMARY KEY,  -- 'anthropic', 'tavily', 'google_cloud'
  encrypted_key BLOB NOT NULL,     -- AES-256-GCM 加密
  is_valid      INTEGER NOT NULL DEFAULT 0,
  last_tested_at TEXT,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 工作流
CREATE TABLE workflows (
  id             TEXT PRIMARY KEY,  -- UUID
  name           TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  graph_json     TEXT NOT NULL,     -- JSON 字符串（DAG 序列化）
  thumbnail_path TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_workflows_updated ON workflows(updated_at);

-- 生成资产
CREATE TABLE assets (
  id                TEXT PRIMARY KEY,
  workflow_id       TEXT REFERENCES workflows(id) ON DELETE CASCADE,
  node_id           TEXT NOT NULL,
  type              TEXT NOT NULL CHECK(type IN ('image','video','audio','html')),
  file_path         TEXT NOT NULL,     -- 本地文件系统路径
  original_filename TEXT,
  size_bytes        INTEGER NOT NULL,
  mime_type         TEXT NOT NULL,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_assets_workflow ON assets(workflow_id);

-- 执行日志（仅用于调试，不计费）
CREATE TABLE execution_logs (
  id            TEXT PRIMARY KEY,
  workflow_id   TEXT,
  node_id       TEXT NOT NULL,
  node_type     TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  ended_at      TEXT,
  duration_ms   INTEGER,
  status        TEXT NOT NULL CHECK(status IN ('running','success','failed','cancelled')),
  error_message TEXT
);
CREATE INDEX idx_logs_workflow ON execution_logs(workflow_id);
```

**与 Web 版 PostgreSQL 的关键差异**：
- 无 `owner_id` / `user_id` 列（单用户）
- TEXT 存储日期（替代 TIMESTAMPTZ）
- BLOB 存储加密 API Key
- CHECK 约束替代 ENUM 类型
- 无 `subscriptions`、`email_otps`、`teams` 表

---

## 6. 本地 vs 远程 API 边界

### 必须经 Tauri IPC（Rust 侧）

| 操作 | 原因 |
|------|------|
| AI API 调用（Claude、Imagen 3、Tavily） | API Key 在 Rust 侧解密，不暴露给 JS |
| SQLite 数据库操作 | DB 连接在 Rust 侧管理 |
| 文件系统操作（资产存储） | Tauri fs API 安全访问 |
| API Key 加密/解密 | 加密操作在 Rust 侧，不在 JS |
| License 密钥验证 | Ed25519 签名验证在 Rust 侧 |

### 纯前端 JS/React

| 操作 | 说明 |
|------|------|
| DAG 可视化渲染 | React Flow 前端渲染 |
| 节点连线校验（类型匹配） | 前端快速反馈 |
| Undo/Redo 历史 | 内存中 Zustand 状态 |
| 主题/语言偏好 | 本地状态 |
| 工作流临时编辑状态 | Zustand 状态 |
| 节点状态展示 | canvasStore 视觉状态 |
| Gate UI（临时节点、选项展示） | 纯前端交互 |

### 外部网络调用（Tauri Rust 侧发起）

| 目标 | 用途 | Key 来源 |
|------|------|---------|
| api.anthropic.com | Claude API | 用户提供 |
| vision.googleapis.com | Imagen 3 | 用户提供 |
| api.tavily.com | 搜索 | 用户提供 |

---

## 7. 状态管理方案

### 7.1 Zustand Store 划分

```typescript
// canvasStore.ts — 画布状态（最核心，完全不变）
interface CanvasStore {
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  nodeStatuses: Record<string, NodeStatus>
  history: CanvasSnapshot[]
  historyIndex: number
  waitingGates: string[]
  tempNodes: EphemeralNode[]

  addNode: (node: Node) => void
  removeNode: (id: string) => void
  updateNode: (id: string, data: Partial<NodeData>) => void
  addEdge: (edge: Edge) => void
  removeEdge: (id: string) => void
  undo: () => void
  redo: () => void
  setNodeStatus: (id: string, status: NodeStatus) => void
  setWaitingGate: (nodeId: string) => void
  resolveGate: (nodeId: string, value: unknown) => void
}

// workflowStore.ts — 工作流数据
interface WorkflowStore {
  currentWorkflow: Workflow | null
  workflows: Workflow[]
  isSaving: boolean
  isDirty: boolean
  saveWorkflow: () => Promise<void>   // 调用 Tauri IPC
  loadWorkflow: (id: string) => Promise<void>  // 调用 Tauri IPC
  createWorkflow: () => Promise<void>  // 调用 Tauri IPC
}

// licenseStore.ts — License 状态（替代 authStore）
interface LicenseStore {
  status: 'active' | 'trial' | 'expired' | 'unknown'
  plan: 'free' | 'pro'
  trialEndsAt: string | null
  expiresAt: string | null
  activate: (licenseKey: string) => Promise<boolean>
  checkStatus: () => Promise<void>
}

// apiKeyStore.ts — API Key 管理
interface ApiKeyStore {
  keys: Record<string, { provider: string; isSet: boolean; isValid: boolean | null }>
  setKey: (provider: string, key: string) => Promise<boolean>
  testKey: (provider: string) => Promise<boolean>
  removeKey: (provider: string) => Promise<void>
  refreshStatus: () => Promise<void>
}
```

### 7.2 状态流向

```
用户操作（拖拽/连线）
    ↓
canvasStore 更新（本地 Zustand）
    ↓
React Flow 重新渲染
    ↓
用户保存（Cmd+S）
    ↓
workflowStore.saveWorkflow()
    ↓
invoke('update_workflow', { id, graphJson })
    ↓
Tauri Rust 侧 → SQLite 持久化
```

```
用户点击 Run
    ↓
executionEngine.runAll()
    ↓
DAG 拓扑分层（JS，逻辑不变）
    ↓
逐节点调用 invoke('execute_node', { nodeId, nodeType, inputData })
    ↓
Tauri Rust 侧：
  1. 解密对应 provider 的 API Key
  2. 用 reqwest 发 HTTP 到 AI API
  3. 返回结果
    ↓
前端 canvasStore.setNodeStatus('done')
前端 canvasStore.setNodeResult(result)
    ↓
React Flow 重新渲染节点状态
```

---

## 8. IPC 接口设计

### 8.1 Tauri IPC Commands（前端 → Rust）

```typescript
// === 工作流 ===
invoke('list_workflows'): Promise<Workflow[]>
invoke('get_workflow', { id: string }): Promise<WorkflowDetail>
invoke('create_workflow', { name?: string }): Promise<WorkflowDetail>
invoke('update_workflow', { id: string, name?: string, graphJson?: string }): Promise<WorkflowDetail>
invoke('delete_workflow', { id: string }): Promise<void>

// === 执行 ===
invoke('execute_node', {
  nodeId: string,
  nodeType: string,
  inputData: Record<string, unknown>
}): Promise<NodeResult>

invoke('cancel_execution', { nodeId: string }): Promise<void>

// === 资产 ===
invoke('save_asset', {
  workflowId: string,
  nodeId: string,
  type: string,
  data: ArrayBuffer,
  filename?: string
}): Promise<Asset>

invoke('get_assets', { workflowId?: string }): Promise<Asset[]>
invoke('delete_asset', { id: string }): Promise<void>
invoke('export_zip', { assetIds: string[], outputPath: string }): Promise<string>

// === API Keys ===
invoke('set_api_key', { provider: string, key: string }): Promise<{ success: boolean; error?: string }>
invoke('test_api_key', { provider: string }): Promise<{ valid: boolean; error?: string }>
invoke('get_api_key_status', { provider: string }): Promise<{ isSet: boolean; isValid: boolean | null; lastTested?: string }>
invoke('remove_api_key', { provider: string }): Promise<void>

// === License ===
invoke('activate_license', { key: string }): Promise<{ valid: boolean; plan?: string; expiresAt?: string }>
invoke('check_license_status'): Promise<{ status: string; plan: string; expiresAt?: string; trialEndsAt?: string }>

// === 应用配置 ===
invoke('get_app_config', { key: string }): Promise<string | null>
invoke('set_app_config', { key: string, value: string }): Promise<void>
invoke('choose_directory'): Promise<string | null>  // 原生文件夹选择器

// === AI Agent ===
invoke('agent_chat', { messages: ChatMessage[], context: object }): Promise<{ message: string }>
```

### 8.2 Tauri Events（Rust → 前端）

```typescript
// 替代 WebSocket，用于节点执行进度推送
listen('node_status', (event) => {
  // { nodeId, status, progress?, result?, error? }
})

listen('execution_complete', (event) => {
  // { workflowId, successCount, failCount }
})
```

### 8.3 错误处理约定

- Rust 侧返回 `Result<T, String>` → 前端 `Promise<T>`，失败时 reject
- 错误码约定：
  - `API_KEY_NOT_SET` — 该 provider 的 API Key 未配置
  - `API_KEY_INVALID` — API Key 验证失败
  - `API_CALL_FAILED` — AI API 调用失败（含具体错误信息）
  - `LICENSE_INVALID` — License 密钥无效
  - `LICENSE_EXPIRED` — License 已过期
  - `DB_ERROR` — SQLite 操作失败
  - `FILE_ERROR` — 文件系统操作失败

---

## 9. 构建与分发

### 9.1 构建流程

```
GitHub Actions workflow:
  on push to main (tagged release):
    1. 安装 Rust toolchain + Node.js
    2. npm install (前端依赖)
    3. npm run build (Vite 构建)
    4. cargo build (Rust 编译)
    5. Tauri CLI 打包：
       - macOS: .dmg + .app
       - Windows: .msi + .exe
       - Linux: .AppImage + .deb
    6. 上传 artifacts 到 GitHub Release
    7. 生成 auto-update feed
```

### 9.2 分发渠道

- **主要**：从网站下载（tangent.app 或 GitHub Release）
- **更新**：Tauri 内置 updater，检测到新版本时提示安装
- **签名**：
  - macOS: Apple Developer ID 签名 + 公证
  - Windows: 代码签名证书（可选）

### 9.3 用户工作空间

```
~/Documents/TANGENT/              （可自定义）
├── tangent.db                    （SQLite 数据库）
├── assets/                       （生成的图片、HTML）
│   └── {workflow_id}/
│       ├── {asset_id}.png
│       └── {asset_id}.html
├── config.json                   （应用偏好）
└── thumbnails/                   （工作流预览图）
```

### 9.4 License 机制

- **密钥格式**：Base64 编码的签名数据包（JSON payload + Ed25519 签名）
- **验证流程**：Rust 侧用内嵌公钥验证签名 → 解析 payload → 返回 plan/expiresAt
- **试用机制**：首次启动时间记录在 app_config，14 天后自动转为 Free 计划
- **Free 计划**：可查看/编辑工作流，限制 3 个工作流，不可使用 Skill 模板
- **Pro 计划**：无限制，需有效 License 密钥或试用期内

---

## 10. 安全规范

### 10.1 API Key 管理

- API Key 是用户自有财产，非 TANGENT 所有
- 存储方式：AES-256-GCM 加密后存入 SQLite `api_keys` 表
- 解密时机：仅在执行节点时在 Rust 内存中解密，用后清除
- **API Key 永不暴露给前端 JS**（DevTools 也看不到）
- Key 不发送到 TANGENT 服务器（无服务器）

### 10.2 License 安全

- License 密钥使用 Ed25519 签名，公钥内嵌在 Rust 二进制中
- 私钥由开发者离线保管，不进入代码仓库
- 密钥包含：计划类型、过期时间、功能列表
- 无法伪造（无私钥无法生成有效签名）
- 无在线验证，完全离线校验

### 10.3 数据库安全

- 单用户 SQLite，无多租户安全需求
- 使用 Drizzle ORM 参数化查询，防止 SQL 注入
- 数据库文件位于用户工作空间，用户完全控制

### 10.4 客户端 API 限速

- 客户端限制并发 AI API 调用数（默认最多 5 个同时）
- 防止失控工作流导致用户 API 意外大额消费
- 用户可在 Settings 中调整并发限制

### 10.5 文件系统安全

- 本地文件操作，无网络端点
- 导入时校验 MIME type（不信任扩展名）
- 工作空间通过 Tauri fs API 安全访问
- 图片 ≤ 20MB，视频 ≤ 500MB（上限可在 Settings 调整）

---

*本文档是技术决策的权威来源。每次架构变更必须先更新此文档，再修改代码。*
