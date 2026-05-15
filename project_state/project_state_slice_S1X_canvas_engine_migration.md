# Project State Slice S1X: Canvas Engine Migration

**Status**: Konva v2 formal Board route is accepted as the production path for active Boards, and the remaining tldraw web runtime/reference code has now been removed from `apps/web`. Page polish, runtimeGraph mock dataflow, public share view and first-pass collaboration are stable: permission-aware presence/read-only wiring, passive remote-save sync, guarded Yjs room/snapshot foundations, richer room-state semantics, visible sync state, deferred remote-apply handling, native page/shapes/edge Yjs storage, first-pass page-level remote merge/apply, provider-ready transport shaping, document/awareness initial-sync gating, occupancy-aware presence, local collaboration undo/redo and a first-pass FastAPI websocket room provider. Export/background polish, real AiRun and production-grade multi-instance provider/awareness remain.
**Branch**: `feature/s1c-auth-admin-production-boundary`
**Started**: 2026-05-03

## Current Alpha Boundary

This slice is no longer a broad migration exploration. For the current release pass it is a stabilization lane:

- keep `/boards/[boardId]` reliable
- keep page/history/share flows reliable
- keep the Konva-only Board runtime reliable after tldraw removal

Yjs collaboration, rendered page-thumbnail assets, page duplicate and broader export polish remain outside the current alpha promise.

2026-05-12 collaboration-readiness checkpoint:

- `/boards/[boardId]` now wires local collaboration presence into the Konva runtime with active-session header state, permission-aware read-only mode, remote cursor overlay and optimistic self cursor updates.
- Collaboration session responses now expose authoritative `boardSavedAt`, and read-only Konva viewers auto-reload the latest board document when another session saves.
- Konva board runtime now initializes a board-scoped local Yjs room over `BroadcastChannel`, publishes guarded Konva v2 page/canvas state into the room as debounced structured updates, restores remote collaboration updates back into the active page/page-list state, and surfaces local sync readiness plus pending-remote conflict state in the canvas shell.
- Writable editors now defer remote collaboration apply when unsynced local changes are still pending and expose explicit `Load remote` / `Keep current` actions instead of silently overwriting the room state.
- Pure active-page switching no longer schedules a local Yjs publish by itself, reducing cross-tab page-jump churn during page navigation while the structured room state remains unchanged.
- Local Yjs storage is no longer a monolithic snapshot blob or a dual-written legacy format: the room now stores only the native page-keyed structured Yjs document, and normal active-page edits merge into that structured room state without rewriting every page key.
- Remote Yjs applies now preserve the receiver's current page/camera when possible and explicitly suppress local autosave/dirty warnings for collaboration-origin restores, avoiding passive re-save loops from non-authoring tabs.
- When an incoming Yjs update is marked as an active-page edit and the local page structure still matches, the Konva runtime now applies only the changed page payload into the resident page list instead of falling back to a full board restore. Full-board restore remains the fallback for structural mismatch or structural page changes.
- The remote collaboration hot path is now structured-native: incoming Yjs room state hydrates `pages[] + activePageId` directly from the native Yjs-backed board document, tries page-level apply from that data, and only escalates to a full structured page restore when the incremental page reconcile cannot safely apply.
- The collaboration sync hook now also consumes native Yjs structured records directly on the browser side instead of materializing a full `SerializedKonvaBoardDocument` before restore. Legacy snapshot fallback/materialization is removed from the collaboration path, and the synchronized merge baseline now keeps only structured page data plus signature metadata.
- Restored Konva board documents now normalize stored asset file URLs through the web proxy path before render, so strict-auth staging can display uploaded, pasted and generated images without relying on direct backend asset image loads.
- Collaboration publish semantics are now less coarse than the earlier `active-page | full-board` split. Page rename/create/delete/duplicate/reorder/move-selection changes now publish as a structured `page-batch` room update instead of always escalating to `full-board`, and the native Yjs page store only rewrites changed page documents while still syncing page order / page metadata across the board.
- Within changed pages, native Yjs document writes are now also more granular: active-page and page-batch sync derive changed shape/runtime-edge ids against the last synchronized base page and only rewrite those entity maps plus ordering/deletions, rather than rewriting every shape/runtime-edge record in the page on each collaboration publish.
- Active-page Yjs publish now also carries a local synchronized baseline into the write path and merges the local `base -> current` same-page delta back onto the current room page state. In practice this means sequential same-page edits to different shapes/edges can now coexist locally more often instead of blindly replacing the whole page payload every publish.
- Remote collaboration apply now also uses the receiver's previous synchronized page set as a merge base. When a structured Yjs update arrives, the Konva page-state layer reconciles `current + incoming + base` before touching the active page, which reduces whole-page replacement on the receiving side and preserves unrelated local page state such as the resident camera more reliably.
- Page-level remote reconcile is now less blunt about structural conflicts too: shared page metadata such as title/thumbnail/updated timestamps is merged against the synchronized base instead of always taking the incoming copy, and cross-page shape/runtime-edge ownership is re-resolved globally before the active page is patched so page moves are less likely to strand stale entities on the wrong page.
- The local Yjs room now stores page order, per-page records, canvas documents, shapes and runtime edges as native Yjs maps/arrays rather than a single snapshot string, and the canvas shortcut path now uses local collaborative undo/redo against the room's undo manager.
- Page create/delete/reorder/move-selection changes now carry explicit changed-page ids and structure flags, so remote page sync can reconcile incremental structural changes instead of immediately collapsing to a full restore when the active page still exists.
- Collaboration room identity now prefers the server-provided board `roomKey`, and local canvas diagnostics no longer write churn into shared Y.Doc metadata; the local awareness bridge remains BroadcastChannel-based but is now shaped like a transport adapter rather than a canvas-specific sidecar.
- Local awareness and local Yjs document sync now both enter through a shared board-realtime transport layer, and the same `clientInstanceId` now anchors presence heartbeats, awareness events, document-room client identity and snapshot actor identity for one browser tab.
- Local Yjs document transport now exposes explicit `connecting -> ready` lifecycle plus an initial-sync settlement gate; the Konva runtime waits for that room settlement before first seed/publish, which reduces the earlier local seed race and makes the hook shape closer to a future websocket/provider implementation.
- Local awareness transport now also exposes explicit `connecting -> ready -> unsupported` state plus first-pass initial-sync settlement, and the board header no longer shows a misleading ready-ish presence label during early room bootstrap.
- Local awareness/document transport state now shares a provider-ready room-state shape with `connecting / synced / disconnected / error / unsupported` semantics, along with last-activity / last-synced timestamps and surfaced error state. The local BroadcastChannel implementation only exercises a subset of those states today, but the room hooks are now shaped to swap over to websocket/Yjs providers without another public API rewrite.
- Awareness presence now carries `hoveredShapeId` plus `editingShapeIds` in addition to cursor/selection/page/tool, and the canvas derives temporary remote occupancy records with owner identity and TTL from awareness expiry. The board overlay now renders remote selected/editing/hovered regions, and local text/crop entry points soft-block when another active session is already editing that same shape.
- Local-dev collaboration session storage is now workspace-aware in both the Next local board store path and the FastAPI local storage adapter, avoiding cross-workspace session bleed when board ids overlap.
- Contract coverage now includes repeated-heartbeat session reuse for the local FastAPI collaboration store.
- A first-pass FastAPI websocket room provider now sits behind the shared board-realtime transport. When a remote persistence API is configured, awareness/document hooks prefer websocket transport; otherwise they fall back to the existing `BroadcastChannel` rooms. The current server room is intentionally lightweight but is no longer only transient memory: it gates access through board collaboration permissions, exposes an explicit room-seed handshake so stale reconnects do not immediately overwrite server state, persists the current Yjs update chain in local-dev/Postgres realtime storage, replays that chain to newcomers, broadcasts awareness batch/state/remove events, and now requests a client full-state republish when the persisted incremental chain grows too long so reconnect state can collapse back to one durable snapshot. Websocket contract tests now cover replay, persisted reconnect, compaction request/replace, disconnect cleanup, room-key mismatch and visibility gating.
- The websocket room now hard-rejects document writes from read-only collaborators on the server path instead of trusting UI state alone. Guest/view-only sessions may still connect for awareness/replay, but `yjs-update` and `sync-state-publish` are denied once the socket is live.
- Websocket awareness now honors TTL semantics more honestly: expired awareness entries are pruned from the server room before replay/broadcast, and the browser room mirror also runs local expiry cleanup so stale editing/hover/selection occupancy does not linger until a disconnect event.
- Client-assisted compaction now carries a room-local `documentVersion` guard. The server only accepts `sync-state-publish` compaction snapshots that prove they were built from the current update version, and stale compaction publishes are rejected/re-requested instead of replacing a newer unseen update chain.
- Stale websocket `sync-state-publish` attempts now get an explicit current `sync-state` resync payload back from the server instead of a silent rejection. This gives reconnecting/outdated tabs a direct resync path before retrying compaction.
- Accepted websocket `sync-state-publish` compactions now broadcast a `sync-state-accepted` acknowledgement with the new compacted `documentVersion`, so connected tabs can reset their local provider counters instead of continuing from stale pre-compaction versions.
- The websocket browser room now also keeps a bounded outbound Yjs update queue. Local edits made before initial room sync settles or during a transient socket disconnect are retained instead of dropped, exposed through shared `queued` / `flushing` room-state semantics, and flushed once reconnect + sync settlement completes.
- The local collaborative undo/redo path now also exposes actual undo/redo availability from the Yjs undo manager, and websocket transport stops retrying non-recoverable 44xx closes so permission/configuration failures surface immediately instead of looping as fake reconnects.
- 2026-05-13 websocket/provider acceptance harness is now in place: `services/api/scripts/s4_realtime_resync_smoke.py` creates isolated reconnect/stale boards, verifies replay after reconnect, forces compaction, advances state from a second tab and confirms stale `sync-state-publish` gets a resync payload back. It now passes against both a clean `local-dev` websocket room and the current real-DB `8100` chain; the real-DB path is slower during compaction churn, but reconnect/resync semantics themselves are now accepted.
- True production collaboration transport/provider wiring still remains pending: the websocket room is single-process/in-memory, does not yet persist CRDT updates, does not yet use a dedicated Yjs server/provider stack and is not yet multi-instance deploy safe.

