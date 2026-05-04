# ARCH Slice S1X: Canvas Engine Migration

**Status**: Active risk-mitigation spike; Phase 4 Node/Port/Edge foundation first pass is in progress after accepted Phase 1A/2A/3 baselines.
**Branch**: `feature/s1x-konva-handfeel-spike`
**Reason**: Public staging exposed the tldraw production license requirement. TANGENT should not make the paid SDK the long-term core canvas dependency unless the business explicitly accepts that cost.

## Decision

Treat the current tldraw implementation as the reference implementation, not as discarded work.

The migration target is:

```text
Konva / react-konva          Canvas rendering and pointer interaction
Yjs                          Collaborative board document
y-websocket or Hocuspocus    Self-hosted collaboration room transport
FastAPI + Postgres           Board metadata, snapshots, permissions, audit facts
R2/S3-compatible storage     Images, thumbnails and future capture artifacts
```

tldraw remains available locally as the baseline for parity testing until the replacement reaches acceptance.

## Current Implementation Checkpoint

The first isolated renderer route is:

```text
/spikes/konva-canvas
```

It includes Konva/react-konva, Yjs document initialization, freehand smoothing via `perfect-freehand`, basic pan/zoom, faint dot background, rectangle/diamond/ellipse/triangle/cloud/frame/sticky, line/arrow/text/eraser, minimap zoom controls, an in-browser diagnostics panel and a fixed Properties panel.

Current Phase 1A implementation:

```text
pointer pan/zoom -> mutate Konva Stage transform directly
React camera state -> throttled preview for navigator/labels
document camera -> committed snapshot after pan/wheel settles
stable shapes -> main layer
draft drawing + eraser trail -> separate transient layers
```

Current accepted Properties baseline:

```text
next style state
  -> new draw/shape/line/text defaults
selected style patch
  -> selected shape style update
document.shapes order
  -> layer front/back actions
arrange helpers
  -> Properties and context menu share align/stretch/distribute/flip/row/column behavior
text style patch
  -> fontSize/textAlign on text, sticky and basic shape labels
generated pattern tile
  -> high-DPR opaque hatch fill follows stroke color

solid/pattern fill
  -> opaque lighter tint of stroke color, not alpha fade
```

Current Phase 3.1 boundary:

```text
KonvaCanvasStage
  -> thin Stage/Layer composer

useKonvaCanvasInteractions
  -> pointer sessions for pan/create/erase/box-select/resize/rotate

useKonvaShapeDragHandlers
  -> drag preview, Alt/Option duplicate, frame-child drag expansion, snap guides

useKonvaEraserSession + konvaEraserHitTest
  -> eraser trail state and geometric line/stroke hit testing

konvaSnapping
  -> edge/center snap calculation from shared canvas snap settings

KonvaSelectionOverlay
  -> marquee + single-shape resize handles + multi-select rotate handle + snap guide rendering

konvaRotationUtils
  -> single/group rotation from origin-shape snapshots
  -> box shapes update x/y/rotation; line/arrow/stroke update rotated points

useKonvaCanvasHistory
  -> undo/redo snapshots shapes + selectedIds only
  -> camera pan/zoom excluded from command history
```

Current Phase 3 command/data notes:

