# TANGENT Web AI Image Canvas — PRD

**版本**: v0.7
**日期**: 2026-05-02
**状态**: Web 重启方向正式 PRD；S1.5 复杂节点与 Asset LOD Slice A-D 已通过，当前主线是 Slice E Real Asset Pipeline + P0 Product Shell。FastAPI local-dev、真实 `s3-compatible` Asset adapter、Postgres Board / Asset metadata persistence、Web-to-FastAPI switch、staging API package、`/workspaces` Board gallery/list entry、Product Shell route skeleton、App Shell / Landing page / Account / Settings / Collection / Team / Subscription semantic cleanup、Board save UX 第一版、Board History first pass、Workspace Board metadata first pass、expanded Board Management Panel metadata、captured Board thumbnail first pass、per-board Canvas Settings、Smart Drawing first pass、Auth scaffold first pass、AI contract scaffold first pass、P0 database migration scaffold 和 Admin S0 schema/access boundary 规划已落地。
**当前优先级**: P0 最小图像链路已在 canvas spike 中证明可行；当前从“本地可保存/加载 + staging package”进入“本地 polish / external-resource staging wiring”双轨阶段。Workspace Board metadata、captured Board thumbnail、Board History、Canvas Settings、Smart Drawing、Auth scaffold 和 AI contract scaffold 已有 first pass；若外部资源未就绪，本地优先补长时回归、manual/History thumbnail polish 和 i18n/状态 polish；真实 staging 基础设施、正式 Auth、邮箱验证和真实 AI 生图仍在外部资源就绪后推进；多人协作继续后置到 P0.5。
**一句话定位**: TANGENT 是一个极简 Web AI 图像画布，主体验像 Miro/FigJam 一样自由涂画和摆放内容，同时把 AI 能力封装成可连接的节点卡片；用户可以手动连接 Prompt、生图、图片承接和 Analysis 节点，也可以在右侧 AI 对话栏里用自然语言让系统自动创建节点、连线和切换生图模型。

---

## 0. 文档使用方式

本文件回答“用户能看到什么、能操作什么、怎样算完成”。
工程实现细节见 `ARCH.md`。
当前项目状态见 `project_state.md`。
快速切片上下文见 `Project_state/current-slice.md`；架构短索引见 `ARCH/README.md`。
当前计划入口见 `dev-plans/README.md`；活跃主线见 `dev-plans/Asset-lod-roadmap.md`。
跨功能执行规范见 `HARNESS.md`。

每次开发前先读：

1. 小 UI polish：`Project_state/current-slice.md` → `ARCH/README.md` → 相关 `ARCH/Slice-*.md` → active dev-plan。
2. 架构/API/Auth/AI/Admin/Billing/Deploy/协作变化：`project_state.md` → `PRD.md` → `ARCH.md` → `HARNESS.md` → `dev-plans/README.md` → 当前 active plan。

当前交接状态：

- S1.5 复杂节点、runtime edge、mock 数据流、Merge Capture 本地闭环已通过。
- Slice D 跨平台 Canvas 性能门按 `pass with notes` 通过。
- Windows 50+ 图片/节点密集场景仍可能有轻微卡顿，归档为 non-blocking performance follow-up。
- 临时 Cloudflare Tunnel、`NEXT_ALLOWED_DEV_ORIGINS` 和 `CanvasRuntimeDiagnostics` 不是产品方案；`CanvasRuntimeDiagnostics` 默认关闭，仅 `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1` 时启用。
- 当前主线是 Slice E Real Asset Pipeline：E-A 本地 server-backed Asset API bridge 已落地，E-C Board save guard + local save/restore 已落地，E-B request context + storage adapter seam 已覆盖 FastAPI local-dev、真实 `s3-compatible` Asset adapter、Postgres persistence adapter 和可配置 Web-to-FastAPI upload/save/load；FastAPI + Web runtime smoke 和 staging API Docker package smoke 已通过。

当前实现状态：

- `/workspaces` Board gallery/list 和 `/boards/:boardId` 画布入口已是当前产品化入口的起点；`/`、`/dashboard` 和 `/boards` 列表入口都会回到 `/workspaces`，避免露出旧 table dashboard；`/spikes/canvas` 仍保留为技术验证入口。
- Product Shell 已按 `reference/Design.md` 和 `reference/Design_reference.md` 新增 `/login`、`/signup`、`/forgot-password`、`/verify-email`、`/home`、`/workspaces`、`/dashboard` redirect、`/collections`、`/settings`、`/account`、`/team` 和 `/billing` route skeleton；Auth 页面已先切成 Quiet Editorial split-screen 表单，顶部导航为 Landing page / Workspace / Collection / Team / Subscription，Landing page 不放入侧栏；`/workspaces` 已纠正为 active workspace 内的 Board gallery/list，读取 Board summary 并支持 Gallery/List、搜索、排序、新建、打开、重命名、删除；`/home` 是 Landing page 壳，`/collections`、`/account`、`/settings`、`/team`、`/billing` 语义已分开，Collection/Team/Subscription 明确是 placeholder。Auth scaffold first pass 已有 typed session/user/workspace、Next/FastAPI session endpoint、dev request headers 和默认关闭的 Proxy route guard，但这些页面仍使用 mock user/workspace 和本地表单校验，不代表真实 Auth、团队或计费已完成。
- Workspace Board gallery 现在支持 Board summary list、New board、Open、Search、Sort、Rename、Delete、Copy、Refresh、settings-like Panel metadata、缩略图占位/URL/上传/保存时自动捕获/一键 Remove 回默认、shape/asset 对象计数、`lastOpenedAt` 最近打开、Recently opened / Recently saved 排序、client-side Load more、star/pin/share/private/public 菜单动作、右上角红色 pin 与 private/public 图标、share/copy toast、public/private 交替确认、成员 nickname/role scaffold、owner/admin editable guard、loading/empty/error first pass；manual/History thumbnail polish、真实 share permission、真实 member persistence 和 server-side pagination 仍待产品化。
- Image Node 导入、Screenshot / Merge Capture、runtime asset migration 已走 server-backed Asset URL；本地未设置 `NEXT_PUBLIC_API_BASE_URL` 时走 Next local bridge，设置后走 FastAPI `/api/v1`。
- `/boards/:boardId` 已有 Board 模式保存状态条、autosave/debounce、dirty warning、load/save error fallback 和刷新/关闭/Back warning；autosave debounce 现在是 1200ms，并保留 no-op dirty 事件去重，避免序列化 document 未变化时重复调用保存 API；Workspace gallery 标题单击打开、双击重命名，画布标题支持双击重命名并使用持久化 `board.title`；`/spikes/canvas` 仍保留 `Save audit` / `Save local` / `Load local` 开发控件。
- `/boards/:boardId` 已有统一 Board History first pass：autosave 成功后写入 `autosave` history entry，Snapshot 按钮写入 `manual` entry，Cmd/Ctrl+S 执行当前 Board save 并写入 `keyboard` entry，History summary list 按时间倒序展示并支持 Restore、all/autosave/user saves 过滤、作者/头像显示和 autosave/user save 视觉区分。免费层默认每个 Board 分别保留 autosave 100 条和 user saves 100 条；后续订阅分层可在 `retentionTier` / `expiresAt` 上扩展。
- `/boards/:boardId` 已有 per-board Canvas Settings first pass：Dots / Grid / Solid background、background/pattern color、spacing、snap strength、zoom sensitivity 等轻量设置会进入 Board document 的 `canvasSettings`，并跟随 Board/History restore。
- FastAPI 现在支持 `/health`、CORS allowlist、Asset upload/read、Board validate/list/save/load/snapshot create/list/load、`s3-compatible` object storage、Postgres Board persistence、Postgres Asset metadata adapter 和 Alembic P0 core schema scaffold；真实 staging server、managed Postgres、R2 bucket、staging domain 和 secrets 尚未接入。
- P0 AI contract first pass 已有 mock Model Registry / AiRun route；真实 AI 调用、AiRun/Postgres log、真实登录/Auth、右侧 AI Chat 产品化仍未完成。
- 未来新增 AI 节点、AI Chat 工具或不同能力 bot 必须遵守 `ARCH.md` 4.4.1 AI Node Extension Contract：节点只保存轻量参数和运行摘要，真实调用由服务端 AiRun / Model Registry / Asset Pipeline 承接。

章节核对快照：

| 章节 | 当前核对结论 |
|------|--------------|
| 1. 产品概述 | P0 定位仍正确：Web-first AI image canvas；当前实现已经证明白板 + 五类节点 + Asset/Board persistence 边界可行。 |
| 2. 功能列表 | 已补当前实现状态；新增 F18 Asset / Board Persistence 作为 P0 blocker。 |
| 3. 用户流程 | 目标流程保留；新增当前 dev/product shell 的偏差说明，尤其是 Auth、Dashboard CRUD、AI Chat 和真实 AI。 |
| 4. 页面清单 | `/workspaces` 与 `/boards/:boardId` 已部分落地；Auth/Landing page/Collection/Settings/Account/Team/Subscription Product Shell route skeleton 已落地并完成语义分离；右侧 AI Chat、Image Editor modal、Preview 弹层仍待开发。 |
| 5. 完成定义 | 保留最终 Done 标准，并补当前状态，避免把 spike/mock 当成 Alpha-ready。 |
| 6. 数据字段与约束 | Board / Asset 已有 local/FastAPI/Postgres/S3-compatible 路径；User/Auth、AiRun、Model Option、Chat 仍是目标 schema。 |
| 7. 错误、加载、空状态 | 作为目标体验保留；当前只覆盖部分 Dashboard、Board save/load、Asset 和 guard 错误。 |
| 8. 不做什么 | 当前边界仍有效：不做桌面、公众号、完整 Mixpanel 级 Admin、完整模型市场、P0 多人协作。 |
| 9. 验收清单 | 新增当前核对结论和 Asset / Board persistence 验收项；详细清单仍作为后续 Alpha gate。 |

---

## 1. 产品概述

### 1.1 这个产品是什么

TANGENT 是一个运行在浏览器里的 AI 图像创作画布。它的主画布首先要像一个轻量 Miro/FigJam：用户可以涂鸦、放图、画箭头、贴便签、框选和自由排布；在这个白板上，AI 能力以节点卡片的形式出现。节点可以越来越复杂，但画布的基本交互必须保持简单。

它把“提示词、参考图/编辑图、单图生成、四图生成、图片承接、图片分析反推提示词、画布标注、合并导出”做成一条非常短的可视化链路，并提供一个右侧 AI 对话栏，用户可以直接用自然语言创建节点、自动连线、解释当前画布或发起生成。

用户不需要理解复杂工作流，也不需要安装桌面客户端。P0 只有两个入口：

1. **手动节点链路**：用户自己添加 Prompt / Image Gen / Image Gen 4 / Analysis / Image 五类节点。
2. **右侧 AI Chat**：用户一句话描述目标，AI 自动创建最小节点链路并连线。

核心体验是：

```text
Prompt Node → Image Gen 4 Node（同一 prompt 调用 4 次）→ Image Node
Image Node + Prompt Node → Image Gen Node（参考 / 编辑 / 融合由 prompt 和 API body 决定）→ Image Node
Image Node + Prompt Node → Analysis Node（默认反推提示词）→ Prompt Node
```

AI Chat 入口对应的最小体验是：

```text
Right AI Chat → 自动创建 Prompt / Image Gen / Image Gen 4 / Analysis / Image → 用户确认或微调 → Run
```

产品主次：

1. **主画布优先**：白板涂画、图片、便签、箭头、框选和自由排布是底座。
2. **AI 节点其次**：节点是画布上的智能卡片，承载模型选择、参数设置、运行状态和结果。
3. **连线规则第三**：P0 只做简单、可校验的图像链路，不做重型工作流引擎。

### 1.2 解决什么问题

