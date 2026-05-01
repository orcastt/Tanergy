# P0 Local Product Shell + Slice E Completion Roadmap

**Date**: 2026-05-01
**Branch**: `feature/asset-lod-roadmap`
**Base checkpoint**: `5ffed96 feat: productize board dashboard crud`
**Status**: Active near-term coordination plan. L1 Product Shell skeleton and L2 Board save UX have first-pass local checkpoints, but they are not product-complete yet.

This plan coordinates two near-term tracks:

1. Finish the parts of Slice E / Board persistence that can still be proven locally.
2. Add the visible product shell around the canvas without pretending real Auth, email, billing or collaboration are already done.

The goal is to turn the current project from "working canvas and persistence slices" into "a coherent local web app shell" while waiting for server, domain, database, object storage, email and AI provider resources.

---

## 1. Current Baseline

Already checkpointed in `5ffed96`:

- `/boards` Dashboard supports list, create/open, search, inline rename and delete confirmation.
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
| Product shell | App shell navigation, `/login`, `/signup`, `/forgot-password`, `/verify-email`, `/workspaces` or `/dashboard`, `/settings`, `/account` route skeletons with mock user/workspace state | Makes `/boards` stop feeling like an isolated spike; prepares Auth and workspace flows | First-pass routes render, navigation works, forms validate locally, no provider secrets in frontend |
| Board save UX | Autosave/debounce, save indicator, dirty/clean state, leave-page warning, load error fallback, dev save controls demoted | First pass is implemented locally in Board mode; keep validating with current persistence contract | First-pass refresh/reopen path works; long browser regression and failure polish remain |
| Dashboard polish | Thumbnail placeholder/field, recent saved/opened metadata, pagination/list limits, empty/loading/error states | Finishes the current Board CRUD product surface before Auth | Multiple Boards remain manageable and list response still returns summary only |
| Auth scaffold | User/session/workspace TypeScript types, mock current-user endpoint or local store, route guard shape, Auth-required dev mode smoke | Lets UI and API agree on the future boundary before real email/session implementation | Dev fallback works; `TANGENT_REQUIRE_API_AUTH=1` style checks still fail loudly without context |
| Asset/Board hardening | More persistence contract tests, object metadata edge cases, board thumbnail metadata, migration notes | Reduces staging surprises | Local/FastAPI tests cover workspace isolation and failure paths |
| AI integration scaffold | Model Registry route with mock data, `AiRun` schema draft, server-only AI proxy stub, mock provider response shape | Lets Image Gen UI stop hardcoding final model truth while keeping keys server-side later | No real provider call; Image Gen can consume registry/mock contract |

Recommended local order:

1. **App shell + route skeletons**: global navigation plus auth/workspace/settings/account mock pages.
2. **Board save UX**: first pass is implemented; `/boards/:boardId` has autosave, save indicator and dirty warning, but long-form browser regression remains.
3. **Dashboard polish**: thumbnails/recent metadata/pagination/empty and error states.
4. **Auth scaffold**: typed session/workspace boundary and route guard shape.
5. **AI scaffold**: Model Registry + mock `AiRun` contract, no real key yet.

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
| L0 | Document coordination and checkpoint | done | `5ffed96` committed; this roadmap, `ARCH.md` and `project_state.md` point to the same local plan |
| L1 | Product shell skeleton | first-pass checkpoint | `/login`, `/signup`, `/forgot-password`, `/verify-email`, `/workspaces`, `/dashboard` redirect, `/settings`, `/account` render with mock state and connect to `/boards`; real Auth/session is not done |
| L2 | Board save UX | first-pass checkpoint | Autosave/debounce, dirty indicator, save error state and leave warning work in `/boards/:boardId`; long-form browser regression and failure polish remain |
| L3 | Dashboard metadata polish | 1-2 days | Board list shows thumbnail placeholder/summary metadata, recent opened/saved time and pagination or list limit |
| L4 | Auth scaffold boundary | 2-3 days | Typed current-user/session/workspace boundary, route guard shape and dev auth-required mode smoke exist without real email |
| L5 | AI contract scaffold | 2-3 days | Mock Model Registry and `AiRun` contract are server-owned; frontend model selectors consume the contract |

After L1-L5, switch to the external-resource stages in `ARCH.md` 11.5:

- staging API + Postgres + R2 + domains,
- deploy/push workflow,
- real Auth/email/session,
- real AI provider and cost guard,
- Alpha security/ops.

---

## 5. Guardrails

- Do not implement real OAuth, email sending, billing, team invites or multiplayer inside the local product shell sprint.
- Do not put API keys or AI provider config in frontend code.
- Use `reference/Design.md` as the Product Shell design source. Do not use the older `reference/design-system.md` or `reference/theme.ts` for this frontend page work.
- Keep `/spikes/canvas` as a technical validation route, but make `/boards` and `/boards/:boardId` the product path.
- Keep list responses summary-only; full Board document is only returned by explicit load.
- `apps/web/src/components/canvas/CanvasBoardSaveAudit.tsx` is near the 300-line hard limit after autosave/status work. Split save actions / status UI before adding more behavior.
- `apps/web/src/app/styles/boards.css` is at the 250-line warning threshold. Split CSS before adding substantial Dashboard styling.
- Continue using the standard gates: `PYTHONPATH=services/api python3 -m pytest services/api/tests`, `python3 -m compileall services/api/tangent_api`, web lint/typecheck/build and `git diff --check`.
