# Project State Slice S1X: Canvas Engine Migration

**Status**: First Konva handfeel route ready for user review.
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

Included now: full-screen Konva stage, faint dot background, top tool bar, hand/select/draw/basic shapes/line/arrow/text/eraser, minimap with zoom controls, Yjs document initialization and diagnostics.

Not included yet: node cards, image paste/drop, image-to-node/to-canvas conversion, save/history integration, right-click menu, real Yjs provider sync and Board route migration.

## User Review Notes

- Continuous drawing is preferred: left-click creates one object and keeps the same tool active until the user chooses another tool. Do not regress to requiring right-click lock for normal repeated drawing.
- Properties remains required: final engine needs a fixed properties panel for style changes across stroke/fill/width/dash/opacity/layer/actions.
- 1,000 stroke pan/zoom initially felt a bit laggy; first optimization memoizes shape rendering and caps minimap item rendering, but Phase 1A still needs deeper hot-path work before Board migration.
- Freehand smoothing should stay light in normal Draw mode. Current preference is architect-pen style: slow strokes can feel slightly inkier, fast strokes lighter, with subtle taper; stronger Smart Drawing recognition belongs in a separate mode.
- Canvas navigation shortcuts are part of the handfeel contract: `V` switches to Select, holding `Space` temporarily pans without changing the active tool, and middle-mouse drag pans the canvas.
- Canvas opens in Select by default. Continuous drawing starts only after the user explicitly chooses Draw/shape/line/arrow.
- `Escape` exits continuous drawing and returns to Select. Cloud visual path should fill its bbox so selection handles hug the cloud boundary more like tldraw.

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

Ask the user to hand-test `/spikes/konva-canvas`. If the freehand/pan/zoom baseline is acceptable, continue Phase 1 toward better selection/resize and image paste/drop before any `/boards/[boardId]` migration.
