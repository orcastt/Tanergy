# P0 Project-Wide Acceptance Audit

**Updated**: 2026-05-18
**Status**: Active acceptance ledger for this cleanup pass.
**Scope**: PRD, ARCH, project_state, active dev plans, staging/prod deploy runbooks, current canvas/realtime code, quality gates and secret-flow hygiene.

## Audit Rules

- Do not read or copy live `.env` values into tracked docs.
- Do not store raw API keys, database passwords, private keys, bearer tokens, full connection strings, provider raw responses, Base64 images or complete logs in docs or Board state.
- Confirmed and green behavior should not be rewritten just because a nearby file looks old.
- If a file has collected many unrelated patches, the next implementation pass should rewrite it into smaller owned modules, verify the replacement, then delete any temporary backup before commit.
- Tracked docs may record only variable names, owner surfaces, status and smoke requirements.
- Expired keys should be commented in private operator records with date/reason; do not delete the historical note unless the private operator record is being replaced wholesale.

## Acceptance Status Key

| Mark | Meaning |
| --- | --- |
| Green | Implemented and covered by automated gates or already accepted staging smoke. |
| Manual gate | Implemented enough to test, but needs real browser/provider/operator smoke. |
| Planned | Product/architecture documented; implementation intentionally not started or not in this release promise. |
| Archived | Historical only; not active truth. |

## Current P0 Spine

| Lane | Current status | Evidence | Next required gate |
| --- | --- | --- | --- |
| Canvas / Board / Page / Share / Auth | Manual gate | Konva-only `/boards/[boardId]`, page drawer, public share, Clerk session bridge and board permission contracts exist; frontend lint/typecheck/build pass. | Second-round signed-in browser pass: create/open/save/history/thumbnail/share/private owner edge cases. |
| One real AI provider path | Manual gate | Server AiRun quote/preflight/lifecycle/control-plane scaffolds exist; Jiekou-first local UX proof exists; backend suite passes. | One credentialed live server-backed image smoke with Asset output and settlement. |
| Billing mock + usage / ledger | Manual gate | Team wallet vs personal Collaborate wallet, usage reads, checkout/manual-payment scaffolds and admin finance contracts exist locally. | Staging payment/manual provider smoke, invoice/refund depth and UI language pass. |
| Admin minimum surface | Manual gate | Server-gated admin, operator inventory/detail, finance/manual ops and route metrics exist; backend suite passes. | Real staging admin finance/operator smoke after each redeploy or schema/env change. |
| Production collaboration | Planned/P0.5 | Draft drawing presence preview, websocket bridge and final-snapshot persistence exist. | Real two-user browser smoke, Redis/multi-instance backplane and focused TTL lock policy before production promise. |

## Document Sweep Result

| Area | Result | Notes |
| --- | --- | --- |
| Root pointers | Green | Root `PRD.md`, `ARCH.md` and `project_state.md` remain pointer files only; no mirror files were recreated. |
| PRD total + slices | Green/Manual gate | Active slices now describe Supabase Pro staging, R2 clean-smoke pending, Clerk as Auth authority and collaboration as P0.5 rather than broadening the current release promise. |
| ARCH total + slices | Green/Manual gate | Architecture truth is aligned around FastAPI + Supabase Postgres + R2 + Clerk + WebSocket room memory/final snapshots. Redis remains a planned production backplane. |
| project_state total + slices | Green/Manual gate | State now records the Neon quota incident, removed Hetzner-local DB fallback, fresh Supabase cutover, R2 reset and Jiekou-first provider direction. |
| active dev-plans | Green/Manual gate | No additional active plan was moved to Archive in this pass. The still-active files either drive current work or explicitly label planned/deferred work. |
| Archive | Archived | Historical plans stay in `dev-plans/Archive/` and should not be treated as active truth. |
| deploy docs / env examples | Green/Manual gate | Examples now use Jiekou-first active env names and keep retired GeekAI names commented only for rotation history. Real values stay outside tracked docs. |
| untracked reference assets | Not committed | `reference/` folders and zips are left untouched and outside this commit because they are local visual/reference material, not canonical project docs. |

## Feature-by-Feature Audit

