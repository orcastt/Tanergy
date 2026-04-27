# TANGENT — Architecture Decision Document

**版本**: v0.8
**日期**: 2026-04-27
**状态**: Phase 2 商业化 — 核心能力完成，Html Editor / Admin 联调 / 部署收口中
**上次更新**: Writer 高级节点 + Html 多主题 + 素材库 Knowledge Graph；Html Editor 终点架构继续收口

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
11. [Canvas UI 架构规范](#11-canvas-ui-架构规范--画布归画布ui-归-ui)
12. [后端服务架构 (Phase 2)](#12-后端服务架构-phase-2)
13. [Image Editor 图层架构](#13-image-editor-图层架构)

---

## 1. 非功能需求

### 1.1 用户范围与并发

- **应用类型**：单用户桌面应用
- **并发定义**：同一工作流中同时执行的节点数，目标最多 5 个并发 AI API 调用
- **决策依据**：AI 任务耗时 10-60 秒，并发、限流与备用线路由官方后端代理统一管理

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
| 认证服务 | 按后端部署成本计 | Email OTP + JWT（FastAPI） |

### 1.4 隐私合规

- 工作流、生成内容和本地素材优先存储在用户本地设备
- AI API 调用：用户 Prompt 通过 Tangent FastAPI 官方代理转发到已配置 Provider
- 第三方 Provider Key 不暴露给桌面端，由后端环境变量和 Admin Provider Registry 管理
- 无 Cookie、无 Analytics、无追踪
- 认证与计费通过 FastAPI（OTP + JWT + 订阅）进行，工作流数据仍本地存储

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
| 官方文本线路不可用 | 文本 AI 节点失败 | 后端 fallback / 节点显示错误，用户手动重试 |
| 官方图片线路不可用 | 图像节点失败 | 后端 fallback / 节点显示错误 |
| Tavily 不可用 | Research 节点失败 | 节点显示错误 |
| 官方 Provider 线路不可用 | 对应节点失败 | 后端 fallback / Admin 切换线路 / 节点提示重试 |
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
| **前端框架** | React + TypeScript | React 19, TS 6.x | 成熟生态，React Flow 官方支持 |
| **画布引擎** | React Flow (`@xyflow/react`) | v12+ | 专为节点画布设计，文档完善 |
| **状态管理** | Zustand | v4 | 轻量，适合画布复杂状态 |
| **UI 组件** | Tailwind CSS + Radix UI | Tailwind v3 | Cal.com 风格灰度系统 |
| **本地数据库** | **SQLite** | **v3** | 嵌入式、零配置、单文件、可靠 |
| **ORM** | **Drizzle ORM** | **latest** | 轻量、类型安全、SQLite 支持好 |
| **AI API 调用** | **FastAPI Proxy** | — | 桌面端携带 JWT 调用官方代理，Provider Key 不暴露给客户端 |
| **文件存储** | **本地文件系统（Tauri fs API）** | — | 用户工作空间目录 |
| **用户认证** | **FastAPI Email OTP + JWT** | — | 统一登录态，支持积分与订阅 |
| **API Key 加密** | **AES-256-GCM + OS keychain** | — | legacy BYOK 能力，当前默认关闭 |
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
| Stripe | 已在 Phase 2 作为积分/订阅支付接入 |
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
│   │   ├── image/        ← 图片编辑器（图层画板）
│   │   │   ├── ImageEditorModal.tsx ← 全屏三栏布局（源图片+画板+图层面板）
│   │   │   ├── LayerCanvas.tsx     ← 主画板（多层合成 + 绘画 + 选择 + 拖放）
│   │   │   ├── LayerPanel.tsx      ← 右侧图层面板（列表 + 操作 + opacity + 导出）
│   │   │   ├── SourcePanel.tsx     ← 左侧源图片列表（click-to-add + drag）
│   │   │   ├── Toolbar.tsx         ← 工具栏（选择/画笔 + 颜色 + AI Edit）
│   │   │   ├── AiEditPopup.tsx     ← AI 编辑弹窗（截图→生成→新图层）
│   │   │   ├── layerStore.ts       ← Zustand 图层状态（CRUD + 绘画 + 拖拽 + 栅格化）
│   │   │   ├── ImageEditorPanel.tsx ← [已弃用] 旧图片列表
│   │   │   ├── DrawingCanvas.tsx   ← [已弃用] 旧画板
│   │   │   ├── DrawingPanel.tsx    ← [已弃用] 旧绘图面板
│   │   │   └── drawingStore.ts     ← [已弃用] 旧绘图状态
│   │   ├── TextInputNode.tsx
│   │   ├── WriterNode.tsx     ← 高级长文/书稿节点
│   │   ├── ImageListNode.tsx  ← 图片生成列表（双输入/动态端口/数量模型选择）
│   │   ├── GroupNode.tsx      ← 分组容器节点
│   │   └── index.ts      ← 节点类型注册表
│   ├── canvas/           ← 画布层
│   │   ├── Canvas.tsx    ← React Flow 主画布
│   │   ├── DeletableEdge.tsx ← 自定义连线（hover 高亮 + − 按钮 + Delete 删除）
│   │   ├── NodePicker.tsx← 节点选择面板
│   │   ├── Toolbar.tsx   ← 左侧工具栏（含主题切换）
│   │   ├── ContextMenu.tsx ← 右键菜单
│   │   └── CanvasControls.tsx ← 缩放/适应控件
│   ├── skills/           ← Skills 系统
│   │   ├── SkillPanel.tsx
│   │   ├── definitions/  ← 每个 Skill 的节点图定义
│   │   └── hooks/        ← useSkillApply
│   ├── library/          ← 全局个人素材库 Drawer、卡片、保存弹窗、拖拽协议
│   ├── pages/            ← 应用视图
│   │   ├── WelcomePage.tsx   ← 首次启动向导（Email OTP）
│   │   ├── DashboardPage.tsx ← 工作流列表
│   │   ├── dashboard/LibraryKnowledgeGraph.tsx ← Workspace 素材知识图谱
│   │   ├── CanvasPage.tsx    ← 核心画布编辑
│   │   └── SettingsPage.tsx  ← 账户、偏好设置、官方线路说明
│   ├── store/            ← Zustand 状态
│   │   ├── canvasStore.ts    ← 节点/连线/选中/历史
│   │   ├── canvasActions.ts  ← 剪贴板/打组操作
│   │   ├── themeStore.ts     ← 亮/暗主题
│   │   ├── authStore.ts      ← 登录状态（OTP/JWT）
│   │   ├── creditsStore.ts   ← 积分/订阅状态
│   │   ├── libraryStore.ts   ← 全局素材库列表/标签状态
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
│   │   ├── library.ts
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
│   │   ├── agent.rs      ← AI Agent 对话（官方文本模型 → JSON actions）
│   │   ├── credits.rs    ← 积分/订阅/FastAPI 代理
│   │   ├── workflow.rs   ← 工作流 CRUD（SQLite）
│   │   ├── asset.rs      ← 资产文件管理 + canvas 导出 + AI 图片编辑
│   │   │                     save_canvas_export, ai_edit_image, read_asset_file
│   │   ├── billing.rs    ← 订阅支付相关命令
│   │   ├── api_keys.rs   ← legacy BYOK 加密存储（当前默认关闭）
│   │   ├── library.rs    ← 全局素材库 CRUD + 图片文件保存
│   │   └── execute/      ← 节点执行器
│   │       ├── mod.rs    ← 路由分发
│   │       └── media.rs  ← image_planner / image_list / html_formatter
│   ├── db/
│   │   ├── mod.rs
│   │   ├── schema.rs     ← SQLite schema 定义
│   │   └── migrations.rs ← 数据库迁移逻辑
│   ├── services/
│   │   ├── mod.rs
│   │   ├── ai_client.rs  ← 官方后端代理客户端（chat/image）
│   │   └── auth.rs       ← 登录态与会话辅助逻辑
│   └── crypto.rs         ← legacy 本地密钥加解密工具
├── Cargo.toml
├── tauri.conf.json       ← Tauri 配置
├── icons/                ← 应用图标（各平台）
└── migrations/           ← SQL 迁移文件
```

### 3.3 后端服务（`/backend`）

Phase 2 FastAPI 后端，详见 [§12 后端服务架构](#12-后端服务架构-phase-2)。

```
backend/
├── app/
│   ├── main.py              ← FastAPI 入口 + 路由注册
│   ├── core/                ← 配置 + JWT/OTP 工具
│   ├── models/              ← User / Credit 数据模型
│   ├── api/v1/              ← auth / credits / proxy / billing / admin
│   └── services/
│       ├── proxy_service.py ← 兼容导出层
│       ├── proxy/           ← AI 代理核心（Provider/Model 校验、扣费、chat/image）
│       └── otp_service.py   ← OTP 生成/验证
├── migrations/              ← Alembic 迁移
├── docker-compose.yml       ← 本地开发（PostgreSQL + Redis）
├── docker-compose.prod.yml  ← 生产部署
└── requirements.txt
```

---

## 4. 核心模块划分

### 4.1 画布模块（前端）

**职责**：节点的渲染、拖拽、连线、状态展示
**边界**：不处理 AI 调用逻辑，只负责「用户看到什么 + 用户怎么操作」
**关键文件**：`canvas/Canvas.tsx`、`store/canvasStore.ts`

### 4.2 节点模块（前端 + Tauri IPC）

**前端职责**：节点 UI 渲染 + 配置参数的本地状态
**Tauri Rust 职责**：节点的实际执行、登录态检查、调用 FastAPI 官方代理并返回结果
**边界**：前端节点组件不持有 Provider Key，通过 `invoke('execute_node')` 发请求到 Rust 侧，再由 Rust 调用后端代理

### 4.3 执行引擎（前端）

**职责**：接收 DAG，解析拓扑顺序，逐层调度节点执行，展示进度
**关键逻辑**：
1. 解析 DAG → 拓扑排序 → 得到执行层级（前端 JS，逻辑不变）
2. 同层节点并发调用 `invoke('execute_node')`
3. Rust 侧返回结果后，前端更新 canvasStore 节点状态
4. 通过 Tauri event 机制推送进度（替代 WebSocket）

### 4.4 Legacy Gate 执行模型（非默认）

Gate 为历史交互节点，当前公众号默认流程已改为 Outline Split，不再依赖 Gate 暂停机制。

```
用户点击 Run All
    ↓
前端：DAG 拓扑排序 → 执行层级
    ↓
执行到 legacy Gate 节点（仅兼容场景）：
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

**兼容字段（仅 legacy Gate 使用）**：
```typescript
waitingGates: string[]          // 当前处于 waiting 状态的 Gate 节点 ID
tempNodes: EphemeralNode[]      // 动态生成的临时交互节点（不存入 graph_json）
```

Gate 临时节点不存入 `graph_json`，只存在于运行时画布状态。

### 4.5 节点执行器注册表

```typescript
// 前端侧：每个执行器知道如何调用对应的 Tauri command
const NODE_EXECUTORS: Record<NodeType, NodeExecutor> = {
  "text_input":        TextInputExecutor,       // 纯前端，无 API 调用；有 in port 可接收上游文本
  "research":          ResearchExecutor,         // Tavily + Claude（经 Tauri）
  "outline_generator": OutlineGeneratorExecutor, // Claude（经 Tauri）
  "gate":              GateExecutor,             // legacy：触发 waiting 状态
  "writer":            WriterExecutor,           // 高级/实验：长文、小说、书稿草稿
  "reviewer":          ReviewerExecutor,         // legacy
  "image_planner":     ImagePlannerExecutor,     // Claude（经 Tauri）
  "image_list":        ImageListExecutor,        // 多模型图片生成（经 Tauri，动态输出端口）
  "image_asset":       ImageAssetExecutor,       // 个人素材库图片容器，纯前端输出 image_slot
  "image_gallery":     ImageGalleryExecutor,     // 纯前端
  "html_formatter":    HtmlFormatterExecutor,    // Tauri IPC + Html Editor 终点
  "preview_wechat":    PreviewWechatExecutor,    // legacy：非默认预览节点
}
```

### 4.6 认证与会话模块（Tauri + FastAPI）

**职责**：登录态管理、JWT 持久化、鉴权前置检查
**机制**：
- 邮箱 OTP 登录：`/api/v1/auth/send-otp` + `/verify-otp`
- JWT 写入本地 `app_config.backend_jwt`
- 应用启动时检查 JWT，有效则直达业务页
- AI 节点执行前校验：必须有 official access，未登录返回 `LOGIN_REQUIRED`

### 4.7 API Key 模块（legacy，当前默认关闭）

**职责**：历史 BYOK 能力的 API Key 加密存储、解密使用、有效性检测
**机制**：
- 当前 UI 不暴露 BYOK 入口，AI 节点默认不读取本地 `api_keys`
- 如后续恢复高级模式，再启用 Settings 入口和对应 direct provider 调用
- 当前 Provider Key 统一放在后端环境变量和 Admin Provider Registry

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
  graph_json     TEXT,              -- JSON 字符串（DAG 序列化），可为 NULL（新建工作流）
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
| AI API 调用 | Rust 侧读取 JWT 后调用 FastAPI 官方代理，Provider Key 不暴露给客户端 |
| SQLite 数据库操作 | DB 连接在 Rust 侧管理 |
| 文件系统操作（资产存储） | Tauri fs API 安全访问 |
| API Key 加密/解密 | legacy BYOK 能力，当前默认关闭 |
| 登录态检查/会话缓存 | JWT 保存在本地配置，调用前做本地前置校验 |

### 纯前端 JS/React

| 操作 | 说明 |
|------|------|
| DAG 可视化渲染 | React Flow 前端渲染 |
| 节点连线校验（类型匹配） | 前端快速反馈 |
| Undo/Redo 历史 | 内存中 Zustand 状态 |
| 主题/语言偏好 | 本地状态 |
| 工作流临时编辑状态 | Zustand 状态 |
| 节点状态展示 | canvasStore 视觉状态 |
| Gate UI（临时节点、选项展示） | legacy 纯前端交互 |

### 外部网络调用（Tauri Rust 侧发起）

| 目标 | 用途 | Key 来源 |
|------|------|---------|
| FastAPI `/api/v1/proxy/chat` | 文本 AI 官方代理 | 后端 Provider Registry |
| FastAPI `/api/v1/proxy/image` | 图片生成官方代理 | 后端 Provider Registry |
| FastAPI `/api/v1/proxy/image/edit` | 图片编辑官方代理 | 后端 Provider Registry |

---

## 7. 状态管理方案

### 7.1 Zustand Store 划分

```typescript
// canvasStore.ts — 画布状态（最核心，完全不变）
interface CanvasStore {
  nodes: Node[]
  edges: Edge[]
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
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

// authStore.ts — 登录状态
interface AuthStore {
  isLoggedIn: boolean
  email: string | null
  login: (email: string) => Promise<void>
  verifyOtp: (email: string, code: string) => Promise<boolean>
  logout: () => Promise<void>
  checkSession: () => Promise<void>
}

// apiKeyStore.ts — legacy API Key 管理（当前默认关闭）
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
  1. 检查本地 JWT / official access
  2. 用 reqwest 发 HTTP 到 FastAPI proxy
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

// === API Keys (legacy BYOK, current UI disabled) ===
invoke('set_api_key', { provider: string, key: string }): Promise<{ success: boolean; error?: string }>
invoke('test_api_key', { provider: string }): Promise<{ valid: boolean; error?: string }>
invoke('get_api_key_status', { provider: string }): Promise<{ isSet: boolean; isValid: boolean | null; lastTested?: string }>
invoke('remove_api_key', { provider: string }): Promise<void>

// === Auth / Billing ===
invoke('login_official', { email: string }): Promise<{ ok: boolean }>
invoke('verify_otp', { email: string, code: string }): Promise<{ token: string; user: object }>
invoke('get_subscription_status'): Promise<{ plan: string; status: string }>

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
  - `PROVIDER_NOT_CONFIGURED` — 官方 Provider 未配置或不可用
  - `API_CALL_FAILED` — AI API 调用失败（含具体错误信息）
  - `LOGIN_REQUIRED` — 需要登录后使用官方 API
  - `INSUFFICIENT_CREDITS` — 积分不足
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

### 9.4 登录与订阅机制

- **登录方式**：Email OTP（FastAPI）+ JWT 会话
- **本地持久化**：JWT 存 `app_config.backend_jwt`
- **计划状态**：由后端 credits/subscription 接口返回（Free / Pro / 余额）
- **客户端策略**：未登录时限制 AI 调用入口，画布本地编辑能力可保留

---

## 10. 安全规范

### 10.1 API Key 管理（legacy）

- 当前默认产品路径关闭 BYOK，桌面端不要求用户配置第三方 Key。
- 历史 `api_keys` 表保留，便于后续恢复高级模式。
- 当前 Provider Key 统一在后端环境变量和 Admin Provider Registry 管理，不暴露给客户端。

### 10.2 认证与会话安全

- OTP 与 JWT 由后端统一签发和校验
- 客户端仅持有会话令牌，不保存邮箱验证码明文
- JWT 仅用于调用官方 API 代理与账户接口
- 关键操作（admin/计费）在后端做角色与权限校验

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

## 11. Canvas UI 架构规范 — "画布归画布，UI 归 UI"

### 11.1 核心原则

React Flow v12 会劫持 DOM：所有节点渲染在 CSS transform 容器内，`position: fixed` 失效，指针/键盘事件被拦截。必须建立**二元化**架构，将画布渲染与浮层 UI 严格分离。

**规则**：
1. `<ReactFlow>` 内部只放节点渲染和 Background，不放任何浮层 UI
2. 所有浮层（菜单、弹窗、工具栏、面板）统一通过 `OverlayLayer` 渲染到 `document.body`
3. 画布与浮层之间通过 **Zustand store 通信**，不依赖 DOM 事件冒泡
4. 节点组件内部尽量简单 — 复杂交互（编辑器、大表单）弹出到 OverlayLayer
5. 禁止在各组件中散落 `createPortal`，统一由 `OverlayLayer` 管理

### 11.2 组件树结构

```
CanvasPage
  ├── Canvas
  │     └── <ReactFlow>          ← 画布层：只有节点 + Background
  │
  └── OverlayLayer (createPortal → document.body)
        ├── Toolbar              ← 左侧工具栏
        ├── CanvasControls       ← 缩放控件
        ├── AgentPanel           ← 右侧 AI 面板
        ├── NodePicker           ← 添加节点弹窗
        ├── ContextMenu          ← 右键菜单
        ├── ImageEditorModal     ← 全屏图片编辑器
        └── LightboxOverlay      ← 图片预览
```

### 11.3 关键文件

| 文件 | 职责 |
|------|------|
| `canvas/OverlayLayer.tsx` | 唯一的 `createPortal` 入口，导出 `Z` z-index 常量 |
| `store/overlayStore.ts` | 浮层状态管理（picker、ctxMenu、editor、lightbox） |
| `lib/nodeEvents.ts` | 节点内事件辅助函数（`nodeAction`, `nodeResize`） |
| `canvas/Canvas.tsx` | 画布主组件，只含 ReactFlow + OverlayLayer |

### 11.4 Z-Index 规范

```typescript
export const Z = {
  CONTROLS: 20,       // CanvasControls — 缩放控件
  TOOLBAR: 100,       // Toolbar — 左侧工具栏
  PICKER: 110,        // NodePicker — 节点选择
  AGENT_PANEL: 150,   // AgentPanel — 侧拉面板
  AGENT_TOGGLE: 200,  // AgentPanel toggle button
  CTX_OVERLAY: 300,   // ContextMenu — 点击关闭背景
  CTX_MENU: 310,      // ContextMenu — 菜单本体
  FULLSCREEN: 400,    // ImageEditorModal, Lightbox
} as const
```

**规则**：
- 所有 z-index 必须使用 `Z` 常量，禁止硬编码数字
- 新增浮层先在 `Z` 中注册层级

### 11.5 OverlayLayer 工作机制

```tsx
// OverlayLayer — 外层 pointerEvents: none，不挡画布
// 每个子浮层自己设 pointerEvents: "auto"
<OverlayLayer>
  <div style={{ pointerEvents: "auto" }}>  {/* Toolbar */}
  <div style={{ pointerEvents: "auto" }}>  {/* ContextMenu */}
</OverlayLayer>
```

- 外层容器 `pointerEvents: "none"` — 让鼠标事件穿透到画布
- 每个浮层子组件设 `pointerEvents: "auto"` — 只拦截自己区域的点击
- 浮层之间通过 `overlayStore` 的状态控制显隐，不依赖 DOM 事件

### 11.6 节点内事件处理

| 场景 | 使用函数 | 说明 |
|------|---------|------|
| 按钮点击（Run/Stop/设置） | `nodeAction(e)` | `stopPropagation` 防止触发节点选中 |
| 拖拽 resize handle | `nodeResize(e)` | `preventDefault` + `stopPropagation` + `stopImmediatePropagation` 防止触发节点拖拽 |
| 输入框/textarea 焦点 | 无需处理 | React Flow 已自动忽略 INPUT/TEXTAREA 中的快捷键 |

**禁止在节点内直接写 `e.stopPropagation()`**，统一使用 `nodeEvents.ts` 的辅助函数。

### 11.7 新增浮层 UI 的检查清单

添加新的浮层组件时，必须：

1. ✅ 状态放在 `overlayStore.ts`
2. ✅ 渲染放在 `OverlayLayer` 内（Canvas.tsx 的 JSX 中）
3. ✅ z-index 使用 `Z` 常量
4. ✅ 根元素设 `pointerEvents: "auto"`
5. ✅ 坐标使用屏幕坐标（`clientX/clientY`），不使用 flow 坐标
6. ❌ 不在自己的组件内 `createPortal`
7. ❌ 不硬编码 z-index 数字
8. ❌ 不在节点组件内渲染全屏浮层

### 11.8 连线交互规范

- 使用自定义 `DeletableEdge` 替代默认边渲染
- 点击连线 → 高亮（蓝色），加入 `selectedEdgeIds`
- 鼠标悬停或选中 → 连线中点显示红色 − 按钮，点击即删除
- 20px 宽透明命中区域确保连线易于选中
- Delete/Backspace 键删除所有选中的连线（与节点共用 `deleteSelected`）
- `canvasStore.selectedEdgeIds` 追踪边的选中状态

### 11.9 画布视口规范

- 初始视口：`defaultViewport={{ x: 0, y: 0, zoom: 1 }}`，不使用 `fitView`
- 禁止 `fitView`：避免每次重渲染时自动缩放导致 200% 放大
- 用户通过 CanvasControls 的 fit_screen 按钮手动触发 fitView
- `willChange: transform` 和 `backface-visibility: hidden` 禁止在节点组件上使用（导致 GPU 光栅化模糊，执行时节点变糊）

---

## 12. 后端服务架构 (Phase 2)

### 12.1 概述

Phase 2 引入 FastAPI 后端，为桌面客户端提供：
- **AI API 代理**：官方统一 Key，按积分扣费
- **用户认证**：Email OTP + JWT
- **积分系统**：余额管理 + 交易记录 + 差异定价
- **支付**：Stripe Checkout + Webhook
- **管理后台**：Admin API（用户管理、积分充值、日志查看、模型配置）

### 12.2 技术栈

| 组件 | 选型 | 说明 |
|------|------|------|
| API 框架 | FastAPI | Python，异步 |
| 数据库 | PostgreSQL | 15+ |
| 缓存 | Redis | Session / OTP |
| 对象存储 | MinIO | S3 兼容（预留） |
| 支付 | Stripe | Checkout + Webhook |
| 部署 | Docker Compose | 单机部署 |

### 12.3 API 路由

```
/api/v1/auth/send-otp        POST  发送验证码
/api/v1/auth/verify-otp      POST  验证 + 登录

/api/v1/credits/balance      GET   查询积分余额

/api/v1/proxy/chat           POST  AI 文本代理（扣积分）
/api/v1/proxy/image          POST  AI 图片代理（扣积分）

/api/v1/billing/checkout     POST  创建 Stripe Checkout
/api/v1/billing/webhook      POST  Stripe Webhook
/api/v1/billing/subscription GET   查询订阅状态

/api/v1/admin/stats          GET   仪表盘统计
/api/v1/admin/users          GET   用户列表
/api/v1/admin/users/{id}/toggle-active POST 禁用/启用
/api/v1/admin/credits/grant  POST  积分充值
/api/v1/admin/credits/transactions GET 积分流水
/api/v1/admin/api-logs       GET   API 调用日志
/api/v1/admin/models         CRUD  模型配置
```

### 12.4 数据模型（PostgreSQL）

```sql
-- 用户（扩展现有 users 表）
ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user';

-- 积分余额
CREATE TABLE credit_balances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  balance INTEGER NOT NULL DEFAULT 0,
  plan VARCHAR(20) NOT NULL DEFAULT 'free'
);

-- 积分交易
CREATE TABLE credit_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  amount INTEGER NOT NULL,
  type VARCHAR(20) NOT NULL,  -- credit / debit
  reason VARCHAR(100),
  created_at TIMESTAMP DEFAULT NOW()
);

-- API 调用日志
CREATE TABLE api_call_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  provider VARCHAR(50),
  model VARCHAR(100),
  credits_used INTEGER,
  status VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- 模型配置（差异定价）
CREATE TABLE model_configs (
  id SERIAL PRIMARY KEY,
  provider VARCHAR(50),
  model VARCHAR(100),
  credits_per_call INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true
);
```

### 12.5 AI 路由策略

```
客户端请求 AI 调用
  ↓
有官方 JWT？
  ├── 是 → 调用 FastAPI 代理（扣积分）
  │        ├── 模型启用 → Provider Registry 选择线路 → 积分足够 → 返回结果
  │        ├── 模型禁用/类型不匹配 → 返回 MODEL_NOT_ENABLED
  │        └── 积分不足 → 返回 INSUFFICIENT_CREDITS
  └── 否 → 返回 LOGIN_REQUIRED
```

### 12.6 目录结构（后端）

```
backend/
├── app/
│   ├── main.py              ← FastAPI 入口 + 路由注册
│   ├── core/
│   │   ├── config.py        ← 环境变量 + Provider Key 配置
│   │   └── security.py      ← JWT + OTP 工具
│   ├── models/
│   │   ├── user.py          ← User 模型（含 role 字段）
│   │   └── credit.py        ← CreditBalance/Transaction/ApiCallLog/ModelConfig
│   ├── api/v1/
│   │   ├── auth.py          ← OTP 发送/验证 + 注册送积分
│   │   ├── credits.py       ← 积分余额查询
│   │   ├── proxy.py         ← AI 代理（chat + image）
│   │   ├── billing.py       ← Stripe Checkout + Webhook
│   │   └── admin.py         ← Admin API（统计/用户/积分/日志/模型）
│   └── services/
│       ├── proxy_service.py ← 兼容导出层
│       ├── proxy/           ← AI 代理核心（Provider/Model 校验、扣费、chat/image）
│       └── otp_service.py   ← OTP 生成/验证
├── migrations/              ← Alembic 迁移
├── docker-compose.yml
├── Dockerfile
└── requirements.txt
```

---

## 13. Image Editor 图层架构

### 13.1 概述

Image Editor 是全屏 Modal，从 Image List 节点的预览点击打开。采用 Procreate 风格的三栏布局，支持多图层编辑、绘画、拖放图片、AI 生成、栅格化、导出。

### 13.2 三栏布局

```
┌──────────────────────────────────────────────────────────────┐
│ ← Back │ Image Editor │ N 张图片  [栅格化] [导出到节点]      │
├──────────┬──────────────────────────────┬────────────────────┤
│ 源图片    │                              │ 图层面板           │
│ (180px)  │      主画板 (Canvas)          │ (220px)           │
│          │   多层合成渲染                 │                   │
│ [click]  │   白色背景 + 可选网格          │ [+新] [复制] [删]  │
│ [drag]   │   选择/绘画模式               │ 图层3 👁🔒        │
│          │                              │ ── opacity 滑条   │
│ 猫1.jpg  │                              │ 图层2 👁🔓        │
│ 猫2.jpg  │                              │ ── opacity 滑条   │
├──────────┤                              ├────────────────────┤
│          │                              │ [导出到节点输出]    │
├──────────┴──────────────────────────────┴────────────────────┤
│ [选择] [画笔] │ 🎨颜色 │ 笔宽 │ 橡皮 撤销 清除 │ 网格 吸附 │ [AI Edit] │
└──────────────────────────────────────────────────────────────┘
```

### 13.3 layerStore 状态模型

```typescript
interface Layer {
  id: string
  name: string           // "图层 1", "图层 2"...
  visible: boolean       // 眼睛图标 toggle
  locked: boolean        // 锁定图标 toggle
  opacity: number        // 0~1，半透明滑条
  imageSrc: string | null // 图片 base64 data URL（图片图层）
  imgX: number           // 图片在画板中的 X 位置
  imgY: number           // 图片在画板中的 Y 位置
  imgW: number           // 图片显示宽度
  imgH: number           // 图片显示高度
  naturalW: number       // 图片原始宽度（首次加载时记录）
  naturalH: number       // 图片原始高度
  strokes: Stroke[]      // 画笔笔迹数组
}

interface Stroke {
  points: { x: number; y: number }[]
  color: string
  width: number
  eraser: boolean
}

// 工具: "select" | "draw"
// GRID_SIZE: 20px
// 吸附: snapToGrid(pos) → Math.round(pos / GRID_SIZE) * GRID_SIZE
```

### 13.4 渲染流程

1. 主 canvas 尺寸 = 容器尺寸（ResizeObserver 响应式）
2. 每帧从底到顶渲染 layers：
   - `ctx.globalAlpha = layer.opacity`
   - `!layer.visible` → skip
   - 有 `imageSrc` → `drawImage` contain 模式（不拉伸）
   - 绘制该 layer 的 strokes
   - 当前绘画中的 stroke 也实时渲染
3. 选择模式：active image layer 显示蓝色虚线边框 + 右下角缩放 handle
4. 可选网格线（20px 间距）

### 13.5 图片 contain 渲染

```typescript
// 不拉伸，等比缩放 fit 到 layer rect 内
const scale = Math.min(imgW / img.width, imgH / img.height)
const drawW = img.width * scale
const drawH = img.height * scale
const drawX = layer.imgX + (imgW - drawW) / 2  // 居中
const drawY = layer.imgY + (imgH - drawH) / 2
ctx.drawImage(img, drawX, drawY, drawW, drawH)
```

### 13.6 交互模式

**选择模式 (`tool === "select"`)**:
1. 点击 resize handle → 进入 resize 拖拽（保持比例，吸附网格）
2. 点击 active layer 图片区 → 进入 move 拖拽（吸附网格）
3. 点击其他 layer 图片 → 选中该 layer + 进入 move 拖拽

**绘画模式 (`tool === "draw"`)**:
- 只在 active + unlocked layer 上画
- 支持画笔和橡皮（`globalCompositeOperation: "destination-out"`）

### 13.7 图片拖放方案

**问题**: HTML5 Drag and Drop API 对大 base64 数据不可靠（dataTransfer 限制）。

**解决方案**: 双通道
1. **Click-to-add（主）**: 点击源图片 → `addImageLayer(src, name)` 直接添加
2. **Drag（辅）**: drag start 只传 `text/image-id`（短字符串）→ drop 时通过 `imageCache` Map 查找 base64

```typescript
// SourcePanel.tsx — 模块级缓存
const imageCache = new Map<string, string>()  // imageId → base64 data URL

// drag start
e.dataTransfer.setData("text/image-id", img.id)

// LayerCanvas drop handler
const imageId = e.dataTransfer.getData("text/image-id")
const src = imageId ? imageCache.get(imageId) : null
```

### 13.8 栅格化与导出

**栅格化**: 创建离屏 canvas → 画所有可见层（含 opacity）→ `toDataURL("image/png")` → 替换为新 rasterized layer

**导出到节点**: Canvas `toDataURL()` → base64 → 调用 Rust `save_canvas_export` → 写文件 → 插入 DB → push 到 `canvasStore.nodeResults[nodeId].images` 数组

### 13.9 AI Edit

```
用户点击 AI Edit → 输入编辑指令
  → AiEditPopup 截取画布 getCanvasElement().toDataURL()
  → 调用 Rust ai_edit_image(base64, instruction, model)
  → Rust: official image edit proxy → FastAPI Provider Registry → GeekAI/备用线路
  → 返回新图片 base64
  → 前端 addImageLayer(dataUrl, "AI 生成")
```

**Rust 侧实现** (`services/ai_client.rs`):
- `ai_edit_image()`: 接收截图 + 指令 + 图片模型 → 调用官方图片编辑代理
- 进度状态: input → analyzing(30%) → generating(70%) → done(100%)

### 13.10 Image Editor 关键文件

| 文件 | 行数 | 职责 |
|------|------|------|
| `layerStore.ts` | ~330 | Zustand 图层状态管理（Layer CRUD + 绘画 + 拖拽/缩放 + 栅格化 + 网格吸附 + 持久化序列化） |
| `LayerCanvas.tsx` | ~360 | 主画板 canvas（合成渲染 + 绘画 + 选择 + 拖放接收），导出 `rasterizeLayers()` / `captureCanvasDisplay()` |
| `SourcePanel.tsx` | ~135 | 左侧源图片列表（click-to-add + drag cache + data URL 直通） |
| `LayerPanel.tsx` | ~165 | 右侧图层面板（列表 + drag-and-drop 排序 + 操作按钮 + opacity + 导出按钮） |
| `Toolbar.tsx` | ~100 | 工具栏（工具切换 + 颜色 + 笔宽 + 橡皮 + 网格 + AI Edit） |
| `AiEditPopup.tsx` | ~150 | AI 编辑弹窗（状态机 + 进度条 + rasterizeLayers 截图 + 生成） |
| `ImageEditorModal.tsx` | ~160 | 全屏 Modal 壳（三栏布局 + 持久化恢复 + 纯前端导出 + AI popup） |

### 13.11 Image Cache 策略

```typescript
// SourcePanel.tsx 模块级
const imageCache = new Map<string, string>()  // imageId → base64 data URL

// 加载时机:
//   - 普通图片: SourceThumb useEffect invoke("read_asset_file") → base64 → cache
//   - 导出图片: file_path 以 "data:" 开头 → 直接使用，不调 Rust
// 复用场景: click-to-add + drag-to-canvas + LayerCanvas image rendering
// 导出: LayerPanel 底部"导出到节点输出"按钮
```

### 13.12 图层持久化策略

```typescript
// 每次关闭 / 导出时序列化存入 nodeResults
interface LayerPersistData {
  layers: Layer[]
  activeLayerId: string | null
  showGrid: boolean
  snapEnabled: boolean
}

// 关闭时 (handleBack):
useCanvasStore.getState().setNodeResult(nodeId, { ...currentResult, layerData })

// 重新打开时 (useEffect):
const saved = nodeResults[nodeId]?.layerData
if (saved) restoreState(saved)
else reset()
```

**规则**：图层数据不存入 SQLite workflow graph_json（太大），只保留在 canvasStore 内存；工作流保存时会一起序列化到 graph_json 但仅用于 undo/redo，不保证跨会话持久。

### 13.13 Canvas 导出 API

| 函数 | 说明 | 用途 |
|------|------|------|
| `captureCanvasDisplay()` | `canvasEl.toDataURL()`，含网格/选择框 | ImageEditorModal 导出到节点（供用户确认所见即所得） |
| `rasterizeLayers()` | 离屏合成，只含图层内容，无 UI 装饰 | 栅格化 + AI Edit 截图（需要干净图像） |

**规则**：凡需要干净图像（送给 AI 或合并图层），使用 `rasterizeLayers()`。凡需要截屏（所见即所得预览），使用 `captureCanvasDisplay()`。

---

## 14. Html Editor 终点架构

### 14.1 概述

当前公众号主流程以 `html_formatter` 作为终点。节点执行完成后产出 HTML，用户双击节点打开全屏 Html Editor，完成二次编辑、微信预览、AI 改写与复制 HTML。`preview_wechat` 仅作为历史/legacy 预览能力保留，不进入默认模板。

### 14.2 组件结构

```
Canvas
└── OverlayLayer
    └── HtmlEditorModal
        ├── TiptapEditor       ← 左侧富文本编辑
        ├── WeChatPreview      ← 右侧微信样式实时预览
        └── HtmlRewritePopup   ← AI 改写弹窗
```

### 14.2.1 多主题模板

`standardPurpleHtml.ts` 提供公众号样式主题 registry。当前支持 `standard_purple`、`classic_blue`、`ink_black`、`warm_gray`、`terracotta`。Html Formatter 节点和 Html Editor 共享 `toWechatStyledHtml(html, themeId)`，确保节点主题、编辑器预览、复制源码和复制到公众号的输出一致。

### 14.3 状态与持久化

- 打开入口：`HtmlFormatterNode` done 状态双击调用 `openHtmlEditor(nodeId)`。
- 编辑过程：`TiptapEditor.onUpdate` 写回 `canvasStore.nodeResults[nodeId].html`，右侧预览实时更新。
- 关闭时：`HtmlEditorModal` 将最终 HTML 写入节点 `data.editedHtml`，同一工作流会话内重新打开不丢内容。
- 后续若要跨会话保留执行结果，需要扩展 workflow `graph_json` 或新增本地 execution result 表。

### 14.4 关键文件

| 文件 | 职责 |
|------|------|
| `frontend/src/nodes/HtmlFormatterNode.tsx` | 终点节点 UI、双击打开编辑器 |
| `frontend/src/nodes/image/HtmlEditorModal.tsx` | 全屏双栏编辑壳、保存闭环 |
| `frontend/src/nodes/image/TiptapEditor.tsx` | Tiptap 富文本编辑器 |
| `frontend/src/nodes/image/WeChatPreview.tsx` | 微信样式实时预览 |
| `frontend/src/nodes/image/standardPurpleHtml.ts` | 公众号样式主题 registry 与 HTML 内联样式输出 |
| `frontend/src/nodes/image/HtmlRewritePopup.tsx` | AI 改写交互 |
| `src-tauri/src/commands/asset.rs` | `ai_rewrite_html` IPC 命令 |

## 15. Personal Library 全局素材库

### 15.1 设计目标

个人素材库是 workspace 级能力，不绑定单个 workflow。用户可将 Text 节点内容保存为文章素材，将 Image Editor 当前画布保存为图片素材，并在任意新工作流中复用。

### 15.2 数据模型

| 表 | 职责 |
|----|------|
| `library_items` | 存储文章/图片素材、内容、文件路径、来源 workflow/node |
| `library_tags` | 全局标签字典 |
| `library_item_tags` | 素材与标签多对多关系 |

图片素材保存到 `$APPDATA/library/images`，工作流运行产生的图片仍保存到 `$APPDATA/assets/{workflow_id}`。Tauri `assetProtocol` 同时允许 `assets/**` 和 `library/**` 用于本地预览。

### 15.3 前端结构

| 文件 | 职责 |
|------|------|
| `frontend/src/library/LibraryDrawer.tsx` | 工作流左侧素材库侧拉面板 |
| `frontend/src/library/LibrarySaveDialog.tsx` | 保存素材和标签弹窗 |
| `frontend/src/pages/dashboard/WorkspaceLibraryPanel.tsx` | Workspace Library 标签页，Gallery/List/Graph 入口 |
| `frontend/src/pages/dashboard/LibraryKnowledgeGraph.tsx` | 基于素材类型、标签、素材生成 SVG 知识图谱 |
| `frontend/src/store/libraryStore.ts` | 素材列表、标签、创建、删除状态 |
| `frontend/src/nodes/ImageAssetNode.tsx` | 可缩放图片容器节点，输出 `image_slot` |
| `src-tauri/src/commands/library.rs` | 素材库 Tauri IPC 命令 |

### 15.4 Graph 推导规则

- Graph 视图通过 `list_library_items({ kind?, query?, tag? })` 读取本地素材，不新增数据库表。
- 节点类型：素材库根节点、类型节点（文档/图片）、标签节点、素材节点。
- 边类型：根节点 → 类型/标签，类型 → 素材，标签 → 素材。
- 点击标签节点写回 `libraryStore.selectedTag`，点击类型节点同步当前素材类型筛选。

## 16. Writer 高级节点架构

`writer` 是长文/小说/书稿场景的高级节点，不进入公众号默认 Skill 主链路。其执行仍走官方文本模型代理，输出纯文本 draft。

### 16.1 组件结构

```
Canvas
└── OverlayLayer
    └── WriterEditorModal
        ├── textarea          ← 左侧纯文本/Markdown 书稿编辑
        └── BookPreview       ← 右侧 PDF/书籍式分页预览
```

### 16.2 状态与持久化

- 打开入口：`WriterNode` 按钮或 done 状态双击调用 `openWriterEditor(nodeId)`。
- 编辑过程：写回 `canvasStore.nodeResults[nodeId].text`，保持输出端可继续作为 text 被下游消费。
- 关闭时：写入节点 `data.editedText`，同一工作流会话内重新打开不丢内容。

### 16.3 关键文件

| 文件 | 职责 |
|------|------|
| `frontend/src/nodes/WriterNode.tsx` | Writer 节点 UI、模型/字数/风格选择、打开编辑器 |
| `frontend/src/nodes/writer/WriterEditorModal.tsx` | 全屏书稿编辑器壳与保存闭环 |
| `frontend/src/nodes/writer/BookPreview.tsx` | Markdown-ish 纯文本解析与书籍式分页预览 |
| `frontend/src/store/overlayStore.ts` | `writerEditorNodeId` overlay 状态 |

---

*本文档是技术决策的权威来源。每次架构变更必须先更新此文档，再修改代码。*
