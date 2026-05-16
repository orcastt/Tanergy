# TANGENT Project State Index

**Updated**: 2026-05-16
**Branch**: `feature/s1c-auth-admin-production-boundary`
**Latest local checkpoint**: S1X Konva route stabilization + local collaboration presence/read-only foundation + passive remote-save sync + local Yjs room/snapshot foundation with visible sync state, deferred remote-apply controls, native page/shape/edge Yjs storage, collaboration-origin autosave suppression, structural page-reconcile improvements, server-room-key alignment, provider-ready transport shaping, document/awareness initial-sync gating, bounded websocket queued-update reconnect semantics and local collaborative undo/redo + S1D permission/share hardening + S2/S3 DB-backed AI control-plane scaffolds + first-pass billing/team/usage/admin surfaces + S3 admin-operator acceptance pass + DB-backed workspace/subscription frontend alignment + GeekAI local canvas UX proof + admin hot-path performance cleanup with pooled Postgres runtime preference and slow-SQL observability + backend text `AiRun` support with durable terminal `text_output` persistence, Prompt Optimizer remote create/poll/cancel wiring and message-native chat backendization + rebuilt S1B staging API host recovery with rotated Neon/R2 runtime secrets, hardened SSH, Docker/Caddy restore, wheel-safe API env bootstrap, green local/public API smoke on `api-staging.tanergy.cc`, a root-level Vercel packaging cleanup, restored production `CLERK_SECRET_KEY`, a fresh `staging.tanergy.cc` alias that now serves the Konva-only web deploy without the old tldraw/license failure, real Clerk session/admin smoke on staging, the 2026-05-14 AI image-model refresh onto GPT Image 2, Nano Banana 2, Doubao Seedream 5.0 Lite and Jimeng 4.0 with a 240s live-image timeout boundary, and the 2026-05-16 shared account-deletion path that now powers `/account` self-delete plus admin user delete with Team/Group ownership guards. The active business-system checkpoint is now the S3 Team/Group wallet pivot: Team plans use isolated Team workspaces and Team wallets, while Group/Collaborate uses personal wallets. The current mainline order is now explicit: signed-in board/browser acceptance, Google/email plus CORS/origin acceptance, one real live AI image smoke, then S1D/S3 closeout, and only after that S4 collaboration. Non-urgent follow-on development should be documented first and kept out of this mainline until these gates are complete.

This folder replaces the former root-level long project ledger and short mirror files. The root `project_state.md` is now only a pointer.

## Current Phase

TANGENT has accepted S0 local polish after Slice E persistence foundations. The canvas interaction pass and Smart Drawing are good enough for P0 alpha; keep only regression fixes and move new architecture work to S1.

S1X has reached a stable post-migration checkpoint. Konva v2 is now the only supported Board runtime in the active web app, and the old mixed-engine web runtime/dependency path has been removed from `apps/web`. A first-pass local collaboration readiness layer now exists on `/boards/[boardId]`: session presence, permission-aware read-only mode, remote cursor overlay, authoritative `boardSavedAt` responses, passive read-only remote-save refresh, repeated-heartbeat session reuse, and a board-scoped local Yjs `BroadcastChannel` room are wired locally. The current local pass also exposes sync-readiness state in the canvas shell, defers remote apply when writable tabs still have unsynced local edits, suppresses pure page-switch broadcasts, stores page order / per-page records / canvas documents / shapes / runtime edges in native Yjs maps and arrays with legacy fallback, suppresses collaboration-origin autosave/dirty loops on receiving tabs, applies ordinary incoming active-page edits as page-level merges when the local page structure still matches, incrementally reconciles structural page changes with explicit changed-page metadata, prefers the server board room identity when available, routes local awareness/document sync through a shared realtime transport layer, waits for explicit local document/awareness initial-sync settlement before first Yjs seed/publish, surfaces a more honest early-room connecting state in the board header, keeps a bounded websocket outbound Yjs update queue so disconnected local edits are retained and later flushed after reconnect/sync settlement, and now supports local collaborative undo/redo against the room undo manager without writing canvas diagnostics into the shared doc. Production collaboration provider/awareness wiring and real AiRun execution remain future work.

S1D has now moved past raw member CRUD scaffold into a usable first-pass permission layer: a backend `none/view/edit/manage/owner` resolver, owner-only Board copy/delete, Board restore, guest-aware board-member roles, people lookup, email invite, server-backed expiring share links, known-foreign Asset reference blocking and public shared-Board consumption are all present locally.

S3 also has a stable first-pass admin bootstrap checkpoint: `/admin` is now server-gated, reads summary/users/workspaces/boards/audit facts, supports owner-only role grant/revoke with audit logging, and now includes first-pass save/edit panels plus versioned publish/rollback for AI model routes and pricing, along with billing/usage/team write surfaces.

S2/S3 have now started the first real AI control-plane backend slice too: migration `20260506_0008` adds DB-backed model registry / parameter tiers / pricing rules and normalizes provider-route facts, migration `20260506_0009` extends `ai_runs` / `ai_api_calls` with quote-selected route/pricing linkage, migration `20260506_0010` adds provider-currency/runtime-cost facts, migration `20260506_0011` adds control-plane version history and cost-ledger settlement columns, `/api/v1/admin/ai/*` exposes admin inspection plus first-pass PATCH save and publish/rollback flows, `/api/v1/ai/runs/quote` gives a payer-aware estimate/preflight before provider execution, and the run path now supports persisted lifecycle rows, a timeout-safe primary->backup route shell, opt-in live provider-specific adapter dispatch, normalized provider cost/currency settlement, attempt-level `api_cost_ledger` facts and grouped `/admin` runtime attempt views with finer filters/drill-down.

