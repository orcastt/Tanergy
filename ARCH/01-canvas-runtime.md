# Canvas Runtime Architecture Slice

**Updated**: 2026-05-02  
**Canonical source**: `ARCH.md` sections 4.3, 4.3.1, 4.4, 4.9.1, 5.14, 5.15, 9, 11.5.1

## Runtime Stack

```text
/boards/:boardId
  -> CanvasSpike shell
    -> tldraw editor
    -> custom node_card shapes
    -> Node Runtime SVG data edges
    -> fixed left drawing properties drawer
    -> top toolbar + Canvas Settings gear
    -> save/autosave/history orchestration
```

`/spikes/canvas` remains a technical validation entry. `/boards/:boardId` is the product entry and uses the same runtime with product save controls.

## Current Decisions

- tldraw remains the canvas foundation.
- Regular whiteboard arrows remain tldraw arrows.
- AI node data edges use Node Runtime SVG overlay, not tldraw arrow editing handles.
- The left side panel is now only a fixed drawing properties drawer.
- Independent left-side Node Inspector has been removed from the P0 product path.
- AI node cards are self-contained: key parameters, status, run controls and summaries live inside the card.
- Canvas Settings are per-board lightweight JSON in `canvasSettings`.
- Dots/Grid backgrounds render in the tldraw Grid background layer, not as an overlay above drawing elements.
- Smart Drawing is local geometry recognition only; it does not call AI providers.
- LOD state is local UI state and must not enter Board document or future collaboration document.

## Canvas Module Responsibilities

Canvas owns:

- tldraw initialization.
- world coordinate / viewport management.
- pan, zoom, selection and drag.
- images, pen marks, text, rectangles and arrows.
- Merge Capture offscreen rendering.
- Board-mode save/history orchestration hooks.

Canvas does not own:

- Provider API keys.
- Server-side Auth.
- Billing, credits or provider cost logs.
- Object storage internals.

## Smart Drawing

First pass is implemented.

```text
current user draw stroke finalized
  -> decode draw segment points
  -> calculate bbox / length / closure / direction changes
  -> confidence check
  -> high confidence: replace with normal tldraw line/geo shape
  -> low confidence: keep original draw shape
  -> undo/autosave/history use normal tldraw paths
```

Responsibilities:

- Listen only after pointer-up / stroke finalize.
- Recognize approximate line, open curve, ellipse, rectangle and triangle.
- Preserve undo behavior.
- Keep low-confidence doodles unchanged.
- Use Canvas Settings toggle: Smart Drawing on/off.

Non-goals:

- No AI model recognition.
- No handwriting/OCR.
- No semantic flowchart recognition.
- No raw large sample payload in Board document.

## Node Runtime

P0 node types:

- Prompt
- Image Gen
- Image Gen 4
- Analysis
- Image

Node Runtime owns:

- Node registry: `type`, `version`, `displayName`, `ports`, `paramsSchema`, `defaultData`, `renderComponent`, `validate`, `migrate`.
- Port rules and data types.
- Text ports/edges in yellow.
- Image ports/edges in green.
- Dynamic image input ports for Image Gen / Image Gen 4, P0 max 6.
- Runtime edge store: `sourceNode/sourcePort/targetNode/targetPort/dataType`.
- Fan-out from output ports.
- Single upstream for normal input ports.
- Illegal edge rejection.
- Edge disconnect affordance.
- Runtime summary: status, run id, asset ids and short cost/error hints.
- Node version migration.

Node Runtime does not own:

- Complex workflow engine.
- Provider keys.
- Billing final writes.
- Base64 images, raw provider responses, long logs or long chat history.

## Node Inspector Removal Rule

Do not reintroduce a persistent left-side Node Inspector for P0.

If a future node gains too many parameters:

1. Prefer compact node-card controls.
2. Use node-card collapsible sections.
3. Use a dedicated modal or popover for that node.
4. Only reconsider persistent inspector if product direction explicitly changes.

## Canvas Properties / Node Controls

The fixed left drawer edits ordinary drawing objects:

- stroke
- fill
- line width
- dash
- arrow endings
- font
- opacity
- layer
- alignment

When a node card is selected, the drawer remains in ordinary empty state. Node parameters, model choices, status, run controls and short summaries stay inside the node card.

## Document Payload Contract

Board document may contain:

- lightweight shapes and assets metadata needed to restore the Board.
- runtime node positions, dimensions, versions, ports and edges.
- short params like count, quality, aspect ratio or selected model id.
- runtime summaries like status, last run id and result asset ids.
- `canvasSettings` with small display preferences.
- camera / viewport restore data.

Board document must not contain:

- Base64 image payloads.
- `data:` or `blob:` image references.
- provider raw responses.
- full API logs.
- provider keys or billing truth.
- long analysis text or large chat histories.

## Canvas Settings Acceptance

- Gear button opens the compact settings panel from the top toolbar.
- Dots/Grid/Solid, Background Color, Pattern Color and Spacing are visible.
- Dot/grid pattern is very subtle and behind all drawing elements.
- Settings persist with the board and restore through Board History.
- Snap strength maps to tldraw snapping behavior where available.
- Smart Drawing toggle must not change persistence boundaries.

## Important Files

| Area | Files |
| --- | --- |
| Canvas shell | `apps/web/src/components/canvas/CanvasSpike.tsx` |
| Toolbar | `CanvasSpikeToolbar.tsx`, `CanvasToolbarPrimaryTools.tsx`, `CanvasToolbarSettingsButton.tsx` |
| Drawing properties | `CanvasSpikeStylePanel.tsx`, `CanvasStylePanelGroups.tsx`, `CanvasStylePanelSelectionActions.tsx` |
| Settings | `CanvasSettingsPanel.tsx`, `features/canvas-settings/canvasSettingsStore.ts` |
| Background pattern | `CanvasGrid.tsx`, `app/styles/canvas-shell.css` |
| Smart Drawing | `useSmartDrawing.ts`, `features/smart-drawing/` |
| Node cards | `components/nodes/NodeCardContent.tsx`, `features/node-runtime/registry.ts` |

## Quick Checks

- Select a node: no Node Inspector appears; left drawer remains drawing-properties empty state.
- Select a rectangle/arrow/text/image: left drawer shows style controls.
- Switch Dots/Grid/Solid: background changes behind content only.
- Draw with Smart Drawing on: high-confidence strokes become normal shapes, low-confidence strokes stay draw shapes.
- Save/refresh/History restore keeps fitted shapes as normal tldraw shapes.
