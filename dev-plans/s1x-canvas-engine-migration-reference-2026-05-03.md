# S1X Canvas Engine Migration Reference

**Status**: Active tactical plan; Phase 4A image-node conversion first pass is in progress after accepted handfeel/properties/object-editing baselines.
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

## Latest Checkpoint

2026-05-03 S1X spike now has:

- Phase 1A first pass: pan/zoom applies directly to the Konva Stage, while React receives throttled camera previews and committed document camera snapshots.
- Draft drawing and eraser visuals are split away from the stable shape layer, so live drawing does not merge the draft into the 1k existing-shape list.
- Browser text-selection guards prevent drag/draw gestures from selecting toolbar or diagnostics text.
- Phase 2A accepted baseline: fixed left Properties panel supports Stroke, Fill, Width, Dash, Opacity, Layer order, Duplicate, Delete and collapse/expand.
- Style changes now update selected shapes and the next-shape style, so newly drawn shapes inherit the panel settings.
- Fill no longer relies on lowering opacity for `solid` / `pattern`; it uses opaque lighter tints of the stroke color, with crisp high-DPR generated hatching for pattern.
- Phase 3.1 started: interaction logic split out of the Stage, box-select marquee added, single-shape corner resize handles added, and undo/redo history now snapshots shapes plus selection without undoing camera pan/zoom.
- Phase 3.1 also has first-pass single-shape rotation: an offset rotate handle writes `rotation` and renders box-like shapes around their center point.
- Phase 3.1 object commands now cover keyboard Copy/Paste/Select all/Duplicate/Delete, Alt-drag duplicate, text double-click editing and a first-pass right-click menu for the same core commands. Alt-drag keeps the source object fixed while moving the new copy; Text is one-shot and returns to Select after inserting a text box.
- Frame and Sticky are closer to their reference behavior: Frame is a white clipped container with a top label and editable name; dragged-in shapes get `parentId` and are masked by the frame bounds. Sticky shows an author label, raised note shadow and centered editable text, with Properties limited to color and opacity.
- Phase 3.10-3.14 first pass is now implemented: right-click/properties/keyboard layer actions support front/forward/backward/back; text editing guards Cmd/Ctrl+S; eraser uses line/stroke geometric hit testing instead of bbox-only deletion; drag/resize snapping reads the shared canvas snap settings and renders guides; a DOM `selectionchange` guard clears accidental browser text selection inside the Konva shell.
- Phase 3 snap/duplicate correction: Alt/Option drag now commits from the final preview document so copied objects should not jump back to the source position; resize snap uses a resize-specific path that only snaps the dragged edge/corner, not the fixed anchor side; rotate now snaps to 15-degree increments and shows a radial guide when snap is active.
- Shape text correction: double-clicking rect/diamond/ellipse/cloud/triangle opens centered in-shape text editing. The text is stored on the shape props, so move/drag/resize/rotate/stroke color/opacity naturally apply with the container. Sticky editing overlay now starts centered instead of top-aligned.
- Alt/Option drag rewrite: drag now uses a clean `KonvaShapeDragSession`; move/duplicate sessions freeze moving shapes and snap target bounds at dragStart, and locked-source copy coordinates come from pointer delta instead of the reset Konva node position. User validation passed for snap-on Alt/Option copy near the source object.
- Phase 3B started: selected line/arrow now show endpoint handles instead of bbox resize handles; dragging either endpoint updates direction/length, with Shift locking to 15-degree increments.
- Phase 3B route model first pass: line/arrow now support Route properties for Straight, Curve and Elbow. Dragging the midpoint/control handle converts to curve; Elbow uses a first-pass H-V-H orthogonal connector with two visible bend handles.
- Phase 3B curve handle correction: the curve handle is displayed on the line body/curve midpoint, then converted internally to the quadratic control point so users drag the visible line instead of an off-line Bezier handle.
- Phase 3B head styles: line/arrow now expose Start Head and End Head properties with None, Dot and Arrow options; Arrow keeps a default end arrow for compatibility.
- Cleanup checkpoint: draft preview, eraser session, browser selection guard and snapping math were split into small helpers so `useKonvaCanvasInteractions.ts` stays under the 300-line source target.
- Phase 3B audit checkpoint: the main Shape/Line/Arrow/Eraser/Navigator spine is testable. Multi-selection rotate now has a first pass; node-port arrow binding, deeper frame containment, navigator collapse/fit, cursor polish and stroke segmentation remain explicit follow-ups.
- Phase 3A right-click menu first batch started: the menu now has real hover submenus for Edit / Arrange / Reorder / Copy as / Export as, edge clamping, Cut, platform-aware shortcuts and multi-selection Align commands. Group/lock/export/page commands are visible but disabled until their data contracts are ready.
- Image paste first pass: external clipboard images and OS screenshots can be pasted into the Konva canvas via Cmd/Ctrl+V or right-click Paste. The flow uploads clipboard image data through the existing Asset API and stores only asset ids/URLs on the image shape; image render uses zoom LOD tiers: 10-25% `thumb-256`, 25-50% `thumb-512`, 50-100% `thumb-1024`, and above 100% original.
- Rotation interaction fix: single rotated objects now keep their rotated transform controls during normal drag and Alt/Option copy drag. Rotated corner resize computes in the object's local rotated coordinate system instead of using the unrotated axis-aligned bbox. Konva min zoom is now 5%.
- Multi-selection rotate first pass: the union selection boundary now has a rotate handle. Rotation uses the group center and an origin-shape snapshot, so rectangles/images/text/sticky/frame rotate by updating x/y/rotation, while line/arrow/stroke points rotate around the same center. Shift proportional resize now uses one projected scale value so width and height preview in the same frame instead of visually stepping one after the other.
- Phase 3A command depth now wires previously disabled context-menu actions: Group/Ungroup, Lock/Unlock, Distribute, Stretch, Flip and Arrange row/column. Group membership uses lightweight `groupId`, lock blocks drag/resize/rotate/line endpoint edits, and grouped selections expand for click-select, drag, Alt/Option copy and clipboard clone.
- 2026-05-04 drag overlay correction: normal shape drag now uses the same clean drag-preview path as Alt/Option copy, so objects and resize/rotate controls move from one preview state instead of Konva native drag outrunning the selection overlay. Frame drag also suppresses the stale top chrome while moving, preventing the old-position black border from lingering.
- 2026-05-04 context-menu polish: right-click menu is now capped at two levels. Arrange no longer contains nested Align/Distribute/Stretch/Flip submenus; those commands are flattened into sectioned rows, and submenu hover uses a no-gap bridge so moving the mouse into the submenu does not collapse it so easily.
- 2026-05-04 lock polish: locked objects now show a small outline lock indicator above their bounds. Locked groups show one group-level icon, and right-clicking any grouped member selects the group scope first so Unlock applies to the whole group without manually selecting every member.
- 2026-05-04 multi-selection right-click priority: once a multi-selection boundary exists, right-click keeps that boundary as the command target even if the pointer is over a selected member, another group member or another shape. Hit-target selection only runs when there is no active multi-selection.
- 2026-05-04 oriented group boundary: rotated group/multi-selection now computes an oriented selection box from member geometry, so the blue boundary/resize handles follow group rotation instead of falling back to an axis-aligned union. The rotated box resize path now supports multi-selection first pass. Frame top chrome also rotates with the frame, removing the old unrotated black outline.
- 2026-05-04 Properties parity pass: Properties now has Align, Stretch, Distribute, Flip, Row/Column arrange and text font/alignment controls. Node card selection no longer shows ordinary stroke/fill/width noise.
- 2026-05-04 Properties action icon redraw: action icons now use explicit mask SVG line art per command. Align, Layer, Duplicate/Delete, Stretch, Distribute, Flip, Row/Column, Image Node, To Canvas and Capture no longer reuse misleading near-match icons.
- 2026-05-04 Sticky color fix: sticky note fill now derives from the current Color/stroke token during render, so editing note text no longer leaves a stale `style.fill` that blocks later color changes.
- 2026-05-04 Phase 4A image-node first pass: Canvas image selection can create a lightweight Konva `node_card` Image Node placed to the image's right. The node stores asset refs and dimensions only; To Canvas fetches the asset record and creates a canvas image to the node's right. Capture selection remains disabled until export bounds/upload are implemented.
- 2026-05-04 Frame containment first pass: dragged children can leave a frame and clear `parentId`; frame nesting is intentionally disabled for now. Frame visible bounds helpers are in place for later capture/export semantics.