In parallel, the canvas now has a fast local Jiekou-first integration path through the web app for user-flow proof: Chat can stream text, Prompt Optimizer can stream improved image prompts, Analysis can choose multimodal text/vision models, and Image Gen / Image Gen 4 can run model-aware image generation/edit/reference flows. This is useful product evidence, but it is not yet the production authority boundary. The 2026-05-13 checkpoint adds backend short-text `AiRun` support with durable terminal `text_output` persistence plus Prompt Optimizer remote create/poll/cancel wiring when the browser is pointed at the FastAPI API, the message-native chat path is now on the same boundary, default analysis-capable model/route/pricing seed now exists in the backend control plane, and `services/api/scripts/s2_live_ai_smoke.py` now provides one reusable image->analysis acceptance harness. The 2026-05-16 checkpoint keeps the backend control plane mostly provider-neutral while current route defaults and seeded models are Jiekou-first; the main remaining cleanup is to keep collapsing provider-shaped logic out of the local Next bridge and admin UI. The next S2 cut is the remaining live provider image smoke and broader provider coverage documented in `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md`.

S3 also tightened its local production shape on 2026-05-13: admin hot GET paths were split toward dedicated read models, repeated access work was reduced, runtime Postgres now prefers `DATABASE_POOL_URL` when present, and slow SQL logging now surfaces queries over the configured threshold without leaking parameters. This improves the admin/billing/team lane for the upcoming real-DB staging smoke. Public staging repair has now moved forward again too: the Vercel production alias was republished from a cleaned root package, `CLERK_SECRET_KEY` was restored for the web runtime, `/boards/[boardId]` now returns the expected Clerk-protected `200` instead of a `500`, and real signed-in smoke now returns `200` for `/api/auth/session`, `/api/v1/admin/me`, operator users, finance summary and AI route metrics. Remaining S1B/S1C work is now the second-round signed-in browser pass, Google/email flow verification and final deploy-secret cleanup rather than basic auth reachability.

The next documented business-system target is now the S3 Team/Group wallet slice: Team purchase creates an isolated Team workspace and Team wallet, while Collaborate remains a personal subscription/wallet for Group collaboration. S1D permission hardening still matters, but the payer contract must now distinguish Team wallet from personal Group/Collaborate wallet. The next-post-acceptance S4 preparation is now also explicit: collaboration should start by reusing the existing Team/Group invite and membership contracts, then add canonical `owner/admin/editor/viewer` language, live cursors/presence and sensitive-edit occupancy before broader optimistic sync deepening.

Operationally, this means `/boards/[boardId]` is the production-facing canvas surface to keep polishing, while `/spikes/konva-canvas` is only a dev regression harness. New canvas requirements should update the S1X slice docs before this total index is touched again.

S1E is now planned as the portable Board package lane: `.tgy` will be the Tanergy Board Package extension for exporting and importing a complete Board with drawings, images, AI nodes, prompts, model parameters and runtime edges. No user-facing `.tgy` implementation exists yet.

## Current Alpha Spine

The current release pass is narrower than the full local scaffold. Only these four lines are release-critical now:

1. Canvas / Board / Page / Share / Auth
2. One real AI provider path
3. Billing mock + usage / ledger visible
4. Admin minimum operating surface

Everything else should be treated as one of:

- parallel scaffold that supports the release spine
- frozen placeholder that stays out of the main promise
- deferred post-alpha work such as collaboration, real payments or deep finance tooling

## Current Parallel Readiness Snapshot

These percentages are coarse readiness markers, not time estimates:

```text
S1X Canvas/Konva runtime      78%  stable local Board path; export/Yjs/live AiRun polish pending
S1A Schema/DB foundation      82%  core join points and Team-wallet schema delta exist; staging DB smoke remains
S1B Deploy/staging            84%  rebuilt Hetzner API host, public HTTPS API, Neon/R2/board smoke, CORS and the Konva-only staging web deploy are green; a first signed-in browser pass is now green, and the remaining work is the second-round reopen/conflict/thumbnail edge cases, Google/email flow verification and one live AI smoke
S1C Auth/registration         78%  Clerk/FastAPI bearer boundary, admin bootstrap, real staging session/admin smoke, Tanergy profile onboarding/editing and a visible Clerk-backed forgot-password flow now exist; session revocation/logout hardening plus Google/email verification remain
S1D Board/share/invites       73%  CRUD/share/member first pass, workspace invite backend contracts and role-gated Team/Group UI first pass exist; billing visibility separation pending
S1E Board packages            05%  `.tgy` package docs exist; export/import UI, asset bundling and asset rehydration pending
S2 AI runtime/provider routes 68%  GeekAI local UX path exists; backend short-text `AiRun`, durable `text_output`, message-native chat backendization, four-model image refresh and longer live-image timeout now exist; live image smoke and broader provider coverage remain
S3 Admin/billing/team         97%  admin/billing/team scaffolds, Team-wallet payer + settlement contract tests, Team/Collaborate checkout, provider-neutral checkout adapter, signed payment webhook inbox, Group create, workspace invite/member contracts, real `/usage` checkout buttons, billing return routes, admin directory APIs, tabbed admin console, active-tab server bootstrap, idle-warmed client tab keepalive, paginated Team/Group dashboards, AI route metrics, table-first AI route management, admin finance reconciliation panels, manual admin operations, operator User inventory/detail read model, five-tab user detail, centered manual-finance modals, native user status/delete, native subscription freeze/unfreeze, arbitrary Team/Group invite-add-member ops, searchable Join Team/Join Group detail modals, inline pending invite rows, local detail patching for invite/member/board mutations, board copy/delete ops, unified billing-history rows, an opt-in local operator demo seed and DB-backed Team/Group/Billing frontend reads now exist; remote staging redeploy, Alembic-head/admin_roles real-login smoke plus payment/invoice/refund depth pending
Frontend product UI alignment 69%  major surfaces, wide board/workspace/subscription polish, DB-backed Team/Group directories, live billing/usage cards and table-first AI route management exist; nav, plan labels and cost messaging still need another tightening pass
S4 Collaboration              27%  local Yjs room/document foundation plus bounded websocket queued-update reconnect semantics exist; provider-grade reconnect/resync, persistence and conflict semantics still remain
```

## Current Execution Order

1. Finish the second-round signed-in board/browser acceptance on staging.
2. Finish Google/email plus CORS/origin acceptance.
3. Run one real server-backed image smoke through the refreshed four-model S2 lane.
4. Return to S1D/S3 closeout: permission edges, payer visibility, billing language and staged payment/usage truth.
5. Resume S4 websocket/provider deepening only after the four gates above are green.

Working rule for this phase:

