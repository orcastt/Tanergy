# TANGENT Web Alpha Detailed Development Plan

**Date**: 2026-04-29  
**Status**: Detailed execution plan for P0 Alpha  
**Owner**: Codex implements; user validates product feel and provides API/runtime inputs  
**Related docs**: `PRD.md`, `ARCH.md`, `project_state.md`, `dev-plans/web-collaborative-canvas-pivot.md`, `dev-plans/overseas-cost-growth-forecast.md`

---

## 1. 计划目的

这份文档回答三个问题：

1. **现在开发到哪里**：项目已从旧桌面/公众号路线切换到全新 Web AI 图像画布，准备进入技术 spike。
2. **我下一步做什么**：按端到端切片实现 P0 Alpha，从画布坐标开始，再做节点、生图、编辑、合并、AI Chat。
3. **你需要配合什么**：每个切片后看 demo、判断交互是否简单、提供测试 prompt/API 配置/上线偏好。

P0 Alpha 的核心目标只有一条：

```text
Prompt Node → Image Gen / Image Gen 4（可切换图片模型，单图或四图）→ Image Node
Image Node + Prompt Node → Image Gen（参考 / 编辑 / 融合）→ Image Node
Image Node + Prompt Node → Analysis → Prompt Node
Image Node → Canvas Markup → Merge Capture → New Image Node
Right AI Chat → 自动创建节点 → 自动连线 → 用户确认后 Run
```

P0 不追求完整协作、不做素材库、不做复杂管理后台、不做桌面客户端。

---

## 2. 当前开发基线

### 2.1 已完成

| 项 | 状态 |
|----|------|
| 旧代码隔离 | ✅ `legacy/old-tangent-desktop-2026-04-29/`，默认不读不改 |
| 新文档基线 | ✅ `PRD.md` / `ARCH.md` / `project_state.md` 已成为 canonical docs |
| 新目录骨架 | ✅ `apps/web/`、`services/api/`、`packages/shared/` |
| P0 范围 | ✅ Miro 式主画布 + 五类轻量节点 + 右侧 AI Chat + 图片模型切换 |
| 成本预测 | ✅ `dev-plans/overseas-cost-growth-forecast.md` |
| S0 Web 脚手架 | ✅ Next.js 16 + TypeScript + ESLint + tldraw |
| S1 Canvas Spike 初版 | ✅ `/spikes/canvas` 可打开，首轮 UI/交互反馈已收口；小 UI 暂停深抠 |
| S1.5 技术裁决门 | 🚧 已开始；先验证复杂节点、轻量 payload、端口、Inspector、自动布局和 Merge Capture |

### 2.2 当前未开始

| 项 | 状态 |
|----|------|
| tldraw 坐标 spike 手测 | ⏳ 已完成首轮修正；只做关键复测，不再继续抠小 UI |
| Step 1.5 复杂节点/端口 Spike | 🚧 开发中 |
| Web app 实际 UI | ⏳ 未实现 |
| Model Registry | ⏳ 未实现 |
| 后端 AI proxy | ⏳ 新 Web 路线未实现 |
| Image Editor 新实现 | ⏳ 未实现 |
| Merge Capture | ⏳ 未实现 |
| AI Chat 自动搭线 | ⏳ 未实现 |

---

## 3. 总体开发节奏

建议用 **7 个 Sprint** 推进，每个 Sprint 都要能独立验收。

| Sprint | 目标 | 预计工作量 | 是否可手测 | 主要风险 |
|--------|------|------------|------------|----------|
| S0 | 项目脚手架与质量闸门 | 0.5-1 天 | 是 | 依赖配置混乱 |
| S1 | Canvas 坐标技术 Spike | 1-2 天 | 是 | 缩放/拖动偏移 |
| S1.5 | 复杂节点与架构裁决 Spike | 1-2 天 | 是 | tldraw 端口/复杂交互不可接受 |
| S2 | 五类节点 UI 与连接规则 | 2-3 天 | 是 | 节点复杂度回流 |
| S3 | Model Registry + Mock 生图 | 1-2 天 | 是 | 模型参数写死 |
| S4 | 真实四图生成 + API Logs | 2-4 天 | 是 | 成本/失败处理 |
| S5 | Image Editor + Canvas Markup + Merge | 3-5 天 | 是 | 导出坐标与截图质量 |
| S6 | 右侧 AI Chat 自动搭线 | 2-4 天 | 是 | AI graph 不稳定 |
| S7 | Alpha 收口、部署、观测 | 2-3 天 | 是 | 登录/保存/部署细节 |

时间估计是工程节奏，不是承诺日期；遇到坐标偏移或 Provider 异常优先停下来修根因。

---

## 4. Sprint S0 — 项目脚手架与质量闸门

### 4.1 目标

建立可持续开发的最小 Web 项目：能启动、能构建、能 lint/typecheck，目录结构符合 `ARCH.md`。

### 4.2 我要做什么

1. 检查 `apps/web/` 当前骨架。
2. 决定是否补齐 Next.js + React + TypeScript + Tailwind + Zustand 基线。
3. 建立基础目录：

```text
apps/web/src/
├── app/
├── components/
│   ├── ui/
│   ├── canvas/
│   ├── chat/
│   ├── model-selector/
│   ├── nodes/
│   └── editor/
├── features/
│   ├── boards/
│   ├── canvas/
│   ├── ai-chat/
│   ├── ai-runs/
│   ├── model-registry/
│   └── assets/
├── lib/
├── services/
├── store/
└── types/
```

