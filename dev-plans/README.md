# Dev Plans Index

**Updated**: 2026-05-01  
**Status**: Current planning index for active TANGENT P0 work.

Use this directory as a working plan layer, not as the canonical product or architecture source.

The end-to-end 0-to-1 launch route, sprint breakdown, deployment flow, external resource checklist and rough phase estimates now live in `ARCH.md` sections 11.5-11.7. Keep active slice plans here focused on the next implementation cut.

Product-level P0 scope, per-feature implementation status and Alpha acceptance gaps are now synced in `PRD.md` sections 0, 2, 5 and 9.

Read order for active development:

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `HARNESS.md`
5. This file
6. The active slice plan below

## Active Plans

| File | Status | Use |
| --- | --- | --- |
| `Asset-lod-roadmap.md` | Active | Current Slice E Real Asset Pipeline roadmap. E-A and E-C are implemented; E-B now covers FastAPI local-dev, real `s3-compatible` Asset storage, Postgres persistence and configurable Web-to-FastAPI upload/save/load. Local runtime smoke and staging API Docker package smoke have passed; `/boards` Dashboard / Board entry now supports list/create/open/search/rename/delete plus Board-mode autosave/save indicator, while real staging wiring, thumbnails/recent metadata and Auth remain next. |
| `p0-local-product-shell-and-slice-e-roadmap-2026-05-01.md` | Active | Near-term local coordination plan after checkpoint `5ffed96`: Product Shell route skeletons and Board save UX now have first-pass local checkpoints, but are not product-complete; next local work is Dashboard metadata polish, Auth scaffold boundary and AI contract scaffold before real external resources are ready. |
| `p0-development-harness-roadmap-2026-04-30.md` | Active | Current P0 slice order and handoff standard. |
| `overseas-cost-growth-forecast.md` | Reference | Cost, growth and infrastructure planning reference. Keep synced when Asset / AI / deploy decisions change. |

## Archived Plans

Completed, accepted, handoff-only, or superseded plans live in `dev-plans/Archive/`.

Recently archived:

- `Archive/codex-handoff-slice-e-continuation-2026-05-01.md` — latest handoff for continuing Slice E Real Asset Pipeline from the FastAPI local-dev / S3 adapter seam.
- `Archive/cross-platform-canvas-performance-test-2026-04-30.md` — Slice D cross-platform gate, now pass with notes.
- `Archive/codex-handoff-slice-e-real-asset-pipeline-2026-04-30.md` — old handoff, superseded by `project_state.md` and this index.
- `Archive/web-alpha-detailed-development-plan.md` — old detailed Alpha plan, superseded by P0 Harness and Asset LOD roadmap.
- `Archive/web-collaborative-canvas-pivot.md` — original pivot baseline, useful as history only.

## Rules

- If a plan is done, accepted, or mainly historical, move it to `Archive/`.
- If a plan remains in this directory, it must describe current or near-future work.
- When a slice completes, update its status here, the slice plan, and `project_state.md`.