### S0 Product Shell

| Requirement | Status | Notes |
| --- | --- | --- |
| Product shell, workspace gallery/list, board card actions | Green | Finished S0 baseline; use `project_state/Finished/project_state_slice_S0_local_polish.md` only as regression reference. |
| Canvas settings and local Smart Drawing polish | Green | Accepted for P0 local polish; do not reopen unless regression appears. |

### S1A Database Schema

| Requirement | Status | Notes |
| --- | --- | --- |
| Users, workspaces, boards, snapshots, assets and future joins | Green | Alembic head includes S2/S3 later migrations. |
| Fresh Supabase Pro Alembic-to-head smoke | Green | Current staging DB truth is fresh Supabase Pro; retired Neon/Hetzner-local data is not migrated. |
| Query-plan tuning on real staging data | Manual gate | Wait until re-created staging data grows beyond smoke size. |

### S1B Staging Infrastructure

| Requirement | Status | Notes |
| --- | --- | --- |
| Public Web/API staging domains | Green/Manual gate | Web/API are back online; rerun smoke after deploy/env changes. |
| Supabase Pro as only staging DB truth | Green | Do not reintroduce Hetzner server-local Postgres or Neon as active staging truth. |
| R2 as object storage | Manual gate | R2 was cleared; next smoke must upload/read/thumbnail from clean bucket state. |
| Release-style Hetzner API deploy | Green/Manual gate | Shared server-local `api.env` is authoritative for API runtime; clean release dirs are the deploy model. |
| Final-snapshot realtime persistence | Green | Default `TANGENT_BOARD_REALTIME_PERSIST_MODE=final_snapshot`; `update_chain` is rollback-only. |

### S1C Auth And Account

| Requirement | Status | Notes |
| --- | --- | --- |
| Clerk session bridge and FastAPI bearer verification | Green | Real session/admin smoke previously green; rerun after Clerk/env changes. |
| Profile onboarding/editing and forgot password | Green | First-pass product flow exists. |
| Self-delete/admin-delete shared service | Green | Hard-delete path has Team/Group ownership guards. |
| Google/email/logout/session revocation | Manual gate | Still needs browser/email smoke and revocation hardening. |

### S1D Board Permissions And Sharing

| Requirement | Status | Notes |
| --- | --- | --- |
| Board CRUD/member/share/public-share first pass | Green | Owner-only copy/delete, share expiry and known-foreign Asset guard exist. |
| Effective `none/view/edit/manage/owner` hardening | Manual gate | Continue edge tests around explicit board membership and workspace role transitions. |
| Explicit Asset-sharing allowlist | Planned | Keep as follow-up unless a share bug blocks P0. |

### S1X Canvas Runtime

| Requirement | Status | Notes |
| --- | --- | --- |
| Konva-only formal Board route | Green | Legacy tldraw documents/history are blocked in active path. |
| Header simplification | Green | Canvas header keeps Back + inline rename; old board switch/new/open control is removed. |
| Page management | Manual gate | Create/switch/rename/delete/reorder exist; free-plan page limit opens upgrade dialog. Browser regression still needed. |
| Node minimum size | Green | Node cards cannot resize below registry default, reducing chat/input overlay misalignment. |
| Draft drawing presence preview | Green/Manual gate | Low-rate awareness preview exists; two-user browser latency needs smoke. |
| Export/background/page thumbnail polish | Manual gate | True rendered page thumbnail assets and broader export polish remain follow-ups. |

### S2 AI Runtime

| Requirement | Status | Notes |
| --- | --- | --- |
| Model/route/pricing control plane | Green | DB-backed facts, versioning and admin read/write scaffolds exist. |
| Quote/preflight and payer resolution | Green | Team runs charge Team wallet; Group/Collaborate runs charge actor personal wallet in contracts. |
| Server AiRun lifecycle | Green/Manual gate | Create/poll/cancel and text-output persistence exist; live image smoke still required. |
| Jiekou-first provider route | Manual gate | Runtime examples now use Jiekou env names; retired GeekAI env names are comment-only history unless rollback is explicit. |
| Remove BG / Object Cutout | Planned | Visible affordances are not accepted live features until server-owned smoke passes. |

