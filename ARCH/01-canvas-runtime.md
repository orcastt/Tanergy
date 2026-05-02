# Canvas Runtime Architecture Slice

**Updated**: 2026-05-02  
**Canonical source**: `ARCH.md` sections 4, 9, 11.5.1

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

## Node Inspector Removal Rule

Do not reintroduce a persistent left-side Node Inspector for P0.

If a future node gains too many parameters:

1. Prefer a compact node-card section.
2. Then use node-card collapsible sections.
3. Then consider a dedicated modal or popover for that node.
4. Only reconsider a persistent inspector if product direction changes explicitly.

## Canvas Settings Acceptance

- Gear button opens the compact settings panel from the top toolbar.
- Dots/Grid/Solid, Background Color, Pattern Color and Spacing are visible.
- Dot/grid pattern is very subtle and behind all drawing elements.
- Settings persist with the board and restore through Board History.

## Quick Checks

- Select a node: no Node Inspector appears; left drawer remains drawing-properties empty state.
- Select a rectangle/arrow/text/image: left drawer shows style controls.
- Switch Dots/Grid/Solid: background changes behind content only.
- Draw with Smart Drawing on: high-confidence strokes become normal shapes, low-confidence strokes stay draw shapes.