4. 加基础 i18n 文案结构，默认英文。
5. 加最小 smoke 页面，确认 Web app 能打开。
6. 确认 `package.json` scripts：
   - `dev`
   - `build`
   - `lint`
   - `typecheck`
   - `test` 如暂时没有测试，可先留占位或跳过并记录。

### 4.3 你需要做什么

- 确认是否接受 Next.js + tldraw + FastAPI 这条路线继续推进。
- 如果你希望优先部署到 Vercel / Cloudflare Pages / 自己 VPS，提前告诉我。

### 4.4 涉及文件

| 文件/目录 | 动作 |
|-----------|------|
| `apps/web/package.json` | 新增/修正 scripts 与依赖 |
| `apps/web/src/app/*` | 新建基础路由 |
| `apps/web/src/components/*` | 建目录与基础组件 |
| `apps/web/src/features/*` | 建功能模块目录 |
| `packages/shared/*` | 放共享类型，按需新增 |
| `project_state.md` | 更新阶段状态 |

### 4.5 验收标准

- `npm -C apps/web run dev` 能启动。
- `npm -C apps/web run build` 能通过。
- `npm -C apps/web run lint` 能通过或明确记录暂未配置原因。
- 根页面能看到 TANGENT 基础界面。
- 文件结构没有进入 legacy archive。

---

## 5. Sprint S1 — Canvas 坐标技术 Spike

### 5.1 目标

验证画布底层是否能避免旧项目最大痛点：缩放、resize、拖动、框选、画笔、连线端口偏移。

这个 Spike 不只是技术试验，也是产品交互试验：TANGENT 的画布要先像一个轻量 Miro/FigJam 白板，再承载 AI 节点。用户应该可以在同一个画布里完成涂鸦、形状、便签、图片、链接卡片、箭头和 AI 节点卡片。

### 5.2 我要做什么

1. 在 `apps/web` 内实现一个独立 `/spikes/canvas` 或临时 Canvas 页面。
2. 接入 tldraw。
3. 验证 Miro/FigJam 式基础白板工具：
   - Pan / Zoom。
   - Select / Move / Resize / Rotate。
   - 自由画笔。
   - 橡皮。
   - 画笔颜色。
   - 画笔粗细。
   - 文本。
   - 便利贴 / Sticky note。
   - 矩形。
   - 圆形。
   - 线条。
   - 箭头。
   - Frame / 画框。
   - 图片对象。
   - 粘贴 URL 生成 link card，Spike 阶段可先 mock 标题和缩略图。
4. 实现以下 AI 节点卡片原型：
   - Prompt Card。
   - Generate Card。
   - Edit Card。
5. 验证 AI 节点卡片和普通白板对象能共存：
   - 同时选择。
   - 同时拖动。
   - 复制 / 删除。
   - 箭头连接普通对象。
   - 箭头连接 AI 节点卡片。
6. 编写坐标测试手册，覆盖：
   - 50% zoom。
   - 100% zoom。
   - 200% zoom。
   - 浏览器窗口 resize。
   - Retina / 高 DPI。
   - 拖动节点。
   - 框选多个对象。
   - 连线端口点击。
   - 图片上绘制。
   - 画笔颜色/粗细变化后落点是否仍准确。
   - link card / frame / shape 和 AI 卡片混选时是否偏移。
7. 如果 tldraw custom shape 不适合节点卡片，记录备选方案：
   - tldraw 单画布 + HTML overlay。
   - React Flow + whiteboard layer。
   - 自研轻量 canvas。

### 5.3 你需要做什么

- 看 demo 时重点判断：**有没有像 Miro/FigJam 那样自然，拖动和画笔是否跟手**。
- 判断白板工具是否够 P0：涂鸦、形状、便签、图片、箭头、画框、链接卡片是否已经能支撑“简单画一画”。
- 如果出现偏移，帮我描述复现步骤：缩放比例、浏览器尺寸、操作对象。
- 判断工具入口是否足够统一但不减功能：顶部图标工具栏要像 Excalidraw 一样保留完整基础白板入口。
- 判断同类工具是否被正确收纳：形状工具应合并为一个图标；箭头和直线应是独立图标，箭头入口只画箭头。
- 测试左下角导航地图：缩放百分比是否正确，加号/减号是否能缩放，点击地图不同位置是否能跳转到对应画布区域。
- 测试箭头吸附：矩形、圆形、Frame、图片、卡片是否吸到边中点；三角形、菱形是否吸到角点；箭头工具靠近对象但还没按下鼠标时，对象轮廓和候选捕捉点是否预高亮；拖拽时 source / target 捕捉点是否高亮，靠近形状边缘或端口时是否足够灵敏，而不是默认吸到中心点。
- 测试左键绘制工具：画完一个对象后是否回到 Select，并选中最后创建的对象。
- 测试右键绘制工具：能否连续绘制多个对象，不能出现需要手动解锁的状态，Esc 后必须退出并选中本轮新增对象。
- 判断左侧属性面板是否只在选中对象且没有拖动画布时出现；拖动画布或空选时不应常驻打扰。
- 判断左侧属性面板是否能用清晰图标控件编辑最后创建/选中图形的描边、填充、宽度、线型、线条风格、箭头类型、端点、字体、透明度、对齐、图层和操作。
- 缩小 AI/link card 时观察标题、URL、详情是否溢出边界。
- 复制 Pinterest 等外部图片时先测 3-5 张，再测 5-10 张，观察是否明显卡顿或长时间无响应。

### 5.4 涉及文件

