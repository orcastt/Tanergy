# TANGENT Web AI Image Canvas — Architecture Decision Document

**版本**: v0.2
**日期**: 2026-04-29
**状态**: Web 重启方向正式架构草案，开发前基线
**对应 PRD**: `PRD.md`

---

## 0. 文档使用方式

本文件回答“怎么做、用什么做、边界在哪里、哪些安全底线不能破”。
用户可见需求见 `PRD.md`。
当前状态见 `project_state.md`。
每次大改架构、换栈、换部署方式、改数据模型，都必须同步更新本文件。

---

## 1. 技术决策依据

### 1.1 用户范围与并发

| 项 | 决策 |
|----|------|
| 产品形态 | Web App，面向外部用户，不再优先做桌面客户端 |
| P0 用户范围 | 小规模 Alpha / 内测用户 |
| P0 并发目标 | 20-50 concurrent active users |
| P1 并发目标 | 100-300 concurrent active users |
| 单用户操作峰值 | 同一用户可能同时触发 1-2 个 AI 生图任务 |
| AI 并发限制 | 服务端按用户、IP、模型做限流；P0 默认每用户最多 1 个 running generation |

并发用户数决定 P0 不需要复杂微服务，但需要清晰的后端边界、队列预留和 API 日志。

### 1.2 数据归属

| 数据 | 存储位置 | 归属 |
|------|----------|------|
| 用户账号 | PostgreSQL | 用户本人；平台代管 |
| Board 元数据 | PostgreSQL | 用户/Workspace |
| 画布文档状态 | P0 可存在 PostgreSQL JSON；协作后进入协作文档存储 | 用户/Workspace |
| 生成图片 | S3-compatible object storage | 用户/Workspace |
| API 调用日志 | PostgreSQL | 平台运营数据，含用户关联 |
| Provider API Key | 服务端环境变量或密钥管理 | 平台，不属于用户 |

用户应有权导出和删除自己的 Board 与图片。面向欧洲用户时，需要支持 GDPR 删除请求。

### 1.3 认证和权限

| 项 | 决策 |
|----|------|
| 是否登录 | 需要登录 |
| 登录方式 | P0 复用现有 FastAPI JWT / Email OTP；海外可加 Google OAuth |
| 权限模型 | P0: owner-only；P0.5: owner / editor / viewer |
| 服务端鉴权 | 所有 Board、Asset、AI Run API 必须校验当前用户 |
| Admin 权限 | 独立 admin role；不进入 Web Canvas P0 页面 |

客户端不能决定权限，所有读写都由服务端按 token 解析出的 user_id 校验。

### 1.4 支付

| 项 | 决策 |
|----|------|
| P0 是否付费 | 不做完整付费闭环，可使用测试额度 |
| P1 支付方式 | Stripe Checkout + Webhook |
| 计费单位 | 内部继续用 credits |
| 汇率口径 | 历史账本不重算；海外购买可用 USD 展示 |
| 超额处理 | 余额不足时拒绝 AI 调用，返回结构化错误 |

P0 只需要记录 API 成本和调用日志，避免先做复杂订阅系统。

### 1.5 隐私合规

| 项 | 决策 |
|----|------|
| 收集数据 | 邮箱、登录信息、Board、图片、Prompt、AI 调用日志 |
| 告知 | 需要 Privacy Policy / Terms 页面，P0 可先准备文案占位 |
| GDPR | 需要支持用户删除账号和数据的技术路径 |
| 数据最小化 | API Log 不保存 Provider Key；必要时 Prompt 可脱敏或按策略保留 |
| 图片隐私 | 图片 URL 不公开暴露；使用带权限或不可猜测路径 |

### 1.6 性能上限

| 指标 | P0 目标 |
|------|---------|
| 首屏 Dashboard 加载 | < 2 秒 |
| Canvas 打开 | < 2 秒，空画布 < 1 秒 |
| 节点拖动响应 | 60fps 目标；明显不卡顿 |
| 生图等待 | 取决于 Provider；UI 必须立刻进入 running 状态 |
| 单图上传大小 | P0 最大 20MB |
| Board 对象数量 | P0 目标 500 objects 内稳定 |
| Merge Capture | 选区最长边建议 <= 4096px，超出提示降采样 |

