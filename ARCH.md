# TANGENT Web AI Image Canvas — Architecture Decision Document

**版本**: v0.6
**日期**: 2026-05-01
**状态**: Web 重启方向正式架构；S1.5 与 Asset LOD Slice A-D 已通过，当前主线是 Slice E Real Asset Pipeline，正在从本地 Asset / Board bridge 迁向 Auth context + storage adapter + future FastAPI/R2
**对应 PRD**: `PRD.md`

---

## 0. 文档使用方式

本文件回答“怎么做、用什么做、边界在哪里、哪些安全底线不能破”。
用户可见需求见 `PRD.md`。
当前状态见 `project_state.md`。
跨功能执行规范见 `HARNESS.md`。
每次大改架构、换栈、换部署方式、改数据模型，都必须同步更新本文件。

当前架构交接状态：

- tldraw-first + Node Runtime + SVG runtime edge 架构继续保留，不切 React Flow / Konva。
- LOD 状态是本地 UI 状态，不写入 Board document / CRDT。
- 当前 Next 本地 Asset API bridge 已有 request context + storage adapter seam；metadata 带 `workspaceId` / `createdBy`。
- Board save guard + local save/restore 已能挡住 `data:` / `blob:` / base64 payload，并用于开发验证。
- Windows 当前遗留卡顿是 non-blocking performance follow-up，后续优先通过真实 Asset Pipeline、多尺寸缩略图和 viewport-aware 挂载解决。
- Cloudflare quick tunnel、`NEXT_ALLOWED_DEV_ORIGINS`、`CanvasRuntimeDiagnostics` 只属于跨平台测试支架，不是部署架构；`CanvasRuntimeDiagnostics` 默认关闭，仅 `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1` 时启用。

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
| 节点重型结果 | PostgreSQL / object storage / cache | 用户/Workspace；通过 id 引用 |
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
| 单图上传大小 | P0 最大 30MB |
| 画布粘贴图片 | P0 需要限制单图大小和长边；大量外部图片进入画布前优先压缩/降采样 |
| Canvas 最大缩放 | P0 Spike 当前限制为 500%；tldraw 默认 800% 对当前图像画布没有产品意义且性能成本更高 |
| 复杂 React 节点 | Step 1.5 必须验证 50-100 个节点；不能只依赖画布库视窗剔除的理论能力 |
| Board 对象数量 | P0 目标 500 objects 内稳定 |
| Merge Capture | 选区最长边建议 <= 4096px，超出提示降采样 |

当前跨平台性能口径：

- Slice D 普通 canvas image LOD + Image Node LOD + Node LOD 已通过 Mac / Windows 手测，可进入下一切片。
- Windows 50+ 图片/节点、50%-100% 画布缩放下仍可能轻微卡顿，但当前不阻塞 Slice E。
- 后续性能优化不应继续围绕 quick tunnel 调参，而应落到 server-backed Asset、缩略图生成、持久化 asset id 和更细的可见性挂载。

### 1.7 成本上限

详细海外部署、用户量、社媒增长、AI 单位经济预测见 `dev-plans/overseas-cost-growth-forecast.md`。

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
| 阶段快照 | 阶段性开发动作、大范围修复或高风险重构前，先创建/切换工作分支并提交当前稳定快照 |
| 回滚 | Git commit + 部署平台 rollback |

---

## 2. 锁定技术栈

### 2.1 P0 技术栈

| 层级 | 技术 | 选择理由 |
|------|------|----------|
| Web 框架 | Next.js + React + TypeScript | 适合 Web SaaS、路由、部署、未来 OAuth/SEO |
| Canvas | tldraw SDK 优先 | 白板、图片、画笔、箭头、自定义 shape 更贴近目标 |
| 节点 UI | tldraw custom shapes + React HTMLContainer | P0 需要 Prompt / Image Gen / Image Gen 4 / Analysis / Image；复杂表单不全部塞进节点 |
| Node Runtime | 自研轻量运行时 | 管节点类型、端口、参数 schema、连接规则、运行状态映射 |
| Node Data Edges | Node Runtime edge store + SVG overlay | 数据端口线需要 React Flow / ComfyUI 式稳定曲线，不复用 tldraw arrow 的中点/锚点编辑 |
| Node Registry | TypeScript 注册表 | 每种节点声明 `type`、`version`、`ports`、`paramsSchema`、`renderComponent`、`validate`、`migrate` |
| Inspector | React 左侧侧边栏 | 编辑复杂节点参数，降低节点卡片膨胀风险，并为右侧 AI Chat 预留空间 |
| Layout Engine | P0 手写 horizontal layout；后续 Dagre/ELK | AI Chat 自动创建节点时计算 x/y，避免重叠 |
| 状态管理 | Zustand | 当前项目已使用，轻量，可控 |
| UI | Tailwind CSS + Radix UI | 当前设计体系一致，易维护 |
| 后端 | FastAPI planned under `services/api` | 当前 `services/api` 仍是新 Web 后端空壳；不要复用 legacy backend，下一步按 Auth / Workspace / Asset / AiRun 边界新建 |
| 数据库 | PostgreSQL planned | 适合用户、Board、Asset、AI Log；当前 P0 spike 先用本地 `.tangent-boards/` 验证 document guard |
| 图片存储 | Local dev bridge now; R2 / S3-compatible planned | 当前 Next local bridge 写 `.tangent-assets/`；生产迁到 R2/S3-compatible object storage |
| AI Provider | GeekAI / model providers through future backend proxy | Key 不暴露前端；真实 AI Run 在 Asset Pipeline 稳定后接入 |
| 测试 | Vitest / Playwright / pytest | 前端单测、端到端、后端 API 测试 |

### 2.2 不选择 / 暂不选择

