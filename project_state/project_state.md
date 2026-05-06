# TANGENT Project State Index

**Updated**: 2026-05-06
**Branch**: `feature/s1x-konva-handfeel-spike`
**Latest local checkpoint**: S1X Konva route stabilization + S1D effective-permission / owner-only copy-delete / expiring-share / known-foreign Asset guard hardening + S3 admin bootstrap first pass + S2/S3 first DB-backed AI control-plane read/quote + background-executed persisted mock AiRun lifecycle plus timeout-safe route-failover shell with attempt-level `ai_api_calls` and grouped `/admin` runtime attempt views; keep detailed history in Git.

This folder replaces the former root-level long project ledger and short mirror files. The root `project_state.md` is now only a pointer.

## Current Phase

TANGENT has accepted S0 local polish after Slice E persistence foundations. The canvas interaction pass and Smart Drawing are good enough for P0 alpha; keep only regression fixes and move new architecture work to S1.

S1X has reached a stable basic migration checkpoint. Konva v2 is now the formal Board runtime for new/missing Boards and saved Konva Boards. tldraw remains available as a development reference route, but production defaults block tldraw Board runtime usage. Collaboration/Yjs proof and real AiRun execution remain future work.

S1D has now moved past raw member CRUD scaffold into a usable first-pass permission layer: a backend `none/view/edit/manage/owner` resolver, owner-only Board copy/delete, Board restore, guest-aware board-member roles, people lookup, email invite, server-backed expiring share links, known-foreign Asset reference blocking and public shared-Board consumption are all present locally.

S3 also has a stable first-pass admin bootstrap checkpoint: `/admin` is now server-gated, reads summary/users/workspaces/boards/audit facts, and supports owner-only role grant/revoke with audit logging.

S2/S3 have now started the first real AI control-plane backend slice too: migration `20260506_0008` adds DB-backed model registry / parameter tiers / pricing rules and normalizes provider-route facts, migration `20260506_0009` extends `ai_runs` / `ai_api_calls` with quote-selected route/pricing linkage, `/api/v1/admin/ai/*` exposes read-only admin inspection, `/api/v1/ai/runs/quote` gives a payer-aware estimate/preflight before provider execution, and the DB-backed mock run path now supports background-executed persisted lifecycle rows plus a first-pass timeout-safe primary->backup route shell with one `ai_api_calls` row per provider attempt, retry-policy-aware execution, extracted settlement orchestration and grouped `/admin` runtime attempt views.

The next documented business-system target is now clearer too: S1D permission hardening for `Can view / Can edit / Can manage / Owner`, plus S3 Group-vs-Team workspace contracts that decide who may see member usage and how an AI run charges the acting user.

Operationally, this means `/boards/[boardId]` is the Konva-first path to keep polishing, `/spikes/canvas` is only a reference surface, and new canvas requirements should update the S1X slice docs before this total index is touched again.

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
  S3 first-pass billing/workspace entitlement dashboard contract with Collaborate Plus / Team Growth catalog, DB-backed read lookup, Team seat mutation, credit preflight coverage and internal ledger settlement helpers
  S2/S3 first DB-backed AI control-plane registry/provider-route/pricing-rule read + AiRun quote/preflight + background mock lifecycle/failover checkpoint
  Billing/team packaging strategy checkpoint
  AI contract scaffold
  Alembic scaffold
  Admin bootstrap groundwork

