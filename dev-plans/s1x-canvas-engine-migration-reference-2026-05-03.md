# S1X Canvas Engine Migration Reference

**Status**: Active tactical plan; first handfeel route ready for review.
**Branch**: `feature/s1x-konva-handfeel-spike`

## Principle

The current tldraw runtime is the behavioral reference. The migration should copy the product feel and logic first, then improve internals.

Do not treat this as "replace tldraw with Konva components." Treat it as:

```text
extract TANGENT canvas contract
build Konva renderer for that contract
map collaboration to Yjs
keep Board/API/storage contracts stable
```

## tldraw Behavior Inventory

Current user-facing behavior to match:

- Whiteboard pan/zoom with smooth pointer anchoring.
- Toolbar above the canvas.
- Fixed left properties drawer that does not disappear on blank canvas clicks.
- Drawing tools: hand, select, shapes, arrow, line, draw, text, eraser.
- Shape menu: rectangle, diamond, ellipse, triangle and cloud.
- Context/right-click continuous drawing behavior.
- Escape exits continuous drawing and can select created shapes.
- Style controls: stroke, fill, width, dash, line spline, arrow type/heads, font, opacity, layer, align and actions.
- Board header with Workspace back, home/logo and Board switcher.
- Canvas Settings gear and panel.
- Board save controls: unsaved/saved states, Save now, Snapshot, Refresh preview and History.
- Board History filter and restore behavior.
- Captured Board thumbnail.
- Smart Drawing conversion of rough draw strokes into line/curve/rectangle/triangle/ellipse.
- Selection toolbar for capture/generate/alignment actions.
- Runtime node cards with ports, AI controls and status summaries.

## Product Logic To Preserve

Keep these modules conceptually intact, even if their editor adapter changes:

- `features/boards/localBoardClient.ts`
- Board save/load/history API contracts
- Board document guard rules
- Asset upload/read and R2 references
- `features/node-runtime/*` input/output concepts
- Node types and AI run summary shape
- Workspace gallery/list/management metadata

## 中文复刻阶段矩阵

这张表是后续迁移的逐项对照表。每一行都要按当前 tldraw 表现做参考手测，不能只看功能是否“有按钮”。

### Phase 0：参考锁定和测试基准

| 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| 0.1 | 参考路径冻结 | `/boards/[boardId]` 是当前真实 Board 体验 | 保留 tldraw route，新增 `/spikes/konva-canvas` 并行验证 | `CanvasSpike.tsx` | 新旧路由可同时打开 |
| 0.2 | 体验录制 | 当前工具栏、properties、画线、节点、保存都作为样本 | 录制 3-5 个短手测流程，后面逐项比对 | browser staging | 用户能用视频/手测列表判断是否退化 |
| 0.3 | tldraw 依赖清单 | 约 58 个前端文件引用 tldraw | 标记哪些是产品逻辑，哪些是 renderer adapter | `components/canvas`, `features/node-runtime` | 迁移时不误删产品逻辑 |
| 0.4 | 许可证边界 | 公网 staging 会报 tldraw license | 新引擎不得依赖付费 canvas SDK | Vercel staging | Konva spike 不出现 license blocker |

### Phase 1：手感和画布基础

当前 checkpoint：`/spikes/konva-canvas` 已经具备 first-pass Konva Stage、freehand smoothing、pan/zoom、基础形状、minimap 和 diagnostics。用户进入画布默认是 Select；用户喜欢“选择绘制工具后左键连续绘制，直到手动切换工具”的交互，后续不要退回必须右键锁定才连续绘制的模式。Draw 默认只做轻微平滑，不做明显直线/形状拟合；当前偏建筑师钢笔感，慢线略重、快线略轻、起收笔轻微 taper。基础快捷键合同：`V` 选择，按住 `Space` 临时平移且不改变当前工具，鼠标中键拖拽平移。下一步先手测“画线和缩放是否值得继续”，再补选区、Properties、图片和节点链路。

| 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| 1.1 | 画布容器 | 白板铺满 Board 页面，UI 浮层不挡主要绘制 | Konva Stage full-screen，UI overlay 与 canvas 分层 | `CanvasSpike.tsx` | 画布区域尺寸、层级和现有接近 |
| 1.2 | 平移 pan | hand 工具和触控板拖动稳定 | camera transform 独立 store，拖动不触发 React 重渲染抖动 | `useEditorInteractionState.ts` | 拖动画布不飘、不丢帧 |
| 1.3 | 滚轮/触控板缩放 | 缩放围绕当前视角/鼠标位置 | pointer anchored zoom，支持 zoom sensitivity | `useCanvasSettings.ts`, `CanvasSpikeNavigator.tsx` | 缩放后光标下对象位置不明显漂移 |
| 1.4 | 100% 缩放 | 左下角数字点击回到 100% | Konva navigator 保留 zoom reset | `CanvasSpikeNavigator.tsx` | 点击百分比回 100% |
| 1.4A | 快捷平移 | tldraw/Miro 类画布常用 Space 临时 hand、中键平移 | `V` 切 Select；按住 `Space` 临时平移但不改变 active tool；中键拖拽平移 | input layer | 松开 Space 后恢复原绘制工具 |
| 1.5 | 背景 | dot/grid/solid，dot 非常淡且在元素下方 | 背景单独 layer，永远低于 shapes/nodes | `CanvasBackground.tsx`, `CanvasGrid.tsx` | dot 不盖住任何绘图元素 |
| 1.6 | 自由画线采样 | 慢画不抖，快画不断 | pointer capture + RAF batching + smoothing | tldraw draw tool | 慢线、快线、曲线手测通过 |
| 1.7 | 笔触外观 | tldraw draw 风格有自然手感 | `perfect-freehand` 或等价 outline stroke；普通 Draw 只轻微平滑，慢速更有墨、快速更轻、轻微收头 | `canvasStyleControls.ts` | 用户接受达到当前 80% 手感 |
| 1.8 | 性能基准 | 当前混合节点/图形可交互 | 1,000 strokes、100 nodes、20 images 基准 | `features/canvas-performance` | staging 浏览器无明显卡死 |
| 1.9 | 事件隔离 | 点击 UI 不影响画布工具 | overlay UI stop propagation，wheel 不穿透 | 多个 canvas panel | 点 toolbar/properties 不误画线 |