| 技术 | 原因 |
|------|------|
| Tauri | 当前方向不做桌面端 |
| React Flow 作为默认主画布 | 更偏工程节点流，涂鸦/图片/白板/截图合并成本高；仅作为 Step 1.5 失败后的 fallback |
| 完整 Paper.js 复制 | Tanva 技术债较多，不照搬 |
| Electron | 不做桌面端 |
| Supabase 全量替换 | 当前路线保留 FastAPI + PostgreSQL planned boundary，不在 P0 中途换成 Supabase 全托管 |
| BYOK 前端 API Key | 安全风险，当前官方代理优先 |
| 微服务 | P0 规模不需要，会增加维护成本 |

### 2.3 技术栈变更规则

除非技术 spike 证明 tldraw 无法满足以下能力，否则不换画布技术：

- 自定义节点卡片。
- 图片对象。
- 画笔/橡皮。
- 选中对象离屏导出。
- 缩放/拖动/框选/连线无坐标偏移。
- 复杂节点内部输入、下拉、按钮、滚轮不误触画布。
- 简单端口/Handle 连线和连接规则校验。
- AI Chat 插入节点后的当前视野自动布局。

如果 Step 1.5 任一关键项失败，再评估：

1. tldraw + 独立节点层。
2. React Flow + Konva / whiteboard layer。
3. Paper.js 自研轻量画布。

Step 1.5 的硬性裁决项：

- Image Gen / Image Gen 4 复杂节点可交互。
- 端口连线可视且可校验。
- text / image 数据类型有不同端口和连线颜色。
- Image Gen / Image Gen 4 的 image 输入端口可随连接数量动态增加，且旧连接不漂移。
- 非法连线能自动断开。
- AI Planner mock graph 能自动布局到当前 viewport。
- Merge Capture 能输出纯净图片。
- 50-100 个节点下拖拽、缩放无明显卡顿。

---

## 3. 目录结构和分层逻辑

### 3.1 推荐目录结构

```text
TanvasAgent/
├── AGENTS.md
├── PRD.md
├── ARCH.md
├── HARNESS.md
├── project_state.md
├── dev-plans/
│   ├── Asset-lod-roadmap.md
│   ├── p0-development-harness-roadmap-2026-04-30.md
│   └── Archive/
├── reference/
│   ├── theme.ts
│   └── design-system.md
├── apps/
│   └── web/
│       ├── package.json
│       ├── next.config.mjs
│       ├── public/
│       │   └── spikes/
│       └── src/
│           ├── app/
│           │   ├── api/
│           │   │   ├── _lib/
│           │   │   ├── assets/
│           │   │   │   ├── _lib/
│           │   │   │   ├── [assetId]/
│           │   │   │   ├── files/[assetId]/[fileName]/
│           │   │   │   ├── from-data-url/
│           │   │   │   └── upload/
│           │   │   └── boards/
│           │   │       ├── _lib/
│           │   │       ├── local-load/
│           │   │       ├── local-save/
│           │   │       └── validate-document/
│           │   ├── spikes/canvas/
│           │   └── styles/
│           ├── components/
│           │   ├── ui/
│           │   ├── canvas/
│           │   ├── inspector/
│           │   ├── nodes/
│           │   └── editor/
│           ├── features/
│           │   ├── auth/
│           │   ├── ai-runs/
│           │   ├── assets/
│           │   ├── boards/
│           │   ├── canvas/
│           │   ├── canvas-performance/
│           │   ├── canvas-settings/
│           │   └── node-runtime/
│           ├── hooks/
│           ├── lib/
│           ├── services/
│           ├── store/
│           └── types/
├── services/
│   └── api/
│       ├── pyproject.toml
│       ├── README.md
│       └── tangent_api/
│           ├── main.py
│           ├── request_context.py
│           ├── schemas.py
│           ├── board_guard.py
│           └── routers/
├── packages/
│   └── shared/
│       └── README.md
├── docs/
│   └── archive/
└── legacy/
    └── old-tangent-desktop-2026-04-29/
```

### 3.2 分层原则

| 层 | 只负责什么 | 禁止什么 |
|----|------------|----------|
| `app/api/_lib` | Next 本地 API 的 request context、通用 route helper | 写前端 UI 或吞掉鉴权错误 |
| `app/api/assets` | 当前本地 Asset API bridge、storage adapter、local-dev 文件读写 | 绕过 request context 直接服务跨 workspace 文件；把 `data:` 当持久 URL 返回 |
| `app/api/boards` | 当前 Board save guard、local save/load 开发路由、board storage adapter | 替代正式 Dashboard / DB persistence / 权限模型 |
| `app/spikes` | 技术验证入口，例如 `/spikes/canvas` | 成为产品 Dashboard 的长期入口 |
| `app/styles` | 当前 spike 全局样式入口 | 继续膨胀成所有 feature 的垃圾桶；触碰 250 行以上文件先拆 |
| `components/ui` | 通用按钮、输入框、弹窗 | 写业务请求 |
| `components/canvas` | 画布渲染、工具栏、坐标交互 | 调 Provider API |
| `components/chat` | 右侧 AI Chat 面板和 composer UI | 自主执行 Provider 调用 |
| `components/inspector` | 选中节点的详细参数面板 | 保存 Provider Key 或直接扣费 |
| `components/model-selector` | 复用模型下拉、能力标签、禁用态 | 写死 Provider Key 或价格逻辑 |
| `components/nodes` | 节点卡片 UI | 直接访问数据库 |
| `features/*` | 业务流程和 hook | 写通用 UI 样式系统 |
| `features/assets` | 前端 Asset 合同、上传 client、thumbnail client、asset preview resolver、runtime asset migration | 存 Provider 原始响应或绕过 server-backed URL |
| `features/boards` | Board persistence types、document guard / serializer / restore / local client | 保存图片二进制、`blob:`、`data:` 或 base64 payload |
| `features/canvas-performance` | 本地 LOD / density / interaction performance state | 写入 Board document 或 CRDT |
| `features/canvas-settings` | 本地画布偏好，例如 grid / snap / zoom sensitivity | 存用户隐私或服务端业务规则 |
| `features/node-runtime` | 节点注册表、端口规则、参数校验、迁移 | 直接渲染大块 UI 或调用第三方 Provider |
| `services` | HTTP 请求封装 | 存 React 状态 |
| `store` | 前端状态 | 直接写复杂业务规则 |
| `services/api` | fresh FastAPI 服务边界、request context、Board guard、P0 route scaffold；未来承接 Auth / Workspace / R2 / AI Run | 读取 legacy backend 或复制旧桌面服务代码；假装已有生产 DB/R2/AI provider |
| `packages/shared` | 前后端共享类型 / schema 的预留位置 | 放 UI 组件或平台密钥 |
| `legacy/old-tangent-desktop-2026-04-29` | 旧项目归档，仅用户明确要求时参考 | 默认读取、构建、修改或从中恢复业务逻辑 |

