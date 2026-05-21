# Web AI Image Canvas Pivot Plan

**日期**: 2026-04-29
**状态**: Archived Web-first pivot 历史基线；当前执行状态以 `project_state.md` / `dev-plans/README.md` / `dev-plans/Asset-lod-roadmap.md` 为准
**对应 PRD**: `PRD.md`
**对应架构**: `ARCH.md`
**详细执行计划**: `dev-plans/web-alpha-detailed-development-plan.md`
**当前主线**: S1.5 已稳定，Asset LOD Slice A-D 已落地，Slice D 跨平台质量门 pass with notes；下一步是 Slice E Real Asset Pipeline，且在多人协作前完成

---

## 0. 当前对齐说明（2026-04-30）

这份文件现在作为 2026-04-29 web-first pivot 的历史基线和阶段路线，不再是唯一执行看板。后续判断“现在做到哪、下一步做什么”，先看：

- `project_state.md`
- `dev-plans/Asset-lod-roadmap.md`
- `HARNESS.md`

已经对齐的事实：

- Step 1 Canvas 坐标 Spike 已完成，当前路线继续采用 tldraw-first 作为白板交互和布局底座。
- Step 1.5 复杂节点与架构裁决已通过，五类节点、Node Runtime、SVG runtime edges、Inspector、mock 数据流、动态 image 输入、fan-out、input replacement、断链交互、Merge Capture 本地闭环都已落地。
- Canvas image 和 Image Node 已能双向转换；Image Node 支持本地拖拽/双击导图，Merge Capture / Screenshot 可生成带预览的 Image Node。
- 当前主要瓶颈已从“节点交互能不能成立”转移到“多图多节点下的图片渲染和资产管线成本”。
- Asset LOD Roadmap 已成为当前主线：Slice A Image Node moving degrade、Slice B Node LOD、Slice C local asset preview resolver、Slice D ordinary canvas image LOD spike 和跨平台质量门已落地；Slice E real Asset Pipeline 是下一步，也是多人协作前置项。
- Windows 密集画布遗留卡顿是 non-blocking performance follow-up，不阻塞 Slice E。
- P0.5 多人协作仍然后置；协作前必须保证 Board document / CRDT 不同步 `data:`、`blob:`、Base64 或高清图二进制。
- Link card 预览图问题不靠前端直接加载第三方图片解决，后续走服务端 URL unfurl + image proxy / Asset 化。

这份 pivot 文档仍保留 P0 范围、阶段顺序和早期验收逻辑；凡是与上面状态冲突的旧措辞，以本节、`project_state.md` 和 `Asset-lod-roadmap.md` 为准。

---

## 1. 背景

收到反馈：当前产品功能太多、嵌套太深，用户理解成本高。旧路线同时包含桌面客户端、公众号工作流、Html Editor、Image Editor、Writer、素材库、Admin、复杂模型线路，已经不适合继续堆功能。

新方向：**Web-first 极简 AI 图像画布**。P0 不先做完整协作平台，而是先跑通最小图像链路：Prompt 节点 → 可切换图片模型的单图 / 四图生成 → Image 节点；Image + Prompt 可进入参考 / 编辑 / 融合生成；Image + Prompt 可进入 Analysis 反推提示词；画布标注后可截图合并成新 Image 节点。

补充决策：前端视觉方向不推翻。当前白色大画布、轻量节点卡片、简洁 Node Picker 的方向可以保留；真正要重构的是产品层级和画布交互复杂度。

补充决策：右侧 AI Chat 侧边栏进入 P0，但只作为“小白入口”：创建 Prompt / Image Gen / Image Gen 4 / Analysis / Image 节点、自动布局、自动连线、辅助 prompt，不做复杂 Agent。

补充决策：主画布优先保持 Miro/FigJam 式自由白板体验。节点会越来越复杂，但复杂参数、端口规则、运行状态必须由 Node Runtime / Inspector 管理，不让 tldraw 单独承担业务复杂度。

补充决策：在正式五类节点链路前插入 **Step 1.5 技术裁决 Spike**。如果 tldraw-first 无法稳定承载复杂节点、端口连线、自动布局或 Merge Capture，再评估 React Flow + Konva / whiteboard layer。

