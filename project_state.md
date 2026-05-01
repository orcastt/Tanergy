# TANGENT — Project State

> 每次开始开发前先读：`project_state.md` → `PRD.md` → `ARCH.md` → `HARNESS.md` → `dev-plans/README.md` → 当前 slice plan。
> 每次 commit 前更新此文件。

---

## 当前阶段

**阶段**: Web AI 图像画布重启 — S1.5 复杂节点与架构裁决已通过；Asset LOD 主线 Slice A Image Node moving degrade、Slice B Node LOD shell、Slice C local thumbnail resolver、Slice D 普通 canvas image LOD spike 已落地；Windows / Mac 跨平台质量门已按 `pass with notes` 收口。当前不再继续在 Cloudflare Tunnel + `next dev` 临时环境里追求完美，已进入 Slice E Real Asset Pipeline；Slice E-A 本地 server-backed Asset 合同已落地，Slice E-C Board save guard 已可本地保存/恢复，Slice E-B request context + storage adapter seam 已扩到 FastAPI local-dev、真实 `s3-compatible` Asset adapter、Postgres persistence adapter 和 Web-to-FastAPI configurable client switch；FastAPI + Web 本地 runtime smoke 已通过；staging API Docker / compose / env / runbook package 已准备并通过容器 smoke；`/boards` Dashboard / Board entry 已开始接到同一 persistence contract。

**核心目标**: 用全新、干净的 Web 项目重做 TANGENT。P0 只跑通：

```text
Prompt Node → Image Gen / Image Gen 4（可切换图片模型，单图或四图）→ Image Node
Image Node + Prompt Node → Image Gen（参考 / 编辑 / 融合）→ Image Node
Image Node + Prompt Node → Analysis → Prompt Node
Image Node → Canvas Markup → Merge Capture → New Image Node
Right AI Chat → 自动创建 Prompt / Image Gen / Image Gen 4 / Analysis / Image → 自动连线 → 用户确认后 Run
```

**下一步**: 当前跨平台测试支架已收口为默认关闭的 dev-only 路径：`CanvasRuntimeDiagnostics` 只在 `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1` 时启用，Cloudflare Tunnel allowlist 只通过 `NEXT_ALLOWED_DEV_ORIGINS` 临时注入。Slice E 下一步优先把 staging package 接到真实 server / managed Postgres / R2 / staging Web origin，并继续把 `/boards` Dashboard 补齐 thumbnail、recent/opened metadata、pagination、save indicator 和 Auth-required mode；本地开发默认 `dev-user` / `dev-workspace`，Asset metadata 已带 `createdBy` / `workspaceId`，Board record 已带 `ownerId` / `workspaceId`，Postgres driver 已可保存 Board document 和 S3 Asset metadata，Board rename/delete 已接 local/FastAPI/Postgres contract。真实 Asset Pipeline 稳定后，再接 Model Registry / AI Proxy / AI Run log、Dashboard / 保存 / 登录，以及 Link Preview 后端 unfurl + image proxy；多人协作仍后置到资产边界稳定之后。

**跨平台结论**: Slice D 跨平台门先记为 `pass with notes`。Windows 侧在 50+ 图片/节点、50%-100% 缩放、runtime edge 增长时仍可能出现轻微卡顿，但当前已可用，归档为 `non-blocking performance follow-up`。这类后续问题优先通过 Slice E 的真实缩略图、对象存储、多尺寸 Asset、viewport-aware 挂载继续解决。

**临时测试支架**: Slice D 跨平台测试曾因家庭/企业共享 Wi-Fi 存在设备隔离而使用 Cloudflare Tunnel + `NEXT_ALLOWED_DEV_ORIGINS` 跑 `next dev`。此前 `next start` 白屏是 tldraw production license gate，不是 Windows 性能问题。`CanvasRuntimeDiagnostics` 红色诊断面板已挂到 `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1`，默认关闭；tunnel 域名 allowlist 和 quick tunnel 都只用于 Windows 测试支架。正式上线必须使用真实部署域名和 tldraw production license，不依赖 tunnel。

**当前运行进程记录**: Mac 上当前有 `node` 监听 `*:3000`（PID 62685），用于 `http://localhost:3000/spikes/canvas` 本地手测。当前未检测到 `cloudflared` 进程；如再次做 Windows 隧道测试，必须重新生成临时 tunnel URL，并通过 `NEXT_ALLOWED_DEV_ORIGINS` 注入。

**0-to-1 总路线**: 详见 `ARCH.md` 11.5-11.7；Sprint 级任务拆分见 `ARCH.md` 11.5.1。当前从“本地可保存/加载 + staging package”进入“真实 staging 基础设施 + Auth/Board 产品化 + AI 生图”阶段；多人协作放到 P0.5，必须等 Asset / Board / Auth / AI Run 边界稳定。

---

## 当前入口

| 你想看什么 | 文件 | 结论 |
|------------|------|------|
| 当前状态 | `project_state.md` | 新 Web AI 图像画布，P0 最小链路 + AI Chat + 模型切换 |
| 产品需求 | `PRD.md` | 正式 PRD：功能、流程、页面、数据、错误、验收 |
| 技术架构 | `ARCH.md` | 正式 ARCH：技术栈、目录、模块、API、安全、部署 |
| 开发 Harness | `HARNESS.md` | 跨功能开发索引、代码规范、验收标准、接班规则 |
| Dev Plans 索引 | `dev-plans/README.md` | 当前活跃计划与归档计划入口 |
| P0 Harness 路线 | `dev-plans/p0-development-harness-roadmap-2026-04-30.md` | 后续切片顺序、每个切片 Done 标准、交接模板 |
| Asset LOD 主线 | `dev-plans/Asset-lod-roadmap.md` | 当前下一阶段正式路线：Asset model、thumbnail cache、Image / Node LOD、协作前置资产管线 |
| 已归档 dev-plans | `dev-plans/Archive/` | 已完成、已验收或废弃的切片计划、handoff、外部复核 brief |
| 海外成本/增长预测 | `dev-plans/overseas-cost-growth-forecast.md` | 海外部署成本、用户量、社媒增长、AI 单位经济预测 |
| 旧代码归档 | `legacy/old-tangent-desktop-2026-04-29/` | 旧桌面/Admin/backend/frontend 已隔离，默认不要读 |

`PRD.web-collab.md` 和 `ARCH.web-collab.md` 已归档到 `docs/archive/pivot-docs-2026-04-29/`；根目录 `PRD.md` 和 `ARCH.md` 是当前唯一 canonical 文档。

---

## 当前决策