### 3.3 文件大小

- 单个源码文件目标不超过 300 行，包括 `.ts`、`.tsx`、`.css`、`.py`、测试和工具脚本。
- 250 行开始预警：如果继续加功能会超过 300 行，必须先拆分再继续加。
- 超过 300 行不能继续承接新功能，除非本轮任务就是拆分它，或先在 dev-plan 中记录临时例外和拆分计划。
- 禁止出现 1000 行级别源码文件；如果 spike 阶段临时产生，必须在进入下一 Sprint 前拆掉。
- 拆分优先级：
  - UI 拆 component。
  - 业务流程拆 hook。
  - 纯函数拆 `lib`。
  - 类型拆 `types`。
  - 样式按 feature / component 拆 CSS module 或局部样式文件，避免全局 CSS 成为垃圾桶。
- 文档文件可以因为 PRD / ARCH / 长计划天然超过 300 行，但必须保持目录清晰；超过 500 行时优先把执行清单、历史记录、附录、手测记录拆到 `dev-plans/`、`debug-plans/` 或 `docs/`。
- 每一轮代码更新都要遵守“最小代码原则”：新增代码先放在职责最窄的位置，不让一个文件同时承接 UI、状态、数据转换、API 调用和样式。

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

- Prompt / Image Gen / Image Gen 4 / Analysis / Image 节点类型。
- 节点注册表：`type`、`version`、`displayName`、`ports`、`paramsSchema`、`defaultData`、`renderComponent`、`validate`、`migrate`。
- 节点端口定义：输入/输出方向、数据类型、是否必填、是否允许多连。
- text 端口和连线使用黄色；image 端口和连线使用绿色。
- Image Gen / Image Gen 4 的 image 输入端口是动态端口：每个已连接 image 后保留一个新的空 image 输入端口，P0 最大 6 个。
- 节点连接规则。
- 连接基数：output 端口允许 fan-out 到多个下游 input；input 端口默认只接一个上游，动态 image input 通过增加新端口承载多图。
- 节点数据连线：runtime edge store 保存 `sourceNode/sourcePort/targetNode/targetPort/dataType`，由 SVG overlay 渲染曲线。
- 非法连线即时断开和提示。
- 鼠标靠近 node-node 连线时，中点显示 `−` 断开按钮。
- 节点执行状态。
- 节点自动布局。
- 节点版本迁移，避免后续节点参数变更导致旧 Board 损坏。
- 把服务端权威状态映射为前端可见摘要，例如 run status、asset ids、cost hint。
- 维护节点轻量数据边界：节点和 `shape.props` 只保存 id、短参数、布局、端口、状态摘要和 Asset 引用。
- 将反推 prompt、AI 原始响应、大图、长日志等重型数据交给后端、对象存储或 query/store 层按需加载。

不负责：

- 复杂工作流引擎。
- Research / Outline / Html Formatter。
- Provider Key。
- 扣费、余额和 API 日志最终写入。
- 保存 Base64 图片、完整 Provider 响应、长对话历史或大段二进制数据。

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
- 当前 Slice E-A/E-B 在 `apps/web/src/app/api/assets/` 提供本地开发 Asset API bridge，文件写入 `.tangent-assets/`，用于验证前端 Asset 合同；当前 route 已经过 request context 和 storage adapter seam，metadata 带 `workspaceId` / `createdBy`，正式实现仍需迁移到带真实 Auth / Workspace 校验的 FastAPI + R2/S3 adapter。

不负责：

- P0 素材库标签。
- Personal Assets 页面。

### 4.8 AI Planner 模块

职责：

- 接收自然语言。
- 生成最小 graph spec。
- 接收当前 composer 选择的 `selected_model_id`，并写入生成节点草稿。
- 前端校验后应用到画布。

不负责：

- 自主执行复杂 Agent。
- 多轮长对话记忆。

### 4.9 AI Chat 模块

职责：

- 渲染 Canvas 右侧可收起侧边栏。
- 管理当前 Board 的短会话消息。
- 提供最小 composer：文本输入、模式选择、图片模型选择、图片上传入口。
- 调用 AI Planner 并把合法 graph spec 交给 Node Runtime 应用。
- 展开/收起时通知画布容器 resize，不能导致对象、选择框、连线漂移。
- Chat 内输入框、滚轮、下拉阻止事件穿透到画布。

不负责：

- 长期聊天历史管理。
- PDF / 视频 / 音频 / 3D 文件对话。
- 不经用户确认的复杂自治执行。

### 4.9.1 Inspector 模块

职责：

