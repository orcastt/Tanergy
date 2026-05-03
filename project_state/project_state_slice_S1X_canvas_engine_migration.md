# Project State Slice S1X: Canvas Engine Migration

**Status**: Phase 3 object editing foundation in progress after accepted Phase 1A/2A spike baselines.
**Branch**: `feature/s1x-konva-handfeel-spike`
**Started**: 2026-05-03

## Why This Slice Exists

Public staging exposed the tldraw production license requirement. The current tldraw canvas can remain a local/reference implementation, but TANGENT should evaluate a long-term MIT-compatible canvas/collaboration stack before adding more tldraw-only product work.

Target stack:

```text
Konva / react-konva
Yjs
y-websocket or Hocuspocus
FastAPI + Postgres + R2 remains unchanged
```

## Current Reference Baseline

tldraw is now the reference contract for:

- drawing handfeel
- pan/zoom behavior
- toolbar and fixed properties drawer behavior
- node cards, ports and edges
- Board save/autosave/history
- Board settings
- captured thumbnails
- Smart Drawing conversions

Do not delete or broadly rewrite the tldraw implementation until the Konva route passes parity gates.

## Current Dependency Scan

Direct tldraw surface found in roughly 58 frontend files:

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
- [ ] Add production-quality rectangle/text/image/node-card renderers.
- [ ] Save/load a renderer-neutral document.
- [ ] Run two-tab Yjs sync with cursor/presence.
- [ ] User handfeel review before any `/boards/[boardId]` migration.

## Current Implementation

```text
Route: /spikes/konva-canvas
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
- single closed-shape selection shows corner resize handles; Shift while resizing preserves aspect ratio
- single box-like shapes now have a rotate handle offset from the top-right corner and rotate around their center point
- multi-selection shows a union boundary; dragging a selected member now moves the selected set together
- continuous drawing tools can still point-select an existing object and drag it as a single object without switching to Select
- keyboard/object editing now covers Copy, Paste, Select All, Duplicate, Delete and Alt-drag duplicate; Alt-drag keeps the source object fixed, moves only the new copy and commits the cached preview shapes on pointerup so the copy does not jump back
- Text tool is one-shot: click creates/selects one text box then returns to Select; text shapes support double-click editing through an HTML textarea overlay, and clicking canvas space exits editing while keeping the selected transform controls
- right-click menu first pass exposes Copy, Paste, Duplicate, Layer front/back, Select all and Delete
- Frame now renders as a white mask/container with black outline and label; dragging a shape into a frame sets `parentId=frame.id` and clips the child to the frame bounds. Frame double-click edits the label.
- Sticky now renders closer to a Miro note: author label above, raised shadow, centered note text and double-click body editing. Properties for Sticky are intentionally limited to color and opacity; no fill pattern, dash or width controls.
- Layer actions now support all four operations from Properties, right-click menu and keyboard: bring front `]`, bring forward `Alt/Option+]`, send backward `Alt/Option+[`, send back `[`.
- Text/sticky/frame editing guards canvas shortcuts while typing; Cmd/Ctrl+S is swallowed inside the editor so it does not trigger browser save or canvas commands.
- Eraser now uses geometric distance hit testing for line/arrow/freehand strokes instead of deleting by the whole bbox; the existing eraser silhouette/trail remains.
- Drag and resize now use shared canvas snap settings (`snapAlignment`, `snapDistance`) and render cyan guides for edge/center alignment.
- Snap correction after user review: Alt/Option drag commits from the final preview document to prevent the copied object jumping back; resize snap now only moves the dragged edge/corner so the fixed anchor side does not show the wrong guide; rotate snaps to 15-degree increments and shows a radial guide.
- A Konva shell `selectionchange` guard clears accidental browser text selection while preserving normal textarea/input selection during editing.
- Frame movement now expands the drag set to include direct/nested frame children, so moving a frame carries contained shapes with it.
- Copy/paste/duplicate/Alt-drag clone logic now rewrites cloned `parentId` through an old-id to new-id map; cloned children no longer point at an old frame. Deleting a frame explicitly releases unselected children instead of leaving stale parent ids.
- Draft preview, eraser session, browser selection guard and snapping math are split into focused helper hooks/modules; `useKonvaCanvasInteractions.ts` is back under the 300-line target.
- undo/redo restores shapes plus selection only, so pan/zoom is not part of command history
- create, drag, resize, eraser, Properties style edits, layer actions, duplicate/delete, stress strokes and clear all now create history checkpoints

Not included yet: node cards, image paste/drop, image-to-node/to-canvas conversion, save/history integration, full frame drag-out/nested-frame semantics, real Yjs provider sync and Board route migration.

Explicit Phase 3B follow-ups now tracked in the migration plan:

- multi-selection group rotate from the union boundary around group center
- line/arrow endpoint handles, including endpoint-drag angle/length editing
- deeper frame containment: drag-out affordance, nested-frame policy and export boundary semantics
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

Continue with Phase 3 object editing foundation before any `/boards/[boardId]` migration:

```text
line/arrow midpoint controls
line/arrow endpoint handles
multi-selection rotate
frame/sticky behavior polish
```

After that, continue Phase 3A/3B context-menu depth, eraser segmentation and image/node conversion controls on top of the same command system.
