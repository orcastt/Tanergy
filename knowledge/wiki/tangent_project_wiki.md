# TANGENT Project Wiki

**Updated**: 2026-05-21
**Mode**: Compiled project overview for future coding agents.

## One-Liner

TANGENT is a web-first AI image canvas where users arrange prompts, images, markup and AI nodes, then run image generation, image editing, image analysis and merge-capture flows on a server-owned AI runtime.

## Current Product Spine

The alpha release spine is intentionally narrow:

1. Canvas / Board / Page / Share / Auth
2. One real AI provider path
3. Billing mock plus visible usage/ledger
4. Admin minimum operating surface

Everything outside that spine is scaffold, deferred, or regression-only unless it directly reduces release risk.

## Current Architecture Shape

```text
Browser
  -> Next.js Web App
      -> Konva Board runtime
      -> protected workspace/admin/billing/team/group surfaces
      -> thin local API bridges where still needed
  -> FastAPI API
      -> Clerk-authenticated request context
      -> Board/Asset/AiRun/Admin/Billing authority
      -> Supabase Postgres + R2 assets
      -> server-side AI provider adapters
```

Important boundaries:

- Provider keys and API secrets stay server-side.
- Board documents store refs and short summaries, not raw provider payloads or image binaries.
- Frontend role labels are not authority; server-side membership/admin checks are.
- AI execution must resolve permission, payer, route and cost before provider work starts.
- Collaboration process traffic stays lightweight; final/compacted snapshots persist.

## Current Operating Truth

- The active canvas runtime is Konva-only on `/boards/[boardId]`.
- Staging Web is `https://staging.tanergy.cc`.
- Staging API is `https://api-staging.tanergy.cc`.
- Supabase Pro is the staging Postgres source of truth.
- R2 stores image/object assets.
- Clerk is the active auth provider.
- GeekAI is the active AI provider path for current text/analysis/image routes.
- Jiekou remains historical/rollback fallback, not the default route.
- `legacy/` has been removed from the active worktree/repo; recover old reference material from Git history or archived docs if explicitly needed.

## Main Open Gates

- Restore API deploy access or CI for FastAPI-side post-stage fixes.
- Run signed-in staging smoke for admin edits, workspace invites, Board title rejection and Free-plan copy-board modal.
- Run two-user collaboration smoke for invite/reopen and active mover identity during transforms.
- Run one real server-backed GeekAI image smoke, including Nano Banana 2 MIME/display verification.
- Finish Google/email verification plus production-like CORS/origin checks.
- Capture external ops proof for WAF/rate-limit, backup/PITR, uptime/status alerts and Sentry/APM.

## Read Order

For a new task:

1. `AGENTS.md`
2. `HARNESS.md`
3. `project_state/project_state.md`
4. `PRD/PRD.md`
5. `ARCH/ARCH.md`
6. Relevant slice docs
7. `knowledge/index.md`
8. Matching `knowledge/wiki/*` page

## Sources

- `AGENTS.md`
- `HARNESS.md`
- `PRD/PRD.md`
- `ARCH/ARCH.md`
- `project_state/project_state.md`
- `knowledge/wiki/agent_harness_and_skills.md`
- `knowledge/wiki/ai_provider_capability_matrix.md`
- `knowledge/wiki/connections_registry.md`
