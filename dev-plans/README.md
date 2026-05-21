# Dev Plans Index

**Updated**: 2026-05-20

Detailed product, architecture and state truth now lives in:

- `../PRD/PRD.md`
- `../ARCH/ARCH.md`
- `../project_state/project_state.md`

`dev-plans/` is only for tactical implementation plans, external research notes and historical archive.

## Active Tactical Plans

| File | Status | Notes |
| --- | --- | --- |
| `p0-project-wide-acceptance-audit-2026-05-18.md` | Active acceptance ledger | Project-wide audit for PRD/ARCH/project_state/dev-plans, quality gates, memory/line-budget hotspots and secret-flow hygiene. |
| `p0-alpha-stabilization-and-acceptance-2026-05-06.md` | Active release-spine plan | Defines the current shipping-now list, deferred/frozen list, route map, risk matrix and acceptance guide for the P0 alpha pass. |
| `s1c-auth-admin-production-boundary-2026-05-08.md` | Active S1C tactical plan | Hardens real Clerk login, admin_roles bootstrap, CORS/origin contract, spoof tests and default solo workspace + personal wallet creation before staging/admin acceptance. |
| `s1e-tgy-board-package-export-import-2026-05-08.md` | Planned S1E tactical plan | Defines `.tgy` Tanergy Board Package export/import, package contents, asset rehydration, validation and smoke phases. |
| `s2-ai-provider-route-billing-control-plane-2026-05-07.md` | Active S2 tactical plan | Moves provider route switching, credit charging, provider-cost settlement and admin observability behind one server-owned AiRun control plane. |
| `s3-admin-operator-console-redesign-2026-05-09.md` | Active S3 tactical plan | Rebuilds the admin developer console around a fast user inventory, one-call user detail bundle, Team/Group plan tabs, modal operations and missing admin write/read contracts. |
| `s3-team-group-board-billing-chain-audit-2026-05-18.md` | Active S3 chain audit plan | Chinese end-to-end audit for Team/Group plan lifecycle, credits, seats, board governance, admin finance operations, stale collaboration clients and AI usage charging before the next implementation cut. |
| `s3-team-group-wallets-membership-billing-plan-2026-05-08.md` | Active S3 tactical plan | Supersedes the old Team actor-personal charging strategy with Team wallet, personal Collaborate wallet, invites, seats, membership, billing usage and payer-resolver phases. |
| `s3s4-team-group-foundation-unification-2026-05-16.md` | Active foundation baseline | Chinese consolidation baseline for free/team/group/invite/billing/collaboration rules, confirmed on 2026-05-16 and ready to drive PRD/ARCH/project_state alignment before deeper multiplayer testing. |
| `s4-collaboration-invite-presence-plan-2026-05-16.md` | Planned S4 tactical plan | Reuses the existing invite/member/role contracts to sequence invite-link acceptance, live cursors/presence, sensitive-edit occupancy and optimistic sync. |
| `s1b-supabase-r2-redis-collaboration-infra-plan-2026-05-18.md` | Accepted S1B infra decision plan | Chinese plan for rebuilding staging on a fresh Supabase Pro Postgres project, clearing stale R2 staging objects, keeping R2 for assets, and moving collaboration process traffic to WebSocket/Redis with Postgres storing final snapshots. |
| `s1b-staging-deployment-runbook-2026-05-02.md` | Active S1B runbook | Chinese beginner guide for domain, DNS, Vercel, Hetzner API hosting, Supabase Pro Postgres, R2, Clerk, Google OAuth and email setup. |
| `p0-collaboration-security-hardening-2026-05-19.md` | Active security/ops hardening ledger | Tracks P0/P1 security hardening, anti-abuse, deployment config smoke, public ops readiness smoke, observability hooks and remaining external ops blockers. |

## Current Tactical Focus