Next development focus: hand-test Phase 2A/3A/4A first-pass actions, then continue Phase 4 node/port/edge contracts and Phase 4A selection capture/export.

## tldraw Behavior Inventory

Current user-facing behavior to match:

- Whiteboard pan/zoom with smooth pointer anchoring.
- Toolbar above the canvas.
- Fixed left properties drawer that does not disappear on blank canvas clicks.
- Drawing tools: hand, select, shapes, arrow, line, draw, text, eraser.
- Shape menu: rectangle, diamond, ellipse, triangle, cloud and frame.
- Context/right-click continuous drawing behavior.
- Escape exits continuous drawing and can select created shapes.
- Style controls: stroke, opaque tint fill, width, dash, line spline, arrow type/heads, font, opacity, layer, align and actions.
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

状态说明：`✅` 已落地并可进入手测验收；`◐` 已有 first pass / 部分完成 / 有 disabled 占位但还不能算完成；`☐` 尚未实现。

### Phase 0：参考锁定和测试基准

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | 0.1 | 参考路径冻结 | `/boards/[boardId]` 是当前真实 Board 体验 | 已保留 tldraw Board route，并新增 `/spikes/konva-canvas` 并行验证 | `CanvasSpike.tsx`, `KonvaCanvasSpike.tsx` | 新旧路由可同时打开 |
| ☐ | 0.2 | 体验录制 | 当前工具栏、properties、画线、节点、保存都作为样本 | 还未录制 3-5 个短手测流程，后面逐项比对 | browser staging | 用户能用视频/手测列表判断是否退化 |
| ✅ | 0.3 | tldraw 依赖清单 | 约 58 个前端文件引用 tldraw | 已在 project state 标记高风险产品逻辑/renderer adapter 面 | `components/canvas`, `features/node-runtime` | 迁移时不误删产品逻辑 |
| ✅ | 0.4 | 许可证边界 | 公网 staging 会报 tldraw license | Konva spike 使用 MIT-compatible stack，不依赖付费 canvas SDK | Vercel staging | Konva spike 不出现 license blocker |

### Phase 1：手感和画布基础

当前 checkpoint：`/spikes/konva-canvas` 已经具备 first-pass Konva Stage、freehand smoothing、pan/zoom、基础形状、minimap 和 diagnostics。用户进入画布默认是 Select；用户喜欢“选择绘制工具后左键连续绘制，直到手动切换工具”的交互，后续不要退回必须右键锁定才连续绘制的模式。Draw 默认只做轻微平滑，不做明显直线/形状拟合；当前偏建筑师钢笔感，慢线略重、快线略轻、起收笔轻微 taper。基础快捷键合同：`V` 选择，按住 `Space` 临时平移且不改变当前工具，鼠标中键拖拽平移。工具 tooltip 使用英文 `Tool: Shortcut`，Shift 绘制 shape 时锁定长宽比例。下一步先手测“画线和缩放是否值得继续”，再补选区、Properties、图片和节点链路。

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | 1.1 | 画布容器 | 白板铺满 Board 页面，UI 浮层不挡主要绘制 | `/spikes/konva-canvas` 已有 full-screen Konva Stage，UI overlay 与 canvas 分层 | `KonvaCanvasSpike.tsx`, `KonvaCanvasStage.tsx` | 画布区域尺寸、层级和现有接近 |
| ✅ | 1.2 | 平移 pan | hand 工具和触控板拖动稳定 | pan/zoom 第一版已绕开 React 热路径，Stage transform 直接预览 | `useKonvaStageCamera.ts`, `useKonvaCanvasInteractions.ts` | 拖动画布不飘、不丢帧 |
| ✅ | 1.3 | 滚轮/触控板缩放 | 缩放围绕当前视角/鼠标位置 | wheel zoom 已 pointer-anchored，camera commit 节流 | `useKonvaWheelHandler.ts` | 缩放后光标下对象位置不明显漂移 |
| ✅ | 1.4 | 100% 缩放 | 左下角数字点击回到 100% | navigator 保留 zoom reset；最小 zoom 下限已改为 5% | `KonvaCanvasNavigator.tsx`, `konvaZoomLimits.ts` | 点击百分比回 100%，可缩小到 5% |
| ✅ | 1.4A | 快捷平移 | tldraw/Miro 类画布常用 Space 临时 hand、中键平移 | `V` 切 Select；按住 `Space` 临时平移但不改变 active tool；中键拖拽平移 | `useKonvaCanvasShortcuts.ts`, `useKonvaCanvasInteractions.ts` | 松开 Space 后恢复原绘制工具 |
| ✅ | 1.5 | 背景 | dot/grid/solid，dot 非常淡且在元素下方 | 背景 layer 在 shape layer 下方，navigator/UI 在 DOM overlay | `KonvaCanvasStage.tsx` | dot 不盖住任何绘图元素 |
| ✅ | 1.6 | 自由画线采样 | 慢画不抖，快画不断 | 已有 pointer raw points、轻量 smooth/simplify 和 RAF draft preview | `konvaDraftShapes.ts`, `useKonvaDraftPreview.ts` | 慢线、快线、曲线手测通过 |
| ✅ | 1.7 | 笔触外观 | tldraw draw 风格有自然手感 | `perfect-freehand` outline；普通 Draw 保持轻微平滑、速度压力和轻微收头 | `konvaPathUtils.ts`, `konvaStrokeUtils.ts` | 用户接受达到当前 80% 手感 |
| ◐ | 1.8 | 性能基准 | 当前混合节点/图形可交互 | 已有 1,000 strokes 压测和 diagnostics；100 nodes/20 images 压测还未完整 | `KonvaCanvasDiagnostics.tsx`, `konvaSeedShapes.ts` | staging 浏览器无明显卡死 |
| ✅ | 1.9 | 事件隔离 | 点击 UI 不影响画布工具 | toolbar/properties/context menu stop propagation；右键不会触发画布框选 | `KonvaCanvasToolbar.tsx`, `KonvaCanvasProperties.tsx`, `KonvaContextMenu.tsx` | 点 toolbar/properties 不误画线 |

### Phase 1A：丝滑性能专项

