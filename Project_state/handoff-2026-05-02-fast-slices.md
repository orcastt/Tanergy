# Codex Handoff: Fast Slice Context Split

**Date**: 2026-05-02  
**From branch**: `feature/asset-lod-roadmap`  
**Continue on**: `feature/local-polish-fast-slices`  
**Checkpoint commit**: use `git log -1 --oneline` after checkout.

## Why This Handoff Exists

The project context had grown large enough that every small UI change required rereading and synchronizing `project_state.md`, `ARCH.md`, `PRD.md`, `HARNESS.md` and `dev-plans`. This handoff creates shorter indexed context files so future local UI/product polish can move faster without losing the canonical architecture trail.

## What Changed In This Checkpoint

Current code already includes these first passes:

- Board History autosave/manual/keyboard history, filter UI, author display and bucketed retention.
- Board Management metadata panel with title, description, color, thumbnail upload/remove, pin/star/visibility/share/member scaffold.
- Captured Board thumbnail first pass.
- Per-board Canvas Settings with subtle dots/grid/solid backgrounds.
- Smart Drawing first pass.
- Fixed left drawing properties drawer.
- Independent Node Inspector removed from P0 product path.
- Admin S0, AI extension contract and database schema boundaries documented.

This checkpoint adds the context-management split:

- `ARCH/README.md`
- `ARCH/00-current-map.md`
- `ARCH/01-canvas-runtime.md`
- `ARCH/02-board-asset-persistence.md`
- `ARCH/03-ai-node-contract.md`
- `ARCH/04-product-shell-auth-admin-deploy.md`
- `ARCH/05-data-model-and-api.md`
- `ARCH/Slice-S0-local-polish.md`
- `Project_state/README.md`
- `Project_state/00-current-progress.md`
- `Project_state/current-slice.md`
- `Project_state/handoff-2026-05-02-fast-slices.md`

## How To Resume

For small local UI polish, read:

1. `AGENTS.md`
2. `Project_state/current-slice.md`
3. `Project_state/00-current-progress.md`
4. `ARCH/README.md`
5. `ARCH/Slice-S0-local-polish.md`
6. Relevant focused `ARCH/*.md`
7. Active `dev-plans/` plan

For architecture/API/Auth/AI/deploy/database/Admin changes, read the full canonical set:

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `HARNESS.md`
5. `dev-plans/README.md`

## Recommended Next Work

If no external resources are ready:

1. Smart Drawing browser smoke and threshold tuning.
2. Long-session Board autosave/History regression.
3. i18n/status polish.

If external resources are ready:

1. Staging Postgres migration smoke.
2. R2/S3-compatible Asset upload/read smoke.
3. FastAPI CORS/domain smoke.
4. Web `NEXT_PUBLIC_API_BASE_URL` staging wiring.

## Validation To Run After Resuming

Use the full gate when touching both frontend and API:

```bash
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api services/api/migrations
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

If `npm -C apps/web run build` mutates `apps/web/next-env.d.ts`, restore the dev route import expected by the repo before committing.

## Hard Boundaries

- Do not read or modify `legacy/old-tangent-desktop-2026-04-29/` unless the user explicitly asks.
- Do not persist `data:`, `blob:` or Base64 images in Board or History documents.
- Do not reintroduce independent left Node Inspector for P0.
- Do not build fake production Admin/Billing/Team behavior from frontend mock state.
- Real AI provider work waits for server-owned keys, Auth boundary, AiRun/API call logging, cost guard and Asset-backed outputs.
