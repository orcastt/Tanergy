# P0 Local Product Shell + Slice E Completion Roadmap

**Date**: 2026-05-01
**Branch**: `feature/asset-lod-roadmap`
**Previous committed checkpoint before context split**: `47d6d0f checkpoint: board management and arch progress map`
**Status**: Active local backlog. L1 Product Shell skeleton plus App Shell 5-tab nav and Landing page / Collection / Account / Settings / Team / Subscription semantic cleanup, L2 Board save UX, L3 Workspace Board metadata polish, L4 Auth scaffold boundary, L5 AI contract scaffold, L6 database migration scaffold, L7 Board History, L8 Admin S0 planning, L9 Smart Drawing first pass, L10 captured Board thumbnail first pass, expanded Board Management Panel metadata and per-board Canvas Settings have first-pass local checkpoints or documented boundaries, but they are not product-complete yet. Route/responsive browser smoke and Board autosave / rename / Back warning / multi-image paste regression passed on 2026-05-01. Board History browser smoke for autosave / Snapshot / Cmd+S / Restore-dirty-autosave passed on 2026-05-02. Workspace `lastOpenedAt` metadata, client-side Load more pagination, expanded Board Management Panel metadata, per-board Canvas Settings, History API contract, save-time captured thumbnail and Smart Drawing first pass are now implemented locally. Smart Drawing has passed front-end gates and recognizer smoke; browser tuning is still pending. Remaining local candidates before external resources are long-session regression, manual/History thumbnail polish, Smart Drawing browser tuning and i18n/status polish.

**Context split**: 2026-05-02 新增 `ARCH/` 和 `Project_state/` 短上下文层。后续本地小 UI polish 优先更新 `Project_state/current-slice.md`、`ARCH/Slice-S0-local-polish.md` 和本计划；涉及 API、数据库、Auth、AI、Admin、Deploy、Billing 或协作时才同步整套 `ARCH.md` / `PRD.md` / `HARNESS.md`。

This plan coordinates two near-term tracks:

1. Finish the parts of Slice E / Board persistence that can still be proven locally.
2. Add the visible product shell around the canvas without pretending real Auth, email, billing or collaboration are already done.

The goal is to turn the current project from "working canvas and persistence slices" into "a coherent local web app shell" while waiting for server, domain, database, object storage, email and AI provider resources.

---

## 1. Current Baseline

Already checkpointed through `47d6d0f`, with the context split and handoff docs now being captured in the current checkpoint:

- `/workspaces` is the primary active-workspace Board gallery/list and supports list, create/open, search, sort, inline rename and delete confirmation; `/boards/:boardId` remains the canvas detail route.
- S0C/S0I Board metadata first pass is implemented after the checkpoint: Board summary carries `shapeCount`, `assetCount`, `thumbnailUrl` and `lastOpenedAt`; `/workspaces` shows thumbnail placeholders or captured previews, object counts, loading state, empty CTA, error retry, Recently opened sorting and client-side Load more pagination.
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
| Board History | Autosave, Snapshot button and Cmd/Ctrl+S enter the same History timeline; History list/restore/filter; author display; free-tier autosave 100 + user saves 100 bucketed retention | Gives users recoverable milestones without splitting autosave and snapshot expectations | History document passes guard; list is summary-only; restore loads document and marks current Board dirty |
| Board Canvas Settings | Per-board dots/grid/solid background, background/pattern color, spacing, snap strength and reference-style compact settings panel | Lets each board keep its own visual surface and interaction feel without external resources | Settings persist in lightweight `canvasSettings`, restore with Board/History, dots remain subtle, and the panel follows the latest Canvas Settings reference layout |
| Workspace Board polish | Thumbnail placeholder/field/upload, object summary metadata, star/pin/share/visibility metadata, Board details, member management scaffold, list limits, empty/loading/error states | First pass is implemented; finishes the current Board CRUD product surface before Auth | Multiple Boards remain manageable and list response still returns summary only |
| Auth scaffold | User/session/workspace TypeScript types, mock current-user endpoint or local store, route guard shape, Auth-required dev mode smoke | First pass is implemented; lets UI and API agree on the future boundary before real email/session implementation | Dev fallback works; `TANGENT_REQUIRE_API_AUTH=1` checks fail loudly without context; real session/cookie/JWT still pending |
| Asset/Board hardening | More persistence contract tests, object metadata edge cases, board thumbnail metadata, migration notes | Reduces staging surprises | Local/FastAPI tests cover workspace isolation and failure paths |
| Database schema scaffold | P0 schema roadmap, Alembic scaffold and first migration for Auth / Workspace / Board / Asset / AI Run / API log foundations | Prevents staging/prod from depending on opportunistic adapter table creation | `services/api/alembic.ini` and first migration exist; local-dev auto-create remains compatible |
| AI integration scaffold | Model Registry route with mock data, `AiRun` schema draft, server-only AI proxy stub, mock provider response shape | First pass is implemented; lets Image Gen UI stop hardcoding final model truth while keeping keys server-side later | No real provider call; Image Gen consumes registry/mock contract |
| Admin S0 planning | Admin access boundary, role/audit/user note schema, Board membership, credits/billing, AI API call facts, analytics/moderation event facts | Future `/admin`、用户管理、模型线路、积分、会员、留存和审核面板必须有真实数据源 | `ARCH.md` / `PRD.md` / DB roadmap 记录边界；真实 Auth 前不开放生产 Admin |
| Smart Drawing | 手绘线条/形状本地拟合：直线、曲线、椭圆、矩形、三角形、低置信度保留原样、undo | 用户想要更像白板产品的“画歪也能整理干净”体验；纯本地实现，不等外部资源 | first pass 已接入独立 recognizer / canvas hook / settings toggle；前端闸门和 recognizer smoke 已通过；待浏览器 smoke 和阈值调参 |