### S3 Admin, Billing, Team And Group

| Requirement | Status | Notes |
| --- | --- | --- |
| Team wallet and personal Collaborate wallet semantics | Green | Core backend contracts and local smoke exist. |
| Group/Team invite/member contracts | Green/Manual gate | Capacity-based invite acceptance exists; browser/product smoke still needed. |
| Public pricing and legal policy drafts | Green/Manual gate | `/pricing`, `/privacy`, `/terms` and `/ai-policy` are public no-auth pages linked from landing; content remains draft and live checkout is still disabled. |
| Subscription/Usage UI | Manual gate | Public pricing now uses narrow vertical plan containers; authenticated `/billing` and `/usage` still need the next product-language and live-catalog alignment pass. |
| Admin operator console | Green/Manual gate | Local acceptance green; staging/high-volume smoke remains. |
| Payment provider automation, invoices and refunds | Planned | Keep honest as mock/manual until hosted-provider staging smoke deepens. |

### S4 Collaboration

| Requirement | Status | Notes |
| --- | --- | --- |
| Invite -> board entry | Green/Manual gate | Product route and session workspace selection exist; real two-user browser smoke remains. |
| Presence and focused occupancy | Green/Manual gate | Cursor/selection/transform/edge/draft preview and focused edit occupancy exist. |
| Realtime process broadcast without per-update DB writes | Green | WebSocket room memory carries process traffic; Postgres stores final snapshots. |
| Redis/multi-instance production provider | Planned | Required before production multiplayer promise. |

### S1E Board Packages

| Requirement | Status | Notes |
| --- | --- | --- |
| `.tgy` export/import | Planned | Product/architecture/tactical docs exist; implementation not started. |

## Code Quality And Memory Audit

### Gate Result For This Pass

| Gate | Result | Notes |
| --- | --- | --- |
| `git diff --check` | Passed | No whitespace errors in the current diff. |
| `npm -C apps/web run lint` | Passed | Frontend lint completed cleanly. |
| `npm -C apps/web run typecheck` | Passed | TypeScript `--noEmit` completed cleanly. |
| `npm -C apps/web run build` | Passed | Next.js production build completed successfully. |
| `PYTHONPATH=services/api python3 -m pytest services/api/tests` | Passed | 274 backend tests passed. |
| `python3 -m compileall services/api/tangent_api services/api/migrations` | Passed | API modules and migrations compile. |

### Gates To Rerun After Code Changes

```bash
git diff --check
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api services/api/migrations
```

### Memory-Safety Requirements Already Present

- Board and History documents must not persist `data:`, `blob:`, Base64 image bodies, provider raw payloads, complete logs or long generated text.
- Asset binaries stay in R2/S3-compatible storage; Postgres stores metadata/refs.
- Realtime `yjs-update` process traffic stays in room memory by default; only compacted/final snapshots persist.
- Websocket update payloads have byte limits and support base64 envelopes to avoid huge JSON number arrays.
- Presence/draft previews are sanitized, size-limited and TTL-shaped.
- Local AI/image routes enforce input/output byte caps and remain production-disabled unless explicitly opted in.

### Current Line-Budget Hotspots

These files are above the `<300 lines` target and should be split only when a related implementation cut touches them. Do not churn stable accepted behavior just to reduce line count.

