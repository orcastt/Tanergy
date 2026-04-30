# TANGENT — Web AI Image Canvas

TANGENT is restarting as a clean Web-first AI image canvas.

P0 is intentionally small:

```text
Prompt Node → Image Gen / Image Gen 4 → Image Node
Image Node + Prompt Node → Image Gen or Analysis → Image / Prompt Node
Image Node → Canvas Markup → Merge Capture → New Image Node
Right AI Chat → auto-create nodes → auto-wire → user reviews and runs
```

## Start Here

Read in this order before development:

1. `project_state.md` — current phase, completed work, next action.
2. `PRD.md` — user-visible product requirements and acceptance.
3. `ARCH.md` — technical decisions, boundaries, data/API/security.
4. `HARNESS.md` — cross-functional development rules and handoff standards.
5. Current `dev-plans/*.md` for the active slice.

## Current Focus

The project is in S1.5: complex node and canvas architecture validation.

Current hand-test focus:

- Canvas Settings / Snap Alignment.
- Node Runtime mock data flow.
- Prompt / Image output fan-out.
- Image Gen 4 four separate asset outputs.
- 50-100 node pressure test.
- External image paste/import pressure test.
- Merge Capture clean export.

Do not start real AI API work until the S1.5 gate is accepted.

## Active Source

Fresh implementation starts under:

- `apps/web/` — Next.js web app and tldraw spike.
- `services/api/` — future fresh API service if needed.
- `packages/shared/` — shared types/helpers.

Legacy code is isolated under:

- `legacy/old-tangent-desktop-2026-04-29/`

Do not read or modify legacy unless the user explicitly asks.

## Local Commands

```bash
npm -C apps/web run dev
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

Open the current spike at:

```text
http://localhost:3000/spikes/canvas
```

## Development Rules

- Keep source files under 300 lines; 250 lines is a warning.
- Create or update `dev-plans/` before non-trivial feature work.
- Update `project_state.md` before handoff or commit.
- Never put Provider API keys in frontend code.
- Do not persist `blob:` / `data:` / Base64 images in Board document state.
- Node props stay light: ids, short params, layout, ports, summaries, Asset references.
- Run quality gates after frontend changes.

## Planning Docs

- `dev-plans/web-collaborative-canvas-pivot.md` — original pivot plan.
- `dev-plans/web-alpha-detailed-development-plan.md` — Alpha sprint plan.
- `dev-plans/p0-development-harness-roadmap-2026-04-30.md` — current P0 Harness roadmap.
- `dev-plans/Asset-lod-roadmap.md` — current Asset Pipeline + Image / Node LOD roadmap before multiplayer.
- `dev-plans/Archive/` — completed, accepted, or deprecated dev-plan slices and handoff notes.

## Harness Coverage

`HARNESS.md` maps the 12 recurring workstreams: Product, Architecture, UI/UX, Auth, Payments, Realtime, Database/API, Launch, QA, Admin, AI Integration, and Ops.

Dynamic market numbers such as competitor ratings, revenue estimates, and current pricing must be researched with sources before being added to PRD.

Archived pivot mirrors live under `docs/archive/pivot-docs-2026-04-29/`; do not use them as active development context.
