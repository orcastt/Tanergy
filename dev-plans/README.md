# Dev Plans Index

**Updated**: 2026-05-01  
**Status**: Current planning index for active TANGENT P0 work.

Use this directory as a working plan layer, not as the canonical product or architecture source.

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
| `Asset-lod-roadmap.md` | Active | Current Slice E Real Asset Pipeline roadmap. E-A and E-C are implemented; E-B request context + storage adapter seam now covers FastAPI local-dev and real `s3-compatible` Asset storage; Postgres persistence and Web-to-FastAPI contract switch remain next. |
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