| 文件/目录 | 动作 |
|-----------|------|
| `apps/web/src/app/spikes/canvas/page.tsx` | 新建 spike 页面 |
| `apps/web/src/components/canvas/*` | 新建画布容器与测试工具 |
| `apps/web/src/components/canvas/AiCardShape.tsx` | Prompt / Generate / Edit / Link card 自定义卡片 |
| `apps/web/src/components/canvas/CanvasSpikeToolbar.tsx` | Spike 白板工具入口 |
| `apps/web/src/components/canvas/canvasSeed.ts` | 初始化白板对象、图片、链接卡片、AI 卡片 |
| `apps/web/src/features/canvas/*` | 坐标转换/viewport helper |
| `dev-plans/web-alpha-detailed-development-plan.md` | 标记 spike 结论 |

### 5.5 验收标准

- 可以 pan / zoom。
- 可以像轻量 Miro/FigJam 一样添加文本、便利贴、矩形、圆形、线条、箭头、Frame / 画框。
- 可以自由画笔绘制，并能改变颜色和粗细。
- 可以放置图片对象。
- 可以粘贴 URL 生成 link card；Spike 阶段可用 mock metadata。
- 可以放置 Prompt / Generate / Edit AI 节点卡片。
- AI 节点卡片和普通白板对象可以混选、拖动、复制、删除。
- 可以箭头连接普通形状，也可以箭头连接 AI 节点卡片。
- 50% / 100% / 200% 缩放下点击、拖动、框选、画笔、连线端口不偏移。
- resize 后对象位置、选择框、连线端口不漂移。
- Retina / 高 DPI 下画笔落点准确。
- 工具入口接近 Excalidraw：顶部图标工具栏集中显示，不和 tldraw 默认 UI 重叠，并保留完整基础白板工具。
- 形状工具合并为类别入口；箭头和直线是独立图标，箭头入口只画箭头。
- 箭头连接矩形、圆形、Frame、图片、卡片时吸附到边中点；连接三角形、菱形时吸附到角点；箭头工具 hover 对象时轮廓和候选捕捉点预高亮；拖拽时 source / target 捕捉点高亮。
- 左侧属性面板只在有选中对象且没有拖动画布时出现，能用清晰图标控件编辑样式、线条风格、箭头类型、端点、透明度、对齐、图层和操作。
- 左键选择绘制工具后只绘制一次，完成后回到 Select，并选中最后创建对象。
- 右键选择绘制工具后可连续绘制，不出现需要手动解锁的状态，Esc 强制退出后选中本轮新增对象。
- card 缩小后文本自适应裁切或折叠，不穿出边界。
- 粘贴多张外部图片时有大小/长边限制或提示，不让浏览器长时间卡死。
- 若不通过，先暂停功能开发，修坐标或换技术方案。

### 5.6 当前实现结果

| 项 | 结果 |
|----|------|
| 本地入口 | `http://localhost:3000/spikes/canvas` |
| Web 脚手架 | Next.js 16 + TypeScript + ESLint |
| Canvas 引擎 | tldraw |
| 白板对象 | 文本、便利贴、矩形、圆形、菱形、线条/箭头、Frame、图片 |
| Link card | 已用 mock metadata 自定义卡片验证 |
| AI 卡片 | 已实现 Prompt / Generate / Edit custom shape |
| 工具条 | 已隐藏 tldraw 默认分散 UI；自定义为 Excalidraw-like 顶部图标工具栏；形状与插入类收纳为弹出菜单，箭头和直线为独立图标 |
| 导航地图 | 左下角自定义 minimap 已恢复，显示 viewport、缩放百分比和加号/减号，支持点击地图跳转 |
| 箭头吸附 | 已增加边中点/角点吸附、对象轮廓预高亮、source / target 捕捉点高亮和主动端口命中，避免默认只吸附形状中心 |
| 属性面板 | 左侧面板仅在有选中对象且没有拖动画布时出现，避开顶部工具栏和左下导航地图，使用清晰图标控件编辑描边、填充、宽度、线型、线条风格、箭头类型、端点、字体、透明度、对齐、图层和操作；右侧保留给 AI Chat |
| 绘制行为 | 左键工具单次绘制后回 Select；右键工具连续绘制，不暴露 Lock；Esc 强制退出并选中本轮新增对象 |
| Card 自适应 | AI/link card 内容层已做 line clamp、长 URL 断行和小尺寸折叠 |
| 图片粘贴限制 | Spike 阶段限制 PNG/JPEG/WebP，单图 3MB，长边 1280px，后续仍需测 Pinterest 多图粘贴 |
| 质量检查 | `npm -C apps/web run lint`、`npm -C apps/web run typecheck`、`npm -C apps/web run build`、`git diff --check` 已通过 |
| 状态 | 已根据手测反馈收口工具栏、卡片文本和粘贴图片限制；等待复测 |

---

## 6. Sprint S1.5 — 复杂节点与架构裁决 Spike

### 6.1 目标

在正式五类节点链路前，用最小 POC 验证 tldraw-first 是否能承载后续越来越复杂的 AI 节点。这个 Sprint 是技术裁决门，不是正式产品功能。

必须验证：

- 复杂节点内部交互不误触画布。
- 端口/Handle 能否支撑基础连接规则。
- Node Runtime / Node Registry 能否把业务数据和画布渲染分开。
- 左侧 Inspector 能否承载复杂参数，避免节点卡片膨胀。
- React HTML 节点能否按组合模式拆成可维护组件，而不是形成单个超级节点文件。
- 节点和 `shape.props` 能否保持轻量，只存 id、短参数、端口、布局和运行摘要。
- AI Chat / mock planner 自动布局能否把节点放到当前视野。
- Merge Capture 能否输出纯净图片。
- 50-100 节点压力下拖拽和缩放是否可接受。
- 粘贴/导入 5-10 张外部大图后，画布是否仍可操作；如果不可接受，必须在正式图片入口前增加更强的压缩、缩略图和懒加载策略。