### 1.7 成本上限

| 项 | P0 预算 |
|----|---------|
| Web hosting | $0-$20/月 |
| Backend hosting | $10-$50/月 |
| PostgreSQL | $0-$30/月 |
| Object storage | $0-$20/月 |
| AI API | Alpha 限额，目标 <= $100/月 |
| Realtime collaboration | P0 不接；P0.5 另设预算 |

超预算处理：

- AI 调用按用户限流。
- 默认低成本模型参数。
- 关闭高分辨率选项。
- Admin 后端可禁用模型或 Provider。

### 1.8 安全底线

1. API Key 永远不进入前端代码。
2. `.env` 不提交 Git，只提交 `.env.example`。
3. 服务端所有数据查询必须带当前 user_id / workspace_id 校验。
4. 登录、验证码、生图接口必须限流。
5. 图片上传必须限制 MIME、大小和扩展名。
6. 运行时 `blob:` / `data:` 图片不能进入持久化 JSON；保存前必须上传为 Asset。
7. AI 请求参数不能允许前端任意指定未启用 Provider。
8. 管理后台不能向普通用户暴露。
9. 错误日志不能打印真实 API Key。

### 1.9 可用性

| 项 | 决策 |
|----|------|
| P0 可接受宕机 | Alpha 阶段可接受短时不可用 |
| 数据备份 | PostgreSQL 每日备份；对象存储保留 |
| AI Provider 挂了 | 节点显示失败和 Retry；P1 再做 fallback 自动切换 |
| 前端异常 | Error Boundary 显示恢复按钮 |
| 保存策略 | P0 手动/自动保存 Board state；P0.5 协作后改为实时同步 |

### 1.10 第三方依赖

| 依赖 | 用途 | 挂了怎么办 |
|------|------|------------|
| GeekAI | AI 生图 / 图像模型代理 | 生图失败，记录日志，可重试 |
| OpenAI/Gemini via GeekAI | 上游模型 | 由 Provider 层隔离 |
| Stripe | P1 支付 | P0 不阻塞 |
| S3 / MinIO / R2 | 图片存储 | 上传失败，导出结果暂不创建 Asset |
| Email provider | OTP / magic link | 登录不可用，显示错误 |
| Liveblocks/PartyKit/Yjs | P0.5 协作 | P0 不依赖 |

### 1.11 上线平台

| 层 | 平台 |
|----|------|
| Web App | Vercel / Cloudflare Pages / 自托管 Node |
| Backend | Render / Fly.io / Railway / VPS Docker |
| Database | Managed PostgreSQL 或 Docker PostgreSQL |
| Object Storage | Cloudflare R2 / S3 / MinIO |
| Admin | 现有 Next.js Admin 保留，不作为 P0 Web Canvas 主入口 |

### 1.12 维护方式

| 项 | 决策 |
|----|------|
| 维护人 | 当前单人维护 |
| 响应目标 | Alpha 阶段 24-48 小时内处理阻塞问题 |
| 监控 | P0 至少记录 API 错误、Provider 错误、前端异常 |
| 发布 | 小步切片，PRD/ARCH/project_state 更新后再 commit |
| 回滚 | Git commit + 部署平台 rollback |

---

## 2. 锁定技术栈

### 2.1 P0 技术栈

| 层级 | 技术 | 选择理由 |
|------|------|----------|
| Web 框架 | Next.js + React + TypeScript | 适合 Web SaaS、路由、部署、未来 OAuth/SEO |
| Canvas | tldraw SDK 优先 | 白板、图片、画笔、箭头、自定义 shape 更贴近目标 |
| 节点 UI | tldraw custom shapes 或独立轻节点层 | P0 需要 Text / Multi Generate / Image / Image Editor |
| 状态管理 | Zustand | 当前项目已使用，轻量，可控 |
| UI | Tailwind CSS + Radix UI | 当前设计体系一致，易维护 |
| 后端 | FastAPI | 当前已有 backend，可复用认证、Provider、Credits、Logs |
| 数据库 | PostgreSQL | 当前已有，适合用户、Board、Asset、AI Log |
| 图片存储 | S3-compatible storage / MinIO dev | 生成图、导出图、合并图需要持久化 |
| AI Provider | GeekAI through backend proxy | 当前已联调 gpt-image-2，Key 不暴露前端 |
| 测试 | Vitest / Playwright / pytest | 前端单测、端到端、后端 API 测试 |