| 用户问题 | 产品解法 |
|----------|----------|
| AI 生图工具结果零散，难以继续修改 | 每张图都成为画布上的 Image Node，可继续连接、编辑、导出 |
| 节点工作流太复杂，小白不知道从哪开始 | P0 只保留 5 类核心节点，右侧 AI Chat 可自动创建节点和连线 |
| 生成后想手动画几笔、圈选、标注 | P0 先用 Canvas Markup；Image Editor 作为后置工具 |
| 改完后难以保存成新的图 | Merge Capture 把图片和笔迹合并为新的 Image Node |
| 设计工具太重，AI 工具太散 | 用一个干净画布承载生成、对比、编辑和导出 |
| 不同图片模型入口分散 | Image Gen / Image Gen 4 Node 和 AI Chat composer 内提供简洁模型切换 |

### 1.3 目标用户

#### P0 核心用户

| 用户 | 场景 | 需求 |
|------|------|------|
| 独立创作者 | 生成封面、海报、社媒图 | 快速从 prompt 得到 4 个方向并手动微调 |
| 设计师 / Art Director | 概念探索、视觉参考、风格迭代 | 在画布上对比生成图、圈画修改点 |
| 小型内容团队 | 广告图、产品图、活动视觉 | 用简单节点链路沉淀讨论和改图过程 |

#### P0 不优先的用户

- 专业修图师：P0 不替代 Photoshop。
- 复杂工作流用户：P0 不做 ComfyUI 式复杂图。
- 公众号长文创作者：旧公众号链路冻结。
- 本地离线用户：P0 走 Web。
- 企业私有化客户：P0 不做私有部署。

### 1.4 产品原则

1. **干净优先**：沿用白色大画布、小卡片、轻边框、少按钮的视觉方向。
2. **小白优先**：用户可以通过右侧 AI 对话栏或一个文本节点开始，不需要先学习节点系统。
3. **图像链路优先**：先跑通一条完整图像链路，再加协作、素材库、复杂模型管理。
4. **结果回到画布**：AI 输出、编辑导出、截图合并都必须生成画布上的 Image Node。
5. **不照搬 Tanva**：只参考 `https://github.com/litai12/Tanva.git` 的操作逻辑，如发送到画布、截图合并、坐标转换；不复制复杂代码和技术债。
6. **模型切换要克制**：P0 只在图片生成入口支持切换官方可用图片模型，不做完整模型市场。
7. **对话栏是入口，不是复杂 Agent**：右侧 AI 对话栏用于创建节点、自动连线、辅助 prompt 和触发生图，不做复杂多工具自治执行。
8. **参考图只参考交互形态**：即使参考图里有很多节点、上传菜单或高级参数，P0 只实现最简单的图像创作链路。
9. **节点复杂度要克制**：P0 节点卡片直接承载关键参数、状态和高频操作；不再显示独立左侧 Node Inspector，避免用户在画布和侧栏之间反复筛选信息。
10. **节点不是数据库**：节点可以像一个微型 React App，但只保存 id、短参数和运行摘要；图片、长文本、Provider 响应和日志必须外置。
11. **先证明再扩展**：Step 1.5 必须先验证复杂节点、端口连线、自动布局和合并导出能否在 tldraw-first 架构里稳定成立。
12. **AI 能力按合同扩展**：未来新增 AI 节点或 AI Chat bot 时，先声明节点类型、端口、参数、模型能力、结果形态和失败状态，再接 AiRun；不把 Provider 调用、API Key、原始响应或大 payload 塞进前端节点。

### 1.5 产品验证假设

问题陈述：

- AI 图像创作流程被割裂在 prompt、生图、参考图、手工标注、局部修改、结果管理之间，用户需要在多个工具和文件夹之间来回复制。
- 复杂节点工具能做到强大，但学习成本高；设计白板工具能做到直观，但 AI 图像链路弱。
- TANGENT 的机会是把“白板自由度”和“最小 AI 图像链路”合并，让结果天然可继续比较、连接、标注和导出。

当前证据：

- 用户已多轮反馈工具栏、端口连线、图像粘贴、设置吸附等细节，说明白板交互质量是采用前提。
- S1.5 手测暴露 tldraw arrow 不适合做节点数据线，已转向 Node Runtime SVG edge，说明“节点数据线”和“白板箭头”必须产品上分离。
- Slice E 已证明图片与 Board 可以通过 server-backed Asset、Board guard、FastAPI/S3-compatible/Postgres contract 外置重型数据，为后续真实 AI 和多人协作打底。
- 市场竞品评分、收入估计、评论证据属于外部动态信息；进入正式商业 PRD 前必须单独做 sourced market research，禁止编造数字。

核心价值主张：

> 用一个干净白板，把 prompt、参考图、四图生成、图片分析、手工标注和合并导出串成可视化最短路径。

### 1.6 Alpha 成功指标

P0 Alpha 先验证“能不能用”和“用户是否理解”，不先追求收入最大化。
当前状态：尚未进入 Alpha 用户阶段；这些指标是上线后验收目标。当前开发阶段先用 local/staging smoke、真实 AI 成本测试和 5-10 人内测任务完成率作为前置代理指标。

| 指标 | Alpha 目标 | 说明 |
|------|------------|------|
| Activation | 60% 内测用户创建第一个 Board | 登录后能进入核心场景 |
| First Value | 50% 内测用户跑通 Prompt → Image Gen / Image Gen 4 | 验证最小链路 |
| Canvas Retention | 30% 内测用户次日重新打开 Board | 验证画布保存/继续编辑价值 |
| AI Run Success | 90% P0 AI Run 返回结构化成功/失败 | 不要求全成功，但不能卡死 |
| Cost Guard | Alpha AI 成本在预算熔断内 | 默认低成本参数 + 限流 |
| UX Blockers | 每轮手测阻塞级问题 ≤ 3 个 | 阻塞定义：无法继续链路、卡死、坐标/连线严重错 |

---

## 2. 功能列表

### 2.1 P0 必须有

| 编号 | 功能 | 说明 | 优先级 | 当前状态 |
|------|------|------|--------|----------|
| F01 | Web 登录 | 用户能登录进入 `/workspaces`；P0 可先用现有认证或本地开发模式 | P0 | Product Shell route skeleton + Auth scaffold first pass 已落地；`/login` / `/signup` / `/forgot-password` / `/verify-email` 已有 split-screen mock 表单校验，真实 Auth/session/email 待开发 |
| F02 | Workspace Board 列表 | 创建、打开、重命名 Board | P0 | 部分完成；`/workspaces` 支持 gallery/list / create / open / search / sort / rename / copy / delete / refresh / settings-like Panel metadata / thumbnail placeholder+URL+upload+captured preview+remove default / shape-asset count / `lastOpenedAt` / Load more / loading-empty-error first pass；Board 标题单击打开、双击重命名，Panel 可改标题、描述、卡片颜色、缩略图、star/pin 和 visibility，并展示 owner/created/location/details 与成员管理 scaffold；owner/admin 可编辑，editor/viewer 灰态；card menu 支持 share link、star、pin、make private/public；manual/History thumbnail polish / real member permission / server-side pagination 待补 |
| F03 | Canvas Editor | 无限画布，支持 pan、zoom、选择、拖拽、连线 | P0 | 核心已通过；`/spikes/canvas` 和 `/boards/:boardId` 复用同一 runtime，保存 UX 待产品化 |
| F03.5 | Step 1.5 技术裁决 Spike | 验证复杂节点交互、端口连线、自动布局、Merge Capture、50-100 节点压力；未通过不进入正式节点链路 | P0 Blocker | 已通过 |
| F04 | Prompt Node | 输入 prompt，支持 text 输入端口和 text 输出端口；节点可拖动、复制、删除和四角缩放 | P0 | 原型已实现，需随正式 Board/AI flow 收口 |
| F05 | Image Gen Node | 接收 text 和 0-N 个 image 输入，生成 1 张 Image；支持模型、分辨率和比例参数 | P0 | mock 数据流 + mock AiRun contract 已实现，真实 AI Run/provider 待开发 |
| F06 | Image Gen 4 Node | 接收 text 和 0-N 个 image 输入，同一 prompt 调用 4 次，返回 4 张 Image 结果 | P0 | mock 四图链路 + mock AiRun contract 已实现，真实四图生成待开发 |
| F07 | Analysis Node | 接收 image 和 prompt，内置默认分析 prompt，输出 text，用于反推提示词 | P0 | mock 数据流 + mock AiRun contract 已实现，真实 Analysis provider path 待开发 |
| F08 | Image Node | 无运算功能，只承接和预览上游图片 Asset；支持四角缩放、查看、下载、发送到画布 | P0 | 核心已实现；导入、预览、To Canvas、LOD 和 Asset URL 已落地，Preview/Download polish 待补 |
| F09 | Canvas Markup | Image Node 可发送为画布图片对象，用户可在其上绘制标注 | P0 | 已实现基础链路 |
| F10 | Merge Capture | 选中图片和笔迹，离屏合并成新 Image Node | P0 | 已实现基础链路，输出走 server-backed Asset |
| F11 | 右侧 AI Chat 对话栏 | 侧边栏对话，用户一句话生成 Prompt / Image Gen / Image Gen 4 / Analysis / Image 节点和连线 | P0 | 待产品化；当前只有 mock planner / 节点自动布局能力基础 |
| F12 | AI Proxy 调用 | 前端不暴露 API Key，由服务端调用生图模型 | P0 | 待开发；Provider key 仍未接入 |
| F13 | API 调用日志 | 记录用户、Board、模型、参数、状态、耗时、费用 | P0 | mock AiRun contract 已实现；Postgres AiRun / ApiCallLog 持久化待开发 |
| F14 | 加载 / 空 / 错误状态 | 所有核心流程有明确状态反馈 | P0 | 部分完成；Workspace Board gallery / Board persistence / Asset guard 有基础反馈，Alpha 级状态待补 |
| F15 | 图片模型切换 | Image Gen / Image Gen 4 Node 和 AI Chat 输入区可选择 P0 图片模型 | P0 | Image Gen / Image Gen 4 下拉已读 mock Model Registry；AI Chat composer 待接 |
| F16 | i18n 基线 | P0 UI 默认英文，保留中文开发文案能力 | P0 | 待系统化；当前仍有开发态英文硬编码 |
| F17 | 节点卡片自包含控制 | 节点关键参数、运行状态和高频操作留在节点卡片内；P0 不显示独立左侧 Node Inspector | P0 | 当前已移除独立 Node Inspector，左侧只保留绘图属性栏 |
| F18 | Asset / Board Persistence | 图片必须以 Asset 引用进入 Board document；Board 可保存、加载、列表，guard 阻止 `data:` / `blob:` / Base64 | P0 Blocker | 部分完成；local/FastAPI/S3-compatible/Postgres contract 已落地，Board document 已包含轻量 `canvasSettings`，真实 staging 资源待补 |
| F19 | Board History | Autosave、Snapshot 按钮、Cmd/Ctrl+S 都进入同一 History 时间线，并支持 History 列表、过滤、作者显示和恢复 | P0 | first pass 已实现；Next local bridge、FastAPI local-dev 和 FastAPI Postgres 均有 history create/list/load；免费层默认 autosave 100 + user saves 100 分桶保留，订阅分层和长期冷存储待后续 |
| F20 | Smart Drawing | 用户用画笔画出近似直线、曲线、圆、矩形、三角形等时，系统可本地拟合为标准线条/形状 | P0.5 polish | first pass 已接入；本地几何识别和可撤销转换就位，不接 AI provider |

### 2.2 P0.5 / P1 将来再说