### 6.1.1 Gemini 架构复盘采纳结论

采纳：

- 节点是显示器/控制器，不是数据库；图片、长文本、原始响应和日志外置。
- 图片统一走 Asset 层，节点保存 `asset_id`，展示时按需解析 URL。
- 复杂节点使用 React 组合模式拆分 `NodeContainer`、header、body、footer、工具组件。
- 协同后使用 document / presence / server authoritative / local UI 四类状态拆分。
- Presence 不落 PostgreSQL；软锁可用于提示“谁正在编辑节点”。
- AI 成本需要硬额度、模型开关、默认低成本参数和全局熔断。

需要修正或谨慎：

- tldraw 的视窗剔除有价值，但不能保证复杂节点和图片密集画布一定不卡；必须用生产构建压力测试。
- CRDT 不是简单的“最后写入生效”；它保证文档最终一致，但业务冲突仍要定义规则。
- 软锁只是 UI 防碰撞，不能替代后端权限、扣费和 Asset 写入校验。
- 文档里最好优先存 `asset_id`，不要只存公开 URL；隐私图片需要授权 URL 或不可猜测路径。
- 成本推算要按月总量核算；例如 `$100/月` 且 `$0.005/张` 只能覆盖约 `20,000 张/月`，不是 `20,000 张/天`。

### 6.2 我要做什么

1. 在 `apps/web` 增加 Step 1.5 spike 页面或扩展 `/spikes/canvas`。
2. 建立最小 Node Registry：
   - `type`
   - `version`
   - `ports`
   - `paramsSchema`
   - `defaultData`
   - `validate`
   - `migrate`
3. 建立节点轻量 payload 约束：
   - `shape.props` 只保存 id、短参数、端口、布局和摘要。
   - mock 图片结果只保存 `asset_id` / thumbnail url，不保存 Base64。
   - 长 prompt 分析、反推 prompt、运行日志用 `run_id` / `result_id` 引用。
4. 实现五类 P0 节点原型：
   - Prompt：prompt 输入、text 输入端口、text 输出端口、四角缩放。
   - Image Gen：text 输入、多 image 输入、动态 image 端口、模型/分辨率/比例、1 图 mock 结果。
   - Image Gen 4：同 Image Gen 参数，同一 prompt 调用 4 次，4 图 mock 结果。
   - Analysis：image 输入、prompt 输入、默认 `分析这个图片，反推提示词`、text 输出。
   - Image：无运算，只承接和预览上游 image asset，可四角缩放。
5. 实现左侧 Inspector 原型：
   - 选中节点显示参数。
   - 未选中显示空状态。
   - 滚轮、输入、下拉不触发画布 pan/zoom。
6. 实现端口与连接规则验证：
   - Prompt → Image Gen / Image Gen 4 合法。
   - Image → Image Gen / Image Gen 4 合法。
   - Image → Analysis 合法。
   - Analysis → Prompt / Image Gen / Image Gen 4 合法。
   - text 端口和连线为黄色；image 端口和连线为绿色。
   - Image Gen / Image Gen 4 每多连入一个 image 自动增加一个空 image 输入端口。
   - 鼠标靠近 node-node 连线时，中点显示 `−` 并可断开。
   - 非法连线自动断开并提示。
7. 实现 mock planner 自动布局：
   - 插入 3-4 个节点。
   - 放到当前 viewport 附近。
   - 横向排布，不重叠。
8. 实现 Merge Capture 最小验证：
   - 图片 + 笔迹 + 形状。
   - 输出不包含 UI、选择框、网格。
9. 做 50-100 节点压力测试：
   - 测可见区域内 50-100 个复杂节点。
   - 测画布外节点是否被有效剔除。
   - 记录 document payload 大小和浏览器内存体感。
10. 做外部图片粘贴压力测试：
   - 从 Pinterest / 浏览器复制图片进入画布。
   - 单次 3-5 张、连续 5-10 张。
   - 记录文件大小、图片尺寸、浏览器响应和内存体感。

### 6.3 你需要做什么

- 判断复杂节点是否依然小白，不像专业工程工具。
- 测试节点内下拉、输入、按钮、滚轮是否会误拖动画布。
- 判断左侧 Inspector 是否比把所有参数塞进节点更清爽。
- 如果你希望节点更精致，指出你觉得“不高级”的具体位置：间距、颜色、按钮、状态、缩略图还是连线。

### 6.4 涉及文件

| 文件/目录 | 动作 |
|-----------|------|
| `apps/web/src/app/spikes/canvas/page.tsx` 或新 spike route | 承载 Step 1.5 demo |
| `apps/web/src/components/canvas/*` | 复杂节点容器、端口、布局测试 |
| `apps/web/src/components/inspector/*` | 新建 Inspector 原型 |
| `apps/web/src/components/nodes/*` | 新建复杂节点原型 |
| `apps/web/src/features/node-runtime/*` | 新建 Node Registry、连接规则、校验 |
| `apps/web/src/types/board.ts` | 节点、端口、边、参数 schema 类型 |
| `ARCH.md` | 根据 spike 结果确认继续 tldraw 或切换方案 |
| `project_state.md` | 更新下一步和风险 |

### 6.5 验收标准