### 2.2 不选择 / 暂不选择

| 技术 | 原因 |
|------|------|
| Tauri | 当前方向不做桌面端 |
| React Flow 作为唯一画布 | 更偏工程节点流，涂鸦/图片/白板/截图合并成本高 |
| 完整 Paper.js 复制 | Tanva 技术债较多，不照搬 |
| Electron | 不做桌面端 |
| Supabase 全量替换 | 当前已有 FastAPI/PostgreSQL，不在 P0 换栈 |
| BYOK 前端 API Key | 安全风险，当前官方代理优先 |
| 微服务 | P0 规模不需要，会增加维护成本 |

### 2.3 技术栈变更规则

除非技术 spike 证明 tldraw 无法满足以下能力，否则不换画布技术：

- 自定义节点卡片。
- 图片对象。
- 画笔/橡皮。
- 选中对象离屏导出。
- 缩放/拖动/框选/连线无坐标偏移。

如果失败，再评估：

1. tldraw + 独立节点层。
2. React Flow + whiteboard layer。
3. Paper.js 自研轻量画布。

---

## 3. 目录结构和分层逻辑

### 3.1 推荐目录结构

```text
TanvasAgent/
├── PRD.md
├── ARCH.md
├── project_state.md
├── reference/
│   ├── theme.ts
│   └── design-system.md
├── apps/
│   └── web/
│       ├── package.json
│       ├── next.config.ts
│       └── src/
│           ├── app/
│           │   ├── login/
│           │   ├── boards/
│           │   └── boards/[boardId]/
│           ├── components/
│           │   ├── ui/
│           │   ├── canvas/
│           │   ├── nodes/
│           │   └── editor/
│           ├── features/
│           │   ├── auth/
│           │   ├── boards/
│           │   ├── canvas/
│           │   ├── ai-runs/
│           │   └── assets/
│           ├── hooks/
│           ├── services/
│           ├── store/
│           ├── types/
│           └── lib/
├── backend/
│   └── app/
│       ├── api/v1/
│       ├── models/
│       ├── schemas/
│       ├── services/
│       └── core/
└── admin/
```

### 3.2 分层原则

| 层 | 只负责什么 | 禁止什么 |
|----|------------|----------|
| `components/ui` | 通用按钮、输入框、弹窗 | 写业务请求 |
| `components/canvas` | 画布渲染、工具栏、坐标交互 | 调 Provider API |
| `components/nodes` | 节点卡片 UI | 直接访问数据库 |
| `features/*` | 业务流程和 hook | 写通用 UI 样式系统 |
| `services` | HTTP 请求封装 | 存 React 状态 |
| `store` | 前端状态 | 直接写复杂业务规则 |
| `backend/services` | 服务端业务逻辑 | 返回前端组件结构 |
| `backend/models` | ORM 数据模型 | 处理 HTTP 请求 |

### 3.3 文件大小

- 单文件目标不超过 300 行。
- 超过 300 行优先拆分：
  - UI 拆 component。
  - 业务流程拆 hook。
  - 纯函数拆 `lib`。
  - 类型拆 `types`。

---

## 4. 核心模块划分

### 4.1 Auth 模块

职责：

- 登录 / 登出。
- 获取当前用户。
- 前端路由保护。
- 后端 token 校验。

不负责：

- Board 权限业务。
- Provider Key。

### 4.2 Board 模块

职责：

- Board 创建、列表、重命名、删除。
- Board document_state 保存和加载。
- Board 空状态。

不负责：

- AI 生图调用。
- 图片二进制存储。

### 4.3 Canvas 模块

职责：

- tldraw 初始化。
- world coordinate / viewport 管理。
- pan、zoom、selection、drag。
- 图片对象、笔迹、箭头。
- Merge Capture 离屏渲染。

不负责：

- Provider API Key。
- 服务端鉴权。

### 4.4 Node Runtime 模块

职责：

- Text / Multi Generate / Image / Image Editor 节点类型。
- 节点连接规则。
- 节点执行状态。
- 节点自动布局。

