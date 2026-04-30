# TANGENT — Project State

> 每次开始开发前先读：`project_state.md` → `PRD.md` → `ARCH.md` → 当前 `dev-plans/`。
> 每次 commit 前更新此文件。

---

## 当前阶段

**阶段**: Web AI 图像画布重启 — S1.5 复杂节点与架构裁决开发中；GLM 班次已完成端口连线交互重写、Node Picker 分类面板、Selection Toolbar 浮动工具栏、Run UI 优化和节点自适应高度；Codex 已将端口连线改为 click-to-connect，并修复 tldraw binding schema 崩溃，待用户手测确认

**核心目标**: 用全新、干净的 Web 项目重做 TANGENT。P0 只跑通：

```text
Prompt Node → Image Gen / Image Gen 4（可切换图片模型，单图或四图）→ Image Node
Image Node + Prompt Node → Image Gen（参考 / 编辑 / 融合）→ Image Node
Image Node + Prompt Node → Analysis → Prompt Node
Image Node → Canvas Markup → Merge Capture → New Image Node
Right AI Chat → 自动创建 Prompt / Image Gen / Image Gen 4 / Analysis / Image → 自动连线 → 用户确认后 Run
```

**下一步**: 在 `http://localhost:3000/spikes/canvas` 复测端口 click-to-connect 连线：点击 Prompt 右侧 text 输出端口后，应出现跟随鼠标的黄色曲线；再点击或靠近点击 Image Gen 左侧 text 输入端口，应完成黄色连接；点击 Image 右侧 image 输出端口后，应出现绿色曲线；再点击或靠近点击 Image Gen / Analysis 左侧 image 输入端口，应完成绿色连接；移动任一节点后连线必须保留并跟随端口；非法类型连接应被拒绝；连线中点 `−` 应可断开。若浏览器仍保留旧的非法 binding 数据，先点击 tldraw 错误弹窗里的 `Reset data` 清掉本地旧画布数据。

---

## 当前入口

| 你想看什么 | 文件 | 结论 |
|------------|------|------|
| 当前状态 | `project_state.md` | 新 Web AI 图像画布，P0 最小链路 + AI Chat + 模型切换 |
| 产品需求 | `PRD.md` | 正式 PRD：功能、流程、页面、数据、错误、验收 |
| 技术架构 | `ARCH.md` | 正式 ARCH：技术栈、目录、模块、API、安全、部署 |
| 总开发路线 | `dev-plans/web-collaborative-canvas-pivot.md` | 当前 P0 分阶段路线图 |
| 详细开发计划 | `dev-plans/web-alpha-detailed-development-plan.md` | Alpha 逐 Sprint 执行计划、分工、文件范围、验收标准 |
| AI 接班交接 | `dev-plans/ai-shift-handoff-2026-04-29.md` | 半天接班计划、GLM 执行边界、手测清单、Codex 回来后的复核清单 |
| GLM 交接笔记 | `dev-plans/glm-handback-2026-04-29.md` | GLM 班次完成内容、变更文件清单、复测要点、已知问题 |
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
- ✅ 前端视觉保持干净白板、小卡片、轻边框，不大换皮。
- ✅ Tanva 只参考操作逻辑，不复制代码。

---

## 已完成

