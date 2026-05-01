# TANGENT Web AI Image Canvas — Architecture Decision Document

**版本**: v0.6
**日期**: 2026-05-01
**状态**: Web 重启方向正式架构；S1.5 与 Asset LOD Slice A-D 已通过，当前主线是 Slice E Real Asset Pipeline + P0 产品壳收口。FastAPI local-dev、真实 `s3-compatible` Asset adapter、Postgres Board / Asset metadata persistence、Web-to-FastAPI switch、staging API package、`/boards` entry shell、Product Shell route skeleton、Board save UX 第一版、Dashboard metadata first pass、Auth scaffold first pass 和 AI contract scaffold first pass 已落地；`/boards` 已支持 list/create/open/search/rename/delete、thumbnail placeholder、对象计数、列表上限和基础空/错/加载状态。下一步先做 Board save 长时回归或真实 staging wiring；真实 AI provider 等外部资源后接入。
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
- 当前 Next 本地 Asset / Board API bridge 已有 request context + storage adapter seam；metadata 带 `workspaceId` / `createdBy`，Board summary 带 `workspaceId` / `ownerId`。
- Board save guard + local/FastAPI save-restore 已能挡住 `data:` / `blob:` / base64 payload，并用于开发验证和 FastAPI contract。
- FastAPI `services/api` 已实现 `/health`、CORS allowlist、Asset upload/read、Board validate/list/save/load/rename/delete、`s3-compatible` object storage、Postgres Board persistence 和 Postgres Asset metadata adapter。
- Web `/boards` 和 `/boards/:boardId` 已是当前 Dashboard / Board entry shell；Dashboard 已支持 list/create/open/search/rename/delete、summary metadata、thumbnail placeholder、list limit 和基础状态。`/spikes/canvas` 仍保留为技术验证入口。
- 当前本地阶段不把登录/注册/工作区/设置/账户页面做成完整账户系统；App Shell + route skeleton + mock session/workspace 已按 `reference/Design.md` 落地，真实 Email/Auth/DB/domain 资源接入后再替换为正式会话。
- `deploy/staging/` 已有 API Docker / compose / env / smoke runbook；真实 server、managed Postgres、R2 bucket、staging domains 和 secrets 尚未接入。
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
| 用户账号 | PostgreSQL planned | 用户本人；平台代管 |
| Board 元数据 | PostgreSQL；local-dev 可写 `.tangent-boards/` | 用户/Workspace |
| 画布文档状态 | P0 local-dev JSON / PostgreSQL JSON；协作后进入协作文档存储 | 用户/Workspace |
| 生成图片 | local-dev `.tangent-assets/`；staging/prod 为 S3-compatible object storage | 用户/Workspace |
| 节点重型结果 | PostgreSQL / object storage / cache planned | 用户/Workspace；通过 id 引用 |
| API 调用日志 | PostgreSQL planned | 平台运营数据，含用户关联 |
| Provider API Key | 服务端环境变量或密钥管理 | 平台，不属于用户 |

用户应有权导出和删除自己的 Board 与图片。面向欧洲用户时，需要支持 GDPR 删除请求。

### 1.3 认证和权限

| 项 | 决策 |
|----|------|
| 是否登录 | 需要登录 |
| 登录方式 | 当前未接正式登录；P0 优先 Email OTP / magic link + FastAPI session/JWT，海外可加 Google OAuth |
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
| UI | 以 plain CSS / 全局样式为主，Tailwind 仅作可选工具位 | 当前实现主要靠 `apps/web/src/app/styles/*.css` 和少量组件局部样式，避免把设计系统过早绑死到单一 UI 库 |
| 后端 | FastAPI under `services/api` | 当前 `services/api` 已有 request context、Board validate/list/save/load/rename/delete、Asset upload/read、`s3-compatible` Asset adapter、Postgres Board / Asset metadata adapter、CORS allowlist、pytest 以及 Dockerfile；不要复用 legacy backend，下一步补 Auth / AI Run / Planner |
| 数据库 | PostgreSQL + object storage 组合 | 适合用户、Board、Asset、AI Log；当前 FastAPI 已可写 `tangent_boards` / `tangent_assets`，生产仍建议 managed Postgres + migration |
| 图片存储 | Local dev bridge + FastAPI `s3-compatible` adapter | 当前 Next local bridge 写 `.tangent-assets/`；FastAPI `s3-compatible` driver 可写 R2/S3-compatible object storage，Asset metadata 可选 Postgres；Web flow 可通过 `NEXT_PUBLIC_API_BASE_URL` 指向 FastAPI contract |
| AI Provider | GeekAI / model providers through future backend proxy | Key 不暴露前端；真实 AI Run 在 Model Registry + Asset Pipeline 稳定后接入 |
| 测试 | `pytest` + `eslint` + `tsc` + `next build` + runtime smoke | 前端当前以 lint/typecheck/build 为主，后端以 pytest 和最小 API/容器 smoke 为主；Playwright 仍是后续 E2E 预留 |

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
├── ARCH.md
├── PRD.md
├── HARNESS.md
├── project_state.md
├── dev-plans/
│   ├── Asset-lod-roadmap.md
│   ├── README.md
│   ├── p0-development-harness-roadmap-2026-04-30.md
│   ├── overseas-cost-growth-forecast.md
│   └── Archive/
├── reference/
│   ├── Design.md
│   ├── theme.ts                  # legacy reference, do not use for Product Shell
│   └── design-system.md           # legacy reference, do not use for Product Shell
├── deploy/
│   └── staging/
│       ├── README.md
│       ├── api.env.example
│       └── docker-compose.api.yml
├── docs/
│   └── archive/
├── apps/
│   └── web/
│       ├── next-env.d.ts
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
│           │   │       ├── local-delete/
│           │   │       ├── local-list/
│           │   │       ├── local-load/
│           │   │       ├── local-rename/
│           │   │       ├── local-save/
│           │   │       └── validate-document/
│           │   ├── boards/
│           │   │   ├── [boardId]/
│           │   │   └── page.tsx
│           │   ├── account/
│           │   ├── dashboard/
│           │   ├── forgot-password/
│           │   ├── login/
│           │   ├── settings/
│           │   ├── signup/
│           │   ├── verify-email/
│           │   ├── workspaces/
│           │   ├── spikes/canvas/
│           │   └── styles/
│           ├── components/
│           │   ├── app-shell/
│           │   ├── auth/
│           │   ├── boards/
│           │   ├── canvas/
│           │   ├── inspector/
│           │   ├── nodes/
│           │   └── ui/
│           ├── features/
│           │   ├── auth/
│           │   ├── ai-runs/
│           │   ├── api/
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
│       ├── .dockerignore
│       ├── Dockerfile
│       ├── pyproject.toml
│       ├── README.md
│       ├── tangent_api/
│       │   ├── main.py
│       │   ├── request_context.py
│       │   ├── schemas.py
│       │   ├── board_guard.py
│       │   ├── routers/
│       │   └── storage/
│       └── tests/
├── packages/
│   └── shared/
│       └── README.md
└── legacy/
    └── old-tangent-desktop-2026-04-29/
