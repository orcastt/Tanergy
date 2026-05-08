# TANGENT Project State Index

**Updated**: 2026-05-08
**Branch**: `feature/s1x-konva-handfeel-spike`
**Latest local checkpoint**: S1X Konva route stabilization + S1D permission/share hardening + S2/S3 DB-backed AI control-plane scaffolds + first-pass billing/team/usage/admin surfaces + GeekAI local canvas UX proof. The active business-system checkpoint is now the S3 Team/Group wallet pivot: Team plans should use isolated Team workspaces and Team wallets, while Group/Collaborate uses personal wallets.

This folder replaces the former root-level long project ledger and short mirror files. The root `project_state.md` is now only a pointer.

## Current Phase

TANGENT has accepted S0 local polish after Slice E persistence foundations. The canvas interaction pass and Smart Drawing are good enough for P0 alpha; keep only regression fixes and move new architecture work to S1.

S1X has reached a stable basic migration checkpoint. Konva v2 is now the formal Board runtime for new/missing Boards and saved Konva Boards. tldraw remains available as a development reference route, but production defaults block tldraw Board runtime usage. Collaboration/Yjs proof and real AiRun execution remain future work.

S1D has now moved past raw member CRUD scaffold into a usable first-pass permission layer: a backend `none/view/edit/manage/owner` resolver, owner-only Board copy/delete, Board restore, guest-aware board-member roles, people lookup, email invite, server-backed expiring share links, known-foreign Asset reference blocking and public shared-Board consumption are all present locally.

S3 also has a stable first-pass admin bootstrap checkpoint: `/admin` is now server-gated, reads summary/users/workspaces/boards/audit facts, supports owner-only role grant/revoke with audit logging, and now includes first-pass save/edit panels plus versioned publish/rollback for AI model routes and pricing, along with billing/usage/team write surfaces.

S2/S3 have now started the first real AI control-plane backend slice too: migration `20260506_0008` adds DB-backed model registry / parameter tiers / pricing rules and normalizes provider-route facts, migration `20260506_0009` extends `ai_runs` / `ai_api_calls` with quote-selected route/pricing linkage, migration `20260506_0010` adds provider-currency/runtime-cost facts, migration `20260506_0011` adds control-plane version history and cost-ledger settlement columns, `/api/v1/admin/ai/*` exposes admin inspection plus first-pass PATCH save and publish/rollback flows, `/api/v1/ai/runs/quote` gives a payer-aware estimate/preflight before provider execution, and the run path now supports persisted lifecycle rows, a timeout-safe primary->backup route shell, opt-in live provider-specific adapter dispatch, normalized provider cost/currency settlement, attempt-level `api_cost_ledger` facts and grouped `/admin` runtime attempt views with finer filters/drill-down.

In parallel, the canvas now has a fast local GeekAI integration path through the web app for user-flow proof: Chat can stream text, Prompt Optimizer can stream improved image prompts, Analysis can choose OpenAI-style or Gemini-style visual analysis models, and Image Gen / Image Gen 4 can run model-aware image generation/edit/reference flows with GPT Image 2, Nano Banana 2, Doubao Seedream and Jimeng parameter surfaces. This is useful product evidence, but it is not yet the production authority boundary; the next S2 cut is to fold that GeekAI path into the server AiRun provider-route/billing control plane documented in `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md`.

The next documented business-system target is now the S3 Team/Group wallet slice: Team purchase creates an isolated Team workspace and Team wallet, while Collaborate remains a personal subscription/wallet for Group collaboration. S1D permission hardening still matters, but the payer contract must now distinguish Team wallet from personal Group/Collaborate wallet.

