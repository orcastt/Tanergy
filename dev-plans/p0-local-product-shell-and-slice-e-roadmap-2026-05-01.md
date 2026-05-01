# P0 Local Product Shell + Slice E Completion Roadmap

**Date**: 2026-05-01
**Branch**: `feature/asset-lod-roadmap`
**Latest committed checkpoint**: `eb9ddd6 checkpoint: dashboard metadata and auth scaffold`
**Status**: Active near-term coordination plan. L1 Product Shell skeleton plus App Shell 5-tab nav and Landing page / Collection / Account / Settings / Team / Subscription semantic cleanup, L2 Board save UX, L3 Workspace Board metadata polish, L4 Auth scaffold boundary and L5 AI contract scaffold have first-pass local checkpoints, but they are not product-complete yet. Route/responsive browser smoke and Board autosave / rename / Back warning / multi-image paste regression passed on 2026-05-01.

This plan coordinates two near-term tracks:

1. Finish the parts of Slice E / Board persistence that can still be proven locally.
2. Add the visible product shell around the canvas without pretending real Auth, email, billing or collaboration are already done.

The goal is to turn the current project from "working canvas and persistence slices" into "a coherent local web app shell" while waiting for server, domain, database, object storage, email and AI provider resources.

---

## 1. Current Baseline

Already checkpointed in `5ffed96`:

- `/workspaces` is the primary active-workspace Board gallery/list and supports list, create/open, search, sort, inline rename and delete confirmation; `/boards/:boardId` remains the canvas detail route.
- S0C Board metadata first pass is implemented after the checkpoint: Board summary carries `shapeCount`, `assetCount` and reserved `thumbnailUrl`; `/workspaces` shows thumbnail placeholders, object counts, loading state, empty CTA and error retry.
- S0D Auth scaffold first pass is implemented: typed session/user/workspace contract, mock session snapshot, persistence request context headers, Next/FastAPI session endpoints, default-off Web Proxy route guard shape and FastAPI auth-required smoke tests.
- S0E AI contract first pass is implemented: mock Model Registry and AiRun contracts exist on Next local bridge and FastAPI, Image Gen model selectors read the contract, and node Run creates a mock AiRun before updating runtime summary.
- AI node / AI Chat extensibility rules are documented in `ARCH.md` 4.4.1: future AI nodes must extend Node Registry, Model Registry and AiRun together; Chat planner outputs graph specs only.
- `/boards/:boardId` opens the canvas with Board-mode save/load through the same local/FastAPI persistence contract.
- Next local bridge and FastAPI both support Board validate/list/save/load/rename/delete.
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
| Workspace Board polish | Thumbnail placeholder/field, object summary metadata, list limits, empty/loading/error states | First pass is implemented; finishes the current Board CRUD product surface before Auth | Multiple Boards remain manageable and list response still returns summary only |
| Auth scaffold | User/session/workspace TypeScript types, mock current-user endpoint or local store, route guard shape, Auth-required dev mode smoke | First pass is implemented; lets UI and API agree on the future boundary before real email/session implementation | Dev fallback works; `TANGENT_REQUIRE_API_AUTH=1` checks fail loudly without context; real session/cookie/JWT still pending |
| Asset/Board hardening | More persistence contract tests, object metadata edge cases, board thumbnail metadata, migration notes | Reduces staging surprises | Local/FastAPI tests cover workspace isolation and failure paths |
| AI integration scaffold | Model Registry route with mock data, `AiRun` schema draft, server-only AI proxy stub, mock provider response shape | First pass is implemented; lets Image Gen UI stop hardcoding final model truth while keeping keys server-side later | No real provider call; Image Gen consumes registry/mock contract |

Recommended local order:

