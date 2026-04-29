# TANGENT — Web AI Image Canvas

TANGENT is restarting as a clean Web-first AI image canvas.

P0 is intentionally small:

```text
Prompt Node → Image Gen / Image Gen 4 (switchable image model, 1 or 4 images) → Image Node
Image Node + Prompt Node → Image Gen or Analysis → Image / Prompt Node
Image Node → Canvas Markup → Merge Capture → New Image Node
Right AI Chat → auto-create nodes → auto-wire → user reviews and runs
```

## Active Docs

Read these before development:

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `dev-plans/web-alpha-detailed-development-plan.md`
5. `dev-plans/web-collaborative-canvas-pivot.md`

Archived pivot mirrors live under `docs/archive/pivot-docs-2026-04-29/`; do not use them as active development context.

## Active Source

Fresh implementation starts under:

- `apps/web/`
- `services/api/` if a fresh API service is needed
- `packages/shared/` for shared types/helpers

Current Step 1 spike:

- Run `npm -C apps/web run dev`
- Open `http://localhost:3000/spikes/canvas`
- After Step 1 hand-test passes, the next gate is Step 1.5: complex AI nodes, ports, Inspector, auto-layout, Merge Capture, and 50-100 node pressure testing.

## Legacy Archive

Old desktop/admin/backend/frontend code has been isolated under:

- `legacy/old-tangent-desktop-2026-04-29/`

Do not read or modify the legacy archive unless explicitly recovering an idea.