| 状态 | 序号 | 性能点 | 当前风险 | 复刻/实现策略 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| ✅ | 1A.1 | React 不进热路径 | pointermove 触发 React 会卡；1k strokes pan/zoom 已反馈轻微卡顿 | 已拆 mutable tool session、RAF draft preview、shape memo；pan/zoom 直接预览 Stage transform | React Profiler 看不到每帧重渲染 |
| ◐ | 1A.2 | 分层渲染 | 背景、图片、节点、选区一起重绘会卡 | 已拆 background / shape / draft / selection / eraser layers；Image/Node/Edge/Presence 专层还未完整 | 画线时只 Stroke/Selection 层高频 redraw |
| ✅ | 1A.3 | pointer 采样 | 快速画线可能断，慢线可能抖 | 原始点保留，距离/时间阈值采样，RAF 批处理 | 快慢线手测都自然 |
| ✅ | 1A.4 | 笔触平滑 | Konva Line 原生手感可能不够；过度 streamline 会像直线拟合 | `perfect-freehand` outline + 轻量 smooth + 低 tolerance simplify；Smart Drawing 另设模式 | 用户认可接近 tldraw 80% |
| ✅ | 1A.5 | 坐标转换 | zoom/pan 后画线漂移 | screen/world transform 单一来源，pointer anchored zoom | zoom 后笔尖落点准确 |
| ◐ | 1A.6 | hit test | 大 Board 精确 hit test 昂贵 | line/arrow/stroke eraser 已有几何 precise hit；完整 bounds cache + viewport filter 未做 | 1,000 strokes 框选不明显卡 |
| ✅ | 1A.7 | drag/resize | 每帧 commit 文档会卡 | drag/resize/rotate 用 preview document，pointerup 形成 history checkpoint/commit；drag overlay correction 已让物体和控件共用同一 preview state | 拖动时流畅，undo 只产生一组操作 |
| ✅ | 1A.8 | image LOD | 大图 decode/render 卡 | Konva image shape 已按 zoom 选择 256/512/1024/original LOD；cache / interaction mode 后续补 | 20 张图 pan/zoom 不冻结 |
| ☐ | 1A.9 | node HTML | 大量 React 节点重渲染卡 | 非编辑态用轻量 visual，编辑态才开 HTML controls | 100 node cards 可拖动 |
| ◐ | 1A.10 | Yjs 本地优先 | 网络同步阻塞本地绘制 | spike 已初始化 Y.Doc，本地 render 立即完成；真实 provider transaction 未接 | 断网/慢网不影响本地画线 |
| ☐ | 1A.11 | presence 节流 | 光标同步太频繁会卡 | awareness 15-30fps，和 document updates 分离 | 两 tab 光标顺滑但不抢帧 |
| ☐ | 1A.12 | export 隔离 | thumbnail/capture 卡住绘图 | export 只在保存/手动触发，必要时 idle/worker 化 | 保存时可显示 loading，不影响普通绘制 |
| ✅ | 1A.13 | 指标面板 | 没指标容易凭感觉误判 | 已显示 frame/object/point diagnostics 和 1k strokes 压测入口 | spike 页面能看到诊断值 |

### Phase 2：工具栏和 Properties

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | 2.1 | 顶部工具栏位置 | toolbar 固定在上方，不放左侧 | 已有顶部 Konva toolbar 和 tool groups | `KonvaCanvasToolbar.tsx` | 页面刷新后位置一致 |
| ✅ | 2.2 | hand/select | 切换 hand/select，状态高亮 | activeTool state 已接入；进入画布默认 Select | `KonvaCanvasSpike.tsx`, `KonvaCanvasToolbar.tsx` | 当前工具高亮正确 |
| ✅ | 2.3 | shape 菜单 | rectangle/diamond/ellipse/triangle/cloud | 基础 shape tools 已展开在 toolbar；Shift 绘制和 resize 支持等比约束 | `konvaCanvasTypes.ts`, `konvaDraftShapes.ts` | 形状菜单和图标一致，Shift 画正形 |
| ✅ | 2.4 | direct tools | arrow/line/draw/text/eraser | arrow/line/draw/text/eraser 均已接入 Konva tools | `KonvaCanvasToolbar.tsx` | 每个按钮能创建/操作正确对象 |
| ✅ | 2.5 | 连续绘制 | tldraw 需要右键工具进入 continuous | 已采用用户认可规则：左键连续绘制；ESC/右键回 Select；右键不启动框选/绘制 session | `useKonvaCanvasInteractions.ts`, `useKonvaCanvasShortcuts.ts` | 连画多个形状不中断，不弹出选中高亮；ESC/右键后回选择模式，右键菜单后不出现框选虚线 |
| ✅ | 2.6 | tooltip / icons | 黑底白字，长文字不被裁切；图标要和动作语义对应 | 工具 tooltip 显示英文 `Tool: Shortcut`，Properties action icons 已重绘为每个 command 独立线稿 | `CanvasTooltipLayer.tsx`, `KonvaCanvasToolbar.tsx`, `canvas-action-icons.css` | toolbar/properties tooltip 可见；图标不误导 |
| ✅ | 2.7 | fixed properties | 点击空白不切换/消失，保持最后工具属性 | style panel state 与 selection 解耦；无 selection 时改 next shape style | `KonvaCanvasProperties.tsx` | 空白点击后 panel 不变 |
| ✅ | 2.8 | selection properties | 选中普通图形时显示 selected 样式 | selection style snapshot 已支持 shared/mixed 状态 | `konvaCanvasStyle.ts`, `KonvaCanvasProperties.tsx` | 单选/多选显示正确 |
| ✅ | 2.9 | node selection | node card 不显示普通图形属性 | Konva `node_card` first pass 已接入，选中 node 不显示普通 stroke/fill/width 噪音 | `KonvaNodeCardShape.tsx`, `konvaCanvasStyle.ts` | 选节点不出现无意义样式 |
| ✅ | 2.10 | stroke color | black/red/green/blue/orange/violet/grey | stroke swatches 已映射为 engine style token | `konvaCanvasStyle.ts` | 新旧颜色接近 |
| ✅ | 2.11 | fill | none/semi/solid/pattern | solid/pattern 已改为不透明浅色同色系；pattern 用高 DPR 生成 | `konvaCanvasStyle.ts`, `konvaPatternUtils.ts` | semi/solid/pattern 都不糊、不透，stroke/fill 区分明确 |
| ✅ | 2.12 | width/dash/font | s/m/l/xl，draw/solid/dashed/dotted，font 选项 | width/dash/font size/text align 已接入；draw 高级笔触细分仍由 2A.6 跟踪 | `KonvaCanvasProperties.tsx`, `KonvaPropertiesFont.tsx`, `konvaCanvasStyle.ts` | 图标不溢出，样式可保存 |
| ✅ | 2.13 | arrow style | arc/elbow，start/end heads | line/arrow Route + Start/End Head properties 已接入 | `KonvaLineProperties.tsx`, `konvaLineRouteUtils.ts` | 箭头视觉接近 |
| ✅ | 2.14 | opacity | selection/next shape opacity | selection 和 next tool 双写已接入 | `KonvaCanvasProperties.tsx` | 新对象继承 opacity |
| ✅ | 2.15 | layer/align/actions | send/back/bring/align/stretch/duplicate/delete | layer/duplicate/delete、Align、Distribute、Stretch、Flip、Row/Column arrange 已接入 Properties 和右键同源 helpers | `konvaCanvasStyle.ts`, `konvaArrangeCommands.ts`, `KonvaPropertiesSelectionActions.tsx`, `KonvaContextMenu.tsx` | 多选对齐和层级可用 |

### Phase 2A：Properties 面板完整对照