- 渲染左侧节点参数面板。
- 根据 Node Registry 和 Model Registry 生成参数表单。
- 编辑 Image Gen / Image Gen 4 的模型、尺寸、质量、比例等参数。
- 显示能力标签、成本提示、耗时提示、错误详情。
- 将可协同的参数变更写回 Board document。

不负责：

- 直接调用 Provider。
- 自行扣费。
- 保存本地 UI 展开状态到协同文档。
- 替代完整 Admin 模型市场。

### 4.10 Model Registry 模块

职责：

- 服务端维护 P0 可用图片模型清单、Provider、能力标签、参数 schema、启用状态。
- 前端通过 API 获取模型列表，用于 Image Gen / Image Gen 4 Node 和 AI Chat composer。
- 按模型过滤参数，例如 `quality`、`size`、`image_size`、`aspect_ratio`。
- 后端在 AI Run 时再次校验模型是否启用、参数是否合法。

不负责：

- P0 完整模型市场。
- 前端硬编码真实 Provider 线路。
- 让普通用户配置 Provider Key。

---

## 5. 数据模型设计

### 5.1 关系概览

```text
User 1 ── * WorkspaceMembership * ── 1 Workspace
Workspace 1 ── * Board
Board 1 ── * Asset
Board 1 ── * AiRun
Board 1 ── * AiChatSession
Board 1 ── 1 document_state(JSON)
AiRun * ── * Asset(output)
ModelOption 1 ── * AiRun
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

未来 `services/api` 的 `api_call_logs` 字段按以上结构新建；不要从 legacy backend 直接复制实现。

### 5.6 AiChatSession / AiChatMessage

- `id`
- `board_id`
- `user_id`
- `messages`
- `selected_model_id`
- `mode`
- `created_at`
- `updated_at`

P0 可只保留当前 Board 的短历史；不做长期多会话检索。

### 5.7 ModelOption

- `id`
- `provider`
- `display_name`
- `capabilities`
- `parameter_schema`
- `is_enabled`
- `is_default`
- `estimated_latency`
- `cost_hint`

P0 推荐至少包含：

- `gpt-image-2`
- `gemini-3.1-flash-image-preview`

真实可用性以服务端返回为准，前端 disabled 不等于后端可跳过校验。

### 5.8 Document State

前端保存的 Board 文档结构建议：

```json
{
  "version": 1,
  "viewport": { "x": 0, "y": 0, "zoom": 1 },
  "nodes": [
    {
      "id": "gen-1",
      "type": "image_gen_4",
      "version": 1,
      "position": { "x": 360, "y": 120 },
      "size": { "width": 360, "height": 280 },
      "ports": [
        { "id": "text_in", "direction": "in", "dataType": "text" },
        { "id": "image_in_1", "direction": "in", "dataType": "image" },
        { "id": "image_out_1", "direction": "out", "dataType": "image" },
        { "id": "image_out_2", "direction": "out", "dataType": "image" },
        { "id": "image_out_3", "direction": "out", "dataType": "image" },
        { "id": "image_out_4", "direction": "out", "dataType": "image" }
      ],
      "data": {
        "selected_model_id": "gpt-image-2",
        "count": 4,
        "image_input_count": 1,
        "aspect_ratio": "auto",
        "resolution": "1K",
        "quality": "low"
      },
      "runtime_summary": {
        "status": "idle",
        "last_run_id": null,
        "result_asset_ids": []
      }
    }
  ],
  "edges": [
    {
      "id": "edge-1",
      "source_node_id": "prompt-1",
      "source_handle": "text_out",
      "target_node_id": "gen-1",
      "target_handle": "text_in",
      "type": "text"
    }
  ],
  "canvasObjects": [],
  "chat": { "activeSessionId": null },
  "inspector": { "selectedNodeId": null },
  "updatedAt": "2026-04-29T00:00:00Z"
}
```

P0 不把 `blob:` / `data:` 存入此 JSON。所有图片引用必须是 `asset_id` 或远程 URL。

Document State 只保存可协同、可恢复、可渲染的 Board 数据。扣费、余额、Provider 原始响应、API Key、完整日志不进入此 JSON。

### 5.9 节点轻量数据原则

节点是画布上的显示器和控制器，不是数据库。无论节点 UI 看起来多复杂，`shape.props`、Node Runtime document 和未来协同文档都必须保持轻量。

允许进入节点 / 协同文档的数据：

- `node_id`、`asset_id`、`run_id`、`model_id` 等短 id。
- 节点位置、尺寸、端口、连线、版本号。
- 可协同的短参数，例如 `count`、`quality`、`aspect_ratio`。
- 运行摘要，例如 `idle/running/failed/succeeded`、`last_run_id`、`result_asset_ids`。
- 用于渲染的安全缩略图引用或服务端授权后的短 URL。

禁止进入节点 / 协同文档的数据：

- Base64 图片、`blob:`、`data:`、视频、压缩包或任意二进制大对象。
- Provider API Key、签名密钥、真实扣费余额。
- Provider 原始响应、完整 API 调用日志、长错误堆栈。
- 反推 prompt 的长文本结果、长聊天历史、批量图片元数据。

重型数据流转规则：

1. 图片上传、AI 生成、Editor 导出、Merge Capture 输出都必须先进入 Asset 层。
2. 节点只保存 `asset_id`；展示时由前端通过后端解析为可访问 URL，隐私场景优先使用授权 URL 或不可猜测对象路径。
3. 反推 prompt、图片分析、长日志等结果存入后端表或缓存；节点只保存 `run_id` / `result_id` 并在 UI 中按需读取。
4. 未来多人协作时，WebSocket / CRDT 只同步轻量 diff，绝不广播大图或 Provider 原始响应。
5. Step 1.5 压力测试必须包含“节点 props 瘦身检查”，确认 50-100 节点时 document payload 仍可控。

---

## 6. 服务端 vs 客户端边界

### 6.1 客户端可以做

- 渲染页面和画布。
- 处理 pan/zoom/drag/selection。
- 本地编辑 Prompt Node。
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
| 模型列表 | query cache + model registry store |
| 当前选择图片模型 | node data / AI Chat composer state |
| Inspector 当前 tab、展开状态 | local component state |

### 7.1.1 协同状态边界

多人协作进入 P0.5 时，状态必须分四类处理：

| 类别 | 示例 | 存储/同步方式 |
|------|------|---------------|
| 协同文档状态 | 节点位置、尺寸、类型、参数、端口、连线、图片对象、笔迹 | tldraw/sync 或协作文档层 + 持久化快照 |
| Presence 状态 | 光标、当前选区、谁正在编辑某节点 | presence 通道；不写 PostgreSQL document_state |
| 服务端权威状态 | AI run 状态、扣费、余额、API 日志、Provider 响应 | 后端数据库；前端只订阅/刷新摘要 |
| 本地 UI 状态 | dropdown open、hover、modal、Inspector tab、输入法草稿 | React local state / Zustand local slice |

原则：协同文档可以同步“用户看得到且应该共享”的节点参数和结果引用；不能同步 API Key、扣费结果、真实余额或 Provider 原始密钥相关信息。

协同冲突处理原则：

- Presence 用于多人光标、选区、正在编辑哪个节点、软锁提示，不能落 PostgreSQL，也不能作为权限依据。
- 软锁只解决 UI 防碰撞，例如用户 A 正在编辑某个节点参数时，用户 B 看到占用提示或控件禁用；它不是安全锁，后端仍必须校验权限和状态。
- CRDT / Yjs / tldraw sync 可以保证文档最终一致，但不等于所有业务冲突都自动正确；模型参数、运行状态、结果写入仍需要 Node Runtime 和后端定义合并/覆盖规则。
- AI Run、扣费、Asset 写入必须以服务端为权威；协同文档只接收服务端返回的摘要和引用。
- 协作文档快照使用 debounce / 定时保存，避免每个鼠标移动都写 PostgreSQL。

### 7.2 保存策略

P0：

- 用户操作后 debounce 保存 Board document。
- 关键操作（生成结果、导出、合并）立即保存。
- 保存失败时显示状态，不丢本地当前操作。
- 可用 IndexedDB / local persistence 保存短期草稿，但服务端快照仍是最终恢复依据。

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
POST /api/v1/boards/validate-document
POST /api/v1/boards/local-save
GET /api/v1/boards/local-load?boardId=...
```