```

### 3.2 分层原则

| 层 | 只负责什么 | 禁止什么 |
|----|------------|----------|
| `app/api/_lib` | Next 本地 API 的 request context、通用 route helper | 写前端 UI 或吞掉鉴权错误 |
| `app/api/assets` | 当前本地 Asset API bridge、storage adapter、local-dev 文件读写 | 绕过 request context 直接服务跨 workspace 文件；把 `data:` 当持久 URL 返回 |
| `app/api/boards` | 当前 Board save guard、local save/load/list 开发路由、board storage adapter | 绕过 request context 或把完整 document 放进 list response |
| `app/boards` | 当前 `/boards` Dashboard shell 和 `/boards/:boardId` 画布入口 | 替代 Auth、完整 Board CRUD 或权限模型 |
| `app/login` / `app/signup` / `app/forgot-password` / `app/verify-email` | P0 Auth route shell，先做表单 UI、mock 状态和未来 session boundary | 直接发送真实邮件、保存密码、把 provider key 放前端 |
| `app/workspaces` / `app/settings` / `app/account` | P0 产品壳页面，先承载个人 workspace、用户偏好和账户状态占位 | 提前实现团队权限、计费、完整 profile 系统或 Admin |
| `app/spikes` | 技术验证入口，例如 `/spikes/canvas` | 成为产品 Dashboard 的长期入口 |
| `app/styles` | 当前 spike 全局样式入口 | 继续膨胀成所有 feature 的垃圾桶；触碰 250 行以上文件先拆 |
| `components/app-shell` | 全局导航、页面框架、当前用户/workspace mock 展示 | 直接实现业务鉴权或保存 Board document |
| `components/auth` | 登录/注册/验证表单和 Auth shell UI | 直接调用邮件服务或处理真实 token 签名 |
| `components/boards` | Dashboard / Board list entry UI | 直接访问数据库或保存 Board document |
| `components/ui` | 通用按钮、输入框、弹窗 | 写业务请求 |
| `components/canvas` | 画布渲染、工具栏、坐标交互 | 调 Provider API |
| `components/chat` | 右侧 AI Chat 面板和 composer UI | 自主执行 Provider 调用 |
| `components/inspector` | 选中节点的详细参数面板 | 保存 Provider Key 或直接扣费 |
| `components/model-selector` | 复用模型下拉、能力标签、禁用态 | 写死 Provider Key 或价格逻辑 |
| `components/nodes` | 节点卡片 UI | 直接访问数据库 |
| `features/*` | 业务流程和 hook | 写通用 UI 样式系统 |
| `features/api` | Web persistence/base URL client switch | 把 API base 写死在组件里 |
| `features/assets` | 前端 Asset 合同、上传 client、thumbnail client、asset preview resolver、runtime asset migration | 存 Provider 原始响应或绕过 server-backed URL |
| `features/boards` | Board persistence types、document guard / serializer / restore / local client | 保存图片二进制、`blob:`、`data:` 或 base64 payload |
| `features/canvas-performance` | 本地 LOD / density / interaction performance state | 写入 Board document 或 CRDT |
| `features/canvas-settings` | 本地画布偏好，例如 grid / snap / zoom sensitivity | 存用户隐私或服务端业务规则 |
| `features/node-runtime` | 节点注册表、端口规则、参数校验、迁移 | 直接渲染大块 UI 或调用第三方 Provider |
| `services` | HTTP 请求封装 | 存 React 状态 |
| `store` | 前端状态 | 直接写复杂业务规则 |
| `services/api` | FastAPI 服务边界、request context、Board/Asset guard、storage adapters、routes、tests、Dockerfile；未来承接 Auth / Workspace / AI Run | 读取 legacy backend 或复制旧桌面服务代码；假装已有生产 DB/R2/AI provider |
| `packages/shared` | 前后端共享类型 / schema 的预留位置 | 放 UI 组件或平台密钥 |
| `deploy/staging` | staging API 部署包、compose、env 模板、smoke runbook | 提供生产密钥或直接替代正式 deploy 流程 |
| `docs/archive` | 归档型历史文档和 pivot 记录 | 作为活跃计划入口 |
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

当前源码快照中已进入 250 行预警区的文件：

| File | Current Lines | Next Split Direction |
|------|--------------:|----------------------|
| `apps/web/src/components/canvas/CanvasSpikeStylePanel.tsx` | 298 | 拆 style section / control group |
| `apps/web/src/app/styles/node-card-content.css` | 298 | 拆 prompt / image / port 样式 |
| `apps/web/src/components/canvas/CanvasSpikeToolbar.tsx` | 294 | 拆 toolbar category / popover |
| `apps/web/src/app/styles/canvas-overlays.css` | 292 | 拆 connection / selection / minimap overlay CSS |
| `apps/web/src/components/canvas/CanvasBoardSaveAudit.tsx` | 275 | 如继续加保存行为，拆 autosave hook / save actions |
| `apps/web/src/components/boards/BoardDashboard.tsx` | 284 | 拆 row / empty / loading helpers |
| `apps/web/src/components/canvas/useEditorRevision.ts` | 289 | 拆 editor revision helper / subscription helper |
| `apps/web/src/features/assets/assetPreviewResolver.ts` | 266 | 拆 persisted thumbnail / local cache helper |
| `apps/web/src/app/styles/boards.css` | 250 | 拆 dashboard table / action form 样式 |
| `apps/web/src/components/canvas/CanvasSelectionToolbar.tsx` | 252 | 拆 selection actions / merge controls |

活跃 watchlist 仍以 `HARNESS.md` 为日常执行入口；这里保留的是本次 ARCH 全章核对时的架构级快照。

---

## 4. 核心模块划分

### 4.1 Auth 模块

当前状态：尚未实现正式登录；现阶段已有 `apiRequestContext` / FastAPI request context 的 dev fallback 和显式 `x-tangent-user-id` / `x-tangent-workspace-id` 开发头。S0D first pass 已新增 typed session/user/workspace contract、Next `GET /api/auth/session`、FastAPI `GET /api/v1/auth/session`、persistence client 的 mock session headers，以及默认关闭的 `TANGENT_REQUIRE_WEB_AUTH=1` Proxy route guard 形状。`/login`、`/signup`、`/forgot-password`、`/verify-email` 的产品壳、表单校验、mock session/workspace 和 App Shell 已落地，但不接真实邮件、OAuth、密码存储或团队权限。生产前必须替换为真实 session/JWT，不能信任前端自报 user/workspace header。

职责：

- 登录 / 登出。
- 获取当前用户。
- 前端路由保护。
- 后端 token 校验。

不负责：

- Board 权限业务。
- Provider Key。

### 4.2 Board 模块

当前状态：Next local bridge 和 FastAPI 已支持 Board validate/list/save/load/rename/delete；`/boards` Dashboard shell 和 `/boards/:boardId` entry 已落地，Dashboard 已支持 search / inline rename / delete confirm、thumbnail placeholder、shape/asset count、20 条列表上限、loading skeleton、empty CTA 和 error retry。真实 captured thumbnail、recent/opened metadata、richer pagination 和 Alpha 级错误/空状态仍待产品化。

职责：

- Board 创建、列表、重命名、删除。
- Board document_state 保存和加载。
- Board 空状态。

不负责：

- AI 生图调用。
- 图片二进制存储。

### 4.3 Canvas 模块

当前状态：`/spikes/canvas` 是成熟技术验证入口，继续保留手动 save audit 控件；`/boards/:boardId` 已复用同一 canvas runtime 作为产品 entry shell，并已把 Board 模式保存控件替换为产品化 save indicator / autosave / dirty state。

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

当前状态：五类节点、runtime edge store、fan-out、input replacement、mock data flow、Image Node 双向转换、Merge Capture 到 Image Node 已在 canvas spike 中通过；mock Model Registry / AiRun contract 已接入节点 Run，真实 AI provider / result Asset persistence 尚未接入。

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
- 未来新增 AI 节点必须先扩展 Node Registry / Model Registry / AiRun 合同，不允许在节点 UI 中直接调用 Provider。

不负责：

- 复杂工作流引擎。
- Research / Outline / Html Formatter。
- Provider Key。
- 扣费、余额和 API 日志最终写入。
- 保存 Base64 图片、完整 Provider 响应、长对话历史或大段二进制数据。

### 4.4.1 AI Node Extension Contract

未来新增 AI 节点、AI Chat 工具或不同能力的 bot 时，必须走同一个扩展合同，避免每个节点各自发请求、各自存数据、各自定义模型参数。

每个新 AI 节点必须声明：

- `nodeType`、`displayName`、`version`、`runType`。
- `inputs` / `outputs`：端口方向、`dataType`、是否必填、是否允许多连。
- `paramsSchema`：节点可保存的轻量参数、默认值、迁移规则。
- `modelCapability`：需要的模型能力，例如 `image_generation`、`image_analysis`、未来可能的 `chat_planner`。
- `resultShape`：返回 text、asset ids、多个 image outputs 或结构化 graph spec。
- `previewUI`：节点卡片摘要和 Inspector 中展示哪些字段。
- `failureStates`：可重试、用户参数错误、Provider 错误、余额/限流错误如何展示。
- `persistenceConstraints`：哪些字段可进 Board document，哪些必须只进 Asset / AiRun / 后端日志。

新增或修改 AI 节点时必须同步检查：

- Node type / runtime data 类型。
- Node Registry 的端口、参数 schema、默认数据和迁移。
- Node card preview / Inspector 渲染。
- Node data flow 对输入输出的解析。
- `AiRun` request / response 的 `runType`、`params` 和结果摘要。
- Model Registry 的 capability、参数 schema 和启用状态。
- Next local bridge 与 FastAPI route/test 的合同一致性。
- Board guard：不能让 `data:`、`blob:`、Base64、Provider raw response、完整日志或长文本结果进入 document。

执行边界：

- 节点 UI 只发起 server-owned AiRun，参数只包含 `boardId`、`nodeId`、`nodeType`、`runType`、`selectedModelId`、轻量 params 和 Asset ids。
- 后端必须二次校验模型、参数、权限、限流和预算，再调用真实 Provider。
- 节点和 runtime summary 只保存 `runId`、`modelId`、短 status、短 error、cost hint、Asset ids 或短 text preview。
- AI Chat / AI Planner 只能输出合法 graph spec：节点、连线、布局、选中模型和待确认参数；不能绕过 Node Runtime 直接写 Provider 结果。
- 未来 mask / video / audio / PDF 等新 data type 必须作为新的 data type 扩展进入本合同，不能混进 P0 image/text 端口。

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

当前状态：mock AiRun contract 已在 Next local bridge 和 FastAPI 落地，节点 Run 会创建 mock AiRun 并写回 runtime summary。尚未实现真实 provider 调用、AiRun/Postgres table、成本记录或限流。下一步真实 AI 切片应落地最小 Prompt → Image Gen / Image Gen 4 → Asset → Image Node。

职责：

- 前端通过 Node Runtime 发起 AI Run，不直接调用 Provider。
- request 携带 `boardId`、`nodeId`、`nodeType`、`runType`、`selectedModelId`、轻量 params 和 Asset ids。
- 后端校验权限、模型启用状态、参数 schema、限流、预算和扣费。
- 后端调用 Provider、写入 AiRun / ApiCallLog、把图片结果写入 Asset 层。
- response 只返回运行摘要、Asset ids、短 text preview、结构化错误和 retryable 标记。
- 失败处理和退款/no-charge 标记。

不负责：

- 前端保存 API Key。
- 复杂模型市场 UI。

### 4.7 Assets 模块

当前状态：Next local bridge、FastAPI local-dev store、FastAPI `s3-compatible` object storage adapter、Postgres Asset metadata adapter 和 Web-to-FastAPI client switch 均已落地；真实 R2/S3 bucket 和 staging credentials 尚未接入。

职责：

- 上传图片。
- 保存生成图、编辑导出图、合并截图。
- 返回可持久化 URL。
- 禁止持久化 `blob:` / `data:`。
- 当前 Slice E-A/E-B 在 `apps/web/src/app/api/assets/` 提供本地开发 Asset API bridge，文件写入 `.tangent-assets/`，用于验证前端 Asset 合同；当前 route 已经过 request context 和 storage adapter seam，metadata 带 `workspaceId` / `createdBy`。FastAPI 侧已有 local-dev、`s3-compatible` Asset adapter 和 Postgres metadata adapter；Web clients 在 `NEXT_PUBLIC_API_BASE_URL` 存在时会指向 FastAPI contract，未设置时保留 Next local bridge fallback。

不负责：

- P0 素材库标签。
- Personal Assets 页面。

### 4.8 AI Planner 模块

当前状态：已有 mock planner graph / 自动布局验证；真实 `/api/v1/ai/planner` 尚未接入。

职责：

- 接收自然语言。
- 生成最小 graph spec。
- 接收当前 composer 选择的 `selected_model_id`，并写入生成节点草稿。
- 遵守 AI Node Extension Contract，只创建 Node Registry 允许的节点类型、端口和参数。
- 前端校验后应用到画布。

不负责：

- 自主执行复杂 Agent。
- 多轮长对话记忆。

### 4.9 AI Chat 模块

当前状态：产品目标已定，右侧 AI Chat 尚未作为正式 P0 面板接入；当前自动建图仍以 mock planner / spike 工具验证为主。

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

当前状态：左侧 Canvas Node Inspector 已用于节点参数和运行摘要展示；Model Registry 驱动的动态参数表单尚未落地。

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

当前状态：mock Model Registry 已在 Next local bridge 和 FastAPI 落地，Image Gen / Image Gen 4 下拉通过 Web AI client 读取 contract。正式模型列表、价格、能力 schema、启用状态和后端二次校验仍要在真实 provider 切片实现。

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

当前状态：计划中，尚未建表。P0 Auth 落地时优先最小字段，不先做完整 profile 系统。

- `id`
- `email`
- `display_name`
- `avatar_url`
- `role`
- `created_at`
- `last_login_at`

约束见 `PRD.md`。

### 5.3 Board

当前实现字段：FastAPI / Next bridge 的 Board record 当前包含 `id`、`workspaceId`、`ownerId`、`title`、`document`、`byteSize`、`savedAt`、`shapeCount`、`assetCount`、`thumbnailUrl`；list/save response 只返回 summary，不返回完整 `document`。FastAPI Postgres driver 已把 `shape_count` / `asset_count` / `thumbnail_url` 存入 `tangent_boards`。下面字段是进入正式数据库后的目标形状。

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

当前实现字段：FastAPI `AssetRecord` 当前包含 `id`、`workspaceId`、`createdBy`、`title`、`origin`、`storage`、`mime`、`byteSize`、`width`、`height`、`createdAt`、`originalUrl`、`thumbnail256Url`、`thumbnail512Url`、`thumbnail1024Url`。`board_id` / lifecycle / soft delete 仍是后续生产化字段。

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

当前状态：已有 mock AiRun route 和 response contract，但尚未建表。真实 AI 生图接入前必须把 AiRun / ApiCallLog 持久化，避免 provider 调用无法追踪成本、状态和失败原因。

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

当前状态：计划中，P0 可先保留当前 Board 的短会话或仅保存 planner 请求摘要；长期多会话检索不进 P0。

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

当前状态：mock Model Registry 已在 Next local bridge 和 FastAPI 落地，Image Gen / Image Gen 4 下拉通过 Web AI client 读取 contract。具体模型 id、价格和能力必须以接入时 provider 官方/代理返回为准，不能在前端硬编码为最终真相。

- `id`
- `provider`
- `display_name`
- `capabilities`
- `parameter_schema`
- `is_enabled`
- `is_default`
- `estimated_latency`
- `cost_hint`

P0 候选模型示意：

- `gpt-image-2`
- `gemini-3.1-flash-image-preview`

真实可用性以服务端返回为准，前端 disabled 不等于后端可跳过校验。

### 5.8 Document State

前端保存的 Board 文档结构建议。下面是逻辑示意；当前实现的 `serializeBoardDocument()` 实际输出当前 editor 的轻量 `shapes`、`assets`、`camera`、`viewport` 和 runtime edges，而不是完整 tldraw store snapshot。

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

当前实现已覆盖 request context、Asset / Board persistence guard、workspace-scoped local/S3/Postgres access；正式 Auth、Provider 调用、ApiCallLog 和 Credits 仍待实现。

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

- 当前阶段：`/boards/:boardId` 的 Board 模式已提供产品化 save status、dirty state、load/save error state、1600ms debounce autosave 和 beforeunload warning；`/spikes/canvas` 继续保留手动 Save audit / Save local / Load local 开发验证控件。
- 下一步产品化目标：补长时浏览器回归、Dashboard metadata 和真实 Auth 后的权限错误态。
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
GET /api/boards/local-list
POST /api/boards/local-save
GET /api/boards/local-load?boardId=...
```

约束：

- 所有接口必须校验 Board 属于当前用户或当前 workspace。
- `GET /api/v1/boards` 和 `GET /api/boards/local-list` 只返回 Board summary，不返回完整 document。
- `/api/v1/boards`、`/api/v1/boards/{board_id}` 和 `/api/v1/boards/validate-document` 是 FastAPI contract；`/api/boards/local-*` 是 Next local bridge contract。
- `PATCH` 只允许更新 title、thumbnail、document_state 等白名单字段。
- 写入 `document_state` 前必须通过 Board document guard，拒绝 `data:` / `blob:` 和大段 base64-like payload。
- 当前本地开发 bridge 在 `apps/web/src/app/api/boards/validate-document/route.ts` 提供相同 guard contract；正式 FastAPI 保存接口必须复用同等规则。
- `validate-document`、`local-save`、`local-load` 和 `local-list` 都会解析 `apiRequestContext`；本地默认 dev context，`TANGENT_REQUIRE_API_AUTH=1` 时必须显式提供 context。
- 当前 canvas spike 使用 `serializeBoardDocument()` 生成保存候选 document，只包含 shapes、assets、camera、viewport、runtime edges 等轻量恢复信息，不保存完整 tldraw store snapshot。
- 当前 `Save audit` dev control 会先迁移可处理的 runtime image assets 到本地 Asset API，再执行 guard；不能迁移的 `data:` / `blob:` 仍会阻塞保存候选。
- 当前 `Save local` dev control 会在 guard 通过后写入 `.tangent-boards/boards/canvas-spike-local.json`，并通过 `apiRequestContext` 给本地记录写入 `workspaceId` / `ownerId`；这是本地开发保存支架，不替代正式数据库、Auth 或 workspace 权限。
- 当前 `Load local` dev control 会从 `.tangent-boards/` 读取同一 document，按 `workspaceId` 校验本地记录后重建 tldraw assets / shapes、runtime edges 和 camera；这是 restore 验证支架，不替代正式 Board load。
- `apps/web/src/app/api/boards/_lib/boardStorageAdapter.ts` 是 Next local Board persistence seam；当前支持 `TANGENT_BOARD_STORAGE_DRIVER=local-dev`，`local-list` 只返回 summary，`local-save` 只返回 summary，`local-load` 才返回 document，`local-rename` / `local-delete` 按 request context 校验 workspace；不支持的 driver 必须明确失败。正式 staging/production Dashboard 应优先通过 `NEXT_PUBLIC_API_BASE_URL` 走 FastAPI。
- `apps/web/src/components/boards/BoardDashboard.tsx` 是当前 `/boards` Dashboard shell；它现在做 summary list、create/open/search/rename/delete/refresh，权限仍必须由后端 request context / future Auth 执行。
- `/boards/:boardId` 的 Board-mode autosave 使用 debounce + document signature。保存成功后记录 last-saved signature；长会话里如果 dirty 事件触发但序列化 document 未变化，不重复调用保存 API。
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
- `services/api/tangent_api/routers/boards.py` 当前实现 `POST /api/v1/boards/validate-document`、`GET /api/v1/boards`、`POST /api/v1/boards`、`GET /api/v1/boards/{board_id}`、`PATCH /api/v1/boards/{board_id}` 和 `DELETE /api/v1/boards/{board_id}`；storage driver 可切 `local-dev` 或 `postgres`。
- `services/api/tangent_api/storage/asset_storage_adapter.py` 是 FastAPI Asset storage seam；`local-dev` 走本地文件存储，`s3-compatible` 走 `services/api/tangent_api/storage/s3_asset_store.py`，通过 boto3 写入 S3/R2-compatible object storage。
- `services/api/tangent_api/routers/assets.py` 当前实现 `POST /api/v1/assets/from-data-url`、`POST /api/v1/assets/upload`、`GET /api/v1/assets/{asset_id}` 和 `GET /api/v1/assets/files/{asset_id}/{file_name}`；metadata 带 `workspaceId` / `createdBy`，文件读取会校验 workspace。S3 driver 将 original / thumbnails / `metadata.json` 写到 `workspaces/{workspace_id}/assets/{asset_id}/...`，Asset URL 仍返回 FastAPI file route，避免直接绕过 request context；不支持的 `TANGENT_ASSET_STORAGE_DRIVER` 会明确 501。
- `services/api/tangent_api/storage/board_storage_adapter.py` 支持 `TANGENT_BOARD_STORAGE_DRIVER=local-dev|postgres`；Postgres driver 写 `tangent_boards`，保存前仍复用 Board document guard，save response 只返回 summary。
- `services/api/tangent_api/storage/asset_metadata_adapter.py` 支持 `TANGENT_ASSET_METADATA_DRIVER=object-storage|postgres`；`postgres` driver 写 `tangent_assets`，用于 `s3-compatible` object bytes + DB metadata 的生产形状。
- `apps/web/src/features/api/persistenceApi.ts` 控制 Web persistence client：未设置 `NEXT_PUBLIC_API_BASE_URL` 时走 Next local bridge；设置后走 FastAPI `/api/v1`。FastAPI 的 `TANGENT_ALLOWED_ORIGINS` 负责本地 Web origin CORS allowlist。
- `services/api/tests/` 已覆盖 Board local/Postgres、Asset local/S3/Postgres metadata、CORS 和 workspace isolation contract。

### 8.4 Model Registry

当前状态：mock route 已实现。下面是 API contract；真实模型 id 和参数 schema 必须由服务端从 provider/配置中返回。

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

当前状态：mock route 已实现；真实 provider / Postgres persistence / 成本限流仍待后续接入。

```http
POST /api/v1/ai/runs
GET /api/v1/ai/runs/{run_id}
```

请求示例：

```json
{
  "boardId": "uuid",
  "inputAssetIds": [],
  "nodeId": "gen-1",
  "nodeType": "image_gen_4",
  "runType": "image_generation",
  "selectedModelId": "gpt-image-2",
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
  "ok": true,
  "run": {
    "runId": "uuid",
    "runType": "image_generation",
    "modelId": "gpt-image-2",
    "status": "succeeded",
    "outputAssetIds": ["asset_uuid"],
    "costCredits": 0.0,
    "latencyMs": 12345
  }
}
```

错误响应（真实 provider 阶段目标）：

```json
{
  "code": "MODEL_UNAVAILABLE",
  "message": "The selected image model is unavailable.",
  "retryable": true
}
```

### 8.6 AI Planner

当前状态：尚未实现 route；当前只有 mock graph / planner spike。

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
- 后端读取 `GEEKAI_API_KEY`、`DATABASE_URL`、`S3_*`、`TANGENT_BOARD_STORAGE_DRIVER`、`TANGENT_ASSET_STORAGE_DRIVER`、`TANGENT_ASSET_METADATA_DRIVER`、`TANGENT_ALLOWED_ORIGINS`、`TANGENT_REQUIRE_API_AUTH`、`TANGENT_DEV_USER_ID`、`TANGENT_DEV_WORKSPACE_ID` 等变量。
- 前端只能读取公开安全变量，如 `NEXT_PUBLIC_API_BASE_URL`、`NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS`。

### 10.2 鉴权

- 当前实现仍以 dev context + request headers 作为过渡，`TANGENT_REQUIRE_API_AUTH=1` 时必须显式携带 context。
- 正式版所有 protected API 必须验证 JWT/session。
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

当前实际命令：

```bash
npm run dev:web
npm run lint:web
npm run typecheck:web
npm run build:web
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api
```

### 11.3 质量闸门

前端：

- `npm -C apps/web run build`
- `npm -C apps/web run lint`
- `npm -C apps/web run typecheck`
- 触碰文件定向 lint

后端：

- `PYTHONPATH=services/api python3 -m pytest services/api/tests`
- `python3 -m compileall services/api/tangent_api`
- 最小 API 检查；触碰 staging package 时还要跑 Docker / compose smoke

通用：

- `git diff --check`
- 检查触碰源码文件行数，接近或超过 300 行时先拆分；已知大文件必须在对应 dev-plan 标记拆分任务。
- 更新 `project_state.md`

Staging package：

- `docker compose -f deploy/staging/docker-compose.api.yml config`，临时 `api.env` 检查完必须删除或保持 Git 忽略。
- `docker build -f services/api/Dockerfile services/api -t tangent-api:staging-smoke`
- 容器 `/health`、Asset create/read、Board save/load、guard rejection smoke。

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

### 11.5 0-to-1 上线总路线

本路线回答“从当前本地可用状态到一个可给 Alpha 用户使用的 Web 产品，还缺哪些步骤”。估时按单人开发、已有代码基础、正常工作日粗估；外部账号审核、域名解析生效、Provider 调试和手测反馈可能拉长日历时间。

当前已完成的基础：

- Canvas / Node Runtime / Image Node / Merge Capture / Asset LOD Slices A-D 已通过。
- FastAPI 已有 request context、Board guard、local-dev Asset / Board routes、真实 `s3-compatible` Asset adapter、Postgres Board / Asset metadata adapter。
- Web 已可通过 `NEXT_PUBLIC_API_BASE_URL` 切到 FastAPI Asset upload / Board save-load。
- Staging API Docker / compose / env / runbook package 已存在。
- `/boards` Dashboard shell 和 `/boards/:boardId` entry 已接入同一 persistence contract，并支持 list/create/open/search/rename/delete。
- Product Shell route skeleton 已落地：App Shell navigation、`/login`、`/signup`、`/forgot-password`、`/verify-email`、`/workspaces`、`/dashboard` redirect、`/settings` 和 `/account`，使用 mock user/workspace 和本地表单校验。

当前本地可继续推进的范围：

| 本地轨道 | 可以现在做 | 不现在做 | 退出标准 |
|----------|------------|----------|----------|
| Product Shell | App shell navigation、`/login`、`/signup`、`/forgot-password`、`/verify-email`、`/workspaces`、`/dashboard` redirect、`/settings`、`/account` route skeleton，使用 mock user/workspace | 真实邮件发送、OAuth、密码存储、团队邀请、权限矩阵、计费 | 已完成；页面可访问，导航能回到 `/boards`，表单有本地校验，前端不出现 secret |
| Board save UX | `/boards/:boardId` autosave/debounce、save indicator、dirty/clean state、离开页面 warning、保存/加载失败状态 | 复杂协作冲突解决、多人实时同步 | 刷新/重开不丢 shapes/assets/runtime edges/camera；失败时用户看得见 |
| Dashboard polish | thumbnail placeholder/field、shape/asset counts、pagination/list limit、空/错/加载状态 | 完整团队 workspace dashboard 或 Admin analytics | first pass 已完成；多 Board 管理可用，list response 仍只返回 summary，captured thumbnail / recent-open 以后补 |
| Auth scaffold | session/workspace 类型、mock current-user boundary、route guard 形状、Auth-required dev smoke | 真实 provider、cookie 安全策略最终落地、邮箱域名信誉 | first pass 已完成；dev fallback 不阻塞开发，开启 auth-required 检查时缺 context 会明确失败 |
| Asset / persistence hardening | 更多 contract tests、workspace isolation edge case、thumbnail metadata、migration note | 真实生产 bucket/DB backup 验收 | local/FastAPI tests 覆盖成功路径和失败路径 |
| AI contract scaffold | mock Model Registry、`AiRun` schema draft、server-only AI proxy stub、mock provider response | 真实 provider key、真实扣费、预算熔断最终值 | first pass 已完成；前端模型选择走服务端合同，没有真实 key 也能测试 UI |

当前必须等外部资源才能完成的范围：

| 外部资源 | 会阻塞什么 |
|----------|------------|
| Git remote / deploy platform | 真实 push/deploy/rollback、branch protection、CI token |
| Server/VPS 或 API deploy target | public FastAPI smoke、API domain、HTTPS reverse proxy |
| Managed Postgres | 真实 users/workspaces/boards/assets/ai_runs persistence 和 backup policy |
| R2/S3 bucket credentials + CORS | 生产对象存储、图片保留、guarded file reads |
| Domain / DNS / TLS | staging/prod origins、cookie/CORS、tldraw production license domain |
| Email provider + sender domain | OTP/magic link、SPF/DKIM/DMARC、真实邮箱验证 |
| AI provider key/billing | 真实 Prompt -> Image Gen / Image Gen 4 -> Asset、成本日志 |
| tldraw production license | production build 不触发 license gate |

| 阶段 | 目标 | 主要交付 | 开发估时 | 测试估时 | 退出标准 |
|------|------|----------|----------|----------|----------|
| 0. 当前基线 | 保持本地可跑、可回滚 | checkpoint commit、质量闸门、文档同步 | 已完成 | 已完成 | `pytest` / web lint / typecheck / build / smoke 通过 |
| 1. Staging 基础设施 | 有真实 API / DB / R2 / 域名环境 | Managed Postgres、R2 bucket、API VPS、staging domain、TLS reverse proxy、Web env | 1-2 天 | 0.5-1 天 | staging Web 可上传图片、保存/加载 Board，R2/Postgres 有真实记录 |
| 2. 部署与推送流水线 | 代码改动能稳定推到 staging/prod | Git remote 策略、Vercel/Cloudflare Pages Web deploy、VPS Docker deploy、env secret 管理、rollback 手册 | 1-2 天 | 0.5-1 天 | commit 后可自动或半自动部署；失败可回滚上一版本 |
| 3. Auth / 注册 / 邮箱验证 | 从 dev context 变成真实用户 | users/workspaces tables、Email OTP 或 magic link、session/JWT、保护 `/boards` 和 API、退出登录 | 3-5 天 | 1-2 天 | 新用户可邮箱验证注册，API 按 user/workspace 隔离数据 |
| 4. Board CRUD 产品化 | Dashboard 从 shell 变成可用产品入口 | New / list / open / rename / delete / search、空状态、加载/错误状态、autosave 或 save indicator | 2-4 天 | 1-2 天 | 用户能创建多个 Board，刷新/重开不丢图、不丢节点和连线 |
| 5. AI 生图最小链路 | Prompt → Image Gen / Image Gen 4 → Image Node 真实跑通 | Model Registry、AI Proxy、AiRun table、provider client、成本/限流、失败重试、结果入 Asset | 5-8 天 | 2-4 天 | 单图/四图真实生成成功，API Key 只在服务端，成本日志可查 |
| 6. Analysis / AI Chat 自动搭线 | P0 图像链路完整 | Analysis provider path、AI Chat planner、自动建节点/连线、用户确认后 Run | 3-6 天 | 2-3 天 | Image + Prompt → Analysis → Prompt 和 Chat 建图可手测通过 |
| 7. 生产前安全与运维 | Alpha 不会因常见问题马上崩 | rate limit、预算熔断、日志/监控、备份、restore drill、CORS、内容/文件限制、错误页 | 3-5 天 | 1-2 天 | 有健康检查、备份、告警、限流和明确故障恢复路径 |
| 8. Alpha 发布验收 | 给第一批用户可用 | 端到端回归、Windows/Mac/Chrome/Edge、真实 AI 成本测试、隐私/条款占位 | 2-3 天修复 | 3-5 天手测 | 5-10 个 Alpha 用户能完成最小链路 |
| 9. P0.5 多人协作 | 多人同 Board 编辑 | 协作文档层、presence、软锁、snapshot、reconnect、权限、服务端权威事件 | 8-15 天 | 5-10 天 | 多人移动/编辑/保存不破坏 Asset / Board / AI Run 权威边界 |

推荐执行顺序：

1. 外部资源未就绪时，先做本地 Product Shell、Board save UX、Dashboard metadata、Auth scaffold 和 AI contract scaffold。
2. 外部资源就绪后做阶段 1-2，让部署通路真实可用。
3. 再做阶段 3-4，让每个 Board 归属真实用户和 workspace。
4. 然后做阶段 5-6，接入真实 AI 能力。
5. 阶段 7-8 是 Alpha 前的硬门，不要跳过。
6. 阶段 9 多人协作必须等 Asset / Board / Auth / AI Run 边界稳定后再做。

### 11.5.1 Sprint 任务清单

默认按单人开发估算，一个 sprint 约 3-5 个工作日；较小的外部配置 sprint 可以 1-2 天完成。每个 sprint 都必须以可验证状态结束，不把“写了一半但不能 smoke”的内容跨 sprint 留在主线。

如果真实服务器、域名、Postgres、R2、Email 或 AI provider 暂时没有准备好，先执行 S0A-S0E；这些是当前本地阶段可以直接完成的产品可用性工作。外部资源就绪后再进入 S1-S4 的 staging/deploy 链路。

| Sprint | 阶段 | 预计 | 主要任务 | Done 标准 |
|--------|------|------|----------|-----------|
| S0 | 当前基线 | 已完成 | 保持当前 Slice E baseline、checkpoint commit、文档同步、质量闸门 | 本地 Web / FastAPI tests/build/smoke 已通过，当前分支可回滚 |
| S0A | 本地 Product Shell | 已完成 | App shell navigation；`/login`、`/signup`、`/forgot-password`、`/verify-email`、`/workspaces`、`/dashboard` redirect、`/settings`、`/account` route skeleton；mock user/workspace 状态 | 路由可访问，导航可回到 `/boards`，表单本地校验可用，不接真实邮件/secret |
| S0B | 本地 Board save UX | 已完成第一版 | `/boards/:boardId` autosave/debounce、save indicator、dirty warning、load/save error fallback；Board 模式收起 dev-only save controls | 刷新/重开不丢 shapes/assets/runtime edges/camera；失败状态可见，长时浏览器回归继续补 |
| S0C | Dashboard metadata polish | 已完成第一版 | thumbnail placeholder/field、shape/asset counts、list limit、空/错/加载状态 | 多 Board 管理可用，list response 仍只返回 summary；captured thumbnail / recent-open metadata / richer pagination 后续补 |
| S0D | Auth scaffold boundary | 已完成第一版 | current-user/session/workspace 类型和 mock boundary；Next/FastAPI session endpoint；route guard 形状；auth-required dev smoke | dev fallback 不阻塞开发，开启 auth-required 检查时缺 context 会明确失败；真实 Auth/email/session 后续补 |
| S0E | AI contract scaffold | 已完成第一版 | mock Model Registry、`AiRun` schema draft、server-only AI proxy stub、mock provider response | 模型选择不再依赖组件硬编码最终真相；没有真实 key 也能跑 UI |
| S1 | 1. Staging 基础设施 | 1-2 天 | 建 managed Postgres；建 R2/S3 bucket；准备 `api.env`；配置 `api-staging.<domain>` DNS / TLS / reverse proxy | `docker compose` API 在 staging server 运行；`/health` 200；Postgres/R2 凭据可用 |
| S2 | 1. Staging persistence smoke | 0.5-1 天 | 用 staging Web origin 配 CORS；上传 PNG/JPEG/WebP；保存/加载 Board；检查 R2 object 和 Postgres rows | `deploy/staging/README.md` smoke 全通过，Board guard 仍拒绝 `data:` / `blob:` |
| S3 | 2. 推送 / 部署流水线 | 1-2 天 | 明确 Git remote；连接 Web deploy 平台；写 VPS deploy steps；定义 env secret 存放和 rollback 步骤 | push 后可部署 staging；失败可回滚上一 commit/container |
| S4 | 2. Production deploy skeleton | 0.5-1 天 | 准备 production env 模板、domain 计划、独立 Postgres/R2 命名和 CORS 白名单；不接真实用户流量 | production checklist 可执行，staging/prod env 不混用 |
| S5 | 3. Auth 数据层 | 2-3 天 | 建 `users`、`workspaces`、`workspace_memberships`、`email_otps` schema；实现 migration / auto-create 策略；扩展 request context | FastAPI 可用真实 user/workspace 解析 context；dev fallback 仍可本地开发 |
| S6 | 3. 邮箱验证 / session | 2-3 天 | 接 Email OTP 或 magic link provider；实现注册、登录、登出、session/JWT；配置 SPF/DKIM/DMARC 任务 | 新用户可邮箱验证登录；API 不再依赖前端随意传 user id |
| S7 | 3. Auth UI / 路由保护 | 1-2 天 | `/login` UI；保护 `/boards` / `/boards/:boardId`；错误状态和退出登录入口 | 未登录会跳转 login；登录后回到 `/boards`；workspace isolation smoke 通过 |
| S8 | 4. Board CRUD API | 2-3 天 | FastAPI 增加 rename/delete/search/list pagination；Board thumbnail 字段；权限过滤；contract tests | Board list 不返回 document；rename/delete/search 都按 workspace 校验 |
| S9 | 4. Dashboard 产品化 | 2-3 天 | `/boards` 加搜索、重命名、删除确认、空/错/加载状态、recent saved time、thumbnail placeholder | 用户可管理多个 Board；删除/重命名刷新后正确 |
| S10 | 4. Canvas save UX | 2-3 天 | `/boards/:boardId` 增 autosave/debounce、save indicator、load error fallback、离开页面提示；移除或收起 dev-only save controls | 刷新/重开不丢 shapes/assets/runtime edges/camera；保存失败可见 |
| S11 | 5. Model Registry / AiRun schema | 2-3 天 | 建 `model_options`、`ai_runs`、`api_call_logs`；实现 `/api/v1/ai/models`；前端模型选择改走 API | Image Gen / Image Gen 4 / Chat composer 不再硬编码最终模型真相 |
| S12 | 5. AI Proxy provider client | 3-5 天 | 实现 GeekAI/provider client；服务端校验 model/params；限流和预算熔断初版；结构化错误 | API Key 只在服务端；失败有 retryable/error_code；成本日志可查 |
| S13 | 5. 真实 Image Gen 链路 | 3-5 天 | Prompt → Image Gen 单图；Image Gen 4 四图；结果写 Asset/R2/Postgres；节点状态更新和 retry | 单图/四图真实生成成功，结果变 Image Node 可保存/加载 |
| S14 | 6. Analysis 链路 | 2-3 天 | Image + Prompt → Analysis provider call；输出 text 存 AiRun/result；Analysis → Prompt 回写 | 反推提示词链路可跑通，失败状态可重试 |
| S15 | 6. AI Chat 自动搭线 | 3-5 天 | `/api/v1/ai/planner`；Chat composer；自动创建 Prompt/Image Gen/Image/Analysis 节点和 runtime edges；用户确认后 Run | 用户一句话可生成最小图像链路，节点/连线合法且不重叠 |
| S16 | 7. 安全 / 运维基础 | 3-5 天 | rate limit；上传 abuse guard；AI budget kill switch；API/error logs；health/uptime check；Terms/Privacy 占位 | 登录、上传、AI Run 都有限流；出错可查日志；隐私/条款有入口 |
| S17 | 7. 备份 / 恢复 / 生命周期 | 2-3 天 | Postgres backup policy；R2 object lifecycle；删除 Board/Asset 的软删/硬删规则；恢复演练 | 能从备份恢复一个 Board；删除策略不留下孤儿对象 |
| S18 | 8. Alpha 回归矩阵 | 3-5 天 | Mac/Windows、Chrome/Edge、browser zoom、真实 AI 成本、30MB 上传、100 image-like object smoke | 阻塞级问题清零；non-blocking 问题记录到 plan |
| S19 | 8. Alpha 修复 / 发布 | 2-3 天 | 修复 S18 blockers；准备 Alpha seed users；发布说明；手测脚本 | 5-10 个 Alpha 用户能完成 Prompt → Image Gen → Image Node → Save/Load |
| S20 | 9. 协作技术 spike | 3-5 天 | 选择 tldraw sync / Yjs / Liveblocks / PartyKit 方向；验证 lightweight document、presence、snapshot | 证明协作不同步 `data:` / Provider payload，且不破坏现有 Board save |
| S21 | 9. Presence / soft lock | 3-5 天 | 多人光标、选区、正在编辑节点提示、软锁 UI、reconnect 行为 | 两个用户同 Board 可见 presence；软锁不作为权限依据 |
| S22 | 9. 协作文档持久化 | 5-8 天 | 协作文档 snapshot、权限、冲突处理、AI Run/Asset 服务端权威合并、压力测试 | 多人编辑、保存、刷新、重连可用；AI Run / Asset / 扣费仍以后端为权威 |

阶段依赖：

- S0A-S0E 是外部资源未就绪时的本地可推进队列；它们不能替代真实 Auth、Email、DB、R2 或 AI provider。
- S1-S4 必须在真实 Auth / AI / Alpha 前完成，否则后续没有可靠 staging 验收环境。
- S5-S10 建立真实用户和 Board 边界，是 AI 接入前的安全前提。
- S11-S15 才接真实 provider，避免无日志、无限流、无成本记录地调用 AI。
- S16-S19 是 Alpha 发布硬门。
- S20-S22 是 P0.5，不进入 P0 Alpha blocker，除非产品策略明确提前协作。

### 11.6 部署与推送流程

本项目默认采用“本地开发 → Git commit → push 到远端 → staging 自动或半自动部署 → smoke → production promote”的节奏。不要直接在服务器上手改代码。

本地提交前：

```bash
git status --short
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
git add <changed-files>
git commit -m "<type>: <summary>"
```

推送到远端：

```bash
git push origin feature/asset-lod-roadmap
```

Staging API 部署：

```bash
ssh <staging-server>
cd TanvasAgent
git fetch origin
git checkout feature/asset-lod-roadmap
git pull --ff-only
cp deploy/staging/api.env.example deploy/staging/api.env # first time only
$EDITOR deploy/staging/api.env
docker compose -f deploy/staging/docker-compose.api.yml up -d --build
docker compose -f deploy/staging/docker-compose.api.yml ps
curl http://127.0.0.1:8000/health
```

Staging Web 部署：

- Web 平台连接同一个 Git remote。
- 设置 `NEXT_PUBLIC_API_BASE_URL=https://api-staging.<domain>`。
- API 设置 `TANGENT_ALLOWED_ORIGINS=https://staging.<domain>,http://localhost:3000`。
- Web build 后打开 `/boards` 和 `/boards/<boardId>` 做 smoke。

Production promote：

- 只从通过 staging smoke 的 commit 或 tag 部署。
- production 使用独立 env、独立 Postgres、独立 R2 bucket、独立 domain。
- 出问题先回滚 Web deploy，再回滚 API container/tag；不要临时改生产代码。

最小 smoke 清单：

- `/health` 返回 200。
- CORS preflight 从 Web origin 返回 allow-origin。
- 上传 PNG/JPEG/WebP 后 R2 有对象、Postgres 有 metadata。
- `/boards` 可列 Board summary。
- `/boards/:boardId` 可保存、刷新、加载。
- Board guard 能拒绝 `data:` / `blob:` / base64 payload。
- AI 接入后，Prompt → Image Gen → Image Node 能生成 Asset，并记录 AiRun。

### 11.7 外部资源建立顺序

这些不是代码，但会卡住上线，应当当成正式任务追踪。

| 资源 | 建议时机 | 必填信息 | 验收 |
|------|----------|----------|------|
| Git remote | 现在 | repo、branch protection、deploy key 或 CI token | 本地可 `git push`，部署平台可拉代码 |
| Staging domain | 阶段 1 | `staging.<domain>`、`api-staging.<domain>` | DNS 生效，HTTPS 可访问 |
| Production domain | 阶段 7 前 | `<domain>`、`api.<domain>` | 与 staging 分离，CORS 不混 |
| Managed Postgres | 阶段 1 | `DATABASE_URL`、backup policy、region | Board / Asset metadata 写入成功，可恢复备份 |
| R2/S3 bucket | 阶段 1 | endpoint、bucket、access key、secret、CORS | 原图/缩略图写入成功，文件读取走 API guard |
| Email provider | 阶段 3 | sender domain、API key、SPF/DKIM/DMARC | OTP/magic link 可收信，垃圾箱率可接受 |
| AI provider | 阶段 5 | API key、base URL、模型清单、预算 | 真实生图成功，失败返回结构化错误 |
| tldraw production license | Alpha 前 | license / domain 配置 | production build 不触发 license gate |
| Monitoring/logging | 阶段 7 | API logs、error logs、uptime check | API 错误、AI 失败、成本异常可发现 |

隐藏步骤清单：

- 数据库 migration 策略：staging 可临时 auto-create，production 必须有 migration 或受控 schema 变更。
- 备份和恢复演练：Postgres 每日备份，R2 对象保留策略，至少演练一次从备份恢复 Board。
- Secrets 管理：`.env` 不进 Git；staging/prod 分离；泄露后能轮换。
- CORS 和 cookie 策略：staging/prod domain 分离；登录后 API 不能被任意 origin 调用。
- Email domain reputation：配置 SPF/DKIM/DMARC，否则验证码可能进垃圾箱。
- Rate limit / abuse guard：登录、验证码、上传、AI Run 都需要限流。
- 成本熔断：AI provider 失败、价格异常或调用量异常时可以暂停模型。
- 图片生命周期：用户删除 Board / Asset 后如何软删、硬删、清 R2 对象。
- Legal 占位：Terms / Privacy / 删除账号与数据路径，Alpha 也要有最小说明。
- Admin / Ops 最小页：P0 不做复杂 Admin，但至少要能查 AiRun、错误、用户用量。
- WebSocket / 协作域名：P0.5 协作可能需要独立 service、长连接超时和反向代理配置。

---

## 12. 开发切片原则

每次只做可独立验收的端到端切片。当前 0-to-1 执行顺序以 11.5 为准；下面是产品/技术功能切片边界。

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
12. Dashboard / Board CRUD / 保存 / 登录收口。
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
| staging/prod 域名和环境不一致 | `deploy/staging` 先跑通，再把 Web / API / CORS / R2 / Postgres / domain 分环境固化 |
| 邮箱验证收不到 | 提前配置 SPF/DKIM/DMARC，先做小流量测试并准备降级说明 |
| AI Provider 接入失败 | 先落 Model Registry / AiRun contract，再接 provider；失败时保持结构化错误和 retryable 标记 |
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
- `dev-plans/p0-local-product-shell-and-slice-e-roadmap-2026-05-01.md`：checkpoint `5ffed96` 之后的本地 Product Shell + Slice E 收口队列。
- `dev-plans/p0-development-harness-roadmap-2026-04-30.md`：P0 后续开发 Harness 路线图。
- `deploy/staging/README.md`：staging API 部署包和 smoke runbook。

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
| 全栈架构蓝图 | `ARCH.md` 2-8 章，Next.js / tldraw / Node Runtime / FastAPI / PostgreSQL / Assets；`deploy/staging` 已有 API package | Auth / AI Run / production deploy |
| UI/UX 设计系统 | `reference/Design.md`、Canvas 设置和工具栏实现；Product Shell 已切到新 Design.md | 右侧 AI Chat 完整设计、移动响应式 |
| 认证与用户管理 | `ARCH.md` 1.3 / 8.1 / 10.2 | OAuth、密码重置、账户删除 |
| 支付与订阅 | `ARCH.md` 1.4 | Stripe Checkout / Webhook / Credits 账本 |
| 实时功能 | `ARCH.md` 7.1.1 | P0.5 Presence、软锁、协作文档层 |
| 数据库与 API | `ARCH.md` 5 / 8；FastAPI Board / Asset local-dev、S3-compatible、Postgres adapters 已落地 | SQL migration、Auth-required API tests、AI Run contract tests |
| 发布策略 | 成本预测和 README | Alpha 发布手册、ASO/社媒模板 |
| 测试与 QA | `PRD.md` 9、`ARCH.md` 11.3、`HARNESS.md` QA | Playwright E2E、API tests、性能基准、staging smoke |
| 管理仪表板 / 分析 | P0 只保留 API logs 和成本记录 | 用户管理、模型线路管理、漏斗和收入 dashboard |
| AI 功能集成 | Model Registry / AI Runs / Planner 架构 | 真实 Provider 参数、Prompt 模板、缓存和熔断 |
| 部署 / 监控 / 恢复 | `ARCH.md` 11.5-11.7、`deploy/staging/README.md` | staging/prod 配置、健康检查、告警、回滚和事故手册 |