参考用户截图：Properties 里不仅要有样式按钮，还要有 selection 转换、layer、align、actions 的图标网格。按钮要是线性 SVG/图标风格，尺寸稳定，tooltip 不被裁切。

| 状态 | 序号 | Properties 区块 | 当前参考 | Konva/Yjs 复刻要求 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| ✅ | 2A.1 | Header | `Properties` + `Selected · N` 或当前工具样式 | 已显示当前 selection 数量；无 selection 时显示当前工具 style | 选中 0/1/3 个对象时文案正确 |
| ◐ | 2A.2 | Selection actions | Convert image to node、Capture selected to Image Node 两个图标 | selection toolbar first pass：Canvas Image → Image Node 和 Image Node → Canvas 可用；Capture selection 仍 disabled | 选图片/多选时按钮状态正确 |
| ✅ | 2A.3 | Stroke swatches | 黑、红、绿、蓝、橙、紫、灰；active 有紫色描边 | token 映射到 selected shapes 和 next shape | 选中图形改色立即生效 |
| ✅ | 2A.4 | Fill buttons | none / semi / solid / pattern | fill buttons 和 active 状态已接；solid/pattern 透明度修复已完成 | fill 状态保存/恢复 |
| ✅ | 2A.5 | Width buttons | s/m/l/xl 图标线宽不同 | 四档 width 已接入实际 strokeWidth | 四档线宽可见差异 |
| ◐ | 2A.6 | Dash buttons | draw/solid/dashed/dotted | dash 已有；draw 的高级笔触模式、等宽/钢笔/点线细分还未做 | dash 样式保存/恢复 |
| ✅ | 2A.7 | Opacity slider | 紫色 slider，右侧显示 0-100 | selection opacity 和 next opacity 都支持，mixed 显示 `Mixed` | 多选 mixed 状态可处理 |
| ✅ | 2A.8 | Layer grid | 置底/下移/上移/置顶图标 | 四档 z-order 已持久化，Properties/右键/快捷键同源 | 层级顺序变化可见并持久化 |
| ✅ | 2A.9 | Align grid | 左/中/右/顶/中/底等对齐 | Properties align grid 已接 `alignKonvaShapes`，与右键 Arrange > Align 同源 | 多选对齐符合截图菜单逻辑 |
| ✅ | 2A.10 | Actions grid | duplicate/delete/stretch 等 | Duplicate/Delete/Stretch/Distribute/Flip/Row/Column 已接入 Properties actions grid；图标已按动作语义独立重绘，不再复用 align/stretch 近似图标 | 点击 actions 和右键菜单结果一致 |
| ✅ | 2A.11 | Node card selection | 选 node 时不出现普通图形 stroke/fill 噪音 | Konva `node_card` first pass 已进入 route；普通 stroke/fill/width 面板对 node selection 隐藏 | 选节点不会让用户误改无效样式 |
| ✅ | 2A.12 | Mixed selection | 多选不同样式 | style snapshot 支持 mixed；点击某值后统一应用到 selection | 多选不同颜色后能统一设置 |
| ✅ | 2A.13 | Pointer isolation | properties 点击不触发画布选择/画线 | properties 已 stop pointer/wheel/context menu bubbling | 在 panel 上滚轮/点击不影响画布 |

### Phase 3：基础对象、选择和编辑细节

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | 3.1 | 对象模型 | TLShape 承载 x/y/rotation/props/index | spike 已有 `CanvasShape` id/type/x/y/rotation/style/props；board v2 serializer 还在后续 Phase 5/7 | `features/canvas-engine/types.ts` | JSON 可读、可迁移 |
| ✅ | 3.2 | 多选 | 框选/shift 选中多个对象 | box-select、Shift additive select、多选 union boundary 已有；line/arrow/stroke 选中高亮线本身；active multi-selection 的右键优先级高于鼠标命中的单个 shape | `KonvaSelectionOverlay.tsx`, `KonvaCanvasShape.tsx`, `KonvaCanvasSpike.tsx` | 框选复杂对象准确；框选后右键不会丢掉 boundary |
| ✅ | 3.3 | 拖拽 | 选中对象拖动丝滑 | normal drag / Alt-copy 都走 clean drag session；Konva native source 被锁回原位，由 preview document 驱动物体和 controls 同帧移动；多选/连续绘制单选移动可用 | `useKonvaShapeDragHandlers.ts`, `konvaDragSession.ts` | 拖动无跳变，缩放/旋转控件不慢半拍 |
| ◐ | 3.4 | resize | 图形和 node card 可 resize | shape/image/text/sticky/frame resize 已有；single 和 multi rotated resize first pass 已修；node card resize 未做 | `KonvaSelectionOverlay.tsx`, `konvaRotatedResize.ts`, `konvaOrientedBounds.ts` | resize 后内容不坏 |
| ✅ | 3.5 | rotate | 当前 tldraw shape 支持 rotation 字段 | 单选 box-like rotate、多选 union rotate 已有；group/multi boundary 会从成员几何计算 oriented box 跟随旋转；rotated drag/Alt-copy/resize 控件已修 | `konvaRotationUtils.ts`, `KonvaSelectionOverlay.tsx`, `konvaOrientedBounds.ts` | 保存/恢复 rotation，group 旋转后 boundary 不回到水平框 |
| ◐ | 3.6 | 删除 | Delete/Backspace 和面板 delete | shape delete 已接 Properties/右键/快捷键；edge cleanup 等 node runtime 还未接 | `konvaShapeCommands.ts`, `useKonvaCanvasShortcuts.ts` | 删除对象和 edges 清理一致 |
| ✅ | 3.7 | undo/redo | tldraw 内置历史 | command history 已记录 create/drag/resize/rotate/erase/style/layer/duplicate/delete；camera 不进 undo | `useKonvaCanvasHistory.ts` | Ctrl/Cmd+Z/Shift+Z 正常 |
| ◐ | 3.8 | copy/paste | 浏览器/内部 clipboard | 内部 shape JSON、image asset ref、外部 clipboard image paste 已有；node/edge copy 未做 | `konvaShapeCommands.ts`, `konvaImageClipboard.ts` | 复制节点/shape/edge 后位置偏移 |
| ✅ | 3.9 | Alt 拖拽复制 | tldraw 交互习惯 | 已重写为 clean drag session；source 锁原地，副本跟随；pointerup 从 final preview document 提交，snap 不再吸回源点 | `useKonvaShapeDragHandlers.ts`, `konvaDragSession.ts` | Alt 拖拽产生副本，松手不跳回原位 |
| ✅ | 3.10 | z-order | index 控制层级 | array order / zIndex model；右键、Properties、快捷键共用 `reorderKonvaShapes` 四档 action | `konvaCanvasStyle.ts`, `konvaContextActions.ts` | bring/send 操作持久化 |
| ✅ | 3.11 | text edit | text/note 可输入，不抢画布快捷键 | HTML textarea overlay；text/sticky/frame/shape label 可编辑；输入中阻止画布快捷键和 Cmd/Ctrl+S 浏览器保存 | `KonvaTextEditor.tsx`, `konvaShapeCommands.ts` | 输入中 Cmd+S 不误触，中文输入正常 |
| ◐ | 3.12 | eraser | 橡皮擦删除 draw/shape | line/arrow/stroke 用几何距离 hit test；拖尾 silhouette 保留；闭合 shape 仍是第一版，stroke segmentation 未做 | `useKonvaEraserSession.ts`, `konvaEraserHitTest.ts` | 擦除不误删远处对象，拖尾跟手 |
| ✅ | 3.13 | snapping | snap alignment/distance | drag/Alt-copy、resize、rotate 都接 shared snap settings；resize 只吸附拖动边/角；rotation 15-degree guide | `konvaSnapping.ts`, `useKonvaShapeDragHandlers.ts` | 开关和距离生效，固定 resize anchor 不乱跳 |
| ✅ | 3.14 | browser selection 清理 | 避免画布中误选中文本 | Konva shell `selectionchange` guard，编辑 textarea/input 里保留正常选区 | `useKonvaBrowserSelectionGuard.ts` | 拖动画布不出现蓝色文字选区 |

