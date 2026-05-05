# PRD Slice S1X: Canvas Engine Migration

**Status**: Active risk-mitigation spike; isolated Konva route has Phase 4 runtimeGraph cleanup first pass after accepted handfeel/properties/object-editing baselines.
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
- Drawing tools stay active for continuous drawing until the user switches tool or presses Escape. Draw is the only non-selecting draw-over-object tool. Other non-Select tools can click an existing object to select it for Properties/resize editing without switching the active tool, so clicking blank canvas afterward continues the previous drawing tool.
- Pan/zoom should stay responsive with the 1k strokes stress button.
- Properties stays fixed on the left and edits selected-shape or next-shape Stroke, opaque Fill, Width, Dash and Opacity.
- Selected shapes support basic Layer order, Duplicate and Delete actions.
- Solid and pattern fill are opaque lighter tints of the selected stroke color; pattern fill is crisp enough for product review.
- Phase 3.1 adds first-pass box select, single-shape resize handles, rectangle-like edge resize and undo/redo for shape/selection changes without undoing camera pan/zoom.
- Standalone Text resizes its font when the text box is scaled; text edit commits and font-size Properties changes auto-fit the text box height to the current content.
- Frame is a white clipped container with editable label; dragged-in shapes are masked by its bounds.
- Sticky note shows an author label, raised shadow and centered editable text; Properties expose note color and opacity only, not pattern/dash/width.
- Basic closed shapes support double-click centered text labels that move, resize, rotate and inherit stroke/opacity with the shape container; Sticky note editing also starts centered.
- Phase 3 object editing now includes four-way layer order from Properties/right-click/keyboard, Alt/Option one-step layer shortcuts, text editing that does not trigger canvas/browser shortcuts, geometric eraser hits for line/arrow/freehand, visible snap guides tied to snap settings for drag/copy/resize/rotate, and a browser-selection guard for accidental blue text selection.
- Frame drag carries contained shapes, and clone operations rewrite frame `parentId` relationships so copies do not stay attached to old containers.
- Right-click menu Phase 3A exposes professional canvas submenus for Edit, Arrange, Reorder, Copy as and Export as. Cut, Group/Ungroup, Lock/Unlock, multi-selection Align/Distribute/Stretch/Flip, row/column tidy, Copy as PNG/SVG, Export as PNG/SVG and Move to page are functional first passes; transparent-background toggles remain disabled until their product contract is implemented.
- Pasted images from browser copy or OS screenshot clipboard create real canvas image shapes through the Asset API, with no Base64 stored in the canvas document. Image shapes render with zoom-based thumbnail/original LOD and reuse the same resize, rotate, copy and Alt-drag interactions as other box-like elements.
- Properties now exposes multi-selection Align, Layer and Actions grids plus first-pass font size/text alignment controls for text, sticky notes and basic shape labels.
- Konva Image Node first pass supports Canvas Image → Image Node, Image Node → Canvas Image and Capture selection → Image Node. Canvas image conversion writes asset preview URLs and keeps the node title as `Image`; selections containing one or more canvas images show Convert and create one Image Node beside each image, while non-image markup in the same selection is ignored by Convert and remains available to Capture. Cropped canvas images carry crop-ratio metadata into Image Nodes and back to Canvas instead of regenerating raw image payloads. Image Node cards expose `To Canvas` in the header instead of a floating toolbar action. Capture uses explicit selectedIds export bounds, uploads the generated PNG with `origin=merge_capture`, places the Image Node below the selection and keeps Board documents free of data/blob/Base64 payloads. Capture/Copy/Export PNG render through an offscreen Konva clone so the visible canvas does not flash, and selected images are rehydrated from original asset URLs for export quality even when the visible view is using low-zoom thumbnails. `merge_capture` Image Node previews above 50% zoom should prefer the original capture asset so mid-zoom captures such as 57% do not look blurry. Right-click Copy/Export as SVG has a limited first-pass vector serializer that renders image/image-node previews by asset URL rather than embedding raw bytes.
- Phase 4 Node/Port/Edge first pass lets users create Prompt, Image, Image Gen, Image Gen 4 and Analysis node cards from a single toolbar Node dropdown or by double-clicking blank canvas to open the node panel above the cursor. Output ports can be dragged to compatible input ports, creating typed runtime edges that render separately from ordinary visual arrows/lines. Outputs can feed multiple downstream inputs, while each input accepts only one upstream edge. Selecting an edge shows a near-input `-` disconnect control.
- Multi-selected Image Nodes support batch connection: dragging from any selected `image_out` previews all selected image outputs as one bundle, and dropping on an Image Gen/Image Gen 4 image input creates consecutive image input edges in one action while expanding the target input ports.
- Node cards are intentionally compact: port types are shown on hover as black text/image tooltips instead of permanent internal labels; Prompt and Analysis preset text boxes wrap and scroll long content inside the node without a global overlay, so normal canvas z-order still decides whether later lines/shapes cover the node; text is then edited in-place through a focused textarea overlay; when nodes are resized smaller than their default card size, the internal title, controls, text boxes and previews scale together inside a clipped card body instead of overflowing; Image Gen/Image Gen 4 expose first-pass model, aspect ratio and resolution controls; Image Gen 4 exposes four image outputs. Image Gen/Image Gen 4 dynamically add image input ports as image references are connected and shrink them when disconnected.
- Runtime graph behavior is now centralized outside the Konva renderer: edge reconnect/input uniqueness, output fan-out, dynamic image input counts and Image Node upstream preview mirroring share one runtimeGraph contract before real AiRun wiring starts.
- Analysis/Image Gen/Image Gen 4 Run has a mock runtime path in the Konva route: it reads upstream prompt/image refs, creates mock AiRun records, generates preview image assets for Image Gen outputs, shows generated previews in the node, and lets downstream Image Nodes display those outputs through runtime edges. This remains a mock adapter until the server-side AiRun provider contract is connected.
- Generated output previews should resize with their node containers, and chained Image Nodes should clear stale previews when an upstream generated/image edge is disconnected.
- Selected runtime edges can be disconnected by the near-input `-` control, Delete/Backspace or Cut, and downstream image mirrors should update immediately.
- Node port connection should feel generous and obvious: compatible input ports have a larger hit range, the preview endpoint snaps to the port center when in range, and a visible target halo confirms the connection target. Node cards are not drawing shapes and do not expose rotate/flip behavior.
- Image Node can import local files by double-click upload or drag/drop, previews images with contain-fit, and can mirror an upstream Image Node through a runtime image edge. Single canvas image selection exposes a Crop edit mode from the floating selection toolbar; clicking Crop shows resize-style purple edge handles plus corner dots, and dragging an edge trims the image without auto-stretching the remaining pixels into the old bounds. The node palette and AI-facing metadata are registry-driven so future AI text optimization, multi-text merge, perspective image generation and similar nodes can be added without redesigning the canvas core.
- Clipboard image paste targets a selected or pointer-hit Image Node before falling back to placing a canvas image, so users can replace an Image Node's asset without creating extra canvas clutter.
- Drawing tools can draw over canvas images and node cards without those objects stealing drag focus, while node ports remain usable for runtime edge drag/fan-out. Single selected nodes do not show image conversion/capture actions; those actions are reserved for image selection or future multi-selection flows. Analysis/Image Gen/Image Gen 4 show a Run button that toggles to Stop while running.
- Phase 4A image operations add selected-image actions for `Remove BG` and `Object Cutout`. `Remove BG` uses a server-side optional `rembg` path and creates a new `origin=background_removal` transparent PNG asset placed slightly down-right from the source image, preserving the original and supporting undo. `Object Cutout` is visible as a disabled first-pass affordance while the future point/box prompt with `facebookresearch/segment-anything` is designed.
- Selection conversion/export/image-operation failures should be visible near the action surface; Capture, Copy/Export and Remove BG now show a short inline toolbar error instead of failing silently.
- Browser-copied remote image URLs should be imported through the server Asset API before placement so canvas capture/export does not depend on browser CORS behavior. Board thumbnails use `origin=board_thumbnail`; user captures and cutouts use separate origins.
- Frame containment first pass supports dragging children out of frames and intentionally blocks nested frame parenting for now.
- Phase 5A adds a first-pass Konva persistence contract: Konva documents save as a v2 `{ renderer: 'konva', version: 2, activePageId, pages, canvasDocument }` envelope through the existing Board API, restore the active page's shapes/images/nodes/runtime edges/camera/settings, create board thumbnails from an offscreen Konva capture, and participate in Save now, autosave, Cmd/Ctrl+S, Snapshot/History/Clean and before-unload warning flows. Users can switch pages, create blank pages, double-click rename pages, delete pages, reorder pages and identify pages by lightweight geometry thumbnails from the right-side collapsible Konva Pages drawer. Board History entries show the active Page title rather than repeating the Board title. Right-click Move to page moves the current selection to another page, expands grouped members/frame children as one move scope, preserves runtime edges only when both endpoints move together and drops cross-page edges for now. True rendered page-thumbnail assets, page duplicate, Move selection to new page and page-scoped collaboration remain follow-ups. The Board guard understands the v2 envelope, pages contract and runtime edge refs before persistence. The formal `/boards/[boardId]` route now has a dual-engine first pass for development/migration safety, but production defaults to Konva-only: tldraw v1 documents are blocked unless the explicit reference flag is enabled, unknown saved documents are blocked instead of auto-overwritten, and new Boards default to Konva.
- Legacy tldraw v1 Boards now have explicit copy tooling rather than implicit conversion: Workspace legacy Board menus and the legacy route state can create a new Konva v2 copy, then open that copy. The original v1 Board remains untouched so migration can be inspected before any cleanup.

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