- Prompt / Image Gen / Image Gen 4 / Analysis / Image 可渲染、可选中、可拖动、可按需缩放。
- 节点内部控件不触发画布 pan / zoom / drag。
- 端口可视，合法连线保留，非法连线自动断开。
- text / image 端口和连线颜色正确，动态 image 输入端口稳定不漂移。
- node-node 连线靠近时显示 `−` 断开按钮。
- Inspector 可显示和编辑选中节点参数。
- mock planner 自动插入的节点在当前视野中且不重叠。
- Merge Capture 输出纯净图片，不截到 UI。
- 50-100 节点压力测试可接受。
- 节点 `shape.props` / document payload 不包含 Base64、大图、长日志、Provider 原始响应。
- 连续粘贴 5-10 张外部图片时不长时间卡死；若卡顿明显，需要先加入更强的降采样/缩略图策略。
- 若失败，必须先更新 `ARCH.md` 技术决策，再决定是否切 React Flow + Konva / whiteboard layer。

### 6.6 当前实现进度

| 项 | 状态 |
|----|------|
| Node Runtime 类型 | ✅ 已新增 `NodeType`、端口、运行摘要、Inspector field 类型 |
| Node Registry | ✅ 已切换为 Prompt / Image Gen / Image Gen 4 / Analysis / Image 注册表 |
| 轻量 payload audit | ✅ 已新增 Base64 / `data:` / `blob:` / 长文本检查 |
| 复杂节点 shape | ✅ 已新增 `node_card` tldraw custom shape + React HTMLContainer |
| Image Gen / Image Gen 4 mock | ✅ 节点内模型、比例、分辨率、Run mock、1 图 / 4 图 asset id 结果态 |
| 左侧 Inspector | ✅ 选中 `node_card` 时显示参数、端口、payload guard 和连接反馈 |
| 端口吸附 | ✅ `node_card` 使用左右语义端口，接入现有箭头吸附高亮 |
| 连接规则 | ✅ Prompt → Image Gen、Image → Image Gen、Image → Analysis、Analysis → Prompt 合法；非法 node-node 箭头自动删除 |
| 类型颜色 | ✅ text 端口/连线为黄色，image 端口/连线为绿色 |
| 动态端口 | ✅ Image Gen / Image Gen 4 的 image 输入会随连接数增加，保留一个空端口，P0 上限 6 |
| 断连交互 | ✅ 鼠标靠近 node-node 连线时中点显示 `−`，点击删除连接 |
| mock planner graph | ✅ 工具栏可插入 6 个 mock 节点并自动布局到当前 viewport |
| 压力测试入口 | ✅ 工具栏可插入 60 个 node cards 做初步压力测试 |
| Merge Capture | ✅ 已新增选中对象本地导出预览；data URL 只放 React local state，不写入 document |
| 图片密集压力 | ⏳ 尚未完成手测，仍需 5-10 张外部图片验证 |

已实现文件索引：

| 文件 | 作用 |
|------|------|
| `apps/web/src/types/nodeRuntime.ts` | 节点、端口、运行摘要、Inspector 字段类型 |
| `apps/web/src/types/nodeCardShape.ts` | `node_card` shape 类型 |
| `apps/web/src/features/node-runtime/registry.ts` | P0 五类节点注册表、默认数据和动态端口 |
| `apps/web/src/features/node-runtime/connectionRules.ts` | P0 节点连接规则 |
| `apps/web/src/features/node-runtime/payloadAudit.ts` | 轻量 payload 检查 |
| `apps/web/src/features/node-runtime/createNodeCard.ts` | 创建 node card shape |
| `apps/web/src/features/node-runtime/createMockWorkflow.ts` | mock planner graph 和 60 节点压力入口 |
| `apps/web/src/features/node-runtime/useNodeConnectionValidation.ts` | 箭头连接实时校验 |
| `apps/web/src/components/nodes/NodeCardShape.tsx` | tldraw custom shape |
| `apps/web/src/components/nodes/NodeCardContent.tsx` | 节点内部 React UI |
| `apps/web/src/components/inspector/CanvasNodeInspector.tsx` | 左侧节点 Inspector |
| `apps/web/src/components/canvas/CanvasMergeCapturePanel.tsx` | Merge Capture 本地预览验证 |

---

## 7. Sprint S2 — 五类节点 UI 与连接规则

### 7.1 目标

做出最小可理解的节点链路，不接真实 AI 也能完整模拟：Prompt → Image Gen / Image Gen 4 → Image，以及 Image → Analysis → Prompt。

### 7.2 我要做什么

1. 实现 Canvas Editor 基础页面：`/boards/:boardId`。
2. 实现 Node Picker，只显示：
   - Prompt Node。
   - Image Gen Node。
   - Image Gen 4 Node。
   - Analysis Node。
   - Image Node。
3. 实现节点 UI：
   - Prompt Node：输入 prompt，text 输入/输出端口。
   - Image Gen Node：模型选择入口、比例/分辨率、动态 image 输入端口、Run 按钮、1 图 skeleton / mock result。
   - Image Gen 4 Node：同 Image Gen 参数，4 图 skeleton / mock results。
   - Analysis Node：默认分析 prompt、image 输入、text 输出。
   - Image Node：图片预览、Download、Send to Canvas、Open Preview。
4. 实现连接规则：
   - Prompt → Image Gen / Image Gen 4。
   - Image → Image Gen / Image Gen 4。
   - Image → Analysis。
   - Analysis → Prompt / Image Gen / Image Gen 4。
   - Image Gen / Image Gen 4 result 点击创建 Image Node。
5. 加撤销/删除基础操作，如果 tldraw 原生支持则复用。

### 7.3 你需要做什么

- 看五类节点名称是否足够小白。
- 判断按钮文案是否清楚，例如 `Generate 4 images`、`Send to Canvas`、`Open Editor`。
- 如果你觉得节点太复杂，要在这一步砍掉，不要等后面。