- non-urgent follow-on development should be written into the relevant docs or tactical plans first
- do not interrupt the current mainline for backlog nice-to-haves until the ordered gates above are complete

```text
Done locally:
  Product Shell
  Workspace Board gallery/list
  Workspace board action menu polish
  Board save/autosave
  Board History long-session regression
  Board Management metadata
  Board Management layout polish
  Captured thumbnails
  Canvas Settings
  Konva Canvas Settings route/toolbar integration
  Canvas header/switcher/properties polish accepted
  Smart Drawing accepted for local P0 alpha
  S1X Konva v2 Board save/load/history/thumbnail
  S1X Konva-only formal `/boards/[boardId]` path
  legacy v1 Board cleanup, list filtering and blocked restore path
  S1X Konva v2 page contract + Page polish first pass
  S1X explicit v1-to-v2 copy tooling first pass
  S1 launch-readiness acceptance report
  S1A DB schema/migrations
  Auth scaffold
  S1D first-pass Board members/share/public share flow with owner-only copy/delete and known-foreign Asset guard
  S1E `.tgy` Board Package product/architecture/tactical plan documented
  S3 first-pass admin probe/summary/audit/role management
  S3 first-pass billing/workspace entitlement dashboard contract with Collaborate Plus / Team Growth catalog, DB-backed read lookup, Team seat mutation, credit preflight coverage, internal ledger settlement helpers, payment-backed top-up/seat checkout scaffolds and first-pass top-up/usage/admin AI save panels
  S3 Team/Group wallet plan update: Team wallet replaces the older Team actor-personal charging strategy; Collaborate stays personal-wallet based
  S3 Team subscription checkout backend contract: pending team_subscription payment can complete into a new Team workspace, owner membership, Team wallet, subscription, seat capacity and included-credit grant
  S3 Team wallet top-up backend contract: current Team owner/admin can create a workspace_topup payment and complete it into the Team wallet ledger
  S3 Collaborate subscription backend contract: pending collaborate_subscription payment can complete into the user's single active Collaborate subscription and personal wallet grant
  S3 payment webhook inbox: signed provider events are recorded in tangent_webhook_events and successful checkout events can complete by internal payment id, client reference or provider metadata checkout session id through the shared grant path without duplicate credits
  S3 hosted checkout response contract: non-manual providers can return checkout URLs and structured amount/currency/kind/client-reference metadata while manual completion is blocked for hosted-provider payments
  S3 Stripe Checkout Session adapter: stripe provider remains optional and requires TANGENT_STRIPE_SECRET_KEY only when selected, creates Checkout Sessions server-side and marks checkout.adapter=stripe_checkout without reading local secret files
  S3 Group workspace create backend contract: active Collaborate users can create a group_workspace with owner membership
  S3/S1D workspace invite backend contract: Team/Group owners/admins can create/list/revoke invite links, signed-in recipients can accept non-expired tokens into workspace membership, and invite tokens are stored hashed
  S3 Team invite seat-capacity backend contract: accepting a Team invite requires remaining Team subscription seat capacity and creates the member seat assignment without duplicate credit grants
  S3/S1D member removal backend contract: workspace owners/admins can remove non-owner members, and Team removal revokes active seat assignments
  S3/S2 payer settlement contract: mock AiRuns charge Group/Collaborate runs to actor personal wallets, Team runs to Team wallets, and polling/cancel cannot switch charged account
  S3 frontend action wiring: billing plan checkout/complete, Team create/purchase, Group create, invite accept/create/revoke, member removal, Team top-up, Team seat checkout and personal top-up now have UI entry points backed by real routes
  S3 disposable Postgres smoke: migration-to-head, Team checkout/invite/quote/run-settlement/remove and Collaborate/Group create/invite/quote/run-settlement passed
  S3 local admin/payment smoke: disposable Postgres-backed `/admin` finance reads, manual Team wallet top-up, manual Team seat checkout/assignment and hosted redirect/manual-complete rejection passed
  S3 manual admin billing bridge: `/admin` finance can top up/deduct user/Team wallets, assign Group/Collaborate or Team plans, create Team/Group workspaces, cancel subscriptions and delete workspaces through audited `admin_manual` backend operations while Stripe is unavailable; `/admin` now separates Users, Teams, Groups, AI API Routes, Finance and Access with server-backed directory and route metrics
  S3 admin operator first pass: `/api/v1/admin/operator/users`, `/api/v1/admin/operator/users/{user_id}`, `/admin?tab=users`, five-tab `/admin/users/[userId]` detail and centered manual-finance modals now follow the operator redesign plan
  S3 admin operator acceptance pass: Account profile/User inventory table alignment, billing target selection, register state, block/unblock, Group freeze/unfreeze, Team/Group caps, joined-Team actor billing history and admin role reason audits are locally green against full frontend/backend gates
  S3 DB-backed workspace/subscription frontend pass: `/api/auth/session` now proxies backend session when remote API is configured, `/team` and `/group` stop rendering mock directories, `/billing` and `/usage` read the live plan catalog plus billing/dashboard/ledger/payment APIs, and Team/Group detail now loads live board lists with live billing/dashboard facts instead of hybrid mock cards
  S3 admin operator native workspace actions: arbitrary Team/Group invite list/create/revoke, direct member add and board copy/delete are now wired into the owned workspace rows
  S3 admin operator demo seed: `services/api/scripts/seed_admin_operator_demo.py` can now populate dense local QA data for User inventory, Team Plan, Joined Team, Group Plan, Joined Group, billing history and pending invites
  S2/S3 DB-backed AI control-plane registry/provider-route/pricing-rule read/save + versioned publish/rollback + AiRun quote/preflight + persisted lifecycle/failover + live-adapter scaffold checkpoint
  Canvas-facing GeekAI local fast path for chat streaming, prompt optimization, image generation/edit/reference and analysis
  Image Gen / Image Gen 4 model-aware controls for GPT Image 2, Nano Banana 2, Doubao Seedream and Jimeng-style parameters
  Billing/team packaging strategy checkpoint
  AI contract scaffold
  Alembic scaffold
  Admin bootstrap groundwork

Not production-complete:
  real Auth/email/session
  share editor/invite-accept and full team/share permissions
  real Group/Team workspace governance depth, deployed staging payment smoke, paid seat renewal/cancellation flows, external payment-provider reconciliation and hosted live provider settlement smoke
  staging auth/email/license hardening
  precise old-board style/binding migration beyond first-pass copy tooling
  `.tgy` Board Package export/import and asset rehydration
  Konva collaboration/Yjs provider sync
  true rendered Konva page-thumbnail assets/page duplicate/Move selection to new page
  local GeekAI path folded into the server AiRun/provider-route/billing control plane
  full real AI provider coverage and durable text-output persistence
  full Admin/Billing/Analytics depth, including external billing reconciliation and richer finance views
  collaboration
```