### Phase 3B：Shape / Line / Arrow / Eraser / Navigator 细则

参考用户截图：这一阶段不是“能画几个形状”这么简单，要复制 tldraw 的 shape 质感、线段编辑、箭头曲线控制和左下导航体验。

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| ✅ | 3B.1 | Rectangle | 工具栏 shape 菜单第一个，圆角/边框风格轻 | Konva Rect 支持 stroke/fill/dash/opacity/resize/rotate；双击进入居中文字编辑，文字跟随容器样式/transform | 画出、选中、resize、保存恢复 |
| ✅ | 3B.2 | Diamond | 菱形 shape | Konva polygon 支持 bbox resize；双击可编辑居中文字 | resize 后四角不畸形 |
| ✅ | 3B.3 | Circle/Ellipse | 圆/椭圆 shape | Konva Ellipse 从 bbox 生成；Shift 绘制/resize 等比；双击可编辑居中文字 | 圆形/椭圆可保持比例/自由缩放 |
| ✅ | 3B.4 | Triangle | 三角形 shape | Konva polygon/path 支持 resize；双击可编辑居中文字 | 三角边框/fill 正常 |
| ✅ | 3B.5 | Cloud | 云朵 shape 是截图重点；tldraw/CAD cloud 是根据拖拽矩形四边分段切弧，不是固定云朵轮廓缩放 | 已改为基于 bbox 四边按边长生成 revision-cloud scallop arcs；双击可编辑居中文字 | cloud 视觉和选择框接近 tldraw，不像固定图标拉伸 |
| ◐ | 3B.6 | Frame | tldraw frame 是白底黑框的视觉容器，框外内容被裁切，顶部显示 frame 名 | Frame 黑框白底、clip、`parentId`、双击改名、移动带 children 已有；drag 时隐藏 stale chrome，rotate 后 top chrome 跟随 frame 旋转不留旧黑边；drag-out/nested/export 语义未做 | 拖入对象后超出 frame 的部分被蒙住，双击可改名，移动/旋转时不残留旧边框 |
| ✅ | 3B.7 | Sticky / note | Miro-like sticky note：作者在上方，note 有阴影和立体感 | Sticky 显示 author label、raised shadow、居中文本；双击编辑正文；Properties 限颜色/透明度，支持 resize/rotate | Sticky 可创建、改色、改透明度、resize/rotate、双击中间文字编辑 |
| ◐ | 3B.8 | Shape active preview | shape popover hover tooltip，如 Cloud | toolbar tooltip 已有；shape popover 形态尚未做，因为当前 spike 展开显示所有 shape tools | hover cloud 显示 tooltip，popover 不乱跳 |
| ✅ | 3B.9 | Line straight | 直线工具生成两端控制点 | line shape 保存 start/end/control points，选中后显示端点 handles | 端点可拖拽 |
| ✅ | 3B.10 | Line midpoint curve | 截图里中点拖拽后线变曲线 | line 有线身上的 midpoint/control handle；拖中点生成 curve | 拖中点变曲线，曲率保存恢复 |
| ✅ | 3B.11 | Line endpoint edit | line/arrow 选中后可编辑端点 | line/arrow 端点 handle 可拖拽，端点移动后更新 start/end 并保持样式 | 拖动任一端点，线段端点准确跟随 |
| ✅ | 3B.12 | Line/arrow endpoint rotate | 线/箭头不是 bbox 旋转，而是通过端点方向变化形成旋转效果 | 端点拖拽可围绕另一端改变方向/长度；Shift 锁定 15-degree angle | 线和箭头可以通过端点自然改变角度 |
| ✅ | 3B.13 | Arrow straight | arrow 两端，默认箭头头部 | arrow visual 支持 start/end 和 default end arrow | 箭头终点头部方向正确 |
| ✅ | 3B.14 | Arrow curve edit | arrow 中点/控制点可拖成曲线 | arrow 与 line 共用 route/control model，支持 Straight/Curve/Elbow | 曲线 arrow 拖动后自然跟随 |
| ☐ | 3B.15 | Arrow bound to ports | arrow/edge 可吸附 node ports | port anchor + snap + edge data 分离尚未做 | 移动 node 后 arrow 跟随 port |
| ✅ | 3B.16 | Multi-selection rotate | tldraw 多选外侧 boundary 可整体旋转 | 多选 boundary 已从 axis union 升级为 oriented bounds；按 group center 旋转；box-like 写 x/y/rotation，line/arrow/stroke 写旋转后的点位 | 多选多个形状旋转后相对位置保持，boundary 跟随旋转，保存/undo 正常 |
| ✅ | 3B.17 | Draw pencil | 铅笔自由画线，保留手绘质感 | perfect-freehand stroke shape，轻量平滑、速度压力和 taper 已有 | 快慢线接近 tldraw |
| ◐ | 3B.18 | Eraser 质感 | eraser 不只是 delete，拖过笔画有擦除感 | 第一版整条 stroke/line/arrow 几何 hit delete 和拖尾已有；stroke segmentation erase 未做 | 擦除响应跟手，不误删远处图形 |
| ✅ | 3B.19 | Text tool | `T` 工具插入文字 | Text tool one-shot，HTML textarea overlay 编辑，shape label/sticky/frame 也复用 overlay | 双击/输入/中文 IME 正常 |
| ✅ | 3B.20 | Shape handles | 选中形状显示蓝色 bbox/handles | handles 尺寸随 zoom 稳定；单个和 group/multi rotated selection handles 跟随角度；拖动时 controls 使用 drag preview shapes 防止慢半拍；locked 对象/组显示线稿锁 icon | zoom 后 handle 不巨大/过小，旋转后拖拽复制控件跟随角度，普通拖动时控件不滞后 |
| ☐ | 3B.21 | Rotation/resize cursor | handle hover 显示正确反馈 | cursor manager 根据 handle/tool 更新尚未做 | 鼠标移到 handle 有专业反馈 |
| ✅ | 3B.22 | Minimap overview | 左下角 mini map 显示对象分布和当前视口紫框 | navigator/minimap 已显示 document overview 和 viewport | 大 Board 中能看见当前位置 |
| ☐ | 3B.23 | Minimap collapse | 左下角可折叠/展开 | collapse state 不影响画布事件 | 折叠后只留小控制 |
| ✅ | 3B.24 | Zoom buttons | - / + 按钮 | navigator -/+ 已接 camera zoom steps | 点击 -/+ 缩放稳定 |
| ✅ | 3B.25 | 100% reset | 中间 `100%` 按钮回归 100% | reset zoom to 1，保留当前视角中心定位；min zoom 已为 5% | 点击后回 100%，对象不跳到奇怪位置 |
| ☐ | 3B.26 | Fit/定位策略 | tldraw 可 zoomToFit/selection | zoom to selection / fit board 尚未做 | 多选后可定位选区，作为后续增强 |
| ✅ | 3B.27 | Grid under navigator | navigator 悬浮不影响 dot grid | navigator 是 UI overlay，背景仍在 canvas layer | 左下 UI 不遮挡关键操作过多 |