约束：

- 所有接口必须校验 Board 属于当前用户或当前 workspace。
- `PATCH` 只允许更新 title、thumbnail、document_state 等白名单字段。
- 写入 `document_state` 前必须通过 Board document guard，拒绝 `data:` / `blob:` 和大段 base64-like payload。
- 当前本地开发 bridge 在 `apps/web/src/app/api/boards/validate-document/route.ts` 提供相同 guard contract；正式 FastAPI 保存接口必须复用同等规则。
- `validate-document`、`local-save` 和 `local-load` 都会解析 `apiRequestContext`；本地默认 dev context，`TANGENT_REQUIRE_API_AUTH=1` 时必须显式提供 context。
- 当前 canvas spike 使用 `serializeBoardDocument()` 生成保存候选 document，只包含 shapes、assets、camera、viewport、runtime edges 等轻量恢复信息，不保存完整 tldraw store snapshot。
- 当前 `Save audit` dev control 会先迁移可处理的 runtime image assets 到本地 Asset API，再执行 guard；不能迁移的 `data:` / `blob:` 仍会阻塞保存候选。
- 当前 `Save local` dev control 会在 guard 通过后写入 `.tangent-boards/boards/canvas-spike-local.json`，并通过 `apiRequestContext` 给本地记录写入 `workspaceId` / `ownerId`；这是本地开发保存支架，不替代正式数据库、Auth 或 workspace 权限。
- 当前 `Load local` dev control 会从 `.tangent-boards/` 读取同一 document，按 `workspaceId` 校验本地记录后重建 tldraw assets / shapes、runtime edges 和 camera；这是 restore 验证支架，不替代正式 Board load。
- `apps/web/src/app/api/boards/_lib/boardStorageAdapter.ts` 是 Board persistence seam；当前只支持 `TANGENT_BOARD_STORAGE_DRIVER=local-dev`，不支持的 driver 必须明确失败。正式 Dashboard / Board CRUD 仍需迁移到带真实 Auth / Workspace 校验的数据库路径。
- `apps/web/src/features/boards/boardTypes.ts` 是当前 Board persistence response contract。`local-save` 只返回 board summary，不回传完整 document；`local-load` 才返回 document，避免保存响应随着画布变大而膨胀。

### 8.3 Assets

```http
POST /api/v1/assets/upload
POST /api/v1/assets/from-data-url
GET /api/v1/assets/{asset_id}
DELETE /api/v1/assets/{asset_id}
```

P0 可先用 `from-data-url` 处理 editor export / merge capture，但服务端必须落成真实 Asset URL 后返回，不能让 `data:` 进入持久化 document。

当前本地开发 bridge：

- `apps/web/src/app/api/assets/from-data-url/route.ts` 接收原图 data URL 和客户端生成的 thumbnails。
- `apps/web/src/app/api/assets/upload/route.ts` 保留 multipart upload 合同。
- `apps/web/src/app/api/assets/[assetId]/route.ts` 返回 metadata。
- `apps/web/src/app/api/assets/files/[assetId]/[fileName]/route.ts` 只服务 Git 忽略目录里的本地开发文件。
- `apps/web/src/app/api/_lib/apiRequestContext.ts` 解析 `x-tangent-user-id` / `x-tangent-workspace-id`，本地开发默认回退到 `dev-user` / `dev-workspace`。
- `apps/web/src/app/api/assets/_lib/assetStorageAdapter.ts` 是可替换 storage seam；当前只支持 `TANGENT_ASSET_STORAGE_DRIVER=local-dev`，不支持的 driver 必须明确失败。
- 该 bridge 不替代正式鉴权、workspace 权限和对象存储；`TANGENT_REQUIRE_API_AUTH=1` 只用于本地检查缺失 context，不等于生产认证。