## State Slice Index

| Slice | File | Status |
| --- | --- | --- |
| S0 Local Polish | `Finished/project_state_slice_S0_local_polish.md` | Finished baseline; regression reference only |
| S1 Staging/Auth/Board | `project_state_slice_S1_staging_auth_board.md` | Active umbrella slice; detailed truth now lives in S1A/S1B/S1C/S1D/S1X |
| S1A DB Schema | `project_state_slice_S1A_db_schema.md` | S1A core implemented through `0006`; current migration head also includes S3 `0007` |
| S1B Staging Infra | `project_state_slice_S1B_staging_infra.md` | In progress; rebuilt public API host plus Neon/R2/board smoke passed, with auth/email/web acceptance still pending |
| S1C Auth Context | `project_state_slice_S1C_auth_request_context.md` | Active checkpoint; provider-backed auth, Tanergy profile ownership, Clerk recovery flow and a local account-deletion path are in place, while logout/session hardening and broader verification remain |
| S1D Board CRUD | `project_state_slice_S1D_auth_board_crud.md` | Stable first-pass CRUD/member/share/public-share-open checkpoint with owner-only copy/delete, share expiry and known-foreign Asset guard |
| S1E Board Packages | `project_state_slice_S1E_board_packages.md` | Planned; `.tgy` package decision and docs exist, implementation not started |
| S1X Canvas Engine Migration | `project_state_slice_S1X_canvas_engine_migration.md` | Konva Board route accepted; Page polish and v1 copy tooling landed; local presence/read-only, passive remote-save sync and a local Yjs room/snapshot foundation with visible sync/conflict controls, native page/shape/edge Yjs storage, structural page reconcile, server-room-key alignment, provider-ready transport shaping, document/awareness initial-sync gating and local collaborative undo/redo are wired; provider/awareness remains pending |
| S2 AI Runtime | `project_state_slice_S2_ai_runtime.md` | Mock/runtime dataflow, persisted route/settlement shell and local Jiekou-first canvas path are usable; DB-backed quote/preflight/lifecycle/attempt facts exist; production gate is folding the remaining local bridge logic into the server provider-route/billing control plane and validating one live image path with durable Asset/text-output handling |
| S3 Admin/Billing/Analytics | `project_state_slice_S3_admin_billing_analytics.md` | Active pivot: migration `20260508_0012/0013`, payer resolver plus settlement contracts, Team/Collaborate checkout, provider-neutral checkout adapter, signed webhook inbox, Group create, workspace invite/member contracts, frontend actions, admin directory APIs, tabbed admin console, active-tab server bootstrap, idle-warmed client tab keepalive, paginated Team/Group dashboards, AI route metrics, table-first AI route management, admin finance reconciliation panels, manual admin billing bridge, disposable Postgres smoke, local manual/hosted payment smoke, first-pass operator inventory/detail, native user status/delete, native subscription freeze/unfreeze, arbitrary Team/Group invite-add-member writes, inline pending invite rows, local detail patching for invite/member/board mutations and board copy/delete writes now support Team wallet vs personal Collaborate wallet while Stripe is unavailable; user delete is now a real hard-delete path with ownership guards, while remote staging redeploy smoke and invoice/refund depth remain |

## Current Next Fork

If external resources are not ready:

1. Hand-test S1X Page UI save/restore/history, page delete/reorder/Move to page and v1-to-v2 copy tooling on real Boards.
2. Keep S1X on regression-only fixes while the new share/admin checkpoints settle.
3. Harden S1D permissions into the target `Can view/edit/manage/owner` model with Group/Team workspace separation.
4. Start S1E `.tgy` Board Package export/import if Board/Asset guard work remains stable.
5. Continue the S3 Team/Group wallet slice: deployed staging admin/payment smoke, real-login admin_roles verification and real payment webhook depth.
6. Start the S1C auth/admin production boundary cut: real Clerk login on staging/prod, admin_roles bootstrap, spoof tests, CORS/origin contract and default solo workspace + personal wallet registration closure.
7. Fold the current GeekAI local fast path into the server provider-route adapter layer while preserving timeout-safe per-attempt observability and no-double-charge settlement before real provider charging.

If external resources are ready:

1. Finish recording S1B staging smoke status and deploy the Konva-only Board route with legacy Board documents blocked in the active app path.
2. Run staging Postgres migration/query smoke and R2 asset smoke.
3. Continue S1C Auth rollout and harden S1D Auth-backed Board CRUD/public share on top of the Konva v2 Board contract.
4. Harden S1D Group/Team workspace permissions and S3 Team-wallet/personal-wallet entitlements on top of real identity.
5. Move S2 real AI provider work through server-side AiRun contracts, starting with the GeekAI provider-route reconciliation plan and the new payer resolver.
6. Expand S3 Admin from the current first-pass save/edit checkpoint after real Auth/admin roles and wallet facts exist.

## Next Slice Order

```text
Now: S1X/S1D/S3 checkpoint stabilization
  |
  v
S1A local schema/contracts (implemented; real DB smoke pending)
  users, workspaces, members, boards, snapshots, assets, auth_sessions
  |
  v
S1B staging smoke
  Postgres, R2, FastAPI health, domain, CORS, Web API base URL
  |
  v
S1X canvas engine migration
  Konva-only Board route accepted; Yjs/provider viability pending
  |
  v
S1C real Auth
  register, login, logout, session, default workspace
  |
  v
  S1D Auth-backed Board CRUD
  server-side list/load/save/history/copy/delete, members, share and public shared-Board view
  |
  +--> S1E `.tgy` Board Package export/import
  +--> S2 real AI provider and AiRun/cost facts
  +--> S3 Admin/Credits/Billing/Analytics expansion
  +--> S4 Collaboration
```