---

## 2. 当前备份状态

已在仓库外创建当前工作区快照：

`../TanvasAgent-backups/pivot-2026-04-29_065640`

备份包含：

- `git-status.txt`
- `tracked-unstaged.patch`
- `tracked-staged.patch`
- `untracked-files.tar.gz`
- `untracked-files.txt`
- `README.md`

说明：

- `.env` 等 ignored/secret 文件没有被打包。
- 当前仓库旧实现随后已移动到 `legacy/old-tangent-desktop-2026-04-29/`。
- Web 重启基线已提交并推送；本计划后续只记录新 Web 方向。

---

## 3. 决策建议

### 推荐做法

不要继续在旧项目里叠功能。旧路线已移动到 legacy archive；新实现从根目录干净骨架开始。

原因：

- 旧后端的 Provider、Model、Credits、ApiCallLog 只在明确需要时参考，不直接进入主动上下文。
- 旧代码保留在 legacy，可回收思路，不污染新实现。
- 新方向还需要 1-2 天产品验证，不能现在就做破坏性重构。

### 冻结范围

| 模块 | 状态 |
|------|------|
| Tauri 桌面端 | 冻结，不继续新增功能 |
| 公众号 Html Editor | 冻结 |
| Writer | 冻结 |
| 个人素材库 / Graph | 冻结 |
| Library / Personal Assets | 冻结，P0 不做 |
| 复杂 Admin Analytics | 冻结 |
| Provider / Model 后端 | legacy 参考，必要时提取最小实现 |

---

## 4. 新 MVP 范围

P0 只做以下闭环：

1. Web 登录。
2. 创建 Board。
3. 基础画布操作：选择、拖拽、缩放、pan、连线、画笔、图片对象。
4. Step 1.5 技术裁决：复杂节点、端口连线、自动布局、Merge Capture、50-100 节点压力。
5. Prompt Node：输入 prompt，有 text 输入/输出端口。
6. Image Gen Node：可切换图片模型，接收 text 和多 image 输入，生成 1 张图。
7. Image Gen 4 Node：参数同 Image Gen，同一 prompt 调用 4 次，生成 4 张图。
8. Analysis Node：接收 image 和 prompt，默认反推提示词，输出 text。
9. Image Node：承接上游图片 Asset，无运算，可预览、缩放、下载、发送到画布。
10. Canvas Markup：图片放到画布后可直接涂改。
11. Merge Capture：合并图片和笔迹，生成新的 Image Node。
12. 右侧 AI Chat 自动创建节点、自动布局、自动连线。
13. API 调用记录 user / model / cost / status / latency。

P0.5 再做多人协作 presence / realtime sync。

---

## 5. Step-by-step Guidance

### Step 0 — 方向确认

**你要做什么**

- 确认新定位是否接受：`Collaborative AI visual canvas for teams`。
- 确认是否彻底放弃桌面端作为 MVP。
- 确认海外优先，默认 English-first。
- 确认视觉方向保留现有干净白板 + 小卡片，不做大换皮。
- 确认 P0 先做单人最小图像链路，协作后移到 P0.5。

**我要做什么**

- 根据确认结果修订根目录 `PRD.md`。
- 把旧路线在 `project_state.md` 中标为 legacy/frozen。

**为什么**

如果这个方向不先锁定，继续写代码会再次变成多路线并行，复杂度会回来。

---

### Step 1 — Canvas 坐标技术 Spike

**目标**

先验证“白板底座”是不是能承担 TANGENT，而不是马上做完整业务。这个 Spike 要同时验证两类能力：

1. **Miro/FigJam 式基础白板能力**：用户能涂鸦、画形状、放便签、放图片、放链接卡片、用箭头连接。
2. **AI 节点画布能力**：同一个画布里能承载 Prompt / Generate / Edit 这类轻节点，并且缩放、拖拽、框选、连线不偏移。

**你要做什么**