### 7.4 涉及文件

| 文件/目录 | 动作 |
|-----------|------|
| `apps/web/src/app/boards/[boardId]/page.tsx` | Canvas 页面 |
| `apps/web/src/components/nodes/PromptNode.tsx` | Prompt Node |
| `apps/web/src/components/nodes/ImageGenNode.tsx` | Image Gen / Image Gen 4 Node |
| `apps/web/src/components/nodes/AnalysisNode.tsx` | Analysis Node |
| `apps/web/src/components/nodes/ImageNode.tsx` | Image Node |
| `apps/web/src/components/canvas/NodePicker.tsx` | Node Picker |
| `apps/web/src/features/canvas/connectionRules.ts` | 连接规则 |
| `apps/web/src/types/board.ts` | 节点与边类型 |

### 7.5 验收标准

- 空画布有 `Add Prompt Node` / `Ask AI` 引导。
- 用户能手动创建五类节点。
- Prompt Node 能输入 prompt。
- Image Gen / Image Gen 4 未连接 Prompt 时提示 `Connect a prompt first.`。
- 连接 Prompt → Image Gen / Image Gen 4 后 Run 可用。
- Run 使用 mock 数据显示 1 张或 4 张图。
- 点击缩略图创建 Image Node。
- Image Node 可连接 Image Gen / Image Gen 4 / Analysis。
- Analysis 可输出 text 给 Prompt 或生成节点。
- Node Picker 不出现视频、音频、PDF、3D、素材库、公众号节点。

---

## 8. Sprint S3 — Model Registry + 模型选择器

### 8.1 目标

先建立统一模型管理入口，避免模型参数散落在组件里。真实 API 前先用 mock registry 跑通 UI。

### 8.2 我要做什么

1. 实现 `ModelOption` 类型。
2. 实现 mock registry：

```text
gpt-image-2
- quality: low / medium / high
- size: 1024x1024 / 1024x1536 / 1536x1024
- default for tests: quality low

gemini-3.1-flash-image-preview
- image_size: 0.5K / 1K / 2K / 4K
- aspect_ratio: 1:1 / 4:3 / 16:9 / 5:4
- default for tests: 0.5K
```

3. 实现 `ModelSelector` 组件。
4. Image Gen / Image Gen 4 Node 接入 `ModelSelector`。
5. AI Chat composer 预留同一份 `ModelSelector`。
6. disabled 模型显示但不能运行。
7. 生成请求草稿带 `selected_model_id`。

### 8.3 你需要做什么

- 确认 P0 展示的模型名是否用：
  - `GPT Image 2`
  - `Gemini 3.1 Flash Image Preview`
- 确认测试默认只用最低成本配置。

### 8.4 涉及文件

| 文件/目录 | 动作 |
|-----------|------|
| `apps/web/src/features/model-registry/modelOptions.ts` | mock registry |
| `apps/web/src/types/model.ts` | ModelOption 类型 |
| `apps/web/src/components/model-selector/ModelSelector.tsx` | 模型选择器 |
| `apps/web/src/components/nodes/ImageGenNode.tsx` | 接入模型选择 |
| `apps/web/src/components/chat/ChatComposer.tsx` | 预留接入 |
| `packages/shared/model-registry.ts` | 如需要，放共享 schema |

### 8.5 验收标准

- Image Gen / Image Gen 4 Node 可以切换模型。
- 同一份模型列表可被 AI Chat composer 使用。
- GPT Image 2 显示 quality / size。
- Gemini 显示 image_size / aspect_ratio。
- 不可用模型 disabled。
- 没有任何 Provider Key 出现在前端。

---

## 9. Sprint S4 — 真实四图生成 + API Logs

### 9.1 目标

把 mock 结果替换为真实 AI 生成，并记录 user / board / model / params / cost / latency / status。

### 9.2 我要做什么

1. 建立后端 AI run API：
   - `GET /api/v1/ai/models?capability=image_generation`
   - `POST /api/v1/ai/runs`
   - `GET /api/v1/ai/runs/{run_id}`
2. 接 GeekAI provider，但 API Key 只在服务端 `.env`。
3. 实现两个 provider adapter：
   - GPT Image 2：`/images/generations`。
   - Gemini 3.1 Flash Image Preview：`/chat/completions`。
4. 默认测试参数：
   - GPT Image 2：`quality=low`。
   - Gemini：`image_size=0.5K`。
5. 成功后把图片保存为 Asset。
6. 前端 Image Gen / Image Gen 4 Node 显示 loading、success、failed。
7. 失败不创建空 Image Node。
8. 记录 API Call Log。
9. 加基础限流：单用户同一时间最多 1 个 running generation。

### 9.3 你需要做什么

- 提供或确认 `GEEKAI_API_KEY` 在本地 `.env` 可用。
- 给 3-5 个英文测试 prompt，例如社媒海报、产品图、logo moodboard。
- 每次真实测试前确认可以消耗少量余额。

### 9.4 涉及文件

| 文件/目录 | 动作 |
|-----------|------|
| `services/api/` 或新后端目录 | AI run API |
| `services/api/app/providers/geekai.py` | GeekAI adapter |
| `services/api/app/models/ai_run.py` | AI run / log model |
| `services/api/app/models/asset.py` | Asset model |
| `apps/web/src/services/aiRuns.ts` | 前端 API client |
| `apps/web/src/features/ai-runs/*` | run hooks/state |
| `apps/web/src/components/nodes/ImageGenNode.tsx` | 真实调用接入 |

### 9.5 验收标准