Current recommendation: treat S1X as a Konva-only production path, keep historical migration notes only as background context, and use `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md`, `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md`, `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md` and `dev-plans/s3-admin-operator-console-redesign-2026-05-09.md` as the handoff checklists. S1A is implemented but needs the Team-wallet delta, S1D first-pass share flow is in place, and S3 should not start real provider charging until Team wallet and personal Collaborate wallet payer tests pass.

Next major checkpoint should move from repaired staging infrastructure into the remaining production-facing S1B/S1C/S2 gates in this explicit order: finish the second-round signed-in board/browser acceptance after the now-green first pass, then Google/email plus CORS/origin verification, then the refreshed four-model live image smoke, then S1D/S3 closeout, and only then the deeper S4 Yjs/provider proof with cleaner server boundaries. Avoid reintroducing legacy canvas compatibility layers, and avoid interrupting this order for non-urgent backlog work that can be recorded in docs first.

## Update Rules

- During a small active slice, update only the relevant `project_state_slice_*.md`.
- When a slice reaches a stable checkpoint, update this index.
- Commit history is the detailed historical ledger; do not copy long old changelogs back into this file.
- Product requirements live in `../PRD/`.
- Architecture rules live in `../ARCH/`.

## 中文完整翻译

# TANGENT 项目状态索引

**更新日期**：2026-05-15
**分支**：`feature/s1c-auth-admin-production-boundary`
**最新本地检查点**：S1X Konva 路由稳定化 + 本地协同 presence/read-only + 被动远端保存同步 + 本地 Yjs room/snapshot foundation（含结构性 page reconcile、server room key 对齐、本地协同 undo/redo）+ S1D permission/share hardening + S2/S3 DB-backed AI control-plane 脚手架 + 第一阶段 billing/team/usage/admin surfaces + GeekAI 本地画布 UX proof + staging Konva-only 部署恢复 + 真实 Clerk session/admin smoke 转绿 + 2026-05-14 生图模型刷新到 GPT Image 2、Nano Banana 2、Doubao Seedream 5.0 Lite 和 Jimeng 4.0，并把长耗时生图超时边界抬到 240s。当前业务系统检查点是 S3 Team/Group wallet 调整：Team 套餐使用彼此隔离的 Team workspace 和 Team wallet，Group/Collaborate 使用个人钱包。

本目录取代了原来的根级长项目台账和短镜像文件。根目录 `project_state.md` 现在只做指针用途。

## 当前阶段

在 Slice E 持久化基础之后，TANGENT 已经接受 S0 本地 polish。白板交互和 Smart Drawing 已经足够作为 P0 alpha 使用；接下来只保留回归修复，把新的架构工作转移到 S1。

S1X 已经达到一个稳定的基础迁移检查点。Konva v2 现在是活跃 Web app 唯一支持的 Board runtime；旧的 tldraw runtime、reference route 和依赖都已经从 `apps/web` 移除，legacy v1 Board 文档/历史在 active path 中也会被阻止恢复。`/boards/[boardId]` 上现在已经有第一阶段本地协作 readiness：session presence、权限感知的只读模式、远端 cursor overlay、权威 `boardSavedAt` 响应、只读端被动远端保存刷新、repeated-heartbeat session reuse，以及基于 `BroadcastChannel` 的 board-scoped 本地 Yjs room 都已接通；当前本地协同层还额外补上了画布里的同步状态提示、可写标签页在本地未同步时的远端变更延后应用控制、纯 page 切换不再触发广播、以 native Yjs map/array 保存的 page order / page record / canvas document / shape / runtime edge 结构（保留 legacy fallback）、接收端对 collaboration-origin restore 的 autosave/dirty 抑制、在页面结构未变化时按 page 粒度应用普通远端编辑、对 page 新建/删除/重排这类结构变化按 changed-page metadata 做增量 reconcile、优先对齐服务端 board room identity，并且基于 room undo manager 的本地协同 undo/redo 已可用，同时画布诊断数据不再写入共享 Y.Doc。生产级 provider/awareness 接线和真实 AiRun 执行仍然是未来工作。

S1D 现在已经超越“原始 member CRUD scaffold”，进入了一个可用的第一阶段权限层：backend `none/view/edit/manage/owner` resolver、owner-only Board copy/delete、Board restore、支持 guest 的 board-member 角色、people lookup、email invite、服务端 expiring share links、known-foreign Asset reference blocking，以及公共 shared-Board 消费都已经在本地具备。

S3 也已经有了稳定的第一阶段后台 bootstrap 检查点：`/admin` 现在由服务端门控，能够读取 summary / users / workspaces / boards / audit 事实，支持 owner-only 的 role grant / revoke 与审计日志，并且现在也已经带上 AI model / route / pricing 的第一阶段 save/edit panels 和版本化 publish/rollback，以及 billing / usage / team 的写入界面。

S2/S3 现在也已经开始了第一条真正的 AI control-plane backend 主线：migration `20260506_0008` 增加了 DB-backed model registry / parameter tiers / pricing rules，并把 provider-route 事实做了第一批规范化；migration `20260506_0009` 则把 quote 阶段选中的 route/pricing 关联扩展进 `ai_runs` / `ai_api_calls`；migration `20260506_0010` 则继续补上 provider-currency / runtime-cost 事实；migration `20260506_0011` 则增加控制平面版本历史与 cost-ledger settlement 列。`/api/v1/admin/ai/*` 现在既暴露后台检查接口，也已经带上第一阶段 PATCH save 和 publish/rollback flows；`/api/v1/ai/runs/quote` 会在 provider execution 之前返回带 payer 信息的 estimate/preflight，而当前 run 路径已经支持持久化 lifecycle rows、timeout-safe 的 primary->backup route shell、可选启用的 live provider-specific adapter dispatch、归一化后的 provider cost/currency settlement、按尝试分行的 `api_cost_ledger` 事实，以及带更细 filters / drill-down 的 `/admin` runtime attempt 视图。