- 不需要操作代码，只需要看 demo 后判断交互是否像你想要的 Miro/FigJam。
- 重点判断：画笔是否跟手、缩放是否自然、对象选择是否好懂、白板工具是否够小白。
- 重点判断：工具入口是否清爽统一，但不能删基础白板功能；顶部图标工具栏应接近 Excalidraw。
- 判断同类工具是否正确收纳：形状工具合并成一个入口；箭头和直线是独立图标，箭头入口只画箭头。
- 测试左下角导航地图：缩放百分比、加号/减号缩放和点击地图跳转是否符合预期。
- 测试箭头吸附：矩形、圆形、Frame、图片、卡片吸到边中点；三角形、菱形吸到角点；箭头工具靠近对象但还没按下鼠标时，对象轮廓和候选捕捉点预高亮；拖拽时 source / target 捕捉点高亮，靠近形状边缘或端口时足够灵敏，而不是默认吸到中心。
- 测试左键绘制工具：画完一个对象后是否回到 Select，并选中最后创建对象。
- 测试右键绘制工具：能否连续绘制多个对象，不能出现需要手动解锁的状态，Esc 后是否退出并选中本轮新增对象。
- 判断左侧属性面板是否只在选中对象且没有拖动画布时出现，并用清晰图标控件编辑样式、线条风格、箭头类型、端点、透明度、对齐、图层和操作。
- 缩小 link card / AI card 时看文字是否自适应裁切，不要穿出边界。
- 从 Pinterest / 浏览器粘贴多张图片时观察是否明显卡顿。
- 如果偏移或不好用，告诉我复现方式：缩放比例、窗口大小、操作对象、你点的位置和实际响应位置。

**我要做什么**

- 新建独立 Web Spike 页面，不先进入正式业务实现。
- 用 tldraw 做无限画布，并优先复用它的原生白板能力。
- 验证以下白板工具是否可用、是否能保持统一坐标：
  - Pan / Zoom。
  - Select / Move / Resize / Rotate。
  - 自由画笔 / 橡皮 / 改颜色 / 改粗细。
  - 文本。
  - 便利贴 / Sticky note。
  - 矩形 / 圆形 / 线条 / 箭头。
  - 图片对象。
  - Frame / 画框。
  - 复制链接变成可视化 link card（P0 Spike 可先 mock metadata）。
- 验证 custom shape 或 card shape 能否承载 AI 节点卡片：
  - 早期 Prompt / Generate / Edit 轻卡片。
  - 当前 Prompt / Image Gen / Image Gen 4 / Analysis / Image 五类节点卡片。
- 验证 Prompt / Generate / Edit 卡片能和普通白板对象共存、选择、拖动、复制、删除。
- 验证箭头能连接普通形状，也能连接 AI 节点卡片。
- 专门验证 50% / 100% / 200% 缩放、窗口 resize、Retina、高 DPI、拖拽、框选、连线端口是否偏移。
- 优先使用单画布引擎；如果尝试“绘图层 + 节点层”，必须证明两层共享同一个 world coordinate system。
- 输出 Spike 结论：继续 tldraw / tldraw + HTML overlay / 换 React Flow + whiteboard layer / 换自研轻量画布。

**为什么**

这一步决定底层画布选型。选错以后重构成本非常高。旧项目已经踩过自适应、缩放、拖动偏移坑，所以这次先验证坐标系统，不先堆功能。

更重要的是：TANGENT 不只是节点编辑器，也要像一个非常轻的白板。用户应该能先随手涂、圈、画箭头、贴便签，再把 AI 图像节点接进来。白板交互如果不自然，后面 AI 功能做得再多也会显得难用。

**验收**