Operationally, this means `/boards/[boardId]` is the Konva-first path to keep polishing, `/spikes/canvas` is only a reference surface, and new canvas requirements should update the S1X slice docs before this total index is touched again.

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
S1A Schema/DB foundation      80%  core join points exist; Team-wallet schema delta and staging DB smoke remain
S1B Deploy/staging            60%  Web/API/Neon/R2 smoke exists; Auth/email/OAuth pass pending
S1C Auth/registration         55%  Clerk/FastAPI first pass exists; session hardening pending
S1D Board/share/invites       68%  CRUD/share/member first pass exists; workspace invite accept and Team/Group permission split pending
S2 AI runtime/provider routes 55%  GeekAI local UX path exists; server route/billing control-plane plus Team-wallet payer resolver pending
S3 Admin/billing/team         46%  admin/billing/team scaffolds exist; Team-wallet/Collaborate-wallet pivot and real payments pending
Frontend product UI alignment 52%  major surfaces exist; nav, plan labels and cost messaging need alignment
S4 Collaboration              10%  boundary documented; Yjs/provider proof deferred
```

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
  S1X formal /boards/[boardId] dual-engine detector
  tldraw production gate and local old v1 Board cleanup
  S1X Konva v2 page contract + Page polish first pass
  S1X explicit v1-to-v2 copy tooling first pass
  S1 launch-readiness acceptance report
  S1A DB schema/migrations
  Auth scaffold
  S1D first-pass Board members/share/public share flow with owner-only copy/delete and known-foreign Asset guard
  S3 first-pass admin probe/summary/audit/role management
  S3 first-pass billing/workspace entitlement dashboard contract with Collaborate Plus / Team Growth catalog, DB-backed read lookup, Team seat mutation, credit preflight coverage, internal ledger settlement helpers, payment-backed top-up/seat checkout scaffolds and first-pass top-up/usage/admin AI save panels
  S3 Team/Group wallet plan update: Team wallet replaces the older Team actor-personal charging strategy; Collaborate stays personal-wallet based
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
  real Group/Team workspace governance, Team wallet charging, personal Collaborate wallet charging, paid seat renewal/cancellation flows and external payment-provider-backed ledger charging
  staging auth/email/license hardening
  precise old-board style/binding migration beyond first-pass copy tooling
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
| S1B Staging Infra | `project_state_slice_S1B_staging_infra.md` | In progress; FastAPI/Neon/R2 smoke passed |
| S1C Auth Context | `project_state_slice_S1C_auth_request_context.md` | In progress; real provider-backed auth still pending end-to-end rollout |
| S1D Board CRUD | `project_state_slice_S1D_auth_board_crud.md` | Stable first-pass CRUD/member/share/public-share-open checkpoint with owner-only copy/delete, share expiry and known-foreign Asset guard |
| S1X Canvas Engine Migration | `project_state_slice_S1X_canvas_engine_migration.md` | Konva Board route accepted; Page polish and v1 copy tooling landed; collaboration pending |
| S2 AI Runtime | `project_state_slice_S2_ai_runtime.md` | Mock/runtime dataflow, persisted route/settlement shell and local GeekAI canvas path are usable; DB-backed quote/preflight/lifecycle/attempt facts exist; production gate is folding GeekAI plus future providers into the server provider-route/billing control plane and validating one live image path with durable Asset/text-output handling |
| S3 Admin/Billing/Analytics | `project_state_slice_S3_admin_billing_analytics.md` | Active pivot: admin, billing/team/usage, seat, ledger and AI runtime/control-plane scaffolds exist; the next production gate is Team wallet + personal Collaborate wallet payer semantics, invite/member hardening and real payment/provider settlement |

## Current Next Fork

If external resources are not ready:

1. Hand-test S1X Page UI save/restore/history, page delete/reorder/Move to page and v1-to-v2 copy tooling on real Boards.
2. Keep S1X on regression-only fixes while the new share/admin checkpoints settle.
3. Harden S1D permissions into the target `Can view/edit/manage/owner` model with Group/Team workspace separation.
4. Start the S3 Team/Group wallet slice: schema delta, Team checkout creates workspace+wallet, Collaborate one-active personal subscription, invite/member hardening and payer resolver tests.
5. Fold the current GeekAI local fast path into the server provider-route adapter layer while preserving timeout-safe per-attempt observability and no-double-charge settlement before real provider charging.

If external resources are ready:

1. Finish recording S1B staging smoke status and deploy Konva-first Board route with tldraw disabled by default.
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
  Konva v2 Board route accepted, tldraw reference gated, Yjs viability pending
  |
  v
S1C real Auth
  register, login, logout, session, default workspace
  |
  v
S1D Auth-backed Board CRUD
  server-side list/load/save/history/copy/delete, members, share and public shared-Board view
  |
  +--> S2 real AI provider and AiRun/cost facts
  +--> S3 Admin/Credits/Billing/Analytics expansion
  +--> S4 Collaboration
```