### Phase 1A：丝滑性能专项

| 序号 | 性能点 | 当前风险 | 复刻/实现策略 | 验收方式 |
| --- | --- | --- | --- | --- |
| 1A.1 | React 不进热路径 | pointermove 触发 React 会卡；1k strokes pan/zoom 已反馈轻微卡顿 | pointer buffer + mutable tool session + RAF 直接更新 Konva node；shape render memo 化，后续把 camera transform 移出 React 热路径 | React Profiler 看不到每帧重渲染 |
| 1A.2 | 分层渲染 | 背景、图片、节点、选区一起重绘会卡 | Background/Image/Stroke/Node/Edge/Selection/Presence 分 layer | 画线时只 Stroke/Selection 层高频 redraw |
| 1A.3 | pointer 采样 | 快速画线可能断，慢线可能抖 | 原始点保留，距离/时间阈值采样，RAF 批处理 | 快慢线手测都自然 |
| 1A.4 | 笔触平滑 | Konva Line 原生手感可能不够；过度 streamline 会像直线拟合 | `perfect-freehand` outline + 轻量 smooth + 低 tolerance simplify；Smart Drawing 另设模式 | 用户认可接近 tldraw 80% |
| 1A.5 | 坐标转换 | zoom/pan 后画线漂移 | screen/world transform 单一来源，pointer anchored zoom | zoom 后笔尖落点准确 |
| 1A.6 | hit test | 大 Board 精确 hit test 昂贵 | bbox 粗筛 + precise hit + bounds cache + viewport filter | 1,000 strokes 框选不明显卡 |
| 1A.7 | drag/resize | 每帧 commit 文档会卡 | dragging 时更新 visual，pointerup 单 transaction commit | 拖动时流畅，undo 只产生一组操作 |
| 1A.8 | image LOD | 大图 decode/render 卡 | R2 thumbnail first，zoom-in 再升档，Konva image cache | 20 张图 pan/zoom 不冻结 |
| 1A.9 | node HTML | 大量 React 节点重渲染卡 | 非编辑态用轻量 visual，编辑态才开 HTML controls | 100 node cards 可拖动 |
| 1A.10 | Yjs 本地优先 | 网络同步阻塞本地绘制 | local render 立即完成，Yjs transaction 后送 | 断网/慢网不影响本地画线 |
| 1A.11 | presence 节流 | 光标同步太频繁会卡 | awareness 15-30fps，和 document updates 分离 | 两 tab 光标顺滑但不抢帧 |
| 1A.12 | export 隔离 | thumbnail/capture 卡住绘图 | export 只在保存/手动触发，必要时 idle/worker 化 | 保存时可显示 loading，不影响普通绘制 |
| 1A.13 | 指标面板 | 没指标容易凭感觉误判 | frame p95、object count、point count、Yjs update/s、export ms；1k strokes 下重点看 pan/zoom | spike 页面能看到诊断值 |

### Phase 2：工具栏和 Properties