当前 FastAPI scaffold：

- `services/api/tangent_api/main.py` 提供 `/health` 和 P0 router wiring。
- `services/api/tangent_api/request_context.py` 复刻 Next bridge 的 `x-tangent-user-id` / `x-tangent-workspace-id` context 规则。
- `services/api/tangent_api/board_guard.py` 复刻 Board document guard 的 runtime URL / large base64 / JSON serializable 检查。
- `services/api/tangent_api/routers/boards.py` 当前实现 `POST /api/v1/boards/validate-document`、本地文件版 `POST /api/v1/boards` 和 `GET /api/v1/boards/{board_id}`；这仍是 local-dev persistence，不替代正式 DB。
- `services/api/tangent_api/routers/assets.py` 当前提供 Asset route skeleton，storage adapter 先明确 501。

### 8.4 Model Registry

```http
GET /api/v1/ai/models?capability=image_generation
```

模型列表响应示例：

```json
{
  "models": [
    {
      "id": "gpt-image-2",
      "provider": "geekai",
      "display_name": "GPT Image 2",
      "capabilities": ["image_generation", "image_edit"],
      "parameter_schema": {
        "quality": ["low", "medium", "high"],
        "size": ["1024x1024", "1024x1536", "1536x1024"]
      },
      "is_enabled": true,
      "is_default": true,
      "cost_hint": "Low quality is cheapest for tests"
    },
    {
      "id": "gemini-3.1-flash-image-preview",
      "provider": "geekai",
      "display_name": "Gemini 3.1 Flash Image Preview",
      "capabilities": ["image_generation", "image_edit", "image_reference"],
      "parameter_schema": {
        "image_size": ["0.5K", "1K", "2K", "4K"],
        "aspect_ratio": ["1:1", "4:3", "16:9", "5:4"]
      },
      "is_enabled": true,
      "is_default": false,
      "cost_hint": "Use 0.5K for tests"
    }
  ]
}
```

### 8.5 AI Runs

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
  "selected_model_id": "gpt-image-2",
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

### 8.6 AI Planner

```http
POST /api/v1/ai/planner
```

请求：

```json
{
  "board_id": "uuid",
  "message": "Create a workflow to generate 4 cat poster ideas and edit the best one.",
  "mode": "auto",
  "selected_model_id": "gemini-3.1-flash-image-preview"
}
```

响应：

```json
{
  "nodes": [
    { "id": "prompt-1", "type": "prompt", "prompt": "A cat poster..." },
    {
      "id": "gen-1",
      "type": "image_gen_4",
      "count": 4,
      "selected_model_id": "gemini-3.1-flash-image-preview"
    },
    { "id": "image-1", "type": "image", "deferred_from": "gen-1" },
    { "id": "analysis-1", "type": "analysis", "analysis_prompt": "分析这个图片，反推提示词" }
  ],
  "edges": [
    { "from": "prompt-1", "to": "gen-1", "type": "text" },
    { "from": "image-1", "to": "analysis-1", "type": "image", "deferred": true }
  ],
  "layout": "horizontal"
}
```

前端必须校验：

- type 是否属于 P0 允许列表。
- edge 是否符合连接规则。
- 节点数量是否合理。
- `selected_model_id` 是否在服务端返回的可用模型列表内。
- layout 是否可应用在当前 viewport。

### 8.7 Merge Capture

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

节点复杂度处理原则：

- tldraw 负责画布、坐标、选择、拖拽、基础形状和协同底座。
- Node Runtime 负责节点类型、端口、参数、连接规则、运行摘要和迁移。
- 白板普通箭头继续使用 tldraw arrow；节点数据端口线不使用 tldraw arrow，避免暴露中点/锚点编辑导致数据连接断裂。
- 节点数据端口线使用 Node Runtime edge store + React/SVG overlay，视觉接近 React Flow / ComfyUI，路径随节点和端口位置实时计算。
- 复杂参数不全部塞进节点卡片，优先进入左侧 Inspector。
- 节点卡片内部的输入框、下拉、按钮、滚轮必须阻止事件穿透，避免误触 pan/zoom/drag。
- React 节点按组合模式拆成 `NodeContainer`、`NodeHeader`、`NodeBody`、`NodeFooter` 和可插拔功能组件，避免单个超级节点文件膨胀。
- 画布库的视窗剔除只能降低不可见节点成本，不能替代图片压缩、懒加载、缩略图、生产构建压力测试和 document payload 控制。
- 画布设置使用轻量 Zustand store 管理本地偏好；Snap Alignment 优先使用 tldraw 原生 `isSnapMode` 和 `snapThreshold`，Grid Unit 写入 document settings，Zoom Sensitivity 写入 camera options。

### 9.2 画布精度验收