- 可以 pan / zoom，体验接近 Miro/FigJam。
- 可以自由涂鸦，并能修改画笔颜色和粗细。
- 可以放文本、便利贴、矩形、圆形、线条、箭头、Frame / 画框。
- 可以放图片，图片可移动、缩放，缩放后画笔落点不偏移。
- 可以粘贴 URL，生成 link card；Spike 阶段可用 mock 标题/缩略图。
- 可以放 AI 节点卡片；早期 Spike 用 Prompt / Generate / Edit 轻卡片验证，当前产品使用 Prompt / Image Gen / Image Gen 4 / Analysis / Image 五类节点。
- AI 节点卡片可拖动、选择、删除，不能破坏普通白板工具。
- 可以用箭头连接普通形状，也可以连接 Prompt / Generate / Edit 卡片。
- 框选多个普通对象和 AI 卡片时，选择框位置准确。
- 50% / 100% / 200% 缩放下，点击、拖拽、框选、画笔、连线端口无明显偏移。
- 浏览器窗口 resize 后，对象位置、选择框、连线端口不漂移。
- Retina / 高 DPI 屏幕上，画笔落点和鼠标位置一致。
- 工具层接近 Excalidraw，顶部图标工具栏和插入入口集中，不和 tldraw 默认 UI 重叠，并保留完整基础白板工具。
- 形状工具合并为类别入口；箭头和直线是独立图标，箭头入口只画箭头。
- 箭头连接矩形、圆形、Frame、图片、卡片时吸附到边中点；连接三角形、菱形时吸附到角点；箭头工具 hover 对象时轮廓和候选捕捉点预高亮；拖拽时 source / target 捕捉点高亮。
- 左下角导航地图显示 viewport 与缩放百分比，支持加号/减号缩放和点击跳转。
- 左侧属性面板只在有选中对象且没有拖动画布时出现，避开顶部工具栏和左下导航地图，能用清晰图标控件编辑样式、线条风格、箭头类型、端点、透明度、对齐、图层和操作；右侧保留给 AI Chat。
- 左键工具单次绘制后回 Select；右键工具连续绘制，不出现需要手动解锁的状态，Esc 强制退出后选中本轮新增对象。
- card 缩小时文字不会溢出边界。
- 连续粘贴 5-10 张外部图片时有大小/长边限制或提示，不让页面长时间卡死。
- 如果任一关键坐标验收失败，不进入 Step 2，先修底层或更换画布方案。

**当前实现入口**

- 运行：`npm -C apps/web run dev`
- 打开：`http://localhost:3000/spikes/canvas`
- 状态：已完成并成为当前 tldraw-first 基线；工具层、导航地图、箭头吸附、图片粘贴限制和基础白板交互已进入持续 polish，不再作为阻塞 Step。

---

### Step 1.5 — 复杂节点与架构裁决 Spike

**目标**

用最小代码验证 tldraw-first 能否承载后续越来越复杂的 AI 节点。如果过不了这一关，立刻在正式节点开发前调整技术栈，避免后面返工。

当前约定：Step 1 的画布小 UI 先不继续深抠；除非出现阻塞级偏移、误触或卡顿，否则优先把工程风险推进到复杂节点、轻量数据、端口和 Merge Capture。

**当前状态（2026-04-30）**

Step 1.5 已通过技术裁决。当前路线保留 tldraw-first + Node Runtime + Inspector：tldraw 负责白板交互、形状、图片和布局；节点数据线改为 Node Runtime SVG overlay；复杂参数和运行摘要由节点运行层和 Inspector 管理。

已落地内容包括 Prompt / Image Gen / Image Gen 4 / Analysis / Image 五类节点，动态 image 输入，text / image 端口类型，fan-out，input auto-replacement，edge 选中后在下游端显示 `-` 断链按钮，mock planner graph，mock data flow，Canvas image / Image Node 双向转换，本地导图，Merge Capture / Screenshot 到 Image Node，以及多图低缩放性能降噪。

Step 1.5 暴露出的新瓶颈不是画布选型失败，而是多图片资产渲染成本。因此下一条主线已经切到 `dev-plans/Asset-lod-roadmap.md`，而不是重走 React Flow / Konva 方案。

**你要做什么**

- 看 Prompt / Image Gen / Image Gen 4 / Analysis / Image 是否足够清楚，不像工程工具。
- 测试节点内部点击、输入、滚轮、下拉是否会误拖动画布。
- 测试端口连线是否能理解：哪里输入、哪里输出、哪些线不允许。
- 判断左侧 Inspector 是否比把所有参数塞进节点更简单。
- 如果出现偏移、误触、卡顿，告诉我复现步骤。

**我要做什么**

- 在当前 `/spikes/canvas` 或新 spike 页面中实现复杂节点原型。
- 建立最小 Node Runtime / Node Registry：
  - `type`
  - `version`
  - `ports`
  - `paramsSchema`
  - `defaultData`
  - `validate`
  - `migrate`