Current recommendation: keep tldraw as reference-only, treat S1X page polish as accepted unless regressions appear, and use `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md`, `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md` and `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md` as the handoff checklists. S1A is implemented but needs the Team-wallet delta, S1D first-pass share flow is in place, and S3 should not start real provider charging until Team wallet and personal Collaborate wallet payer tests pass.

Next major checkpoint should be one of: S2 GeekAI provider-route/billing control-plane reconciliation with one real live image smoke, S1 share/group-team permission hardening, S3 payment/finance settlement depth, frontend UI alignment on navigation/plan/cost language, or the Phase 6 Yjs collaboration proof. Avoid adding new tldraw-only behavior.

## Update Rules

- During a small active slice, update only the relevant `project_state_slice_*.md`.
- When a slice reaches a stable checkpoint, update this index.
- Commit history is the detailed historical ledger; do not copy long old changelogs back into this file.
- Product requirements live in `../PRD/`.
- Architecture rules live in `../ARCH/`.

## 中文完整翻译

# TANGENT 项目状态索引

**更新日期**：2026-05-08
**分支**：`feature/s1x-konva-handfeel-spike`
**最新本地检查点**：S1X Konva 路由稳定化 + S1D permission/share hardening + S2/S3 DB-backed AI control-plane 脚手架 + 第一阶段 billing/team/usage/admin surfaces + GeekAI 本地画布 UX proof。当前业务系统检查点是 S3 Team/Group wallet 调整：Team 套餐使用彼此隔离的 Team workspace 和 Team wallet，Group/Collaborate 使用个人钱包。

本目录取代了原来的根级长项目台账和短镜像文件。根目录 `project_state.md` 现在只做指针用途。

## 当前阶段

在 Slice E 持久化基础之后，TANGENT 已经接受 S0 本地 polish。白板交互和 Smart Drawing 已经足够作为 P0 alpha 使用；接下来只保留回归修复，把新的架构工作转移到 S1。

S1X 已经达到一个稳定的基础迁移检查点。Konva v2 现在是新建 / 缺失 Board 和已保存 Konva Board 的正式运行时。tldraw 仍保留为开发参考路由，但生产默认已经阻止 tldraw Board runtime 被使用。协作 / Yjs 证明和真实 AiRun 执行仍然是未来工作。

S1D 现在已经超越“原始 member CRUD scaffold”，进入了一个可用的第一阶段权限层：backend `none/view/edit/manage/owner` resolver、owner-only Board copy/delete、Board restore、支持 guest 的 board-member 角色、people lookup、email invite、服务端 expiring share links、known-foreign Asset reference blocking，以及公共 shared-Board 消费都已经在本地具备。

S3 也已经有了稳定的第一阶段后台 bootstrap 检查点：`/admin` 现在由服务端门控，能够读取 summary / users / workspaces / boards / audit 事实，支持 owner-only 的 role grant / revoke 与审计日志，并且现在也已经带上 AI model / route / pricing 的第一阶段 save/edit panels 和版本化 publish/rollback，以及 billing / usage / team 的写入界面。

S2/S3 现在也已经开始了第一条真正的 AI control-plane backend 主线：migration `20260506_0008` 增加了 DB-backed model registry / parameter tiers / pricing rules，并把 provider-route 事实做了第一批规范化；migration `20260506_0009` 则把 quote 阶段选中的 route/pricing 关联扩展进 `ai_runs` / `ai_api_calls`；migration `20260506_0010` 则继续补上 provider-currency / runtime-cost 事实；migration `20260506_0011` 则增加控制平面版本历史与 cost-ledger settlement 列。`/api/v1/admin/ai/*` 现在既暴露后台检查接口，也已经带上第一阶段 PATCH save 和 publish/rollback flows；`/api/v1/ai/runs/quote` 会在 provider execution 之前返回带 payer 信息的 estimate/preflight，而当前 run 路径已经支持持久化 lifecycle rows、timeout-safe 的 primary->backup route shell、可选启用的 live provider-specific adapter dispatch、归一化后的 provider cost/currency settlement、按尝试分行的 `api_cost_ledger` 事实，以及带更细 filters / drill-down 的 `/admin` runtime attempt 视图。