| 功能 | 说明 | 阶段 |
|------|------|------|
| 多人协作 | Presence、多人光标、实时同步 | P0.5 |
| 分享链接 | 邀请他人查看或编辑 Board | P0.5 |
| Personal Assets / Library | 素材库、历史图、标签 | P1 |
| 专业 Image Editor | 多图层、选择变换、局部 AI 编辑、历史栈 | P1 |
| 高级模型市场 | 完整模型价格、能力、排序、收藏、fallback UI | P1 |
| Admin S0 access boundary | 管理员角色、审计日志、用户备注、`/admin` shell 和用户管理 MVP；真实 Auth 前只能作为 scaffold | P0.5/P1 |
| Smart Drawing polish | 手绘线条/形状识别、拟合和一键撤销 | first pass 已接入，前端闸门和 recognizer smoke 已通过，待浏览器 smoke / 阈值调优 |
| Full Admin Analytics | 漏斗、留存、收入、内容审核大屏 | P1/P2 |
| 支付订阅 | Stripe 订阅、额度购买 | P1 |
| 高级版本历史 | Pro/Enterprise 长期历史、diff preview、按订阅恢复范围和冷存储 | P1 |
| 团队 Workspace | 多成员权限、团队计费 | P1 |
| 移动端 | iOS / Android | P2 |
| 桌面客户端 | Tauri app | 冻结，非本版本 |

### 2.3 MoSCoW 优先级

| Must | Should | Could | Won't in V1 |
|------|--------|-------|-------------|
| 登录 / Board / Canvas | Settings 面板、吸附偏好、Smart Drawing | 个人素材库轻入口 | 桌面客户端 |
| Prompt / Image Gen / Image Gen 4 / Analysis / Image | AI Chat 自动搭链 | 分享只读链接 | 公众号 Html Editor |
| Node Runtime edge + 类型校验 | Analysis 结果接回 Prompt | 高级版本历史 | Writer / Knowledge Graph |
| Asset / Board persistence，禁止 Base64 入文档 | Canvas Markup + Merge Capture | Admin S0 用户/成本只读视图 | 复杂 Mixpanel 级 Admin Analytics |
| 后端 AI Proxy 和 API Logs | Model Registry 能力 schema | Stripe 测试购买 | 完整模型市场 |
| 安全限流和成本熔断 | 图片压缩/缩略图/懒加载 | P0.5 Presence | 多人实时协作 P0 |

当前 MoSCoW 核对：

- Must 中的 Canvas、Node Runtime、Image Node、Merge Capture、Asset / Board persistence contract 和 P0 Board History first pass 已进入可验证状态。
- Must 中的 Auth、真实 AI Proxy、API Logs、成本熔断和 Alpha 级状态反馈仍是后续 P0 blocker。
- Should 中的 Settings / Snap 已在 spike 中实现；AI Chat 自动搭链和 Model Registry 仍待进入真实服务端路径。

### 2.4 用户故事

1. 作为独立创作者，我想在画布中输入 prompt 并生成 4 张图，这样我能快速比较方向。
2. 作为独立创作者，我想把满意结果变成 Image Node，这样我能继续编辑和复用。
3. 作为设计师，我想把参考图连到 Image Gen，这样我能基于现有视觉做变体。
4. 作为设计师，我想在生成图上画圈和标注，这样我能表达修改意见。
5. 作为设计师，我想把图片和笔迹合并成新图，这样我能保存修改稿。
6. 作为内容团队成员，我想用 Analysis 反推提示词，这样我能从好图得到可复用描述。
7. 作为新用户，我想通过右侧 AI Chat 创建节点链路，这样我不用先学习节点系统。
8. 作为创作者，我想在 History 里看到 autosave 和自己保存的关键节点，这样误删、错误实验或恢复旧方案时不会只能依赖最新 autosave。
8. 作为新用户，我想看到非法连线被明确拒绝，这样我能理解 text/image 数据类型。
9. 作为重度画布用户，我想调整吸附距离和网格大小，这样我能更快排版。
10. 作为创作者，我想一个 prompt 同时连接多个生成节点，这样我能并行比较模型或参数。
11. 作为创作者，我想 Image Gen 4 的 4 个结果各有输出端口，这样我能单独处理每张图。
12. 作为用户，我想刷新后恢复 Board，这样我不会丢失创作过程。
13. 作为用户，我想生成失败时看到可重试错误，这样我知道是模型、余额还是网络问题。
14. 作为平台维护者，我想记录 AI Run 的模型、耗时、费用和状态，这样我能控制成本。
15. 作为平台维护者，我想所有图片先变成 Asset 引用，这样协作和保存不会因为大文件卡死。
16. 作为未来团队用户，我想看到他人光标和选区，这样我们能协作讨论同一个 Board。
17. 作为管理员，我想能禁用昂贵或异常模型，这样 Alpha 成本不会失控。
18. 作为开发者，我想每个切片有明确验收清单，这样接班 AI 不会把范围做散。
19. 作为用户，我想刷新或换设备后还能打开同一个 Board，并看到图片、节点、连线和相机位置都恢复，这样创作过程不会丢。
20. 作为平台维护者，我想保存前阻止 `data:` / `blob:` / Base64 图片进入 Board document，这样后续协作、备份和迁移不会被大文件拖垮。
21. 作为平台 owner，我想把某个已注册用户授予 admin/support/finance 等后台权限，这样团队可以分工管理用户、成本和内容风险。
22. 作为客服或管理员，我想给用户添加内部备注并查看该用户的 Boards、积分、AI 调用和会员状态，这样排查问题时不用直接查数据库。
23. 作为平台维护者，我想所有后台敏感操作都有审计日志，这样封禁、积分调整、模拟用户和权限变更都可追溯。
24. 作为运营者，我想未来的漏斗、留存、收入和模型成本图表都来自服务端事件和账本，而不是前端临时统计，这样数据能用于真实决策。
25. 作为白板用户，我想随手画一条歪线、圆或矩形时能自动整理成干净的线条或形状，这样标注和排版更像专业白板工具。

---

## 3. 用户流程

### 3.1 首次进入产品

当前状态：正式 Auth / 注册 / 邮箱验证尚未实现；本地和 FastAPI 仍通过 dev request context / headers fallback 使用 `dev-user` / `dev-workspace`。下面是 P0 Alpha 目标流程，不代表当前已经上线。

```text
用户访问 Web App
  → 如果未登录，进入 Login 页面
  → 输入邮箱 / 使用 Google 登录
  → 登录成功
  → 进入 Workspace Board gallery
  → 如果没有 Board，显示空状态和 New Board 按钮
  → 点击 New Board
  → 进入 Canvas Editor
```

#### 登录成功后看到什么

- 顶部显示产品名和用户头像。
- 主区域显示 Board 列表。
- 新用户显示空状态：`No boards yet. Create your first AI image canvas.`
- 主要按钮：`New Board`。

#### 登录失败显示什么

- 邮箱格式错误：输入框下方显示 `Enter a valid email address.`
- 验证码错误或 OAuth 失败：页面顶部 toast 显示 `Login failed. Please try again.`
- 网络错误：toast 显示 `Network error. Check your connection and retry.`

### 3.2 创建 Board

当前状态：`/workspaces` gallery 已可生成 `board-<timestamp>` 并跳转 `/boards/:boardId?new=1`，也可从保存列表打开已有 Board；Search、Sort、Rename、Copy、Delete、settings-like Panel description/card color/thumbnail upload/remove/star/pin/visibility/share/details/member scaffold、保存时 captured thumbnail、`lastOpenedAt` 最近打开排序和 Load more 已接 local/FastAPI Board contract；owner/admin 可编辑的权限态已进入 UI contract，editor/viewer 灰态等待真实权限源；manual/History thumbnail polish、真实 share/member permission、server-side pagination 和 Alpha 级状态 polish 仍待产品化。

```text
用户在 Workspace Board gallery 点击 New Board
  → 系统创建 Board
  → 默认标题为 Untitled Board
  → 自动跳转 Canvas Editor
  → 当前视野中央显示空画布引导
```

空画布引导：

- 主文案：`Start with a text prompt.`
- 次文案：`Create a Prompt Node, connect it to Image Gen 4, and generate 4 image options.`
- 快捷按钮：`Add Prompt Node`、`Ask AI to build it`。
- 右侧 AI Chat 对话栏默认收起或轻量显示欢迎语：`What would you like to create today?`。

### 3.3 手动最小链路

当前状态：Prompt / Image Gen / Image Gen 4 / Analysis / Image 五类节点、端口连线、fan-out、input replacement 和 mock 数据流已在 canvas runtime 中通过；mock Model Registry / AiRun contract 已接入节点 Run；真实 provider、成本/日志和 provider result 入 Asset 尚未接入。

```text
Canvas Editor 空白状态
  → 用户点击 Add Prompt Node
  → Prompt Node 出现在当前视野中央
  → 用户输入 prompt
  → 用户添加 Image Gen 4 Node
  → 用户从 Prompt Node 输出端连到 Image Gen 4 输入端
  → Image Gen 4 Node 的 Run 按钮可点击
  → 用户点击 Run
  → 节点进入 loading 状态
  → 生成成功后显示 4 张结果
  → 用户点击一张结果
  → 系统在右侧创建 Image Node
```

### 3.3.5 Step 1.5 技术裁决 Spike 流程

这一步不是正式用户功能，而是进入正式节点开发前必须通过的可手测技术门。当前状态：已通过，并沉淀为 `/spikes/canvas` 与 `/boards/:boardId` 共用的 canvas runtime 基线。

```text
打开 /spikes/canvas
  → 画布中出现 Prompt / Image Gen / Image Gen 4 / Analysis / Image 原型
  → 用户在节点内选择模型、修改参数、点击 Run
  → 节点内部交互不触发画布拖拽或缩放
  → 用户从 Prompt Node 端口连接到 Image Gen / Image Gen 4 Node
  → 用户从 Image Node 连到 Image Gen / Image Gen 4 / Analysis 的 image 端口
  → 合法连线保留，非法连线自动断开并提示
  → AI Chat 或 mock planner 插入 3-4 个节点
  → 节点自动排布到当前视野中，不重叠
  → 用户选中图片、笔迹和形状，尝试 Merge Capture
  → 输出纯净图片，不包含 UI、选框、网格
```

通过条件：

- tldraw 可继续作为主画布底座。
- 复杂节点、端口、自动布局、导出任一项不可接受时，暂停正式开发，评估 React Flow + Konva 或 tldraw + 独立节点层。当前无需切换。

### 3.4 Image Editor 绘图导出（后置工具）

当前状态：专业 Image Editor modal 仍后置；P0 当前已先实现 Image Node 导入、Image Node → canvas image、canvas image → Image Node、Screenshot / Merge Capture → Image Node 的轻量闭环。

```text
用户选择 Image Node
  → 打开 Image Editor 工具/面板
  → 打开 Image Editor
  → 用户使用画笔绘制
  → 点击 Export to Image Node
  → 编辑器关闭或保持打开
  → 画布上生成新的 Image Node
```

导出成功反馈：

- 新 Image Node 出现在原节点右侧或当前视野附近。
- toast：`Exported as a new image node.`
- 新节点默认选中，方便继续连接。

### 3.5 发送到画布并合并截图

当前状态：Send / To Canvas、Screenshot、Merge Capture 到 Image Node 已在 canvas runtime 中实现，并会先写入 server-backed Asset URL；正式产品还需要把按钮文案、空状态、失败重试和保存提示收口。

```text
用户在 Image Node 点击 Send to Canvas
  → 图片成为可拖拽的画布图片对象
  → 用户选择画笔工具
  → 在图片上绘制标注或修改
  → 用户框选图片和相关笔迹
  → 点击 Merge to Image
  → 系统离屏渲染选区
  → 生成新的 Image Node
```

合并成功反馈：

- 新 Image Node 出现在选区右侧。
- toast：`Merged selection into a new image node.`
- 原图片和笔迹不删除，用户可以对比前后结果。

### 3.6 右侧 AI Chat 自动搭线

