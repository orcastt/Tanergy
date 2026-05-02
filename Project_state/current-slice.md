# Current Slice Context

**Updated**: 2026-05-02  
**Branch at checkpoint time**: `feature/asset-lod-roadmap`  
**Next working branch**: `feature/local-polish-fast-slices`

## Current State

The app is in a local P0 polish phase after Slice E persistence foundations.

Implemented first passes:

- Product Shell route semantics and 5-tab top navigation.
- `/workspaces` Board gallery/list with metadata actions, Load more and Board Manage.
- `/boards/:boardId` autosave, dirty warnings, title sync and Board History.
- Board History autosave/manual/keyboard timeline with filters and author display.
- Board Management metadata: description, card color, thumbnail URL/upload/remove, pin/star/visibility/share/member scaffold.
- Save-time captured Board thumbnail when no custom thumbnail exists.
- Per-board Canvas Settings with subtle dots/grid/solid backgrounds.
- Smart Drawing local recognizer first pass.
- Independent left Node Inspector removed. Node controls stay inside node cards.
- Auth scaffold, AI contract scaffold, Alembic scaffold and Admin S0 planning are documented boundaries, not production-complete features.

## Current Architecture Split

Use these short context files before opening the large root docs:

- `ARCH/README.md`
- `ARCH/00-current-map.md`
- `ARCH/Slice-S0-local-polish.md`
- `ARCH/01-canvas-runtime.md`
- `ARCH/02-board-asset-persistence.md`
- `ARCH/03-ai-node-contract.md`
- `ARCH/04-product-shell-auth-admin-deploy.md`

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
- relevant `ARCH/` and `dev-plans/` files

## Next Recommended Work

If external resources are not ready:

1. Manual thumbnail refresh for Board cards.
2. History entry thumbnail preview.
3. Smart Drawing browser smoke and threshold tuning.
4. Long-session autosave/history regression.
5. i18n/status polish.

If external resources are ready:

1. Staging Postgres migration smoke.
2. R2/S3-compatible Asset upload/read smoke.
3. FastAPI CORS/domain smoke.
4. Web `NEXT_PUBLIC_API_BASE_URL` staging wiring.

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
