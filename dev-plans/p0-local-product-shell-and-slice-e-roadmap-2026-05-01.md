# P0 Local Product Shell + Slice E Completion Roadmap

**Date**: 2026-05-01
**Branch**: `feature/asset-lod-roadmap`
**Latest committed checkpoint**: `5760541 checkpoint: landing nav shell regression`
**Status**: Active near-term coordination plan. L1 Product Shell skeleton plus App Shell 5-tab nav and Landing page / Collection / Account / Settings / Team / Subscription semantic cleanup, L2 Board save UX, L3 Workspace Board metadata polish, L4 Auth scaffold boundary, L5 AI contract scaffold, L6 database migration scaffold, L7 Board History and L8 Admin S0 planning have first-pass local checkpoints or documented boundaries, but they are not product-complete yet. Route/responsive browser smoke and Board autosave / rename / Back warning / multi-image paste regression passed on 2026-05-01. Board History browser smoke for autosave / Snapshot / Cmd+S / Restore-dirty-autosave passed on 2026-05-02. Workspace `lastOpenedAt` metadata, client-side Load more pagination and History API contract are now implemented locally.

This plan coordinates two near-term tracks:

1. Finish the parts of Slice E / Board persistence that can still be proven locally.
2. Add the visible product shell around the canvas without pretending real Auth, email, billing or collaboration are already done.

The goal is to turn the current project from "working canvas and persistence slices" into "a coherent local web app shell" while waiting for server, domain, database, object storage, email and AI provider resources.

---

## 1. Current Baseline

Already checkpointed through `5760541`, with subsequent local work in progress:

- `/workspaces` is the primary active-workspace Board gallery/list and supports list, create/open, search, sort, inline rename and delete confirmation; `/boards/:boardId` remains the canvas detail route.
- S0C Board metadata first pass is implemented after the checkpoint: Board summary carries `shapeCount`, `assetCount`, reserved `thumbnailUrl` and `lastOpenedAt`; `/workspaces` shows thumbnail placeholders, object counts, loading state, empty CTA, error retry, Recently opened sorting and client-side Load more pagination.
- S0D Auth scaffold first pass is implemented: typed session/user/workspace contract, mock session snapshot, persistence request context headers, Next/FastAPI session endpoints, default-off Web Proxy route guard shape and FastAPI auth-required smoke tests.
- S0E AI contract first pass is implemented: mock Model Registry and AiRun contracts exist on Next local bridge and FastAPI, Image Gen model selectors read the contract, and node Run creates a mock AiRun before updating runtime summary.
- AI node / AI Chat extensibility rules are documented in `ARCH.md` 4.4.1: future AI nodes must extend Node Registry, Model Registry and AiRun together; Chat planner outputs graph specs only.
- `/boards/:boardId` opens the canvas with Board-mode save/load through the same local/FastAPI persistence contract.
- `/boards/:boardId` has Board History first pass: autosave, Snapshot button and Cmd/Ctrl+S all write the same History timeline; History list/restore is available; free-tier retention defaults to latest 100 entries.
- Board History browser smoke passed on 2026-05-02: autosave writes `autosave`, Snapshot writes `manual`, Cmd+S writes `keyboard`, Restore marks the Board dirty and autosaves the restored document.
- Admin S0 boundary is documented: no full Mixpanel-grade backend now, but admin roles, audit logs, user notes, board members, credits/billing, AI API calls, analytics events and moderation facts have target schemas.
- Next local bridge and FastAPI both support Board validate/list/save/load/rename/delete/snapshot create/list/load.
- FastAPI supports local-dev Asset/Board routes, real `s3-compatible` Asset storage, Postgres Board persistence, Postgres Asset metadata and CORS allowlist.
- Web can switch from Next local bridge to FastAPI with `NEXT_PUBLIC_API_BASE_URL`.
- `deploy/staging/` contains the API Docker/compose/env/smoke package.
- Quality gates passed before checkpoint: `pytest`, `compileall`, web lint, web typecheck, web build and `git diff --check`.

---

## 2. What Can Be Done Locally Now

These items do not require a real server, domain, R2 bucket, managed database, email provider or AI provider key.