- ✅ 不继续在旧 Tauri / React Flow / Admin / 公众号项目上叠功能。
- ✅ 旧代码已移动到 `legacy/old-tangent-desktop-2026-04-29/`。
- ✅ 新实现从 `apps/web/` 开始。
- ✅ P0 不做多人协作，协作后移到 P0.5。
- ✅ P0 不做素材库、Html Editor、Writer、Knowledge Graph、复杂 Admin Analytics。
- ✅ 右侧 AI Chat 自动创建节点和连线保留为降低门槛入口。
- ✅ Image Gen / Image Gen 4 Node 和 AI Chat composer 都需要图片模型切换。
- ✅ P0 节点选择只做 Prompt / Image Gen / Image Gen 4 / Analysis / Image；参考图里的复杂节点不进入 P0。
- ✅ 主画布优先保持 Miro/FigJam 式白板体验；节点是画布上的 AI 智能卡片，不把产品改成纯 React Flow 工作流。
- ✅ 节点复杂度由 Node Runtime / Node Registry / Inspector 管理，tldraw 只做画布底座和渲染承载。
- ✅ Step 1.5 作为技术裁决门；未证明复杂节点、端口、动态 image 输入、自动布局、Merge Capture 可行前，不进入正式五类节点链路。
- ✅ 多人协作状态边界采用四类拆分：协同文档、Presence、服务端权威、本地 UI。
- ✅ 节点是显示器/控制器，不是数据库；`shape.props` 和协同文档只存 id、短参数、布局、端口、运行摘要和 Asset 引用。
- ✅ 图片、Base64、长 prompt 分析、Provider 原始响应、完整日志不进入节点或协同文档，必须通过 Asset / AiRun / 后端结果表外置。
- ✅ 源码文件执行 300 行上限和代码最小化原则：250 行开始预警，超过 300 行不继续加功能，进入下一 Sprint 前拆分；禁止 1000 行级源码文件。
- ✅ 阶段性开发动作、大范围修复或高风险重构前，先创建/切换工作分支并提交当前稳定快照，再继续修复。
- ✅ tldraw 视窗剔除有价值但不能盲信；Step 1.5 必须用生产构建验证 50-100 复杂节点和图片密集画布。
- ✅ 协作后置到 P0.5；Presence 和软锁不落 PostgreSQL，CRDT 不替代 AI Run、扣费、Asset 写入的后端权威。
- ✅ Asset Pipeline + Image / Node LOD 提前为协作前置基础设施：LOD 状态只属于本地 UI，不进入 CRDT / Board document；协作文档只同步轻量 shape / node / edge / assetId / layout / summary。
- ✅ Mac 浏览器手感不能作为上线唯一性能口径；真实 AI 图、Windows Chrome / Edge、不同屏幕分辨率和浏览器缩放比例必须进入性能验收。
- ✅ Link card 预览不能依赖前端直接加载第三方 preview 图；后续应走服务端 URL unfurl + image proxy / Asset 化，避免 CORS、防盗链和 bot protection 导致预览图失败。
- ✅ 前端视觉保持干净白板、小卡片、轻边框，不大换皮。
- ✅ Tanva 只参考操作逻辑，不复制代码。

---

## 已完成