## Why This Slice Exists

This slice began as the exit from the old paid-canvas dependency. That runtime migration is now closed in the active web app: Konva is the only supported Board runtime, legacy v1 Board docs/history are blocked in the active path, and the remaining work is stabilization plus collaboration/provider depth.

Target stack:

```text
Konva / react-konva
Yjs
y-websocket or Hocuspocus
FastAPI + Postgres + R2 remains unchanged
```

## Historical Baseline

The historical pre-Konva canvas is still useful as a behavior baseline for:

- drawing handfeel
- pan/zoom behavior
- toolbar and fixed properties drawer behavior
- node cards, ports and edges
- Board save/autosave/history
- Board settings
- captured thumbnails
- Smart Drawing conversions

Do not let this historical baseline be confused with the active runtime boundary. The active web app is Konva-only.

## Historical Dependency Scan

The migration originally crossed roughly 58 frontend files:

```text
33 apps/web/src/components/canvas
8  apps/web/src/features/node-runtime
4  apps/web/src/components/nodes
3  apps/web/src/features/assets
3  apps/web/src/features/boards
2  apps/web/src/features/canvas-performance
2  apps/web/src/types
1  apps/web/src/features/smart-drawing
```

The migration is therefore a renderer engine migration, not a small library swap.

## What Can Be Reused

- Workspace and Board shell.
- FastAPI staging deployment.
- Neon Postgres migrations.
- R2 asset storage.
- Board save/load/history APIs.
- Board metadata and management panel.
- Node Registry / Model Registry / AiRun contracts.
- Node runtime edge concept.
- Smart Drawing recognition math after removing tldraw-specific input/output.
- Most product CSS direction and UI hierarchy.

## What Must Be Rebuilt

- tldraw `Editor` command layer.
- `TLShape` / `TLAsset` adapters.
- freehand draw engine.
- selection, resize, rotate and hit testing.
- viewport pan/zoom implementation.
- shape rendering.
- text editing surface.
- image transform/crop basics.
- arrow/edge visual routing.
- canvas export for thumbnail/capture.
- undo/redo command stack.
- Yjs document mapping and awareness.

## First Spike Checklist

