# Current Slice Context

**Updated**: 2026-05-02  
**Working branch**: `feature/local-polish-fast-slices`
**Latest pushed stable checkpoint before current uncommitted work**: `847ed3c checkpoint: canvas polish and context indexes`

## Current Mode

Local P0 polish. Use `Fast UI polish` for UI/layout/browser-smoke fixes. Use `Architecture slice` for persistence, API, Auth, AI, Admin, Billing, Deploy, collaboration or schema changes.

The latest uncommitted work includes:

- Board save status bar `Refresh preview`.
- History entry thumbnail previews and Workspace card preview smoke passed after fixing Next local snapshot `thumbnailUrl` forwarding.
- Optional `thumbnailUrl` in Board History create/list contract.
- Expanded `ARCH/` and `Project_state/` short docs so they mirror root diagrams/details.

## Current State

Implemented first passes:

- Product Shell route semantics and 5-tab top navigation.
- `/workspaces` Board gallery/list with metadata actions, Load more and Board Manage.
- `/boards/:boardId` autosave, dirty warnings, title sync and Board History.
- Board History autosave/manual/keyboard timeline with filters, author display and preview thumbnails.
- Board Management metadata: description, card color, thumbnail URL/upload/remove, pin/star/visibility/share/member scaffold.
- Save-time captured Board thumbnail, manual Refresh preview and browser-smoked History thumbnails.
- Per-board Canvas Settings with subtle dots/grid/solid backgrounds.
- Smart Drawing local recognizer first pass.
- Independent left Node Inspector removed. Node controls stay inside node cards.
- Auth scaffold, AI contract scaffold, Alembic scaffold and Admin S0 planning are documented boundaries, not production-complete features.

## Short Context Files

Read these before opening the large root docs:

- `Project_state/00-current-progress.md`
- `ARCH/README.md`
- `ARCH/00-current-map.md`
- `ARCH/Slice-S0-local-polish.md`
- `ARCH/01-canvas-runtime.md`
- `ARCH/02-board-asset-persistence.md`
- `ARCH/03-ai-node-contract.md`
- `ARCH/04-product-shell-auth-admin-deploy.md`
- `ARCH/05-data-model-and-api.md`

Root `ARCH.md`, `PRD.md`, `HARNESS.md` and `project_state.md` remain canonical for architecture or product boundary changes.

## Fast UI Polish Mode

Allowed for small local UI fixes:

- layout
- spacing
- responsive polish
- text/status polish
- menu behavior
- visual badge/icon polish
- browser smoke follow-up

Docs to update:

- `Project_state/current-slice.md`
- `Project_state/00-current-progress.md` if progress/status changes
- active `dev-plans/` plan if backlog status changes
- relevant `ARCH/Slice-*.md` only if acceptance/progress changes

## Architecture Slice Mode

Use full canonical docs when touching:

- persistence, DB, migration or API contracts
- Auth/session/permissions/Admin
- AI Model Registry, AiRun, provider or cost logging
- billing/credits/subscriptions
- collaboration
- deployment/staging/secrets

Docs to update:

- `project_state.md`
- `PRD.md`
- `ARCH.md`
- `HARNESS.md`
- `AGENTS.md` if workflow rules change
- relevant `ARCH/` files
- relevant `Project_state/` files
- relevant `dev-plans/` files

## Current Progress

| Track | Progress | Notes |
| --- | ---: | --- |
| Local Product Shell | 90% | Local route shells and navigation are coherent. |
| Board Save UX | 90% | Autosave/back warning/title sync first pass stable. |
| Board History | 92% | Filters, author display and preview thumbnails exist. |
| Canvas Settings | 92% | Per-board subtle backgrounds and settings panel exist. |
| Board Management | 86% | Metadata/member scaffold first pass exists. |
| Captured Thumbnail | 85% | Refresh preview, Workspace card preview and History thumbnails passed browser smoke. |
| Smart Drawing | 60% | Browser tuning still pending. |

## Next Recommended Work

If external resources are not ready:

1. Smart Drawing browser smoke and threshold tuning.
2. Long-session autosave/history regression.
3. i18n/status polish.

If external resources are ready:

1. Staging Postgres migration smoke.
2. R2/S3-compatible Asset upload/read smoke.
3. FastAPI CORS/domain smoke.
4. Web `NEXT_PUBLIC_API_BASE_URL` staging wiring.

## Current Key Files

| Area | Files |
| --- | --- |
| Canvas shell | `apps/web/src/components/canvas/CanvasSpike.tsx` |
| Board save/history | `CanvasBoardSaveAudit.tsx`, `useBoardSaveLifecycle.ts`, `useBoardSnapshots.ts`, `CanvasBoardHistoryPanel.tsx` |
| Canvas settings | `CanvasSettingsPanel.tsx`, `CanvasGrid.tsx`, `features/canvas-settings/canvasSettingsStore.ts` |
| Smart Drawing | `useSmartDrawing.ts`, `apps/web/src/features/smart-drawing/` |
| Workspace gallery | `WorkspaceBoardGallery.tsx`, `WorkspaceBoardItem.tsx`, `WorkspaceBoardPanelHost.tsx` |
| Board management | `BoardManagementPanel.tsx`, `BoardManagementThumbnailSection.tsx`, `BoardManagementMembers.tsx` |
| Board persistence | `apps/web/src/features/boards/`, `apps/web/src/app/api/boards/`, `services/api/tangent_api/storage/` |
| API schemas/tests | `services/api/tangent_api/board_schemas.py`, `services/api/tests/test_board_persistence_contracts.py` |

## Validation Commands

Frontend:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
```

Backend/API:

```bash
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api services/api/migrations
```

Always:

```bash
git diff --check
```

## Do Not Regress

- Do not persist `data:`, `blob:` or Base64 image payloads in Board or History documents.
- Do not reintroduce independent left Node Inspector for P0.
- Do not treat mock Auth, Team, Billing, Admin or AI provider surfaces as production-complete.
- Do not read or modify `legacy/old-tangent-desktop-2026-04-29/` unless the user explicitly asks.
