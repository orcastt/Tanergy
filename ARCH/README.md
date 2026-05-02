# ARCH Index

**Updated**: 2026-05-02  
**Purpose**: short architecture entry point for faster Codex handoffs.

Root `ARCH.md` remains the canonical architecture record. This folder is the working index and slice map so small UI/product iterations do not require rereading the whole 2,000+ line document every time.

## Read Order By Task Type

For fast UI polish:

1. `AGENTS.md`
2. `Project_state/current-slice.md`
3. `ARCH/README.md`
4. Relevant slice file in this folder
5. Active plan in `dev-plans/`

For architecture, API, database, auth, AI, deploy, billing, admin, collaboration, or persistence changes:

1. `AGENTS.md`
2. `project_state.md`
3. `ARCH.md`
4. `PRD.md`
5. `HARNESS.md`
6. Relevant files in `ARCH/`
7. Relevant `dev-plans/` plan

## Slice Index

| File | Use |
| --- | --- |
| `00-current-map.md` | Current system map, progress percentages, next local/staging fork. |
| `01-canvas-runtime.md` | Canvas runtime, toolbar, drawing properties, Canvas Settings, Smart Drawing, Node Inspector removal. |
| `02-board-asset-persistence.md` | Board save, History, captured thumbnails, Asset/Board guard and metadata. |
| `03-ai-node-contract.md` | AI node extension contract, Model Registry, AiRun boundary, node card self-contained controls. |
| `04-product-shell-auth-admin-deploy.md` | Product shell routes, Auth scaffold, Admin S0, staging/deploy boundaries. |
| `Slice-S0-local-polish.md` | Active local UI/product polish slice and quick validation list. |

## Update Rules

- Update this index when a new architecture slice file is added or retired.
- Keep root `ARCH.md` as stable canonical architecture and progress map.
- Put volatile UI acceptance notes, handoff details, and current-file lists in `Project_state/current-slice.md` or the active slice file.
- Fast UI polish may update only `Project_state/current-slice.md` plus the active slice file, unless it changes architecture, persistence, API, auth, AI, deploy, pricing, or permissions.