- `document.shapes` array order remains the z-order source of truth. `reorderKonvaShapes` supports `back`, `backward`, `forward` and `front`; Properties, right-click menu and bracket shortcuts call the same action enum.
- Grouping is represented with a lightweight `groupId` on member shapes rather than a wrapper shape. Selection, drag, Alt/Option duplicate and clipboard clone expand grouped ids; clone commands remap copied group ids so pasted groups stay together without sharing the source group id.
- Locking is represented with optional `isLocked`; locked shapes may remain selectable, but transform entry points block drag, resize, rotation and line endpoint/route edits. Selection overlay renders lock indicators from shape/group bounds, and context-menu hit targeting expands grouped ids before Lock/Unlock so group-level unlock is a single command.
- Flip commands use optional `flipX` / `flipY` for box-like shapes and mirror line/arrow/stroke points directly for path-like shapes.
- Clone commands build an old-id to new-id map and rewrite cloned `parentId` relationships. If a copied child’s parent is not part of the copied set, the pasted child is detached instead of pointing to an old frame.
- Deleting a frame releases unselected children by setting `parentId=null`; it does not rely on missing-parent fallback behavior.
- Frame dragging expands the moved set to include contained children so a frame behaves like a container in first-pass editing.
- Text editing uses an HTML textarea overlay and blocks canvas shortcuts while typing; Cmd/Ctrl+S is swallowed inside the editor.
- Basic closed shapes (`rect`, `diamond`, `ellipse`, `cloud`, `triangle`) can store an optional `props.text` label. Double-click opens the same text overlay centered over the shape; the rendered label is part of the shape renderer, so style and transform changes follow the container without a separate child transform sync.
- Snap alignment reads `CanvasSettingsStore.snapAlignment/snapDistance`; drag/Alt-copy apply edge/center snapping, resize uses a separate dragged-edge snap path, rotate snaps to 15-degree increments, and selection overlay draws cyan/radial guides.
- Drag now uses a clean preview session for normal move and Alt/Option copy. The Konva source node is reset during drag while the preview document drives both rendered shapes and selection overlay, preventing native drag from outrunning handles. Frame chrome is hidden while a frame is in the moving set so stale old-position borders do not render during preview.
- Context menu command depth is capped at two levels. Higher-level groupings such as Arrange use section labels inside one submenu panel instead of nested submenu panels, with a hover bridge to keep pointer travel stable. Context hit targeting preserves an active multi-selection boundary; object/group hit targeting only replaces selection when the current selection is empty or single-object.
- Multi-selection rotation is supported from an oriented boundary. `konvaOrientedBounds` computes candidate rotated boxes from selected member geometry; the session stores origin shapes and rotates around the group center, while rotated resize reuses the same local-bounds coordinate space for single and multi-selection transforms. Frame chrome renders in the frame's rotated coordinate space so it does not leave an unrotated outline.
- Browser text-selection cleanup is isolated in `useKonvaBrowserSelectionGuard`, and it skips active input/textarea/contenteditable elements.

Current Phase 4A image/node boundary:

- `CanvasNodeShape` is now part of the renderer-neutral `CanvasShape` union as `type: 'node_card'`, with `props.nodeType`, `props.nodeId`, `props.data`, `props.runtimeSummary`, `props.version`, `props.width` and `props.height`.
- Konva Image Node first pass renders a lightweight card with ports derived from `node-runtime/registry.ts`; runtime edge storage is still intentionally separate and not represented as visual `arrow` shapes.
- Canvas Image → Image Node creates a `node_card` image node beside the image. Node data stores `assetId`, dimensions, `source` and `title`; it does not store `data:`, `blob:`, Base64 or provider raw payloads.
- Image Node → Canvas Image fetches the asset record by `assetId` through the existing Asset API, then creates a `CanvasImageShape` beside the node with display URLs on the image shape only.
- Selection capture/export remains disabled until a dedicated export bounds/upload contract exists. Frame visible-bounds helpers are available, but rotated/precise clipped export semantics are still follow-up work.

Current Phase 4 Node/Port/Edge foundation boundary:

- `node_card` is the renderer-neutral canvas node carrier. Konva can render a lightweight card in the canvas layer, while heavier React/HTML controls should only mount for selected, editing or running nodes.
- Ports are UI affordances derived from node registry metadata. Their screen/world anchors and hit targets must be stable under pan/zoom, but a visible port dot by itself is not a runtime connection.
- `CanvasDocument.runtimeEdges` is the local first-pass runtime edge store. A runtime edge references source node/port and target node/port ids plus `dataType`; it is not serialized as a visual `arrow` or `line`.
- `KonvaNodeEdgeLayer` renders runtime edges from `runtimeEdges` and node port world coordinates. It is a visual projection of runtime data, not the source of truth.
- `useKonvaNodeConnectionSession` owns output-port drag, preview curve and compatible input-port commit. It uses registry-derived ports and zoom-aware hit radius from `konvaNodePorts.ts`.
- Visual arrows/lines stay normal canvas geometry unless an explicit binding/edge contract creates a runtime edge. This keeps annotation arrows separate from AI dataflow edges.
- Deleting a node now cleans connected runtime edges in the same local command/history transaction. Direct edge hit/select/delete remains a follow-up.
- `resolveNodeInputs` remains the AI run input source of truth. Konva should provide an engine query adapter for node data, asset refs and runtime edges rather than duplicating input resolution logic in the renderer.
- Board documents, node props and runtime edge payloads must not persist `data:`, `blob:`, Base64 images, provider raw responses, complete logs or long generated text. Store Asset ids/URLs, compact runtime summaries and references to AiRun records instead.