- ✅ 创建外部安全快照：`../TanvasAgent-backups/pivot-2026-04-29_065640`。
- ✅ 编写完整新 PRD：`PRD.md`。
- ✅ 编写完整新 ARCH：`ARCH.md`。
- ✅ 编写 P0 pivot 开发计划：`dev-plans/web-collaborative-canvas-pivot.md`。
- ✅ 隔离旧项目：`legacy/old-tangent-desktop-2026-04-29/`。
- ✅ 创建新项目骨架：`apps/web/`、`services/api/`、`packages/shared/`。
- ✅ 更新根目录 `AGENTS.md`，禁止默认读取 legacy archive。
- ✅ 新增 `projectstate.md` alias，指向 canonical `project_state.md`。
- ✅ 已归档重复 pivot 文档：`docs/archive/pivot-docs-2026-04-29/PRD.web-collab.md` 和 `docs/archive/pivot-docs-2026-04-29/ARCH.web-collab.md`。
- ✅ 补齐 `PRD.md` / `ARCH.md` 中右侧 AI Chat、AI Chat composer、图片模型切换、模型注册表口径。
- ✅ 新增海外部署成本、用户增长、社媒增长预测：`dev-plans/overseas-cost-growth-forecast.md`。
- ✅ 新增 Alpha 详细开发计划：`dev-plans/web-alpha-detailed-development-plan.md`。
- ✅ 完成 S0 Web 脚手架初版：Next.js 16 + TypeScript + ESLint + tldraw。
- ✅ 完成 S1 Canvas Spike 初版：`/spikes/canvas`，包含白板工具验证、图片、链接卡片、Prompt/Generate/Edit AI 卡片。
- ✅ S1 质量检查已通过：`npm -C apps/web run lint`、`npm -C apps/web run typecheck`、`npm -C apps/web run build`、`git diff --check`。
- ✅ 更新 `PRD.md` / `ARCH.md` / dev-plans：锁定 tldraw-first + Node Runtime + Inspector + Step 1.5 技术裁决门。
- ✅ 根据首轮手测反馈收口 S1：隐藏 tldraw 默认分散工具 UI，自定义 Excalidraw-like 顶部图标工具栏；形状和插入类入口收纳为弹出菜单，箭头和直线改为独立图标；左下角恢复自定义导航地图和缩放控件；箭头连接增加边中点/角点吸附、靠近对象时轮廓预高亮、source / target 捕捉点高亮和主动端口命中；连续绘制不暴露 Lock 且 Esc 强制退出；左侧属性面板仅在选中对象且非拖动画布时出现，并改为更清晰的图标控件，补上线条风格、箭头类型和端点；AI/link card 文本缩小时裁切；粘贴图片限制为 PNG/JPEG/WebP、3MB、长边 1280px。
- ✅ 整合 Gemini 节点/协同/算力复盘：采纳轻量节点、Asset 引用、React 组合节点、Presence/软锁、预算熔断、R2/缩略图思路；修正“视窗剔除不会卡”“CRDT 等于最后写入”“$100/月可每天 20,000 张图”等过乐观口径。
- ✅ S1.5 已推进到五类节点原型：新增 Prompt / Image Gen / Image Gen 4 / Analysis / Image 注册表、轻量 payload audit、`node_card` custom shape、动态 image 输入端口、text/image 端口和连线颜色、连线中点 `−` 断开按钮、左侧 Node Inspector、node-node 连接规则校验、mock planner graph、单节点插入入口、60 node stress 入口和 Merge Capture 本地预览。
- ✅ GLM 班次 2026-04-29：重写端口连线为 drag-to-connect（pointerdown→全局 pointermove→pointerup）；新增分类 Node Picker（双击画布弹出，Text/Image 分组）；新增 Selection Toolbar 浮动工具栏（替换右下角 Merge Capture，Screenshot + 对齐）；Run 按钮移至节点标题栏并加 Stop 态；去掉 IDLE/SUCCEEDED 状态文字；节点默认高度增大以自适应内容；节点冗余文字精简。
- ✅ Codex 复核 2026-04-29：端口连线阻塞不是 tldraw 架构失败，而是实现层问题；已把端口起点从 DOM `offsetX/Y` 改为节点尺寸 + port anchor 的 page 坐标，并把目标命中从脆弱的 `elementFromPoint()` 改为 DOM 精确命中 + 几何最近输入端口兜底；已拆出 `NodePortDot.tsx`，避免 `NodeCardContent.tsx` 逼近 300 行。
- ✅ Codex 二次修复 2026-04-29：修复 `normalizedAnchor` 误带 `dataType/id/label` 导致的 tldraw binding schema 崩溃；端口交互从 drag-to-connect 调整为 React Flow-like click-to-connect：点击输出端口开始，曲线跟随鼠标，点击输入端口完成，Esc 或点击空白取消；最终 node-node 箭头使用 clean solid arc 并继续绑定节点。
- ✅ Codex 三次修复 2026-04-30：停止旧箭头吸附逻辑重写 `node_card` 已有 binding，避免移动节点后 text 线被吸到 image 端口再被校验删除；端口点击命中从 14px 放大到 24px；连接模式下点击目标端口附近也会按几何最近同类型 input 端口完成连接。
- ✅ Codex 四次修复 2026-04-30：修复普通图形箭头吸附闪烁和重复吸回上一边中点的问题；箭头吸附只处理当前正在绘制/拖端点的箭头，已完成箭头不再全局重吸附；新箭头创建时优先使用正在创建的 topmost arrow，避免误操作上一条 selected arrow；目标边中点根据当前鼠标位置选择，而不是根据对侧端点强制选择。
- ✅ Codex 五次修复 2026-04-30：确认 node-node 数据连线不应继续使用 tldraw `arrow` shape；已新增 Node Runtime Edge Store 和 `CanvasNodeEdgeOverlay`，端口连接写入 runtime edge，由 SVG overlay 渲染 ComfyUI/React Flow 风格贝塞尔曲线；白板普通箭头继续使用 tldraw arrow；数据连线不再暴露 tldraw 中点/锚点手柄，移动节点后按端口重新计算路径。
- ✅ Codex 六次修复 2026-04-30：补齐 node 数据连线交互细节；点击输出端口后立即显示带插头的预览曲线，随鼠标拉伸；runtime edge 中点 `−` 断连按钮改为由 SVG 隐形粗路径命中，hover 更稳定。

