# ARCH Slice S1X: Canvas Engine Migration

**Updated**: 2026-05-18
**Status**: Konva v2 formal Board route is accepted as the production path for active Boards, and the remaining tldraw web runtime/reference code has now been removed from `apps/web`. Page polish, runtimeGraph mock dataflow, public share view, the Konva-only staging path, page-limit modal, node minimum sizing and first draft-preview collaboration pass are first-pass stable; export/background polish, real AiRun and production-grade multi-instance collaboration remain.
**Branch**: `feature/s1c-auth-admin-production-boundary`
**Reason**: This slice began as the exit from the old paid-canvas dependency. That runtime migration is now closed in the active web app, and the remaining work is Konva-only stabilization plus collaboration/provider follow-through.

## P0 Alpha Stabilization Boundary

This slice is now in stabilization mode:

- Konva-only `/boards/[boardId]` is the production-facing canvas path.
- Share viewing, page safety and Board persistence are in scope.
- Production-grade Yjs room sync, rendered page-thumbnail assets, page duplicate and broader export polish remain deferred.

## Decision

Treat historical pre-Konva behavior as migration context, not as an active runtime dependency.

The migration target is:

```text
Konva / react-konva          Canvas rendering and pointer interaction
Yjs                          Collaborative board document
y-websocket or Hocuspocus    Self-hosted collaboration room transport
FastAPI + Postgres           Board metadata, snapshots, permissions, audit facts
R2/S3-compatible storage     Images, thumbnails and future capture artifacts
```

That historical baseline has now been retired from the active web app. This slice keeps the migration rationale and behavior inventory only to explain why the Konva contract looks the way it does.

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
- Canvas Image → Image Node creates a `node_card` image node beside the image. Node data stores `assetId`, dimensions, preview asset URLs, optional crop-ratio metadata, `source` and a stable `Image` title; it does not store `data:`, `blob:`, Base64 or provider raw payloads. Multi-image conversion maps each selected image to its own node. Mixed image+markup selections still expose Convert, but the conversion command filters to image shapes only and leaves other selected markup untouched. Image Node → Canvas restores the crop metadata onto the new `CanvasImageShape`; local Image Node upload and upstream mirror replacement clear stale crop metadata when the new asset has none.
- Image Node → Canvas Image fetches the asset record by `assetId` through the existing Asset API, then creates a `CanvasImageShape` beside the node with display URLs on the image shape. The action lives in the Image Node header `To Canvas` control, not in the canvas-image floating toolbar.
- Selection capture/export is now a first-pass Konva boundary: actions take `selectedIds`, compute a single export bounds rect from selected shape/node geometry in `konvaSelectionExport.ts`, clone the visible Konva stage into an offscreen hidden container, render only those ids with capture-excluded chrome hidden, and never infer capture scope from the current viewport. The offscreen clone rehydrates selected image/image-node previews from original asset URLs before PNG export so LOD thumbnails are display-only.
- Copy as PNG writes a transparent PNG clipboard item where supported; Export as PNG downloads the same selectedIds render result as a file. Copy/Export as SVG uses `konvaSelectionSvgExport.ts` for a limited vector serializer. Canvas images and Image Nodes render via asset URLs, while unsupported non-image node internals are simplified without embedding raw image bytes.
- Capture selection to Image Node uploads the selectedIds PNG through the Asset API with `origin=merge_capture` before creating the Image Node below the selection bounds. Copy/export assets use `origin=editor_export` if a future persisted-export path is added. Board thumbnails use `origin=board_thumbnail`; pasted remote URLs use `origin=remote_import`; image operations use `origin=background_removal` or `origin=object_cutout`. Board documents and node props must store only asset refs/metadata, not `data:`, `blob:`, Base64 images or raw render payloads.
- Frame visible-bounds helpers are available, but rotated/precise clipped export semantics are still follow-up work.

Current Phase 4 Node/Port/Edge foundation boundary:

- `node_card` is the renderer-neutral canvas node carrier. Konva can render a lightweight card in the canvas layer, while heavier React/HTML controls should only mount for selected, editing or running nodes.
- Node creation and display must stay registry-driven. `node-runtime/registry.ts` owns display name, palette label/order, default card size, accent color, default data, fields, output summary and port definitions. Future text optimizer, multi-text merge, perspective image generation or other AI nodes should not require changes in `KonvaCanvasStage`, `KonvaNodeEdgeLayer` or generic port rendering.
- `node_card` is not a normal drawing shape for transform purposes. Selection overlay, rotate sessions, group rotation utilities, render transforms, port coordinate math, Properties actions and context-menu commands must ignore node-card rotation/flip. Node cards may move/select/connect/edit, but they should not expose rotate or flip affordances.
- Node cards now use registry default dimensions as their minimum resize size. Loading and resizing normalize node cards back to at least their default card size so chat inputs, controls and image previews do not drift outside the card after excessive shrink transforms.
- Ports are UI affordances derived from node registry metadata. Their screen/world anchors and hit targets must be stable under pan/zoom, but a visible port dot by itself is not a runtime connection.
- `CanvasDocument.runtimeEdges` is the local first-pass runtime edge store. A runtime edge references source node/port and target node/port ids plus `dataType`; it is not serialized as a visual `arrow` or `line`.
- `features/node-runtime/runtimeGraph.ts` owns renderer-neutral runtime edge mutation and reconciliation: add/remove/reconnect, input uniqueness, output fan-out, invalid-edge pruning, dynamic Image Gen/Image Gen 4 image input counts and Image Node upstream preview mirroring. Local Image Node upload clears the incoming `image_in` edge before writing own asset refs so upstream mirrors cannot overwrite user-uploaded images. Konva wrappers must call this layer instead of duplicating runtime dataflow rules.
- `runtimeGraph.ts` also exposes batch edge add for multi-source workflows. Konva uses it when several selected Image Nodes drag from `image_out` as one bundle; the target Image Gen/Image Gen 4 input ports are pre-expanded before validation, then consecutive `image_in_N` edges commit as one history checkpoint. This same renderer-neutral path is the contract future AI chat auto-wiring should reuse.
- Image Node mirroring must resolve effective upstream image output, not just copy the immediate source node props. This keeps chained `Image Gen -> Image -> Image` mirrors consistent when an upstream generated output or edge is cleared.
- `features/node-runtime/runtimeGraphResolution.ts` is the prepared renderer-neutral input/output resolver for mock Run and future AiRun adapters. It returns prompt text, short analysis text and image asset references only, with a compatibility fallback for legacy `image_gen_4:image_out` aggregate edges; raw images, provider payloads and full logs remain outside Board documents.
- `features/node-runtime/runtimeGraphRunAdapter.ts` is the current client-side mock Run adapter. It resolves upstream inputs, calls the mock AiRun route, uploads generated mock PNGs through the Asset API, writes compact `runtimeSummary` fields and stores generated output asset refs/URLs in node data. It is a replaceable adapter boundary; real provider calls still belong behind server-side AiRun contracts.
- `features/node-runtime/runtimeGraphAssets.ts` owns the lightweight asset-ref shape used by Image Nodes and generated outputs. It must not carry raw image bytes, `data:`, `blob:`, provider raw responses or full logs. Node card previews should prefer thumbnail assets and shared image loading where possible to keep the Konva spike responsive.
- `KonvaNodeEdgeLayer` renders runtime edges from `runtimeEdges` and node port world coordinates. It is a visual projection of runtime data, not the source of truth. It must render below node cards so existing edge curves never cover a source output port hit target; this preserves output fan-out after the first connection.
- `useKonvaNodeConnectionSession` owns output-port drag, preview curve and compatible input-port commit. It uses registry-derived ports and zoom-aware hit radius from `konvaNodePorts.ts`; while dragging, a compatible input within range becomes the preview target so the endpoint snaps to the port center and `KonvaNodeEdgeLayer` can render a stronger snap affordance.
- Prompt/Analysis card text is a targeted hybrid path: the lightweight Konva card draws the card shell and the non-editing long-text preview inside the node's own Konva group with clip + local scroll offset + self-drawn scrollbar. This keeps text preview relative to the node and preserves canvas z-order; it must not be a global DOM overlay above later shapes/lines. Double-clicking mounts the same-bounds HTML textarea editor (`KonvaNodeTextEditor`) and commits back into node `props.data`.
- Node/image cards separate body pass-through from port interactivity: drawing tools can start markup over the card body, while port hit targets still receive pointer events and may start runtime edge drags.
- Visual arrows/lines stay normal canvas geometry unless an explicit binding/edge contract creates a runtime edge. This keeps annotation arrows separate from AI dataflow edges.
- Deleting a node now cleans connected runtime edges in the same local command/history transaction. Direct edge hit/select has a near-input disconnect control, and selected runtime edges can also be removed with Delete/Backspace or Cmd/Ctrl+X through the same runtimeGraph removal path.
- `resolveNodeInputs` remains the AI run input source of truth. Konva now wires `runtimeGraphResolution.ts` into the mock Run adapter; the next boundary is replacing the mock completion with server-side AiRun lifecycle, polling/cancel behavior and real generated asset propagation.
- Board documents, node props and runtime edge payloads must not persist `data:`, `blob:`, Base64 images, provider raw responses, complete logs or long generated text. Store Asset ids/URLs, compact runtime summaries and references to AiRun records instead.