不负责：

- 复杂工作流引擎。
- Research / Outline / Html Formatter。

### 4.5 Image Editor 模块

职责：

- 加载输入图片。
- 绘图、擦除、清空。
- 栅格化导出。
- 导出为 Asset 和 Image Node。

不负责：

- 专业多图层修图。
- 长历史栈。

### 4.6 AI Runs 模块

职责：

- 前端发起 AI Run。
- 后端校验、扣费、调用 Provider、保存日志。
- 返回 Asset URL。
- 失败处理和退款/no-charge 标记。

不负责：

- 前端保存 API Key。
- 复杂模型市场 UI。

### 4.7 Assets 模块

职责：

- 上传图片。
- 保存生成图、编辑导出图、合并截图。
- 返回可持久化 URL。
- 禁止持久化 `blob:` / `data:`。

不负责：

- P0 素材库标签。
- Personal Assets 页面。

### 4.8 AI Planner 模块

职责：

- 接收自然语言。
- 生成最小 graph spec。
- 前端校验后应用到画布。

不负责：

- 自主执行复杂 Agent。
- 多轮长对话记忆。

---

## 5. 数据模型设计

### 5.1 关系概览

```text
User 1 ── * WorkspaceMembership * ── 1 Workspace
Workspace 1 ── * Board
Board 1 ── * Asset
Board 1 ── * AiRun
Board 1 ── 1 document_state(JSON)
AiRun * ── * Asset(output)
```

P0 可以简化为每个 User 默认一个 personal Workspace。

### 5.2 User

- `id`
- `email`
- `display_name`
- `avatar_url`
- `role`
- `created_at`
- `last_login_at`

约束见 `PRD.md`。

### 5.3 Board

- `id`
- `workspace_id`
- `owner_id`
- `title`
- `thumbnail_url`
- `document_state`
- `created_at`
- `updated_at`

`document_state` 包含：

- canvas objects
- nodes
- edges
- viewport
- editor draft state references

### 5.4 Asset

- `id`
- `workspace_id`
- `board_id`
- `kind`
- `url`
- `mime_type`
- `size_bytes`
- `width`
- `height`
- `created_by`
- `created_at`

### 5.5 AiRun / ApiCallLog

- `id`
- `user_id`
- `board_id`
- `node_id`
- `provider`
- `model`
- `endpoint`
- `request_params`
- `response_meta`
- `status`
- `latency_ms`
- `cost_credits`
- `error_code`
- `created_at`

现有 backend 的 `api_call_logs` 字段可复用和扩展。

### 5.6 Document State