与此同时，画布现在也有了一条通过 Web app 接入 GeekAI 的本地 fast path，用来验证用户流程：Chat 可以流式输出文本，Prompt Optimizer 可以流式优化出图提示词，Analysis 可以选择 OpenAI 系或 Gemini 系视觉分析模型，Image Gen / Image Gen 4 可以用 GPT Image 2、Nano Banana 2、Doubao Seedream 和 Jimeng 的参数界面运行 image generation/edit/reference。这对产品验证有价值，但还不是生产权限边界；下一步 S2 cut 是把这条 GeekAI 路径收口到 `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md` 里定义的 server AiRun provider-route/billing control plane。

从业务系统角度看，下一步目标已经切到 S3 Team/Group wallet：Team purchase 创建隔离的 Team workspace 和 Team wallet；Collaborate 仍然是个人订阅 / 个人钱包，用于 Group 协作。S1D 权限硬化仍然重要，但 payer contract 必须区分 Team wallet 和个人 Group/Collaborate wallet。

从运行角度看，这意味着 `/boards/[boardId]` 是需要继续打磨的 Konva-first 主路径，`/spikes/canvas` 只是参考表面；新的白板需求在更新这个总索引之前，应该先更新 S1X 切片文档。

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
S1A Schema/DB foundation      80%  core join points 已存在；Team-wallet schema delta 和 staging DB smoke 仍待完成
S1B Deploy/staging            60%  Web/API/Neon/R2 smoke 已存在；Auth/email/OAuth 待通过
S1C Auth/registration         55%  Clerk/FastAPI 第一阶段存在；session hardening 待完成
S1D Board/share/invites       68%  CRUD/share/member 第一阶段存在；workspace invite accept 和 Team/Group permission split 待完成
S2 AI runtime/provider routes 55%  GeekAI 本地 UX 路径存在；服务端 route/billing control-plane 与 Team-wallet payer resolver 待完成
S3 Admin/billing/team         46%  admin/billing/team 脚手架存在；Team-wallet/Collaborate-wallet 调整和真实支付待完成
Frontend product UI alignment 52%  主要界面已存在；导航、套餐语言和扣费文案需要对齐
S4 Collaboration              10%  边界已文档化；Yjs/provider proof 后置
```

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
  S1X formal /boards/[boardId] dual-engine detector
  tldraw production gate and local old v1 Board cleanup
  S1X Konva v2 page contract + Page polish first pass
  S1X explicit v1-to-v2 copy tooling first pass
  S1 launch-readiness acceptance report
  S1A DB schema/migrations
  Auth scaffold
  S1D first-pass Board members/share/public share flow with owner-only copy/delete and known-foreign Asset guard
  S3 first-pass admin probe/summary/audit/role management
  S3 first-pass billing/workspace entitlement dashboard contract with Collaborate Plus / Team Growth catalog, DB-backed read lookup, Team seat mutation、credit preflight coverage、internal ledger settlement helpers、payment-backed top-up/seat checkout scaffolds 和第一阶段 top-up / usage / admin AI save panels
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
  real Group/Team workspace governance、Team wallet charging、personal Collaborate wallet charging、paid seat renewal/cancellation flows 和 external payment-provider-backed ledger charging
  staging auth/email/license hardening
  precise old-board style/binding migration beyond first-pass copy tooling
  Konva collaboration/Yjs provider sync
  true rendered Konva page-thumbnail assets/page duplicate/Move selection to new page
  local GeekAI path 收口到 server AiRun/provider-route/billing control plane
  full real AI provider coverage 和 durable text-output persistence
  full Admin/Billing/Analytics 深度能力，包括 external billing reconciliation 和更丰富的 finance views
  collaboration
```

## 状态切片索引

