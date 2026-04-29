# TANGENT — Web AI Image Canvas

TANGENT is restarting as a clean Web-first AI image canvas.

P0 is intentionally small:

```text
Text Node → Multi Generate Node (4 images) → Image Node → Image Editor / Canvas Markup → Merge Capture → New Image Node
```

## Active Docs

Read these before development:

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `dev-plans/web-collaborative-canvas-pivot.md`

Archived pivot mirrors live under `docs/archive/pivot-docs-2026-04-29/`; do not use them as active development context.

## Active Source

Fresh implementation starts under:

- `apps/web/`
- `services/api/` if a fresh API service is needed
- `packages/shared/` for shared types/helpers

## Legacy Archive

Old desktop/admin/backend/frontend code has been isolated under:

- `legacy/old-tangent-desktop-2026-04-29/`

Do not read or modify the legacy archive unless explicitly recovering an idea.