- [x] Add `react-konva`, `konva`, `perfect-freehand` and `yjs` in a focused branch.
- [x] Create isolated `/spikes/konva-canvas` route.
- [x] Implement first-pass freehand drawing with smoothing.
- [x] Implement first-pass pan/zoom and 100% navigator reset.
- [x] Add 1,000 stroke performance test button and diagnostics panel.
- [x] Move pan/zoom camera updates out of the React hot path for the spike.
- [x] Add accepted Konva Properties baseline for selected and next-shape style edits.
- [x] Add fill/dash styles, crisp pattern fill, collapsible Properties drawer and line-like selection polish.
- [x] Start Phase 3.1 object editing foundation with box select, single-shape resize handles and shape/selection undo-redo checkpoints.
- [x] Fix fill rendering so solid/pattern use opaque lighter same-hue fills instead of lowered opacity.
- [x] Add first-pass Frame and Sticky tools to the Konva spike.
- [x] Complete Phase 3.10-3.14 first pass: z-order actions, text edit shortcut guard, precise eraser hit testing, snap guides and browser selection cleanup.
- [~] Add production-quality rectangle/text/image/node-card renderers. First-pass accepted; export/background/performance polish remains.
- [x] Save/load a renderer-neutral Konva v2 document in the spike route.
- [ ] Run two-tab Yjs sync with cursor/presence.
- [x] User handfeel review accepted enough to migrate `/boards/[boardId]` to Konva-only.

## Current Implementation

```text
Routes: /boards/[boardId] formal Konva-only Board route; /spikes/konva-canvas regression surface
Files: apps/web/src/components/konva-canvas/*
Engine helpers: apps/web/src/features/canvas-engine/*
```

Included now: full-screen Konva stage, faint dot background, top tool bar, hand/select/draw/basic shapes/frame/sticky/line/arrow/text/eraser, minimap with zoom controls, Yjs document initialization, diagnostics and a fixed left Properties panel.

Phase 1A current performance work:

- pan/zoom mutates the Konva Stage directly during the gesture
- React receives throttled camera previews and committed document camera snapshots
- draft drawing and eraser visuals render in their own layers
- drag/draw gestures clear browser text selection and prevent accidental toolbar text selection

Phase 2A accepted Properties baseline:

- Stroke, Fill, Width, Dash and Opacity update selected shapes and next-shape defaults
- Layer actions support send back, send backward, bring forward and bring front
- Actions support Duplicate and Delete
- Solid/pattern fill is generated from opaque lighter tints of the stroke color; pattern uses crisp high-DPR hatching and does not rely on alpha transparency
- Properties can collapse/expand from the side handle
- Fill is shown only for closed shapes; line/arrow/stroke do not show Fill

Phase 3.1 object editing foundation started:

