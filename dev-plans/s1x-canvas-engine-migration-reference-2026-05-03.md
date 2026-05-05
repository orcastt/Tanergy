# S1X Canvas Engine Migration Reference

**Status**: Active tactical plan; Phase 4 runtimeGraph cleanup first pass is in progress after accepted handfeel/properties/object-editing baselines.
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
- Phase 3A right-click menu first batch started: the menu now has real hover submenus for Edit / Arrange / Reorder / Copy as / Export as, edge clamping, Cut, platform-aware shortcuts and multi-selection Align commands. Group/lock/arrange/export commands are wired; Move to page and transparent-background toggles remain disabled.
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
- 2026-05-04 Phase 4A image-node first pass: Canvas image selection can create a lightweight Konva `node_card` Image Node placed to the image's right. The node stores asset refs and dimensions only; To Canvas fetches the asset record and creates a canvas image to the node's right. Capture selection now renders explicit selectedIds bounds to transparent PNG, uploads with `origin=merge_capture`, and creates an Image Node below the selection.
- 2026-05-04 Phase 4A image node correction: Canvas Image → Image Node now writes preview URLs and keeps the card title as `Image`; selections containing images show Convert and create one Image Node per selected image while ignoring non-image markup, so mixed image+markup selections still have Convert plus Capture. Cropped canvas images now carry crop-ratio metadata into Image Nodes, node previews respect the crop, Image Node output/mirror payloads preserve it, and `To Canvas` restores it onto the created canvas image. Image Node's header pill is now `To Canvas`, and the floating toolbar no longer shows Image Node → Canvas over canvas images. SVG export now renders image/image-node previews from asset URLs instead of dashed placeholder boxes. Crop now enters a four-edge image crop edit mode for single image selections instead of toggling a preset crop.
- 2026-05-04 Phase 4A offscreen capture polish: Capture/Copy/Export PNG now clone the Konva stage into an offscreen hidden container, hide non-selected shapes and capture-excluded chrome there, then destroy the clone. The visible canvas no longer enters capture mode or flashes. Offscreen capture also rehydrates selected image/image-node previews from original asset URLs so low-zoom LOD thumbnails do not get baked into exported user assets.
- 2026-05-04 Frame containment first pass: dragged children can leave a frame and clear `parentId`; frame nesting is intentionally disabled for now. Frame visible bounds helpers are in place for later capture/export semantics.
- 2026-05-04 Phase 4 Node/Port/Edge foundation first pass: toolbar can create Prompt/Image/Image Gen/Image Gen 4/Analysis nodes; node cards render registry-derived fields/status/ports; output ports can drag-connect to compatible input ports with a runtime edge preview; `CanvasDocument.runtimeEdges` stores dataflow edges separately from visual arrows/lines and participates in undo/redo and node-delete cleanup.
- 2026-05-04 Node extensibility guard: Konva node creation palette, card size, accent color, port rendering and type guard now derive from `node-runtime/registry.ts`. Future nodes such as text optimizer, multi-text merge or perspective image generation should be added by registering a node definition plus runtime resolver/AiRun adapter, not by hardcoding new cases into canvas toolbar/stage/edge rendering.
- 2026-05-04 Phase 4 node UX pass: blank-canvas double-click opens a registry-driven node create menu above the pointer; the top toolbar now has one Node main icon/dropdown instead of one button per node type. Node cards are simplified, port labels are removed from the card body, and hovering ports shows a black tooltip with the text/image type.
- 2026-05-04 Node dataflow UX pass: runtime outputs can fan out to multiple downstream inputs while each input port keeps one upstream edge. Selecting a runtime edge shows a near-input black `-` disconnect control. Image Gen/Image Gen 4 image input ports grow/shrink from connected image edges, and Image Gen 4 exposes four image output ports.
- 2026-05-04 Image Node upload/display pass: Image Node double-click opens local image upload, image file drop onto an Image Node uploads through the Asset API, and previews use contain-fit rendering while respecting explicit crop metadata from converted canvas images. Image Node can also mirror an upstream Image Node asset through an image edge; disconnect clears only the upstream-derived preview and does not delete local uploads.
- 2026-05-04 image operation planning: Phase 4A now tracks two open-source cutout targets. `rembg` is planned for one-click background removal; `facebookresearch/segment-anything` is planned for point/box object cutout. Both stay server-side first and create new transparent image assets placed slightly down-right from the source image.
- 2026-05-04 Phase 4A image asset polish: asset origins now distinguish `board_thumbnail`, `remote_import`, `background_removal` and `object_cutout`. Browser-copied remote image URLs are imported server-side through `/assets/from-url` before being placed on the canvas, avoiding `remote-*` export-taint fallbacks. Canvas image and node preview caches were raised to 160 entries; under 25% zoom they prefer thumbnails/reduced placeholders instead of pulling originals.
- 2026-05-04 Phase 4A image ops contract: the selection toolbar now exposes Remove BG and disabled Object Cutout actions for single image selections. FastAPI has `/api/v1/image-ops/remove-background` with optional `services/api[image-ops]` `rembg` execution and `origin=background_removal`; Object Cutout is reserved behind a `/object-cutout` 501 contract until SAM point/box UX lands. License checkpoint: `danielgatis/rembg` MIT; `facebookresearch/segment-anything` code/model Apache-2.0; SA-1B dataset is not a dependency.
- 2026-05-04 Phase 4A image-pressure polish: user confirmed Capture/Copy/Export PNG no longer flashes. 50-100 images still caused whole-canvas lag, so drag preview no longer writes a full preview document on every pointermove, transform/crop/line previews are RAF-coalesced, render culling skips shapes outside the padded viewport, and non-Select drawing tools keep ordinary image/shape hit graphs off while node ports remain connectable. Hand-test still required on macOS and Windows with 50/100 images at 5/15/25/50/100% zoom.
- 2026-05-04 Phase 4A image-pressure hand-test checkpoint: user reported the current performance/capture pass is temporarily OK. Keep it as a local acceptance checkpoint, but still re-run Windows and heavier-board pressure tests before Phase 5.
- 2026-05-04 Phase 4A conversion error polish: selection actions now show a visible inline red error in the floating toolbar when Capture selection, Copy/Export PNG/SVG or Remove BG fails, instead of only logging to console. The message clears when the selection changes or the next action starts.
- 2026-05-04 Phase 4A table reconciliation: Prompt Node → Image Gen/Image Gen 4 → Image Node is now marked landed for the mock runtime path. `runtimeGraphResolution.ts` resolves Prompt `text_out` into generator `text_in`, the mock Run adapter creates generated asset refs, and downstream Image Nodes mirror those outputs through runtime edges.
- 2026-05-04 Phase 4A paste-into-Image-Node polish: clipboard image paste now targets an Image Node when one is selected or under the paste point. The pasted image is uploaded as an asset and written as the Image Node's own data through runtimeGraph reconciliation, replacing incoming upstream image edges instead of placing a separate canvas image.
- 2026-05-04 node UX correction pass: blank-canvas double-click now opens the node menu even when Konva reports a layer/stage target; image/node cards stop intercepting Draw/shape tools so users can draw or place shapes over images and nodes. Single node selection no longer shows Convert Image / To Canvas / Capture toolbar actions.
- 2026-05-04 node card control pass: Image Node upload keeps the visible title as `Image`; Image Gen/Image Gen 4 model/aspect/resolution controls are first-pass dropdown menus instead of click-cycle chips, with more spacing before the output preview. Single Image Gen preview now fills the card body width. Analysis/Image Gen/Image Gen 4 show a black Run button and toggle to red Stop while running.
- 2026-05-04 node text/port regression fix: Prompt and Analysis text preset boxes now open a focused HTML textarea editor on double-click and write back to `props.data`; node/image bodies stay pass-through for drawing tools while node ports remain interactive, so output fan-out can still be started without switching away from a drawing tool.
- 2026-05-04 blank-canvas double-click regression fix: node create menu opening now has a DOM-level canvas double-click fallback that checks blank world-space hit targets before opening, so double-clicking empty canvas reliably shows the menu above the pointer without hijacking double-click object editing.
- 2026-05-04 runtime edge fan-out / node transform fix: runtime edge curves now render below node cards so an existing edge cannot steal the source output port hit target; `node_card` is treated as a non-rotatable, non-flippable card in selection overlay, transform sessions, geometry/render transforms, Properties actions and context-menu commands.
- 2026-05-04 Image Gen dropdown layering fix: Image Gen/Image Gen 4 model/aspect/resolution dropdowns now render above the preview/output container and warning strip instead of being covered by the card body content.
- 2026-05-04 port snap affordance fix: node port hit radius was increased and connection preview now snaps visibly to compatible input ports, with a stronger solid preview line and target halo when the endpoint is in range.
- 2026-05-04 Phase 4 cleanup first pass: shape/node transform capabilities were centralized in `shapeCapabilities`/`konvaShapeCapabilities`, and runnable node capability now lives in the node registry instead of duplicated card/menu hardcoding. Subagent review says the remaining risky cleanup is a real runtimeGraph rewrite, not more edge-helper patches.
- 2026-05-04 continuous line tool selection rule: Arrow, Line and Draw tools no longer select or drag existing canvas objects while active; clicking on top of an object starts the next line/stroke. Properties edits require switching back to Select/V.
- 2026-05-04 Prompt/Analysis long-text containment correction: node text preview is back inside the node's own Konva render group with clip + local scroll offset + self-drawn scrollbar, so it obeys canvas z-order instead of floating as a global DOM layer. Later-drawn shapes/lines can cover the node normally; double-click editing still mounts the same-bounds HTML textarea.
- 2026-05-04 Phase 4 runtimeGraph cleanup first pass: runtime edge add/remove/reconnect, input uniqueness, output fan-out, dynamic Image Gen image input count, invalid-edge pruning and Image Node upstream preview mirroring now live in renderer-neutral `features/node-runtime/runtimeGraph.ts`. `konvaRuntimeEdges.ts` is back to a thin Konva compatibility shell. `runtimeGraphResolution.ts` adds a pure input/output resolver for the next mock Run/AiRun adapter, including the legacy `image_gen_4:image_out` aggregate output fallback, but Konva Run still has not been wired to generated asset propagation.
- 2026-05-04 Phase 4 batch image-node connection: when multiple Image Nodes are selected, dragging from any selected `image_out` port now previews a bundled set of runtime edges. Dropping that bundle on an Image Gen/Image Gen 4 image input writes consecutive `image_in_N` edges in one history checkpoint and pre-expands the dynamic image input count, so users can feed several image refs into a generator without connecting them one by one.
- 2026-05-04 runtimeGraph audit fix: uploading a local image into an Image Node is now treated as setting an own asset, so the node's incoming `image_in` runtime edge is removed first and upstream mirroring cannot overwrite the freshly uploaded image. RuntimeGraph reconcile also avoids touching document metadata when no shapes/edges actually change.
- 2026-05-04 Phase 4 mock Run adapter first pass: Analysis/Image Gen/Image Gen 4 Run now resolves upstream prompt/image refs through `runtimeGraphResolution.ts`, calls the existing mock AiRun route, writes compact `runtimeSummary`, uploads generated mock PNG assets through the Asset API, stores only generated output asset refs/URLs in node data, previews generated outputs in the node card and reconciles downstream Image Nodes.
- 2026-05-04 Phase 4 mock Run polish: Image Gen/Image Gen 4 output containers now stretch with resized node height; generated node previews prefer 256 thumbnails and share a small image cache to reduce browser pressure. RuntimeGraph Image Node mirroring now resolves effective upstream image output recursively, so disconnecting `Image Gen 4 -> Image` also clears later `Image -> Image` mirrors in the same reconciliation.
- 2026-05-04 Phase 4 edge keyboard pass: selected runtime edge now supports Delete/Backspace and Cmd/Ctrl+X cut. Both route through runtimeGraph edge removal, clear edge selection, create history checkpoints and trigger Image Node/input-count reconciliation.
- 2026-05-04 Analysis Run misfire fix: node card controls now stop `dblclick` bubbling, so rapid Run/Stop clicks or model dropdown clicks no longer trigger the node double-click text editor.
- 2026-05-04 Phase 4A capture sharpness/node resize polish: Selection Capture now exports at a higher offscreen pixel ratio and larger max edge, and `merge_capture` Image Nodes use the original capture asset above 50% zoom instead of the 1024 thumbnail, so mid-zoom captures such as 57% do not look soft. Node card internals now scale as one clipped content layer when the node is resized below its registry default size, preventing text, controls and previews from spilling outside the node frame.
- 2026-05-04 Phase 4A polish checkpoint: user accepted the 57% capture sharpness and small-node content containment pass. Checkpoint file scope is limited to S1X docs plus Konva canvas selection/image-node/export/action files.
- 2026-05-04 Phase 5A Konva persistence first pass: `/spikes/konva-canvas` now runs in board mode with `KonvaBoardSaveAudit`, serializes a v2 `{ renderer: 'konva', version: 2, canvasDocument }` envelope, saves/loads through the existing Board API, creates board thumbnails from an offscreen Konva capture, and reuses Board autosave, Cmd/Ctrl+S, Snapshot/History and before-unload guards. Backend/frontend metrics now count `canvasDocument.shapes` for Konva v2 docs.
- 2026-05-05 Board History clean + resize correction: shared Board History now has a confirmed Clean action that deletes all snapshots for the current board through both local Next and FastAPI Board APIs. Shift proportional resize now flushes resize previews immediately and keeps post-snap bounds on one aspect-ratio scale so width/height do not appear to step independently.
- 2026-05-05 Phase 5A schema guard first pass: frontend and FastAPI Board guards now recognize Konva v2 `{ renderer: 'konva', version: 2 }` envelopes and validate required canvas document shape, camera, metadata, asset refs, shape ids/types/props and runtime edge references before save/snapshot. Invalid v2 docs now fail `validate-document` and Board save with `konva-v2-invalid` issues instead of passing the generic JSON guard.
- 2026-05-05 `/boards/[boardId]` dual-engine first pass: the formal Board route now preloads Board metadata/document once, detects saved document engine (`version:1` tldraw vs `renderer:'konva', version:2` Konva), and mounts the matching canvas. Existing v1 Boards stay on tldraw, existing Konva v2 Boards open in Konva, unknown saved documents show an unsupported state rather than being overwritten, and new/missing Boards default to Konva unless `NEXT_PUBLIC_BOARD_CANVAS_ENGINE=tldraw` or `?engine=tldraw` is used before a document exists.
- 2026-05-05 dual-engine migration hand-test checkpoint: user confirmed old tldraw reference Board path `/spikes/canvas` still works after the formal Board route migration, so the tldraw fallback/reference code remains reachable while Konva v2 Boards use the new route detector.
- 2026-05-05 tldraw production gate + local cleanup: local workspace Board storage was cleaned of old tldraw v1 Board records, leaving only Konva v2 Boards. `/spikes/canvas` remains a development reference route, but production defaults block tldraw route usage unless `NEXT_PUBLIC_ENABLE_TLDRAW_REFERENCE=1` is explicitly set.
- 2026-05-05 Board header/save controls polish: Konva header no longer shows spike/Yjs diagnostic subtitle under the title. Formal Board save controls no longer show a manual Load button, and Refresh Preview moved into the History panel footer beside Refresh/Clean.
- 2026-05-05 Konva Canvas Settings restored: top toolbar now has a gear icon that opens the shared Canvas Settings panel. Konva applies background color/pattern/grid spacing to the stage background, keeps snap settings wired, and uses Zoom Sensitivity for wheel zoom.
- 2026-05-05 page/multi-board document contract + v1 copy tooling first pass: Konva v2 envelope now writes `activePageId` and `pages[]` while preserving `canvasDocument` as active-page mirror; frontend/FastAPI guards and metrics understand page documents. Legacy tldraw v1 Boards can be copied into new Konva v2 Boards from Workspace menu or the legacy route state without overwriting the source.