- 做五类节点原型：
  - Prompt：prompt 输入、text 输入/输出端口、四角缩放。
  - Image Gen：模型下拉、比例/分辨率、text 输入、多 image 输入、动态端口、1 图结果 mock。
  - Image Gen 4：同 Image Gen 参数，4 图结果 mock。
  - Analysis：image 输入、prompt 输入、默认反推提示词、text 输出。
  - Image：无运算，只承接和预览上游 image asset，可四角缩放。
- 做左侧 Inspector 原型：
  - 显示选中节点参数。
  - 支持编辑模型和参数。
  - 滚轮、输入、下拉不影响画布。
- 做节点轻量数据验证：
  - 节点只保存 `node_id`、`asset_id`、短参数、端口、布局和运行摘要。
  - 图片、Base64、长 prompt 分析、Provider 原始响应和日志不进 `shape.props` 或协同文档。
- 做端口连线验证：
  - Prompt → Image Gen / Image Gen 4 合法。
  - Image → Image Gen / Image Gen 4 合法。
  - Image → Analysis 合法。
  - Analysis → Prompt / Image Gen / Image Gen 4 合法。
  - text 端口和连线为黄色；image 端口和连线为绿色。
  - Image Gen / Image Gen 4 每连入一个 image 自动增加一个空 image 输入端口。
  - node-node 连线靠近时中点显示 `−` 并可断开。
  - 非法连线自动断开并提示。
- 做 AI Chat / mock planner 自动布局验证：
  - 插入 3-4 个节点。
  - 放到当前 viewport 中央附近。
  - 横向排布不重叠。
- 做 Merge Capture 最小验证：
  - 图片 + 笔迹 + 形状。
  - 导出不包含 UI、选择框、网格。
- 做 50-100 节点压力测试。
- 做 5-10 张外部大图粘贴压力测试，确认降采样、提示和浏览器响应是否可接受。

**为什么**

节点会继续增加，节点内模型参数也会越来越多。必须先证明 tldraw 适合作为 Miro 式主画布，同时把复杂业务交给 Node Runtime 和 Inspector。否则后续会陷入“白板很好用，但节点系统做不动”的暗礁。

补充结论：React HTML 节点适合做容器化 UI，但前提是节点只做显示器/控制器，不做数据库。tldraw 视窗剔除可以降低不可见节点成本，但不能替代生产构建压力测试、图片压缩、缩略图和懒加载。

**验收**

- 复杂节点可渲染、可拖动、可选中。
- 节点内部输入、下拉、按钮、滚轮不触发画布 pan / zoom / drag。
- 节点端口可视，合法线保留，非法线自动断开。
- 左侧 Inspector 能编辑节点参数。
- 节点 payload 保持轻量，不包含 Base64、大图、长日志或 Provider 原始响应。
- AI Chat / mock planner 能自动插入并布局节点。
- Merge Capture 能输出纯净图片。
- 50-100 节点下基础操作可接受。
- 连续粘贴 5-10 张外部图片不长时间卡死；否则先补压缩、缩略图和懒加载策略。
- 若任一关键项失败，先更新 ARCH 技术决策，再决定是否切 React Flow + Konva / whiteboard layer。

---

### Step 2 — 最小节点链路 Spike

**当前状态（2026-04-30）**

五类节点已经在 S1.5 原型中以 mock runtime 形式落地。后续不是从零实现 Step 2，而是在现有节点和 Node Runtime 上接真实模型注册表、AI Proxy、Asset Pipeline、保存/加载和 Dashboard。

**你要做什么**

- 看 Prompt / Image Gen / Image Gen 4 / Analysis / Image 五类节点是否足够直观。
- 确认节点名称和按钮文案是否小白。

**我要做什么**

- 实现 Prompt Node。
- 实现 Image Gen Node 空状态、模型选择入口、动态 image 输入端口、运行中、1 图结果状态。
- 实现 Image Gen 4 Node 空状态、模型选择入口、动态 image 输入端口、运行中、4 图结果状态。
- 实现 Analysis Node 默认 prompt、image 输入和 text 输出。
- 实现 Image Node。
- 实现 Prompt → Image Gen / Image Gen 4 → Image，以及 Image → Analysis → Prompt 的连线。
- Node Picker 只展示 Prompt / Image Gen / Image Gen 4 / Analysis / Image，不展示参考图里的视频、音频、PDF、3D 等复杂节点。