当前状态：mock planner / 自动布局能力已经验证，但右侧 AI Chat 侧边栏、Chat composer、服务端 planner API 和真实确认后 Run 流程尚未产品化。

```text
用户打开空白 Canvas
  → 打开或聚焦右侧 AI Chat 侧边栏
  → 在 AI Chat 输入：
    "Create a workflow to generate 4 cat poster ideas and edit the best one."
  → 点击 Send
  → AI Planner 返回 graph spec
  → 前端校验节点类型和连线规则
  → 自动创建 Prompt Node、Image Gen 4 Node、Image Node 或 Analysis Node
  → 自动连线并布局到当前视野
  → Prompt Node 中填入 prompt 草稿
  → 用户点击 Run 或修改 prompt 后再 Run
```

AI Chat 侧边栏显示规则：

- 右侧固定侧边栏宽度约 320-380px，可收起。
- 顶部显示新建会话、历史/重置、关闭按钮和简短统计。
- 中部显示用户消息和 AI 回复。
- 底部 composer 支持输入文字、选择模式、选择图片模型、上传图片入口。
- Canvas 中可以保留一个底部轻量 composer，但 P0 以右侧对话栏为主入口。

AI Chat 失败：

- Planner 超时：显示 `AI planner timed out. Try a shorter request.`
- 返回无效节点：显示 `I could not build a valid workflow. Try describing the image you want.`
- 不创建半坏状态；如果 graph 校验失败，不写入画布。

---

## 4. 页面清单

### 4.1 Login 页面

| 项 | 内容 |
|----|------|
| 路径 | `/login` |
| 当前状态 | Product Shell route skeleton 和 Auth scaffold first pass 已落地；使用 mock 表单校验，不应视为真实登录 |
| 作用 | 用户登录或注册 |
| 主要内容 | Full-screen split-screen Auth surface、编辑式说明、邮箱输入、mock 密码/验证码校验、错误/成功提示 |
| 空状态 | 无 |
| 成功跳转 | `/workspaces` |
| 失败反馈 | 输入框错误或 toast |

相关本地壳页面：

- `/signup`
- `/forgot-password`
- `/verify-email`
- `/workspaces` 和 `/dashboard` redirect
- `/home`
- `/collections`
- `/settings`
- `/account`
- `/team`
- `/billing`

### 4.2 Workspace / Boards 页面

| 项 | 内容 |
|----|------|
| 路径 | `/workspaces` |
| 当前状态 | 已有 first-pass product surface；支持 Board gallery/list、New board、Open、Search、Sort、Rename、Delete、Refresh、thumbnail placeholder/URL/upload、shape/asset count、`lastOpenedAt`、Recently opened / Recently saved sort、Load more、Board Management metadata/menu actions/member scaffold、loading/empty/error first pass；`/boards` 列表入口重定向到该页面 |
| 作用 | 管理 Board |
| 主要内容 | Board gallery/list、New Board、搜索、排序、最近打开时间 |
| 空状态 | `No boards yet` + `New Board` |
| 加载状态 | Skeleton board cards |
| 错误状态 | `Could not load boards. Retry` |
| 待补 | Manual/History thumbnail polish、server-side pagination、Alpha 级空/错/加载 polish |

### 4.3 Canvas Editor 页面

| 项 | 内容 |
|----|------|
| 路径 | `/boards/:boardId` |
| 当前状态 | 已有 entry shell；复用 canvas runtime，可按 board id auto-load，Board 模式有 autosave/debounce、保存状态条和 Board History first pass，同一 persistence contract 可切 local/FastAPI |
| 作用 | 核心画布编辑 |
| 主要内容 | 无限画布、节点、图片对象、笔迹、连线、Excalidraw-like 统一工具层、右侧 AI Chat 侧边栏、左侧固定绘图属性栏、可选底部轻量输入框 |
| 空状态 | 中央引导 + Add Prompt Node / Ask AI |
| 加载状态 | Canvas skeleton + loading overlay |
| 错误状态 | Board 不存在、无权限、网络错误 |
| 待补 | Canvas 空状态、真实权限错误页、长时浏览器回归和更完整 load failure UI |

### 4.4 Node Picker 弹层

| 项 | 内容 |
|----|------|
| 触发 | 双击画布、快捷键、工具栏 Add |
| 当前状态 | 已在 canvas runtime 中实现分类 Node Picker |
| 作用 | 添加核心节点 |
| 主要内容 | Prompt、Image Gen、Image Gen 4、Analysis、Image；参考图中的节点列表只取最小图像链路，不显示视频/音频/3D 等复杂节点 |
| P0 约束 | 不展示旧节点分类，不展示复杂模型节点；参考图中如有视频、音频、PDF、3D 等节点也不进入 P0 |
| 空状态 | 无 |

### 4.5 右侧 AI Chat 侧边栏

| 项 | 内容 |
|----|------|
| 位置 | Canvas 右侧，可收起；P0 可保留底部轻量 composer 作为快捷入口 |
| 当前状态 | 待产品化；当前只有 mock planner 能力基础和设置项，不是正式右侧 Chat |
| 作用 | 一句话创建节点链路、辅助 prompt、解释当前画布、触发生图 |
| 主要内容 | 会话标题/统计、用户消息、AI 回复、底部 composer、图片模型选择、图片上传入口、Send |
| 空状态 | `What would you like to create today?` + 2-3 个 prompt 建议 |
| 加载状态 | AI 回复区显示 `Thinking...` 或 `Building workflow...` |
| 错误状态 | inline error 或 toast |
| P0 约束 | 不做复杂 Agent、不做长历史管理、不做视频/音频/3D 生成 |

### 4.5.1 AI Chat Composer

| 项 | 内容 |
|----|------|
| 当前状态 | 待开发；后续必须接 Model Registry 和 planner/AI Run API |
| 输入框 | placeholder：`Describe what you want to create...` |
| 模式 | P0 支持 `Auto` / `Image`，默认 `Auto` |
| 模型 | P0 只显示可用图片模型，如 `gpt-image-2`、`gemini-3.1-flash-image-preview` |
| 数量 | P0 默认 `4`，可显示为固定值或轻量下拉 |
| 图片参数 | P0 可显示 `Auto`、`1:1`、`4:3`、`16:9`、`0.5K/1K/2K/4K` 或模型支持的 size；实际可用项按模型能力过滤 |
| 上传 | P0 支持上传图片入口作为后续 Image Node 输入；PDF、视频、音频、3D 上传不进入 P0 |
| 发送 | prompt 为空时禁用；请求中显示 loading |

### 4.5.2 左侧绘图属性栏

| 项 | 内容 |
|----|------|
| 位置 | Canvas 左侧；右侧保留给 AI Chat |
| 当前状态 | 固定侧拉绘图属性栏已保留；独立 Node Inspector 已从 P0 产品路径移除 |
| 作用 | 编辑普通绘图对象、图片、箭头、文本和 markup 的样式 |
| 主要内容 | 描边、填充、线宽、线型、箭头端点、字体、透明度、图层、对齐和基础操作 |
| 空状态 | 未选中可编辑绘图对象或选中节点时显示绘图属性空状态 |
| P0 约束 | 节点参数、运行状态和高频操作留在节点卡片内；不显示独立左侧 Node Inspector |

### 4.6 Image Editor 屏幕 / Modal

| 项 | 内容 |
|----|------|
| 触发 | Image Node → Open Editor / Edit |
| 当前状态 | P0 后置；当前用 Canvas Markup + Merge Capture 覆盖最小编辑导出 |
| 作用 | 对输入图片进行轻量绘图并导出 |
| 主要内容 | 画布、画笔、橡皮、颜色、笔刷大小、清空、Export、Close |
| 空状态 | 没有输入图时显示 `Connect an image node first.` |
| 加载状态 | 图片加载 skeleton |
| 错误状态 | 图片加载失败、导出失败 |

### 4.7 Image Preview 弹层

| 项 | 内容 |
|----|------|
| 触发 | 双击 Image Node 或缩略图 |
| 当前状态 | 待 polish；Image Node 预览已存在，大图弹层/下载/复制 URL 仍需产品化 |
| 作用 | 查看单张图 |
| 主要内容 | 大图、下载、复制 URL、关闭 |
| 错误状态 | 图片加载失败显示占位 |

---

## 5. 每个功能的完成定义

本节是 Alpha-ready 的最终完成定义；当前实现状态以 2.1 表格为准。已经在 spike 中跑通的能力，只有在进入 `/workspaces` / `/boards/:boardId` 产品入口、通过 persistence guard、具备错误/加载反馈，并完成对应质量门后，才算该功能 Alpha-ready。

### F01 Web 登录

完成定义：

- 未登录访问 `/boards` 或 `/boards/:boardId` 会跳转 `/login`。
- 邮箱格式不合法时，提交按钮不可继续或显示字段错误。
- 登录成功后跳转 `/boards`。
- 登录失败显示明确错误，不清空用户已输入邮箱。
- 登录中按钮显示 loading，不允许重复提交。

### F02 Workspace Board 列表

完成定义：

- 加载中显示 skeleton。
- 无 Board 显示空状态和 New Board 按钮。
- 有 Board 显示名称、更新时间、缩略图占位和 shape/asset 计数。
- 点击 New Board 创建 Board 并跳转 Canvas。
- 重命名为空时不允许保存；最长 80 字符。
- Board Management Panel 是 settings-like 居中管理面板；顶部放 Copy link / Invite / Open，可编辑 title、description、card color、thumbnail URL/upload/remove、star/pin、private/workspace/public visibility，并显示 owner、created、last modified、location、objects。
- Board card 三横线菜单提供 share link、open in new tab、star/unstar、pin/unpin、rename、copy、details、make private/public 和 delete。
- Team/member 管理在真实 Auth/Board members 前只展示 nickname、email、role、access scaffold，不执行真实邀请或权限修改。
- 加载失败显示 Retry。

### F03 Canvas Editor

完成定义：

- 打开 Board 后显示可 pan/zoom 的画布。
- 画布对象在 50% / 100% / 200% 缩放下点击、拖动、框选不偏移。
- resize 浏览器窗口后对象位置不漂移。
- 工具入口不分散到默认左上/右上/底部多套 UI，优先使用统一、克制、接近 Excalidraw 的顶部图标工具栏。
- 顶部工具栏按类别收纳：形状按钮默认使用上次选择的形状，点击弹出矩形、菱形、圆、三角、云等选择；箭头和直线必须是独立图标，箭头入口只负责画箭头；插入类入口收纳便签、Frame、图片、链接卡片和 AI 卡片。
- 顶部工具栏必须保留基础白板能力：选择、平移、形状、箭头、线条、画笔、文本、橡皮、便签、Frame、图片、链接卡片和 AI 卡片入口。
- 画布 Settings 面板可调整单个 Board 的 Background（Dots / Grid / Solid）、background color、pattern color、spacing、Snap Alignment、Snap Strength、Zoom Sensitivity、Edge Color 和 AI Chat Style；Dots/Grid 必须在画布背景层，不能浮在绘图元素上方；Dots 背景必须是很小、低对比度的细点，不喧宾夺主。
- Board 模式下 Canvas Settings 写入 Board document 的轻量 `canvasSettings` 字段，并进入 autosave / History；dev spike 模式仍可保存为本机浏览器默认值。
- 左下角保留导航地图：显示当前画布缩略范围、viewport 框、缩放百分比、Zoom In / Zoom Out 控制，点击地图位置可跳转到对应画布区域。
- 箭头连接吸附接近 Excalidraw：矩形、圆形、Frame、图片和卡片优先吸附到边的中点；三角形、菱形优先吸附到角点；箭头工具靠近对象时，对象轮廓和候选捕捉点要预高亮；拖拽时 source / target 的捕捉点要可见高亮；不能默认只吸到形状中心。
- 左侧属性面板只在选中对象且没有拖动画布时出现，用于最后选中/最后创建图形的属性编辑，包含描边、填充、宽度、线型、线条风格、箭头类型、端点、字体、透明度、对齐、图层和基础操作；样式选项优先使用清晰图标，不用大段文字按钮。
- 绘制类按钮左键进入单次绘制；画完后默认回到 Select，并选中最后创建的图形。
- 绘制类按钮右键进入连续绘制；连续绘制不能表现为“画布锁定”，不暴露 Lock 按钮；Esc 必须立即退出，退出后选中本轮新增图形，点击空白处取消选择。
- 卡片缩小后文本必须自适应裁切或折叠，不能溢出边界。
- 连续粘贴多张外部大图时必须有限制或提示，不能让页面长时间卡死。
- 空画布显示引导。
- 画布加载失败显示可返回 Workspace 的错误页。