| Priority | Lines | File | Current concern | Suggested next action |
| --- | ---: | --- | --- | --- |
| P1 | 823 | `apps/web/src/components/konva-canvas/KonvaNodeCardShape.tsx` | Very large node renderer; easy to accumulate UI regressions. | Split by node body/header/ports/chat controls when node UI is next touched. |
| P1 | 591 | `apps/web/src/components/konva-canvas/useKonvaNodeCreationMenu.ts` | Large menu/runtime factory. | Split menu state, placement math and registry grouping. |
| P1 | 523 | `services/api/tangent_api/ai_provider_openai_compatible.py` | Provider adapter complexity and live API handling. | Split request building, response parsing and error mapping. |
| P1 | 506 | `apps/web/src/components/konva-canvas/useKonvaCanvasInteractions.ts` | Pointer/session orchestration remains dense. | Continue extracting tool sessions only alongside interaction changes. |
| P1 | 490 | `apps/web/src/features/node-runtime/registry.ts` | Registry facts are growing with product surface. | Split per node family after next registry expansion. |
| P1 | 457 | `services/api/tangent_api/storage/board_storage_adapter.py` | Storage adapter contract breadth. | Split read/write/history/share boundaries if touched. |
| P2 | 435 | `apps/web/src/components/konva-canvas/KonvaCanvasShape.tsx` | Main canvas renderer still holds mixed visual concerns. | Split shape rendering, hit state and render helpers with the next canvas polish pass. |
| P2 | 426 | `services/api/tangent_api/ai_provider_adapters.py` | Adapter dispatch and capability mapping are growing. | Split provider registry from request execution. |
| P2 | 422 | `services/api/tangent_api/ai_provider_jiekou.py` | Jiekou provider specifics are now large enough to deserve narrower helpers. | Split image/text payload building and response parsing. |
| P2 | 397 | `apps/web/src/components/konva-canvas/konvaChatNodeStreaming.ts` | Chat streaming UI/runtime bridge is dense. | Split stream transport, optimistic UI and message normalization. |

## Secret And Server Key Chain

### Authority Map

| Surface | Owns | Must never do |
| --- | --- | --- |
| Local `.env` | Developer-only local values. | Commit, paste into chat, or treat as remote truth. |
| Vercel env | Web runtime keys: `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`. | Put database/R2/provider secrets in browser-exposed vars. |
| Hetzner shared `~/apps/shared/staging/api.env` | API runtime truth: Supabase URLs, Clerk JWT settings, R2, email, Jiekou keys, realtime mode. | Keep live secrets only in old release dirs or old dirty worktrees. |
| Supabase dashboard | Database password/direct URL/pooler URL. | Reuse staging DB credentials for production. |
| Cloudflare R2 dashboard | Bucket-scoped access keys and bucket/prefix policy. | Reuse staging write key for production. |
| Clerk dashboard | Publishable/secret keys, JWT issuer/JWKS, redirects, authorized parties. | Mix development/production issuer or redirect state. |
| Google/email/payment dashboards | OAuth, sender, webhook and future live payment credentials. | Use live payment credentials before staging smoke is green. |
| Private operator storage | Redacted key chain notes, rotation date/reason, rollback notes. | Store raw secrets in tracked markdown. |

### Rotation And Expiry Rule

1. Comment expired key notes in private operator records with date, reason and replacement surface.
2. Do not delete the note unless the entire private operator worksheet is being replaced.
3. Update the actual runtime owner: Vercel for Web, Hetzner shared `api.env` for API, service dashboard for provider-side rotation.
4. Redeploy/restart only the affected runtime.
5. Run the matching smoke before marking the rotation green:
   - Clerk: `/api/auth/session`, `/api/v1/admin/me`, browser sign-in.
   - Supabase: Alembic head, `/health`, board list/open/save.
   - R2: upload/read/thumbnail after refresh.
   - Jiekou: one server-backed AI image smoke.
   - SSH/firewall: login with current key, verify password SSH disabled and UFW rules.

## Not Done / Next Round

1. Rerun a small signed-in Board browser spot check on staging for the now-wired `Manage board -> Copy board` Free-plan limit modal path.
2. Run R2 clean-bucket asset upload/read/thumbnail smoke.
3. Recreate minimal staging admin/workspace/board data after the clean Supabase reset.
4. Verify Google/email/logout/session-revocation flows.
5. Run one credentialed Jiekou-backed server AiRun image smoke.
6. Replace public `/pricing` static catalog with the backend public plan-catalog read if admin-edited prices must be launch-authoritative.
7. Finalize Privacy/Terms/AI policy text with operator address, support contact, subprocessor list and counsel/compliance review.
8. Tighten authenticated Subscription/Usage UI into vertical pricing/usage containers.
9. Real two-user browser collaboration smoke: invite, page delete fallback, draft preview, final snapshot recovery.
10. Redis/multi-instance collaboration backplane remains deferred until the P0 spine is green.