**为什么**

先把节点链路做简单，避免一开始就陷入完整白板/协作/素材库。

**验收**

- 手动创建五类节点并连线。
- 节点数量少，入口清楚。
- 新用户能理解“Prompt → 单图/四图 → Image”和“Image → Analysis → Prompt”。

---

### Step 3 — 图片模型注册表与选择器

**你要做什么**

- 确认 P0 图片模型候选只先保留 `gpt-image-2` 和 `gemini-3.1-flash-image-preview`。
- 确认测试默认用各模型最低成本参数。

**我要做什么**

- 建立最小 Model Registry / mock registry。
- 暴露模型列表给 Image Gen / Image Gen 4 Node 和右侧 AI Chat composer。
- 按模型能力过滤参数，例如 GPT Image 2 的 `quality/size`，Gemini Image Preview 的 `image_size/aspect_ratio`。
- 不可用模型显示 disabled，不允许提交。
- 生成请求和 API log 都记录实际 `selected_model_id`。

**为什么**

后续会接更多模型，所以模型能力、参数、价格提示不能散落在组件里，更不能硬编码到某一个节点。

**验收**

- Image Gen / Image Gen 4 Node 能看到模型下拉。
- AI Chat composer 能看到同一份模型下拉。
- 至少显示 `gpt-image-2` 和 `gemini-3.1-flash-image-preview`。
- 切换模型后参数入口跟着变化。
- disabled 模型不能运行。

---

### Step 4 — 单图 / 四图生成闭环

**你要做什么**

- 提供 3-5 个海外用户会真实使用的英文 prompt。
- 确认测试可以使用低成本参数。

**我要做什么**

- 接入后端 GeekAI provider。
- 根据 `selected_model_id` 调用对应图片模型。
- 默认测试参数走当前模型最低成本配置。
- Image Gen Node 一次生成 1 张图；Image Gen 4 Node 一次生成 4 张图并显示 2×2 缩略图。
- 点击某张缩略图创建 Image Node。
- 写入 AI 调用日志。

**为什么**

这是产品最小价值闭环的前半段：一句 prompt 变成四张可选图片。

**验收**

- Prompt → Image Gen / Image Gen 4 成功生成 1 张或 4 张图。
- 4 张图在节点内稳定显示。
- 点击缩略图能创建 Image Node。
- API log 能看到 user、board、model、params、cost、latency、status。

---

### Step 5 — Image Editor 导出闭环

**当前状态（2026-04-30）**

单独 Image Editor 不是当前最近的实现主线；P0 优先使用画布上的 Canvas Markup + Merge Capture 完成“图片上标注/涂改 → 新 Image Node”。后续如果需要更专业的局部编辑，再把轻量 Image Editor 作为独立切片评估。

**你要做什么**

- 选择一张图，手动画几笔，确认导出效果。

**我要做什么**

- 参考当前 `ImageEditorModal` / `LayerCanvas` / `rasterizeLayers()` 思路。
- 做轻量 Image Editor：打开图片、画笔、橡皮、导出。
- Export 后创建新的 Image Node。
- 保证导出不包含 UI、网格、选框。

**为什么**

这是产品最小价值闭环的后半段：用户能把图改完并得到一个新图。

**验收**

- Image → Image Editor 打开成功。
- 绘图流畅。
- Export 创建新 Image Node。
- 关闭重开不丢当前编辑状态。

---

### Step 6 — 画布涂改与截图合并

**当前状态（2026-04-30）**

Image Node → canvas image、canvas image → Image Node、Screenshot / Merge Capture → Image Node 的本地闭环已落地。Slice D 自定义 ordinary canvas image 渲染已通过本地和 Windows pass-with-notes 验收；后续 fidelity 风险进入真实 Asset Pipeline / 导出路径继续覆盖。

**你要做什么**

- 把图片发送到画布，在图上涂几笔，然后确认合并出来的新图。

**我要做什么**

- 实现 Image Node → Send to Canvas。
- 画布上图片可被涂改/标注。
- 实现 Merge to Image：选中图片和笔迹，离屏渲染合并为 PNG。
- 创建新的 Image Node。