Current Phase 5A persistence boundary:

- Konva persistence is now the only active Board persistence path in the web app. `KonvaBoardSaveAudit` is mounted in `/spikes/konva-canvas` and `/boards/[boardId]`, uses the shared Board API client, and serializes through `features/boards/konvaBoardDocument.ts`.
- `/boards/[boardId]` is now a Konva-only shell. `boardCanvasEngine.ts` recognizes only persisted Konva v2 documents; legacy v1 or unknown documents render an unsupported state, while the guard layer blocks legacy restore/save paths instead of silently opening a fallback runtime.
- The persisted Konva envelope is `{ version: 2, renderer: 'konva', activePageId, pages, canvasDocument, canvasSettings, assets, serializedAt }`. `canvasDocument` remains the active page mirror for older consumers and active-page thumbnail capture. `pages[]` is now the page-switching contract; the right-side collapsible Pages drawer writes the current `CanvasDocument` back into the active page before save/snapshot/switch/page mutations, and restore/load returns both the active page document and normalized page list. Page delete/reorder are local page-list mutations, and right-click Move to page moves selected shapes into the target page document after expanding grouped members and frame children. Runtime edges whose source and target shapes both move are copied to the target page; edges touching only one moved endpoint are removed because cross-page runtime edges are not in scope yet. The drawer currently renders lightweight geometry thumbnails from page shapes and enforces the current workspace/plan page limit before create/duplicate, showing a centered upgrade dialog when the limit is reached. True rendered per-page thumbnail assets, Move selection to new page and page-scoped production collaboration are follow-ups. `assets` is a compact derived list across page documents used for Board summaries; raw image bytes stay in Asset storage.
- Restore validates the v2 envelope, runs the existing Board guard, replaces Konva document/camera/settings and clears transient selection, edge selection, crop, edit and context-menu state. Legacy tldraw documents/history are rejected before they can enter the active restore path.
- Restore also normalizes any persisted backend asset file URLs onto the web proxy path before image render, so same-board assets continue to display when the backend requires bearer auth and browser `Image()` elements cannot call the API origin directly.
- Board thumbnails for Konva use `captureKonvaBoardThumbnailUrl`: all shapes are captured through the offscreen Konva clone/export path and uploaded with `origin=board_thumbnail`. This keeps thumbnail generation separate from user `merge_capture` assets.
- Existing Board save/autosave/history/before-unload hooks remain the lifecycle layer. Board History now has create/list/load/clear-all transport: `DELETE /api/v1/boards/{board_id}/snapshots` and the local Next equivalent delete all snapshots scoped to the current workspace and board, then the frontend resets the last snapshot signature so the next autosave can recreate history. Konva dirty tracking is document-signature based for the first pass; later Board route migration should replace this with a renderer-neutral dirty event source.
- The Board guard has a v2 schema-aware layer on top of the generic no-runtime-URL/no-large-base64 scan. `boardKonvaDocumentGuard.ts` and `board_konva_guard.py` validate the Konva envelope, active page/page list, camera, metadata, assets, shape ids/types/required props and runtime edge shape references and emit blocking `konva-v2-invalid` issues before save/snapshot persistence. `boardTypes.ts` and FastAPI `board_metadata.py` count shapes from `pages[].canvasDocument.shapes` when the pages contract is present.
- `tldrawToKonvaMigration.ts` is an explicit copy adapter, not an implicit open-path conversion. It converts serialized v1 shapes/assets/runtime edges into a new Konva v2 envelope with one active page. Supported first-pass mappings are geo/note/frame/text/image/arrow/line/draw/node_card plus `ai_card` placeholders; unsupported legacy shapes become labeled placeholders so data loss is visible.