与此同时，画布现在也有了一条通过 Web app 接入 GeekAI 的本地 fast path，用来验证用户流程：Chat 可以流式输出文本，Prompt Optimizer 可以流式优化出图提示词，Analysis 可以选择 OpenAI 系或 Gemini 系视觉分析模型，Image Gen / Image Gen 4 现在已经对齐 GPT Image 2、Nano Banana 2、Doubao Seedream 5.0 Lite 和 Jimeng 4.0 的参数界面。这对产品验证有价值，但还不是生产权限边界；2026-05-14 又补上了后端 `20260514_0021_ai_image_model_refresh` 对齐、移除了活跃生图面里的 `gemini-3.1-flash-image-preview`，并把长耗时生图超时抬到 240s。下一步 S2 cut 仍然是把这条 GeekAI 路径收口到 `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md` 里定义的 server AiRun provider-route/billing control plane。

从业务系统角度看，下一步目标已经切到 S3 Team/Group wallet：Team purchase 创建隔离的 Team workspace 和 Team wallet；Collaborate 仍然是个人订阅 / 个人钱包，用于 Group 协作。S1D 权限硬化仍然重要，但 payer contract 必须区分 Team wallet 和个人 Group/Collaborate wallet。

从运行角度看，这意味着 `/boards/[boardId]` 是需要继续打磨的 Konva-only 主路径，`/spikes/konva-canvas` 只是 dev regression surface；新的白板需求在更新这个总索引之前，应该先更新 S1X 切片文档。

## 当前 Alpha 主线

当前这一轮发布范围，比完整本地 scaffold 更窄。现在只有下面四条线属于发布关键路径：

1. Canvas / Board / Page / Share / Auth
2. 一个真实 AI provider 路径
3. Billing mock + usage / ledger 可见
4. Admin 最小可运营面

除此之外的内容，都应该被视为以下三类之一：

- 支撑发布主线的 parallel scaffold
- 保留在代码中、但不进入主承诺的 frozen placeholder
- collaboration、真实支付、deep finance tooling 这类 post-alpha 延后项

## 当前并行就绪快照

这些百分比是粗粒度就绪标记，不是时间估算：

```text
S1X Canvas/Konva runtime      78%  本地 Board 主路径稳定；export/Yjs/live AiRun polish 待完成
S1A Schema/DB foundation      82%  core join points 与 Team-wallet schema delta 已存在；staging DB smoke 仍待完成
S1B Deploy/staging            84%  重建后的 Hetzner API、public HTTPS API、Neon/R2/board smoke、CORS 和 Konva-only staging Web deploy 已转绿；signed-in browser 首轮已转绿，剩余工作是第二轮 reopen/conflict/thumbnail 边界项、Google/email 和一条 live AI smoke
S1C Auth/registration         78%  Clerk/FastAPI bearer 边界、admin bootstrap、真实 staging session/admin smoke、Tanergy profile onboarding/editing 以及可见的 Clerk forgot-password 流程已存在；session revocation/logout hardening 与 Google/email 验证仍待完成
S1D Board/share/invites       73%  CRUD/share/member 第一阶段、workspace invite backend contracts 和带角色门控的 Team/Group UI first pass 已存在；billing visibility separation 待完成
S1E Board packages            05%  `.tgy` package docs 已存在；export/import UI、asset bundling 和 asset rehydration 待完成
S2 AI runtime/provider routes 68%  GeekAI 本地 UX 路径存在；后端短文本 `AiRun`、durable `text_output`、message-native chat backendization、四模型生图刷新和更长生图超时已存在；剩余闸门是 live image smoke 与更广 provider 覆盖
S3 Admin/billing/team         96%  admin/billing/team 脚手架、Team-wallet payer + settlement 合同测试、Team/Collaborate checkout、provider-neutral checkout adapter、signed payment webhook inbox、Group create、workspace invite/member contracts、real `/usage` checkout buttons、billing return routes、admin directory APIs、tabbed admin console、active-tab server bootstrap、idle-warmed client tab keepalive、分页 Team/Group dashboards、AI route metrics、table-first AI route management、admin finance reconciliation panels、manual admin operations、operator User inventory/detail read model、五标签 user detail、centered manual-finance modals、native user status/delete、native subscription freeze/unfreeze、任意 Team/Group 的 invite-add-member ops、可搜索的 Join Team/Join Group detail modals、inline pending invite rows、invite/member/board mutation 的本地 detail patching、board copy/delete ops、unified billing-history rows，以及本地可选的 operator demo seed 已存在；remote staging redeploy、payment/invoice/refund 深度待完成
Frontend product UI alignment 63%  主要界面、table-first AI route management、带角色门控的 Team/Group member actions、第一阶段 Billing actions、tabbed admin console、admin finance panels，以及 operator 行内 invite/member/board 操作回路已存在；导航、套餐语言和扣费文案需要对齐
S4 Collaboration              27%  本地 Yjs room/document 基础与 reconnect/resync smoke harness 已存在；Yjs/provider proof 仍后置
```

## 当前主线顺序

1. 先完成 signed-in board/browser staging 第二轮验收。
2. 再完成 Google/email 与 CORS/origin 验收。
3. 跑通一条刷新后四模型生图线的真实 live image smoke。
4. 回到 S1D/S3 收口：permission edges、payer visibility、billing language、credits、usage 和 staged payment truth。
5. 只有在前四步转绿后，才继续 S4 collaboration。

当前工作规则：

- 如果是有价值但不紧急的后续开发，先写进对应 slice / dev-plan 文档
- 在上述主线完成前，不要让 backlog nice-to-haves 打断当前推进顺序