| 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| 2.1 | 顶部工具栏位置 | toolbar 固定在上方，不放左侧 | 复刻当前布局和 tooltip | `CanvasSpikeToolbar.tsx` | 页面刷新后位置一致 |
| 2.2 | hand/select | 切换 hand/select，状态高亮 | engine activeTool state；进入画布默认 Select | `CanvasToolbarPrimaryTools.tsx` | 当前工具高亮正确 |
| 2.3 | shape 菜单 | rectangle/diamond/ellipse/triangle/cloud | Konva shape tool + popover | `canvasToolbarConfig.ts` | 形状菜单和图标一致 |
| 2.4 | direct tools | arrow/line/draw/text/eraser | 对应 Konva tools | `canvasToolbarConfig.ts` | 每个按钮能创建/操作正确对象 |
| 2.5 | 连续绘制 | tldraw 需要右键工具进入 continuous | TANGENT 新引擎采用用户认可的新规则：左键绘制后保持当前工具，直到用户切换工具；ESC 回 Select | `CanvasSpikeToolbar.tsx` | 连画多个形状不中断，ESC 后回选择模式 |
| 2.6 | tooltip | 黑底白字，长文字不被裁切 | 全局 tooltip layer 保留 | `CanvasTooltipLayer.tsx` | toolbar/properties tooltip 可见 |
| 2.7 | fixed properties | 点击空白不切换/消失，保持最后工具属性 | style panel state 与 selection 解耦 | `CanvasSpikeStylePanel.tsx` | 空白点击后 panel 不变 |
| 2.8 | selection properties | 选中普通图形时显示 selected 样式 | selection style aggregation | `getSelectionTool` | 单选/多选显示正确 |
| 2.9 | node selection | node card 不显示普通图形属性 | node card selection guard | `hasNodeCardSelection` | 选节点不出现无意义样式 |
| 2.10 | stroke color | black/red/green/blue/orange/violet/grey | 映射为 engine style token | `strokeColors` | 新旧颜色接近 |
| 2.11 | fill | none/semi/solid/pattern | Konva fill/pattern 或降级规则 | `fillStyles` | semi/solid 清晰，pattern 有方案 |
| 2.12 | width/dash/font | s/m/l/xl，draw/solid/dashed/dotted，font 选项 | engine style tokens | `sizeStyles`, `dashStyles`, `fontStyles` | 图标不溢出，样式可保存 |
| 2.13 | arrow style | arc/elbow，start/end heads | edge renderer 支持箭头头部 | `arrowKindStyles`, `arrowhead*` | 箭头视觉接近 |
| 2.14 | opacity | selection/next shape opacity | selection 和 next tool 双写 | `CanvasSpikeStylePanel.tsx` | 新对象继承 opacity |
| 2.15 | layer/align/actions | send/back/bring/align/stretch/duplicate/delete | z-index order + selection commands | `canvasStylePanelModel.ts` | 多选对齐和层级可用 |

### Phase 2A：Properties 面板完整对照

参考用户截图：Properties 里不仅要有样式按钮，还要有 selection 转换、layer、align、actions 的图标网格。按钮要是线性 SVG/图标风格，尺寸稳定，tooltip 不被裁切。

| 序号 | Properties 区块 | 当前参考 | Konva/Yjs 复刻要求 | 验收方式 |
| --- | --- | --- | --- | --- |
| 2A.1 | Header | `Properties` + `Selected · N` 或当前工具样式 | 显示当前 selection 数量；无 selection 时显示当前工具 style | 选中 0/1/3 个对象时文案正确 |
| 2A.2 | Selection actions | Convert image to node、Capture selected to Image Node 两个图标 | 只有满足条件时启用；loading/error 可见 | 选图片/多选时按钮状态正确 |
| 2A.3 | Stroke swatches | 黑、红、绿、蓝、橙、紫、灰；active 有紫色描边 | token 映射到 selected shapes 和 next shape | 选中图形改色立即生效 |
| 2A.4 | Fill buttons | none / semi / solid / pattern | 按钮图标和当前 active 状态接近截图 | fill 状态保存/恢复 |
| 2A.5 | Width buttons | s/m/l/xl 图标线宽不同 | 图标不溢出按钮边框，实际 strokeWidth 改变 | 四档线宽可见差异 |
| 2A.6 | Dash buttons | draw/solid/dashed/dotted | draw 不是普通实线，要保留手绘/曲线语义；后续 Properties 需可选钢笔 taper、等宽平滑、dash、dot 和宽度 | dash 样式保存/恢复 |
| 2A.7 | Opacity slider | 紫色 slider，右侧显示 0-100 | selection opacity 和 next opacity 都支持 | 多选 mixed 状态可处理 |
| 2A.8 | Layer grid | 置底/下移/上移/置顶图标 | 操作 z-order，disabled 状态合理 | 层级顺序变化可见并持久化 |
| 2A.9 | Align grid | 左/中/右/顶/中/底等对齐 | 至少 2 个对象才启用 | 多选对齐符合截图菜单逻辑 |
| 2A.10 | Actions grid | duplicate/delete/stretch 等 | 与右键菜单和快捷键共用 command，不写两套逻辑 | 点击 actions 和右键菜单结果一致 |
| 2A.11 | Node card selection | 选 node 时不出现普通图形 stroke/fill 噪音 | 只显示可用的节点转换/运行/asset 动作，或保持简化 | 选节点不会让用户误改无效样式 |
| 2A.12 | Mixed selection | 多选不同样式 | mixed 显示不误导；点某值后统一应用 | 多选不同颜色后能统一设置 |
| 2A.13 | Pointer isolation | properties 点击不触发画布选择/画线 | stop pointer/wheel/context menu bubbling | 在 panel 上滚轮/点击不影响画布 |

### Phase 3：基础对象、选择和编辑细节