| 场景 | 必须通过 |
|------|----------|
| 50% / 100% / 200% 缩放 | 点击、拖动、框选、连线端口不偏移 |
| 浏览器 resize | 对象位置不漂移 |
| Retina / 高 DPI | 画笔位置准确 |
| 图片发送到画布 | 图片出现在当前 viewport 附近 |
| 外部图片粘贴 | 连续粘贴 5-10 张大图时有明确限制/提示，不导致页面长时间卡死 |
| 工具栏行为 | 顶部图标工具栏保留完整基础白板入口；形状和插入类按类别收纳；箭头和直线使用独立图标，箭头入口只画箭头；左键单次绘制后回 Select，右键连续绘制，Esc 退出且不暴露需要手动解锁的状态 |
| 导航地图 | 左下角导航地图显示内容缩略、当前 viewport、缩放百分比、加号/减号缩放；点击地图位置可 center 到对应画布区域 |
| 画布设置 | Settings 面板可开关网格、调整网格样式/单位/颜色、开启对齐吸附、设置吸附距离、调整缩放灵敏度，并可保存刷新后恢复 |
| 箭头吸附 | 矩形、圆形、Frame、图片、卡片吸附到边中点；三角形、菱形吸附到角点；箭头工具靠近对象时对象轮廓和候选捕捉点预高亮；source / target 捕捉点可见高亮；靠近形状边缘或端口时能灵敏吸附，不默认只吸附形状中心 |
| 属性面板 | 左侧属性面板只在有选中对象且没有拖动画布时出现，跟随最后选中/最后创建图形，可用清晰图标控件编辑样式、线条风格、箭头类型、端点、透明度、对齐、图层和操作 |
| 复杂节点内部交互 | 下拉、输入、按钮、滚轮不触发画布操作 |
| AI Chat / Inspector resize | 右侧 AI Chat 或左侧 Inspector 展开收起后对象、选框、连线不漂移 |
| 自动布局 | mock graph 插入当前 viewport 且节点不重叠 |
| Merge Capture | 输出只包含选中对象内容 |

### 9.2.1 Step 1.5 技术裁决验收

Step 1.5 通过前，不进入正式五节点链路开发。

| 验收项 | 通过标准 |
|--------|----------|
| 复杂节点 | Prompt / Image Gen / Image Gen 4 / Analysis / Image 原型可交互；Image Gen 4 包含模型下拉、参数、Run、4 图结果态 |
| 防事件穿透 | 节点内交互不误触画布 pan/zoom/drag |
| 端口连线 | 可视端口能承载 Prompt → Image Gen、Image → Image Gen、Image → Analysis、Analysis → Prompt |
| 类型颜色 | text 端口/连线为黄色；image 端口/连线为绿色 |
| 动态端口 | Image Gen / Image Gen 4 每连入一个 image 后自动增加一个空 image 输入端口，旧连接不漂移 |
| 连接校验 | 非法连线自动断开并提示 |
| 断连交互 | 鼠标靠近 node-node 连线时中点出现 `−`，点击可断开 |
| 自动布局 | 3-4 个 mock 节点插入当前视野且不重叠 |
| Merge Capture | 图片 + 笔迹 + 形状可导出纯净结果 |
| 轻量数据 | 复杂节点 `shape.props` 不含 Base64、大图、长日志、Provider 原始响应 |
| 压力测试 | 50-100 节点下基础拖拽和缩放可接受；同时记录 5-10 张图片粘贴后的内存/卡顿体感 |

失败处理：

1. 先尝试 tldraw custom shape + HTMLContainer + Node Runtime 修正。
2. 若端口/复杂交互仍不可接受，评估 tldraw + 独立节点层。
3. 若仍失败，切换到 React Flow + Konva / whiteboard layer 方案。

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
- 限制大小：P0 单图 30MB。
- 文件名服务端生成。
- 不信任客户端传来的扩展名。

### 10.4 AI 安全

- Provider key 不进入 logs。
- Prompt 可进入 API Log，但后续可加脱敏策略。
- 内容违规返回结构化错误。
- 生图接口做用户级限流。
- `selected_model_id` 必须来自服务端 Model Registry，不能信任前端任意传入的模型名或参数。

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
# When services/api has real tests:
pytest services/api/tests
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
- 检查触碰源码文件行数，接近或超过 300 行时先拆分；已知大文件必须在对应 dev-plan 标记拆分任务。
- 更新 `project_state.md`

### 11.4 扩展容量路线

P0 先按 Alpha 小流量实现，不能为了 100K 用户提前微服务化；但每个阶段必须知道先爆哪里、怎么处理。

| 阶段 | 规模假设 | 主要瓶颈 | 处理策略 |
|------|----------|----------|----------|
| Alpha | 20-50 CCU，数百注册用户 | AI 成本、图片粘贴卡顿、Board 保存频率 | 用户/模型限流，低成本默认参数，Asset 引用，debounced save |
| 1K 用户 | 50-150 CCU | API 并发、PostgreSQL 索引、对象存储下行 | Managed Postgres，`board_id/user_id/status` 索引，R2/CDN，AI Run 异步队列预留 |
| 10K 用户 | 300-1,000 CCU | AI worker、图片缩略图、日志表增长、成本风控 | API 与 AI worker 分离，队列/Redis，缩略图懒加载，ApiCallLog 分区或归档，预算熔断 |
| 100K 用户 | 2K+ CCU，P0.5 协作可能常态化 | Realtime 长连接、跨区延迟、日志/Asset 生命周期、客服与滥用 | 独立协作服务集群，区域化部署，对象生命周期策略，Admin 风控面板，SLO/告警/事故手册 |

扩展原则：

- 扩展 AI 执行能力前，先扩展成本控制、限流、日志和熔断。
- 扩展协作前，先验证协同文档、Presence、服务端权威状态边界。
- 扩展存储前，先确保图片只以 Asset 引用进入 document state。
- 扩展 Admin 前，先记录准确的 `AiRun` / `ApiCallLog` / `Asset` 数据。

---

## 12. 开发切片原则

每次只做可独立验收的端到端切片：

