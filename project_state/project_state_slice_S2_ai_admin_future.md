# Project State Slice S2: AI, Admin And Future Work

**Updated**: 2026-05-05
**Status**: Planned after S1 foundations; admin backend bootstrap has started with a minimal server-side access probe, while real AI calls still wait for server-side Auth/cost controls.

## AI Current State

- Mock Model Registry exists.
- Mock AiRun route exists.
- Node UI reads model contract.
- Real provider calls are not connected.
- Konva nodes now have a stronger mock runtime/dataflow path, including Prompt/Image/Chat/Image Gen/Analysis flow. Real provider calls must replace the mock adapter through server-side AiRun, not frontend node UI.

## Admin Current State

- Admin S0 schema/access/audit boundary is documented.
- Minimal backend access probe now exists: `GET /api/v1/admin/me`.
- Production `/admin` UI is not enabled.
- Real Auth is required before admin UI work becomes meaningful.
- A read-only Admin MVP can be planned, but production `/admin` remains blocked until server-side `admin_roles` exists.
- First admin owner bootstrap flow is documented in the S1B runbook and S3 Admin ARCH/PRD: verified Auth user first, then server-side `tangent_admin_roles.owner`, with `tangent_admin_audit_logs`.
- Global admin runtime still needs:
  - bootstrap command or SQL checklist
  - audit-log write helper
  - protected read-only `/api/v1/admin/*` data routes
  - optional `/admin` page and route guard

## Future Order

1. Real Auth and Board ownership.
2. Real AI provider with AiRun/cost logs.
3. Credit ledger and subscription facts.
4. Admin user management MVP.
5. Analytics, moderation and revenue dashboards.
6. P0.5 collaboration.

Current handoff reference:

```text
dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md
```
