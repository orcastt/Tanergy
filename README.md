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
| Accepted local baseline | `project_state/Finished/project_state_slice_S0_local_polish.md` |
| Product requirements | `PRD/PRD.md` |
| Architecture map | `ARCH/ARCH.md` |
| Execution rules | `AGENTS.md`, `HARNESS.md` |
| Tactical plans | `dev-plans/README.md` |

For S0 regression-only UI polish, start with:

```text
AGENTS.md
project_state/Finished/project_state_slice_S0_local_polish.md
PRD/Finished/PRD_slice_S0_local_product_shell.md
ARCH/Finished/ARCH_slice_S0_local_polish.md
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

- `apps/web/` — Next.js web app, Konva v2 production canvas and gated tldraw reference.
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

1. Finish S1B/S1C staging Auth smoke with Clerk, Google OAuth, Postgres, R2 and Konva-first Board route.
2. Harden S1D effective Board permissions into `Can view / Can edit / Can manage / Owner`.
3. Implement S3 entitlement/seat/credit-ledger contracts before real AI charging.
4. Then move S2 from mock AiRun to real provider execution through server-side contracts.