Next development focus: hand-test `/boards/[boardId]` for new Konva Boards, existing Konva v2 Boards, existing tldraw v1 Boards and `Copy to Konva v2`; then choose page switching UI/page thumbnails, transparent-background/export polish, precise v1 style/binding migration or Phase 6 Yjs proof.

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
| ◐ | 1A.9 | node HTML | 大量 React 节点重渲染卡 | 非编辑态主体仍是轻量 Konva visual；Prompt/Analysis 长文本预览用节点内 Konva clip/scrollbar，不挂全局 DOM overlay；编辑态才挂 HTML textarea；节点缩小时内部标题/控件/预览作为 clipped content layer 同步缩放；完整 node controls 编辑/运行态挂载策略未做 | 100 node cards 可拖动，长文本和预览不撑破节点 |
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
| ✅ | 2A.2 | Selection actions | Convert image to node、Capture selected to Image Node 两个图标 | selection toolbar first pass：Canvas Image → Image Node、single image Crop 和 Capture selection → Image Node 可用；Image Node → Canvas 移到节点 header；Capture 时按钮进入 disabled running state | 选图片/多选时按钮状态正确 |
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
| ✅ | 3.13 | snapping | snap alignment/distance | drag/Alt-copy、resize、rotate 都接 shared snap settings；resize 只吸附拖动边/角；Shift 等比 resize 在 snap 后仍回到单一 scale，并用即时 preview 避免宽高视觉错帧；rotation 15-degree guide | `konvaSnapping.ts`, `konvaSelectionUtils.ts`, `useKonvaCanvasInteractions.ts` | 开关和距离生效，固定 resize anchor 不乱跳，Shift 缩放宽高同步 |
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