- `KonvaCanvasStage` is now a thin layer composer; hot pointer/session logic lives in `useKonvaCanvasInteractions`
- box-select marquee can select multiple objects without affecting camera history
- single closed-shape selection shows corner resize handles; rectangle-like/box selection can also drag a bbox edge to extend only that side; Shift while resizing preserves aspect ratio
- single box-like shapes now have a rotate handle offset from the top-right corner and rotate around their center point
- multi-selection shows a union boundary; dragging a selected member now moves the selected set together
- non-Draw drawing tools can point-select an existing object for Properties/resize editing without switching to Select; Draw remains draw-over-object only, and blank canvas clicks continue the active drawing tool after object editing
- keyboard/object editing now covers Copy, Paste, Select All, Duplicate, Delete and Alt-drag duplicate; Alt-drag keeps the source object fixed, moves only the new copy and commits the cached preview shapes on pointerup so the copy does not jump back
- Text tool is one-shot: click creates/selects one text box then returns to Select; text shapes support double-click editing through an HTML textarea overlay, resize scales the text font, and edit/font-size changes auto-fit the text box height to the current content
- Rect, diamond, circle/ellipse, cloud and triangle now support double-click in-shape label editing. The label is stored on the shape props and rendered centered, so movement, drag copy, resize, rotation, stroke color and opacity apply with the container.
- right-click menu first pass exposes Copy, Paste, Duplicate, Layer front/back, Select all and Delete
- Frame now renders as a white mask/container with black outline and label; dragging a shape into a frame sets `parentId=frame.id` and clips the child to the frame bounds. Frame double-click edits the label.
- Sticky now renders closer to a Miro note: author label above, raised shadow, centered note text and double-click body editing. Its text-edit overlay starts centered instead of top-aligned. Properties for Sticky are intentionally limited to color and opacity; no fill pattern, dash or width controls.
- Layer actions now support all four operations from Properties, right-click menu and keyboard: bring front `]`, bring forward `Alt/Option+]`, send backward `Alt/Option+[`, send back `[`.
- Text/sticky/frame editing guards canvas shortcuts while typing; Cmd/Ctrl+S is swallowed inside the editor so it does not trigger browser save or canvas commands.
- Eraser now uses geometric distance hit testing for line/arrow/freehand strokes instead of deleting by the whole bbox; the existing eraser silhouette/trail remains.
- Drag and resize now use shared canvas snap settings (`snapAlignment`, `snapDistance`) and render cyan guides for edge/center alignment.
- Snap correction after user review: Alt/Option drag commits from the final preview document to prevent the copied object jumping back; resize snap now only moves the dragged edge/corner so the fixed anchor side does not show the wrong guide; rotate snaps to 15-degree increments and shows a radial guide.
- Alt/Option drag rewrite: duplicate/move drag now uses a clean `KonvaShapeDragSession`; moving shapes and snap target bounds are frozen at dragStart, and locked-source copy coordinates come from pointer delta instead of the reset Konva node position. User validation passed for snap-on Alt/Option copy near the source object.
- Phase 3B has started with line/arrow endpoint handles: selected line-like objects no longer show bbox resize handles, and dragging either endpoint updates direction/length with optional Shift 15-degree angle lock.
- Phase 3B route model first pass is in place: line/arrow support Straight, Curve and Elbow route properties; dragging the midpoint/control handle converts to curve, and Elbow shows two bend handles for an H-V-H orthogonal connector.
- Curve handle correction: the visible curve handle now sits on the line body/curve midpoint and is converted internally to the quadratic control point, avoiding an off-line Bezier control handle.
- Line/arrow head styles are now exposed in Properties: Start Head and End Head each support None, Dot and Arrow. Existing arrow shapes still default to an end arrow.
- Phase 3B audit says the testable spine is now broad enough for user review: shapes, line/arrow handles/routes/heads, eraser first pass and navigator zoom are present. Remaining Phase 3B items are multi-selection rotate, node-port binding, direction-aware orthogonal connectors, deeper frame semantics, navigator collapse/fit, cursor polish and stroke segmentation.
- Phase 3A right-click menu first batch is implemented: the menu has hover submenus, viewport edge clamping, platform-aware shortcuts, Cut/Cmd-Ctrl+X, multi-selection Arrange commands, Group/Lock, Copy as/Export as and Move to page first-pass commands. Transparent-background toggles remain intentionally disabled until their contract exists.
- Image clipboard first pass is implemented for the Konva route: Cmd/Ctrl+V can read native clipboard image files/items from browser copies or OS screenshots, right-click Paste can read async clipboard image blobs, and pasted images upload through the existing Asset API before creating a canvas image shape. Image shapes store asset ids/URLs rather than data URLs, render real images, use zoom LOD thumbnails and reuse existing resize/rotate/copy/Alt-drag behavior.
- Rotation/resize correction: single rotated objects no longer use the axis-aligned drag override, so transform controls keep their rotation during normal drag and Alt/Option duplicate drag. Rotated corner resize now converts pointer movement into the shape's local rotated coordinate system before changing width/height. Konva min zoom is now 5%.
- Multi-selection rotate first pass is implemented: the union boundary has a rotate handle, group rotation uses the selection center plus origin-shape snapshots, and rotated bounds now account for box-shape rotation. Shift proportional resize uses a single projected scale so width/height preview together instead of appearing staggered.
- Phase 3A command depth first pass is implemented: right-click Edit now supports Group/Ungroup and Lock/Unlock; Arrange now supports Distribute, Stretch, Flip and row/column tidy. Group membership is stored as `groupId`; locked shapes block drag/resize/rotate/line endpoint edits; group selection expands through click-select, drag, Alt/Option copy and clipboard clone.
- 2026-05-04 drag overlay correction: normal drag now uses the same clean drag-preview path as Alt/Option copy, so objects and resize/rotate handles move from one preview state instead of Konva native drag outrunning the selection overlay. Frame drag also suppresses stale top chrome while moving to prevent the old-position black border from lingering.
- 2026-05-04 context-menu polish: right-click menu is capped at two levels. Arrange commands are flattened into sectioned rows instead of nested Align/Distribute/Stretch/Flip submenus, and submenu hover now has a no-gap bridge so it is less likely to collapse when the mouse moves into the panel.
- 2026-05-04 lock polish: locked objects render a small outline lock indicator above their bounds; locked groups render one group-level icon. Right-clicking any grouped member selects the group scope first, so Unlock applies to the whole group instead of requiring each member to be selected.
- 2026-05-04 multi-selection right-click priority: once a multi-selection boundary exists, right-click keeps that boundary as the command target instead of replacing selection with the object under the pointer. Single-object/group hit targeting still applies when there is no active multi-selection.
- 2026-05-04 oriented group boundary: rotated group/multi-selection now computes an oriented selection box from member geometry, so the blue boundary and handles follow rotation instead of reverting to an axis-aligned union. Multi rotated resize has a first-pass transform path. Frame chrome now rotates with the frame, removing the old unrotated black outline.
- 2026-05-04 Properties parity pass is implemented: Properties now exposes Align, Layer and Actions grids for align/stretch/distribute/flip/row/column, plus first-pass font size and text alignment controls for text/sticky/shape labels.
- 2026-05-04 Properties action icons were redrawn as explicit per-command mask SVG line art. Align, layer, stretch, distribute, flip, tidy row/column, image-node, to-canvas and capture icons now map to their actual actions instead of reusing misleading near-match symbols.
- 2026-05-04 Sticky color fix: sticky fill now derives from the current Color/stroke at render time, so typing note text no longer leaves a stale `style.fill` that prevents later color changes.
- 2026-05-04 Konva Image Node first pass is implemented: Canvas Image → Image Node creates a lightweight `node_card` image node on the right side of the image; selections containing images show Convert and create one node beside each selected image, while non-image markup in a mixed selection is ignored by Convert and can still be included through Capture. Cropped canvas images now carry crop-ratio metadata into Image Nodes, the node preview respects that crop, Image Node output/mirror payloads preserve it, and `To Canvas` restores it onto the created image. Node data stores asset refs/preview URLs, dimensions, crop metadata when needed, source and stable `Image` title only.
- 2026-05-04 Frame containment first pass now supports drag-out: moving a child outside all frame bounds clears `parentId`, and frame nesting is intentionally disabled. Helper functions now expose frame/child visible bounds for future capture/export.
- 2026-05-04 Phase 4 Node/Port/Edge foundation first pass is implemented: toolbar buttons create Prompt/Image/Image Gen/Image Gen 4/Analysis `node_card` shapes from registry defaults; node cards show status/fields/summary/port labels; output ports drag-connect to compatible input ports with a preview curve; `CanvasDocument.runtimeEdges` stores runtime dataflow edges separately from visual arrow/line shapes, and undo/redo plus node deletion include runtime edge cleanup.
- 2026-05-04 Node extensibility guard is in place: node creation palette, card default size, accent color, card fields, output summary, port metadata and `isNodeType` derive from `node-runtime/registry.ts`. Future nodes such as text AI optimizer, multi-text merge and perspective image generation should extend registry + runtime resolver/AiRun adapter instead of adding canvas-core special cases.
- 2026-05-04 Phase 4 node UX pass is implemented: blank-canvas double-click opens the node create menu above the pointer; the top toolbar now exposes one Node main icon/dropdown; node create grouping is registry-driven so future categories can appear without hardcoding menu sections.
- 2026-05-04 Node cards were simplified for the Konva route: node internals now show compact fields/previews rather than long descriptions, port labels moved out of the card body, and port hover shows a black text/image tooltip. Image Gen/Image Gen 4 model, aspect ratio and resolution fields can be cycled in the first-pass card UI.
- 2026-05-04 Runtime edge UX pass is implemented: output ports can connect to multiple downstream inputs, each input port keeps only one upstream edge, and selected runtime edges show a near-input `-` disconnect affordance. Image Gen/Image Gen 4 image input ports grow/shrink with connected image refs; Image Gen 4 exposes four image output ports.
- 2026-05-04 Batch Image Node connection is implemented: when multiple Image Nodes are selected, dragging from any selected `image_out` starts a bundled preview from all selected Image Node outputs. Dropping the bundle onto an Image Gen/Image Gen 4 image input writes consecutive `image_in_N` runtime edges in one history checkpoint and pre-expands the target's dynamic image input count, so several image refs can feed one generator without one-by-one wiring.
- 2026-05-04 Image Node upload/mirror pass is implemented: double-clicking an Image Node opens local upload, dragging an image file onto an Image Node uploads through the Asset API, and the node preview uses contain-fit rendering. Image Node can mirror an upstream Image Node asset via runtime edge; disconnect clears only upstream-derived preview data and preserves local uploads.
- 2026-05-04 image cutout plan added to Phase 4A: `rembg` is the planned one-click background-removal path, and `facebookresearch/segment-anything` is the planned point/box object-cutout path. Both are planned as server-side image operations that create new transparent image assets placed slightly down-right from the source image; Board documents still store only asset refs/metadata.
- 2026-05-04 node UX correction pass is implemented: blank-canvas double-click opens the node menu, image/node cards no longer steal Draw/shape gestures when a drawing tool is active, and single-node selection no longer shows the Image Node conversion/capture toolbar.
- 2026-05-04 node control pass is implemented: Image Node upload keeps title `Image`; Image Gen/Image Gen 4 model/aspect/resolution controls are first-pass dropdowns with improved spacing; single Image Gen output preview fills the card body width; Analysis/Image Gen/Image Gen 4 expose Run/Stop first pass through `runtimeSummary.status`.
- 2026-05-04 node text/port regression fix is implemented: Prompt and Analysis preset text boxes now open a focused HTML textarea overlay on double-click and write back to node `props.data`; node/image bodies remain drawable-over in drawing tools while node ports stay interactive, preserving output fan-out without forcing a tool switch.
- 2026-05-04 blank-canvas double-click regression fix is implemented: opening the node create menu now uses a DOM-level canvas double-click handler with world-space blank hit detection, so empty-canvas double-click reliably opens the menu above the pointer while double-clicking existing objects still edits/uploads as before.
- 2026-05-04 runtime edge fan-out/node transform correction is implemented: runtime edge curves render below node cards so an existing edge cannot steal repeated output-port drags; `node_card` is now excluded from rotate handles/sessions, render rotation/flip, geometry rotation, Properties flip actions and context-menu flip commands.
- 2026-05-04 Image Gen dropdown layering fix is implemented: Image Gen/Image Gen 4 model/aspect/resolution dropdowns render after the preview/output container and warning strip, so open menus are visually above card body content.
- 2026-05-04 port snap affordance fix is implemented: node port hit radius is larger, port dots have a larger pointer target, and runtime connection previews visibly snap to compatible input ports with a solid line and target halo.
- 2026-05-04 Phase 4 cleanup first pass is implemented: shape/node rotate and flip capabilities are centralized in `shapeCapabilities` / `konvaShapeCapabilities`, node-port coordinate math no longer keeps dead rotation/flip branches, and runnable node capability is registry-owned instead of duplicated in the card and menu hooks.
- 2026-05-04 subagent Phase 4 audit says the remaining risky area is not another UI patch: `konvaRuntimeEdges.ts` currently mixes edge mutation, image input count sync and Image Node asset mirroring. The next cleanup should introduce a renderer-neutral runtimeGraph/input adapter before wiring real `resolveNodeInputs` and generated asset propagation.
- 2026-05-04 continuous line tool selection rule was superseded on 2026-05-05: Draw still ignores existing objects for draw-over behavior, but Arrow/Line/Shape/Frame/Sticky and other non-Select creation tools can click an existing object to select it for Properties/resize editing without switching the active tool. Object dragging itself still requires Select/V, and blank canvas clicks continue the creation tool.
- 2026-05-04 Prompt/Analysis long-text containment correction is implemented: non-editing node text now scrolls inside the node's own Konva group with clip + local scroll offset + self-drawn scrollbar, so it obeys canvas z-order and no longer floats as a global DOM overlay above later shapes/lines. The HTML textarea editor still uses the same bounds and overflow behavior.
- 2026-05-04 Phase 4 runtimeGraph cleanup first pass is implemented: renderer-neutral `features/node-runtime/runtimeGraph.ts` now owns runtime edge add/remove/reconnect, input uniqueness, output fan-out, invalid-edge pruning, dynamic Image Gen image input count reconciliation and Image Node upstream preview mirroring. `components/konva-canvas/konvaRuntimeEdges.ts` is now only a thin Konva shell. `runtimeGraphResolution.ts` is prepared for the next Konva mock Run/AiRun adapter and returns asset refs/short text only, including the legacy `image_gen_4:image_out` aggregate output fallback.
- 2026-05-04 runtimeGraph audit fix is implemented: local Image Node upload now clears the node's incoming `image_in` runtime edge before writing its own asset refs, so upstream mirroring cannot overwrite the freshly uploaded image. RuntimeGraph reconciliation also skips shape writes when no derived data changes, reducing false dirty metadata updates.
- 2026-05-04 Phase 4 mock Run adapter first pass is implemented: Konva Analysis/Image Gen/Image Gen 4 Run now resolves upstream prompt/image refs through `runtimeGraphResolution.ts`, calls the existing mock AiRun route, writes compact runtime summaries, uploads generated mock PNG assets through the Asset API, stores only generated output asset refs/URLs in node data, previews generated outputs in node cards and reconciles downstream Image Node mirrors. Stop sets the node back to idle and stale async completions no longer overwrite stopped runs.
- 2026-05-04 Phase 4 mock Run polish is implemented: Image Gen/Image Gen 4 output containers now stretch with node resize height; generated node previews prefer 256 thumbnails and share a small image cache to reduce browser pressure. RuntimeGraph Image Node mirroring now resolves effective upstream image output recursively, so disconnecting an upstream Gen/Image edge clears later Image→Image mirrors in the same reconciliation.
- 2026-05-05 AI Chat / Runtime Input contract polish is implemented as a focused pass: Prompt nodes show and output upstream text when connected; Chat nodes show connected prompt/image plus local uploaded/pasted image/PDF references as chips above the input; mock Chat replies count both upstream and local references; the active chat textarea has its own DOM Send button and Cmd/Ctrl+Enter path so sending uses the current text instead of waiting for blur. Chat node data now keeps capped short mock history only, and old placeholder drafts are treated as empty drafts.
- 2026-05-05 drag state-machine correction is implemented: ordinary object/node drag and Alt/Option duplicate drag now both use one `KonvaShapeDragSession` preview as the visual source of truth, so the dragged object, selection handles, snap guides and multi/group companions move together instead of mixing native Konva source motion with React preview motion. The native drag source is locked during the gesture, and node/image shapes keep their normal render while moving instead of switching to preview cards.
- 2026-05-04 Phase 4 edge keyboard pass is implemented: selected runtime edges now support Delete/Backspace and Cmd/Ctrl+X cut. The commands create history checkpoints, clear edge selection and use runtimeGraph edge removal so image input counts and Image Node mirrors reconcile immediately.
- 2026-05-04 Analysis Run misfire fix is implemented: node card Run/Stop and select controls now stop double-click bubbling, so rapid control clicks no longer open the Analysis preset textarea by accident.
- 2026-05-04 Phase 4A capture/export polish is implemented: Capture/Copy/Export PNG now use an offscreen Konva stage clone with capture-excluded chrome hidden, so the visible canvas no longer flashes. The clone rehydrates selected image/image-node previews from original asset URLs before export, so low-zoom LOD thumbnails do not become user capture assets. Right-click Copy/Export as SVG remains a limited vector serializer.
- 2026-05-04 Phase 4A image-pressure polish is implemented after user found 50-100 images made all canvas operations visibly laggy. Drag preview now renders from local preview shapes instead of committing a full preview document every pointermove; resize/rotate/crop/line preview document writes are RAF-coalesced and flushed on pointerup; the stage culls shapes outside a padded viewport; and non-Select drawing tools disable ordinary image/shape hit graphs while keeping node ports interactive. User confirmed Capture selection / Copy PNG / Export PNG no longer flash.
- 2026-05-04 Phase 4A image-pressure hand-test checkpoint: user reports the current pass is temporarily OK. Treat it as local acceptance for this checkpoint, while keeping Windows and heavier-board validation open before Phase 5.
- 2026-05-04 Phase 4A conversion error polish is implemented: Capture selection, Copy/Export PNG/SVG and Remove BG failures now surface as a red inline message in the floating selection toolbar, clearing on selection change or the next action start. This closes 4A.15 first-pass visible error handling.
- 2026-05-04 Phase 4A table reconciliation: 4A.8 is now marked landed for the mock runtime path. Prompt Node `text_out` resolves into Image Gen/Image Gen 4 `text_in`, mock Run creates generated asset refs/resultAssetIds, and downstream Image Nodes can mirror those generated outputs.
- 2026-05-04 Phase 4A paste-into-Image-Node polish is implemented: clipboard image paste now targets a selected or pointer-hit Image Node, uploads the clipboard image as an asset and writes it through `setRuntimeGraphImageNodeOwnData`, so stale incoming image edges are removed and the node keeps only compact asset refs.
- 2026-05-04 Phase 4A asset origin polish is implemented: `board_thumbnail`, `remote_import`, `background_removal` and `object_cutout` origins are in the frontend asset contract. Board thumbnail capture now uses `origin=board_thumbnail`; browser-copied remote image URLs go through `/assets/from-url` server-side import before creating canvas images, replacing the earlier `remote-*` fallback.
- 2026-05-04 Phase 4A image operation contract is implemented as a first pass at the UI/contract layer: single image selection shows Crop, Remove BG and disabled Object Cutout. Current truthful release status is narrower: `Remove BG` still needs its backend/API/staging path reconnected and re-accepted before it counts as a live supported feature, while Object Cutout remains a reserved 501/SAM future path with no point/box UI yet.
- 2026-05-04 Phase 1-3 residual audit checkpoint: quick fixes landed for image/node LOD memoization, image cache caps raised to 160 and low-zoom preview avoids original fetch when thumbnails are absent. Still needs hand testing before Phase 5: 50/100 image pressure at 5/15/25/50/100% zoom, mixed drag/resize/rotate with many images, line/stroke right-click/select at low zoom, rotated frame containment/export semantics and toolbar/properties browser text-selection artifacts.
- 2026-05-04 image crop first pass is implemented: single canvas image selection shows a Crop button in the floating selection toolbar. Clicking Crop enters an edge-handle crop edit mode with resize-style purple borders and corner dots; dragging left/right/top/bottom trims the image and shrinks the image boundary to the cropped region so the remaining pixels are not auto-stretched into the old bounds. Commit/Reset crop UI remains follow-up.
- 2026-05-04 Phase 4A capture sharpness/node resize polish is implemented: selection capture now uses a higher offscreen pixel ratio/max edge, and `merge_capture` Image Node previews above 50% zoom prefer the original capture asset instead of the generated 1024 thumbnail. Node card internals scale as one clipped content layer when resized below registry default dimensions, so controls, text boxes and image previews stay inside the node frame.
- 2026-05-04 Phase 4A polish checkpoint accepted by user: 57% zoom Capture selection → Image Node preview sharpness and small-node content containment are OK. File-state scope for this checkpoint is `apps/web/src/components/konva-canvas/*` selection/export/image-node action files plus `PRD/PRD_slice_S1X_canvas_engine_migration.md`, this dev plan and this project_state slice.
- 2026-05-04 Phase 5A Konva Board persistence first pass is implemented in the spike route: `/spikes/konva-canvas` now mounts `KonvaBoardSaveAudit` in board mode, serializes a v2 `{ renderer: 'konva', version: 2, canvasDocument }` envelope with canvas settings and compact asset refs, saves/loads through the existing Board API, captures board thumbnails through an offscreen Konva stage, and reuses autosave, Cmd/Ctrl+S, Snapshot/History and before-unload guards. Backend/frontend document metrics now count Konva `canvasDocument.shapes`; targeted backend Board persistence tests pass.
- 2026-05-05 Board History Clean is implemented: shared History panel has a confirmed Clean action, frontend local/remote clients call `DELETE` snapshot endpoints, local Next/FastAPI local/Postgres stores clear all current-workspace snapshots for the board, and snapshot signatures reset so a later autosave is not skipped. Shift proportional resize now uses immediate resize preview and preserves one aspect-ratio scale after resize snapping, so snap should not make width/height appear to update separately.
- 2026-05-05 Phase 5A Konva v2 schema guard first pass is implemented: frontend and FastAPI Board guards now add `konva-v2-invalid` issues for malformed v2 envelopes, missing camera/metadata arrays, invalid shape ids/types/props, non-image asset refs and runtime edges that point at missing shapes. This guard runs before Board save/snapshot persistence and is covered by backend validation/save tests.
- 2026-05-05 historical migration checkpoint: the formal Board route briefly used a document-engine detector while Konva became the new path and old v1 data was being inspected.
- 2026-05-05 local old-v1 cleanup checkpoint: local workspace storage was cleaned from 25 old tldraw v1 Board records to 3 Konva v2 Boards (`board-20260504235033`, `konva-spike-local`, `konva_formal_test`), and orphan local snapshot dirs were removed.
- 2026-05-13 Konva-only closeout checkpoint: active web routes no longer expose a tldraw runtime/reference path, board lists filter out legacy v1 docs, and legacy tldraw Board documents/history are blocked from restore in both local and remote storage adapters.
- 2026-05-05 Board header/save controls polish is implemented: Konva header no longer shows spike/Yjs diagnostic subtitle, formal Board save controls no longer expose manual Load, and Refresh Preview now lives inside the History panel footer beside Refresh/Clean.
- 2026-05-05 Konva Canvas Settings is restored: the top toolbar has a gear icon that opens the shared Canvas Settings panel. Konva now applies background color/pattern/grid spacing to the stage background, keeps snap settings wired through the existing drag/resize handlers, and uses Zoom Sensitivity for wheel zoom.
- 2026-05-05 Page/multi-board document contract first pass is implemented: Konva v2 envelopes now include `activePageId` and `pages[]` while keeping `canvasDocument` as the active page mirror for the current single-page runtime. Frontend/FastAPI guards validate page metadata and page-level `CanvasDocument`s, restore picks the active page, and Board metrics count page shapes when `pages[]` exists.
- 2026-05-05 Page UI first pass is implemented: the Konva canvas has a compact right-side collapsible Pages drawer for active-page switch, new blank page creation and double-click page rename. The save/audit path now accepts the current page envelope, so Save/autosave/Snapshot/History persist the edited active page into `pages[]` instead of recreating a single `page-1`. Loading/restoring a Board now restores the active page and page list together.
- 2026-05-05 Board History page-title polish is implemented: Konva History entries use the active Page title instead of repeating the Board title. Local Next snapshot summaries and FastAPI local/Postgres snapshot summaries derive the active Page title from Konva v2 `pages[]`, so refreshed older entries can also show page context.
- 2026-05-05 explicit v1-to-v2 copy tooling first pass is implemented: Workspace legacy Board menus and the formal legacy route state can create a new Konva v2 copy from a serialized tldraw v1 Board without overwriting the source. The adapter maps common tldraw shapes/assets/runtime edges into one Konva page and uses visible placeholders for unsupported old shapes.
- 2026-05-05 Page polish first pass is implemented: the right-side Pages drawer now renders lightweight geometry thumbnails, supports page delete and up/down reorder, and keeps active-page edits persisted before page mutations. The right-click context menu now has a live Move to page submenu; moving selection expands grouped members and frame children, removes shapes from the source page, appends them to the target page, migrates runtime edges whose endpoints are both moved and drops cross-page runtime edges for this first pass.
- 2026-05-05 object-editing polish is implemented: selection bbox edges are now resize handles for box-like shapes, so rectangle/sticky/frame-style objects can extend one side without grabbing only a corner. Non-Draw creation tools can select existing objects for Properties/resize while preserving the active tool. Standalone Text resize scales font size, and text edit/font-size commits auto-fit the box height to content.
- 2026-05-05 select/direct-drag interaction polish is implemented: in V/Select mode, objects are draggable from the first pointer-down without a prior click-select; in non-Draw continuous creation tools, clicking an existing object selects it for Properties/resize/move while blank canvas clicks keep creating with the current tool.
- 2026-05-05 AI Chat history clean is implemented: Chat nodes now show a `Clean` action in the top-right instead of the `SUCCEEDED` status badge. Clean clears `chatMessages` and `exportedMessageIds`, resets the chat runtime summary to idle, and reconciles runtimeGraph so exported output ports/edges disappear together.
- 2026-05-13 memory/fallback audit checkpoint: Konva history is bounded by entry count and approximate bytes, canvas/pattern/generated-thumbnail/image caches now evict LRU-style, the local Next AiRun store has TTL/count pruning, workspace/team/group detail runtime no longer falls back to generated mock dashboard data, and unused workspace mock dashboard files were removed. Collaboration snapshot fallback has been removed from the structured Yjs path; pending remote state now retains signatures/metadata instead of duplicate serialized Board envelopes.
- 2026-05-13 memory/fallback audit continuation: Konva canvas and node image element caches were reduced, now avoid retaining transient `data:`/`blob:` sources, and enforce image-load cleanup/pixel budgets; selection export image hydration is concurrency-limited; runtime asset migration rejects oversized `data:`/`blob:` images before upload/thumbnail expansion; local/WebSocket Yjs transports now cap outbound update payloads before `Array.from`/JSON/BroadcastChannel expansion; and collaboration presence is sanitized client-side before API, BroadcastChannel or websocket send.
- 2026-05-13 cleanup checkpoint: Next local Board/Asset mutation routes no longer use uncapped `request.json()` and now stream-read JSON with explicit byte budgets; board save/snapshot/validate stay capped at 3MB, small board/member/share/presence mutations at 8-16KB, and data-url Asset creation at 32MB. Image operations now reject >30MB or >24MP inputs before `rembg` decode. Local asset storage default moved outside the Next app package so Turbopack no longer traces `.tangent-assets` during production builds.
- Phase 4 storage guard remains explicit: Board documents, node props and runtime edge data must not persist `data:`, `blob:`, Base64 images, provider raw payloads, complete logs or long generated text. Image Node first pass stores only Asset references, dimensions, title/source metadata and runtime summary placeholders.
- A Konva shell `selectionchange` guard clears accidental browser text selection while preserving normal textarea/input selection during editing.
- Frame movement now expands the drag set to include direct/nested frame children, so moving a frame carries contained shapes with it.
- Copy/paste/duplicate/Alt-drag clone logic now rewrites cloned `parentId` through an old-id to new-id map; cloned children no longer point at an old frame. Deleting a frame explicitly releases unselected children instead of leaving stale parent ids.
- Draft preview, eraser session, browser selection guard and snapping math are split into focused helper hooks/modules; `useKonvaCanvasInteractions.ts` is back under the 300-line target.
- undo/redo restores shapes plus selection only, so pan/zoom is not part of command history
- create, drag, resize, eraser, Properties style edits, layer actions, duplicate/delete, stress strokes and clear all now create history checkpoints