### Phase 3A：右键菜单和子菜单

参考用户截图：右键菜单是专业画布工具的重要入口。它必须与 toolbar/properties/快捷键共享同一套 command system，不能做成只显示的假菜单。

当前第一批实现原则：菜单结构、可用/不可用状态和共享命令已经跑通。Group/Lock 使用轻量 shape 字段承载；Move to page、Copy as、Export as 仍保持 disabled，等 capture/export 边界明确后再接。

| 状态 | 序号 | 菜单项 | 当前参考/快捷键 | Konva/Yjs 复刻要求 | 验收方式 |
| --- | --- | --- | --- | --- | --- |
| ✅ | 3A.1 | 右键打开位置 | 鼠标位置打开，子菜单向右展开 | 菜单 edge clamp、右侧空间不足时子菜单向左展开；右键 pointerdown 不触发 marquee selection；已有 multi-selection 时右键不重新命中单个对象 | 画布边缘右键不被裁切，Copy/Paste 后不残留框选，框选后右键仍编辑当前 boundary |
| ✅ | 3A.2 | 编辑 > 分组 | `⌘G` / `Ctrl+G` | 多选写入同一个 `groupId`；点选 group 成员会选中整组；拖动/Alt-copy/复制会按组扩展 | 多选后 group，可一起拖动和复制 |
| ✅ | 3A.3 | 编辑 > 展开/取消分组 | `⇧⌘G` / `Shift+Ctrl+G` | Ungroup 清空所选 group 的 `groupId`；保留原 shape 顺序和选中对象 | group 后可拆回独立对象 |
| ✅ | 3A.4 | 编辑 > 锁定/解锁 | `⇧L` | `isLocked` 已接菜单和快捷键；locked shape 阻止 drag/resize/rotate/line endpoint edits；右键命中 group 成员会选择 group scope，Unlock 直接作用于整组 | locked 对象不误移动，group lock/unlock 不需要逐个成员解锁 |
| ✅ | 3A.5 | 排列 > 对齐 | 左/水平/右/顶/垂直/底 | 右键 Arrange 面板已扁平化为二级菜单内 section rows；Align 命令已做，后续接 Properties align 同源入口 | 多选后对齐准确 |
| ✅ | 3A.6 | 排列 > 分布 | 横向分布 / 纵向分布 | 3 个以上对象按选区 span 计算等间距；locked 对象不参与变换 | 三个以上对象分布正确 |
| ✅ | 3A.7 | 排列 > 拉伸 | 水平拉伸 / 垂直拉伸 | 多选对象拉伸到 shared selection bounds；locked 对象不参与变换 | 多选对象尺寸变化符合预期 |
| ✅ | 3A.8 | 排列 > 翻转 | 水平翻转 / 垂直翻转 | box/image/sticky/text/frame 写 `flipX/flipY` 并镜像位置；line/arrow/stroke 镜像点位 | 翻转后保存恢复 |
| ◐ | 3A.9 | 排列 > 打包 | pack selected shapes | 菜单位置已保留 disabled；pack command 未做 | 不支持时明确 disabled |
| ✅ | 3A.10 | 排列 > 横排/竖排 | arrange selected in row/column | Row/Column tidy first pass：按当前位置排序、统一 cross-axis center、使用固定 spacing | 多选重排成行/列 |
| ✅ | 3A.11 | 重新排序 > 置顶 | `]` reference | bring to front 已接右键/Properties/快捷键 | 与 properties layer 一致 |
| ✅ | 3A.12 | 重新排序 > 上移一层 | `⌥]` reference | bring forward 已接右键/Properties/快捷键 | 层级只移动一层 |
| ✅ | 3A.13 | 重新排序 > 下移一层 | `⌥[` reference | send backward 已接右键/Properties/快捷键 | 层级只移动一层 |
| ✅ | 3A.14 | 重新排序 > 置底 | `[` reference | send to back 已接右键/Properties/快捷键 | 层级持久化 |
| ◐ | 3A.15 | 移动到页面 | submenu placeholder | 菜单已有 disabled 占位；未来多 page 支持未做 | 不误导用户当前多页面已完成 |
| ✅ | 3A.16 | 剪切 | `⌘X` | 右键 Cut 和键盘 Cmd/Ctrl+X 已做：复制内部 shape JSON 后删除 selection | paste 后对象恢复，asset ref 不变 |
| ◐ | 3A.17 | 复制 | `⌘C` | 内部 shape JSON copy 已做；optional image/SVG clipboard fallback 未做 | 可跨同页面粘贴 |
| ✅ | 3A.18 | 粘贴 | `⌘V` | 内部 shape JSON 和外部 image clipboard 均可 paste；Cmd/Ctrl+V 使用 paste event，右键 Paste 使用 async clipboard；位置取最后鼠标 world point | 粘贴位置合理，不覆盖原对象 |
| ✅ | 3A.19 | 复制/重复 | `⌘D` | duplicate with offset 已接 Properties/右键/快捷键 | 与 properties duplicate 一致 |
| ◐ | 3A.20 | 删除 | Delete/Backspace icon | shape delete 已接；connected edges cleanup 等 node runtime 未接 | 删除节点时相关 edges 清理 |
| ◐ | 3A.21 | 复制为 > SVG | `⌘⇧C` reference | 菜单已有 disabled 占位；selection SVG export 未做 | 可先支持 basic shapes，复杂节点降级 |
| ◐ | 3A.22 | 复制为 > PNG | submenu item | 菜单已有 disabled 占位；selection PNG clipboard export 未做 | 透明开关影响输出 |
| ◐ | 3A.23 | 复制为 > 透明 | toggle | 菜单已有 disabled 占位；export background toggle 未做 | capture/export 透明可切换 |
| ◐ | 3A.24 | 导出为 > SVG | export file | 菜单已有 disabled 占位；selection/board SVG export 未做 | 下载文件名合理 |
| ◐ | 3A.25 | 导出为 > PNG | export file | 菜单已有 disabled 占位；selection/board PNG export 未做 | PNG 尺寸和 bounds 正确 |
| ◐ | 3A.26 | 导出为 > 透明 | toggle | 菜单已有 disabled 占位；export options state 未做 | 状态在菜单中可见 |
| ✅ | 3A.27 | 选中全部 | `⌘A` | Select all visible/page objects 已接右键/快捷键 | 不选中 locked hidden internals |
| ✅ | 3A.28 | 菜单 disabled | 无 selection 时部分禁用 | 无 selection 禁用 Cut/Copy/Duplicate/Reorder/Copy as/Delete；Group/Align/Stretch/Distribute/Tidy 按 selection count 启用；Lock/Unlock 按当前锁定状态启用 | 空白右键只显示可用项 |
| ✅ | 3A.29 | 子菜单 hover | hover 展开，鼠标可进入子菜单 | 右键菜单限制为最多两层；submenu 无 6px gap，并加 hover bridge；仍支持 edge side flip | 鼠标滑入子菜单不易消失，不需要先点击上层 |
| ✅ | 3A.30 | 键盘快捷键显示 | 右侧显示 `⌘C` 等 | 根据平台显示 Mac `⌘` 或 Windows/Linux `Ctrl+` | Mac 显示 ⌘，Windows 显示 Ctrl |