- 前端不包含真实 GeekAI API Key。
- Prompt → Image Gen 4 可以生成 4 张图；Prompt → Image Gen 可以生成 1 张图。
- 点击缩略图创建 Image Node。
- GPT Image 2 low 能跑通。
- Gemini 0.5K 能跑通或明确记录上游错误。
- API Log 记录模型、参数、耗时、费用、状态。
- 余额不足 / 模型不可用 / provider 超时都有明确错误。

---

## 10. Sprint S5 — Image Editor + Canvas Markup + Merge Capture

### 10.1 目标

用户能把生成图拿去手动画几笔，然后导出为新的 Image Node；也能发送到画布涂改后合并。

### 10.2 我要做什么

1. 实现轻量 Image Editor modal 或 screen：
   - 显示输入图片。
   - 画笔。
   - 橡皮。
   - 颜色。
   - 笔刷大小。
   - Clear。
   - Export。
2. Export 输出 PNG / WebP，上传为 Asset。
3. Export 后创建新的 Image Node。
4. 实现 Image Node → Send to Canvas。
5. 画布图片对象可移动、缩放。
6. 用户可在图片上绘制标注。
7. 实现 Merge Capture：
   - 选中图片对象和笔迹。
   - 使用 world bounds 离屏渲染。
   - 不截 UI / 网格 / 选择框。
   - 上传输出 Asset。
   - 创建新 Image Node。

### 10.3 你需要做什么

- 手动画几笔，判断工具是否够用。
- 明确 P0 是否只要画笔/橡皮/清空/导出，不加图层、选择工具、局部 AI 编辑。
- 看合并出的图片是否符合预期。

### 10.4 涉及文件

| 文件/目录 | 动作 |
|-----------|------|
| `apps/web/src/components/editor/ImageEditorModal.tsx` | 编辑器 UI |
| `apps/web/src/components/editor/DrawingCanvas.tsx` | 绘图层 |
| `apps/web/src/features/assets/uploadAsset.ts` | 上传导出结果 |
| `apps/web/src/features/canvas/sendImageToCanvas.ts` | 图片发送到画布 |
| `apps/web/src/features/canvas/mergeCapture.ts` | 离屏合并 |
| `apps/web/src/components/nodes/ImageNode.tsx` | Send / Preview / Download |
| `apps/web/src/components/nodes/ImageEditorNode.tsx` | Open Editor |

### 10.5 验收标准

- Image Editor 未连接图片时不可打开。
- 连接图片后可打开并显示图片。
- 画笔和橡皮可用。
- Export 创建新 Image Node。
- Export 不包含 UI、网格、选框。
- Send to Canvas 后图片出现在当前视野。
- 在图片上绘制不偏移。
- Merge Capture 创建新 Image Node。
- 原图和笔迹保留。

---

## 11. Sprint S6 — 右侧 AI Chat 自动搭线

### 11.1 目标

让小白用户不用理解 Node Picker，也能通过一句话得到可运行节点链路。

### 11.2 我要做什么

1. 实现右侧 AI Chat sidebar：
   - 可收起。
   - 空状态欢迎语。
   - 2-3 个建议 prompt。
   - message list。
   - composer。
2. Composer 支持：
   - 文本输入。
   - `Auto` / `Image` 模式。
   - 图片模型选择。
   - 图片上传入口。
   - Send。
3. 实现最小 AI Planner API：
   - 输入自然语言。
   - 返回 graph spec。
   - graph 只允许 P0 节点。
4. 前端校验 graph：
   - 节点类型合法。
   - 连线合法。
   - 节点数量合理。
   - `selected_model_id` 合法。
5. 应用 graph 到当前 viewport 附近。
6. 支持撤销 AI 创建的一组节点。
7. Planner 失败时不修改画布。

### 11.3 你需要做什么

- 提供 3-5 个“小白一句话”场景。
- 看自动创建的节点是否足够直观。
- 判断右侧面板宽度、文案、入口是否干净。

### 11.4 涉及文件

| 文件/目录 | 动作 |
|-----------|------|
| `apps/web/src/components/chat/AiChatSidebar.tsx` | 右侧面板 |
| `apps/web/src/components/chat/ChatComposer.tsx` | 输入区 |
| `apps/web/src/features/ai-chat/useAiChat.ts` | chat state/hook |
| `apps/web/src/features/ai-chat/applyGraphSpec.ts` | 应用 graph |
| `apps/web/src/features/ai-chat/validateGraphSpec.ts` | graph 校验 |
| `services/api/app/api/ai_planner.py` | planner API |
| `packages/shared/graph-spec.ts` | graph spec 类型 |

### 11.5 验收标准

- Canvas 右侧显示可收起 AI Chat。
- 输入一句话后自动创建 Prompt / Image Gen / Image Gen 4 / Analysis / Image。
- 节点自动连线。
- 节点出现在当前视野。
- Composer 选择的模型写入 Image Gen / Image Gen 4 Node。
- 非法 graph 不写入画布。
- 用户可以撤销 AI 创建的节点组。

---

## 12. Sprint S7 — Alpha 收口、部署、观测

### 12.1 目标

把 P0 Alpha 做成可以给小范围用户试用的 Web 产品。

### 12.2 我要做什么

1. Dashboard / Board 列表：
   - New Board。
   - Recent Boards。
   - Rename。
   - Open Board。
2. 保存策略：
   - Board document_state debounce 保存。
   - 生成结果、导出、合并后立即保存。
3. 登录 / 开发模式：
   - P0 可先用现有认证或 dev auth。
   - 正式 Alpha 前启用邮箱/Google 登录。