### F03.5 Step 1.5 技术裁决 Spike

完成定义：

- `/spikes/canvas` 内可以创建 Prompt / Image Gen / Image Gen 4 / Analysis / Image 五类 `node_card` 原型。
- 节点内部模型下拉、参数输入、Run 按钮、滚轮操作不会触发画布拖拽或缩放。
- 节点端口可视，合法连线可保留，非法连线自动断开并给出轻提示。
- text 端口和连线使用黄色，image 端口和连线使用绿色。
- Image Gen / Image Gen 4 的 image input 支持动态端口：每连入一张 image，自动多显示一个空 image 输入端口，P0 上限 6 个。
- 用户点击 node-node 数据线后，该 edge 进入选中态，并在下游 target 端附近显示 `−` 断开按钮；hit 区不能遮挡端口重新连线。
- mock AI Planner 可插入 3-4 个节点并自动排布到当前视野，节点不重叠。
- Merge Capture 能对图片、笔迹和形状输出纯净图片，不包含 UI、选框、网格。
- 50-100 个节点压力测试下，拖拽和缩放没有明显卡顿。
- 如果任一关键项失败，不进入 F04-F11 正式节点链路开发。

### F03.6 Smart Drawing

完成定义：

- Smart Drawing 是画布工具层的本地几何识别功能，不调用 AI provider，不产生服务端费用。
- 用户可通过 Canvas Settings 的 Smart Drawing toggle 开启/关闭；关闭时保持原始 tldraw draw 行为。
- 用户松开鼠标/触控笔后再进行识别，不在拖动画笔时频繁重算导致卡顿。
- 近似直线可拟合为 line shape；近似开放曲线可拟合为 cubic line；近似圆/椭圆可拟合为 ellipse；近似矩形可拟合为 rectangle；近似三角形可拟合为 triangle。菱形后续再补。
- 平滑但不符合标准形状的笔迹可以保留为 draw shape 或转为平滑曲线；第一版不强制识别复杂图标、箭头或手写文字。
- 拟合结果必须是普通 tldraw shape，进入 Board document 的仍是轻量形状数据；不保存识别采样大 payload。
- 转换必须可 undo；误识别时用户能还原原始笔迹或关闭 Smart Drawing。
- 不影响 Node Runtime edge、白板 arrow 吸附、Merge Capture 和 Board History。

### F04 Prompt Node

完成定义：

- 可添加到当前视野中央。
- Prompt 输入可编辑、自动保存到画布状态。
- 左侧有 text 输入端口，右侧有 text 输出端口。
- text 输出端口允许 fan-out，可同时连接多个 Image Gen / Image Gen 4 / Prompt text 输入。
- 空 prompt 时输出端仍存在，但连接到 Image Gen / Image Gen 4 后 Run 按钮不可用或显示提示。
- 文本最长 4,000 字符，超过显示计数和错误。
- 支持复制、删除、拖动和四角缩放。

### F05 Image Gen Node

完成定义：

- 连接 Prompt Node 后读取 prompt。
- 支持一个 text 输入端口和多个 image 输入端口；未连接 image 时按纯文生图处理。
- 每连入一个 image 输入，就自动增加一个新的空 image 输入端口；P0 默认最多 6 个 image 输入。
- image 输出端口允许 fan-out，可把同一张图作为多个下游节点的参考图。
- image 输入用于参考图、编辑图或融合图，具体 API 请求体后续按 Provider 能力补齐；P0 由 prompt 和后端逻辑决定请求模式。
- 未连接 text 或 prompt 为空时显示 `Connect a prompt first.`。
- 节点内提供图片模型选择，下拉只展示 P0 可用图片模型。
- 选择不同模型后，参数选项按模型能力变化。
- 支持分辨率和模型支持的比例参数；P0 所需参数直接在节点卡片内显示和编辑。
- 节点内交互不会误触发画布拖拽、框选或缩放。
- 点击 Run 后进入 loading 状态，显示 1 个生成占位。
- 成功后生成 1 个 image 输出，可承接为 Image Node。
- 失败时显示错误和 Retry，不生成空 Image Node。
- 重复 Run 会保留上一轮结果直到新结果成功，避免画布突然清空。

### F06 Image Gen 4 Node

完成定义：

- 参数和端口规则与 Image Gen Node 一致。
- 同一个 prompt 调用 4 次生成接口，返回 4 张图。
- 成功后在节点内以 2×2 结果态显示 4 张图。
- 右侧提供 4 个 image 输出端口：Asset 1 / Asset 2 / Asset 3 / Asset 4，每个端口只传对应结果。
- 每张结果都可以创建独立 Image Node。
- 失败时显示具体失败状态，已成功图片不被清空。

### F07 Analysis Node

完成定义：

- 接收 image 输入和可选 prompt/text 输入。
- 节点内预设一个 prompt 文本框，默认值为：`分析这个图片，反推提示词`。
- 支持在节点卡片内编辑 analysis prompt。
- 输出 text，可连接到 Prompt Node 或 Image Gen / Image Gen 4 的 text 输入。
- 后续真实实现时，长分析结果不进入 `shape.props`，只保存 result/run 引用和短摘要。

### F08 Image Node

完成定义：

- 可从 Image Gen、Image Gen 4、上传、编辑器导出、合并截图创建。
- 没有运算功能，只作为上游图片 Asset 的预览和承接节点。
- 显示图片预览、标题/来源、基础操作按钮。
- 支持四角缩放以更好显示图片。
- 支持双击预览。
- 支持 Download。
- 支持 Send to Canvas。
- 图片加载失败显示破图占位和 Retry。

### F08.5 Image Editor Tool（P0 后置，不作为当前节点）

完成定义：

- P0 当前节点集合不包含 Image Editor Node；编辑能力先作为后续工具/面板进入。
- 打开后显示输入图片。
- 画笔可绘制，橡皮可擦除笔迹。
- 可调整颜色和笔刷大小。
- Export 只包含图片和绘制内容，不包含 UI、网格、选框。
- 导出失败显示错误，不关闭编辑器。
- Close 前保存当前编辑状态；重开不丢。

### F09 Canvas Markup

完成定义：

- Image Node 点击 Send to Canvas 后，图片对象出现在当前视野附近。
- 图片对象可拖动、缩放。
- 画笔笔迹与图片坐标对齐，缩放后不偏移。
- 画布笔迹可选择、删除。

### F10 Merge Capture

完成定义：

- 用户选中图片对象和相关笔迹后，显示 Merge to Image。
- 合并使用选区 world bounds 离屏渲染。
- 输出 PNG 创建新 Image Node。
- 不截入 UI 控件、选择框、网格。
- 没有选中可合并对象时按钮不可用。

### F11 右侧 AI Chat 对话栏

完成定义：

- Canvas 右侧显示可收起的 AI Chat 侧边栏。
- 空状态显示欢迎语和 2-3 个建议 prompt。
- 用户输入自然语言后，能生成 Prompt / Image Gen / Image Gen 4 / Analysis / Image 节点。
- 节点自动连线。
- 节点出现在当前视野，不跑到画布远处。
- Planner 返回非法 graph 时不修改画布，并显示错误。
- 用户可以撤销 AI 创建的节点组。
- Composer 内可选择图片模型；选择后会影响自动创建的 Image Gen / Image Gen 4 Node。
- 上传图片入口可见，但 P0 只要求图片上传，PDF/视频不进入 P0。
- AI Chat 展开/收起后，画布 resize 不导致对象位置、选择框或连线漂移。
- AI Chat 内滚轮、输入框点击、下拉选择不会触发画布 zoom、pan 或选中对象。

### F12 AI Proxy 调用

完成定义：

- 前端不包含任何真实 Provider API Key。
- 生图请求必须发到后端。
- 后端校验用户、余额、模型可用性。
- 成功返回图片 Asset URL。
- 失败返回结构化错误码。

### F13 API 调用日志

完成定义：

- 每次 Run 创建一条日志。
- 日志包含 user、board、node、provider、model、endpoint、params、status、latency、cost。
- 失败日志包含 error_code 和 message。
- 如果失败不扣费，日志标记 refunded 或 no_charge。

### F14 状态反馈

完成定义：

- 所有网络请求有 loading。
- 所有空列表有空状态。
- 所有失败有明确错误文案和可重试动作。
- 删除操作有确认或可撤销。

### F15 图片模型切换

完成定义：

- Image Gen / Image Gen 4 Node 内可打开模型选择下拉。
- AI Chat composer 内可打开模型选择下拉。
- P0 至少支持 `gpt-image-2` 和 `gemini-3.1-flash-image-preview` 两个显示项；真实可用性由后端返回。
- 模型显示包含名称、能力标签和预计耗时/成本提示中的至少一种。
- 禁用或不可用模型显示 disabled 状态，不允许提交。
- 切换模型后，生成请求携带 `selected_model_id` 或 `model_role`。

### F16 i18n 基线

完成定义：

- P0 默认英文。
- 中文开发环境显示中文时，不混入英文业务文案。
- 所有用户可见文案走 i18n key，不在组件里散落硬编码。

### F17 节点卡片自包含控制

完成定义：

- 选中节点后不显示独立左侧 Node Inspector。
- Prompt / Image Gen / Image Gen 4 / Analysis / Image 的 P0 关键参数在节点卡片内可见。
- Image Gen / Image Gen 4 Node 的模型、尺寸、质量、比例等参数按 Model Registry 能力过滤。
- 节点卡片内输入框、下拉和按钮不会触发画布 pan/zoom。
- 修改参数后节点摘要同步更新；若未来参数膨胀，优先考虑节点内折叠区或专用设置弹窗，不恢复常驻左侧 Node Inspector。

### F18 Asset / Board Persistence

当前状态：local bridge、FastAPI local-dev、真实 `s3-compatible` Asset adapter、Postgres Board persistence、Postgres Asset metadata adapter、Web-to-FastAPI switch、Board list/save/load contract 和 staging API package 已落地；真实 staging server / managed Postgres / R2 / domain / secrets 仍待接入。

完成定义：

- Image Node 导入、paste、Screenshot、Merge Capture、AI 生成结果都必须先变成 Asset，再进入 Board document。
- Board document 只保存 `asset_id`、server-backed URL、节点轻量参数、runtime edges、camera、shape layout 和短摘要。
- Board save guard 阻止 `data:`、`blob:`、Base64-like 大字符串、不可 JSON 序列化 payload 和超大 document。
- Board list 只返回 summary，不返回完整 document。
- Board load 才返回 document，并按 user/workspace 校验。
- local / FastAPI persistence contract 保持一致，Web 可通过 `NEXT_PUBLIC_API_BASE_URL` 切换。
- Staging smoke 必须证明上传图片后 R2/S3 有对象、Postgres 有 Asset metadata，Board save/load 后 Postgres 有真实记录。
- 保存失败时 UI 给出可理解错误，不清空当前画布。

### F19 Board History