| 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| 3.1 | 对象模型 | TLShape 承载 x/y/rotation/props/index | `TangentShape` 承载 id/type/x/y/w/h/rotation/style/props | `boardDocumentSerializer.ts` | JSON 可读、可迁移 |
| 3.2 | 多选 | 框选/shift 选中多个对象 | selection rectangle + hit testing | tldraw select | 框选复杂对象准确 |
| 3.3 | 拖拽 | 选中对象拖动丝滑 | pointer move 批处理，commit to store | tldraw select dragging | 拖动无跳变 |
| 3.4 | resize | 图形和 node card 可 resize | handles + constraints | `NodeCardShape.tsx`, `AiCardShape.tsx` | resize 后内容不坏 |
| 3.5 | rotate | 当前 tldraw shape 支持 rotation 字段 | 先支持基础 rotation，复杂节点可后置 | serializer rotation | 保存/恢复 rotation |
| 3.6 | 删除 | Delete/Backspace 和面板 delete | keyboard command + selection delete | operationActions | 删除对象和 edges 清理一致 |
| 3.7 | undo/redo | tldraw 内置历史 | command stack，支持 batch transaction | tldraw editor history | Ctrl/Cmd+Z/Shift+Z 正常 |
| 3.8 | copy/paste | 浏览器/内部 clipboard | 自定义 clipboard JSON，图片只复制 asset ref | tldraw clipboard | 复制节点/shape/edge 后位置偏移 |
| 3.9 | Alt 拖拽复制 | tldraw 交互习惯 | drag start 检查 Alt/Option 并 duplicate selection | tldraw select | Alt 拖拽产生副本 |
| 3.10 | z-order | index 控制层级 | array order / zIndex model | shape index | bring/send 操作持久化 |
| 3.11 | text edit | text/note 可输入，不抢画布快捷键 | HTML overlay 或 Konva.Text + input overlay | tldraw text/note | 输入中 Cmd+S 不误触，中文输入正常 |
| 3.12 | eraser | 橡皮擦删除 draw/shape | hit test stroke/shape，拖动擦除 | direct eraser | 擦除不误删远处对象 |
| 3.13 | snapping | snap alignment/distance | snap guides + configurable threshold | `CanvasSettingsPanel.tsx` | 开关和距离生效 |
| 3.14 | browser selection 清理 | 避免画布中误选中文本 | selectionchange guard | `CanvasSpike.tsx` | 拖动画布不出现蓝色文字选区 |

### Phase 3B：Shape / Line / Arrow / Eraser / Navigator 细则

参考用户截图：这一阶段不是“能画几个形状”这么简单，要复制 tldraw 的 shape 质感、线段编辑、箭头曲线控制和左下导航体验。

| 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 验收方式 |
| --- | --- | --- | --- | --- |
| 3B.1 | Rectangle | 工具栏 shape 菜单第一个，圆角/边框风格轻 | Konva Rect，支持 stroke/fill/dash/opacity/resize | 画出、选中、resize、保存恢复 |
| 3B.2 | Diamond | 菱形 shape | Konva Line/Path polygon，bbox resize 后保持菱形 | resize 后四角不畸形 |
| 3B.3 | Circle/Ellipse | 圆/椭圆 shape | Konva Ellipse，拖拽时从 bbox 生成 | 圆形/椭圆可保持比例/自由缩放 |
| 3B.4 | Triangle | 三角形 shape | Konva RegularPolygon/Line path，支持 resize | 三角边框/fill 正常 |
| 3B.5 | Cloud | 云朵 shape 是截图重点；tldraw/CAD cloud 是根据拖拽矩形四边分段切弧，不是固定云朵轮廓缩放 | 自定义 path 基于 bbox 四边按边长生成 revision-cloud scallop arcs；横条/竖条/大矩形都要自然分段 | cloud 视觉和选择框接近 tldraw，不像固定图标拉伸 |
| 3B.6 | Shape active preview | shape popover hover tooltip，如 Cloud | shape menu active/hover tooltip 黑底白字 | hover cloud 显示 tooltip，popover 不乱跳 |
| 3B.7 | Line straight | 直线工具生成两端控制点 | line shape 保存 start/end/control points | 端点可拖拽 |
| 3B.8 | Line midpoint curve | 截图里中点拖拽后线变曲线 | line 有 midpoint/control handle；拖中点生成 quadratic/cubic curve | 拖中点变曲线，曲率保存恢复 |
| 3B.9 | Arrow straight | arrow 两端，默认箭头头部 | edge/arrow visual 支持 start/end 和 arrowhead | 箭头终点头部方向正确 |
| 3B.10 | Arrow curve edit | arrow 中点/控制点可拖成曲线 | arrow 与 line 共用 curve control model | 曲线 arrow 拖动后自然跟随 |
| 3B.11 | Arrow bound to ports | arrow/edge 可吸附 node ports | port anchor + snap + edge data 分离 | 移动 node 后 arrow 跟随 port |
| 3B.12 | Draw pencil | 铅笔自由画线，保留手绘质感 | perfect-freehand stroke shape，样式可调 | 快慢线接近 tldraw |
| 3B.13 | Eraser 质感 | eraser 不只是 delete，拖过笔画有擦除感 | 第一版可整条 stroke hit delete；第二版支持 stroke segmentation erase | 擦除响应跟手，不误删远处图形 |
| 3B.14 | Text tool | `T` 工具插入文字 | HTML input overlay 编辑，提交为 text shape | 双击/输入/中文 IME 正常 |
| 3B.15 | Shape handles | 选中形状显示蓝色 bbox/handles | selection layer 绘制 handles，handles 尺寸随 zoom 稳定 | zoom 后 handle 不巨大/过小 |
| 3B.16 | Rotation/resize cursor | handle hover 显示正确反馈 | cursor manager 根据 handle/tool 更新 | 鼠标移到 handle 有专业反馈 |
| 3B.17 | Minimap overview | 左下角 mini map 显示对象分布和当前视口紫框 | 根据 document bounds 绘制 mini map，节流更新 | 大 Board 中能看见当前位置 |
| 3B.18 | Minimap collapse | 左下角可折叠/展开 | collapse state 不影响画布事件 | 折叠后只留小控制 |
| 3B.19 | Zoom buttons | - / + 按钮 | camera zoom steps，动画短且不晕 | 点击 -/+ 缩放稳定 |
| 3B.20 | 100% reset | 中间 `100%` 按钮回归 100% | reset zoom to 1，优先以当前视角中心定位 | 点击后回 100%，对象不跳到奇怪位置 |
| 3B.21 | Fit/定位策略 | tldraw 可 zoomToFit/selection | 后续支持 zoom to selection / fit board | 多选后可定位选区，作为后续增强 |
| 3B.22 | Grid under navigator | navigator 悬浮不影响 dot grid | navigator 是 UI overlay，背景仍在 canvas layer | 左下 UI 不遮挡关键操作过多 |