4. 基础 analytics events：
   - `signup_completed`。
   - `board_created`。
   - `node_created`。
   - `generation_started`。
   - `generation_succeeded`。
   - `generation_failed`。
   - `editor_exported`。
   - `merge_capture_created`。
5. 基础成本保护：
   - 每用户每日免费次数。
   - 全局每日 AI spend cap。
   - 模型开关。
6. 部署：
   - Web: Vercel / Cloudflare Pages。
   - Backend: Render / Fly.io / VPS。
   - Storage: R2 / S3-compatible。
7. 写 Alpha 手测清单。

### 12.3 你需要做什么

- 确认部署平台偏好。
- 确认 Alpha 试用人数和邀请方式。
- 确认免费额度，比如每人每天 3 次或每月 10 次。
- 准备 Privacy Policy / Terms 的初版口径，或者让我先写占位文案。

### 12.4 涉及文件

| 文件/目录 | 动作 |
|-----------|------|
| `apps/web/src/app/boards/page.tsx` | Dashboard |
| `apps/web/src/features/boards/*` | Board CRUD |
| `apps/web/src/services/boards.ts` | Board API client |
| `services/api/app/api/boards.py` | Board API |
| `services/api/app/services/budget_limits.py` | AI 限额 |
| `apps/web/src/lib/analytics.ts` | 事件追踪 |
| `.env.example` | 环境变量模板 |
| `README.md` | 本地启动和部署说明 |

### 12.5 验收标准

- 新用户能进入 Dashboard。
- 能创建 Board 并进入 Canvas。
- Board 刷新后不丢节点。
- 完整链路能跑通：Prompt → Image Gen 4 → Image，以及 Image → Analysis → Prompt；Canvas Markup → Merge Capture → New Image。
- AI Chat 能自动搭线。
- API Key 不在前端。
- AI 调用有日志和额度限制。
- 可以部署到 staging。

---

## 13. 横向质量要求

每个 Sprint 都要遵守：

| 类别 | 要求 |
|------|------|
| 文件大小 | 源码单文件目标 < 300 行，250 行预警；超过 300 行不能继续加功能，必须先拆分或在本计划记录临时例外；禁止 1000 行级源码文件 |
| 代码最小化 | 每轮更新只让文件承接单一职责；UI、hook、纯函数、类型、样式趁早拆，不把功能堆进一个大组件 |
| Git checkpoint | 阶段性开发动作、大范围修复或高风险重构前先提交当前稳定快照，再继续修复 |
| UI 风格 | 干净白板、小卡片、轻边框，遵守 `reference/design-system.md` 和 `reference/theme.ts` |
| i18n | 用户可见文案走 i18n key，默认英文 |
| 安全 | API Key 只在服务端，前端只调用自己的 API |
| 模型 | 模型能力来自 Model Registry，不写死到节点组件里 |
| 坐标 | 所有对象用 world 坐标；禁止多套 transform 打架 |
| 成本 | 默认低成本参数；真实调用前确认测试成本 |
| legacy | 不主动读取或修改 legacy archive |

---

## 14. 每次切片完成后的固定流程

1. 对照本计划和 `PRD.md` 验收项手测。
2. 运行对应质量检查：
   - `npm -C apps/web run build`
   - `npm -C apps/web run lint`
   - `npm -C apps/web run typecheck`
   - 后端改动跑对应 pytest 或最小 API 检查。
   - `git diff --check`
3. 更新：
   - `project_state.md`
   - 当前 dev plan 的完成状态。
   - 如架构变化，更新 `ARCH.md`。
   - 如产品范围变化，更新 `PRD.md`。
4. 你验收 demo。
5. 你明确说提交时，我再 `git commit`。

---

## 15. 你和我的分工

### 15.1 我负责

- 拆任务、写代码、更新文档。
- 保持新项目干净，不引入旧代码复杂度。
- 做最小可验收实现，不偷加功能。
- 每个切片后说明改了什么、怎么测、还有什么风险。
- 遇到两次无新证据的报错排查时停下来，换策略。

### 15.2 你负责

- 判断产品是否“够简单、够小白”。
- 提供真实测试 prompt。
- 确认 API Key / 额度 / 模型可用性。
- 决定免费额度、Alpha 用户规模、部署平台。
- 手测关键体验：拖动是否偏、画笔是否跟手、节点是否好懂。

---

## 16. 当前下一步

当前下一步：**Sprint S1 关键复测 + Sprint S1.5 技术裁决 Spike**。S1 画布小 UI 先停在当前状态，不继续抠图标细节；除非复测发现阻塞级偏移、卡顿或误触，否则优先进入复杂节点架构验证。

执行顺序：

1. 你打开 `http://localhost:3000/spikes/canvas` 只复测 S1 的关键项：pan / zoom / drag / selection / arrow / drawing 是否偏移，外部多图粘贴是否卡死。
2. 如果没有阻塞级问题，S1 暂时冻结；小 UI polish 放入后续 backlog。
3. 我实现 Sprint S1.5：复杂节点、轻量节点 payload、端口、Inspector、自动布局、Merge Capture。
4. S1.5 通过后，才进入 Sprint S2 五类节点 UI。
5. S1.5 若失败，先更新 `ARCH.md`，再决定是否切 React Flow + Konva / whiteboard layer。

你现在只需要准备：

- 手测 Step 1 的偏移反馈。
- 你觉得“精致节点”应该更像哪类产品：Miro app card、Figma plugin panel、ComfyUI node、还是 Linear-style card。
- Step 1.5 中复杂节点参数哪些必须露在节点内，哪些可以放左侧 Inspector。
