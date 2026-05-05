# Project State Slice S2: AI, Admin And Future Work

**Updated**: 2026-05-05
**Status**: Planned after S1 foundations; provider adapter planning can proceed, real calls wait for server-side Auth/cost controls.

## AI Current State

- Mock Model Registry exists.
- Mock AiRun route exists.
- Node UI reads model contract.
- Real provider calls are not connected.
- Konva nodes now have a stronger mock runtime/dataflow path, including Prompt/Image/Chat/Image Gen/Analysis flow. Real provider calls must replace the mock adapter through server-side AiRun, not frontend node UI.

## Admin Current State

- Admin S0 schema/access/audit boundary is documented.
- Production `/admin` is not enabled.
- Real Auth is required before admin UI work becomes meaningful.
- A read-only Admin MVP can be planned, but production `/admin` remains blocked until server-side `admin_roles` exists.

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