**为什么**

这是参考 Tanva 的关键操作逻辑：图片不只在节点里，也能变成画布对象，被涂改后合并成新图。

**验收**

- Send to Canvas 后图片在当前视野附近出现。
- 涂鸦位置和图片对齐，不偏移。
- Merge Capture 不截到 UI、网格、选框。
- 合并结果生成新的 Image Node。

---

### Step 7 — 右侧 AI Chat 自动搭线 Spike

**你要做什么**

- 用自然语言描述 3 个小白场景，例如“生成 4 张猫咪海报，再把最好的一张拿去编辑”。
- 看自动生成的节点是否足够直观。

**我要做什么**

- 设计最小 graph spec：`nodes`、`edges`、`layout`。
- 复用旧 AI 自动建图思路，但不复用旧复杂执行引擎。
- 实现右侧 AI Chat 侧边栏。
- Composer 支持输入文字、选择图片模型、发送。
- 实现 AI Chat 返回简单节点图，并把节点创建在当前视野附近。
- Composer 选择的图片模型写入自动创建的 Image Gen / Image Gen 4 Node。

**为什么**

这是降低门槛的关键入口。用户不需要理解 Node Picker，也能通过一句话得到可运行流程。

**验收**

- 空白画布右侧 AI Chat 输入一句话，自动出现 Prompt / Image Gen / Image Gen 4 / Analysis / Image 节点。
- 节点自动连线。
- 布局清楚，不遮挡，不跑出当前视野。
- AI Chat composer 能切换图片模型。

---

### Step 8 — Dashboard / 保存 / 登录收口

**你要做什么**

- 确认 Dashboard 最少需要哪些入口：New board、Recent boards、Open board。

**我要做什么**

- 做 Web Dashboard。
- 支持创建、重命名、打开 Board。
- 保存和加载 Board document。
- 登录状态保护 Canvas 页面。

**为什么**

P0 先保证单人 Board 能创建、保存、刷新恢复和继续编辑；分享/邀请在 P0.5 协作阶段再做。

**验收**

- 新用户登录后能创建 Board。
- Board 刷新后不丢节点、连线、图片引用和 viewport。
- 未登录用户不能访问受保护 Board。

---

### Step 9 — 多人协作 Spike（P0.5）

**你要做什么**

- 用两个浏览器窗口或两台设备进入同一测试 Board。
- 观察光标、选中、移动、画笔是否实时同步。

**我要做什么**

- 接入 Liveblocks 或 PartyKit/Yjs。
- 实现 room、presence、cursor、selection、document sync。
- 实现软锁提示：谁正在编辑节点参数，其他人看到占用状态。
- 实现协作文档快照 debounce 保存，不把 presence 写入 PostgreSQL。
- 保持 AI Run、扣费、Asset 写入由后端权威处理。

**为什么**

协作仍是长期方向，但不能挡住最小图像链路。等坐标和节点链路稳定后再接协作，风险更低。

**验收**

- 两个用户同时编辑 15 分钟不丢对象。
- 用户 A 新增图片，用户 B 能即时看到。
- 用户 B 移动节点，用户 A 能即时看到。
- 多人光标和选区只走 presence，不落持久化 document。
- 同一节点被多人编辑时有软锁提示；冲突最终以 Node Runtime / 后端规则收口。

---

## 6. 文件索引

| 文件 | 作用 |
|------|------|
| `PRD.md` | 新产品需求文档 |
| `ARCH.md` | 新 Web 架构草案 |
| `project_state.md` | 当前状态入口，标记旧路线冻结 |
| `dev-plans/Asset-lod-roadmap.md` | 当前 Asset / Image / Node LOD 主线和协作前置资产管线计划 |
| `dev-plans/Archive/` | 已完成、已验收或废弃的 dev-plan / handoff 归档 |
| `legacy/old-tangent-desktop-2026-04-29/PRD.desktop-legacy.md` | 旧桌面/公众号 PRD 归档 |
| `legacy/old-tangent-desktop-2026-04-29/ARCH.desktop-legacy.md` | 旧桌面/后端架构归档 |
| `README.md` | 项目入口，提示当前已 pivot |

---