- ✅ 创建外部安全快照：`../TanvasAgent-backups/pivot-2026-04-29_065640`。
- ✅ 编写完整新 PRD：`PRD.md`。
- ✅ 编写完整新 ARCH：`ARCH.md`。
- ✅ 编写 P0 pivot 开发计划；历史基线现已归档到 `dev-plans/Archive/web-collaborative-canvas-pivot.md`。
- ✅ 隔离旧项目：`legacy/old-tangent-desktop-2026-04-29/`。
- ✅ 创建新项目骨架：`apps/web/`、`services/api/`、`packages/shared/`。
- ✅ 更新根目录 `AGENTS.md`，禁止默认读取 legacy archive。
- ✅ 新增 `projectstate.md` alias，指向 canonical `project_state.md`。
- ✅ 已归档重复 pivot 文档：`docs/archive/pivot-docs-2026-04-29/PRD.web-collab.md` 和 `docs/archive/pivot-docs-2026-04-29/ARCH.web-collab.md`。
- ✅ 补齐 `PRD.md` / `ARCH.md` 中右侧 AI Chat、AI Chat composer、图片模型切换、模型注册表口径。
- ✅ 新增海外部署成本、用户增长、社媒增长预测：`dev-plans/overseas-cost-growth-forecast.md`。
- ✅ 新增 Alpha 详细开发计划；早期计划现已归档到 `dev-plans/Archive/web-alpha-detailed-development-plan.md`。
- ✅ 完成 S0 Web 脚手架初版：Next.js 16 + TypeScript + ESLint + tldraw。
- ✅ 完成 S1 Canvas Spike 初版：`/spikes/canvas`，包含白板工具验证、图片、链接卡片、Prompt/Generate/Edit AI 卡片。
- ✅ S1 质量检查已通过：`npm -C apps/web run lint`、`npm -C apps/web run typecheck`、`npm -C apps/web run build`、`git diff --check`。
- ✅ 更新 `PRD.md` / `ARCH.md` / dev-plans：锁定 tldraw-first + Node Runtime + Inspector + Step 1.5 技术裁决门。
- ✅ 根据首轮手测反馈收口 S1：隐藏 tldraw 默认分散工具 UI，自定义 Excalidraw-like 顶部图标工具栏；形状和插入类入口收纳为弹出菜单，箭头和直线改为独立图标；左下角恢复自定义导航地图和缩放控件；箭头连接增加边中点/角点吸附、靠近对象时轮廓预高亮、source / target 捕捉点高亮和主动端口命中；连续绘制不暴露 Lock 且 Esc 强制退出；左侧属性面板仅在选中对象且非拖动画布时出现，并改为更清晰的图标控件，补上线条风格、箭头类型和端点；AI/link card 文本缩小时裁切；粘贴图片限制为 PNG/JPEG/WebP、当前已调到 30MB、长边自适应降采样。
- ✅ 整合 Gemini 节点/协同/算力复盘：采纳轻量节点、Asset 引用、React 组合节点、Presence/软锁、预算熔断、R2/缩略图思路；修正“视窗剔除不会卡”“CRDT 等于最后写入”“$100/月可每天 20,000 张图”等过乐观口径。
- ✅ S1.5 已推进到五类节点原型：新增 Prompt / Image Gen / Image Gen 4 / Analysis / Image 注册表、轻量 payload audit、`node_card` custom shape、动态 image 输入端口、text/image 端口和连线颜色、连线中点 `−` 断开按钮、左侧 Node Inspector、node-node 连接规则校验、mock planner graph、单节点插入入口、60 node stress 入口和 Merge Capture 本地预览。
- ✅ GLM 班次 2026-04-29：重写端口连线为 drag-to-connect（pointerdown→全局 pointermove→pointerup）；新增分类 Node Picker（双击画布弹出，Text/Image 分组）；新增 Selection Toolbar 浮动工具栏（替换右下角 Merge Capture，Screenshot + 对齐）；Run 按钮移至节点标题栏并加 Stop 态；去掉 IDLE/SUCCEEDED 状态文字；节点默认高度增大以自适应内容；节点冗余文字精简。
- ✅ Codex 复核 2026-04-29：端口连线阻塞不是 tldraw 架构失败，而是实现层问题；已把端口起点从 DOM `offsetX/Y` 改为节点尺寸 + port anchor 的 page 坐标，并把目标命中从脆弱的 `elementFromPoint()` 改为 DOM 精确命中 + 几何最近输入端口兜底；已拆出 `NodePortDot.tsx`，避免 `NodeCardContent.tsx` 逼近 300 行。
- ✅ Codex 二次修复 2026-04-29：修复 `normalizedAnchor` 误带 `dataType/id/label` 导致的 tldraw binding schema 崩溃；端口交互从 drag-to-connect 调整为 React Flow-like click-to-connect：点击输出端口开始，曲线跟随鼠标，点击输入端口完成，Esc 或点击空白取消；最终 node-node 箭头使用 clean solid arc 并继续绑定节点。
- ✅ Codex 三次修复 2026-04-30：停止旧箭头吸附逻辑重写 `node_card` 已有 binding，避免移动节点后 text 线被吸到 image 端口再被校验删除；端口点击命中从 14px 放大到 24px；连接模式下点击目标端口附近也会按几何最近同类型 input 端口完成连接。
- ✅ Codex 四次修复 2026-04-30：修复普通图形箭头吸附闪烁和重复吸回上一边中点的问题；箭头吸附只处理当前正在绘制/拖端点的箭头，已完成箭头不再全局重吸附；新箭头创建时优先使用正在创建的 topmost arrow，避免误操作上一条 selected arrow；目标边中点根据当前鼠标位置选择，而不是根据对侧端点强制选择。
- ✅ Codex 五次修复 2026-04-30：确认 node-node 数据连线不应继续使用 tldraw `arrow` shape；已新增 Node Runtime Edge Store 和 `CanvasNodeEdgeOverlay`，端口连接写入 runtime edge，由 SVG overlay 渲染 ComfyUI/React Flow 风格贝塞尔曲线；白板普通箭头继续使用 tldraw arrow；数据连线不再暴露 tldraw 中点/锚点手柄，移动节点后按端口重新计算路径。
- ✅ Codex 六次修复 2026-04-30：补齐 node 数据连线交互细节；点击输出端口后立即显示带插头的预览曲线，随鼠标拉伸；runtime edge 中点 `−` 断连按钮改为由 SVG 隐形粗路径命中，hover 更稳定。
- ✅ Codex 七次修复 2026-04-30：修复连接预览线不可见问题；统一 port connection store import 路径，连接开始时一次性写入 `connectingFrom` 和初始鼠标点，并给预览 SVG 显式 `width/height: 100%` 与 `overflow: visible`，避免被默认 SVG viewport 裁剪。
- ✅ Codex 八次推进 2026-04-30：开启 Node Runtime mock 数据传输切片；新增 `nodeDataFlow` 解析器，Prompt 输出 text、Image 输出轻量 asset 引用、Image Gen / Image Gen 4 读取 text + image refs 后生成 1/4 个 mock asset id、Analysis 读取 image + prompt 后输出 mock text；节点卡片和左侧 Inspector 显示输入摘要、缺失提示、运行输出；删除 edge 后下游状态可随 store 更新。
- ✅ Codex 九次修正 2026-04-30：补齐 runtime edge 基数规则；同一个 output 端口允许 fan-out 到多个下游 input，input 仍保持单来源；最近端口兜底会跳过已占用 input；Image Gen 4 输出从单一 `Images out` 拆为 4 个 Asset 输出端口，每个端口只传对应 mock asset。
- ✅ Codex 十次推进 2026-04-30：新增 Canvas Settings 与对齐吸附切片；画布右下角齿轮可打开设置面板，支持 Grid Rendering、Grid Style、Grid Unit、Grid Color、Snap Alignment、Snap Distance、Zoom Sensitivity、Edge Color、AI Chat Style；设置使用 Zustand 本地 store，Save 后写入 localStorage；Snap Alignment 接 tldraw 原生 `isSnapMode`，Snap Distance 接 `snapThreshold`。
- ✅ Codex 十一次文档刷新 2026-04-30：根据产品/架构/设计/认证/支付/协作/数据库/发布/测试/Admin/AI/运维 12 类范例，补充 `PRD.md` 的产品验证假设、MoSCoW、用户故事和 Alpha 指标；补充 `ARCH.md` 的 Harness 覆盖映射；扩展 `README.md`；新增 `HARNESS.md` 和 P0 Harness 路线图。未编造竞品评分/收入，后续需 sourced market research。
- ✅ Codex 十二次文档复核 2026-04-30：补齐 `ARCH.md` 的 1K / 10K / 100K 用户扩展容量路线；补充 `HARNESS.md` 源码行数观察表，标记 `CanvasSpikeStylePanel.tsx`、`CanvasSpikeToolbar.tsx`、`canvas-overlays.css` 等接近 300 行文件，后续触碰要先拆分。
- ✅ Codex 十三次交接整理 2026-04-30：根据用户手测，确认当前性能暂不卡顿；记录 P0 blocker 为 Node Runtime output fan-out 仍失败和已占用 input 不能直接替换；记录 P1 polish 为 Snap guide 透明度降到 20% 与 Screenshot / Merge to Image Node 行为区分；新增 `dev-plans/Archive/glm-next-shift-handoff-2026-04-30.md` 供 GLM 接班。
- ✅ GLM 班次 2026-04-30：修 P0 blocker fan-out + input auto-replacement；`nodeEdges.ts` 的 `addEdge()` 改为按 `targetShapeId + targetPortId` 去重，新连接自动替换同一 target input 的旧 edge，同时保留同一 source output 到其他下游的 fan-out edges；`usePortConnectionCompletion.ts` 移除 `isInputPortOccupied` 阻断和 `findNearestInputPort` 占用过滤，允许连接到已占用 input 完成替换；修 P1 snap guide opacity 到 ~20%，覆盖 `.tl-snap-indicator` 和 `.tl-snap-point`。lint / typecheck / build / git diff --check 全通过，所有源码文件 < 300 行。
- ✅ Codex 十四次修复 2026-04-30：根据密集连线手测反馈，runtime edge 断链不再依赖中点 hover；现在点击数据线会选中该 edge，选中线加粗，并在下游 target 端附近显示 `−` 断链按钮；hit 区只覆盖贝塞尔线中段，避免重新遮挡 source output / target input 端口。lint / typecheck / build / git diff --check 全通过，触碰源码文件 < 300 行。
- ✅ Codex 十五次推进 2026-04-30：补齐 `canvas image -> Image Node` 和 `Image Node 本地导图` 最小闭环；选中画布 image shape 时顶部 toolbar 新增 `Convert to Image Node`，会复用当前 tldraw asset 创建可预览的 Image Node；Selection Toolbar 的 Screenshot / Merge Capture 现在会先创建本地 tldraw image asset，再创建 Image Node，修复“节点里看不见截图”；Image Node 预览区支持双击打开文件选择器和拖拽 PNG/JPEG/WebP 直接导入。lint / typecheck / build / git diff --check 全通过，触碰源码文件 < 300 行。
- ✅ Codex 十六次推进 2026-04-30：补齐 `Image Node -> canvas image` 回放入口；Image Node 标题栏新增 `To Canvas` 按钮，会复用节点当前 asset 在节点右侧创建普通 canvas image，并默认选中新图片，便于继续拖动、标注或参与 Screenshot / Merge。lint / typecheck / build / git diff --check 全通过，触碰源码文件 < 300 行。
- ✅ Codex 十七次修复 2026-04-30：根据手测补齐 Image Node 预览交互；图片预览从 `cover` 改为 `contain`，竖版和长图在节点内可完整显示；同时禁用预览图的原生浏览器拖拽，避免在 Image 容器内部拖图时报错。lint / typecheck / build / git diff --check 全通过，触碰源码文件 < 300 行。
- ✅ Codex 十八次修复 2026-04-30：修复 Screenshot / Convert to Image Node / To Canvas 后偶发的浏览器文字全选高亮；Selection Toolbar 和节点标题栏按钮改为阻止默认文本选择，并在动作前后主动清理浏览器 selection；页头和 Selection Toolbar 也禁用 user-select，避免整页文案误变蓝。lint / typecheck / build / git diff --check 全通过，触碰源码文件 < 300 行。
- ✅ Codex 十九次修复 2026-04-30：给 canvas shell 增加异常 document selection 兜底；监听 `selectionchange`，若选区落在白板页内但不在 `input / textarea / contenteditable` 里，就自动清掉浏览器选区，补住 Screenshot / Convert 之外的边缘误触。lint / typecheck / build / git diff --check 全通过，触碰源码文件 < 300 行。
- ✅ Codex 二十次修复 2026-04-30：针对低缩放大画布下多图片节点卡顿，收窄 `NodeCard` 的 editor 订阅范围；节点卡片不再因为 camera pan / zoom 变化整批跟着刷新，只在 shape / asset 文档变化时更新，减少 `12%` 低缩放场景的无效重渲染。lint / typecheck / build / git diff --check 全通过，触碰源码文件 < 300 行。
- ✅ Codex 二十一次修复 2026-04-30：继续收低缩放多图性能；新增 `canvasPerformanceStore`，根据浏览器宽度、zoom 和图片/图片节点数量切换 Image Node 预览质量。低缩放/高密度时 Image Node 不再挂载真实图片，改为轻量占位；未来普通 canvas image 粘贴/导入的最大边也从固定 1280 改为随浏览器宽度自适应 768 / 960 / 1152。lint / typecheck / build / git diff --check 全通过，触碰源码文件 < 300 行。
- ✅ Codex 二十二次修复 2026-04-30：针对“低缩放不卡、放大后拖图片/加节点/画画仍卡”的手测反馈，继续收 edit-time 热路径；图片数量统计只在 image / Image Node 结构变化时重算，普通拖动和画笔更新不再全画布扫图；`NodeCardContent` / Inspector / Selection Toolbar / Style Panel / Navigator / Arrow Overlay / Node Edge Overlay 改用分层 editor 订阅，小地图在高密度或拖拽时采样更少，Selection Toolbar 和 Style Panel 在拖拽/移动视图时隐藏，减少放大编辑时的 React 浮层重算。lint / typecheck / build / git diff --check 全通过，触碰源码文件 < 300 行。
- ✅ Codex 二十三次修复 2026-04-30：左下角 navigator 增加折叠按钮；展开态右上角可收起，折叠态只保留 42px 图标按钮，再点可展开。折叠态直接跳过小地图 bounds / shape rect 计算，减少高密度画布上的额外浮层工作。lint / typecheck / build / git diff --check 全通过，触碰源码文件 < 300 行。
- ✅ Codex 二十四次架构确认 2026-04-30：根据用户多图多节点手测和 Gemini 复核思路，确认当前性能瓶颈已进入图片资产渲染层；保留 tldraw-first + Node Runtime，不推翻现有节点/连线/Image Node/Merge 链路；下一阶段在新分支规划 Asset LOD Roadmap，把 Asset model、thumbnail cache、Image Node moving degrade、普通 canvas image LOD、Node LOD 和真实 Asset Pipeline 作为多人协作前置主线。
- ✅ Codex 二十五次文档整理 2026-04-30：将已完成、已验收或废弃的 dev-plan/handoff 切片移入 `dev-plans/Archive/`，保留 `dev-plans/Asset-lod-roadmap.md` 作为当前主线入口，并更新 README / P0 Harness / project_state 的索引路径。
- ✅ Codex 二十六次推进 2026-04-30：完成 Asset LOD Slice A；新增 `useCanvasPerformanceTracking()`，把 image metrics / camera metrics / interaction preview degrade 从 `CanvasSpike.tsx` 抽出；`canvasPerformanceStore` 新增本地 `imagePreviewInteractionActive` 状态。首轮手测确认移动缩放明显更顺且不丢图；随后按用户反馈把“交互中一律 reduced”调成可读 LOD：低缩放/密集概览才降级，50% 以上或单个 Image Node 屏幕尺寸足够大时，拖动/缩放中继续显示真实图片。lint / typecheck / build / git diff --check 全通过，LOD 状态不写入 shape props。
- ✅ Codex 二十七次推进 2026-04-30：根据约 30 个 image/node 对象下仍有缩放和连线卡顿的手测反馈，启动 Asset LOD Slice B Node LOD；`canvasPerformanceStore` 新增本地 `nodeCardCount` / `nodeRenderMode`，低缩放、高密度或移动中将不可读 AI 节点切为 shell，只保留节点标题、状态和可点击端口，跳过完整表单、输入解析、footer 和图片/body 渲染；可读尺寸的 Image Node 仍保持 full 以避免隐藏用户正在看的图片。用户反馈 45% 左右过早降级影响交互后，已把常见 24-48 图片/节点规模的 reduce / shell 阈值调到约 25%，极高密度才更早降级。
- ✅ Codex 二十八次推进 2026-04-30：启动 Asset LOD Slice C；新增本地 `assetPreviewResolver`，Image Node 预览从直接读取 tldraw asset 原图改为 resolver 输出 `full / thumbnail / placeholder`；本地导入、Merge Capture、Convert to Image Node 等由 `createLocalAsset()` 创建的图片会预热 256/512 thumbnail cache；`canvasPerformanceStore` 新增 `thumbnail` 模式，让 25%-50% 中等缩放区间显示真实缩略图而非高清原图或纯占位。该缓存仍为本地 UI 层，不写入 shape props / board document。
- ✅ Codex 二十九次整理 2026-04-30：根据用户手测确认当前 Mac 浏览器 25%-50% 多图缩放基本可用；记录上线前风险为真实 AI 图片尺寸、Windows Chrome / Edge、不同屏幕分辨率、browser zoom 与低端 GPU 可能改变性能阈值。下一步明确为 Slice D 普通 canvas image LOD spike + 跨平台性能矩阵；Link card 预览问题后续走服务端 unfurl / image proxy / Asset 化，不在前端直接依赖第三方远程图。
- ✅ Codex 三十次推进 2026-04-30：完成 Slice D 普通 canvas image LOD spike；新增 `CanvasImageShapeUtil` 继承 tldraw 默认 `ImageShapeUtil`，只覆盖屏幕 `component()` 渲染，resize / geometry / crop capability / SVG export 保持默认实现；普通 canvas image 屏幕渲染复用 `assetPreviewResolver`，full 模式用原图，thumbnail / reduced 模式优先使用本地缩略图；缩略图生成失败时回退原图，避免跨域/tainted canvas 导致图片消失。用户手测确认当前多图缩放和移动已明显更顺，暂未复现明显卡顿。
- ✅ Codex 三十一次修复 2026-04-30：修复 Image Node → Image Node 的图片继承预览：下游 Image Node 有 image input 时优先显示并输出上游 asset，空 Image Node 不再默认带 `asset_mock_image_001` 假图，`To Canvas` 也复用同一 effective asset 规则。Slice D 已本地验收，lint / typecheck / build / git diff --check 全通过。
- ✅ Codex 三十二次跨平台测试 2026-04-30：由于当前网络存在 client isolation，局域网直连 Mac:3000 不可用，已改用 Cloudflare Tunnel。测试中确认 `next start` 会触发 tldraw production license gate，因此 Windows 跨平台测试临时使用 `next dev` + `NEXT_ALLOWED_DEV_ORIGINS`。新增 `CanvasRuntimeDiagnostics` 用于显示 Windows / tunnel 下的 editor 初始化错误；该诊断面板已挂到 `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1`，默认关闭，tunnel 配置仍仅是临时测试支架。Slice D 跨平台门最终按 `pass with notes` 通过。
- ✅ Codex 三十三次 Windows 阈值调优 2026-04-30：根据 Windows 手测反馈，50%-100% 画布缩放下，当 Image Node / Image Gen 图片 / runtime edge 增至约 50+ 后，连接、复制、拖动、缩放会明显卡顿；已调高 dense thumbnail 覆盖范围，让 48+ image-like 对象在 110% 以下保持 thumbnail，80+ 在 120% 以下保持 thumbnail，避免 100% 附近突然批量切回 full 原图；端口连线也会触发 interaction LOD；高密度节点交互中更早 shell 化；NodeCard / Inspector 的 edge store 订阅已从全量 edges 缩小到当前节点相关 edges，连接 / 断开 runtime edge 只同步受影响目标节点的动态 image input 数量；图片粘贴 / Image Node 导入上限从早期 spike 的 3MB 调到 30MB；画布最大缩放从 tldraw 默认 800% 限制到 500%。lint / typecheck / build / git diff --check 已通过；Windows 当前遗留卡顿归档为 `non-blocking performance follow-up`。
- ✅ Codex 三十四次推进 2026-04-30：启动 Slice E-A Local Server-Backed Asset Contract；新增 Next 本地 Asset API：`POST /api/assets/from-data-url`、`POST /api/assets/upload`、`GET /api/assets/{assetId}`、`GET /api/assets/files/{assetId}/{fileName}`，本地文件落在 Git 忽略的 `.tangent-assets/`；新增 `TangentAssetRecord` 合同和 client thumbnail upload helper；Image Node 本地导入、Selection Toolbar 的 Merge Capture / Screenshot 现在先上传 data URL，再用返回的 `/api/assets/files/...` URL 创建 tldraw image asset，避免这些新路径继续把 raw `data:` 放进 asset `props.src`；`assetPreviewResolver` 优先使用 persisted thumbnail URL，缺失时回落本地 thumbnail cache。该切片仍是本地开发 bridge，尚未包含 Auth、Workspace 权限、R2/S3 adapter 或 Board save guard。lint / typecheck / build / git diff --check 通过；built server 3100 端口 API smoke 已验证 `from-data-url`、metadata GET 和 file GET。
- ✅ Codex 三十五次推进 2026-04-30：启动 Slice E-C Board save guard；新增 `auditBoardDocument()` / `assertBoardDocumentCanPersist()` 纯函数，递归检查任意 JSON-like Board document，阻止 `data:` / `blob:` runtime URL、大段 base64-like 字符串、不可 JSON 序列化 payload 和超大 document；新增本地 `POST /api/boards/validate-document` guard route，未来 Board save API 必须复用同一规则。随后新增 `serializeBoardDocument()` / `createGuardedBoardDocument()` / `restoreBoardDocument()`，从当前 tldraw editor 导出轻量候选 document：shapes、assets、camera、viewport、runtime edges，并可从本地 JSON 恢复 tldraw assets / shapes、runtime edges 和 camera；Canvas spike 右下角新增 `Save audit` / `Save local` / `Load local` dev 控件用于手动检查、保存和恢复当前画布；该控件会先把当前 editor 里的 `data:image/png|jpeg|webp` / `blob:` runtime image assets 上传到本地 Asset API 并原地更新 tldraw asset `src/meta`，再运行 guard；默认 seeded sample image 已从 inline data URL 移到 `/spikes/sample-image.svg` 静态文件；本地 Board JSON 写入 Git 忽略的 `.tangent-boards/boards/canvas-spike-local.json`。lint / typecheck / build / git diff --check 已通过；built server 3100 端口 smoke 已验证 local-save 200、local-load 200、含 `data:image/...` 的 local-save 422。
- ✅ Codex 三十六次修复 2026-05-01：修复 Analysis 节点内部 compact prompt 继承普通 Prompt grid 导致输出区被挤到底部裁切的问题；`runtimeAssetMigration()` 更新 tldraw image asset 时补齐 `props.isAnimated`，避免粘贴/复制多图后 `Save local` 触发 `Expected boolean, got undefined` 的 tldraw schema validation error。lint / typecheck / build / git diff --check 已通过；用户复测反馈当前看起来已无问题。
- ✅ Codex 三十七次推进 2026-05-01：启动 Slice E-B Auth context + storage adapter seam；新增 `apiRequestContext.ts`，本地开发默认 `dev-user` / `dev-workspace`，可用 `x-tangent-user-id` / `x-tangent-workspace-id` 或 env 覆盖；新增 `assetStorageAdapter.ts`，当前只支持 `local-dev` driver，不支持的 `TANGENT_ASSET_STORAGE_DRIVER` 会明确报错；`TangentAssetRecord` 增加 `createdBy` / `workspaceId`，asset create / metadata / file routes 统一经 request context + storage adapter。lint / typecheck / build 已通过；API smoke 已验证 from-data-url、metadata、file，以及 unsupported driver 400。
- ✅ Codex 三十八次文档规整 2026-05-01：系统更新 `PRD.md`、`ARCH.md`、`HARNESS.md`、`AGENTS.md`、`README.md`、`project_state.md` 和 active `dev-plans/`；新增 `dev-plans/README.md` 作为活跃计划索引；把已完成/过期的 cross-platform test、旧 handoff、旧 Alpha 详细计划和旧 pivot plan 移入 `dev-plans/Archive/`；同步当前 Slice E-B/E-C 状态、运行进程和源码 size watchlist。lint / typecheck / build / git diff --check 已通过。
- ✅ Codex 三十九次推进 2026-05-01：继续 Slice E-B，把 Board local save/load 也接到 `apiRequestContext`；`LocalBoardRecord` 新增 `workspaceId` / `ownerId`，`local-save` 写入当前 context，`local-load` 按 workspace 校验后返回。API smoke 已验证 clean local-save/local-load 返回 `dev-workspace` / `dev-user`，带 `data:` asset URL 的 document 仍被 save guard 以 422 拦截。lint / typecheck / build / git diff --check 已通过。
- ✅ Codex 四十次推进 2026-05-01：继续 Slice E-B，新增 `boardStorageAdapter.ts`，让 `local-save` / `local-load` 通过 Board storage seam 访问本地 `.tangent-boards/`，并补齐 `.env.example` 的 `TANGENT_BOARD_STORAGE_DRIVER` / `TANGENT_BOARD_STORAGE_DIR`。当前 Board driver 只支持 `local-dev`，错误配置会明确失败，方便后续替换为 FastAPI + DB persistence。随后新增 `boardTypes.ts` 集中 Board persistence response contract，`local-save` 只返回 board summary，不回传完整 document，`local-load` 才返回 document；`validate-document` 也接入 `apiRequestContext`，保持 Board persistence preflight 一致。API smoke 已验证 local save/load 仍返回 `dev-workspace` / `dev-user`，save 不含 document、load 含 document，坏的 `data:` document 仍 422；lint / typecheck / build / git diff --check 已通过。
- ✅ Codex 四十一次推进 2026-05-01：启动 fresh FastAPI scaffold，新增 `services/api/pyproject.toml` 和 `services/api/tangent_api/`；当前已落 `/health`、request context、Python Board document guard parity、`POST /api/v1/boards/validate-document`，并实现 local file-backed `POST /api/v1/boards` / `GET /api/v1/boards/{board_id}`，复用 guard/context/summary-load contract；Asset storage route 仍明确返回 501，避免假装已有 R2/Auth/AI。`python3 -m compileall services/api/tangent_api`、web typecheck、web lint、web build、`git diff --check` 已通过。
- ✅ Codex 四十二次推进 2026-05-01：继续 FastAPI Asset local-dev bridge，新增 `local_asset_store.py` 并接通 `POST /api/v1/assets/from-data-url`、`POST /api/v1/assets/upload`、`GET /api/v1/assets/{asset_id}`、`GET /api/v1/assets/files/{asset_id}/{file_name}`；当前支持 PNG/JPEG/WebP、30MB 上限、thumbnail 文件写入、metadata 带 `workspaceId` / `createdBy`、metadata/file 读取按 workspace 校验，unsupported asset/board storage driver 明确 501。R2/S3 尚未实现。新增 `services/api/tests/test_persistence_contracts.py` 覆盖 Asset/Board persistence contract；当前机器未安装 `pytest`，已用等价 direct FastAPI TestClient smoke 验证 asset create / metadata / file / workspace isolation、upload、unsupported driver、Board save/load 和 guard bad case；`python3 -m compileall services/api/tangent_api`、web typecheck、web lint、web build、`git diff --check` 已通过。
- ✅ Codex 四十三次推进 2026-05-01：继续 R2/S3 adapter contract，新增 FastAPI `asset_storage_adapter.py`，Asset routes 不再直接 import local store；`local-dev` 继续走本地文件，`s3-compatible` 目前作为配置感知 placeholder 返回 501 并列出缺失 `S3_*` 配置，未知 driver 也明确失败。Direct TestClient smoke 已验证 local asset create / metadata / file、`s3-compatible` placeholder 和 unknown-driver failure；`python3 -m compileall services/api/tangent_api`、web typecheck、web lint、web build、`git diff --check` 已通过。
- ✅ Codex 四十四次文档同步 2026-05-01：更新 `dev-plans/overseas-cost-growth-forecast.md`，把海外部署预算从旧 Render-heavy 口径同步到当前 P0 推荐路线：Vercel / Cloudflare Pages 前端、Hetzner US West / Hillsboro 单点 FastAPI + WebSocket、Neon/Supabase 托管 Postgres、Cloudflare R2 图片存储与 Cloudflare DNS/WAF；明确免费层只适合 demo，生产账本不建议放同机 Postgres，R2 免 egress 但 operations/reads 需要 cache、限流和防盗链，Fly.io multi-region 放到增长期多人协作延迟被验证后再评估。
- ✅ Codex 四十五次交接 2026-05-01：新增 `dev-plans/Archive/codex-handoff-slice-e-continuation-2026-05-01.md`，记录当前 Slice E 完成度、已落地的 Next/FastAPI Asset + Board bridge、剩余 R2/S3 adapter / Postgres persistence / FastAPI contract 切换任务、质量闸门和新 Codex 接手提示。
- ✅ Codex 四十六次推进 2026-05-01：实现真实 FastAPI `s3-compatible` Asset adapter；新增 `s3_asset_store.py`，通过 boto3 S3 client 写入 workspace-scoped original / thumbnail / `metadata.json` 对象，Asset URL 仍走 `/api/v1/assets/files/{asset_id}/{file_name}` 以便读取前执行 request context / workspace 校验；`local-dev` 与 S3 共用 MIME、大小、data URL 和 workspace guard helper。新增 fake S3 TestClient 覆盖缺配置 501、写入 metadata/original/thumb、metadata/file 读取、missing file 404、cross-workspace 404，`pytest` 当前环境仍未安装，已用 direct FastAPI smoke 验证；`python3 -m compileall services/api/tangent_api` 和 `git diff --check` 通过。
- ✅ Codex 四十七次推进 2026-05-01：实现 FastAPI Postgres persistence adapter；新增 `postgres_connection.py`、`board_storage_adapter.py`、`postgres_board_store.py`、`asset_metadata_adapter.py` 和 `postgres_asset_metadata_store.py`。`TANGENT_BOARD_STORAGE_DRIVER=postgres` 可通过 Postgres 保存/读取 guarded Board records；`TANGENT_ASSET_STORAGE_DRIVER=s3-compatible` 搭配 `TANGENT_ASSET_METADATA_DRIVER=postgres` 时，original / thumbnails 仍写对象存储，Asset metadata / workspace 校验走 Postgres。新增 fake Postgres TestClient 覆盖 Board save/load、S3+Postgres metadata、cross-workspace 404 和缺 `DATABASE_URL` 501；已安装本机 `pytest` 并验证 `PYTHONPATH=services/api python3 -m pytest services/api/tests` 通过，`python3 -m compileall services/api/tangent_api` 通过。
- ✅ Codex 四十八次推进 2026-05-01：实现 Web-to-FastAPI configurable client switch；新增 `persistenceApi.ts`，当前 Web Asset upload 和 Board save/load 在设置 `NEXT_PUBLIC_API_BASE_URL` 时走 FastAPI `/api/v1/assets/from-data-url`、`POST /api/v1/boards` 和 `GET /api/v1/boards/{board_id}`，未设置时保留 Next local bridge。FastAPI 新增 `TANGENT_ALLOWED_ORIGINS` CORS allowlist，支持浏览器从 Next 本地页面直连 FastAPI；Asset client 会把 FastAPI 返回的 `/api/v1/assets/files/...` 相对 URL 补成 API base 绝对 URL，避免 tldraw image asset 在 Web origin 下误指向 Next route。新增 CORS preflight 测试；当前 `PYTHONPATH=services/api python3 -m pytest services/api/tests` 为 11 passed，web lint/typecheck 通过。
- ✅ Codex 四十九次 runtime smoke 2026-05-01：本地同时启动 FastAPI `127.0.0.1:8000` 和 Next dev `localhost:3000`，Web 使用 `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`。验证 `/health` 200、CORS preflight 200 且 allow-origin 为 `http://localhost:3000`、`/spikes/canvas` 200、FastAPI Asset create/metadata/file read 200、Board save/load 200、含 `data:image/...` 的 Board save 422；同时检查 Next dev bundle 已编入 `http://127.0.0.1:8000` 和 `/api/v1/assets/from-data-url` / `/api/v1/boards`。测试后已停止服务并清理 `.tangent-assets-smoke` / `.tangent-boards-smoke`。
- ✅ Codex 五十次 staging prep 2026-05-01：新增 FastAPI staging deploy package：`services/api/Dockerfile`、`services/api/.dockerignore`、`deploy/staging/docker-compose.api.yml`、`deploy/staging/api.env.example` 和 `deploy/staging/README.md`；compose 默认把 API 绑定到 `127.0.0.1:8000`，env 模板指向 `s3-compatible` + Postgres persistence，runbook 记录 Web `NEXT_PUBLIC_API_BASE_URL`、CORS、R2/Postgres 变量和 smoke checklist。Docker image build、compose config、容器内 `/health`、Asset create / metadata / file read、Board save / load 和 guard 422 smoke 已通过，容器已停止。
- ✅ Codex 五十一次推进 2026-05-01：新增 `/boards` Dashboard shell、`/boards/:boardId` 画布入口、Board list contract 和 local/FastAPI board list routes。`BoardDashboard` 可列出当前 workspace 的 Board summary、创建新 Board、按 board id 打开画布；`CanvasSpike` 现在可按 board id 自动加载/保存，并区分 dev spike 与 board 模式。`PYTHONPATH=services/api python3 -m pytest services/api/tests`、web typecheck、web lint、web build 和 `git diff --check` 已重新通过；下一步继续补 Dashboard 搜索/重命名和正式 Board CRUD。
- ✅ Codex 五十二次架构核对 2026-05-01：逐章更新 `ARCH.md`，同步当前真实目录结构、分层边界、FastAPI/S3/Postgres/Web-to-FastAPI/`/boards` entry 状态、Board/Asset API contract、部署推送流程、外部资源清单、0-to-1 阶段估时和当前源码 250 行以上 watchlist；同步刷新 `HARNESS.md` 当前优先级和 source size watchlist。
- ✅ Codex 五十三次 PRD 核对 2026-05-01：逐章更新 `PRD.md`，同步当前 Slice E 进度、`/boards` Dashboard / Board entry shell、FastAPI local-dev、真实 `s3-compatible` Asset adapter、Postgres Board / Asset metadata persistence、Web-to-FastAPI switch、staging API package、P0 功能状态、F18 Asset / Board Persistence、数据约束和当前 Alpha 验收差距。
- ✅ Codex 五十四次执行规则核对 2026-05-01：逐章更新 `AGENTS.md` 和 `HARNESS.md`，同步当前 Slice E / 0-to-1 接手点、真实 staging / deploy / Auth / Board CRUD / AI Run 顺序、前后端质量闸门、Asset / Board Persistence harness、Auth / Board CRUD harness、AI Integration harness、Ops harness、handoff prompt 和源码 size watchlist 执行要求。
- ✅ Codex 五十五次推进 2026-05-01：继续 `/boards` Dashboard / Board CRUD 产品化；FastAPI 新增 `PATCH /api/v1/boards/{board_id}` 和 `DELETE /api/v1/boards/{board_id}`，local-dev / Postgres Board storage adapter 均支持 rename/delete，Next local bridge 新增 `local-rename` / `local-delete`；`BoardDashboard` 支持 search、inline rename、delete confirm，仍保持 Board list 只返回 summary、load 才返回 document。`pytest`、compileall、web lint/typecheck/build 已通过；`boards.css` 进入 255 行 watchlist。