```text
本地已完成：
  Product Shell
  Workspace Board gallery/list
  Workspace board action menu polish
  Board save/autosave
  Board History long-session regression
  Board Management metadata
  Board Management layout polish
  Captured thumbnails
  Canvas Settings
  Konva Canvas Settings route/toolbar integration
  Canvas header/switcher/properties polish accepted
  Smart Drawing accepted for local P0 alpha
  S1X Konva v2 Board save/load/history/thumbnail
  S1X Konva-only formal `/boards/[boardId]` path
  legacy v1 Board 清理、列表过滤和 blocked restore path
  S1X Konva v2 page contract + Page polish first pass
  S1X explicit v1-to-v2 copy tooling first pass
  S1 launch-readiness acceptance report
  S1A DB schema/migrations
  Auth scaffold
  S1D first-pass Board members/share/public share flow with owner-only copy/delete and known-foreign Asset guard
  S1E `.tgy` Board Package product/architecture/tactical plan documented
  S3 first-pass admin probe/summary/audit/role management
  S3 first-pass billing/workspace entitlement dashboard contract with Collaborate Plus / Team Growth catalog, DB-backed read lookup, Team seat mutation、credit preflight coverage、internal ledger settlement helpers、payment-backed top-up/seat checkout scaffolds 和第一阶段 top-up / usage / admin AI save panels
  S3 payment webhook inbox：签名 provider event 会写入 tangent_webhook_events，成功 checkout event 可以通过 internal payment id、client reference 或 provider metadata checkout session id 复用 shared grant path 完成 payment，重复事件不会重复发放 credits
  S3 hosted checkout response contract：非 manual provider 可以返回 checkout URL 和结构化 amount/currency/kind/client-reference metadata，hosted-provider payment 会禁止 manual complete
  S3 Stripe Checkout Session adapter：stripe provider 是可选线路，仅在选择时要求 TANGENT_STRIPE_SECRET_KEY，server-side 创建 Checkout Sessions，并会标记 checkout.adapter=stripe_checkout，不读取本地 secret 文件
  S3/S2 payer settlement contract：mock AiRuns 会把 Group/Collaborate run 扣到 actor personal wallet，把 Team run 扣到 Team wallet，并且 polling/cancel 不能切换 charged account
  S3 local admin/payment smoke：disposable Postgres-backed `/admin` finance reads、manual Team wallet top-up、manual Team seat checkout/assignment 和 hosted redirect/manual-complete rejection 已通过
  S3 manual admin billing bridge：Stripe 不可用时，`/admin` finance 可以通过 audited `admin_manual` backend operations 给 user/Team wallet 充值/扣减、分配 Group/Collaborate 或 Team plan、创建 Team/Group、取消 subscription 和删除 workspace；`/admin` 现在按 Users、Teams、Groups、AI API Routes、Finance、Access 拆开，并有 server-backed directory 与 route metrics
  S3 admin operator first pass：`/api/v1/admin/operator/users`、`/api/v1/admin/operator/users/{user_id}`、`/admin?tab=users`、五标签 `/admin/users/[userId]` detail 和 centered manual-finance modals 已按 operator redesign plan 落地
  S3 admin operator 原生 workspace actions：任意 Team/Group 的 invite list/create/revoke、direct member add，以及 board copy/delete 已接到 owned workspace rows
  2026-05-13 全项目 memory/fallback audit：协同 update 链/awareness、Konva history/cache、admin/billing/board client resources、workspace detail runtime、AI chat/image inline 处理、asset upload/import/migration、Next local AiRun store 和 FastAPI mock AiRun stores 已加 TTL/数量/字节上限；billing/workspace/admin 的过渡 mock/resource fallback 与未使用 mock dashboard 文件已清理
  S3 admin operator demo seed：`services/api/scripts/seed_admin_operator_demo.py` 现在可以一键填充 User inventory、Team Plan、Joined Team、Group Plan、Joined Group、billing history 和 pending invites 的本地 QA 数据
  S2/S3 DB-backed AI control-plane registry/provider-route/pricing-rule read/save + 版本化 publish/rollback + AiRun quote/preflight + persisted lifecycle/failover + live-adapter scaffold checkpoint
  面向画布的 GeekAI 本地 fast path：chat streaming、prompt optimization、image generation/edit/reference 和 analysis
  Image Gen / Image Gen 4 已有 GPT Image 2、Nano Banana 2、Doubao Seedream 和 Jimeng 风格参数的模型感知控件
  Billing/team packaging strategy checkpoint
  AI contract scaffold
  Alembic scaffold
  Admin bootstrap groundwork

尚未达到生产完成：
  real Auth/email/session
  share editor/invite-accept and full team/share permissions
  real Group/Team workspace governance、deployed staging payment smoke、paid seat renewal/cancellation flows、external payment-provider reconciliation 和 hosted live provider settlement smoke
  staging auth/email/license hardening
  precise old-board style/binding migration beyond first-pass copy tooling
  `.tgy` Board Package export/import 和 asset rehydration
  Konva collaboration/Yjs provider sync
  true rendered Konva page-thumbnail assets/page duplicate/Move selection to new page
  local GeekAI path 收口到 server AiRun/provider-route/billing control plane
  full real AI provider coverage 和 durable text-output persistence
  full Admin/Billing/Analytics 深度能力，包括 billing-history reconciliation、external billing reconciliation 和更丰富的 finance views
  collaboration
```

## 状态切片索引