## 7. 风险与阻断

| 风险 | 处理 |
|------|------|
| 新方向仍不够简单 | P0 只保留白板 + Prompt / Image Gen / Image Gen 4 / Analysis / Image 五类核心节点 |
| 协作技术踩坑 | 先 spike，不直接全量重写 |
| 缩放/拖拽/选择再次偏移 | Step 1 坐标 Spike 已过；后续继续用单一 world 坐标系和手测矩阵回归 |
| 复杂节点无法承载 | Step 1.5 先验证 Node Runtime / Inspector / 端口；失败再切方案 |
| 节点参数膨胀 | 节点卡片只放摘要；复杂参数放左侧 Inspector |
| 端口连线不稳定 | Node Runtime 做连接校验；非法线自动断开 |
| 协同状态混乱 | 协同文档、Presence、服务端权威、本地 UI 四类状态分离 |
| 节点 props 存重型数据 | 节点只存 id、短参数和摘要；图片、长文本、日志、Provider 响应外置 |
| 过度依赖视窗剔除 | Step 1.5 已证明仅靠视窗剔除不够；当前转入 Asset LOD Roadmap，做 Image Node LOD、Node LOD、普通 canvas image LOD 和真实 Asset Pipeline |
| 多图多节点下图片渲染卡顿 | Slice A-D 已完成本地降噪、thumbnail resolver 和 ordinary canvas image LOD；Windows 遗留卡顿作为 non-blocking follow-up |
| Mac 手测不能代表上线表现 | Slice D 跨平台质量门已 pass with notes；后续不再在 tunnel 环境过度调参，改由 Slice E 真实 Asset Pipeline 继续优化 |
| 协作同步重型图片数据 | 多人协作前必须完成 Slice E Real Asset Pipeline；Board document / CRDT 只同步 assetId、dimensions、layout 和轻量摘要 |
| Link card 预览图失败 | 后续走服务端 URL unfurl + image proxy / Asset 化，不依赖前端直接加载第三方 preview 图 |
| CRDT 被误解为业务规则 | CRDT 解决文档一致性；AI Run、扣费、Asset 和参数冲突仍需后端/Node Runtime 定义 |
| 双层画布复杂度过高 | 优先 tldraw 单引擎；双层只是备选 |
| 参考 Tanva 继承技术债 | 只参考操作逻辑和坐标思想，不复制复杂实现 |
| Editor 重新变成专业软件 | P0 只做画笔、橡皮、导出、新 Image Node |
| 截图合并截到 UI | 使用离屏渲染画布对象，不做 DOM 截屏 |
| 外部多图粘贴导致卡顿 | 已有限制 MIME、体积和长边；当前继续用 Asset LOD、thumbnail resolver 和普通 canvas image LOD 降低多图成本 |
| 旧代码拖慢 | 新 Web App 独立目录，旧代码冻结 |
| AI 成本失控 | 默认低成本模型和低分辨率 |
| 海外定位模糊 | UI/文案默认英语，围绕团队协作和视觉迭代 |

---

## 8. 下一步执行建议

当前 pivot 已确认，Step 1 和 Step 1.5 已通过。下一步不再是进入复杂节点 spike，而是沿当前主线收口上线前基础能力：

1. 进入 Slice E Real Asset Pipeline：后端 upload endpoint、object storage、多尺寸缩略图、asset metadata、权限 URL，以及保存前拒绝或迁移 `data:` / `blob:` 图片引用。
2. 确认 Cloudflare Tunnel / diagnostics 继续只作为本地测试支架：`CanvasRuntimeDiagnostics` 默认关闭，quick tunnel 不进入正式产品提交。
3. 在真实 Asset Pipeline 稳定后，再接真实 Model Registry / AI Proxy / AI Run log，把当前 mock Image Gen / Analysis 链路换成真实后端结果。
4. 做 Dashboard / 保存 / 登录收口，保证 Board refresh 后节点、连线、viewport 和 asset 引用可恢复。
5. 解决 Link Preview 的后端 unfurl + image proxy / Asset 化。
6. 最后再进入 P0.5 多人协作；协作只同步轻量文档状态，Presence、本地 LOD、AI Run 和 Asset 写入分别走自己的边界。
