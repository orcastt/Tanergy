# Project State Short Index

**Updated**: 2026-05-02  
**Purpose**: compact state layer for faster Codex handoffs.

Root `project_state.md` remains the canonical project ledger. This folder mirrors the current stage, active branch, progress map, next work and handoff notes so small iterations do not require rereading the whole ledger every time.

## Files

| File | Use |
| --- | --- |
| `00-current-progress.md` | Condensed mirror of the root `project_state.md` current phase, completed first passes, next fork and blockers. Read this after `current-slice.md` if you need broader status. |
| `current-slice.md` | Short active-slice context, key files and validation commands. Start here for fast UI polish. |
| `handoff-2026-05-02-fast-slices.md` | End-of-shift handoff after the context-index split and checkpoint. |

## Read Order

For fast local UI/product polish:

1. `AGENTS.md`
2. `Project_state/current-slice.md`
3. `Project_state/00-current-progress.md`
4. `ARCH/README.md`
5. Relevant `ARCH/*.md` slice
6. Active `dev-plans/` plan

For architecture, API, database, Auth, AI, deploy, billing, Admin or collaboration changes:

1. `AGENTS.md`
2. `project_state.md`
3. `PRD.md`
4. `ARCH.md`
5. `HARNESS.md`
6. Relevant `ARCH/` files
7. Active `dev-plans/` plan

## Sync Rule

- Update `current-slice.md` after each fast UI polish slice or handoff.
- Update `00-current-progress.md` when the current phase, branch, progress percentages, completed first passes or next fork changes.
- Update root `project_state.md` when a checkpoint, architecture boundary, completed feature, external resource step or branch handoff changes.
- Do not fork status truth. If a detail is long-lived or canonical, put it in root `project_state.md` first and summarize it here.

## Current Short Truth

- Current branch: `feature/local-polish-fast-slices`.
- Latest pushed checkpoint before current uncommitted thumbnail/docs work: `847ed3c checkpoint: canvas polish and context indexes`.
- Current mode: local P0 polish unless external staging resources are ready.
- Next local candidates: Smart Drawing browser tuning, autosave/history long-session regression, i18n/status polish.