前端保存的 Board 文档结构建议：

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [],
  "edges": [],
  "canvasObjects": [],
  "updatedAt": "2026-04-29T00:00:00Z"
}
```

P0 不把 `blob:` / `data:` 存入此 JSON。所有图片引用必须是 `asset_id` 或远程 URL。

---

## 6. 服务端 vs 客户端边界

### 6.1 客户端可以做

- 渲染页面和画布。
- 处理 pan/zoom/drag/selection。
- 本地编辑 Text Node。
- 本地绘制笔迹。
- 组织 graph spec 并提交服务端。
- 调用自己的后端 API。
- 显示 loading / error / empty 状态。

### 6.2 客户端不能做

- 保存真实 Provider API Key。
- 直接调用 GeekAI。
- 决定用户是否有权限访问 Board。
- 决定是否扣费。
- 信任前端传来的 user_id。
- 持久化 `blob:` / `data:` 图片。

### 6.3 服务端必须做

- 认证和权限校验。
- 查询时带 user_id / workspace_id。
- Provider key 管理。
- AI 调用和重试策略。
- API 调用日志。
- Credits 计算。
- Asset 上传签名或服务端保存。
- 结构化错误返回。

---

## 7. 状态管理方案

### 7.1 状态分类

| 状态 | 放哪里 |
|------|--------|
| 当前用户 | auth store + server session |
| Board 列表 | query cache |
| 当前 Board document | canvas store |
| 节点运行状态 | node runtime store + persisted document |
| 临时 UI 弹层 | overlay store |
| Image Editor 草稿 | editor store；导出后变 Asset |
| API 请求状态 | per feature hook / query |
| AI Chat 输入 | local component state，必要时 store |

### 7.2 保存策略

P0：

- 用户操作后 debounce 保存 Board document。
- 关键操作（生成结果、导出、合并）立即保存。
- 保存失败时显示状态，不丢本地当前操作。

P0.5 协作：

- 引入协作文档层。
- 对象以 world 坐标同步。
- Presence 与 document state 分离。

### 7.3 坐标状态

必须只有一个 viewport source of truth：

- `screenToWorld()`
- `worldToScreen()`
- resize 只更新容器尺寸，不改对象坐标。
- fit view 只在用户明确点击时执行，不自动反复触发。

---

## 8. API 设计

### 8.1 认证

```http
GET /api/v1/me
POST /api/v1/auth/login
POST /api/v1/auth/logout
```

返回当前用户、登录状态和权限。

### 8.2 Boards

```http
GET /api/v1/boards
POST /api/v1/boards
GET /api/v1/boards/{board_id}
PATCH /api/v1/boards/{board_id}
DELETE /api/v1/boards/{board_id}
```

约束：

- 所有接口必须校验 Board 属于当前用户或当前 workspace。
- `PATCH` 只允许更新 title、thumbnail、document_state 等白名单字段。

### 8.3 Assets

```http
POST /api/v1/assets/upload
POST /api/v1/assets/from-data-url
GET /api/v1/assets/{asset_id}
DELETE /api/v1/assets/{asset_id}
```

P0 可先用 `from-data-url` 处理 editor export / merge capture，但服务端必须落成真实 Asset URL 后返回，不能让 `data:` 进入持久化 document。

### 8.4 AI Runs

```http
POST /api/v1/ai/runs
GET /api/v1/ai/runs/{run_id}
```

请求示例：

```json
{
  "board_id": "uuid",
  "node_id": "gen-1",
  "type": "image_generation",
  "model_role": "default_image",
  "prompt": "A clean product poster...",
  "params": {
    "count": 4,
    "quality": "low"
  }
}
```

成功响应：

```json
{
  "run_id": "uuid",
  "status": "succeeded",
  "assets": [
    { "id": "uuid", "url": "https://..." }
  ],
  "cost_credits": 0.0,
  "latency_ms": 12345
}
```

错误响应：

```json
{
  "code": "MODEL_UNAVAILABLE",
  "message": "The selected image model is unavailable.",
  "retryable": true
}
```

### 8.5 AI Planner

```http
POST /api/v1/ai/planner
```

请求：

```json
{
  "board_id": "uuid",
  "message": "Create a workflow to generate 4 cat poster ideas and edit the best one."
}
```

响应：

```json
{
  "nodes": [
    { "id": "text-1", "type": "text", "text": "A cat poster..." },
    { "id": "gen-1", "type": "multi_generate", "count": 4 },
    { "id": "editor-1", "type": "image_editor" }
  ],
  "edges": [
    { "from": "text-1", "to": "gen-1" },
    { "from": "gen-1", "to": "editor-1", "deferred": true }
  ],
  "layout": "horizontal"
}
```

前端必须校验：

- type 是否属于 P0 允许列表。
- edge 是否符合连接规则。
- 节点数量是否合理。
- layout 是否可应用在当前 viewport。

### 8.6 Merge Capture

P0 可先在前端离屏渲染，然后上传：

```http
POST /api/v1/assets/from-data-url
```

后续如服务端渲染：

```http
POST /api/v1/boards/{board_id}/merge-captures
```

---

## 9. Canvas 架构细则

### 9.1 单一坐标系统

所有对象必须存 world 坐标：

- nodes
- edges
- images
- strokes
- selection bounds
- merge bounds

禁止让绘图层和节点层分别维护不同 transform。

### 9.2 画布精度验收

| 场景 | 必须通过 |
|------|----------|
| 50% / 100% / 200% 缩放 | 点击、拖动、框选、连线端口不偏移 |
| 浏览器 resize | 对象位置不漂移 |
| Retina / 高 DPI | 画笔位置准确 |
| 图片发送到画布 | 图片出现在当前 viewport 附近 |
| Merge Capture | 输出只包含选中对象内容 |

### 9.3 Merge Capture 实现原则

- 使用画布对象数据离屏渲染。
- 不使用 DOM 截屏作为 P0 主方案。
- 不截入 UI、网格、选择框。
- 选区过大时提示降采样。

### 9.4 Tanva 参考边界

可参考：

- 图片发送到画布。
- 图层/对象面板的概念。
- 统一坐标转换工具。
- 运行时图片引用与持久化图片引用分离。

不复制：

- 完整 Paper.js 代码。
- 复杂 DrawingController。
- Library / Global History / Personal Assets。
- 视频、3D、会员、复杂模型配置。

---

## 10. 安全规范

### 10.1 环境变量

- `.env` 存真实 key，不提交。
- `.env.example` 只写变量名。
- 后端读取 `GEEKAI_API_KEY` 等变量。
- 前端只能读取公开安全变量，如 `NEXT_PUBLIC_API_BASE_URL`。

### 10.2 鉴权

- 所有 protected API 必须验证 JWT/session。
- 不接受前端传来的 user_id 作为权限依据。
- Board 查询必须包含当前用户权限过滤。

### 10.3 上传安全

- 限制 MIME：PNG/JPEG/WebP。
- 限制大小：P0 单图 20MB。
- 文件名服务端生成。
- 不信任客户端传来的扩展名。

### 10.4 AI 安全

- Provider key 不进入 logs。
- Prompt 可进入 API Log，但后续可加脱敏策略。
- 内容违规返回结构化错误。
- 生图接口做用户级限流。

---

## 11. 部署与环境

### 11.1 环境

| 环境 | 用途 |
|------|------|
| local | 本地开发 |
| staging | 真 API 小流量验收 |
| production | 正式用户 |

### 11.2 P0 本地开发命令

具体命令以后以实际 `package.json` 为准。原则：

```bash
npm -C apps/web run dev
npm -C apps/web run build
npm -C apps/web run lint
pytest backend/tests
```

### 11.3 质量闸门

前端：

- `npm -C apps/web run build`
- `npm -C apps/web run lint`
- `npm -C apps/web run typecheck`
- 触碰文件定向 lint

后端：

- 相关 pytest
- 最小 API 检查

通用：

- `git diff --check`
- 更新 `project_state.md`

---

## 12. 开发切片原则

每次只做可独立验收的端到端切片：

1. Canvas 坐标 spike。
2. Text / Multi Generate / Image / Image Editor 节点 UI。
3. Text → Multi Generate 4 图真实调用。
4. 缩略图 → Image Node。
5. Image Editor 绘图导出 → New Image Node。
6. Send to Canvas → Markup。
7. Merge Capture → New Image Node。
8. AI Chat 自动搭线。
9. Dashboard / 保存 / 登录收口。
10. P0.5 多人协作。

每个切片完成后：

- 对照 PRD 验收清单手测。
- 跑质量闸门。
- 更新 `project_state.md`。
- 再 commit。

---

## 13. 已知技术风险

| 风险 | 缓解 |
|------|------|
| tldraw 自定义节点不足 | 先做 spike；失败再评估轻节点层 |
| 坐标偏移复发 | 单一 world 坐标；先验收坐标再做 AI |
| Editor 变复杂 | P0 只做画笔、橡皮、导出 |
| Merge Capture 截到 UI | 离屏渲染对象，不 DOM 截屏 |
| AI 成本失控 | 默认低成本参数，限流 |
| 旧项目复杂度回流 | 冻结旧桌面/公众号/素材库路线 |
| API Key 泄露 | Key 只在服务端 `.env` |
| 数据权限遗漏 | 所有查询带 current user / workspace |

---

## 14. 三份全局文档

本项目当前使用：

- `PRD.md`：新 Web AI 图像画布 PRD。
- `ARCH.md`：新 Web AI 图像画布架构。
- `project_state.md`：当前状态和下一步。

旧文件：

- `PRD.md`：旧桌面/公众号路线，legacy/frozen。
- `ARCH.md`：旧 Tauri/FastAPI 商业化路线，legacy/frozen。

每次新对话建议提示：

```text
先读项目根目录的 project_state.md、PRD.md 和 ARCH.md，了解当前状态，然后我们来做「具体任务」。
```