当前第一批实现原则：菜单结构、可用/不可用状态和共享命令已经跑通。Group/Lock 使用轻量 shape 字段承载；Move to page 和透明背景 toggle 仍保持 disabled。Phase 4A 已接入 selectedIds capture/export：PNG 走 Konva transparent capture，SVG 走有限 serializer contract。

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
| ◐ | 3A.21 | 复制为 > SVG | `⌘⇧C` reference | 右键 Copy as > SVG 已接；basic vector/text/line/stroke first pass，image/image-node 会引用 asset URL 渲染预览，不内嵌 data/blob/Base64；非 image node 仍简化 card | 复制后可粘到支持 SVG/text 的目标，复杂对象降级可预期 |
| ✅ | 3A.22 | 复制为 > PNG | submenu item | 右键 Copy as > PNG 已接；从当前 `selectedIds` bounds 生成透明 PNG ClipboardItem，不写 Board/node state | 透明背景 PNG 进入系统剪贴板，bounds 不裁切也不多留大空白 |
| ◐ | 3A.23 | 复制为 > 透明 | toggle | 菜单已有 disabled 占位；export background toggle 未做 | capture/export 透明可切换 |
| ◐ | 3A.24 | 导出为 > SVG | export file | 右键 Export as > SVG 已接；同 Copy SVG 的 first-pass serializer，image/image-node 使用 asset URL 预览，非 image node 简化显示 | 下载文件名合理，复杂对象降级可预期 |
| ✅ | 3A.25 | 导出为 > PNG | export file | 右键 Export as > PNG 已接；下载当前 `selectedIds` bounds 的透明 PNG，不把 data/blob/Base64 写入文档 | PNG 文件尺寸和 bounds 正确，不把 data/blob/Base64 写入文档 |
| ◐ | 3A.26 | 导出为 > 透明 | toggle | 菜单已有 disabled 占位；export options state 未做 | 状态在菜单中可见 |
| ✅ | 3A.27 | 选中全部 | `⌘A` | Select all visible/page objects 已接右键/快捷键 | 不选中 locked hidden internals |
| ✅ | 3A.28 | 菜单 disabled | 无 selection 时部分禁用 | 无 selection 禁用 Cut/Copy/Duplicate/Reorder/Copy as/Delete；Group/Align/Stretch/Distribute/Tidy 按 selection count 启用；Lock/Unlock 按当前锁定状态启用 | 空白右键只显示可用项 |
| ✅ | 3A.29 | 子菜单 hover | hover 展开，鼠标可进入子菜单 | 右键菜单限制为最多两层；submenu 无 6px gap，并加 hover bridge；仍支持 edge side flip | 鼠标滑入子菜单不易消失，不需要先点击上层 |
| ✅ | 3A.30 | 键盘快捷键显示 | 右侧显示 `⌘C` 等 | 根据平台显示 Mac `⌘` 或 Windows/Linux `Ctrl+` | Mac 显示 ⌘，Windows 显示 Ctrl |