### Phase 4：节点、端口、边和 AI Runtime

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ☐ | 4.1 | 节点类型 | prompt/image/image_gen/image_gen_4/analysis | `TangentNodeShape` renderer 尚未做 | `NodeCardShape.tsx`, `registry.ts` | 五类节点都能创建 |
| ☐ | 4.2 | 节点 UI | HTMLContainer 内 React 控件 | Konva Group + React/HTML overlay 策略尚未做 | `NodeCardContent.tsx` | 输入框/按钮可操作 |
| ☐ | 4.3 | node data | props.data 保存 prompt/model/resolution 等 | renderer-neutral node props 尚未做 | `types/nodeRuntime.ts` | 保存恢复不丢参数 |
| ☐ | 4.4 | runtime summary | status/cost/error/resultAssetIds | 现有 summary contract 还未接 Konva renderer | `NodeCardShape.tsx` | mock run 状态显示一致 |
| ☐ | 4.5 | ports | typed text/image input/output dot | 端口坐标函数 + hit target 尚未做 | `NodePortDot.tsx` | 拖线能吸附端口 |
| ☐ | 4.6 | edge store | runtimeEdges 独立保存 | `TangentEdge` 一等数据尚未做 | `nodeEdges.ts` | edge 不依赖视觉箭头存在 |
| ☐ | 4.7 | input resolution | 通过 edges 找上游文本/图片 | engine query adapter 尚未做 | `nodeDataFlow.ts` | prompt→gen、image→analysis 正常 |
| ☐ | 4.8 | image node | canvas image 可转 Image Node | Canvas image 已有；Image Node create 尚未做 | `imageNodeAssets.ts` | 选图片转换节点 |
| ☐ | 4.9 | selection toolbar | 转 Image Node、Capture、Align | overlay selection toolbar 尚未复刻 | `CanvasSelectionToolbar.tsx` | 多选时出现在选区上方 |
| ☐ | 4.10 | edge delete/cut | 选中 edge 可断开 | edge hit test + delete button 尚未做 | `CanvasNodeEdgeOverlay.tsx` | 删除 edge 后 input count 同步 |
| ☐ | 4.11 | arrow port snap | arrow creation/handle drag 时吸附端口 | port snap margin 按 zoom 换算尚未做 | `arrowSnapLogic.ts` | 缩放下吸附距离自然 |

### Phase 4A：Canvas / Node / Image 转换链路

这是 TANGENT 的核心链路，必须当成一等功能复刻，而不是后补按钮。

| 状态 | 序号 | 转换链路 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | 4A.1 | Canvas Image → Image Node | 选中画布 image shape 后，selection toolbar/properties 有 Convert to Image Node | Konva selection toolbar first pass 已读取 `CanvasImageShape` 并创建 `node_card` image node；node data 只存 asset refs/尺寸/title/source，不存 Base64 | `konvaImageNodeConversion.ts`, `KonvaSelectionToolbar.tsx`, `KonvaNodeCardShape.tsx` | 选中单张图片点击转换，生成 Image Node 且 asset 不复制成 Base64 |
| ◐ | 4A.2 | Image Node → Canvas Image | Image Node header 的 `To Canvas` 把节点资产放回画布 | selection toolbar first pass 已支持 Image Node → Canvas Image，按 asset id 从 Asset API 拉取 URL 后创建 image；正式 node header button 等 Phase 4 Node UI | `konvaImageNodeConversion.ts`, `useKonvaImageNodeActions.ts` | 有图片的 Image Node 点击 To Canvas，画布出现图片并选中 |
| ☐ | 4A.3 | Selection → Image Node | 选择多个对象后 Capture to Image Node | selection export/upload/create Image Node 尚未做 | `createImageNodeFromDataUrl`, `editor.toImageDataUrl`, `CanvasSelectionToolbar.tsx` | 多选图形/图片/节点后生成 Merged selection Image Node |
| ☐ | 4A.4 | Canvas → Image / Merge Capture Preview | Merge Capture 预览当前 selection 导出结果 | bounded PNG preview 尚未做 | `CanvasMergeCapturePanel.tsx` | 预览图尺寸正确，caption 显示宽高 |
| ☐ | 4A.5 | Canvas Markup → New Image Node | 用户在图片上画标注，多选图片+标注后 capture | merge_capture export/upload 尚未做 | P0 scope, selection capture | 标注后的图片可变成新 Image Node |
| ☐ | 4A.6 | Generated Asset → Image Node | AI run result 写入 `resultAssetIds`，节点展示输出 | node runtime output 展示未接 Konva | `NodeCardShape.tsx`, `nodeDataFlow.ts` | mock/真实 run 后输出 asset 能被下游识别 |
| ☐ | 4A.7 | Image Node output → downstream node | Image Node 通过 `image_out` port 给 Analysis/Image Gen | engine query adapter 未做 | `getNodeOutput`, `resolveNodeInputs` | Image Node 连 Analysis 后 Run 可用 |
| ☐ | 4A.8 | Prompt Node → Image Gen → Image Node | prompt text 经 edge 进入 image_gen | prompt/data/edge contract 未接 Konva node | `nodeDataFlow.ts`, `registry.ts` | Prompt 连 Generate，Run 后 resultAssetIds 可显示 |
| ☐ | 4A.9 | Image import → Image Node | 上传文件进 Image Node | Image Node upload/import 未做 | `importFileToImageNode` | 上传后节点显示图片，Board document 不含 data URL |
| ◐ | 4A.10 | Paste/Drop image → Canvas/Image Node | 当前 tldraw/asset layer 可接图片资产 | paste image → Canvas image 已支持并走 Asset API；drop image 和 Image Node drop 未做 | `konvaImageClipboard.ts`, asset upload client | 粘贴图片后走 R2 asset，不进 Board document Base64 |
| ◐ | 4A.11 | Shape/Node selection export bounds | tldraw 用 shape geometry + page transform 算 bounds | rotated box bounds first pass 已进 shared geometry；统一 `getSelectionExportBounds(ids)` 和 node export bounds 未做 | `geometry.ts`, `getPageBounds` duplicates | capture/export 不裁切、不多留大空白 |
| ☐ | 4A.12 | Export background policy | 当前 selection capture `background:false`，Board thumbnail 可有背景 | export background policy 尚未定义/接入 | `CanvasSelectionToolbar.tsx`, `boardThumbnailCapture.ts` | selection PNG 透明，thumbnail 可读 |
| ☐ | 4A.13 | Asset origin | upload/editor_export/generated/merge_capture | Konva conversion origin policy 尚未接 | `assetTypes.ts`, `/api/assets/upload` | DB 里 origin 正确 |
| ✅ | 4A.14 | Conversion undo/redo | tldraw 创建节点/图片可由 editor history 处理 | Image→Node / Node→Canvas first pass 都在转换前创建 history checkpoint；远端 asset 不被 undo 删除 | engine history | undo 删除新节点/图片但不破坏远端 asset |
| ☐ | 4A.15 | Conversion status/error | 当前有 `Capture failed` / `Image node conversion failed` | conversion UI loading/error 尚未做 | selection toolbar/actions | 断网/上传失败有可见提示 |
| ✅ | 4A.16 | Web image copy → Canvas | 浏览器里复制网络图片后 `Ctrl/Cmd+V` 到画布 | 已读取 clipboard image file/blob 和 HTML img URL；blob/data 走 Asset API，远程 URL 作为 source fallback | `konvaImageClipboard.ts` | 从网页复制图片，鼠标停在画布某处粘贴，图片出现在鼠标位置 |
| ◐ | 4A.17 | Copy image from canvas | 选中 Canvas image 后 `Ctrl/Cmd+C` | internal JSON copy 已支持，粘贴保留 asset ref；PNG/SVG fallback 未做 | `konvaShapeCommands.ts`, `konvaClipboardCommands.ts` | 复制后粘贴不重新上传同一张图，assetId 保持或可追踪 |
| ✅ | 4A.18 | Paste at mouse position | 粘贴不是固定 offset，而是鼠标/视口焦点位置 | 已记录最后 canvas pointer world point；右键 Paste 使用右键位置 | `KonvaCanvasSpike.tsx` | 鼠标在哪，粘贴图就出现在附近 |
| ✅ | 4A.19 | Alt/Option drag copy image | 按住 Alt 拖拽图片复制 | image shape 复用 shape drag/duplicate session，副本引用同一 asset URLs | `useKonvaShapeDragHandlers.ts`, `konvaShapeCommands.ts` | Alt 拖拽生成副本，原图不动，不重复上传 |
| ✅ | 4A.20 | Image resize keep quality | 图片缩放不坏图、不拉糊、不丢比例 | image 显示尺寸和 source 分离；resize/rotate 复用 box 控件；LOD render 已有；Shift 等比 resize 已同步修正 | `KonvaImageShape.tsx`, `konvaRotatedResize.ts` | 放大缩小时图片不异常变形，保存恢复尺寸 |
| ✅ | 4A.21 | Image boundary placement | 转换成 Image Node 出现在图片右侧 | Canvas Image → Image Node first pass 放在原图片右侧固定 gap | `konvaImageNodeConversion.ts` | 多张图逐个转换，节点都在对应图片右侧 |
| ☐ | 4A.22 | Screenshot/Capture placement | screenshot 成 Image Node 出现在 selection/image boundary 下方 | capture → Image Node 尚未做 | `createImageNodeFromDataUrl`, `CanvasSelectionToolbar` | 多选图片/标注 capture 后节点在整个边界下方 |
| ✅ | 4A.23 | To Canvas placement | Image Node 的 `To Canvas` 出现在节点右侧 | Image Node → Canvas Image first pass 放在节点右侧并选中新图片 | `konvaImageNodeConversion.ts` | To Canvas 后图片在节点右侧且被选中 |
| ☐ | 4A.24 | Screenshot vs thumbnail | screenshot/canvas-to-image 是用户资产，thumbnail 是 Board 预览 | screenshot/capture/thumbnail origin 区分未接 Konva | asset origin + board thumbnail | 两者不混淆，History/Board card 显示正确 |
| ◐ | 4A.25 | Network image CORS fallback | 网络图片可能跨域导致 canvas tainted | paste URL/HTML first pass 已有 source fallback；后端 fetch/upload/export-safe 代理未做 | asset upload proxy/future API | 复制外网图片后仍能保存和 capture，不因 CORS 破坏导出 |

