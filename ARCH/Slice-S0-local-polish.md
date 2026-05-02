# S0 Local Polish Slice

**Updated**: 2026-05-02  
**Canonical source**: root `ARCH.md`; current short state lives in `Project_state/current-slice.md`.

This slice is the active local-productization lane while external staging resources are not ready.

## Goal

Turn the local app into a coherent P0 alpha surface without pretending production Auth, billing, team permissions, real AI providers or collaboration are finished.

## Current Progress

| Area | Progress | Current state |
| --- | ---: | --- |
| Product Shell routes | 90% | `/home`, `/workspaces`, `/collections`, `/account`, `/settings`, `/team`, `/billing` render with clean semantics. |
| Workspace Board gallery/list | 88% | Gallery/list, search, sort, Load more, create/open/rename/copy/delete and metadata controls exist. |
| Board Management Panel | 86% | Settings-like panel with title, description, color, thumbnail, pin/star/visibility/share/member scaffold. |
| Board Canvas save UX | 90% | Autosave, title sync, dirty/back warnings and save indicator are in place. |
| Board History | 90% | Autosave/manual/keyboard history, filters, author display and restore are in place. |
| Canvas Settings | 92% | Compact settings panel and subtle board-level dots/grid/solid backgrounds are in place. |
| Captured thumbnails | 65% | Save-time captured preview works when no custom thumbnail exists. |
| Smart Drawing | 60% | Local recognizer and hook are implemented; browser tuning remains. |
| Node Inspector removal | 100% | Independent left Node Inspector is removed from P0 product path. |

Percentages mean distance to local P0 alpha usability, not final commercial completeness.

## Current Files To Know

| Area | Files |
| --- | --- |
| Canvas shell | `apps/web/src/components/canvas/CanvasSpike.tsx` |
| Board save/history | `CanvasBoardSaveAudit.tsx`, `useBoardSaveLifecycle.ts`, `CanvasBoardHistoryPanel.tsx` |
| Canvas settings | `CanvasSettingsPanel.tsx`, `CanvasGrid.tsx`, `features/canvas-settings/canvasSettingsStore.ts` |
| Smart Drawing | `useSmartDrawing.ts`, `apps/web/src/features/smart-drawing/` |
| Workspace gallery | `WorkspaceBoardGallery.tsx`, `WorkspaceBoardItem.tsx`, `WorkspaceBoardPanelHost.tsx` |
| Board management | `BoardManagementPanel.tsx`, `BoardManagementThumbnailSection.tsx`, `BoardManagementMembers.tsx` |
| Board persistence | `apps/web/src/features/boards/`, `apps/web/src/app/api/boards/`, `services/api/tangent_api/storage/` |

## Fast UI Polish Rules

Use this mode for small visual/layout/product behavior fixes that do not change persistence, API, permissions, Auth, AI, deployment or pricing.

Required docs:

1. `Project_state/current-slice.md`
2. This file if progress or acceptance changes
3. Active `dev-plans/` file if the item affects backlog status

Root `ARCH.md` / `PRD.md` / `HARNESS.md` do not need to change for every small CSS/layout fix.

## Architecture Slice Rules

Switch out of fast UI polish and update root canonical docs when a change touches:

- Board/Asset/History data model
- API routes or storage adapters
- Auth/session/permissions/Admin
- AI provider, Model Registry, AiRun or cost records
- Billing/credits/subscriptions
- Collaboration
- Deploy/staging/secrets
- Long-lived product policy

## Next Local Candidates

1. Manual thumbnail refresh for Board cards.
2. History entry thumbnail preview.
3. Smart Drawing browser smoke and threshold tuning.
4. Long-session autosave/history regression.
5. i18n/status polish for visible product strings.

## Quick Validation

- `/workspaces`: gallery/list, search, sort, Load more, card menu outside-click close, pin/visibility badges.
- Board Manage: Copy link toast, Save visible, thumbnail upload/remove/default, owner/admin edit controls, editor/viewer disabled state.
- `/boards/:boardId`: autosave, Cmd/Ctrl+S history, Snapshot history, Restore marks dirty then autosaves.
- Canvas Settings: dots/grid/solid are behind drawings and subtle.
- Node selection: no independent Node Inspector appears.