### Phase 4：节点、端口、边和 AI Runtime

当前边界：Phase 4 先做 renderer-neutral foundation，不把 runtime edge 存成普通 visual arrow/line，也不让 visual arrow 自动等同 AI input edge。Board document / node props / edge data 继续禁止 `data:`、`blob:`、Base64 image payload 和 provider raw payload；Image Node 只引用 Asset id/URL 与必要尺寸/标题/source metadata。下面的 `◐` 表示 first pass / contract placeholder / 局部 image-node 能力，不代表完整 AI Runtime 已集成。

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | 4.1 | 节点类型 | prompt/image/image_gen/image_gen_4/analysis；未来扩展 text optimizer / text merge / perspective image gen 等 | Konva toolbar palette、double-click canvas menu、card size、accent color、category grouping、type guard、runnable capability 和 AI-facing registry entries 均从 registry 派生；blank-canvas double-click 通过 DOM canvas fallback 稳定打开节点菜单；新增节点主要新增 `NodeType` + `nodeDefinitions` + runtime resolver/AiRun adapter，不改 Stage/EdgeLayer | `KonvaCanvasToolbar.tsx`, `KonvaNodeCreateMenu.tsx`, `konvaNodeCardFactory.ts`, `registry.ts`, `useKonvaStageDomEvents.ts` | 五类节点都能创建；双击空白画布在鼠标上方出菜单；新增 registry node 后自动出现在创建入口 |
| ◐ | 4.2 | 节点 UI | HTMLContainer 内 React 控件 | Konva lightweight card first pass 已改为简洁卡片：title/status、prompt/text box、Image Gen/Image Gen 4 模型/比例/分辨率 dropdown、Image preview；dropdown 已移到 card body 最上层，避免被 output preview/warning 遮挡；Run/dropdown controls stop `dblclick` bubbling so they do not accidentally open text editing；Image Gen/Image Gen 4 output container 会随节点 resize 高度自适应拉伸；Prompt/Analysis 文本框非编辑态在节点自身 Konva group 内 clip 并显示本地 scrollbar，长文本不会溢出节点，也不会以全局 DOM 层盖住后画的图形；double-click 时打开同尺寸 HTML textarea 编辑层；port label 不再显示在节点内部，hover 才显示 text/image tooltip；`node_card` 的 rotate/flip 能力已集中到 capability 表；正式 React/HTML controls 只在编辑/运行态打开的策略未集成 | `NodeCardContent.tsx`, `KonvaNodeCardShape.tsx`, `KonvaNodeCardParts.tsx`, `KonvaNodeImagePreview.tsx`, `KonvaNodeTextEditor.tsx`, `KonvaSelectionOverlay.tsx`, `KonvaPropertiesSelectionActions.tsx`, `shapeCapabilities.ts`, `konvaShapeCapabilities.ts` | 节点视觉干净；Run/Stop 不误开 Analysis preset editor；Gen 节点拉高后输出容器跟随放大；长 Prompt/Analysis 不撑破容器且可在节点内滚动；后画的线/shape 能按 z-order 盖过节点；模型/比例/分辨率可 first-pass 下拉选择且不被预览层挡住；Prompt/Analysis 可输入；节点不能旋转/flip |
| ◐ | 4.3 | node data | props.data 保存 prompt/model/resolution 等 | 新建节点写入 registry default prompt/model/resolution/image refs；Prompt/Analysis textarea 编辑会写回 `props.data.prompt` / `props.data.analysisPrompt`；Image Node upload/upstream mirror 通过 renderer-neutral runtimeGraph reconciliation 写 asset refs；Board save/load 迁移和完整 node editor 表单尚未接 | `types/nodeRuntime.ts`, `konvaNodeCardFactory.ts`, `konvaImageNodeConversion.ts`, `useKonvaImageNodeUpload.tsx`, `runtimeGraph.ts`, `useKonvaNodeCreationMenu.ts` | 保存恢复不丢参数 |
| ◐ | 4.4 | runtime summary | status/cost/error/resultAssetIds | `runtimeSummary` 已在 node card 可视化展示；Analysis/Image Gen/Image Gen 4 右上角 Run 现在走 mock Run adapter，写 running/succeeded/failed、costHint、lastRunId、resultAssetIds 和短 textOutput；Stop 会回 idle 并阻止过期 completion 覆盖；真实 server AiRun lifecycle / polling / cancellation 尚未接 | `NodeCardShape.tsx`, `KonvaNodeCardShape.tsx`, `runtimeGraphRunAdapter.ts`, `useKonvaNodeCreationMenu.ts` | Run 变 Stop；缺输入会 failed；mock 成功后 summary/resultAssetIds 更新 |
| ✅ | 4.5 | ports | typed text/image input/output dot | registry-derived ports render larger hit targets; output port drag shows preview and commits to compatible input port with zoom-aware hit radius；port snap 半径已放大，靠近 compatible input 时 preview endpoint 会吸到端口中心并显示 solid line + target halo；多选 Image Node 后从任意选中 `image_out` 拖拽会显示多条 bundled preview；hover tooltip 用黑底白字显示 `text` / `image`；drawing tools 下 node/image body pass-through 但端口仍保持可拖动；runtime edge layer 放在 node card 下方，避免已有 edge 抢 source output port 命中 | `KonvaNodeCardShape.tsx`, `konvaNodePorts.ts`, `useKonvaNodeConnectionSession.ts`, `KonvaCanvasShape.tsx`, `KonvaCanvasStage.tsx`, `KonvaNodeEdgeLayer.tsx` | 拖线更容易吸附端口，吸附反馈明显；同一 output 连完一根后还能继续连其他 input；多选 Image Node 可一次拖出多条 image edge |
| ✅ | 4.6 | edge store | runtimeEdges 独立保存 | `CanvasDocument.runtimeEdges` is separate from visual arrow/line; renderer-neutral `runtimeGraph.ts` owns edge add/remove/reconnect, batch add, input uniqueness and output fan-out; EdgeLayer only projects curves below node cards while selected edge still shows near-input disconnect; undo/redo includes edges and deleting nodes cleans connected edges | `types.ts`, `runtimeGraph.ts`, `konvaRuntimeEdges.ts`, `KonvaNodeEdgeLayer.tsx`, `KonvaCanvasStage.tsx` | edge 不依赖视觉箭头存在；同一 input 重连会替换旧 edge；同一 output 可连多个下游 input；批量连线是一个 history checkpoint |
| ◐ | 4.7 | input resolution | 通过 edges 找上游文本/图片 | `runtimeGraph.ts` reconciles Image Gen/Image Gen 4 dynamic image input counts and Image Node upstream asset preview mirroring; batch image-node connection can pre-expand consecutive `image_in_N` ports before validation; local Image Node upload clears incoming image edge before writing own asset; Image Node mirrors resolve effective upstream image output recursively, so disconnects cascade through Image→Image chains; `runtimeGraphResolution.ts` now feeds the Konva mock Run adapter for Prompt→Gen, Image→Analysis and generated output refs. Real AiRun adapter / server-side payload contract remains follow-up | `runtimeGraph.ts`, `runtimeGraphResolution.ts`, `runtimeGraphRunAdapter.ts`, `nodeDataFlow.ts`, `useKonvaNodeCreationMenu.ts` | image→image preview 正常；多个 Image Node 批量连到 Image Gen/Image Gen 4 后自动增加对应 image input；connected Image Node 上传本地图不会被上游覆盖；Image Gen 4→Image→Image 断上游后下游同步清空；Prompt→Gen mock run、Image→Analysis mock run 能读取上游 |
| ✅ | 4.8 | image node | canvas image 可转 Image Node | Canvas Image → Image Node、Image Node header → Canvas Image 和 Capture selection → Image Node first pass 已可用；import/output 仍跟 Phase 4A/Runtime 后续 | `konvaImageNodeConversion.ts`, `imageNodeAssets.ts` | 选图片转换节点 |
| ✅ | 4.9 | selection toolbar | 转 Image Node、Capture、Align | Konva selection toolbar first pass 支持 Image→Node、single image Crop、Capture selection 和 Align；Image Node → Canvas 已移入 node header；Capture 走 selectedIds PNG upload contract | `KonvaSelectionToolbar.tsx`, `CanvasSelectionToolbar.tsx` | 多选时出现在选区上方 |
| ✅ | 4.10 | edge delete/cut | 选中 edge 可断开 | 删除节点时 connected runtime edges cleanup 已接；edge hit/select first pass 已接，选中 edge 会在靠近 input 端显示 `-` 断链按钮；选中 runtime edge 后 Delete/Backspace 和 Cmd/Ctrl+X 都会删除 edge 并触发 runtimeGraph reconciliation | `KonvaNodeEdgeLayer.tsx`, `konvaRuntimeEdges.ts`, `useKonvaCanvasShortcuts.ts` | 点击 edge 后可点 `-`、Delete/Backspace 或 Cut 断开，input count / Image mirror 同步 |
| ◐ | 4.11 | arrow port snap | arrow creation/handle drag 时吸附端口 | runtime port drag 已有 zoom-aware hit radius；visual arrow/line 仍刻意独立，普通 arrow port snap 尚未做 | `konvaNodePorts.ts`, `arrowSnapLogic.ts` | 缩放下吸附距离自然 |

