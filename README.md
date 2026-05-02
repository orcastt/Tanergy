# TANGENT — Web AI Image Canvas

TANGENT is a clean Web-first AI image canvas.

```text
Prompt Node -> Image Gen / Image Gen 4 -> Image Node
Image Node + Prompt Node -> Image Gen or Analysis -> Image / Prompt Node
Image Node -> Canvas Markup -> Merge Capture -> New Image Node
AI Chat -> create allowed nodes -> auto-wire -> user reviews and runs
```

## Start Here

Root `PRD.md`, `ARCH.md` and `project_state.md` are pointers only.

| Need | Read |
| --- | --- |
| Current state | `project_state/project_state.md` |
| Active local slice | `project_state/project_state_slice_S0_local_polish.md` |
| Product requirements | `PRD/PRD.md` |
| Architecture map | `ARCH/ARCH.md` |
| Execution rules | `AGENTS.md`, `HARNESS.md` |
| Tactical plans | `dev-plans/README.md` |

For small UI polish, start with:

```text
AGENTS.md
project_state/project_state_slice_S0_local_polish.md
PRD/PRD_slice_S0_local_product_shell.md
ARCH/ARCH_slice_S0_local_polish.md
```

For architecture/API/Auth/AI/Admin/Billing/Deploy/Collaboration, start with:

```text
AGENTS.md
project_state/project_state.md
PRD/PRD.md
ARCH/ARCH.md
HARNESS.md
relevant slice files
```

## Active Source

- `apps/web/` — Next.js web app and tldraw canvas.
- `services/api/` — FastAPI service, storage adapters and migrations.
- `packages/shared/` — shared packages if needed.
- `legacy/old-tangent-desktop-2026-04-29/` — archived old app; do not read or edit unless explicitly asked.

## Local Commands

```bash
npm -C apps/web run dev
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api services/api/migrations
git diff --check
```

## Current Next Work

If external resources are not ready:

1. Smart Drawing threshold tuning.
2. i18n/status polish.
3. More realistic empty/error states for mocked production surfaces.

If external resources are ready:

1. Staging Postgres/R2/domain smoke.
2. Real Auth and workspace ownership.
3. Auth-backed Board CRUD.
4. Real AI provider path.
