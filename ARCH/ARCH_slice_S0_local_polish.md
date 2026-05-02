# ARCH Slice S0: Local Product Polish

**Updated**: 2026-05-02
**Mode**: Fast UI polish unless persistence/API/Auth contracts change.

## Scope

Local UI and canvas productization while external staging resources are not ready.

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
- Captured Board thumbnails and manual Refresh preview.
- Per-board Canvas Settings: subtle dots/grid/solid backgrounds, spacing, snap, zoom.
- Smart Drawing: line/rectangle/ellipse/triangle/doodle and immediate undo browser smoke passed.
- Long-session Board autosave / History browser regression passed: sequential autosave, debounced autosave, manual Snapshot, Cmd/Ctrl+S, reload, restore and filters.
- Independent Node Inspector removed from P0 path; node controls stay inside node cards.

## Current Progress

| Track | Progress |
| --- | ---: |
| Product Shell | 90% |
| Board Save UX | 92% |
| Board History | 94% |
| Canvas Settings | 92% |
| Board Management | 86% |
| Captured Thumbnail | 85% |
| Smart Drawing | 82% |

## Remaining Local Work

1. Smart Drawing threshold tuning.
2. i18n/status polish.
3. More realistic empty/error states for mocked production surfaces.

## Key Files

| Area | Files |
| --- | --- |
| Canvas shell | `apps/web/src/components/canvas/CanvasSpike.tsx` |
| Save/history | `CanvasBoardSaveAudit.tsx`, `useBoardSaveLifecycle.ts`, `useBoardSnapshots.ts`, `CanvasBoardHistoryPanel.tsx` |
| Canvas settings | `CanvasSettingsPanel.tsx`, `CanvasGrid.tsx`, `features/canvas-settings/canvasSettingsStore.ts` |
| Smart Drawing | `useSmartDrawing.ts`, `apps/web/src/features/smart-drawing/` |
| Workspace | `WorkspaceBoardGallery.tsx`, `WorkspaceBoardItem.tsx`, `WorkspaceBoardPanelHost.tsx` |
| Board management | `BoardManagementPanel.tsx`, `BoardManagementThumbnailSection.tsx`, `BoardManagementMembers.tsx` |

## Do Not Regress

- Keep dots/grid behind drawings, not over canvas elements.
- Keep left property drawer decoupled from mouse operations.
- Do not reintroduce independent Node Inspector.
- Do not store thumbnails or images inside Board/History documents.