---

## 当前 P0 切片顺序

1. **Canvas 坐标 Spike**
   - tldraw 或候选画布技术验证。
   - 验证 50% / 100% / 200% 缩放、resize、Retina、拖拽、框选、连线端口不偏移。
   - 当前状态：已根据首轮手测反馈修正为顶部分类图标工具栏、独立箭头/直线入口、箭头边中点/角点吸附、对象轮廓预高亮与捕捉点高亮、左下角导航地图、按需显示的左侧属性面板、连续绘制 Esc 强制退出、card 文本裁切和图片粘贴限制；小 UI 暂时冻结，只保留阻塞项复测。

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
   - 当前状态：开发中；五类节点、Inspector、动态端口、类型连线颜色、端口校验、断连按钮、mock graph、60 节点入口已实现；GLM 班次重写了端口连线交互、Node Picker 分类面板、Selection Toolbar 浮动工具栏、Run UI 优化和节点自适应高度；Codex 已修复端口起点坐标、目标端口几何命中、binding schema 崩溃，并将端口连接改为 click-to-connect；**连线颜色、校验逻辑、断连按钮仍待用户手测确认**；图片密集压力测试仍未完成。

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
| Spike 源码文件变大 | 已拆分 `globals.css`、`useArrowPortSnapping.ts`、`CanvasSpikeToolbar.tsx`；后续触碰 250 行以上文件时继续提前拆分 |
| tldraw 端口/连线不足 | Step 1.5 先验证；失败再评估 tldraw + 独立节点层或 React Flow + Konva |
| 动态 image 输入端口漂移 | 端口使用稳定 anchor；每连入一个 image 保留一个新空端口，P0 上限 6；复测旧线是否仍指向原端口 |
| text/image 数据类型混线 | Node Runtime 校验端口 dataType；text 端口/连线黄色，image 端口/连线绿色；非法线自动删除 |
| 连线断开不明显 | node-node 连线靠近时中点显示 `−`，点击删除箭头连接 |
| 多人协作状态混乱 | 协同文档、Presence、服务端权威、本地 UI 四类状态分离 |
| 节点 props 存重型数据 | 节点只存 id、短参数、布局、端口、运行摘要和 Asset 引用；重型数据外置 |
| 过度相信视窗剔除 | Step 1.5 用生产构建验证 50-100 复杂节点和图片密集画布 |
| CRDT 被误解为业务规则 | CRDT 只解决文档一致性；AI Run、扣费、Asset、参数冲突仍由后端/Node Runtime 定义 |
| Image Editor 重新变复杂 | P0 只做画笔、橡皮、导出 |
| Merge Capture 截到 UI | 使用离屏渲染对象，不做 DOM 截屏主方案 |
| 工具栏分散导致小白困惑 | 隐藏 tldraw 默认左上/右上/底部 UI，Spike 自定义顶部分类图标工具栏；不删减白板功能，只统一入口 |
| 导航地图丢失导致定位困难 | 使用自定义左下角 minimap；显示 viewport、缩放百分比、加减缩放和点击跳转，不恢复整套默认分散 UI |
| 箭头默认吸附中心导致连线不自然 | Spike 增加边中点/角点吸附、对象轮廓预高亮、捕捉点高亮和主动端口命中；若后续复杂端口仍不稳定，Step 1.5 评估独立端口层 |
| 连续绘制被误解为画布锁定 | 连续绘制内部可使用 tool lock，但 UI 不暴露 Lock；Esc 强制取消当前 tool state 并选中本轮新增对象 |
| 属性面板常驻打扰画布操作 | 左侧属性面板只在有选中对象且没有拖动画布时出现；拖动画布或空选时隐藏 |
| card 缩小后文字溢出 | 内容层 line clamp、长 URL 断行、小尺寸折叠；正式节点继续由 Inspector 承载复杂参数 |
| 粘贴 Pinterest/外部多张大图导致卡顿 | Spike 先限制 MIME、3MB、长边 1280px；Step 1.5 继续测 5-10 张并评估压缩、缩略图、懒加载 |
| AI 成本失控 | 默认低成本参数，服务端限流、全局预算熔断；`$100/月` 按月总量核算，不误判为每日额度 |
| 前端暴露 API Key | Key 只在服务端 `.env`，前端只调自己的 API |
| 模型列表又被写死在组件里 | 先做 Model Registry / mock registry，再做真实 provider 调用 |

---

## 下一步

临时接班 AI 先读 `dev-plans/ai-shift-handoff-2026-04-29.md`，按 Round 0-2 做安全检查、基线验证和 S1.5 手测记录；只修 S1.5 阻塞问题，不做真实 AI API、后端、依赖或大重构。Codex 回来后按该交接计划复核 git、质量闸门、文件行数、手测结果和任何 GLM 改动。