The active web app no longer ships a Tldraw runtime path. Historical migration helpers may remain as background material, but legacy v1 Boards are not a supported in-app runtime path.

## Historical Baseline That Shaped Konva

The replacement engine must preserve these current product behaviors unless a deliberate product decision changes them.

### Shell and Layout

- Board route loads `/boards/[boardId]` into the product canvas.
- Header provides Workspace back plus inline Board rename. Board switcher, recent Board and new/open affordances belong outside the canvas top bar.
- Top toolbar stays above the canvas with hand/select, shape, arrow, line, draw, text and eraser tools.
- Frame and Sticky are first-class canvas tools; Frame starts as a labeled outline container, Sticky starts as a resizable editable note.
- Frame containment is represented with `parentId=frame.id` and rendered through a Konva clip group, so child shapes are visible only inside the frame bounds.
- Sticky stores note text plus a provisional `authorName`; Auth-backed author identity remains for the real Board migration.
- Left properties drawer is fixed and decoupled from canvas pointer events; it keeps the last selected drawing tool properties until another tool is chosen.
- Canvas Settings panel opens from a gear icon and controls per-board background/grid/snap behavior.
- Board Save/History controls remain visible and support Save now, Snapshot, Refresh preview and History.
- Selection toolbar for generated node/capture/alignment actions is part of the current experience and must remain in place before the migration closeout is considered complete.

### Drawing Handfeel

The first Konva spike is judged by handfeel, not feature count.

- Slow lines should not jitter.
- Fast lines should not break or visibly undersample.
- Curves should feel natural and not mechanical.
- Pan/zoom must stay under the pointer without drift.
- Drawing after zoom/pan must land exactly under the cursor.
- Continuous drawing should not cause tool panels to flicker or reset.
- 1,000 strokes and mixed nodes should remain interactive on staging hardware.
- Target acceptance: at least 80% of the historical pre-Konva handfeel before migrating node/business logic.

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

The Konva replacement must be designed for smoothness from the first spike. The goal is not only "same features as the historical baseline", but the same feeling: pointer input should be immediate, React UI should not re-render on every pointer event, and collaboration updates should not interrupt local drawing.

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

Konva Phase 4 current boundary:

- Node creation is registry-driven through `features/node-runtime/registry.ts`; the canvas toolbar, blank-canvas double-click menu, default card size, accent color, field metadata, port metadata and AI-facing registry entries should derive from `nodeDefinitions`.
- Node runtime affordances should read node definition capabilities. `runnable` is registry-owned; card Run/Stop UI and run commands must not duplicate node-type lists.
- Blank-canvas double-click is handled at the DOM canvas wrapper level with a world-space blank hit check. This avoids depending on Konva Stage blank-target double-click delivery while preserving shape/node double-click edit handlers.
- Future nodes such as text optimization, multi-text merge and perspective image generation should add a node definition plus runtime resolver/AiRun adapter. Canvas core should not add one-off toolbar/stage/edge special cases per node.
- Runtime edges are dataflow edges in `CanvasDocument.runtimeEdges`, separate from visual arrows and lines. Output ports may fan out to multiple downstream inputs; each input port accepts one upstream edge and reconnecting it replaces the previous edge.
- Image Gen/Image Gen 4 support dynamic image input ports by storing `imageInputCount` on node data. The renderer keeps one spare image input after the current connected inputs, capped by the registry limit.
- Image Node upload/mirroring stores only asset refs/URLs/dimensions/title. Local file upload uses the Asset API; upstream Image Node mirroring marks derived data with `inputSourceEdgeId` so disconnect can clear inherited preview data without deleting a local upload.
- Image/node canvas shapes are body-transparent while drawing tools are active, so users can draw markup and place shapes over images/nodes. Node port drag remains active through dedicated port hit targets; shape selection/drag/editing still requires Select mode except for the targeted Prompt/Analysis textarea overlay once opened.
- Prompt/Analysis long text must stay inside the node field bounds in both preview and edit states. Preview scrolling is node-local Konva state; edit scrolling is DOM textarea state. Neither path may break normal canvas z-order.
- Run/Stop on Analysis/Image Gen/Image Gen 4 now goes through the mock runtimeGraph Run adapter. The later AiRun adapter must replace the mock completion with server-side run lifecycle, real provider outputs and cancellation.
- Shape transform affordances should read `features/canvas-engine/shapeCapabilities.ts` and the Konva wrapper `konvaShapeCapabilities.ts`; `node_card` rotate/flip exclusions must not be reimplemented per component.
- Tool hit policy is explicit for continuous line tools: Arrow, Line and Draw do not select or drag existing shapes while active. Object selection and Properties edits require Select/V; this avoids accidental selection while repeatedly drawing lines/strokes.
- Phase 4 cleanup checkpoint: edge add/remove helpers no longer own renderer-local dataflow. Konva edge helpers are a thin shell over renderer-neutral `runtimeGraph.ts`; mock generated assets now pass through `runtimeGraphRunAdapter.ts`, and the remaining boundary work is the real AiRun adapter.

### Image Operations

Image operations are server-side first. The browser sends an existing image asset reference plus operation parameters; FastAPI reads the source asset through the Asset storage adapter, runs the algorithm, uploads the transparent PNG result to R2/local storage and returns a new asset reference. Canvas creates a new image shape near the source image. Board documents must never store raw image bytes, masks, `data:`, `blob:` or Base64 payloads.

Current truthful release note:

- `Remove BG` is exposed in the frontend selection UI, but the end-to-end backend/API/staging flow still needs to be reconnected and re-accepted before it is treated as a live supported feature in this pass.
- `Object Cutout` remains planned only.

Planned algorithms:

- `rembg`: one-click background removal. Current upstream repo is MIT-licensed; implemented as optional `services/api[image-ops]` dependency for `Remove BG`.
- `facebookresearch/segment-anything`: point/box object cutout. Current upstream repo/model are Apache-2.0; use for `Object Cutout` after adding image-local point/box interaction. The SA-1B dataset license is separate and is not a runtime dependency.

Implementation boundary:

- Operation inputs: trusted `assetId`, source image display bounds on the client, optional point/box prompt for SAM. Raw remote URLs should first pass through `/assets/from-url` and become `remote_import` assets.
- Operation outputs: new asset id/URLs/dimensions, `origin=background_removal` or `origin=object_cutout`, source asset id, algorithm id/version.
- Canvas placement: create a new image shape at roughly `source.x + 24`, `source.y + 24`, preserve visual size/proportion where practical, select the new result.
- History: creating the result is one canvas checkpoint; undo removes the new shape but does not delete the remote asset.

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
  KonvaNodeEdgeLayer.tsx runtime edge visuals/hit targets, separate from annotation arrows
  KonvaContextMenu.tsx     hover submenu shell; copy/export first-pass actions; unsupported schema/page commands stay disabled

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
7. The retired legacy-route stage must not be reintroduced; staging smoke should verify the Konva-only route plus guard-based rejection of legacy documents.

## Detailed Parity Matrix

The historical Chinese feature-by-feature replication matrix now lives in the archive:

```text
dev-plans/Archive/s1x-canvas-engine-migration-reference-2026-05-03.md
```

That archived tactical plan is background context only. The active Konva stabilization truth now lives in this slice, the PRD S1X slice and the P0 stabilization plan.

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
- final migration closeout and legacy-document safety gates

## Freeze Rules

- No reintroduction of legacy-canvas compatibility layers into the active app path.
- Historical archive material may stay for reference, but the active runtime boundary must remain Konva-only.
- Any new Board/Node/Asset product logic must land in renderer-neutral modules first.
- Do not add another paid/proprietary canvas or collaboration SDK as a core dependency.