Not production-complete:
  real Auth/email/session
  share editor/invite-accept and full team/share permissions
  real Group/Team workspace governance, paid seat purchase flows and provider-backed actor-personal credit ledger charging
  staging auth/email/license hardening
  precise old-board style/binding migration beyond first-pass copy tooling
  Konva collaboration/Yjs provider sync
  true rendered Konva page-thumbnail assets/page duplicate/Move selection to new page
  real AI provider/cost logs
  full Admin/Billing/Analytics
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
| S2 AI Runtime | `project_state_slice_S2_ai_runtime.md` | Mock runtime/dataflow stable enough for provider planning; optional mock-ledger charging exercise exists; DB-backed model/pricing/route tables, AiRun quote/preflight, background-executed persisted mock `ai_runs`, attempt-level `ai_api_calls`, pure-read run polling, timeout-safe failover and extracted settlement orchestration now exist; real provider adapters are still pending |
| S3 Admin/Billing/Analytics | `project_state_slice_S3_admin_billing_analytics.md` | Admin first-pass and entitlement surfaces exist with Start/Plus/Growth catalog, DB-backed read lookup, Team seat mutation, credit preflight coverage, internal ledger settlement helpers, read-only `/admin` AI control-plane plus `/admin/ai/runs` and `/admin/ai/api-calls` routes, and a first-pass frontend `/admin` AI dashboard with grouped runtime attempt timelines on top of quote-time route/pricing facts plus persisted mock lifecycle facts for later admin run/cost views; write/publish workflows remain next |

## Current Next Fork

If external resources are not ready:

1. Hand-test S1X Page UI save/restore/history, page delete/reorder/Move to page and v1-to-v2 copy tooling on real Boards.
2. Keep S1X on regression-only fixes while the new share/admin checkpoints settle.
3. Harden S1D permissions into the target `Can view/edit/manage/owner` model with Group/Team workspace separation.
4. Replace the remaining stub adapter bodies with real provider adapters while preserving the new timeout-safe per-attempt observability and no-double-charge settlement boundary before real provider charging.
5. Expand the new AI control plane from read/quote into audited route/pricing publish flows.

If external resources are ready:

1. Finish recording S1B staging smoke status and deploy Konva-first Board route with tldraw disabled by default.
2. Run staging Postgres migration/query smoke and R2 asset smoke.
3. Continue S1C Auth rollout and harden S1D Auth-backed Board CRUD/public share on top of the Konva v2 Board contract.
4. Harden S1D Group/Team workspace permissions and S3 billing-visibility entitlements on top of real identity.
5. Move S2 real AI provider work through server-side AiRun contracts.
6. Expand S3 Admin from the current first-pass checkpoint after real Auth/admin roles exist.

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

Current recommendation: keep tldraw as reference-only, treat S1X page polish as accepted unless regressions appear, and use `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md` as the handoff checklist for S1B deployment, S1C Auth rollout, S2 real AiRun, S3 admin expansion and S4 collaboration sequencing. S1A is implemented, S1B staging Web/API/Postgres/R2 smoke is mostly through, S1D first-pass share flow is now in place, and the earlier tldraw license blocker is mitigated locally by the production gate and Konva route migration.

Next major checkpoint should be one of: S1 share/group-team permission hardening, S3 seat/credit + workspace-dashboard entitlement implementation, S2 real AiRun/provider execution, S3 richer admin search/pagination, or the Phase 6 Yjs collaboration proof. Avoid adding new tldraw-only behavior.

## Update Rules

- During a small active slice, update only the relevant `project_state_slice_*.md`.
- When a slice reaches a stable checkpoint, update this index.
- Commit history is the detailed historical ledger; do not copy long old changelogs back into this file.
- Product requirements live in `../PRD/`.
- Architecture rules live in `../ARCH/`.

## 中文完整翻译

# TANGENT 项目状态索引

**更新日期**：2026-05-06
**分支**：`feature/s1x-konva-handfeel-spike`
**最新本地检查点**：S1X Konva 路由稳定化 + S1D effective-permission / owner-only copy-delete / expiring-share / known-foreign Asset guard hardening + S3 后台 bootstrap 第一阶段 + S2/S3 第一批 DB-backed AI control-plane read/quote + 后台执行的 persisted mock AiRun lifecycle 加 timeout-safe route-failover shell，并带按尝试分行的 `ai_api_calls` 与分组 `/admin` runtime attempt 视图检查点；详细历史请留在 Git 中。

