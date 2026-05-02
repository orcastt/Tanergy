# Dev Plans Index

**Updated**: 2026-05-02
**Status**: Current planning index for active TANGENT P0 work.

Use this directory as a working plan layer, not as the canonical product or architecture source.

The end-to-end 0-to-1 launch route, sprint breakdown, deployment flow, external resource checklist and rough phase estimates now live in `ARCH.md` sections 11.5-11.7. Keep active slice plans here focused on the next implementation cut.

Product-level P0 scope, per-feature implementation status and Alpha acceptance gaps are now synced in `PRD.md` sections 0, 2, 5 and 9.

Read order for active development:

For fast local UI/product polish:

1. `Project_state/current-slice.md`
2. `Project_state/00-current-progress.md`
3. `ARCH/README.md`
4. Relevant `ARCH/Slice-*.md`
5. This file
6. The active slice plan below

For architecture, API, database, Auth, AI, Admin, Billing, Deploy or collaboration changes:

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `HARNESS.md`
5. This file
6. The active slice plan below

## Active Plans

| File | Status | Use |
| --- | --- | --- |
| `../ARCH/README.md` | Architecture short index | Short architecture entry point. Use it before opening root `ARCH.md` for fast UI polish. |
| `../ARCH/05-data-model-and-api.md` | Data/API short map | Compact schema and endpoint map for DB/API/Auth/Admin/AI changes. |
| `../Project_state/current-slice.md` | Current short state | Compact handoff, key files, next local work and validation commands. |
| `../Project_state/00-current-progress.md` | Current progress mirror | Condensed current phase, done state, next fork and blockers. |
| `Asset-lod-roadmap.md` | Active architecture roadmap | Current Slice E Real Asset Pipeline roadmap. E-A and E-C are implemented; E-B now covers FastAPI local-dev, real `s3-compatible` Asset storage, Postgres persistence and configurable Web-to-FastAPI upload/save/load. Local runtime smoke and staging API Docker package smoke have passed; `/workspaces` Board gallery/list is now the primary Board entry and supports list/create/open/search/sort/rename/delete/recent-open/Load more/expanded Board Management metadata, while `/boards/:boardId` remains the canvas entry with autosave/save indicator hardening, title rename sync, Back warning, JSON-safe image asset migration, per-board Canvas Settings, Board History, captured thumbnail first pass, manual Refresh preview, History preview thumbnails and Smart Drawing first pass. Refresh preview / Workspace card / History thumbnail browser smoke has passed. S0D Auth scaffold first pass, S0E AI contract first pass, P0 database migration scaffold, Admin S0 boundary and AI node extension contract documentation are recorded; real staging wiring, real Auth, real AI provider and Smart Drawing tuning remain next. |
| `p0-local-product-shell-and-slice-e-roadmap-2026-05-01.md` | Active local backlog | Near-term local coordination plan after checkpoint `47d6d0f` and the current context-index split: Product Shell route skeletons, Auth split-screen visual pass, Workspaces Board gallery/list pass, App Shell 5-tab nav plus Landing page / Collection / Account / Settings / Team / Subscription semantic cleanup, Board save UX, Board History, Workspace Board metadata polish, settings-like Board Management Panel with owner/admin edit guard, thumbnail Remove-to-default, right-corner pin/visibility badges, copied toast, public/private confirm and History filter/author/preview UI, per-board Canvas Settings reference-style compact panel, captured Board thumbnail, manual Refresh preview, Smart Drawing first pass, Auth scaffold boundary, AI contract scaffold, database migration scaffold, Admin S0 planning and AI node extension guardrails now have first-pass local checkpoints or documented boundaries, but are not product-complete. Route/responsive browser smoke, Board autosave / rename / Back warning / multi-image paste browser regression, Board History autosave/Snapshot/Cmd+S/Restore smoke, Refresh preview / Workspace card / History thumbnail browser smoke, and Smart Drawing front-end gates / recognizer smoke have passed; remaining local candidates are long-session regression, Smart Drawing browser tuning and i18n/status polish. |
| `p0-database-schema-roadmap-2026-05-01.md` | Active schema roadmap | P0 database schema and migration plan. Captures current `tangent_boards` / `tangent_board_snapshots` / `tangent_assets`, Board Management metadata migrations, target Auth / Workspace / AI Run / API log tables, Admin S0 / Board membership / Credits / Billing / Analytics / Moderation fact-source planning, local-dev auto-create compatibility and staging/production Alembic migration policy. |
| `overseas-cost-growth-forecast.md` | Reference | Cost, growth and infrastructure planning reference. Keep synced when Asset / AI / deploy decisions change. |

## Archived Plans

Completed, accepted, handoff-only, or superseded plans live in `dev-plans/Archive/`.

Recently archived:

- `Archive/p0-development-harness-roadmap-2026-04-30.md` — old P0 slice/handoff roadmap, superseded by `ARCH.md` 11.5-11.7 and `HARNESS.md`.
- `Archive/codex-handoff-slice-e-continuation-2026-05-01.md` — latest handoff for continuing Slice E Real Asset Pipeline from the FastAPI local-dev / S3 adapter seam.
- `Archive/cross-platform-canvas-performance-test-2026-04-30.md` — Slice D cross-platform gate, now pass with notes.
- `Archive/codex-handoff-slice-e-real-asset-pipeline-2026-04-30.md` — old handoff, superseded by `project_state.md` and this index.
- `Archive/web-alpha-detailed-development-plan.md` — old detailed Alpha plan, superseded by P0 Harness and Asset LOD roadmap.
- `Archive/web-collaborative-canvas-pivot.md` — original pivot baseline, useful as history only.

## Rules

- If a plan is done, accepted, or mainly historical, move it to `Archive/`.
- If a plan remains in this directory, it must describe current or near-future work.
- When a slice completes, update its status here, the slice plan, and `project_state.md`.