当前状态：first pass 已落地。`/boards/:boardId` 支持统一 History：autosave 成功保存当前 Board 后写入 `autosave` entry，Snapshot 按钮写入 `manual` entry，Cmd/Ctrl+S 执行当前 Board save 并写入 `keyboard` entry，History 面板按时间倒序展示并支持恢复、all/autosave/user saves 过滤、作者/头像显示和 autosave/user save 视觉区分；Next local bridge、FastAPI local-dev 和 FastAPI Postgres adapters 都支持 history create/list/load。当前免费层默认每个 Board 分别保留 autosave 100 条和 user saves 100 条。

完成定义：

- Autosave 负责当前 Board 最新状态，同时把成功保存的状态写入 History，避免用户误以为历史只来自手动 snapshot。
- 用户点击 Snapshot 可以立即保存当前 Board state，并在 History 中标记为用户 snapshot。
- 用户按 Cmd/Ctrl+S 或 Ctrl+S 会保存当前 Board state、写入 History，并阻止浏览器默认保存网页。
- History 写入使用 document signature 去重，序列化 document 未变化时不重复保存同一状态。
- History 面板显示 summary：标题、时间、原因、shape/asset 计数和大小。
- History list 只返回 summary，不返回完整 document。
- Restore 时才加载 history document，恢复后当前 Board 标记为 unsaved/dirty，并交给 autosave 保存成当前状态。
- History document 必须通过 Board guard，不能包含 `data:`、`blob:`、Base64 图片或 Provider 原始响应。
- 免费层默认每个 Board 最多保留 100 条 history entry；`retentionTier` / `expiresAt` 为后续 Pro / Enterprise 恢复范围预留。

---

## 6. 数据字段与约束

当前核对：

- User / Workspace 是 P0 Auth 目标模型；当前实现只有 dev request context，默认 `dev-user` / `dev-workspace`，并可通过开发 headers 覆盖。
- Board 已有 Next local bridge 和 FastAPI persistence contract，记录包含 `workspaceId` / `ownerId` / `lastOpenedAt`；FastAPI 可用 local file-backed 或 Postgres adapter，正式 schema 已有 Alembic scaffold。
- Board History 已有 Next local bridge 和 FastAPI persistence contract；list 只返回 summary，load 才返回 document；免费 retention 默认 autosave 100 + user saves 100 分桶保留。
- Asset 已有 Next local bridge、FastAPI local-dev 和真实 `s3-compatible` object storage adapter；metadata 可走 local 或 Postgres adapter。
- AI Run / API Call Log、AI Chat Session、Model Option 仍是目标 schema；mock Model Registry / AiRun route 已有 first pass，等待真实 Postgres / AI Proxy 切片实现。
- Admin S0、Board membership、Credit/Billing、AI API call、Analytics 和 Moderation 是目标事实源 schema；当前只做规划，不假装完整后台已经完成。
- 任何持久化 document 都不得保存 `data:` / `blob:` / Base64 图片 payload；这一条已经由 Board guard 在 Next / FastAPI 两侧验证。

### 6.1 User

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | string/uuid | 是 | 服务端生成 |
| `email` | string | 是 | 唯一；最长 254；必须合法邮箱 |
| `display_name` | string | 否 | 最长 60 |
| `avatar_url` | string | 否 | URL；最长 2,048 |
| `status` | enum | 是 | `active` / `suspended` / `deleted`；管理员权限不放在 User profile 字段 |
| `created_at` | datetime | 是 | 服务端生成 |
| `last_login_at` | datetime | 否 | 登录成功后更新 |

Admin 权限通过 `admin_roles` 单独授予，不能只依赖前端状态或 User profile 字段。

### 6.2 Workspace

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid | 是 | 服务端生成 |
| `name` | string | 是 | 1-80 字符 |
| `owner_id` | uuid | 是 | 必须存在 User |
| `created_at` | datetime | 是 | 服务端生成 |

P0 可默认每个用户一个 personal workspace。

### 6.3 Board

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid | 是 | 服务端生成 |
| `workspace_id` | uuid | 是 | 必须属于当前用户 |
| `owner_id` | uuid | 是 | 必须存在 User |
| `title` | string | 是 | 1-80 字符；默认 `Untitled Board` |
| `description` | string | 否 | 最长 280 字符；Workspace / Panel 展示，不进入 Board document |
| `card_color` | string | 否 | preset token：`cream` / `mint` / `peach` / `yellow` / `soft` |
| `thumbnail_url` | string | 否 | URL；当前 contract 最长 512 |
| `is_starred` | boolean | 否 | 用户/Workspace 级收藏 first pass；真实多用户后应转 per-user preference |
| `is_pinned` | boolean | 否 | Workspace gallery 置顶 first pass；真实多用户后应明确 workspace/user 作用域 |
| `visibility` | string | 否 | `private` / `workspace` / `public`；当前只作为 metadata，真实分享权限后端校验后才生效 |
| `share_id` | string | 否 | 分享链接 id；当前只生成/copy scaffold，真实公开访问需 Auth/share guard |
| `last_opened_at` | datetime | 否 | 打开 Board 时更新；用于 Workspace 最近打开排序 |
| `document_state` | json | 是 | 画布对象、节点、边；P0 可本地/服务端保存；当前 FastAPI 可写 local file-backed 或 Postgres |
| `canvas_settings` | object | 否 | 存在于 `document_state.canvasSettings`；只保存背景、间距、吸附强度等轻量 UI 偏好 |
| `created_at` | datetime | 是 | 服务端生成 |
| `updated_at` | datetime | 是 | 每次保存更新 |

### 6.3.5 Board History / Board Snapshot

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid/string | 是 | 服务端生成；board 内唯一 |
| `workspace_id` | uuid | 是 | 必须属于当前 workspace |
| `board_id` | uuid/string | 是 | 所属 Board |
| `created_by` | uuid | 是 | 创建 history entry 的用户 |
| `title` | string | 是 | 默认使用当前 Board title 或 `Untitled snapshot` |
| `document` | json | 是 | 必须通过 Board guard；list 不返回 |
| `document_hash` | string | 是 | 用于去重/审计 |
| `byte_size` | number | 是 | guard 计算的 JSON 字节数 |
| `asset_count` | number | 是 | summary metadata |
| `shape_count` | number | 是 | summary metadata |
| `thumbnail_url` | string | 否 | Captured thumbnail 和用户自定义 thumbnail 共用 |
| `reason` | enum | 是 | `autosave` / `manual` / `manual_save` / `keyboard` / `pre_restore`；`auto_interval` 仅保留历史兼容 |
| `retention_tier` | string | 是 | 当前为 `free`；后续接订阅分层 |
| `expires_at` | datetime | 否 | 后续 Pro / Enterprise retention 策略 |
| `created_at` | datetime | 是 | 服务端生成 |

当前 P0 规则：免费层每个 Board 默认分别保留 autosave 100 条和 user saves 100 条 history entry，超过后按 bucket 删除最旧记录。后续大规模生产可把 history body 放入 R2/S3，只在 Postgres 保留 metadata。

### 6.4 Canvas Node

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | string | 是 | board 内唯一 |
| `type` | enum | 是 | `prompt` / `image_gen` / `image_gen_4` / `analysis` / `image` |
| `version` | number | 是 | 节点 schema 版本，用于后续迁移 |
| `position.x` | number | 是 | world 坐标 |
| `position.y` | number | 是 | world 坐标 |
| `size.width` | number | 是 | 120-1,200 |
| `size.height` | number | 是 | 80-1,200 |
| `ports` | object[] | 是 | 输入/输出端口定义，按节点类型生成 |
| `data` | object | 是 | 按节点类型校验 |
| `runtime_summary` | object | 否 | 仅保存可见摘要，如状态、最后运行时间、结果 asset 引用；不保存敏感服务端权威数据 |
| `created_at` | datetime | 是 | 创建时间 |
| `updated_at` | datetime | 是 | 更新时间 |

### 6.5 Prompt Node Data

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `prompt` | string | 是 | 0-4,000 字符 |
| `placeholder` | string | 否 | 最长 120 |

### 6.6 Image Gen / Image Gen 4 Node Data

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `model_role` | string | 是 | 默认 `default_image` |
| `selected_model_id` | string | 否 | 用户显式选择的图片模型，如 `gpt-image-2` |
| `count` | number | 是 | `image_gen` 固定 1；`image_gen_4` 固定 4 |
| `image_input_count` | number | 是 | 当前可见 image 输入端口数量；每个已连接 image 后保留一个空端口，P0 最大 6 |
| `aspect_ratio` | string | 否 | `auto` / `1:1` / `4:3` / `16:9` 等，按模型能力过滤 |
| `resolution` | string | 否 | `auto` / `0.5K` / `1K` / `2K` / `4K` 或模型支持的 size |
| `status` | enum | 是 | `idle` / `running` / `succeeded` / `failed` |
| `result_asset_ids` | string[] | 否 | 最多 4 |
| `last_run_id` | uuid | 否 | 对应 AI Run |
| `cost_hint` | string | 否 | 展示给用户的预估成本提示，不作为扣费依据 |
| `error_code` | string | 否 | 失败时存在 |

### 6.6.5 Analysis Node Data

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `analysis_prompt` | string | 是 | 默认 `分析这个图片，反推提示词`；0-4,000 字符 |
| `last_run_id` | uuid | 否 | 对应 AI Run |
| `result_text_id` | string | 否 | 长分析结果外置引用，不把完整长文本塞入 `shape.props` |

### 6.7 Image Node Data

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `asset_id` | uuid | 是 | 必须存在 Asset |
| `url` | string | 是 | URL；不能持久化 `blob:` / `data:` |
| `width` | number | 否 | > 0 |
| `height` | number | 否 | > 0 |
| `source` | enum | 是 | `generated` / `editor_export` / `merge_capture` / `upload` |
| `title` | string | 否 | 最长 80 |

### 6.8 Edge

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | string | 是 | board 内唯一 |
| `source_node_id` | string | 是 | 必须存在 |
| `source_handle` | string | 是 | 按节点类型校验 |
| `target_node_id` | string | 是 | 必须存在 |
| `target_handle` | string | 是 | 按节点类型校验 |
| `type` | enum | 是 | `text` / `image` |

允许连接：

- Prompt text out → Image Gen / Image Gen 4 text in
- Image out → Image Gen / Image Gen 4 image in
- Image out → Analysis image in
- Analysis text out → Prompt text in 或 Image Gen / Image Gen 4 text in
- Image Gen / Image Gen 4 result → Image（可由点击结果创建，不一定用 Edge）

非法连接：

- 前端必须立即断开并提示，例如 `This connection is not supported yet.`
- 后端保存 Board 时也必须二次校验，不能只信任前端。

### 6.9 Asset

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | string / uuid | 是 | 服务端生成；当前 local/FastAPI bridge 使用 `asset_<uuid>` |
| `workspace_id` | uuid | 是 | 必须属于当前用户 |
| `board_id` | uuid | 否 | 产生它的 Board |
| `origin` | enum | 是 | `ai_run` / `generated` / `editor_export` / `merge_capture` / `screenshot` / `paste` / `upload` |
| `original_url` | string | 是 | 服务端 asset URL；不能是 `blob:` / `data:` |
| `thumbnail_256_url` | string | 否 | 小预览 |
| `thumbnail_512_url` | string | 否 | 中预览 |
| `thumbnail_1024_url` | string | 否 | 大预览 |
| `mime_type` | string | 是 | P0 支持 `image/png` / `image/jpeg` / `image/webp` |
| `byte_size` | number | 是 | P0 单图最大 30MB |
| `width` | number | 是 | > 0 |
| `height` | number | 是 | > 0 |
| `storage` | enum | 是 | 当前支持 `local-dev` 和 FastAPI `s3-compatible`；生产推荐 R2/S3-compatible |
| `created_by` | uuid | 是 | 当前用户 |
| `created_at` | datetime | 是 | 服务端生成 |