### Phase 3A：右键菜单和子菜单

参考用户截图：右键菜单是专业画布工具的重要入口。它必须与 toolbar/properties/快捷键共享同一套 command system，不能做成只显示的假菜单。

| 序号 | 菜单项 | 当前参考/快捷键 | Konva/Yjs 复刻要求 | 验收方式 |
| --- | --- | --- | --- | --- |
| 3A.1 | 右键打开位置 | 鼠标位置打开，子菜单向右展开 | 菜单定位避免超出视口，支持滚动画布坐标 | 画布边缘右键不被裁切 |
| 3A.2 | 编辑 > 分组 | `⌘G` | group selected shapes，生成 group/container 或 group id | 多选后 group，可一起拖动 |
| 3A.3 | 编辑 > 展开/取消分组 | `⇧F` reference | ungroup/group expand command | group 后可拆回独立对象 |
| 3A.4 | 编辑 > 锁定/解锁 | `⇧L` reference | locked shape 不可拖/resize，但可选择查看 | locked 对象不误移动 |
| 3A.5 | 排列 > 对齐 | 左/水平/右/顶/垂直/底 | 与 properties align 共用命令 | 多选后对齐准确 |
| 3A.6 | 排列 > 分布 | 横向分布 / 纵向分布 | equal spacing distribute | 三个以上对象分布正确 |
| 3A.7 | 排列 > 拉伸 | 水平拉伸 / 垂直拉伸 | stretch to shared bounds | 多选对象尺寸变化符合预期 |
| 3A.8 | 排列 > 翻转 | 水平翻转 / 垂直翻转 | shape transform 或 image flip | 翻转后保存恢复 |
| 3A.9 | 排列 > 打包 | pack selected shapes | 可后置，但菜单位置保留/disabled | 不支持时明确 disabled |
| 3A.10 | 排列 > 横排/竖排 | arrange selected in row/column | align + spacing helper | 多选重排成行/列 |
| 3A.11 | 重新排序 > 置顶 | `]` reference | bring to front | 与 properties layer 一致 |
| 3A.12 | 重新排序 > 上移一层 | `⌥]` reference | bring forward | 层级只移动一层 |
| 3A.13 | 重新排序 > 下移一层 | `⌥[` reference | send backward | 层级只移动一层 |
| 3A.14 | 重新排序 > 置底 | `[` reference | send to back | 层级持久化 |
| 3A.15 | 移动到页面 | submenu placeholder | S1X 可 disabled；未来多 page 支持 | 不误导用户当前多页面已完成 |
| 3A.16 | 剪切 | `⌘X` | clipboard write + remove selected | paste 后对象恢复，asset ref 不变 |
| 3A.17 | 复制 | `⌘C` | write internal JSON and optional image/SVG fallback | 可跨同页面粘贴 |
| 3A.18 | 粘贴 | `⌘V` | paste at pointer/viewport center，id 重新生成 | 粘贴位置合理，不覆盖原对象 |
| 3A.19 | 复制/重复 | `⌘D` | duplicate with offset | 与 properties duplicate 一致 |
| 3A.20 | 删除 | Delete/Backspace icon | delete selected and connected edges | 删除节点时相关 edges 清理 |
| 3A.21 | 复制为 > SVG | `⌘⇧C` reference | selection export as SVG string/clipboard | 可先支持 basic shapes，复杂节点降级 |
| 3A.22 | 复制为 > PNG | submenu item | selection export PNG to clipboard if browser supports | 透明开关影响输出 |
| 3A.23 | 复制为 > 透明 | toggle | export background transparent on/off | capture/export 透明可切换 |
| 3A.24 | 导出为 > SVG | export file | selection/board export SVG | 下载文件名合理 |
| 3A.25 | 导出为 > PNG | export file | selection/board export PNG | PNG 尺寸和 bounds 正确 |
| 3A.26 | 导出为 > 透明 | toggle | 与复制为透明共用 export options | 状态在菜单中可见 |
| 3A.27 | 选中全部 | `⌘A` | select all visible/page objects | 不选中 locked hidden internals |
| 3A.28 | 菜单 disabled | 无 selection 时部分禁用 | command availability 统一判断 | 空白右键只显示可用项 |
| 3A.29 | 子菜单 hover | hover 展开，鼠标可进入子菜单 | 延迟关闭，避免横移时消失 | 和截图体验接近 |
| 3A.30 | 键盘快捷键显示 | 右侧显示 `⌘C` 等 | Mac/Windows 显示不同快捷键符号 | Mac 显示 ⌘，Windows 显示 Ctrl |