| 切片 | 文件 | 状态 |
| --- | --- | --- |
| S0 本地打磨 | `Finished/project_state_slice_S0_local_polish.md` | 已完成 baseline；仅作为 regression reference |
| S1 Staging/Auth/Board | `project_state_slice_S1_staging_auth_board.md` | 活跃 umbrella；详细事实现在位于 S1A/S1B/S1C/S1D/S1X |
| S1A DB Schema | `project_state_slice_S1A_db_schema.md` | S1A core 已通过 `0006` 实现；当前 migration head 还包含 S3 `0007` |
| S1B Staging Infra | `project_state_slice_S1B_staging_infra.md` | 进行中；FastAPI / Neon / R2 smoke 已通过 |
| S1C Auth Context | `project_state_slice_S1C_auth_request_context.md` | 活跃检查点；provider-backed auth、Tanergy profile ownership 与 Clerk recovery flow 已到位，但 logout/session hardening 与更广验证仍待完成 |
| S1D Board CRUD | `project_state_slice_S1D_auth_board_crud.md` | 第一阶段 CRUD/member/share/public-share-open 检查点稳定，并已带 owner-only copy/delete、share expiry 和 known-foreign Asset guard |
| S1E Board Packages | `project_state_slice_S1E_board_packages.md` | 已规划；`.tgy` package 决策和文档已存在，implementation 还未开始 |
| S1X Canvas Engine Migration | `project_state_slice_S1X_canvas_engine_migration.md` | Konva Board 路由已接受；Page polish 和 v1 copy tooling 已落地；本地 presence/read-only、被动远端保存同步、本地 Yjs room/snapshot foundation、同步/冲突可见控制、native page/shape/edge Yjs 存储、结构性 page reconcile、server room key 对齐与本地协同 undo/redo 已接通；协同/画布 memory audit 已补 bounded cache/history/update-chain、presence sanitize 和 image-cache 规则；provider/awareness 仍待完成 |
| S2 AI Runtime | `project_state_slice_S2_ai_runtime.md` | Mock/runtime dataflow、持久化 route/settlement shell 和本地 GeekAI canvas path 都已可用；DB-backed quote/preflight/lifecycle/attempt facts 已存在；AI chat/image inline、provider b64、remote import 和 retained text 已补大小/流式/输出上限；生产闸门是把 GeekAI 和未来 providers 收口到服务端 provider-route/billing control plane，并用 durable Asset/text-output handling 验证一条 live image path |
| S3 Admin/Billing/Analytics | `project_state_slice_S3_admin_billing_analytics.md` | 活跃调整：migration `20260508_0012/0013`、payer resolver、settlement contracts、Team/Collaborate checkout、provider-neutral checkout adapter、signed webhook inbox、Group create、workspace invite/member contracts、frontend actions、admin directory APIs、tabbed admin console、active-tab server bootstrap、分页 Team/Group dashboards、AI route metrics、table-first AI route management、admin finance reconciliation panels、manual admin billing bridge、disposable Postgres smoke、本地 manual/hosted payment smoke、first-pass operator inventory/detail、native user status/delete、native subscription freeze/unfreeze、任意 Team/Group 的 invite-add-member writes、inline pending invite rows、invite/member/board mutation 的本地 detail patching、bounded admin/billing/board resource caches、workspace/billing/admin mock fallback cleanup 和 board copy/delete writes 已在 Stripe 不可用时支持 Team wallet vs personal Collaborate wallet；remote staging redeploy smoke 以及 invoice/refund 深度仍待完成 |

## 当前下一条分叉路线

如果外部资源还没准备好：

1. 手测真实 Board 上的 S1X Page UI save/restore/history、page delete/reorder/Move to page，以及 v1-to-v2 copy tooling。
2. 让 S1X 保持在只修回归的状态，同时等待新的 share/admin 检查点稳定。
3. 把 S1D 权限硬化到目标 `Can view/edit/manage/owner` 模型，并拆清 Group/Team workspace 边界。
4. 如果 Board/Asset guard 稳定，启动 S1E `.tgy` Board Package export/import。
5. 在真实 provider charging 之前，先把当前 GeekAI 本地 fast path 收口到服务端 provider-route adapter layer，同时保留 timeout-safe 逐次尝试可观测性和 no-double-charge settlement 边界。
6. 让新的 AI control plane 继续聚焦在带审计的 route/pricing publish flows、live smoke 和 durable output handling。

如果外部资源已经准备好：

1. 补全 S1B staging smoke 状态记录，并部署 Konva-only 路由，同时确认 legacy Board 文档在 active app path 中保持阻止状态。
2. 运行 staging Postgres migration/query smoke 和 R2 asset smoke。
3. 继续推进 S1C Auth rollout，并在 Konva v2 Board 合同之上继续加固 S1D Auth-backed Board CRUD / public share。
4. 在真实 identity 之上继续硬化 S1D 的 Group/Team workspace 权限，以及 S3 的 billing 可见性 entitlement。
5. 通过服务端 AiRun 合同推进 S2 的真实 AI provider 工作，先从 GeekAI provider-route reconciliation plan 开始。
6. 在真实 Auth/admin roles 存在之后，再从第一阶段 save/edit 检查点继续扩展 S3 Admin。

## 下一切片顺序

```text
现在：S1X/S1D/S3 检查点稳定化
  |
  v
S1A 本地 schema/contracts（已实现；真实 DB smoke 待完成）
  users, workspaces, members, boards, snapshots, assets, auth_sessions
  |
  v
S1B staging smoke
  Postgres, R2, FastAPI health, domain, CORS, Web API base URL
  |
  v
S1X canvas engine migration
  Konva-only Board route 已接受；Yjs/provider 可行性待继续
  |
  v
S1C real Auth
  register, login, logout, session, default workspace
  |
  v
S1D Auth-backed Board CRUD
  server-side list/load/save/history/copy/delete, members, share and public shared-Board view
  |
  +--> S1E `.tgy` Board Package export/import
  +--> S2 real AI provider and AiRun/cost facts
  +--> S3 Admin/Credits/Billing/Analytics expansion
  +--> S4 Collaboration
```

当前建议是：把 S1X 视为 Konva-only 的生产路径，历史迁移说明只保留为背景上下文；除非出现回归，否则把 S1X page polish 视为已接受；并使用 `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md`、`dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md`、`dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md` 和 `dev-plans/s3-admin-operator-console-redesign-2026-05-09.md` 作为交接检查清单。S1A 已实现但需要 Team-wallet delta，S1D 第一阶段 share flow 已就绪，S3 在 Team wallet 和 personal Collaborate wallet payer 测试通过前，不应开始真实 provider charging。

下一个主要检查点应当按这个明确顺序推进：在 signed-in browser 首轮已转绿的基础上，先补完第二轮 board/browser 验收，再完成 Google/email 与 CORS/origin 验收，然后跑一条刷新后四模型生图线的真实 live image smoke，接着回到 S1D/S3 收口，最后才继续更深的 S4 Yjs/provider proof。避免重新引入 legacy canvas compatibility 行为，也不要为了不紧急的 backlog 项目打断这条顺序。

## 更新规则

- 在一个小型活跃切片进行期间，只更新相关的 `project_state_slice_*.md`。
- 当某个切片达到稳定检查点时，再更新这个总索引。
- 提交历史才是详细的历史台账；不要把很长的旧 changelog 再复制回这个文件。
- 产品需求在 `../PRD/`。
- 架构规则在 `../ARCH/`。