It does not replace `/boards/[boardId]` and does not remove any tldraw reference code.

## Current tldraw Reference Contract

The replacement engine must preserve these current product behaviors unless a deliberate product decision changes them.

### Shell and Layout

- Board route loads `/boards/[boardId]` into the product canvas.
- Header provides Workspace back, TANGENT home/logo, Board switcher and recent Board affordances.
- Top toolbar stays above the canvas with hand/select, shape, arrow, line, draw, text and eraser tools.
- Frame and Sticky are first-class canvas tools; Frame starts as a labeled outline container, Sticky starts as a resizable editable note.
- Frame containment is represented with `parentId=frame.id` and rendered through a Konva clip group, so child shapes are visible only inside the frame bounds.
- Sticky stores note text plus a provisional `authorName`; Auth-backed author identity remains for the real Board migration.
- Left properties drawer is fixed and decoupled from canvas pointer events; it keeps the last selected drawing tool properties until another tool is chosen.
- Canvas Settings panel opens from a gear icon and controls per-board background/grid/snap behavior.
- Board Save/History controls remain visible and support Save now, Snapshot, Refresh preview and History.
- Selection toolbar for generated node/capture/alignment actions is part of the current experience and must be reintroduced before tldraw removal.

### Drawing Handfeel

The first Konva spike is judged by handfeel, not feature count.

- Slow lines should not jitter.
- Fast lines should not break or visibly undersample.
- Curves should feel natural and not mechanical.
- Pan/zoom must stay under the pointer without drift.
- Drawing after zoom/pan must land exactly under the cursor.
- Continuous drawing should not cause tool panels to flicker or reset.
- 1,000 strokes and mixed nodes should remain interactive on staging hardware.
- Target acceptance: at least 80% of the current tldraw handfeel before migrating node/business logic.

Likely implementation building blocks:

```text
pointer event sampling
requestAnimationFrame batching
perfect-freehand or equivalent stroke outline smoothing
Catmull-Rom / Bezier curve fitting
Konva layer separation for background, strokes, nodes, overlays and UI handles
viewport transform stored outside React render loops
```

## Smooth Canvas Performance Architecture

The Konva replacement must be designed for smoothness from the first spike. The goal is not only "same features as tldraw", but the same feeling: pointer input should be immediate, React UI should not re-render on every pointer event, and collaboration updates should not interrupt local drawing.

### Performance Principles

```text
local pointer input first
React outside the hot path
Konva layers by update frequency
viewport transform in mutable engine state
document commits batched
Yjs updates throttled/transactional
image rendering uses LOD and cache
expensive export/history work happens outside drawing frames
```

### Layer Model

Use separate layers so fast-changing elements do not force expensive redraws of everything:

```text
Stage
  BackgroundLayer      grid/dots/solid; redraw only when camera/settings change
  ImageLayer           images/thumbnails; cached and LOD-aware
  StrokeLayer          freehand strokes and simple shapes
  NodeLayer            node card shells and non-editing node visuals
  EdgeLayer            node edges/arrows
  SelectionLayer       selection boxes, handles, snap guides
  PresenceLayer        remote cursors/selections; throttled
  HtmlOverlay          text inputs, node controls, toolbar/properties outside Konva hot path
```

### Input Pipeline

Do not send every pointer event through React state.

```text
pointerdown
  -> capture pointer
  -> initialize mutable tool session

pointermove
  -> append raw points to mutable buffer
  -> schedule one requestAnimationFrame

animation frame
  -> smooth/fit points
  -> update active Konva node directly
  -> draw only affected layer

pointerup
  -> finalize stroke/shape
  -> commit a single document transaction
  -> push undo entry
  -> enqueue save/dirty/Yjs update
```

This is the difference between "canvas feels native" and "canvas feels like React dragging a thousand components."

### Freehand Stroke Strategy

For tldraw-like drawing feel:

- keep raw pointer points for replay/editing
- render a simplified/smoothed preview while drawing
- use `perfect-freehand` or equivalent outline generation for final stroke shape
- reduce points with distance/time thresholds so fast strokes do not create excessive nodes
- preserve enough points so slow curves do not become angular
- store pressure/velocity-compatible fields even if pressure is unavailable on mouse
- simplify final stroke for storage, but never during the live pointer frame if it causes lag

### Viewport And Camera

- Keep camera `{ x, y, z }` in a mutable engine store.
- Apply pan/zoom to the Konva stage or root group directly.
- Zoom around pointer position using world/screen coordinate conversion.
- Only publish camera snapshots to React for UI labels like `100%`.
- Throttle minimap/navigator updates.
- Prevent UI wheel/pointer events from bubbling into the stage.

### React Boundary

React should render:

- toolbar
- properties drawer
- settings/history panels
- node HTML controls when editing
- status toasts and save state

React should not render on every:

- pointer move
- stroke point addition
- drag frame
- remote cursor packet
- camera pixel movement

React state receives coarse events:

```text
tool changed
selection changed
transaction committed
save status changed
history loaded
active edit session opened/closed
```

### Object Count And Hit Testing

- Use spatial indexing or viewport filtering before full hit testing.
- Prefer simple bounding-box checks first, then precise hit tests.
- Keep hit regions separate from visual stroke complexity when needed.
- Cache expensive shape bounds.
- Batch select/drag updates into one transaction per frame.
- For very large Boards, introduce viewport culling before S4 collaboration scale work.

### Images And Nodes

- Keep full image binaries out of Board documents.
- Render images from R2 thumbnails first; upgrade to larger previews when zoomed in.
- Cache image nodes in Konva when they are static.
- Avoid re-rendering React node controls unless a node is selected/editing/running.
- Large image decode/upload/capture should not happen in the drawing frame.

### Yjs Collaboration Smoothness

Local user interaction must not wait for the network.

```text
local commit -> local render immediately
local commit -> Yjs transaction after/batched
remote update -> merge into store
remote update -> skip if local tool session owns the same object
presence -> throttle to 15-30 fps
history -> use user-origin scoped undo manager
```

For collaboration:

- group drag/stroke operations into transactions
- send live cursor/presence separately from persisted document data
- compact or snapshot long-running Yjs updates before they become too large
- do not write every remote cursor move to Postgres
- save Board snapshots from stable document states, not every live packet

### Measurement Gates

The spike should add simple in-browser diagnostics:

```text
frame time p95
pointer-to-render latency estimate
stroke point count before/after simplification
visible object count
total object count
image count and decoded image count
Yjs update count/second
last save/export duration
```

Minimum acceptance targets for the first serious spike:

```text
60 fps target for normal Boards
p95 frame time under 24ms while drawing on a medium Board
no visible pointer lag on fast strokes
1,000 strokes remain selectable/pannable
100 node cards remain draggable
20 images do not freeze pan/zoom
remote cursor updates do not interrupt local drawing
```

These numbers are gates for continuing the migration, not final commercial guarantees.

### Tools and Styles

Current tldraw tool set:

```text
hand
select
rectangle / diamond / ellipse / triangle / cloud
arrow
line
draw
text
eraser
```

Current properties:

```text
stroke color: black / red / green / blue / orange / violet / grey
fill: none / semi / solid / pattern
fill rendering: solid / pattern use opaque lighter tints, not transparent alpha
width: s / m / l / xl
dash: draw / solid / dashed / dotted
line spline: straight / curve
arrow kind: arc / elbow
arrow heads: start/end arrow/triangle/none
font: draw / sans / serif / mono
opacity
layer / align / action commands for editable selections
```

The Konva engine may store style names differently, but the UI contract and visual result should stay close.

### Node Runtime

Preserve current node/product logic:

- Node types: prompt, image, image_gen, image_gen_4, analysis.
- Node cards contain self-contained controls and runtime summaries.
- Ports expose typed text/image inputs and outputs.
- Edges are stored as explicit runtime edges, not only visual arrows.
- `resolveNodeInputs` behavior remains the AI run input source of truth.
- Image nodes reference Asset ids/URLs, never Base64 payloads in Board documents.
- AI run UI still writes summary status: idle/running/succeeded/failed, cost hint, result asset ids and optional text output.