### Phase 5：保存、历史、缩略图和 Board Shell

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ☐ | 5.1 | document guard | 禁止 data/blob/base64/长日志 | v2 document guard 适配尚未做 | `boardDocumentGuard.ts` | 违规文档被拦 |
| ☐ | 5.2 | save now | 保存 Board document + thumbnail | Konva engine serialize + Board API save 尚未接 | `CanvasBoardSaveAudit.tsx` | Save now 后刷新可恢复 |
| ☐ | 5.3 | autosave | dirty 后延迟保存 | Konva store dirty tracking 尚未接 Board lifecycle | `useBoardSaveLifecycle.ts` | 修改后自动进入 History |
| ☐ | 5.4 | Cmd/Ctrl+S | keyboard save reason | Board save shortcut 尚未接 Konva route；text editor 内 Cmd/Ctrl+S guard 已做但不是保存 | `useBoardKeyboardSaveShortcut` | 快捷键保存并入 history |
| ☐ | 5.5 | snapshot | 手动 Snapshot | Konva document snapshot 尚未接 Board History API | `useBoardSnapshots.ts` | snapshot 出现在 History |
| ☐ | 5.6 | History restore | restore 后 dirty 并继续 autosave | restore engine document + mark dirty 尚未做 | `restoreBoardDocument` | 恢复后可再保存 |
| ☐ | 5.7 | History filter | autosave/user save 分组 | Board History reason/filter 不受 spike 影响，但 Konva save history 未接 | `CanvasBoardHistoryPanel.tsx` | 过滤项正确 |
| ☐ | 5.8 | thumbnail | `editor.toImageDataUrl` | `stage.toDataURL` + padding/export rules 尚未做 | `boardThumbnailCapture.ts` | Workspace 卡片显示真实预览 |
| ☐ | 5.9 | merge capture | 选区导出为 Image Node | export selected bounds to PNG/data upload 尚未做 | `CanvasSelectionToolbar.tsx` | 多选 capture 生成新 Image Node |
| ☐ | 5.10 | Board switcher | 最近 5 个 Board 下拉 | Board shell 尚未接 Konva engine route | `CanvasBoardSwitcher.tsx` | 切换 Board 能加载新 engine doc |
| ☐ | 5.11 | unsaved guard | 离开前 warning | engine dirty status 接入尚未做 | `useBoardBeforeUnloadWarning` | 未保存返回有确认 |

### Phase 6：协同和多人基础

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ◐ | 6.1 | Yjs document | tldraw 当前无生产协同 | spike 已初始化 `Y.Doc`；shapes/assets/edges/camera 映射和 provider sync 未做 | new `features/collaboration` | 两个 tab 同步对象 |
| ☐ | 6.2 | awareness | 当前无真实多人 presence | 光标、头像、选区、当前工具尚未做 | S4 planning | 两个 tab 互看 cursor |
| ☐ | 6.3 | 本地 undo | 多人场景 undo 只撤自己的操作 | origin/user scoped command history 尚未做 | Yjs origin | A undo 不撤 B 的操作 |
| ☐ | 6.4 | 权限预留 | owner/editor/viewer 后续接 S1/S4 | viewer/editor write gates 尚未接 Konva collaboration | board_members schema | viewer 无法写入 |
| ☐ | 6.5 | 断线重连 | 当前无协同 | provider reconnect 后状态一致尚未做 | y-websocket/Hocuspocus | 断网恢复不丢 shape |
| ☐ | 6.6 | 持久化收敛 | 当前靠 save/autosave | Yjs updates 或 snapshot 周期保存到 FastAPI 尚未做 | Board History API | 协同状态可转普通 snapshot |

### Phase 7：替换和下线 tldraw

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ☐ | 7.1 | 双引擎开关 | tldraw 默认 | env/feature flag 切换 engine 尚未做 | route config | staging 可快速回滚 |
| ☐ | 7.2 | v1 文档迁移 | 当前保存 tldraw shapes | tldraw v1 → Tangent v2 adapter 尚未做 | serializer/restore | 老 Board 可打开 |
| ☐ | 7.3 | 回归测试 | 当前 browser smoke | 保存、历史、节点、capture 全量手测尚未做 | HARNESS/dev plan | 手测清单全绿 |
| ☐ | 7.4 | 性能回归 | tldraw baseline | Konva 不低于可接受线尚未做 | performance store | 大 Board 不明显退化 |
| ☐ | 7.5 | license 清理 | tldraw 不进生产 path | 生产 bundle 不加载 tldraw runtime 尚未做 | package/build stats | staging console 无 tldraw license 报错 |

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