### Phase 4：节点、端口、边和 AI Runtime

| 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| 4.1 | 节点类型 | prompt/image/image_gen/image_gen_4/analysis | `TangentNodeShape` renderer | `NodeCardShape.tsx`, `registry.ts` | 五类节点都能创建 |
| 4.2 | 节点 UI | HTMLContainer 内 React 控件 | Konva Group + React/HTML overlay 策略 | `NodeCardContent.tsx` | 输入框/按钮可操作 |
| 4.3 | node data | props.data 保存 prompt/model/resolution 等 | renderer-neutral node props | `types/nodeRuntime.ts` | 保存恢复不丢参数 |
| 4.4 | runtime summary | status/cost/error/resultAssetIds | 保持现有 summary contract | `NodeCardShape.tsx` | mock run 状态显示一致 |
| 4.5 | ports | typed text/image input/output dot | 端口坐标函数 + hit target | `NodePortDot.tsx` | 拖线能吸附端口 |
| 4.6 | edge store | runtimeEdges 独立保存 | `TangentEdge` 成为一等数据 | `nodeEdges.ts` | edge 不依赖视觉箭头存在 |
| 4.7 | input resolution | 通过 edges 找上游文本/图片 | 改为 engine query adapter | `nodeDataFlow.ts` | prompt→gen、image→analysis 正常 |
| 4.8 | image node | canvas image 可转 Image Node | Konva image + asset ref + node create | `imageNodeAssets.ts` | 选图片转换节点 |
| 4.9 | selection toolbar | 转 Image Node、Capture、Align | overlay toolbar 复刻 | `CanvasSelectionToolbar.tsx` | 多选时出现在选区上方 |
| 4.10 | edge delete/cut | 选中 edge 可断开 | edge hit test + delete button | `CanvasNodeEdgeOverlay.tsx` | 删除 edge 后 input count 同步 |
| 4.11 | arrow port snap | arrow creation/handle drag 时吸附端口 | port snap margin 按 zoom 换算 | `arrowSnapLogic.ts` | 缩放下吸附距离自然 |

### Phase 4A：Canvas / Node / Image 转换链路

这是 TANGENT 的核心链路，必须当成一等功能复刻，而不是后补按钮。