| Track | Local scope | Why now | Exit standard |
| --- | --- | --- | --- |
| Product shell | App Shell 5-tab navigation, `/home`, `/collections`, `/settings`, `/account`, `/team`, `/billing` semantic route shells plus `/login`, `/signup`, `/forgot-password`, `/verify-email` split-screen auth surfaces and `/workspaces` Board gallery/list with mock user/workspace state | Makes Board management live in the active workspace surface instead of the old table dashboard; prepares Auth, workspace, collection, management and subscription flows without pretending real library/team/payment behavior exists | First-pass routes render, Workspace lists Boards, Auth forms validate locally, Landing page / Collection / Account / Settings / Team / Subscription pages are semantically separate, no provider secrets in frontend |
| Board save UX | Autosave/debounce, save indicator, dirty/clean state, leave-page warning, load error fallback, dev save controls demoted | First pass is implemented locally in Board mode; keep validating with current persistence contract | First-pass refresh/reopen path works; long browser regression and failure polish remain |
| Board History | Autosave, Snapshot button and Cmd/Ctrl+S enter the same History timeline; History list/restore; free-tier latest-100 retention | Gives users recoverable milestones without splitting autosave and snapshot expectations | History document passes guard; list is summary-only; restore loads document and marks current Board dirty |
| Workspace Board polish | Thumbnail placeholder/field, object summary metadata, list limits, empty/loading/error states | First pass is implemented; finishes the current Board CRUD product surface before Auth | Multiple Boards remain manageable and list response still returns summary only |
| Auth scaffold | User/session/workspace TypeScript types, mock current-user endpoint or local store, route guard shape, Auth-required dev mode smoke | First pass is implemented; lets UI and API agree on the future boundary before real email/session implementation | Dev fallback works; `TANGENT_REQUIRE_API_AUTH=1` checks fail loudly without context; real session/cookie/JWT still pending |
| Asset/Board hardening | More persistence contract tests, object metadata edge cases, board thumbnail metadata, migration notes | Reduces staging surprises | Local/FastAPI tests cover workspace isolation and failure paths |
| Database schema scaffold | P0 schema roadmap, Alembic scaffold and first migration for Auth / Workspace / Board / Asset / AI Run / API log foundations | Prevents staging/prod from depending on opportunistic adapter table creation | `services/api/alembic.ini` and first migration exist; local-dev auto-create remains compatible |
| AI integration scaffold | Model Registry route with mock data, `AiRun` schema draft, server-only AI proxy stub, mock provider response shape | First pass is implemented; lets Image Gen UI stop hardcoding final model truth while keeping keys server-side later | No real provider call; Image Gen consumes registry/mock contract |
| Admin S0 planning | Admin access boundary, role/audit/user note schema, Board membership, credits/billing, AI API call facts, analytics/moderation event facts | Future `/admin`、用户管理、模型线路、积分、会员、留存和审核面板必须有真实数据源 | `ARCH.md` / `PRD.md` / DB roadmap 记录边界；真实 Auth 前不开放生产 Admin |

Recommended local order:

1. **App shell + route skeletons**: global navigation plus auth/landing/workspace/collection/settings/account/team/subscription mock pages.
2. **Board save UX**: first pass is implemented; `/boards/:boardId` has autosave, save indicator, dirty warning and title sync. Browser regression for rename, Back warning, autosave and multi-image paste has passed.
3. **Workspace Board polish**: recent opened metadata and client-side Load more pagination are implemented; remaining work is captured thumbnail and server-side pagination after real DB scale.
4. **Auth scaffold**: first pass is implemented; remaining work is real session/cookie/JWT after external resources.
5. **AI scaffold**: first pass is implemented; remaining work is real provider proxy, run persistence and asset-backed outputs.
6. **Database scaffold**: first migration scaffold is implemented; remaining work is running it against real staging Postgres and replacing dev fallback context with real Auth tables.
7. **Board History**: first pass is implemented; remaining work is browser restore regression, captured thumbnails for history entries and paid retention tiers.
8. **Admin S0 planning**: schema/access/audit boundary is documented; remaining work is a later migration and `/admin` scaffold after real Auth/session exists.

---

## 3. What Must Wait For External Resources

These should be tracked as setup tasks, not faked as finished product behavior.

| Resource | Blocks |
| --- | --- |
| Git remote / deploy platform | Real push/deploy workflow, staging rollback, branch protection |
| Server/VPS or API deploy target | Public FastAPI smoke, API domain, HTTPS reverse proxy |
| Managed Postgres | Real user/workspace/board/asset/ai_run persistence and backup policy |
| R2/S3 bucket credentials and CORS | Production object storage, real asset file retention and guarded reads |
| Domain/DNS/TLS | Staging/prod origins, cookies, CORS, tldraw production license domain |
| Email provider and sender domain | OTP/magic link, SPF/DKIM/DMARC, real signup verification |
| AI provider key/billing | Real Prompt -> Image Gen / Image Gen 4 -> Asset calls, cost logs |
| tldraw production license | Production build without license gate |

---

## 4. Near-Term Sprint Queue