---

## 当前 P0 切片顺序

1. **Canvas 坐标 Spike**
   - tldraw 或候选画布技术验证。
   - 验证 50% / 100% / 200% 缩放、resize、Retina、拖拽、框选、连线端口不偏移。
   - 当前状态：已通过。顶部分类图标工具栏、独立箭头/直线入口、箭头吸附、左下角导航地图、按需属性面板、连续绘制 Esc、card 文本裁切和图片粘贴限制均已进入当前 canvas spike 基线。

2. **Step 1.5 复杂节点与架构裁决**
   - Prompt / Image Gen / Image Gen 4 / Analysis / Image 五类节点原型。
   - React 组合式节点容器，不写超级节点文件。
   - 轻量节点 payload：`shape.props` 不保存 Base64、大图、长日志或 Provider 原始响应。
   - Image Gen / Image Gen 4 支持模型下拉、分辨率、比例、Run、1 图 / 4 图 mock 结果。
   - Image Gen / Image Gen 4 支持 text 输入和动态多 image 输入，每连入一个 image 保留一个新的空端口。
   - Analysis 支持 image 输入、prompt 输入、默认反推提示词和 text 输出。
   - text 端口和连线为黄色；image 端口和连线为绿色。
   - node-node 连线靠近时中点显示 `−`，点击可断开。
   - 左侧 Inspector。
   - 端口可视、合法连线保留、非法连线自动断开。
   - AI Chat / mock planner 自动布局到当前视野。
   - Merge Capture 最小验证。
   - 50-100 节点压力测试。
   - 外部图片 5-10 张粘贴/导入压力测试。
   - 当前状态：已通过。五类节点、Inspector、动态端口、类型连线颜色、端口校验、mock graph、60 节点入口已实现；端口数据线已切换为 Node Runtime SVG overlay；Prompt / Image / Analysis / Image Gen mock 数据流已接入；fan-out 与 input auto-replacement 已修；canvas image 与 Image Node 可双向转换；Merge Capture / Screenshot 可生成带预览的 Image Node；多图多节点暴露的图片渲染瓶颈已转入 Asset LOD / Slice E 处理。