1. **App shell + route skeletons**: global navigation plus auth/landing/workspace/collection/settings/account/team/subscription mock pages.
2. **Board save UX**: first pass is implemented; `/boards/:boardId` has autosave, save indicator, dirty warning and title sync. Browser regression for rename, Back warning, autosave and multi-image paste has passed.
3. **Workspace Board polish**: first pass is implemented; remaining work is recent opened metadata and richer pagination.
4. **Auth scaffold**: first pass is implemented; remaining work is real session/cookie/JWT after external resources.
5. **AI scaffold**: first pass is implemented; remaining work is real provider proxy, run persistence and asset-backed outputs.

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
| L0 | Document coordination and checkpoint | done | `eb9ddd6` is the latest committed checkpoint; this roadmap, `ARCH.md` and `project_state.md` point to the same local plan |
| L1 | Product shell skeleton | first-pass checkpoint + Auth/Workspaces visual pass + management semantics pass | `/login`, `/signup`, `/forgot-password`, `/verify-email` render as Quiet Editorial split-screen auth surfaces; App Shell uses the reference top nav + left workspace sidebar on product pages, with top labels Landing page / Workspace / Collection / Team / Subscription; Landing page is top-nav only and is not shown in the sidebar; `/workspaces` renders active workspace Board gallery/list with Gallery/List toggle, search, sort, create/open/rename/copy/delete and card footers for collaborators / Panel / menu; Board placeholder icon is unified ochre; user-editable card color is deferred to the future Panel / Board management flow; `/`, `/dashboard` and `/boards` list entry redirect to `/workspaces`; `/home` is a local Landing page shell; `/collections` is a Collection placeholder; `/account` is a mock personal account center; `/settings` is app settings only; `/team` and `/billing` are explicit placeholders; real Auth/session/workspace creation, collection CRUD, team invites and subscription billing are not done |
| L2 | Board save UX | browser regression pass | Autosave debounce is now 1200ms with signature dedupe; dirty indicator, save error state, refresh/close/Back warning, title rename sync and JSON-safe image asset migration work in `/boards/:boardId`; browser smoke covered rename persistence, Back warning cancel and multi-image paste save without tldraw asset meta validation errors |
| L3 | Workspace Board metadata polish | first-pass checkpoint | Board gallery/list shows thumbnail placeholder, shape/asset counts, loading skeleton, empty CTA and error retry; recent-open metadata and richer pagination remain later |
| L4 | Auth scaffold boundary | first-pass checkpoint | Typed current-user/session/workspace boundary, Next/FastAPI session endpoints, default-off route guard shape and dev auth-required smoke exist without real email |
| L5 | AI contract scaffold | first-pass checkpoint | Mock Model Registry and `AiRun` contract are server-owned; frontend model selectors consume the contract; real provider, persistence and cost guard remain later |

After L1-L5, switch to the external-resource stages in `ARCH.md` 11.5:

- staging API + Postgres + R2 + domains,
- deploy/push workflow,
- real Auth/email/session,
- real AI provider and cost guard,
- Alpha security/ops.

---

## 5. Guardrails

- Do not implement real OAuth, email sending, billing, team invites or multiplayer inside the local product shell sprint.
- Keep Collection, Team and Subscription as separate placeholder pages until real Auth/workspace/payment/resources exist; do not route them back into `/workspaces` or hide them inside Settings.
- Do not put API keys or AI provider config in frontend code.
- Do not add new AI nodes or AI Chat tools as one-off UI calls. Add the node spec, model capability, AiRun `runType`, route/test coverage and persistence guard together, following `ARCH.md` 4.4.1.
- Use `reference/Design.md` as the canonical Product Shell design source and `reference/Design_reference.md` as the extracted Stitch page reference. Do not use the older `reference/design-system.md` or `reference/theme.ts` for this frontend page work.
- Keep `/spikes/canvas` as a technical validation route, but make `/workspaces` and `/boards/:boardId` the product path.
- Keep list responses summary-only; full Board document is only returned by explicit load.
- Board title is persisted metadata. Loading `/boards/:boardId` must use the stored `board.title`, and autosave must not overwrite it with a URL-derived fallback.
- Workspace Board title click behavior: single-click opens the Board, double-click renames it, and the Open / Rename controls stay available.
- Workspace Board title uses a click-count guard so double-click rename does not accidentally fire the single-click open action first.
- tldraw asset `meta` must stay JSON-safe. Do not spread runtime `asset.meta` into persisted image assets; only write sanitized `tangentAsset` metadata.
- `apps/web/src/components/canvas/CanvasBoardSaveAudit.tsx` has been split below the 250-line warning via `useBoardSaveLifecycle.ts`; keep status/control rendering in `CanvasBoardSaveControls.tsx`, and split save actions before adding larger behavior.
- `apps/web/src/components/workspaces/WorkspaceBoardGallery.tsx` is the current Board entry surface and is under 250 lines; keep splitting helpers before adding more workspace behavior.
- Dashboard CSS has been split into `boards.css` and `boards-list.css`; keep further table/list styling in the split list file or smaller modules.
- Continue using the standard gates: `PYTHONPATH=services/api python3 -m pytest services/api/tests`, `python3 -m compileall services/api/tangent_api`, web lint/typecheck/build and `git diff --check`.
