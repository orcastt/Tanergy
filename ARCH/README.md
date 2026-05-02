# ARCH Short Index

**Updated**: 2026-05-02  
**Purpose**: fast architecture entry point that mirrors the stable parts of root `ARCH.md`.

Root `ARCH.md` remains the canonical architecture record. The files in this folder are not separate truth; they are a sliced mirror of the diagrams, contracts and current progress that Codex needs most often.

## Read Order By Task Type

For fast UI polish:

1. `AGENTS.md`
2. `Project_state/current-slice.md`
3. `Project_state/00-current-progress.md`
4. `ARCH/README.md`
5. Relevant `ARCH/*.md` slice
6. Active plan in `dev-plans/`

For architecture, API, database, auth, AI, deploy, billing, admin, collaboration, or persistence changes:

1. `AGENTS.md`
2. `project_state.md`
3. `ARCH.md`
4. `PRD.md`
5. `HARNESS.md`
6. Relevant files in `ARCH/`
7. Relevant `dev-plans/` plan

## Slice Index

| File | Mirrors root `ARCH.md` | Use |
| --- | --- | --- |
| `00-current-map.md` | 3.1, 3.3, 11.5, 11.5.1 | Current architecture diagram, progress percentages, parallel lane map and slice flow. |
| `01-canvas-runtime.md` | 4.3, 4.3.1, 4.4, 4.9.1, 5.14, 5.15 | Canvas runtime, fixed property drawer, Canvas Settings, Smart Drawing and node payload rules. |
| `02-board-asset-persistence.md` | 4.2, 4.7, 5.3-5.5, 8.2-8.3 | Board save/load/list/history, Asset storage, thumbnails, guards and storage adapters. |
| `03-ai-node-contract.md` | 4.4.1, 4.6, 4.8-4.10, 5.6-5.8, 8.4-8.6 | AI node extension contract, Model Registry, AiRun, AI Planner and Chat boundaries. |
| `04-product-shell-auth-admin-deploy.md` | 4.1, 4.11, 5.2, 5.9-5.13, 11.6-11.7 | Product shell routes, Auth boundary, Admin S0, billing/analytics facts and deploy resources. |
| `05-data-model-and-api.md` | 5, 8 | Compact cross-system data model and API contract map. Read before DB/API changes. |
| `Slice-S0-local-polish.md` | 11.5.1 S0A-S0J | Active local polish slice, current progress and quick validation list. |

## Sync Rule

When root `ARCH.md` changes:

- Architecture diagram or progress map changes -> update `00-current-map.md`.
- Canvas, toolbar, settings, Smart Drawing, Node Runtime or document payload changes -> update `01-canvas-runtime.md`.
- Board, Asset, History, thumbnail, guard, storage adapter or persistence API changes -> update `02-board-asset-persistence.md` and usually `05-data-model-and-api.md`.
- AI node, Model Registry, AiRun, Planner, Chat or provider route changes -> update `03-ai-node-contract.md` and usually `05-data-model-and-api.md`.
- Product shell, Auth, Admin, Billing, Analytics, deployment or external resource changes -> update `04-product-shell-auth-admin-deploy.md` and usually `05-data-model-and-api.md`.
- Current slice status changes -> update `Slice-S0-local-polish.md` and `Project_state/current-slice.md`.

## Guardrail

Do not let this folder drift into a second architecture. If a decision is long-lived, first make it true in root `ARCH.md`, then mirror the short version here. Volatile UI acceptance notes belong in `Project_state/current-slice.md` or an active dev-plan.