1. Stabilize the current P0 alpha spine defined in `p0-alpha-stabilization-and-acceptance-2026-05-06.md`.
2. Keep staging on release-style deploys with a private server-local shared `api.env`, not a long-lived dirty checkout; then run the staging / real DB / real login smoke first: public ops readiness smoke, Alembic head, `/health`, `/api/v1/admin/me`, operator users, finance summary, board list/save/load and billing plans. Keep `deploy/production/README.md` as the pre-provision boundary and do not open production before this smoke is green and external uptime/backup/error-tracking proof exists.
3. Treat the real Clerk session/admin smoke, first signed-in board/browser pass and mostly-green second-round board pass as green checkpoints. The `Manage board -> Copy board` Free-plan limit modal path is now wired locally; spot-check it on staging before relying on staging as the final truth.
4. Finish Google/email and CORS/origin acceptance after the signed-in board pass so the Auth boundary is fully believable outside local fallback assumptions.
5. Finish the S2 provider-route/billing control-plane cut with one real AiRun/provider image smoke using the refreshed four-model image lane, then keep broader provider coverage moving.
6. Return to S1D/S3 closeout after the live image smoke: permission hardening, Team/Group payer visibility, billing language, credits, usage and staged payment truth should converge before the next expansion.
7. Resume Yjs/provider deepening only after the release-spine server boundaries above are cleaner and verified.
8. Add S1E `.tgy` Board Package export/import after Board/Asset guards stay stable.
9. Track frontend product UI alignment as a parallel lane: navigation, plan labels, role language, loading states and AI cost messaging must match the narrower P0 alpha promise before launch.

Working rule for the current pass:

- avoid stacking transitional fallbacks or patchy side paths when a bounded rewrite is cleaner
- keep memory-pressure and slow-path auditing active while touching admin, canvas, AI and persistence code
- if a follow-on idea is useful but not urgent, record it in the relevant plan/slice first and keep the current mainline sequence intact
- treat `source file < 300 lines` as a project-wide acceptance rule; when a touched file is already too large, the split belongs in the current implementation cut rather than a vague cleanup bucket

## Archive

`Archive/` contains completed or superseded historical plans and handoffs. Do not use archive files as active truth.

`Archive/overseas-cost-growth-forecast.md` remains useful as old market/cost research, and `Archive/s3-billing-team-entitlements-strategy-2026-05-06.md` remains only a superseded benchmark reference. `Archive/s1-launch-readiness-and-acceptance-report-2026-05-05.md` and `Archive/s1x-canvas-engine-migration-reference-2026-05-03.md` are now historical context only; their remaining actionable items have been folded into the P0 spine, S1B Supabase/R2/Redis plan and the S1X/S4 slice docs. The active commercial implementation strategy is `s3-team-group-wallets-membership-billing-plan-2026-05-08.md`.

## Update Rules

- Do not duplicate PRD/ARCH/Project_state details here.
- A new implementation cut can get a small `dev-plans/<slice>.md` if it needs a tactical checklist.
- When that cut completes, update the relevant slice docs and move the tactical plan to `Archive/` if it is no longer active.
- Active plans should explicitly record any required large-file splits and the order in which they will be taken down.

## 中文完整翻译

# Dev Plans 索引

**更新日期**：2026-05-20

详细的产品、架构和状态事实现在位于：

- `../PRD/PRD.md`
- `../ARCH/ARCH.md`
- `../project_state/project_state.md`

`dev-plans/` 只用于战术实施计划、外部研究 notes 和历史归档。

## 活跃战术计划

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `p0-project-wide-acceptance-audit-2026-05-18.md` | 活跃验收台账 | 本轮全项目验收文档，覆盖 PRD/ARCH/project_state/dev-plans、质量门、内存/大文件热点和 secret-flow hygiene。 |
| `p0-alpha-stabilization-and-acceptance-2026-05-06.md` | 活跃 release-spine plan | 定义本轮 P0 alpha 的 shipping-now list、deferred/frozen list、route map、risk matrix 和 acceptance guide。 |
| `s1c-auth-admin-production-boundary-2026-05-08.md` | 活跃 S1C tactical plan | 在 staging/admin 验收前，硬化真实 Clerk 登录、admin_roles bootstrap、CORS/origin contract、spoof tests，以及默认 solo workspace + personal wallet 创建。 |
| `s1e-tgy-board-package-export-import-2026-05-08.md` | 已规划 S1E tactical plan | 定义 `.tgy` Tanergy Board Package export/import、package contents、asset rehydration、validation 和 smoke phases。 |
| `s2-ai-provider-route-billing-control-plane-2026-05-07.md` | 活跃 S2 tactical plan | 把 provider route 切换、credits 扣费、provider-cost settlement 和 admin observability 收口到服务端 AiRun control plane。 |
| `s3-admin-operator-console-redesign-2026-05-09.md` | 活跃 S3 tactical plan | 围绕快速 User inventory、一次性 user detail bundle、Team/Group plan tabs、弹窗操作，以及缺失的 admin read/write contracts，重做 developer admin console。 |
| `s3-team-group-board-billing-chain-audit-2026-05-18.md` | 活跃 S3 全链路审计计划 | 中文梳理 Team/Group plan 生命周期、积分、seat、board 治理、Admin Finance 操作、旧协同客户端和 AI usage 扣费，作为下一轮实现前的规则收口。 |
| `s3-team-group-wallets-membership-billing-plan-2026-05-08.md` | 活跃 S3 tactical plan | 用 Team wallet、个人 Collaborate wallet、invites、seats、membership、billing usage 和 payer-resolver 阶段，取代旧的 Team actor-personal 扣费策略。 |
| `s3s4-team-group-foundation-unification-2026-05-16.md` | 活跃 foundation baseline | 统一 Free / Team / Group / Invite / Billing / Collaboration 的产品口径，是后续 S3/S4 改动的业务规则基线。 |
| `s4-collaboration-invite-presence-plan-2026-05-16.md` | 已规划 S4 tactical plan | 在现有 invite/member/role 合同上继续推进 invite-link acceptance、live cursors/presence、sensitive-edit occupancy 和 optimistic sync。 |
| `s1b-supabase-r2-redis-collaboration-infra-plan-2026-05-18.md` | Accepted S1B infra decision plan | 中文方案：用全新的 Supabase Pro Postgres 重建 staging，清理旧 R2 staging 对象，R2 继续做图片资产存储，协同过程改走 WebSocket/Redis，Postgres 只落最终快照。 |
| `s1b-staging-deployment-runbook-2026-05-02.md` | 活跃 S1B runbook | 面向新手的中文指南，覆盖 domain、DNS、Vercel、Hetzner API hosting、Supabase Pro Postgres、R2、Clerk、Google OAuth 和 email setup。 |
| `p0-collaboration-security-hardening-2026-05-19.md` | 活跃安全/运维加固台账 | 跟踪 P0/P1 安全加固、防刷、部署配置 smoke、公开 ops readiness smoke、观测 hooks 和剩余外部 ops 阻塞项。 |