### Board Document and Persistence

The current serializer already separates product facts from tldraw enough to migrate incrementally.

Current save document contains:

```text
version
pageId
camera
viewport
canvasSettings
runtimeEdges
assets
shapes
serializedAt
```

S1X should introduce a renderer-neutral `TangentBoardDocument` and adapters:

```text
tldraw document adapter      current reference reader/writer
konva document adapter       new runtime reader/writer
board guard                  shared validation
history/snapshot API         unchanged
thumbnail capture            reimplemented against Konva stage export
```

### Smart Drawing

Current smart drawing recognizes:

- straight lines
- cubic curves
- rectangles
- triangles
- ellipses

The recognizer logic is reusable, but the tldraw-specific `b64Vecs` decoding and output shape creation must be replaced with renderer-neutral point input and Konva shape output.

## Migration Architecture

Do not rewrite `/boards/[boardId]` in one pass. Add a parallel engine and contract layer first.

```text
apps/web/src/features/canvas-engine
  document.ts              TangentBoardDocument types
  store.ts                 shape/asset/edge commands
  viewport.ts              camera transform model
  history.ts               undo/redo command stack
  tools.ts                 active tool/style state

apps/web/src/components/konva-canvas
  KonvaCanvasSpike.tsx     isolated prototype route
  layers/*                 background, strokes, shapes, nodes, overlays
  tools/*                  draw, select, pan, resize, text, erase
  konva*Commands.ts        shared object commands for menu, shortcuts and properties
  konvaImageClipboard.ts   clipboard image import through Asset API, no data URL persistence
  KonvaImageShape.tsx      image renderer with thumbnail/original zoom LOD
  KonvaNodeCardShape.tsx   lightweight node-card shell, registry-derived ports
  KonvaNodeEdgeOverlay.tsx runtime edge visuals/hit targets, separate from annotation arrows
  KonvaContextMenu.tsx     hover submenu shell; unsupported schema/export commands stay disabled

apps/web/src/features/collaboration
  ydoc.ts                  Yjs document mapping
  provider.ts              room transport wrapper
  awareness.ts             cursor/selection/presence state
```

## Parity Gates

S1X is not accepted until these gates pass:

1. Handfeel spike passes user drawing test.
2. Renderer-neutral document can save/load strokes, shapes, text, image nodes, prompt/AI nodes and edges.
3. Existing Workspace and Board API paths do not change.
4. Board History can create/list/load snapshots from the new document.
5. Captured thumbnail works from Konva export.
6. Two browser tabs can edit the same prototype Board with Yjs and show cursor/selection presence.
7. tldraw route can remain as fallback until the Konva route passes staging smoke.

## Detailed Parity Matrix

The detailed Chinese feature-by-feature replication matrix lives in:

```text
dev-plans/s1x-canvas-engine-migration-reference-2026-05-03.md
```

That tactical plan is the working checklist for matching the current tldraw behavior across:

- handfeel and pan/zoom
- toolbar and fixed properties drawer
- properties panel selection/style/layer/align/action controls
- context menu and submenus for edit/arrange/reorder/copy/export commands
- detailed shape parity: rectangle, diamond, circle/ellipse, triangle, cloud, line/arrow curve handles, pencil/eraser feel and navigator/minimap zoom controls
- shapes, text, draw, eraser and selection details
- undo/redo, copy/paste and Alt-drag duplicate
- node cards, ports, typed edges and AI runtime summaries
- Canvas/Image/Node conversion paths: selected image to Image Node, Image Node to Canvas, selection capture to Image Node, Canvas markup to merged image
- image paste/copy/Alt-drag and placement rules: web image paste to pointer, image-to-node on the right, screenshot/capture node below the selected bounds, To Canvas image on the right
- save/autosave/snapshot/history/thumbnail
- Yjs collaboration proof
- final dual-engine replacement and tldraw removal gates

## Freeze Rules

- No new tldraw-only feature work except emergency regression fixes.
- No deletion of tldraw reference code until Konva parity is accepted.
- Any new Board/Node/Asset product logic must land in renderer-neutral modules first.
- Do not add another paid/proprietary canvas or collaboration SDK as a core dependency.