### Phase 4A：Canvas / Node / Image 转换链路

这是 TANGENT 的核心链路，必须当成一等功能复刻，而不是后补按钮。

| 状态 | 序号 | 转换链路 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | 4A.1 | Canvas Image → Image Node | 选中画布 image shape 后，selection toolbar/properties 有 Convert to Image Node | Konva selection toolbar 已读取 `CanvasImageShape` 并创建 `node_card` image node；node data 只存 asset refs/URLs/尺寸/title/source/crop ratio，不存 Base64；单图/多图/图片+标注混选时都会显示 Convert，但命令只转换其中的 image shapes，非图片元素保持原样并可继续走 Capture；裁切后的图片转节点时保留 crop，节点预览和后续 To Canvas 都显示裁切结果 | `konvaImageNodeConversion.ts`, `KonvaSelectionToolbar.tsx`, `KonvaNodeCardShape.tsx`, `runtimeGraphAssets.ts` | 单图/多图/图片+绘图元素混选时点击转换，每张图片右侧生成 Image Node；裁切图转节点后预览仍是裁切图；非图片不被转换 |
| ✅ | 4A.2 | Image Node → Canvas Image | Image Node header 的 `To Canvas` 把节点资产放回画布 | Image Node 右上角 `To Canvas` 已接，按 asset id 从 Asset API 拉取 URL 后创建 image；浮动 toolbar 不再显示 Image Node → Canvas | `konvaImageNodeConversion.ts`, `useKonvaImageNodeActions.ts`, `KonvaNodeCardShape.tsx` | 有图片的 Image Node 点击 To Canvas，画布出现图片并选中 |
| ✅ | 4A.3 | Selection → Image Node | 选择多个对象后 Capture to Image Node | Selection toolbar Capture 已启用：按显式 `selectedIds` bounds 渲染透明 PNG，上传 Asset API `origin=merge_capture`，再在选区下方创建 Image Node；不经 data URL 写入 Board/node state；PNG capture 已改为 offscreen stage clone，不再让可见画布进入 capture mode；offscreen clone 会用 original asset URL 重新灌入选中图片，避免低 zoom LOD 缩略图进入用户资产；capture 默认像素比提升到 3、最大边 8192，且 `merge_capture` Image Node 在 >50% zoom 预览 original asset 而不是 1024 thumbnail | 多选图形/图片/节点后生成 Merged selection Image Node，Board JSON 无 raw image payload；Capture 过程无可见闪烁；57% zoom 下 Capture → Image Node 预览不明显发糊 |
| ☐ | 4A.4 | Canvas → Image / Merge Capture Preview | Merge Capture 预览当前 selection 导出结果 | bounded PNG preview 尚未做 | `CanvasMergeCapturePanel.tsx` | 预览图尺寸正确，caption 显示宽高 |
| ✅ | 4A.5 | Canvas Markup → New Image Node | 用户在图片上画标注，多选图片+标注后 capture | 复用 Selection → Image Node：图片+draw/shape/text 作为 selectedIds 一起透明 PNG capture，上传 `merge_capture` 并生成 Image Node | 标注后的图片可变成新 Image Node |
| ◐ | 4A.6 | Generated Asset → Image Node | AI run result 写入 `resultAssetIds`，节点展示输出 | Konva mock Run 会上传生成 PNG asset，写 `runtimeSummary.resultAssetIds` 和轻量 `generatedOutputs` asset refs；Image Gen/Image Gen 4 节点内可预览，连到 Image Node 后 runtimeGraph 会镜像显示；真实 provider output asset 写入仍未接 | `runtimeGraphRunAdapter.ts`, `runtimeGraphAssets.ts`, `runtimeGraph.ts`, `KonvaNodeCardShape.tsx` | mock Run 后输出 asset 能被下游 Image Node 识别并显示 |
| ◐ | 4A.7 | Image Node output → downstream node | Image Node 通过 `image_out` port 给 Analysis/Image Gen | runtime edge 可连接到下游 image input；Image Node → Image Node preview mirror first pass 已做；Image Node → Analysis/Image Gen mock Run input adapter 已接；真实 AiRun payload 合同仍未接 | `runtimeGraphResolution.ts`, `runtimeGraphRunAdapter.ts`, `konvaRuntimeEdges.ts` | Image Node 连 Analysis/Gen 后 Run 可用；真实 provider 后续 |
| ✅ | 4A.8 | Prompt Node → Image Gen → Image Node | prompt text 经 edge 进入 image_gen | Konva runtimeGraph mock path 已接：Prompt `text_out` 通过 runtime edge 进入 Image Gen/Image Gen 4 `text_in`；Run adapter 解析 upstream prompt，生成 mock asset refs/resultAssetIds；generator output 再接 Image Node 时会镜像显示。真实 provider AiRun 仍跟 4A.6/4A.7 后续 | `runtimeGraphResolution.ts`, `runtimeGraphRunAdapter.ts`, `runtimeGraph.ts`, `registry.ts` | Prompt 连 Generate，Run 后 resultAssetIds 可显示，下游 Image Node 可显示生成图 |
| ✅ | 4A.9 | Image import → Image Node | 上传文件进 Image Node | Image Node double-click 打开本地 image file picker；拖拽 image file 到 Image Node 也会上传并写 asset refs，不存 Base64 | `useKonvaImageNodeUpload.tsx`, `konvaImageClipboard.ts` | 上传后节点 contain-fit 显示图片，Board document 不含 data URL |
| ✅ | 4A.10 | Paste/Drop image → Canvas/Image Node | 当前 tldraw/asset layer 可接图片资产 | paste image → Canvas image 已支持并走 Asset API；drop image → Image Node 已支持；如果选中 Image Node 或 paste point 落在 Image Node 上，clipboard image 会写入该 Image Node own asset data，并通过 runtimeGraph 清掉旧 incoming image edge | `konvaImageClipboard.ts`, `konvaClipboardCommands.ts`, `useKonvaImageNodeUpload.tsx`, asset upload client | 粘贴/拖入图片后走 R2 asset，不进 Board document Base64；选中 Image Node 后粘贴图片直接进入节点 |
| ✅ | 4A.11 | Shape/Node selection export bounds | tldraw 用 shape geometry + page transform 算 bounds | `getKonvaSelectionExportBounds(document, selectedIds)` 已落地；Capture/Copy as/Export as 共享 explicit selectedIds bounds，不从 viewport 推断；rotated box bounds first pass 已有，精确 clipped frame export 后续继续细化 | capture/export 不裁切、不多留大空白 |
| ◐ | 4A.12 | Export background policy | 当前 selection capture `background:false`，Board thumbnail 可有背景 | Selection PNG capture/export 默认透明背景；透明背景 toggle 和 Board thumbnail 背景策略仍未做 | selection PNG 透明，thumbnail 可读 |
| ◐ | 4A.13 | Asset/upload guard | upload/editor_export/generated/merge_capture | Capture → Image Node 已上传 `origin=merge_capture`；Export as PNG/SVG 当前直接下载不持久化；普通 local upload 仍 `origin=upload`，mock/generated output 仍走 generated origin；新增 `board_thumbnail` / `remote_import` / `background_removal` / `object_cutout` origins；Board/node props/history 禁止 data/blob/Base64/provider raw payload | DB 里 origin 正确；保存后的 Board JSON 只有 asset refs/metadata |
| ✅ | 4A.14 | Conversion undo/redo | tldraw 创建节点/图片可由 editor history 处理 | Image→Node / Node→Canvas first pass 都在转换前创建 history checkpoint；远端 asset 不被 undo 删除 | engine history | undo 删除新节点/图片但不破坏远端 asset |
| ✅ | 4A.15 | Conversion status/error | 当前有 `Capture failed` / `Image node conversion failed` | Capture 按钮已有 running disabled state；Capture selection、Copy/Export PNG/SVG、Remove BG 失败时会在 floating selection toolbar 里显示红色 inline error；选择变化或下一次 action 开始时清空 | selection toolbar/actions | 断网/上传失败有可见提示 |
| ✅ | 4A.16 | Web image copy → Canvas | 浏览器里复制网络图片后 `Ctrl/Cmd+V` 到画布 | 已读取 clipboard image file/blob 和 HTML img URL；blob/data 走 Asset API；远程 URL 现在先通过 `/assets/from-url` server-side fetch/upload 变成真实 `remote_import` asset，再放到画布，避免 `remote-*` CORS taint fallback | `konvaImageClipboard.ts`, `assetUploadClient.ts`, `assets.py`, `remoteImageImport.ts` | 从网页复制图片，鼠标停在画布某处粘贴，图片出现在鼠标位置；后续 capture/export 不因跨域图片 taint |
| ◐ | 4A.17 | Copy image from canvas | 选中 Canvas image 后 `Ctrl/Cmd+C` | internal JSON copy 已支持，粘贴保留 asset ref；PNG/SVG fallback 未做 | `konvaShapeCommands.ts`, `konvaClipboardCommands.ts` | 复制后粘贴不重新上传同一张图，assetId 保持或可追踪 |
| ✅ | 4A.18 | Paste at mouse position | 粘贴不是固定 offset，而是鼠标/视口焦点位置 | 已记录最后 canvas pointer world point；右键 Paste 使用右键位置 | `KonvaCanvasSpike.tsx` | 鼠标在哪，粘贴图就出现在附近 |
| ✅ | 4A.19 | Alt/Option drag copy image | 按住 Alt 拖拽图片复制 | image shape 复用 shape drag/duplicate session，副本引用同一 asset URLs | `useKonvaShapeDragHandlers.ts`, `konvaShapeCommands.ts` | Alt 拖拽生成副本，原图不动，不重复上传 |
| ✅ | 4A.20 | Image resize keep quality | 图片缩放不坏图、不拉糊、不丢比例 | image 显示尺寸和 source 分离；resize/rotate 复用 box 控件；LOD render 已有；Shift 等比 resize 已同步修正 | `KonvaImageShape.tsx`, `konvaRotatedResize.ts` | 放大缩小时图片不异常变形，保存恢复尺寸 |
| ✅ | 4A.21 | Image boundary placement | 转换成 Image Node 出现在图片右侧 | Canvas Image → Image Node 放在原图片右侧固定 gap；多图全选转换时每张图片右侧各生成一个 Image Node | `konvaImageNodeConversion.ts` | 多张图逐个转换，节点都在对应图片右侧 |
| ✅ | 4A.22 | Screenshot/Capture placement | screenshot 成 Image Node 出现在 selection/image boundary 下方 | Capture → Image Node 使用 selection bounds，节点放在 `bounds.maxY + 48` 下方 | 多选图片/标注 capture 后节点在整个边界下方 |
| ✅ | 4A.23 | To Canvas placement | Image Node 的 `To Canvas` 出现在节点右侧 | Image Node → Canvas Image first pass 放在节点右侧并选中新图片 | `konvaImageNodeConversion.ts` | To Canvas 后图片在节点右侧且被选中 |
| ✅ | 4A.24 | Screenshot vs thumbnail | screenshot/canvas-to-image 是用户资产，thumbnail 是 Board 预览 | `boardThumbnailCapture` 现在使用 `origin=board_thumbnail`；user capture/screenshot 仍走 `merge_capture`/`screenshot`/`editor_export` 语义，不再和 Board 预览混用 | asset origin + board thumbnail | 两者不混淆，History/Board card 显示正确 |
| ✅ | 4A.25 | Network image CORS fallback | 网络图片可能跨域导致 canvas tainted | clipboard HTML/plain remote image URL 现在通过 Next/FastAPI `/assets/from-url` server-side import；FastAPI 做 HTTP(S) URL、私网/localhost host、MIME、30MB size guard 后写真实 asset；Konva 不再创建 synthetic `remote-*` image shape | `konvaImageClipboard.ts`, `assetUploadClient.ts`, `remote_image_import.py`, `remoteImageImport.ts` | 复制外网图片后仍能保存和 capture，不因 CORS 破坏导出 |
| ◐ | 4A.26 | Image operation menu | 选中图片后，上方图片操作里出现算法操作 | single image selection toolbar 已有 Crop、Remove BG、Object Cutout 操作位。Crop 是可用四边裁切；Remove BG 调 FastAPI image-op contract；Object Cutout 目前 disabled，占位等待 SAM point/box UX | `KonvaSelectionToolbar.tsx`, `useKonvaImageOpsActions.ts`, `konvaImageCropCommands.ts`, `KonvaSelectionOverlay.tsx` | 选图片时看到 Crop / Remove BG / Object Cutout；普通 shape 时隐藏；Object Cutout disabled |
| ◐ | 4A.27 | Remove Background / rembg | 一键抠背景，生成透明 PNG | FastAPI `/api/v1/image-ops/remove-background` 已接 server-side optional `rembg`；输入 asset id，读取源 asset，输出 transparent PNG asset `origin=background_removal`；前端创建新 image shape。运行环境需安装 `services/api[image-ops]` 才真正执行算法，未安装返回 501 | `image_ops.py`, `routers/image_ops.py`, `useKonvaImageOpsActions.ts`, asset API | 安装 image-ops 后点击 Remove BG 生成新透明图片，不覆盖原图，不写 Base64 |
| ◐ | 4A.28 | Object Cutout / SAM | 点对象或框选对象后抠出目标 | `/api/v1/image-ops/object-cutout` 已保留 501 contract，toolbar 有 disabled Object Cutout 占位；SAM 点选/框选交互、模型加载和 mask 输出仍未实现 | `routers/image_ops.py`, future image-point interaction | 当前不可点击；后续点人/物体后抠出对象 |
| ◐ | 4A.29 | Cutout placement and history | 抠图结果像 copy/paste 一样出现在附近 | Remove BG 成功后前端在创建前写 history checkpoint，新 image shape 放到源图 `x + 24, y + 24`，继承源图显示尺寸/crop/rotation 并选中；Object Cutout 还未接 | `useKonvaImageOpsActions.ts`, engine history | Remove BG 结果位置稳定，undo 删除新 shape 但不删除 asset |
| ◐ | 4A.30 | Cutout storage guard | 算法结果不能污染 Board document | image-op route 只返回 Asset API record；canvas 只写 asset refs/URLs/尺寸/crop/rotation，Board guard 继续拒绝 data/blob/Base64/provider raw payload；新增后端 contract test 覆盖 `origin=background_removal` | Board guard, Asset API, FastAPI temp storage | 保存后的 Board JSON 无 data URL/base64；真实 SAM mask 临时文件策略仍待实现 |
| ✅ | 4A.31 | Cutout license guard | 避免再次踩 SDK/model 授权坑 | License checkpoint 已记录：`danielgatis/rembg` repo MIT；`facebookresearch/segment-anything` code/model Apache-2.0；SA-1B dataset 是单独 research license，当前不作为产品依赖。`rembg` 放入 optional `services/api[image-ops]`，SAM 仅做规划不引入依赖 | dependency review, `pyproject.toml`, ARCH/PRD docs | CI/release notes 能看到算法依赖和 license |