| 切片 | 文件 | 状态 |
| --- | --- | --- |
| S0 本地打磨 | `Finished/project_state_slice_S0_local_polish.md` | 已完成 baseline；仅作为 regression reference |
| S1 Staging/Auth/Board | `project_state_slice_S1_staging_auth_board.md` | 活跃 umbrella；详细事实现在位于 S1A/S1B/S1C/S1D/S1X |
| S1A DB Schema | `project_state_slice_S1A_db_schema.md` | S1A core 已通过 `0006` 实现；当前 migration head 还包含 S3 `0007` |
| S1B Staging Infra | `project_state_slice_S1B_staging_infra.md` | 进行中；FastAPI / Neon / R2 smoke 已通过 |
| S1C Auth Context | `project_state_slice_S1C_auth_request_context.md` | 进行中；真实 provider-backed auth 还未端到端上线 |
| S1D Board CRUD | `project_state_slice_S1D_auth_board_crud.md` | 第一阶段 CRUD/member/share/public-share-open 检查点稳定，并已带 owner-only copy/delete、share expiry 和 known-foreign Asset guard |
| S1X Canvas Engine Migration | `project_state_slice_S1X_canvas_engine_migration.md` | Konva Board 路由已接受；Page polish 和 v1 copy tooling 已落地；协作仍待完成 |
| S2 AI Runtime | `project_state_slice_S2_ai_runtime.md` | Mock/runtime dataflow、持久化 route/settlement shell 和本地 GeekAI canvas path 都已可用；DB-backed quote/preflight/lifecycle/attempt facts 已存在；生产闸门是把 GeekAI 和未来 providers 收口到服务端 provider-route/billing control plane，并用 durable Asset/text-output handling 验证一条 live image path |
| S3 Admin/Billing/Analytics | `project_state_slice_S3_admin_billing_analytics.md` | Admin 第一阶段和 entitlement surfaces 已存在，并带 Start/Plus/Growth catalog、DB-backed read lookup、Team seat mutation、credit preflight coverage、internal ledger settlement helpers、payment-backed top-up/seat checkout scaffolds、第一阶段 top-up / usage / team-member 写入 surface、AI control-plane facts 的版本化 publish/rollback，以及建立在持久化 route/pricing/runtime-cost facts 之上的前端 `/admin` grouped runtime dashboard、细粒度 filters、per-run drill-down 和可编辑 model/route/pricing save panels；真实支付和 provider settlement 深度仍待完成 |

## 当前下一条分叉路线

如果外部资源还没准备好：

1. 手测真实 Board 上的 S1X Page UI save/restore/history、page delete/reorder/Move to page，以及 v1-to-v2 copy tooling。
2. 让 S1X 保持在只修回归的状态，同时等待新的 share/admin 检查点稳定。
3. 把 S1D 权限硬化到目标 `Can view/edit/manage/owner` 模型，并拆清 Group/Team workspace 边界。
4. 在真实 provider charging 之前，先把当前 GeekAI 本地 fast path 收口到服务端 provider-route adapter layer，同时保留 timeout-safe 逐次尝试可观测性和 no-double-charge settlement 边界。
5. 让新的 AI control plane 继续聚焦在带审计的 route/pricing publish flows、live smoke 和 durable output handling。

如果外部资源已经准备好：

1. 补全 S1B staging smoke 状态记录，并以 Konva-first 路由部署，同时默认禁用 tldraw。
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
  Konva v2 Board route accepted, tldraw reference gated, Yjs viability pending
  |
  v
S1C real Auth
  register, login, logout, session, default workspace
  |
  v
S1D Auth-backed Board CRUD
  server-side list/load/save/history/copy/delete, members, share and public shared-Board view
  |
  +--> S2 real AI provider and AiRun/cost facts
  +--> S3 Admin/Credits/Billing/Analytics expansion
  +--> S4 Collaboration
```

当前建议是：继续把 tldraw 视作参考路径；除非出现回归，否则把 S1X page polish 视为已接受；并使用 `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md`、`dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md` 和 `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md` 作为交接检查清单。S1A 已实现但需要 Team-wallet delta，S1D 第一阶段 share flow 已就绪，S3 在 Team wallet 和 personal Collaborate wallet payer 测试通过前，不应开始真实 provider charging。

下一个主要检查点应当是以下之一：S2 GeekAI provider-route/billing control-plane reconciliation 并完成一条真实 live image smoke、S1 share/group-team permission hardening、S3 payment/finance settlement depth、前端 UI 在 navigation/plan/cost language 上的对齐，或者 Phase 6 的 Yjs collaboration proof。避免再新增任何只属于 tldraw 的行为。

## 更新规则

- 在一个小型活跃切片进行期间，只更新相关的 `project_state_slice_*.md`。
- 当某个切片达到稳定检查点时，再更新这个总索引。
- 提交历史才是详细的历史台账；不要把很长的旧 changelog 再复制回这个文件。
- 产品需求在 `../PRD/`。
- 架构规则在 `../ARCH/`。