Not included yet: full HTML node card controls beyond targeted Prompt/Analysis text preview/editing, extensible server-backed node run adapter registry, real Image Gen result asset propagation, AiRun polling/cancel execution UI, crop reset/explicit commit UI, true rendered page-thumbnail assets/page duplicate/Move selection to new page, precise legacy style/binding migration, nested-frame/export semantics and real Yjs provider sync.

Current hand-test queue:

- Select 3 Image Nodes, drag from any selected `image_out` to Image Gen/Image Gen 4 `image_in_1`, and confirm 3 edges appear, image input ports expand, Run resolves 3 image refs, Undo removes the whole batch, and disconnecting one edge updates input counts/mirrors.
- Recheck 50/100 image pressure at 5/15/25/50/100% zoom on macOS and Windows, including pan/zoom, drawing over images, drag/Alt-drag, resize/rotate, crop, runtime edge drag and node Run. Capture selection / Copy PNG / Export PNG flash is accepted as fixed.
- Phase 5A hand-test: open `/spikes/konva-canvas`, draw shapes/images/nodes/runtime edges, confirm Save now writes a thumbnail, Load restores document/camera/settings, Cmd/Ctrl+S creates a keyboard save, Snapshot appears in History, Restore replaces the canvas, Clean clears all History entries after confirmation, and autosave/Snapshot can recreate history afterward.
- Formal Board route hand-test: open a new `/boards/<id>?new=1` Board and confirm Konva opens blank, save/load/history work; reopen that Board without `new=1` and confirm it restores Konva v2 normally; then try a legacy v1 Board document/history record and confirm the guard blocks restore instead of opening a fallback runtime.
- v1 copy hand-test: from `/workspaces`, use a legacy v1 Board menu `Copy to Konva v2`, confirm it creates and opens a new Konva Board, images/geo/text/notes/arrows appear, runtime edges are retained when both endpoints migrated, and the original v1 Board remains present.