### 6.10 AI Run / API Call Log

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid | 是 | 服务端生成 |
| `user_id` | uuid | 是 | 当前用户 |
| `board_id` | uuid | 否 | 当前 Board |
| `node_id` | string | 否 | 触发节点 |
| `provider` | string | 是 | 如 `geekai` |
| `model` | string | 是 | 如 `gpt-image-2` |
| `endpoint` | string | 是 | 如 `/images/generations` |
| `request_params` | json | 是 | 不含密钥 |
| `response_meta` | json | 否 | task id、图片数等 |
| `status` | enum | 是 | `pending` / `running` / `succeeded` / `failed` |
| `latency_ms` | number | 否 | >= 0 |
| `cost_credits` | number | 是 | >= 0 |
| `error_code` | string | 否 | 失败时存在 |
| `created_at` | datetime | 是 | 服务端生成 |

### 6.11 AI Chat Session / Message

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid | 是 | 服务端或本地生成 |
| `board_id` | uuid | 是 | 当前 Board |
| `messages` | object[] | 是 | P0 可只保留当前会话短历史 |
| `messages[].role` | enum | 是 | `user` / `assistant` / `system` |
| `messages[].content` | string | 是 | 单条最长 8,000 字符 |
| `selected_model_id` | string | 否 | 当前 composer 选择的模型 |
| `mode` | enum | 是 | `auto` / `image` |
| `created_at` | datetime | 是 | 创建时间 |
| `updated_at` | datetime | 是 | 更新时间 |

### 6.12 Model Option

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | string | 是 | 如 `gpt-image-2` |
| `provider` | string | 是 | 如 `geekai` |
| `display_name` | string | 是 | 最长 80 |
| `capabilities` | string[] | 是 | 如 `image_generation` / `image_edit` |
| `parameter_schema` | object | 否 | aspect ratio、resolution、quality 等可用项 |
| `is_enabled` | boolean | 是 | false 时前端 disabled |
| `is_default` | boolean | 是 | 默认模型 |
| `estimated_latency` | string | 否 | 如 `5-10s` |
| `cost_hint` | string | 否 | 简短成本提示，不展示复杂价格表 |

### 6.12.5 Admin Access / Audit

当前状态：目标 schema / access boundary。真实 Auth 完成前不开放生产 `/admin`；开发态最多做 scaffold。

| 表 / 对象 | 核心字段 | 约束 |
|------|------|------|
| `admin_roles` | `user_id`、`role`、`permissions`、`note`、`granted_by`、`revoked_at` | 角色独立于 User profile；生产 Admin 入口必须由服务端校验 |
| `admin_audit_logs` | `actor_admin_id`、`action`、`target_type`、`target_id`、`before_state`、`after_state`、`reason`、`ip_hash` | 所有后台写操作必须落审计 |
| `admin_user_notes` | `user_id`、`author_admin_id`、`note`、`visibility` | 只做内部备注，不进入公开 profile |

Admin S0 页面只做 `/admin` shell 和 `/admin/users` MVP：用户搜索、状态、角色、备注、Board 数、积分摘要、最近活跃。封禁、积分调整、模拟用户等动作必须先有服务端权限校验和审计日志。

### 6.12.6 Membership / Credits / Billing / Analytics Fact Sources

这些表是未来团队协作、订阅、后台统计和内容审核的事实源，不代表当前 Product Shell 已接通真实业务。

| 表 / 对象 | 核心字段 | 约束 |
|------|------|------|
| `workspace_members` | `workspace_id`、`user_id`、`role`、`invited_by`、`joined_at`、`removed_at` | Workspace 成员关系不等于每个 Board 的 owner |
| `board_members` | `board_id`、`user_id`、`role`、`invited_by`、`joined_at`、`expires_at`、`last_seen_at` | Board 支持 `owner` / `editor` / `viewer` / `temporary_viewer`；临时访客必须有过期时间 |
| `credit_accounts` / `credit_ledger` | `balance`、`delta`、`source`、`related_run_id`、`related_payment_id`、`admin_actor_id` | AI 扣费、退款、后台调整都走账本，不由前端直接改余额 |
| `subscriptions` / `payments` / `invoices` | plan、status、period、amount、currency、provider ids、paid/refunded timestamps | MRR / ARR / churn / ARPU / LTV 以后从这些表或聚合表计算 |
| `model_provider_routes` / `ai_api_calls` / `api_cost_ledger` | model、provider、route、status、latency、tokens、credits、provider cost | 后台模型线路管理扩展 Model Registry / AiRun，不另造事实源 |
| `analytics_events` | `user_id`、`anonymous_id`、`workspace_id`、`board_id`、`event_name`、`screen`、`properties` | 漏斗和 cohort 基于事件或聚合表，不从 UI 状态猜测 |
| `moderation_items` / `moderation_actions` | target、status、rule hits、admin action、reason | 内容审核后置；先保留数据边界 |

### 6.13 Merge Capture

| 字段 | 类型 | 必填 | 约束 |
|------|------|------|------|
| `id` | uuid | 是 | 服务端生成 |
| `board_id` | uuid | 是 | 当前 Board |
| `source_object_ids` | string[] | 是 | 至少 1 个图片对象 |
| `bounds.x` | number | 是 | world 坐标 |
| `bounds.y` | number | 是 | world 坐标 |
| `bounds.width` | number | 是 | > 0 |
| `bounds.height` | number | 是 | > 0 |
| `output_asset_id` | uuid | 是 | 生成的 Asset |
| `created_by` | uuid | 是 | 当前用户 |

### 6.14 状态分类与协同边界

| 状态类别 | 示例 | 是否进入协同文档 | 说明 |
|----------|------|------------------|------|
| 协同文档状态 | 节点位置、尺寸、类型、参数、端口、连线、图片对象、笔迹 | 是 | 未来 P0.5 多人协同时需要同步 |
| Presence 状态 | 多人光标、正在选中的对象、谁正在编辑节点 | 否，走 presence 通道 | 高频临时状态，不持久化到 Board document |
| 服务端权威状态 | 扣费、余额、AI run 最终状态、API 日志、Provider 响应 | 否，由后端数据库记录 | 前端只显示摘要，不能自行决定 |
| 本地 UI 状态 | 下拉是否打开、hover、弹窗、输入法临时草稿、绘图属性栏展开状态 | 否 | 只存在当前浏览器会话 |

节点和协同文档中不得保存 Base64 图片、`blob:` / `data:` 图片、Provider API Key、Provider 原始响应、完整日志、长聊天历史或反推 prompt 的长文本结果；这些数据通过 `asset_id`、`run_id`、`result_id` 等轻量引用按需读取。

---

## 7. 错误、加载、空状态

当前核对：本节是 Alpha 目标体验。当前已有 Workspace Board gallery loading/error、Board save/load guard 错误、Asset upload/read 错误和 FastAPI CORS / workspace guard 基础反馈；Auth、AI Run、右侧 AI Chat、预算熔断、完整离线/重试体验仍待开发。

### 7.1 全局网络断开

- 顶部或底部显示非阻塞 banner：`You are offline. Changes will sync when the connection returns.`
- P0 如果不支持离线保存，则按钮操作显示 `Reconnect to continue.`
- 已在画布上的对象不消失。

### 7.2 服务端错误

- 500：`Something went wrong. Please retry.`
- 401：跳转登录，toast：`Session expired. Please log in again.`
- 403：显示权限错误页：`You do not have access to this board.`
- 404 Board：显示 `Board not found` + `Back to boards`。
- 429：`Too many requests. Please wait and try again.`

### 7.3 AI 调用错误

| 错误 | 显示 |
|------|------|
| 余额不足 | `Not enough credits to generate images.` |
| 模型不可用 | `The selected image model is unavailable. Try another model.` |
| Provider 超时 | `Image generation timed out. Retry?` |
| 内容违规 | `This prompt could not be processed. Try a different prompt.` |
| 返回空图片 | `No image was returned. Retry will not charge again if the previous run failed.` |

### 7.4 图片加载错误

- Image Node 显示灰色占位和 `Image failed to load`。
- 提供 Retry。
- Download / Send to Canvas 禁用。

### 7.5 空状态

| 场景 | 空状态 |
|------|--------|
| 没有 Board | `No boards yet. Create your first AI image canvas.` |
| 空 Canvas | `Start with a text prompt.` |
| Image Gen 未连接 Prompt | `Connect a prompt first.` |
| AI Chat 无会话 | `What would you like to create today?` |
| 无可用图片模型 | `No image models are available. Try again later.` |
| Image Editor 未连接图片 | `Connect an image node first.` |
| 没有可合并对象 | `Select an image and drawings to merge.` |

### 7.6 加载状态

| 场景 | 加载表现 |
|------|----------|
| Workspace Board 加载 | Board skeleton cards |
| Canvas 加载 | 中央 spinner + `Loading board...` |
| 生图运行中 | 4 个缩略图 skeleton + 进度文案 |
| AI Chat 回复中 | 侧边栏显示 assistant loading 行，不阻塞画布操作 |
| 图片加载中 | Blur / skeleton placeholder |
| Editor 导出中 | Export 按钮 loading，禁止重复点击 |
| Merge Capture | 选区上方显示 `Merging...` |

---

## 8. 不做什么

当前核对：以下边界在 2026-05-01 仍有效。新增的 FastAPI、Postgres、R2/S3 和 deployment work 只服务 P0 Web AI image canvas，不表示恢复旧桌面端、公众号、完整 Admin 大屏或 P0 多人协作。

本版本明确不包含：

1. 不做 Tauri 桌面客户端。
2. 不做公众号 Html Editor。
3. 不做 Writer 小说/长文节点。
4. 不做 Research / Outline / Split 等长文工作流。
5. 不做 Personal Library / Knowledge Graph。
6. 不做完整 Tanva 复制或迁移。
7. 不做复杂 Paper.js 大型画布架构照搬。
8. 不做专业 Photoshop 级图层系统。
9. 不做视频、3D、音频、PDF 节点。
10. 不做用户自带 API Key。
11. 不在前端暴露任何 Provider Key。
12. P0 不做 PDF 对话和文件对话；上传菜单只要求图片入口。
13. P0 不做完整 Mixpanel 级 Admin Analytics 大屏；只允许 Admin S0 schema/access boundary 和后续用户管理 MVP 规划。
14. P0 不做多人实时协作。
15. P0 不做 Stripe 付费上线闭环。
16. P0 不做移动端。
17. P0 不做公开模板市场。
18. P0 不做完整模型市场；只做图片模型下拉和节点卡片内的少量关键参数，不显示独立 Node Inspector。
19. P0 不默认切到 React Flow + Konva；除非 Step 1.5 证明 tldraw-first 无法承载复杂节点、端口或导出。
20. P0 不把 AI Chat 变成全自动 Agent；用户仍需确认或手动运行关键生成步骤。

---

## 9. 验收清单

当前核对结论：

- 已通过：Step 1.5 技术裁决、Node Runtime edge、mock 数据流、Image Node 双向转换、Merge Capture、Asset LOD Slices A-D、FastAPI local-dev persistence contract、S3-compatible Asset adapter、Postgres Board / Asset metadata adapter、Web-to-FastAPI switch、staging API package smoke。
- 部分通过：Workspace Board gallery、Canvas Editor 产品入口、Board save/load/autosave/History、per-board Canvas Settings、Smart Drawing first pass、Board Management Panel、状态反馈、图片模型选择器、节点卡片自包含控制。
- 待开发：正式登录/Auth、邮箱验证、manual/History Workspace Board thumbnails/server-side pagination、Smart Drawing 浏览器 smoke / 阈值调参、真实 share/member permission、真实 AI Proxy、持久化 AI Run logs、真实 Image Gen / Analysis、右侧 AI Chat planner、预算熔断、完整 i18n。

除已明确打勾的 9.2.5 和 9.11 外，下方复选框仍按 Alpha release gate 维护；部分能力虽然在 spike 中存在，但进入 `/boards` 产品路径、真实服务端路径和完整状态反馈前不标为完成。