3. **五类节点 UI 链路**
   - 双击画布调用出节点面板，或者工具栏增加一个加号，然后调用出节点面板
   - Prompt Node。
   - Image Gen Node。
   - Image Gen 4 Node。
   - Analysis Node。
   - Image Node。


4. **图片模型注册表与选择器**
   - 服务端或 mock registry 返回 P0 图片模型。
   - Image Gen / Image Gen 4 Node 内可切换模型。
   - AI Chat composer 内可切换模型。
   - 不可用模型显示 disabled。

5. **真实单图 / 四图生成**
   - Prompt → Image Gen / Image Gen 4。
   - 调后端 AI proxy。
   - 默认低成本参数，后续测试优先用最便宜配置。
   - 一次返回 1 张或 4 张图。
   - API Log 记录实际模型、参数、耗时、费用。

6. **Image Node 结果闭环**
   - 点击缩略图创建 Image Node。
   - 双击预览、下载、发送到画布。

7. **Analysis 反推提示词闭环**
   - Image + Prompt → Analysis。
   - Analysis 输出 text。
   - 输出 text 可接回 Prompt / Image Gen。

8. **Canvas Markup + Merge Capture**
   - Image Send to Canvas。
   - 画布直接涂改。
   - 选中图片和笔迹。
   - Merge → New Image Node。