| 序号 | 转换链路 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| 4A.1 | Canvas Image → Image Node | 选中画布 image shape 后，selection toolbar/properties 有 Convert to Image Node | 从 Konva image shape 读取 `assetId/width/height/source/title`，在右侧创建 Image Node | `createImageNodeFromCanvasImage`, `CanvasSelectionToolbar.tsx`, `CanvasStylePanelSelectionActions.tsx` | 选中单张图片点击转换，生成 Image Node 且 asset 不复制成 Base64 |
| 4A.2 | Image Node → Canvas Image | Image Node header 的 `To Canvas` 把节点资产放回画布 | 从 Image Node effective asset 创建 Konva image shape，按 max edge fit 到 360 左右，位置在节点右侧 | `createCanvasImageFromNode`, `NodeCardContent.tsx` | 有图片的 Image Node 点击 To Canvas，画布出现图片并选中 |
| 4A.3 | Selection → Image Node | 选择多个对象后 Capture to Image Node | 计算 selected bounds，导出透明 PNG，上传到 Asset API/R2，创建 Image Node | `createImageNodeFromDataUrl`, `editor.toImageDataUrl`, `CanvasSelectionToolbar.tsx` | 多选图形/图片/节点后生成 Merged selection Image Node |
| 4A.4 | Canvas → Image / Merge Capture Preview | Merge Capture 预览当前 selection 导出结果 | Konva stage/layer 根据 selected ids 导出 bounded PNG，预览不写入 Board document | `CanvasMergeCapturePanel.tsx` | 预览图尺寸正确，caption 显示宽高 |
| 4A.5 | Canvas Markup → New Image Node | 用户在图片上画标注，多选图片+标注后 capture | 导出包含图片和标注的透明或白底合成图，上传为 `merge_capture` asset | P0 scope, selection capture | 标注后的图片可变成新 Image Node |
| 4A.6 | Generated Asset → Image Node | AI run result 写入 `resultAssetIds`，节点展示输出 | 复用 `runtimeSummary.resultAssetIds`，Image Gen/4 输出可连边或转 Canvas | `NodeCardShape.tsx`, `nodeDataFlow.ts` | mock/真实 run 后输出 asset 能被下游识别 |
| 4A.7 | Image Node output → downstream node | Image Node 通过 `image_out` port 给 Analysis/Image Gen | engine query adapter 支持从 edge 找 Image Node effective asset | `getNodeOutput`, `resolveNodeInputs` | Image Node 连 Analysis 后 Run 可用 |
| 4A.8 | Prompt Node → Image Gen → Image Node | prompt text 经 edge 进入 image_gen | prompt/data/edge contract 不变 | `nodeDataFlow.ts`, `registry.ts` | Prompt 连 Generate，Run 后 resultAssetIds 可显示 |
| 4A.9 | Image import → Image Node | 上传文件进 Image Node | 读取 file preview，上传 Asset API，节点 data 写 asset ref | `importFileToImageNode` | 上传后节点显示图片，Board document 不含 data URL |
| 4A.10 | Paste/Drop image → Canvas/Image Node | 当前 tldraw/asset layer 可接图片资产 | Konva route 明确支持 drop/paste image 到 canvas 或 Image Node | `imageAssetInputs.ts`, asset upload client | 粘贴图片后走 R2 asset，不进 Board document Base64 |
| 4A.11 | Shape/Node selection export bounds | tldraw 用 shape geometry + page transform 算 bounds | engine 提供统一 `getSelectionExportBounds(ids)`，支持 rotation/scale | `getPageBounds` duplicates | capture/export 不裁切、不多留大空白 |
| 4A.12 | Export background policy | 当前 selection capture `background:false`，Board thumbnail 可有背景 | 明确区分 transparent selection export、thumbnail export、future canvas-to-image white background | `CanvasSelectionToolbar.tsx`, `boardThumbnailCapture.ts` | selection PNG 透明，thumbnail 可读 |
| 4A.13 | Asset origin | upload/editor_export/generated/merge_capture | 保留 `origin` 字段，方便 Admin/History/AI cost 追踪 | `assetTypes.ts`, `/api/assets/upload` | DB 里 origin 正确 |
| 4A.14 | Conversion undo/redo | tldraw 创建节点/图片可由 editor history 处理 | conversion 作为 single transaction：上传成功后 create node/image，可 undo 视觉对象，Asset 保留 | engine history | undo 删除新节点/图片但不破坏远端 asset |
| 4A.15 | Conversion status/error | 当前有 `Capture failed` / `Image node conversion failed` | UI 显示 loading/error，避免静默失败 | selection toolbar/actions | 断网/上传失败有可见提示 |
| 4A.16 | Web image copy → Canvas | 浏览器里复制网络图片后 `Ctrl/Cmd+V` 到画布 | Clipboard API 读取 image blob/html/img URL，上传到 Asset API/R2，再创建 Canvas image shape | clipboard handler + asset upload | 从网页复制图片，鼠标停在画布某处粘贴，图片出现在鼠标位置 |
| 4A.17 | Copy image from canvas | 选中 Canvas image 后 `Ctrl/Cmd+C` | clipboard 写 internal JSON + optional PNG/SVG fallback；内部粘贴保留 asset ref | command system | 复制后粘贴不重新上传同一张图，assetId 保持或可追踪 |
| 4A.18 | Paste at mouse position | 粘贴不是固定 offset，而是鼠标/视口焦点位置 | 记录最后 canvas pointer world point；粘贴时以该点为左上或中心锚点 | clipboard/pointer store | 鼠标在哪，粘贴图就出现在附近 |
| 4A.19 | Alt/Option drag copy image | 按住 Alt 拖拽图片复制 | drag start 如果 altKey，duplicate selected image shapes；复制 shape 引用同一 asset | selection drag engine | Alt 拖拽生成副本，原图不动，不重复上传 |
| 4A.20 | Image resize keep quality | 图片缩放不坏图、不拉糊、不丢比例 | 支持 corner resize keep ratio，edge resize 可自由；显示尺寸和 natural size 分离；使用合适 thumbnail LOD | image renderer | 放大缩小时图片不异常变形，保存恢复尺寸 |
| 4A.21 | Image boundary placement | 转换成 Image Node 出现在图片右侧 | `Canvas Image → Image Node` 使用图片 bbox：x = right + 40, y = top | `createImageNodeFromCanvasImage` | 多张图逐个转换，节点都在对应图片右侧 |
| 4A.22 | Screenshot/Capture placement | screenshot 成 Image Node 出现在 selection/image boundary 下方 | capture 使用 selected bounds：x = minX, y = maxY + 30 | `createImageNodeFromDataUrl`, `CanvasSelectionToolbar` | 多选图片/标注 capture 后节点在整个边界下方 |
| 4A.23 | To Canvas placement | Image Node 的 `To Canvas` 出现在节点右侧 | `Image Node → Canvas Image` 使用 node bbox：x = node right + 40, y = node top，创建后选中新图片 | `NodeCardContent.tsx` | To Canvas 后图片在节点右侧且被选中 |
| 4A.24 | Screenshot vs thumbnail | screenshot/canvas-to-image 是用户资产，thumbnail 是 Board 预览 | capture 上传为 `merge_capture` / `editor_export`；thumbnail 只更新 Board card preview | asset origin + board thumbnail | 两者不混淆，History/Board card 显示正确 |
| 4A.25 | Network image CORS fallback | 网络图片可能跨域导致 canvas tainted | 粘贴 URL/HTML 时优先后端 fetch/upload 或直接用原 URL 作为 asset source；export 前确保可导出 | asset upload proxy/future API | 复制外网图片后仍能保存和 capture，不因 CORS 破坏导出 |

### Phase 5：保存、历史、缩略图和 Board Shell