Explicit Phase 3B follow-ups now tracked in the migration plan:

- line/arrow route polish after the first pass: smoother curve affordance, V-H-V or direction-aware orthogonal connectors, per-segment cursor feedback and later node-port snapping
- deeper frame containment: nested-frame policy beyond current disabled behavior, rotated/precise visible bounds and export boundary semantics
- sticky author identity from Auth, shortcut creation behavior and richer note color presets
- cursor polish for resize/rotate handles
- rotation geometry follow-up: current rotated box visuals render correctly, but selection hit testing, frame containment and eraser still mostly use axis-aligned bounds. Phase 3B should introduce shared transformed bounds/hit-test helpers before deeper rotate behavior.

## User Review Notes

- Continuous drawing is preferred: left-click creates one object and keeps the same tool active until the user chooses another tool. Do not regress to requiring right-click lock for normal repeated drawing. Canvas right-click is an explicit command-menu gesture, switches back to Select and must not start a marquee selection session.
- Properties remains required: final engine needs a fixed properties panel for style changes across stroke/fill/width/dash/opacity/layer/actions.
- 1,000 stroke pan/zoom initially felt a bit laggy; current Phase 1A moves camera updates off the React hot path, splits draft/eraser layers and throttles camera previews. User still needs to hand-test whether this is enough.
- Freehand smoothing should stay light in normal Draw mode. Current preference is architect-pen style: slow strokes can feel slightly inkier, fast strokes lighter, with subtle taper; stronger Smart Drawing recognition belongs in a separate mode.
- Canvas navigation shortcuts are part of the handfeel contract: `V` switches to Select, holding `Space` temporarily pans without changing the active tool, and middle-mouse drag pans the canvas.
- Canvas opens in Select by default. Continuous drawing starts only after the user explicitly chooses Draw/shape/line/arrow.
- `Escape` and canvas right-click exit continuous drawing and return to Select. Cloud visual path should fill its bbox so selection handles hug the cloud boundary more like tldraw.
- Cloud must be generated from the user-drawn rectangle perimeter: split each side into revision-cloud/CAD-style scallop arcs based on side length, not a fixed normalized cloud shape scaled to fit.
- Line, arrow and freehand stroke selection should highlight the line itself, not show a rectangular selection box. They still need wider hit targets. Eraser needs a tldraw-like cursor silhouette/trail while moving. Tooltips use English `Tool: Shortcut` labels.
- Shape shortcuts: Select `V`, Rectangle `R`, Diamond `D`, Circle `C`, Arrow `A`; additional spike shortcuts include Hand `H`, Triangle `G`, Cloud `U`, Frame `F`, Sticky `N`, Line `L`, Draw `P`, Text `T`, Eraser `E`. Holding Shift while drawing shape tools constrains proportions.
- Creating draw/line/arrow/shape objects must not auto-select or show highlight controls during continuous drawing; selection visuals appear only after explicit point-select or future box-select.
- Properties should stay fixed when clicking blank canvas. Changing Properties with no selection updates the next drawing style; changing Properties with a selection also writes to selected shapes.

## Estimate

```text
Handfeel spike: 1-2 days
Non-collab usable MVP: 10-15 working days
Staging-ready engine replacement: 3-4 weeks
Basic 2-5 user collaboration: 4-6 weeks total
Large Miro-scale collaboration: later multi-month S4 track
```

## Open Questions

- Is Konva + perfect-freehand acceptable by hand?
- Should Yjs provider be `y-websocket` for simplicity or Hocuspocus for extensibility?
- How much of current tldraw shape visual style must be exact versus TANGENT-owned?
- Should the renderer-neutral document become `version: 2` while preserving a tldraw `version: 1` adapter?

## Next Action

Hand-test Page UI on `/boards/[boardId]`: create three pages, draw different objects on each page, rename by double-clicking a row, reorder with up/down controls, delete active and inactive pages, right-click a selected object/group/frame/node edge bundle and Move to page, then save/reload and create/restore a Snapshot. Confirm pages do not bleed, group/frame contents move together, internal moved runtime edges survive, cross-page edges are removed and History still shows the active Page title. Next whole blocks are true rendered page-thumbnail assets/page duplicate/Move selection to new page, transparent-background/export polish, precise legacy style/binding migration if hand-test finds gaps, real AiRun execution, and then Phase 6 Yjs collaboration.