本目录取代了原来的根级长项目台账和短镜像文件。根目录 `project_state.md` 现在只做指针用途。

## 当前阶段

在 Slice E 持久化基础之后，TANGENT 已经接受 S0 本地 polish。白板交互和 Smart Drawing 已经足够作为 P0 alpha 使用；接下来只保留回归修复，把新的架构工作转移到 S1。

S1X 已经达到一个稳定的基础迁移检查点。Konva v2 现在是新建 / 缺失 Board 和已保存 Konva Board 的正式运行时。tldraw 仍保留为开发参考路由，但生产默认已经阻止 tldraw Board runtime 被使用。协作 / Yjs 证明和真实 AiRun 执行仍然是未来工作。

S1D 现在已经超越“原始 member CRUD scaffold”，进入了一个可用的第一阶段权限层：backend `none/view/edit/manage/owner` resolver、owner-only Board copy/delete、Board restore、支持 guest 的 board-member 角色、people lookup、email invite、服务端 expiring share links、known-foreign Asset reference blocking，以及公共 shared-Board 消费都已经在本地具备。

S3 也已经有了稳定的第一阶段后台 bootstrap 检查点：`/admin` 现在由服务端门控，能够读取 summary / users / workspaces / boards / audit 事实，并支持 owner-only 的 role grant / revoke 与审计日志。

S2/S3 现在也已经开始了第一条真正的 AI control-plane backend 主线：migration `20260506_0008` 增加了 DB-backed model registry / parameter tiers / pricing rules，并把 provider-route 事实做了第一批规范化；migration `20260506_0009` 则把 quote 阶段选中的 route/pricing 关联扩展进 `ai_runs` / `ai_api_calls`；`/api/v1/admin/ai/*` 暴露了只读后台检查接口，`/api/v1/ai/runs/quote` 会在 provider execution 之前返回带 payer 信息的 estimate/preflight，而 DB-backed mock run 路径现在也已经支持后台执行的持久化 lifecycle rows、timeout-safe 的 primary->backup route shell、retry-policy-aware execution、抽离出的 settlement orchestration，并为每次 provider 尝试各写一条 `ai_api_calls` 记录；前端 `/admin` 也已经会按 run 分组显示这些 attempts，而不再只是一次性的 success 记录或一条会被覆盖的 API-call 摘要。

从业务系统角度看，下一步目标现在也更清晰了：一方面要把 S1D 权限继续硬化为 `Can view / Can edit / Can manage / Owner`，另一方面要把 S3 的 Group/Team workspace 合同做清楚，明确谁能看到成员 usage，以及一次 AI run 应该怎样扣到当前操作者自己。

从运行角度看，这意味着 `/boards/[boardId]` 是需要继续打磨的 Konva-first 主路径，`/spikes/canvas` 只是参考表面；新的白板需求在更新这个总索引之前，应该先更新 S1X 切片文档。

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
  S3 first-pass billing/workspace entitlement dashboard contract with Collaborate Plus / Team Growth catalog, DB-backed read lookup, Team seat mutation、credit preflight coverage 和 internal ledger settlement helpers
  S2/S3 first DB-backed AI control-plane registry/provider-route/pricing-rule read + AiRun quote/preflight + background mock lifecycle/failover checkpoint
  Billing/team packaging strategy checkpoint
  AI contract scaffold
  Alembic scaffold
  Admin bootstrap groundwork

