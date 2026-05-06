# ARCH Slice S0: Local Product Polish

**Updated**: 2026-05-02
**Mode**: Accepted local polish; regression fixes only unless persistence/API/Auth contracts change.

## Scope

Local UI and canvas productization while external staging resources are not ready. S0 is accepted for P0 alpha: the header, board switcher, fixed Properties drawer, floating selection toolbar, Canvas Settings and Smart Drawing are good enough to stop polish work unless a new hand-smoke bug appears.

## Current Architecture

```text
/workspaces
  -> Board summary list
  -> gallery/list cards
  -> Board Management metadata panel
  -> open /boards/:boardId

/boards/:boardId
  -> CanvasSpike
  -> tldraw editor
  -> Board save lifecycle
  -> Board History panel
  -> Canvas Settings panel
  -> Smart Drawing hook
```

## Implemented

- Product Shell route semantics and five-tab top nav.
- Workspace Board gallery/list with search, sort, Load more and metadata actions.
- Board save lifecycle: autosave, dirty/back warning, title sync, save indicator.
- Board History: autosave/manual/keyboard timeline, filters, author display, preview thumbnails, restore.
- Board Management metadata: title, description, card color, thumbnail URL/upload/remove, pin/star/visibility/share/member scaffold.
- Board Management panel polish: wider settings-like layout, regular-weight typography, reduced helper copy, leading line icons in board card action menus.
- Captured Board thumbnails and manual Refresh preview.
- Per-board Canvas Settings: subtle dots/grid/solid backgrounds rendered behind drawings, spacing, snap, zoom.
- Canvas header and controls: logo/home link, Workspace return, recent-board switcher, new-board action, stable Properties drawer, floating selection toolbar, distinct Width/Dash icons and fixed black tooltip layer.
- Smart Drawing: line/rectangle/ellipse/triangle/doodle and immediate undo browser smoke passed; curve tolerance is accepted for local P0 alpha.
- Long-session Board autosave / History browser regression passed: sequential autosave, debounced autosave, manual Snapshot, Cmd/Ctrl+S, reload, restore and filters.
- Independent Node Inspector removed from P0 path; node controls stay inside node cards.

## Current Progress

| Track | Progress |
| --- | ---: |
| Product Shell | 95% |
| Workspace Board UI | 93% |
| Board Save UX | 94% |
| Board History | 95% |
| Canvas Settings | 96% |
| Board Management | 93% |
| Canvas Controls | 96% |
| Captured Thumbnail | 91% |
| Smart Drawing | 95% |

## Remaining Local Work

1. Final browser smoke for Workspace menu, Board Panel, canvas header/switcher, floating selection toolbar, Properties tooltips and Canvas Settings backgrounds.
2. Checkpoint current S0 polish.
3. S0 receives regression fixes only.
4. New architecture work moves to S1: staging Postgres/R2/domain smoke, Auth ownership boundary and Auth-backed Board CRUD.

## Key Files

| Area | Files |
| --- | --- |
| Canvas shell | `apps/web/src/components/canvas/CanvasSpike.tsx` |
| Save/history | `CanvasBoardSaveAudit.tsx`, `useBoardSaveLifecycle.ts`, `useBoardSnapshots.ts`, `CanvasBoardHistoryPanel.tsx` |
| Canvas settings | `CanvasSettingsPanel.tsx`, `CanvasGrid.tsx`, `features/canvas-settings/canvasSettingsStore.ts` |
| Canvas controls | `CanvasSpikeToolbar.tsx`, `CanvasSpikeStylePanel.tsx`, `CanvasSelectionToolbar.tsx`, `CanvasTooltipLayer.tsx`, `CanvasBoardSwitcher.tsx` |
| Smart Drawing | `useSmartDrawing.ts`, `apps/web/src/features/smart-drawing/` |
| Workspace | `WorkspaceBoardGallery.tsx`, `WorkspaceBoardItem.tsx`, `WorkspaceBoardPanelHost.tsx` |
| Board management | `BoardManagementPanel.tsx`, `BoardManagementThumbnailSection.tsx`, `BoardManagementMembers.tsx`, `WorkspaceBoardMenuAction.tsx` |

## Do Not Regress

- Keep dots/grid behind drawings, not over canvas elements.
- Keep left property drawer decoupled from mouse operations.
- Keep the floating selection toolbar above selected canvas objects; it owns quick image-node conversion, merge capture and alignment.
- Do not reintroduce independent Node Inspector.
- Do not store thumbnails or images inside Board/History documents.