| Sprint | Scope | Estimate | Done standard |
| --- | --- | ---: | --- |
| L0 | Document coordination and checkpoint | done | `5760541` is the latest committed checkpoint; this roadmap, `ARCH.md` and `project_state.md` point to the same local plan |
| L1 | Product shell skeleton | first-pass checkpoint + Auth/Workspaces visual pass + management semantics pass | `/login`, `/signup`, `/forgot-password`, `/verify-email` render as Quiet Editorial split-screen auth surfaces; App Shell uses the reference top nav + left workspace sidebar on product pages, with top labels Landing page / Workspace / Collection / Team / Subscription; Landing page is top-nav only and is not shown in the sidebar; `/workspaces` renders active workspace Board gallery/list with Gallery/List toggle, search, sort, create/open/rename/copy/delete and card footers for collaborators / Panel / menu; Board placeholder icon is unified ochre; user-editable card color is deferred to the future Panel / Board management flow; `/`, `/dashboard` and `/boards` list entry redirect to `/workspaces`; `/home` is a local Landing page shell; `/collections` is a Collection placeholder; `/account` is a mock personal account center; `/settings` is app settings only; `/team` and `/billing` are explicit placeholders; real Auth/session/workspace creation, collection CRUD, team invites and subscription billing are not done |
| L2 | Board save UX | browser regression pass | Autosave debounce is now 1200ms with signature dedupe; dirty indicator, save error state, refresh/close/Back warning, title rename sync and JSON-safe image asset migration work in `/boards/:boardId`; browser smoke covered rename persistence, Back warning cancel and multi-image paste save without tldraw asset meta validation errors |
| L3 | Workspace Board metadata polish | first-pass checkpoint + recent-open pass | Board gallery/list shows thumbnail placeholder, shape/asset counts, loading skeleton, empty CTA and error retry; opening a Board stamps `lastOpenedAt`, Workspace can sort by Recently opened / Recently saved, and gallery/list renders an initial page with Load more. Captured thumbnails and server-side pagination remain later |
| L4 | Auth scaffold boundary | first-pass checkpoint | Typed current-user/session/workspace boundary, Next/FastAPI session endpoints, default-off route guard shape and dev auth-required smoke exist without real email |
| L5 | AI contract scaffold | first-pass checkpoint | Mock Model Registry and `AiRun` contract are server-owned; frontend model selectors consume the contract; real provider, persistence and cost guard remain later |
| L6 | Database migration scaffold | first-pass checkpoint | `dev-plans/p0-database-schema-roadmap-2026-05-01.md` records P0 schema; `services/api` has Alembic config and first migration for users/workspaces/boards/board_snapshots/assets/model options/AI runs/API logs; local-dev auto-create remains available |
| L7 | Board History | browser-smoke checkpoint | Autosave, Snapshot button and Cmd/Ctrl+S write the same History list/restore timeline; Restore marks the Board dirty and autosaves the restored document; Next/FastAPI/Postgres history contract and free-tier latest-100 retention exist; Pro/Enterprise retention and object-storage history body remain later |
| L8 | Admin S0 planning | documented boundary | Admin roles/audit/user notes、Board members、credits/billing、AI API calls、analytics events 和 moderation facts 已纳入 ARCH / PRD / DB roadmap；完整 Admin Analytics、真实 impersonation、Stripe revenue dashboard 和内容审核工作台后置 |

After L1-L7, switch to the external-resource stages in `ARCH.md` 11.5:

- staging API + Postgres + R2 + domains,
- deploy/push workflow,
- real Auth/email/session,
- real AI provider and cost guard,
- Alpha security/ops.

---

## 5. Guardrails

- Do not implement real OAuth, email sending, billing, team invites or multiplayer inside the local product shell sprint.
- Do not implement full Admin Analytics in the local product shell sprint. Admin S0 is a data/access/audit boundary first; production `/admin` waits for real Auth and server-side `admin_roles`.
- Keep Collection, Team and Subscription as separate placeholder pages until real Auth/workspace/payment/resources exist; do not route them back into `/workspaces` or hide them inside Settings.
- Do not put API keys or AI provider config in frontend code.
- Do not add new AI nodes or AI Chat tools as one-off UI calls. Add the node spec, model capability, AiRun `runType`, route/test coverage and persistence guard together, following `ARCH.md` 4.4.1.
- Use `reference/Design.md` as the canonical Product Shell design source and `reference/Design_reference.md` as the extracted Stitch page reference. Do not use the older `reference/design-system.md` or `reference/theme.ts` for this frontend page work.
- Keep `/spikes/canvas` as a technical validation route, but make `/workspaces` and `/boards/:boardId` the product path.
- Keep list responses summary-only; full Board document is only returned by explicit load.
- Keep History list responses summary-only; full history document is only returned by explicit load.
- History documents follow the same guard as Board save and must not contain `data:` / `blob:` / Base64 image payloads or Provider raw responses.
- Board title is persisted metadata. Loading `/boards/:boardId` must use the stored `board.title`, and autosave must not overwrite it with a URL-derived fallback.
- Workspace Board title click behavior: single-click opens the Board, double-click renames it, and the Open / Rename controls stay available.
- Workspace Board title uses a click-count guard so double-click rename does not accidentally fire the single-click open action first.
- tldraw asset `meta` must stay JSON-safe. Do not spread runtime `asset.meta` into persisted image assets; only write sanitized `tangentAsset` metadata.
- `apps/web/src/components/canvas/CanvasBoardSaveAudit.tsx` is back near the 300-line limit after history orchestration; split save/history orchestration before adding more behavior.
- `apps/web/src/components/workspaces/WorkspaceBoardGallery.tsx` is the current Board entry surface and is under 250 lines; keep splitting helpers before adding more workspace behavior.
- Dashboard CSS has been split into `boards.css` and `boards-list.css`; keep further table/list styling in the split list file or smaller modules.
- Continue using the standard gates: `PYTHONPATH=services/api python3 -m pytest services/api/tests`, `python3 -m compileall services/api/tangent_api`, web lint/typecheck/build and `git diff --check`.