Recommended local order:

1. **App shell + route skeletons**: global navigation plus auth/landing/workspace/collection/settings/account/team/subscription mock pages.
2. **Board save UX**: first pass is implemented; `/boards/:boardId` has autosave, save indicator, dirty warning and title sync. Browser regression for rename, Back warning, autosave and multi-image paste has passed.
3. **Workspace Board polish**: recent opened metadata, client-side Load more pagination, settings-like Board Management Panel metadata, owner/admin editable guard, thumbnail remove-to-default and save-time captured thumbnail first pass are implemented; remaining work is manual thumbnail refresh, History thumbnails, real share/member permissions and server-side pagination after real DB scale.
4. **Auth scaffold**: first pass is implemented; remaining work is real session/cookie/JWT after external resources.
5. **AI scaffold**: first pass is implemented; remaining work is real provider proxy, run persistence and asset-backed outputs.
6. **Database scaffold**: first migration scaffold is implemented; remaining work is running it against real staging Postgres and replacing dev fallback context with real Auth tables.
7. **Board History**: first pass is implemented; remaining work is browser restore regression, captured thumbnails for history entries and paid retention tiers.
8. **Per-board Canvas Settings**: dots/grid/solid background, background/pattern color, snap strength and the compact reference-style panel are implemented; remaining work is browser visual regression across zoom/device sizes.
9. **Admin S0 planning**: schema/access/audit boundary is documented; remaining work is a later migration and `/admin` scaffold after real Auth/session exists.
10. **Smart Drawing**: first pass implemented and front-end gates / recognizer smoke have passed; remaining work is browser smoke, threshold tuning, optional strength setting and diamond/arrow recognition later.
11. **Captured thumbnail**: first pass implemented; the most product-visible remaining polish is manual refresh, History entry thumbnails and staging R2/Postgres smoke.

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
| L0 | Document coordination and checkpoint | done | `47d6d0f` is the previous committed checkpoint; the current checkpoint adds the `ARCH/` and `Project_state/` short context split |
| L1 | Product shell skeleton | first-pass checkpoint + Auth/Workspaces visual pass + management semantics pass | `/login`, `/signup`, `/forgot-password`, `/verify-email` render as Quiet Editorial split-screen auth surfaces; App Shell uses the reference top nav + left workspace sidebar on product pages, with top labels Landing page / Workspace / Collection / Team / Subscription; Landing page is top-nav only and is not shown in the sidebar; `/workspaces` renders active workspace Board gallery/list with Gallery/List toggle, search, sort, create/open/rename/copy/delete and card footers for collaborators / Manage / menu; Board placeholder icon is unified ochre; Manage opens a settings-like Board management panel for title, description, card color, thumbnail upload/remove, copy link, invite placeholder, open/copy/delete and owner/admin editable guard; `/`, `/dashboard` and `/boards` list entry redirect to `/workspaces`; `/home` is a local Landing page shell; `/collections` is a Collection placeholder; `/account` is a mock personal account center; `/settings` is app settings only; `/team` and `/billing` are explicit placeholders; real Auth/session/workspace creation, collection CRUD, team invites and subscription billing are not done |
| L2 | Board save UX | browser regression pass | Autosave debounce is now 1200ms with signature dedupe; dirty indicator, save error state, refresh/close/Back warning, title rename sync and JSON-safe image asset migration work in `/boards/:boardId`; browser smoke covered rename persistence, Back warning cancel and multi-image paste save without tldraw asset meta validation errors |
| L3 | Workspace Board metadata polish | first-pass checkpoint + recent-open + management metadata + captured thumbnail pass | Board gallery/list shows thumbnail placeholder or captured preview, shape/asset counts, loading skeleton, empty CTA and error retry; opening a Board stamps `lastOpenedAt`, Workspace can sort by Recently opened / Recently saved, gallery/list renders an initial page with Load more, and Board Panel persists `description` / `cardColor` / `isPinned` / `isStarred` / `visibility` / `shareId` / editable `thumbnailUrl` outside the Board document. Panel is now settings-like instead of a right drawer, has top Copy link / Invite / Open / Save actions, supports thumbnail Remove-to-default, keeps details in the left info column and Members in the right column, and shows owner/admin editable versus editor/viewer read-only UI states. Gallery/list cards show right-corner pin + visibility icons, share/copy shows a copied toast, public/private actions alternate with confirmation, and copy board keeps card color. Manual thumbnail refresh, History thumbnails, real share permissions, real member persistence and server-side pagination remain later |
| L4 | Auth scaffold boundary | first-pass checkpoint | Typed current-user/session/workspace boundary, Next/FastAPI session endpoints, default-off route guard shape and dev auth-required smoke exist without real email |
| L5 | AI contract scaffold | first-pass checkpoint | Mock Model Registry and `AiRun` contract are server-owned; frontend model selectors consume the contract; real provider, persistence and cost guard remain later |
| L6 | Database migration scaffold | first-pass checkpoint | `dev-plans/p0-database-schema-roadmap-2026-05-01.md` records P0 schema; `services/api` has Alembic config and first migration for users/workspaces/boards/board_snapshots/assets/model options/AI runs/API logs; local-dev auto-create remains available |
| L7 | Board History | browser-smoke checkpoint | Autosave, Snapshot button and Cmd/Ctrl+S write the same History list/restore timeline; History supports all/autosave/user saves filter, author display and autosave/user visual distinction; Restore marks the Board dirty and autosaves the restored document; Next/FastAPI/Postgres history contract and free-tier autosave 100 + user saves 100 bucketed retention exist; Pro/Enterprise retention and object-storage history body remain later |
| L8 | Admin S0 planning | documented boundary | Admin roles/audit/user notes、Board members、credits/billing、AI API calls、analytics events 和 moderation facts 已纳入 ARCH / PRD / DB roadmap；完整 Admin Analytics、真实 impersonation、Stripe revenue dashboard 和内容审核工作台后置 |
| L9 | Smart Drawing | first-pass checkpoint + code gates pass | Smart Drawing 是本地几何拟合工具，不调用 AI provider；第一版已接独立 recognizer / canvas hook / settings toggle，目标是直线、开放曲线、椭圆、矩形、三角形、低置信度保留原样和 undo；前端闸门和 recognizer smoke 已通过，待浏览器 smoke 与阈值调参 |
| L10 | Captured Board thumbnail | first-pass checkpoint | 保存时若 Board 没有自定义 thumbnail，会生成轻量 WebP Board preview，上传为 Asset，并把缩略图 URL 作为 Board metadata 供 Workspace card 使用；失败时保留 deterministic placeholder，不把缩略图 binary 写进 Board document。手动刷新和 History thumbnail 后续补 |
| L11 | Smart Drawing implementation | merged into L9 first pass | 在 draw 工具落笔后本地识别直线、开放曲线、椭圆、矩形、三角形等，输出普通 tldraw shape；低置信度保留原 stroke；支持 undo 与设置开关。剩余是浏览器 smoke、阈值调参和更丰富形状 |

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
- Do not bolt additional Smart Drawing behavior directly into `CanvasSpikeToolbar.tsx`. Continue through the dedicated recognizer/controller hook that outputs normal tldraw shapes and preserves undo.
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
- `apps/web/src/components/canvas/CanvasBoardSaveAudit.tsx` is back near the 300-line limit after history + thumbnail orchestration; split save/history orchestration before adding more behavior.
- `apps/web/src/components/workspaces/WorkspaceBoardGallery.tsx` is the current Board entry surface and is under 250 lines; keep splitting helpers before adding more workspace behavior.
- Dashboard CSS has been split into `boards.css` and `boards-list.css`; keep further table/list styling in the split list file or smaller modules.
- Continue using the standard gates: `PYTHONPATH=services/api python3 -m pytest services/api/tests`, `python3 -m compileall services/api/tangent_api`, web lint/typecheck/build and `git diff --check`.
