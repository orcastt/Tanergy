# PRD Slice S1X: Canvas Engine Migration

**Status**: Active risk-mitigation spike; isolated Konva route has Phase 3 object editing foundation in progress after accepted handfeel/properties baselines.
**Product reason**: The current public staging canvas depends on tldraw, which requires a production license. TANGENT needs a long-term canvas path that can support commercial use and collaboration without a paid canvas SDK lock-in.

## Product Goal

Replace tldraw as the long-term runtime engine while preserving the current TANGENT canvas experience as the reference.

This is not a visual redesign. Users should still feel they are using the same product:

- clean whiteboard surface
- smooth drawing
- image/prompt/AI node workflow
- node ports and edges
- Board save/autosave/history
- Board settings and thumbnails
- future collaboration-ready document model

## User-Facing Acceptance

The first accepted prototype must let a user:

1. Open a Board-like canvas. Current route: `/spikes/konva-canvas`.
2. Pan and zoom smoothly.
3. Draw freehand lines that feel close to current tldraw.
4. Create basic shapes, frame, sticky note, line/arrow, text and use a first-pass eraser.
5. Add prompt/image/AI node cards.
6. Connect node ports with typed edges.
7. Save and reload the Board document.
8. Create a History snapshot and restore it.
9. See another browser session's cursor and edits in the collaboration prototype.

Current accepted subset:

- `/spikes/konva-canvas` opens in Select mode.
- Drawing tools stay active for continuous drawing until the user switches tool or presses Escape.
- Pan/zoom should stay responsive with the 1k strokes stress button.
- Properties stays fixed on the left and edits selected-shape or next-shape Stroke, opaque Fill, Width, Dash and Opacity.
- Selected shapes support basic Layer order, Duplicate and Delete actions.
- Solid and pattern fill are opaque lighter tints of the selected stroke color; pattern fill is crisp enough for product review.
- Phase 3.1 adds first-pass box select, single-shape resize handles and undo/redo for shape/selection changes without undoing camera pan/zoom.
- Frame is a white clipped container with editable label; dragged-in shapes are masked by its bounds.
- Sticky note shows an author label, raised shadow and centered editable text; Properties expose note color and opacity only, not pattern/dash/width.
- Basic closed shapes support double-click centered text labels that move, resize, rotate and inherit stroke/opacity with the shape container; Sticky note editing also starts centered.
- Phase 3 object editing now includes four-way layer order from Properties/right-click/keyboard, Alt/Option one-step layer shortcuts, text editing that does not trigger canvas/browser shortcuts, geometric eraser hits for line/arrow/freehand, visible snap guides tied to snap settings for drag/copy/resize/rotate, and a browser-selection guard for accidental blue text selection.
- Frame drag carries contained shapes, and clone operations rewrite frame `parentId` relationships so copies do not stay attached to old containers.
- Right-click menu Phase 3A first batch exposes professional canvas submenus for Edit, Arrange, Reorder, Copy as and Export as. Cut and multi-selection Align are functional; group/lock/page/export entries remain disabled until their product contracts are implemented.

## Handfeel Acceptance

The migration should not be accepted just because features technically work.

Drawing must pass:

- slow strokes do not jitter
- fast strokes do not break
- curves remain smooth
- zoomed drawing lands under the cursor
- pan/zoom feels stable
- 1,000 strokes remain usable
- toolbar/properties UI does not flicker during drawing

Target: user accepts the Konva prototype as at least 80% of current tldraw feel before node/runtime migration proceeds.

## Product Non-Goals

- Do not redesign the canvas UI during this slice.
- Do not ship full Miro-scale collaboration in S1X.
- Do not remove existing Board/Workspace/History APIs.
- Do not replace the whole app shell.
- Do not add a different paid canvas SDK as the core dependency.

## Reference Features To Preserve

- Workspace Board entry and Board route.
- Canvas header with Workspace back, logo/home and Board switcher.
- Top toolbar with select/hand/shape/frame/sticky/arrow/line/draw/text/eraser.
- Fixed left properties drawer.
- Canvas Settings gear and per-board background/snap options.
- Save now, Snapshot, Refresh preview and History.
- Smart Drawing: line, curve, rectangle, triangle and ellipse recognition.
- Board thumbnails.
- Node types: prompt, image, image_gen, image_gen_4 and analysis.
- Port data types: text and image.
- AI run states: idle, running, succeeded and failed.

## Collaboration Requirement

S1X only proves basic collaboration viability:

- two browser tabs edit the same document
- each tab sees the other's cursor/selection
- offline/reconnect does not corrupt the document
- edits are represented in Yjs or a comparable MIT-compatible CRDT layer

Full permission, role, audit and large-room collaboration remain S4, but S1X must not choose an engine that blocks S4.

## Success Decision

After S1X:

```text
If Konva + Yjs handfeel is accepted:
  migrate /boards/[boardId] incrementally.

If handfeel is rejected:
  evaluate Excalidraw as the fallback MIT whiteboard engine.

If both fail:
  revisit paid tldraw licensing as a business decision, not a technical default.
```
