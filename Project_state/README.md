# Project State Index

**Updated**: 2026-05-02  
**Purpose**: short state layer for faster Codex handoffs.

Root `project_state.md` remains the canonical project ledger. This folder stores compact handoff and active-slice notes so small iterations do not require rereading the whole ledger every time.

## Files

| File | Use |
| --- | --- |
| `current-slice.md` | Short current context, next steps, key files and validation commands. Start here for fast UI polish. |
| `handoff-2026-05-02-fast-slices.md` | End-of-shift handoff for the next Codex after the context-index split and checkpoint. |

## Read Order

For fast local UI/product polish:

1. `AGENTS.md`
2. `Project_state/current-slice.md`
3. `ARCH/README.md`
4. Relevant `ARCH/Slice-*.md` or focused architecture file
5. Active `dev-plans/` plan

For architecture, API, database, Auth, AI, deploy, billing, Admin or collaboration changes:

1. `AGENTS.md`
2. `project_state.md`
3. `PRD.md`
4. `ARCH.md`
5. `HARNESS.md`
6. Relevant `ARCH/` files
7. Active `dev-plans/` plan

## Update Rules

- Update `current-slice.md` after each fast UI polish slice or handoff.
- Update root `project_state.md` when a checkpoint, architecture boundary, completed feature, external resource step or branch handoff changes.
- Do not fork status truth. If a detail must be canonical, put it in root `project_state.md` and summarize it here.