| 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| 5.1 | document guard | 禁止 data/blob/base64/长日志 | 复用 guard，适配 v2 document | `boardDocumentGuard.ts` | 违规文档被拦 |
| 5.2 | save now | 保存 Board document + thumbnail | engine serialize + API client 不变 | `CanvasBoardSaveAudit.tsx` | Save now 后刷新可恢复 |
| 5.3 | autosave | dirty 后延迟保存 | store change dirty tracking | `useBoardSaveLifecycle.ts` | 修改后自动进入 History |
| 5.4 | Cmd/Ctrl+S | keyboard save reason | 保持 shortcut | `useBoardKeyboardSaveShortcut` | 快捷键保存并入 history |
| 5.5 | snapshot | 手动 Snapshot | `createBoardSnapshot` 不变 | `useBoardSnapshots.ts` | snapshot 出现在 History |
| 5.6 | History restore | restore 后 dirty 并继续 autosave | restore engine document + mark dirty | `restoreBoardDocument` | 恢复后可再保存 |
| 5.7 | History filter | autosave/user save 分组 | 保持 reason 显示和筛选 | `CanvasBoardHistoryPanel.tsx` | 过滤项正确 |
| 5.8 | thumbnail | `editor.toImageDataUrl` | `stage.toDataURL` + padding/export rules | `boardThumbnailCapture.ts` | Workspace 卡片显示真实预览 |
| 5.9 | merge capture | 选区导出为 Image Node | export selected bounds to PNG/data upload | `CanvasSelectionToolbar.tsx` | 多选 capture 生成新 Image Node |
| 5.10 | Board switcher | 最近 5 个 Board 下拉 | 不受引擎影响 | `CanvasBoardSwitcher.tsx` | 切换 Board 能加载新 engine doc |
| 5.11 | unsaved guard | 离开前 warning | engine dirty status 接入 | `useBoardBeforeUnloadWarning` | 未保存返回有确认 |

### Phase 6：协同和多人基础

| 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| 6.1 | Yjs document | tldraw 当前无生产协同 | shapes/assets/edges/camera optional 映射到 Yjs | new `features/collaboration` | 两个 tab 同步对象 |
| 6.2 | awareness | 当前无真实多人 presence | 光标、头像、选区、当前工具 | S4 planning | 两个 tab 互看 cursor |
| 6.3 | 本地 undo | 多人场景 undo 只撤自己的操作 | origin/user scoped command history | Yjs origin | A undo 不撤 B 的操作 |
| 6.4 | 权限预留 | owner/editor/viewer 后续接 S1/S4 | viewer 只读，editor 可编辑 | board_members schema | viewer 无法写入 |
| 6.5 | 断线重连 | 当前无协同 | provider reconnect 后状态一致 | y-websocket/Hocuspocus | 断网恢复不丢 shape |
| 6.6 | 持久化收敛 | 当前靠 save/autosave | Yjs updates 或 snapshot 周期保存到 FastAPI | Board History API | 协同状态可转普通 snapshot |

### Phase 7：替换和下线 tldraw

| 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| 7.1 | 双引擎开关 | tldraw 默认 | env/feature flag 切换 engine | route config | staging 可快速回滚 |
| 7.2 | v1 文档迁移 | 当前保存 tldraw shapes | tldraw v1 → Tangent v2 adapter | serializer/restore | 老 Board 可打开 |
| 7.3 | 回归测试 | 当前 browser smoke | 保存、历史、节点、capture 全量手测 | HARNESS/dev plan | 手测清单全绿 |
| 7.4 | 性能回归 | tldraw baseline | Konva 不低于可接受线 | performance store | 大 Board 不明显退化 |
| 7.5 | license 清理 | tldraw 不进生产 path | 生产 bundle 不加载 tldraw runtime | package/build stats | staging console 无 tldraw license 报错 |

## tldraw Adapter Surfaces To Replace

High-risk replacements:

- `Editor` command/query APIs
- `TLShape` and `TLAsset` types
- `HTMLContainer` shape rendering
- tldraw shape utils
- tldraw style props
- tldraw arrow bindings
- `editor.toImageDataUrl`
- `b64Vecs` draw stroke decoding
- store listeners for dirty tracking, smart drawing and style panel revision

## Konva Spike Tasks

1. Install focused dependencies:

```text
konva
react-konva
yjs
perfect-freehand
```

Provider candidate:

```text
y-websocket first for local proof
Hocuspocus later if auth/persistence hooks are needed
```

2. Add route:

```text
apps/web/src/app/spikes/konva-canvas/page.tsx
apps/web/src/components/konva-canvas/*
apps/web/src/features/canvas-engine/*
```

3. Implement handfeel core:

- pointer capture
- RAF input batching
- point smoothing
- perfect-freehand outline
- pan/zoom under cursor
- erase stroke hit test
- undo/redo for strokes
- 1,000 stroke stress button

4. Implement product objects:

- stroke
- rectangle
- ellipse
- line/curve
- text placeholder
- image placeholder
- node card placeholder
- typed edge placeholder

5. Add document smoke:

- serialize
- restore
- local state reset
- compare JSON size
- no `data:` / `blob:` / Base64 in document

6. Add Yjs smoke:

- two browser tabs
- shared strokes
- shared node position
- cursor/presence
- reconnect behavior

## Acceptance Notes

Do not proceed to migrate `/boards/[boardId]` until the user has drawn in the Konva spike and accepted the handfeel.

If handfeel fails, evaluate Excalidraw before spending more time on Konva.

If Konva handfeel passes, next migration cut is a renderer-neutral `TangentBoardDocument` with adapters:

```text
tldraw v1 adapter
konva v2 adapter
shared board guard
shared API client
```