1. Canvas 坐标 spike。
2. Step 1.5 复杂节点、端口、自动布局、Merge Capture 技术裁决。
3. Prompt / Image Gen / Image Gen 4 / Analysis / Image 节点 UI。
4. Model Registry / 图片模型选择器。
5. Prompt → Image Gen / Image Gen 4 真实调用。
6. 缩略图 → Image Node。
7. Analysis → Prompt 反推提示词。
8. Send to Canvas → Markup。
9. Merge Capture → New Image Node。
10. 后置 Image Editor 绘图导出 → New Image Node。
11. 右侧 AI Chat 自动搭线。
12. Dashboard / 保存 / 登录收口。
13. P0.5 多人协作。

每个切片完成后：

- 对照 PRD 验收清单手测。
- 跑质量闸门。
- 更新 `project_state.md`。
- 再 commit。

---

## 13. 已知技术风险

| 风险 | 缓解 |
|------|------|
| tldraw 自定义节点不足 | 先做 Step 1.5；失败再评估轻节点层或 React Flow + Konva |
| 复杂节点交互穿透 | 节点内控件阻止 pointer/wheel 事件；Inspector 承载复杂参数 |
| 节点参数膨胀 | Node Registry + Inspector；节点卡片只展示摘要 |
| 端口连线不稳定 | Node Runtime 做连接校验；非法连线自动断开 |
| 自动布局重叠 | P0 手写 horizontal layout；复杂后接 Dagre/ELK |
| 协同状态混乱 | 状态分为协同文档、presence、服务端权威、本地 UI 四类 |
| CRDT 被误认为万能 | CRDT 只解决文档最终一致；AI Run、扣费、Asset、模型参数冲突仍由后端和 Node Runtime 定规则 |
| 坐标偏移复发 | 单一 world 坐标；先验收坐标再做 AI |
| Editor 变复杂 | P0 只做画笔、橡皮、导出 |
| Merge Capture 截到 UI | 离屏渲染对象，不 DOM 截屏 |
| 远程图片污染 canvas | Asset/CDN 配置 CORS；导出前确认图片可安全渲染 |
| 节点 props 存重型数据 | 节点只存 id、短参数和摘要；图片、长文本、日志、Provider 响应外置 |
| 过度相信 tldraw 视窗剔除 | Step 1.5 用生产构建验证 50-100 复杂节点和图片密集画布，而不是只看理论能力 |
| 粘贴多张外部大图导致卡顿 | 上传/粘贴入口限制 MIME、体积和长边；前端降采样，后续用缩略图懒加载 |
| AI 成本失控 | 默认低成本参数，限流 |
| 旧项目复杂度回流 | 冻结旧桌面/公众号/素材库路线 |
| API Key 泄露 | Key 只在服务端 `.env` |
| 数据权限遗漏 | 所有查询带 current user / workspace |
| 模型能力写死 | 由 Model Registry 返回能力和参数 schema |

---

## 14. 全局文档入口

本项目当前使用：

- `PRD.md`：新 Web AI 图像画布 PRD。
- `ARCH.md`：新 Web AI 图像画布架构。
- `project_state.md`：当前状态和下一步。
- `HARNESS.md`：跨功能开发索引、代码规范、验收标准和接班规则。
- `README.md`：新接手开发者快速入口。
- `dev-plans/README.md`：活跃计划与归档计划索引。
- `dev-plans/Asset-lod-roadmap.md`：当前 Slice E Real Asset Pipeline 主线。
- `dev-plans/p0-development-harness-roadmap-2026-04-30.md`：P0 后续开发 Harness 路线图。

旧路线已归档：

- `legacy/old-tangent-desktop-2026-04-29/`：旧桌面/Admin/backend/frontend 实现，默认不读不改。
- `docs/archive/pivot-docs-2026-04-29/`：旧 pivot 草案镜像，非当前 canonical 文档。

每次新对话建议提示：

```text
先读项目根目录的 project_state.md、PRD.md、ARCH.md、HARNESS.md 和 dev-plans/README.md，了解当前状态，然后我们来做「具体任务」。
```

---

## 15. 架构覆盖映射

用户提供的 12 类应用开发范例在本项目中的落点如下。P0 只实现当前阶段必要部分，其余保持文档边界，避免范围回流。

| 范例域 | 当前覆盖 | 后续补充 |
|--------|----------|----------|
| 应用想法验证 / PRD | `PRD.md` 1-2 章、用户故事、MoSCoW、验收清单 | sourced market research，竞品评分/收入必须联网查证 |
| 全栈架构蓝图 | `ARCH.md` 2-8 章，Next.js / tldraw / Node Runtime / FastAPI / PostgreSQL / Assets | 真实后端迁移和部署配置 |
| UI/UX 设计系统 | `reference/design-system.md`、`reference/theme.ts`、Canvas 设置和工具栏实现 | 右侧 AI Chat 完整设计、移动响应式 |
| 认证与用户管理 | `ARCH.md` 1.3 / 8.1 / 10.2 | OAuth、密码重置、账户删除 |
| 支付与订阅 | `ARCH.md` 1.4 | Stripe Checkout / Webhook / Credits 账本 |
| 实时功能 | `ARCH.md` 7.1.1 | P0.5 Presence、软锁、协作文档层 |
| 数据库与 API | `ARCH.md` 5 / 8 | SQL migration、API contract tests |
| 发布策略 | 成本预测和 README | Alpha 发布手册、ASO/社媒模板 |
| 测试与 QA | `PRD.md` 9、`ARCH.md` 11.3、`HARNESS.md` QA | Playwright E2E、API tests、性能基准 |
| 管理仪表板 / 分析 | P0 只保留 API logs 和成本记录 | 用户管理、模型线路管理、漏斗和收入 dashboard |
| AI 功能集成 | Model Registry / AI Runs / Planner 架构 | 真实 Provider 参数、Prompt 模板、缓存和熔断 |
| 部署 / 监控 / 恢复 | `ARCH.md` 11 | staging/prod 配置、健康检查、告警和事故手册 |