## 当前战术焦点

1. 以 `p0-alpha-stabilization-and-acceptance-2026-05-06.md` 为准，稳定当前 P0 alpha 主线。
2. staging 继续使用 release-style deploy 和私有 server-local shared `api.env`，下一次部署后先跑 public ops readiness smoke，再跑 Alembic、`/health`、admin/session、board list/save/load 和 billing plans。
3. 先把 staging / real DB / real login smoke、signed-in browser 首轮验收以及大部分第二轮 board 验收视为已转绿 checkpoint；`Manage board -> Copy board` Free-plan limit 弹窗路径已完成本地 wiring，下一步集中做 staging spot check。
4. 接着完成 Google/email 与 CORS/origin 验收，让 Auth 边界不再依赖本地 fallback 假设。
5. 再完成 S2 provider-route/billing control-plane cut 和一条基于刷新后四模型生图线的真实 AiRun/provider 路径，然后继续扩大 AI 覆盖。
6. 然后回到 S1D/S3 收口：permission hardening、Team/Group payer visibility、billing language、credits、usage 和 staged payment truth 需要在继续扩线前对齐。
7. 在上面的 release-spine 服务端边界更干净、更可信，并且外部 uptime/backup/error-tracking 证明到位之后，再恢复 Yjs/provider 深化。
8. 在 Board/Asset guards 稳定后加入 S1E `.tgy` Board Package export/import。
9. 把前端产品 UI 对齐视为并行线路：navigation、套餐标签、角色语言、loading states 和 AI 扣费文案在上线前必须匹配当前更窄的 P0 alpha 承诺。
10. 如果是有价值但不紧急的后续开发，先写进对应 plan / slice 文档，不打断当前主线顺序。

## 归档

`Archive/` 包含已完成或已被取代的历史计划和 handoffs。不要把 archive 文件当作活跃事实来源。

`Archive/overseas-cost-growth-forecast.md` 仍可作为旧市场 / 成本研究参考，`Archive/s3-billing-team-entitlements-strategy-2026-05-06.md` 只保留为已被取代的基准参考。`Archive/s1-launch-readiness-and-acceptance-report-2026-05-05.md` 和 `Archive/s1x-canvas-engine-migration-reference-2026-05-03.md` 现在只保留历史上下文；剩余可执行项已经合并进 P0 主线、S1B Supabase/R2/Redis 方案以及 S1X/S4 切片文档。当前活跃商业实现策略是 `s3-team-group-wallets-membership-billing-plan-2026-05-08.md`。

## 更新规则

- 不要在这里重复 PRD/ARCH/Project_state 细节。
- 如果新的 implementation cut 需要战术 checklist，可以新增一个小的 `dev-plans/<slice>.md`。
- 当这个 cut 完成后，更新相关切片文档；如果该战术计划不再活跃，就移动到 `Archive/`。
