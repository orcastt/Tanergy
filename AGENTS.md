# TANGENT Fresh Development Rules

## Product Boundary

- Web-first AI image canvas; no desktop client for P0.
- P0 image flow: `Prompt -> Image Gen / Image Gen 4 -> Image`, `Image + Prompt -> Image Gen / Analysis`, `Image -> Canvas Markup -> Merge Capture -> New Image`.
- AI Chat may create legal nodes and edges, but provider calls still go through server-side AiRun contracts.
- Collaboration is P0.5 and waits for Auth, Board, Asset and AiRun boundaries.
- Do not read or modify `legacy/old-tangent-desktop-2026-04-29/` unless the user explicitly asks.

## Canonical Docs

Root `PRD.md`, `ARCH.md` and `project_state.md` are pointers only.

| Folder | Total file | Slice files | Owns |
| --- | --- | --- | --- |
| `PRD/` | `PRD/PRD.md` | `PRD/PRD_slice_*.md` | User-visible requirements and acceptance |
| `ARCH/` | `ARCH/ARCH.md` | `ARCH/ARCH_slice_*.md` | Architecture diagrams, boundaries, APIs, schemas |
| `project_state/` | `project_state/project_state.md` | `project_state/project_state_slice_*.md` | Current progress, next steps, handoff notes |
| `dev-plans/` | `dev-plans/README.md` | Active/archived plans | Tactical implementation plans |

Do not recreate mirror files such as `ARCH/00-current-map.md` or `project_state/current-slice.md`.

## Update Policy

- During an active small slice, update only the relevant slice docs.
- When that slice reaches a stable checkpoint, update the folder total file.
- Root pointer files should almost never change.
- PRD changes describe product behavior; ARCH changes describe implementation boundaries; project state changes describe what is currently true.
- For `Fast UI polish`, read `project_state/Finished/project_state_slice_S0_local_polish.md`, then the relevant `PRD/` and `ARCH/` slice.
- For data/API/Auth/AI/Admin/Billing/Deploy/Collaboration, read `project_state/project_state.md`, `PRD/PRD.md`, `ARCH/ARCH.md`, `HARNESS.md` and the relevant slices.

## Safety Rules

- API keys and provider secrets stay server-side only.
- Board documents, Board History documents, node props and future collaboration docs must not persist `data:`, `blob:`, Base64 images, provider raw responses, complete logs or long generated text.
- New AI nodes must update Node Registry, Model Registry, AiRun contracts, routes, tests and Board guard together.
- Admin access must be server-side through `admin_roles`; all admin writes need audit logs.
- Source files target under 300 lines; split before adding more behavior to large files.

## Quality Gates

Frontend changes:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

Backend/API changes:

```bash
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api services/api/migrations
git diff --check
```

Docs-only changes may run only `git diff --check`, but say that clearly in the final response.

## Git

- Do not commit, push or create branches unless the user asks.
- Before committing, inspect `git status`.
- Keep checkpoints small and reversible.