尚未达到生产完成：
  real Auth/email/session
  share editor/invite-accept and full team/share permissions
  real Group/Team workspace governance、paid seat purchase flows 和 provider-backed actor-personal credit ledger charging
  staging auth/email/license hardening
  precise old-board style/binding migration beyond first-pass copy tooling
  Konva collaboration/Yjs provider sync
  true rendered Konva page-thumbnail assets/page duplicate/Move selection to new page
  real AI provider/cost logs
  full Admin/Billing/Analytics
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
| S2 AI Runtime | `project_state_slice_S2_ai_runtime.md` | Mock runtime/dataflow 已足够规划 provider；optional mock-ledger charging exercise 已存在；DB-backed model/pricing/route tables、AiRun quote/preflight、后台执行的持久化 mock `ai_runs`、按尝试分行的 `ai_api_calls`、纯读取 run polling、timeout-safe failover，以及抽离出的 settlement orchestration 现在都已存在；真实 provider adapters 仍待完成 |
| S3 Admin/Billing/Analytics | `project_state_slice_S3_admin_billing_analytics.md` | Admin 第一阶段和 entitlement surfaces 已存在，并带 Start/Plus/Growth catalog、DB-backed read lookup、Team seat mutation、credit preflight coverage、internal ledger settlement helpers、只读 `/admin` AI control-plane 加 `/admin/ai/runs` 和 `/admin/ai/api-calls` routes，以及建立在 quote-time route/pricing facts 和 persisted mock lifecycle facts 之上的第一阶段前端 `/admin` grouped runtime attempt dashboard；可写 publish workflow 仍是下一主线 |

## 当前下一条分叉路线

如果外部资源还没准备好：

1. 手测真实 Board 上的 S1X Page UI save/restore/history、page delete/reorder/Move to page，以及 v1-to-v2 copy tooling。
2. 让 S1X 保持在只修回归的状态，同时等待新的 share/admin 检查点稳定。
3. 把 S1D 权限硬化到目标 `Can view/edit/manage/owner` 模型，并拆清 Group/Team workspace 边界。
4. 在真实 provider charging 之前，先把剩余的 stub adapter bodies 替换成真实 route execution / provider adapters，同时保留新的 timeout-safe 逐次尝试可观测性和 no-double-charge settlement 边界。
5. 再把新的 AI control plane 从 read/quote 扩展成带审计的 route/pricing publish flows。

如果外部资源已经准备好：

1. 补全 S1B staging smoke 状态记录，并以 Konva-first 路由部署，同时默认禁用 tldraw。
2. 运行 staging Postgres migration/query smoke 和 R2 asset smoke。
3. 继续推进 S1C Auth rollout，并在 Konva v2 Board 合同之上继续加固 S1D Auth-backed Board CRUD / public share。
4. 在真实 identity 之上继续硬化 S1D 的 Group/Team workspace 权限，以及 S3 的 billing 可见性 entitlement。
5. 通过服务端 AiRun 合同推进 S2 的真实 AI provider 工作。
6. 在真实 Auth/admin roles 存在之后，再从第一阶段检查点继续扩展 S3 Admin。

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

当前建议是：继续把 tldraw 视作参考路径；除非出现回归，否则把 S1X page polish 视为已接受；并使用 `dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md` 作为 S1B 部署、S1C Auth rollout、S2 真实 AiRun、S3 admin 扩展和 S4 协作排序的交接检查清单。S1A 已实现，S1B staging Web/API/Postgres/R2 smoke 已基本完成，S1D 第一阶段 share flow 已就绪，之前的 tldraw license blocker 也已通过生产 gate 和 Konva 路由迁移在本地得到缓解。

下一个主要检查点应当是以下之一：S1 share/group-team permission hardening、S3 seat/credit + workspace-dashboard entitlement implementation、S2 real AiRun/provider execution、S3 richer admin search/pagination，或者 Phase 6 的 Yjs collaboration proof。避免再新增任何只属于 tldraw 的行为。

## 更新规则

- 在一个小型活跃切片进行期间，只更新相关的 `project_state_slice_*.md`。
- 当某个切片达到稳定检查点时，再更新这个总索引。
- 提交历史才是详细的历史台账；不要把很长的旧 changelog 再复制回这个文件。
- 产品需求在 `../PRD/`。
- 架构规则在 `../ARCH/`。