9. **右侧 AI Chat 自动搭线**
   - 一句话创建 Prompt / Image Gen / Image Gen 4 / Analysis / Image 节点。
   - 自动布局、自动连线。
   - Composer 的模型选择写入 Image Gen / Image Gen 4 Node。

10. **P0.5 协作**
   - Presence。
   - 多人光标。
   - Realtime sync。

---

## 已知风险

| 风险 | 处理 |
|------|------|
| 旧代码污染新实现 | legacy archive 默认不读；只在用户明确要求时打开 |
| 缩放/拖拽/选择偏移复发 | 第一切片先做坐标精度 spike |
| 复杂节点越做越大 | Node Runtime + Node Registry + Inspector；节点卡片只显示摘要 |
| Spike 源码文件变大 | 已拆分 `globals.css`、`useArrowPortSnapping.ts` 等；当前 `CanvasSpikeStylePanel.tsx`、`CanvasSpikeToolbar.tsx`、`canvas-overlays.css`、`node-card-content.css` 接近 300 行，`useEditorRevision.ts`、`assetPreviewResolver.ts`、`boards.css`、`CanvasSelectionToolbar.tsx` 超过 250 行，后续触碰这些文件必须优先拆分 |
| tldraw 端口/连线不足 | Step 1.5 先验证；失败再评估 tldraw + 独立节点层或 React Flow + Konva |
| 动态 image 输入端口漂移 | 端口使用稳定 anchor；每连入一个 image 保留一个新空端口，P0 上限 6；复测旧线是否仍指向原端口 |
| Output fan-out | GLM 2026-04-30 已修 `nodeEdges.ts` addEdge 按 target input 去重 + `usePortConnectionCompletion.ts` 移除 occupied 阻断；后续继续手测密集连接 |
| text/image 数据类型混线 | Node Runtime 校验端口 dataType；text 端口/连线黄色，image 端口/连线绿色；非法线自动删除 |
| 连线断开不明显 | Codex 2026-04-30 已改为 click-to-select runtime edge，选中后在下游 target 端附近显示 `−` 断链按钮；等待密集连线场景复测 |
| Image Node 仍是空壳占位或不能回到画布 | Codex 2026-04-30 已补 `canvas image -> Image Node`、Screenshot 生成节点预览、本地拖拽/双击导图和 `Image Node -> canvas image`；等待用户复测 |
| 多人协作状态混乱 | 协同文档、Presence、服务端权威、本地 UI 四类状态分离 |
| 节点 props 存重型数据 | 节点只存 id、短参数、布局、端口、运行摘要和 Asset 引用；重型数据外置 |
| 过度相信视窗剔除 | Step 1.5 和 Asset LOD Slice A-D 已验证并降噪 NodeCard、Image Node、普通 canvas image、navigator 和 overlay 热路径；Windows 密集画布仍是 non-blocking follow-up，下一阶段继续由真实 Asset Pipeline、多尺寸缩略图和对象存储解决根因 |
| 协作前图片资产不规范 | 正式多人协作前必须完成 Asset Pipeline：Board document / CRDT 不存 `data:`、`blob:`、Base64 或高清原图，只同步 assetId / dimensions / layout；图片原图、缩略图、权限 URL 由 Asset service / object storage 管理 |
| CRDT 被误解为业务规则 | CRDT 只解决文档一致性；AI Run、扣费、Asset、参数冲突仍由后端/Node Runtime 定义 |
| Image Editor 重新变复杂 | P0 只做画笔、橡皮、导出 |
| Merge Capture 截到 UI | 使用离屏渲染对象，不做 DOM 截屏主方案 |
| 工具栏分散导致小白困惑 | 隐藏 tldraw 默认左上/右上/底部 UI，Spike 自定义顶部分类图标工具栏；不删减白板功能，只统一入口 |
| 导航地图丢失导致定位困难 | 使用自定义左下角 minimap；显示 viewport、缩放百分比、加减缩放和点击跳转，不恢复整套默认分散 UI |
| 箭头默认吸附中心导致连线不自然 | Spike 增加边中点/角点吸附、对象轮廓预高亮、捕捉点高亮和主动端口命中；若后续复杂端口仍不稳定，Step 1.5 评估独立端口层 |
| 连续绘制被误解为画布锁定 | 连续绘制内部可使用 tool lock，但 UI 不暴露 Lock；Esc 强制取消当前 tool state 并选中本轮新增对象 |
| 属性面板常驻打扰画布操作 | 左侧属性面板只在有选中对象且没有拖动画布时出现；拖动画布或空选时隐藏 |
| card 缩小后文字溢出 | 内容层 line clamp、长 URL 断行、小尺寸折叠；正式节点继续由 Inspector 承载复杂参数 |
| 粘贴 Pinterest/外部多张大图导致卡顿 | 当前限制 MIME、30MB、长边自适应降采样；Windows 遗留卡顿作为 non-blocking follow-up，后续由 Slice E 多尺寸缩略图 / Asset Pipeline 继续处理 |
| AI 成本失控 | 默认低成本参数，服务端限流、全局预算熔断；`$100/月` 按月总量核算，不误判为每日额度 |
| 前端暴露 API Key | Key 只在服务端 `.env`，前端只调自己的 API |
| 模型列表又被写死在组件里 | 先做 Model Registry / mock registry，再做真实 provider 调用 |