### Phase 5：保存、历史、缩略图和 Board Shell

| 状态 | 序号 | 功能/交互 | 当前 tldraw 参考 | Konva/Yjs 复刻要求 | 参考文件 | 验收方式 |
| --- | --- | --- | --- | --- | --- | --- |
| ✅ | 5.1 | document guard | 禁止 data/blob/base64/长日志 | Konva v2 保存 envelope 已走现有 Board guard；generic guard 继续阻止 `data:`/`blob:`/large Base64；frontend/FastAPI schema guard 验证 v2 envelope、pages contract、camera、metadata、asset refs、shape ids/types/props 和 runtime edge shape refs；backend/frontend metrics 已识别 `canvasDocument.shapes` 和 `pages[].canvasDocument.shapes` | `konvaBoardDocument.ts`, `konvaBoardPageContract.ts`, `boardDocumentGuard.ts`, `boardKonvaDocumentGuard.ts`, `board_konva_guard.py`, `board_metadata.py`, `boardTypes.ts` | data/blob/base64 被拦；非法 Konva v2 doc 被 `konva-v2-invalid` 拦；shape/asset count 正确 |
| ◐ | 5.2 | save now | 保存 Board document + thumbnail | `/spikes/konva-canvas` 已接 `KonvaBoardSaveAudit`；Save Now 序列化 `CanvasDocument` + settings + asset refs，走现有 Board API，并可手动 Load 恢复 | `KonvaBoardSaveAudit.tsx`, `konvaBoardDocument.ts`, `localBoardClient.ts` | Save now 后点击 Load/刷新再加载可恢复 shapes/nodes/runtimeEdges/camera |
| ◐ | 5.3 | autosave | dirty 后延迟保存 | Konva document/camera signature 变化会进入 dirty 并复用 `useBoardAutosaveTimer`；settings dirty tracking 已复用 | `KonvaBoardSaveAudit.tsx`, `useBoardSaveLifecycle.ts` | 修改后状态变 dirty，并自动创建 autosave/history |
| ◐ | 5.4 | Cmd/Ctrl+S | keyboard save reason | Konva board mode 复用 `useBoardKeyboardSaveShortcut`，写 `keyboard` reason；文本编辑目标仍会跳过全局保存快捷键 | `KonvaBoardSaveAudit.tsx`, `useBoardKeyboardSaveShortcut` | Cmd/Ctrl+S 保存；编辑 textarea 中不误触 |
| ◐ | 5.5 | snapshot | 手动 Snapshot | 新增 `useKonvaBoardSnapshots`，用 v2 Konva document 创建 Board History snapshot，并上传 Konva thumbnail | `useKonvaBoardSnapshots.ts`, `KonvaBoardSaveAudit.tsx` | Snapshot 后 History 出现条目 |
| ◐ | 5.6 | History restore | restore 后 dirty 并继续 autosave | History restore 读取 snapshot 的 Konva v2 envelope，恢复 document/settings，清空 selection/edit/menu transient state，标记 dirty 并继续 autosave | `useKonvaBoardSnapshots.ts`, `konvaBoardDocument.ts`, `KonvaCanvasSpike.tsx` | Restore 后画布替换，随后可保存 |
| ◐ | 5.7 | History filter | autosave/user save 分组 | Konva 复用 `CanvasBoardHistoryPanel` 的 all/autosave/user filters；历史 transport 与 tldraw 共用 | `CanvasBoardHistoryPanel.tsx`, `CanvasBoardModeControls.tsx` | autosave/user filters 能分组 |
| ◐ | 5.8 | thumbnail | `editor.toImageDataUrl` | 新增 `captureKonvaBoardThumbnailUrl`：选择全部 Konva shapes，用 offscreen clone capture，上传 `origin=board_thumbnail` | `konvaBoardThumbnailCapture.ts`, `konvaSelectionExport.ts` | Refresh preview/Save 生成真实缩略图 asset |
| ◐ | 5.9 | merge capture | 选区导出为 Image Node | Konva local spike 已支持 selectedIds PNG capture/upload → Image Node，且保存时 merge_capture Image Node asset refs 进入 v2 document；正式 `/boards/[boardId]` route 接入仍未做 | `CanvasSelectionToolbar.tsx`, `konvaBoardDocument.ts` | 多选 capture 生成新 Image Node，保存/加载后保留 |
| ✅ | 5.10 | Board switcher | 最近 5 个 Board 下拉 | `/boards/[boardId]` 已接双引擎 detector，Recent Board 跳转会按保存文档 version 自动挂载 tldraw 或 Konva；Konva header 复用 Board switcher/rename；未知保存文档会停在 unsupported 状态，避免默认 Konva 空白覆盖。旧 v1 Board 可通过 route migration state 或 Workspace menu 复制成新 Konva v2 Board，不覆盖原 Board | `boards/[boardId]/page.tsx`, `boardCanvasEngine.ts`, `tldrawToKonvaMigration.ts`, `WorkspaceBoardGallery.tsx`, `CanvasBoardSwitcher.tsx`, `KonvaCanvasHeader.tsx` | 新 Konva Board 可保存/加载；旧 v1 Board 不被 Konva 覆盖；未知 doc 不自动保存覆盖；Recent Board 切换按文档引擎打开；旧 v1 可 Copy to Konva v2 |
| ◐ | 5.11 | unsaved guard | 离开前 warning | Konva board mode 复用 `useBoardBeforeUnloadWarning`，dirty/saving/blocked/error(save) 状态会拦截 unload/back；正式 Board route 集成仍未做 | `KonvaBoardSaveAudit.tsx`, `useBoardBeforeUnloadWarning` | 未保存返回有确认 |
| ✅ | 5.12 | History clean | 清空当前 Board history | Shared History panel 增加 Clean；Next local route 和 FastAPI `DELETE /boards/{board_id}/snapshots` 删除当前 workspace/board 的所有 snapshots，并重置 snapshot signature 让下一次 autosave 可重新写入 | `CanvasBoardHistoryPanel.tsx`, `localBoardClient.ts`, `boards.py`, snapshot stores | Clean 后 History 变空，刷新后仍为空；下一次 Snapshot/Autosave 可重新出现 |
| ✅ | 5.13 | tldraw reference gate | tldraw 只作为参考入口 | `/spikes/canvas` 在 development 可用作 tldraw 行为参考；production 默认禁用 tldraw route 和 `/boards/[boardId]` 的 tldraw engine fallback，仅 Konva v2 可作为正式 Board engine。需要临时打开时必须显式设置 `NEXT_PUBLIC_ENABLE_TLDRAW_REFERENCE=1` | `boardCanvasEngine.ts`, `spikes/canvas/page.tsx`, `boards/[boardId]/page.tsx` | production 不会打开 tldraw Board；workspace 本地旧 v1 数据已清理 |
| ✅ | 5.14 | Save controls polish | Save/History/Preview controls | Header 删除 spike/Yjs diagnostic subtitle；主保存控制区移除手动 Load，Refresh preview 进入 History panel footer，主条只保留 Save/Snapshot/History 等常用入口 | `KonvaCanvasHeader.tsx`, `CanvasBoardSaveControls.tsx`, `CanvasBoardHistoryPanel.tsx` | 标题下方无描述；History 内可刷新 preview；主条无 Load |
| ✅ | 5.15 | Canvas Settings | 画布设置入口和背景/snap/zoom 设置 | Konva 顶部 toolbar 增加 gear 设置按钮，复用 shared `CanvasSettingsPanel`；background color / dots / grid / solid / grid spacing 渲染到 Konva Stage 背景；snap alignment/distance 继续驱动拖拽/resize；Zoom Sensitivity 驱动 wheel zoom | `KonvaCanvasToolbar.tsx`, `KonvaCanvasSpike.tsx`, `KonvaCanvasBackground.tsx`, `useKonvaWheelHandler.ts` | 点击齿轮打开设置；背景/网格/缩放灵敏度立即生效并随 Board settings 保存 |
| ◐ | 5.16 | Page / multi-board contract | tldraw 有 pageId；未来需要多页和页面缩略图 | Konva v2 envelope 现在是兼容式 page contract：保留 `canvasDocument` 作为 active page mirror，同时新增 `activePageId` 和 `pages[]`；restore 使用 active page，guard/metrics 同时验证/统计 pages；UI 切页、页面缩略图、跨页移动仍未做 | `konvaBoardPageContract.ts`, `konvaBoardDocument.ts`, `boardKonvaDocumentGuard.ts`, `board_konva_guard.py`, `boardTypes.ts`, `board_metadata.py` | 保存的新 Konva Board JSON 含 `pages[]`；旧无 pages 的 v2 doc 仍可 restore；后端 tests 覆盖 pages metrics/guard |

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
| ◐ | 7.2 | v1 文档迁移 | 当前保存 tldraw shapes | Copy tooling first pass 已做：tldraw v1 serialized Board 可转换为新的 Konva v2 Board，支持 geo/note/frame/text/image/arrow/line/draw/node_card/ai_card placeholder、runtime edge 过滤和 compact asset refs；不覆盖原 v1 Board。更精细的 tldraw 样式/绑定/多页语义仍待后续 | `tldrawToKonvaMigration.ts`, `tldrawToKonvaShapeMigration.ts`, `boards/[boardId]/page.tsx`, `WorkspaceBoardGallery.tsx` | Workspace 旧 v1 Board 菜单 Copy to Konva v2；legacy route 可复制后跳到新 Konva Board；原 v1 Board 保留 |
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