### 9.1 登录与 Workspace

- [ ] 未登录访问受保护页面会跳转登录。
- [ ] 登录成功进入 `/workspaces`。
- [ ] 登录失败显示明确错误。
- [x] Auth scaffold 有 typed session/user/workspace、Next/FastAPI session endpoint 和 auth-required dev smoke。
- [ ] 无 Board 时显示空状态。
- [ ] New Board 创建成功并跳转 Canvas。
- [ ] Board 标题可重命名，空标题不可保存。

### 9.2 Canvas 基础

- [ ] 画布可 pan / zoom。
- [ ] 50% / 100% / 200% 缩放下点击不偏移。
- [ ] 拖拽节点不偏移。
- [ ] 框选对象不偏移。
- [ ] resize 浏览器窗口后对象不漂移。
- [ ] 工具栏集中、清爽，不同时出现 tldraw 默认左上/右上/底部多套控制。
- [ ] 顶部图标工具栏保留选择、平移、形状、线条、箭头、画笔、文本、橡皮和插入入口；形状可收纳但不能删功能。
- [ ] 形状工具按类别收纳，选择具体形状后默认复用上次选择；箭头和直线是独立图标，箭头入口只画箭头。
- [ ] 左下角导航地图显示缩放百分比、加号/减号缩放按钮和 viewport 框；点击地图位置可以跳转到对应画布区域。
- [ ] 箭头连接矩形、圆形、Frame、图片、卡片时吸附到边中点；连接三角形、菱形时吸附到角点；箭头工具靠近对象时对象轮廓和候选捕捉点预高亮；拖拽时 source / target 捕捉点高亮，靠近形状边缘或端口时能灵敏吸附，不默认吸附到中心点。
- [ ] 左侧属性面板只在选中对象且没有拖动画布时出现，可编辑描边、填充、宽度、线型、线条风格、箭头类型、端点、字体、透明度、对齐、图层和基础操作，按钮使用清晰图标表达。
- [ ] 左键选择绘制工具后只绘制一次，完成后回到 Select，并选中最后创建对象。
- [ ] 右键选择绘制工具后可连续绘制，不出现需要手动解锁的状态；Esc 立即退出后选中本轮新增对象，点击空白处可取消选择。
- [ ] Smart Drawing 开启时，手绘近似直线/圆/矩形/三角形可在落笔后拟合为普通 line/geo shape；关闭时保留原始笔迹。
- [ ] Smart Drawing 的拟合操作可 undo，且不影响 Board autosave / History。
- [ ] 卡片缩小时标题、URL、详情不会溢出边界。
- [ ] 连续粘贴 5-10 张外部图片时有大小/长边限制或提示，页面不长时间卡死。
- [ ] 空画布显示引导。

### 9.2.5 Step 1.5 技术裁决

- [x] Prompt / Image Gen / Image Gen 4 / Analysis / Image 五类 `node_card` 可在 tldraw 中渲染。
- [x] 节点内模型下拉、输入框、按钮和滚轮不会触发画布 pan/zoom/drag。
- [x] 节点端口可视，合法连线可保留。
- [x] 非法连线自动断开，并显示轻提示。
- [x] text 端口和连线为黄色，image 端口和连线为绿色。
- [x] Image Gen / Image Gen 4 的 image 输入端口可随已连接图片动态增加，且旧连接不漂移到错误端口。
- [x] 点击 node-node 数据线后 edge 进入选中态，并在下游 target 端附近出现 `−`，点击可断开连接。
- [x] mock AI Planner 自动插入 3-4 个节点，节点出现在当前视野且不重叠。
- [x] Merge Capture 输出不包含 UI、选择框或网格。
- [x] 50-100 个节点下，拖拽和缩放没有明显卡顿；Windows dense-board stutter 归档为 non-blocking follow-up。
- [x] 复杂节点的 `shape.props` / document payload 不包含 Base64、大图、长日志或 Provider 原始响应。
- [x] tldraw-first 架构可继续，不需要切 React Flow + Konva。

### 9.3 Prompt → Image Gen / Image Gen 4

- [ ] 可创建 Prompt Node。
- [ ] Prompt Node 可输入 prompt，并有 text 输入/输出端口。
- [ ] 可创建 Image Gen Node 和 Image Gen 4 Node。
- [ ] 可连接 Prompt → Image Gen / Image Gen 4。
- [ ] 可连接多个 Image Node → Image Gen / Image Gen 4 image 输入端口，并自动新增空 image 输入端口。
- [ ] prompt 为空时 Run 禁用或显示提示。
- [ ] 点击 Run 进入 loading。
- [ ] 可在 Image Gen / Image Gen 4 Node 中切换图片模型。
- [ ] 切换模型后参数选项按模型能力过滤。
- [ ] Image Gen 成功后显示 1 张结果；Image Gen 4 成功后显示 4 张结果。
- [ ] 失败后显示错误和 Retry。
- [ ] 点击结果创建 Image Node。

### 9.3.5 Analysis

- [ ] 可创建 Analysis Node。
- [ ] Analysis Node 默认 prompt 为 `分析这个图片，反推提示词`。
- [ ] 可连接 Image Node → Analysis image 输入。
- [ ] 可连接 Prompt Node → Analysis prompt 输入。
- [ ] Analysis 输出 text 可连接到 Prompt / Image Gen / Image Gen 4。

### 9.4 Image Node

- [ ] Image Node 显示图片。
- [ ] 图片加载失败显示占位。
- [ ] 双击可预览。
- [ ] Download 可用。
- [ ] Send to Canvas 可用。
- [ ] 可作为 image 输出连接到 Image Gen / Image Gen 4 / Analysis。

### 9.5 Image Editor

- [ ] 未连接图片时 Open Editor 不可用。
- [ ] 连接图片后可打开 Editor。
- [ ] Editor 能显示输入图片。
- [ ] 画笔可绘制。
- [ ] 橡皮可擦除。
- [ ] Export 生成新 Image Node。
- [ ] Export 不包含 UI、网格、选框。
- [ ] 关闭重开不丢编辑状态。

### 9.6 Canvas Markup / Merge Capture

- [ ] Send to Canvas 后图片出现在当前视野附近。
- [ ] 图片可拖动和缩放。
- [ ] 在图片上绘图位置准确。
- [ ] 可选中图片和笔迹。
- [ ] Merge to Image 生成新 Image Node。
- [ ] Merge 不截到 UI、网格、选框。
- [ ] 原图和笔迹保留，不被自动删除。

### 9.7 右侧 AI Chat 对话栏

- [ ] Canvas 右侧显示可收起 AI Chat。
- [ ] 空状态显示欢迎语和建议 prompt。
- [ ] 输入一句自然语言后返回节点图。
- [ ] 自动创建 Prompt / Image Gen / Image Gen 4 / Analysis / Image 节点。
- [ ] 自动连线。
- [ ] 节点出现在当前视野。
- [ ] 返回非法 graph 时不修改画布。
- [ ] 用户可撤销 AI 创建的节点组。
- [ ] AI Chat composer 可以切换图片模型。
- [ ] 图片上传入口可见，PDF/视频入口不进入 P0。
- [ ] AI Chat 展开/收起后，画布选择框、对象位置和连线不漂移。

### 9.7.5 节点卡片自包含控制

- [x] 选中节点后不显示独立左侧 Node Inspector。
- [ ] Image Gen / Image Gen 4 Node 在节点卡片内显示模型和参数设置。
- [ ] 参数项按模型能力过滤。
- [ ] 节点卡片内滚轮和输入不会触发画布 zoom/pan。
- [ ] 参数修改后节点摘要同步更新。

### 9.8 图片模型切换

- [x] 模型列表来自后端或本地 mock registry，不写死在组件里。
- [x] 至少显示 `gpt-image-2` 和 `gemini-3.1-flash-image-preview` 两个候选项。
- [ ] 不可用模型 disabled。
- [x] 生成请求携带选中的模型。
- [ ] API Log 记录实际模型。

### 9.9 AI Proxy / Logs

- [ ] 前端代码不包含真实 Provider Key。
- [ ] 生图请求走后端。
- [x] AI 节点扩展规则已写入 ARCH：新增节点 / Chat bot 必须走 Node Registry + Model Registry + AiRun 合同。
- [ ] 后端能记录 API Call Log。
- [ ] 成功日志包含模型、耗时、费用。
- [ ] 失败日志包含错误码。
- [ ] 失败不扣费或记录退款状态。

### 9.10 i18n / UI

- [ ] 默认英文 UI。
- [ ] 中文环境不混入英文业务文案。
- [ ] 新增用户可见文案都走 i18n。
- [ ] 视觉保持干净白板、小卡片、轻边框。

### 9.11 Asset / Board Persistence

- [x] Next local Asset bridge 可把上传、paste、Screenshot、Merge Capture 图片转为 server-backed URL。
- [x] Board guard 能拒绝 `data:` / `blob:` / Base64-like payload。
- [x] FastAPI Asset routes 支持 local-dev upload/read。
- [x] FastAPI Board routes 支持 validate/list/save/load。
- [x] FastAPI `s3-compatible` Asset adapter 可写对象存储 contract。
- [x] FastAPI Postgres adapter 可保存 Board document 和 Asset metadata。
- [x] Board document 可保存 per-board Canvas Settings：dots/grid/solid background、颜色、spacing 和 snap strength。
- [x] Canvas Settings 可从画布上方工具栏齿轮打开，使用较小的参考图式管理面板 layout；Dots/Grid/Solid、Background Color、Pattern Color、Spacing、Snap、Zoom 和 Interface 设置可见；左下角 Navigator 缩放数字可按当前视角 reset 到 100%。
- [x] Web 可通过 `NEXT_PUBLIC_API_BASE_URL` 切到 FastAPI Asset / Board persistence。
- [x] Staging API Docker package 可 build 并通过容器 smoke。
- [ ] 真实 staging server、managed Postgres、R2/S3 bucket、domain、TLS、CORS 和 secrets 已接入。
- [ ] Staging Web 可上传图片、保存/加载 Board，并在 R2/Postgres 中看到真实记录。
- [x] `/workspaces` Board gallery/list 支持 search / sort / rename / delete。
- [x] `/workspaces` 和 `/boards/:boardId` 支持 Board 标题双击重命名，并避免 autosave 把标题覆盖回 URL-derived fallback。
- [x] Product Shell route skeleton 支持 `/login` / `/signup` / `/forgot-password` / `/verify-email` / `/home` / `/workspaces` / `/collections` / `/settings` / `/account` / `/team` / `/billing`，并按 `reference/Design.md` / `reference/Design_reference.md` 接入 mock user/workspace；Auth 页面已完成第一组 split-screen visual pass，`/workspaces` 已完成 Board gallery/list visual pass，Landing page/Collection/Account/Settings/Team/Subscription 已完成语义分离 placeholder pass。
- [x] `/workspaces` Board gallery/list 支持 thumbnail placeholder、shape/asset count 和 loading/empty/error first pass。
- [x] `/workspaces` Board gallery/list 支持 recent opened metadata 和 client-side Load more pagination。
- [ ] `/workspaces` Board gallery/list 支持 manual/History thumbnail polish / server-side pagination。
- [x] `/workspaces` Board Panel 可编辑 Board title、description、preset card color、thumbnail、star/pin 和 visibility，采用 settings-like 居中面板并提供 thumbnail Remove-to-default；这些字段只作为 Board metadata 保存。
- [x] `/boards/:boardId` 有 autosave 或清晰 save indicator，保存失败不会丢失当前画布。
- [x] `/boards/:boardId` 支持 autosave、Snapshot 按钮、Cmd/Ctrl+S 统一进入 History，并支持 History restore first pass。
- [x] Board history create/list/load 在 Next local bridge、FastAPI local-dev 和 FastAPI Postgres contract 中可用，history list 不返回 document。