---

## 下一步

Slice D 跨平台质量门已 `pass with notes`，不再继续在 Cloudflare Tunnel + `next dev` 临时环境里追求完美。当前 Slice E 已完成本地 Asset / Board bridge、FastAPI local-dev、真实 `s3-compatible` Asset adapter、Postgres persistence adapter、Web-to-FastAPI switch、staging API package 和 `/boards` entry shell。下一步不再只是“继续写功能”，而是按 0-to-1 阶段推进：

| 顺序 | 阶段 | 状态 | 预计开发 | 预计测试 | 当前要做 |
|------|------|------|----------|----------|----------|
| 1 | Staging 基础设施 | 待接真实资源 | 1-2 天 | 0.5-1 天 | 建 managed Postgres、R2 bucket、staging API domain、staging Web env，跑 `deploy/staging/README.md` smoke |
| 2 | 推送 / 部署流水线 | 待接远端和平台 | 1-2 天 | 0.5-1 天 | 明确 Git remote、Web deploy 平台、VPS Docker deploy、env secrets、rollback |
| 3 | Auth / 注册 / 邮箱验证 | 未开始 | 3-5 天 | 1-2 天 | users/workspaces tables、Email OTP/magic link、session/JWT、保护 `/boards` 和 API |
| 4 | Board CRUD 产品化 | search/rename/delete 已接 contract | 2-4 天 | 1-2 天 | `/boards` thumbnail、recent/opened metadata、空/错/加载 polish、save indicator、刷新恢复 |
| 5 | AI 生图最小链路 | 未接真实 provider | 5-8 天 | 2-4 天 | Model Registry、AI Proxy、AiRun table、Prompt → Image Gen / Image Gen 4 → Asset → Image Node |
| 6 | Analysis / AI Chat 自动搭线 | mock 基础已有 | 3-6 天 | 2-3 天 | Analysis provider path、Chat planner、自动建节点/连线、用户确认后 Run |
| 7 | Alpha 前安全/运维 | 未开始 | 3-5 天 | 1-2 天 | rate limit、成本熔断、日志、备份恢复演练、CORS、错误页、Terms/Privacy 占位 |
| 8 | Alpha 发布验收 | 未开始 | 2-3 天修复 | 3-5 天手测 | Windows/Mac/Chrome/Edge、真实 AI 成本、5-10 个用户端到端手测 |
| 9 | P0.5 多人协作 | 后置 | 8-15 天 | 5-10 天 | 协作文档层、presence、软锁、snapshot/reconnect；不让 CRDT 接管 AI Run / Asset / 扣费 |

隐性阻塞项已写入 `ARCH.md` 11.7：数据库 migration、备份恢复、R2 CORS/权限、Email SPF/DKIM/DMARC、tldraw production license、限流/成本熔断、Secrets 轮换、Legal 占位、最小 Ops 查询和未来 WebSocket/协作代理配置。
