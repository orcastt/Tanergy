# Dev Plans Index

**Updated**: 2026-05-09

Detailed product, architecture and state truth now lives in:

- `../PRD/PRD.md`
- `../ARCH/ARCH.md`
- `../project_state/project_state.md`

`dev-plans/` is only for tactical implementation plans, external research notes and historical archive.

## Active Tactical Plans

| File | Status | Notes |
| --- | --- | --- |
| `p0-alpha-stabilization-and-acceptance-2026-05-06.md` | Active release-spine plan | Defines the current shipping-now list, deferred/frozen list, route map, risk matrix and acceptance guide for the P0 alpha pass. |
| `s1c-auth-admin-production-boundary-2026-05-08.md` | Active S1C tactical plan | Hardens real Clerk login, admin_roles bootstrap, CORS/origin contract, spoof tests and default solo workspace + personal wallet creation before staging/admin acceptance. |
| `s1e-tgy-board-package-export-import-2026-05-08.md` | Planned S1E tactical plan | Defines `.tgy` Tanergy Board Package export/import, package contents, asset rehydration, validation and smoke phases. |
| `s2-ai-provider-route-billing-control-plane-2026-05-07.md` | Active S2 tactical plan | Moves provider route switching, credit charging, provider-cost settlement and admin observability behind one server-owned AiRun control plane. |
| `s3-admin-operator-console-redesign-2026-05-09.md` | Active S3 tactical plan | Rebuilds the admin developer console around a fast user inventory, one-call user detail bundle, Team/Group plan tabs, modal operations and missing admin write/read contracts. |
| `s3-team-group-wallets-membership-billing-plan-2026-05-08.md` | Active S3 tactical plan | Supersedes the old Team actor-personal charging strategy with Team wallet, personal Collaborate wallet, invites, seats, membership, billing usage and payer-resolver phases. |
| `s1b-staging-deployment-runbook-2026-05-02.md` | Active S1B runbook | Chinese beginner guide for domain, DNS, Vercel, Hetzner, Neon, R2, Clerk, Google OAuth and email setup. |
| `s1x-canvas-engine-migration-reference-2026-05-03.md` | Active S1X migration reference | Konva-first route/public share/admin-adjacent checkpoints are in; remaining work is runtime, export, performance and collaboration polish. |
| `s1-launch-readiness-and-acceptance-report-2026-05-05.md` | Active handoff report | Unified S1X/S1B/S1C/S1D/S2/S3/S4 launch-readiness order and acceptance checklist, now including public share, owner-only copy/delete, known-foreign Asset guard and admin bootstrap first pass. |
| `s3-billing-team-entitlements-strategy-2026-05-06.md` | Superseded strategy reference | Keep for market benchmarks and historical reasoning only; Team wallet rules now live in the 2026-05-08 S3 plan. |

## Current Tactical Focus

1. Stabilize the current P0 alpha spine defined in `p0-alpha-stabilization-and-acceptance-2026-05-06.md`.
2. Finish the S1C auth/admin production boundary before relying on staging admin: real Clerk login, admin_roles bootstrap, spoof tests, CORS/origin contract and first-session wallet creation.
3. Keep S1D focused on permission hardening for the current Board/share/page release path.
4. Add S1E `.tgy` Board Package export/import after Board/Asset guards stay stable.
5. Finish the S2 provider-route/billing control-plane cut and one real AiRun/provider path before broadening AI scope.
6. Move S3 through the Team/Group wallet plan before real charging: schema delta, Team workspace wallet, personal Collaborate wallet, invite/member hardening, payer resolver and billing usage.
7. Rebuild the admin operator console around the new inventory/detail mock before treating S3 admin as operator-ready.
8. Track frontend product UI alignment as a parallel lane: navigation, plan labels, role language and AI cost messaging must match the narrower P0 alpha promise before launch.

## Archive

`Archive/` contains completed or superseded historical plans and handoffs. Do not use archive files as active truth.

`Archive/overseas-cost-growth-forecast.md` remains useful as old market/cost research, but the active commercial implementation strategy is now `s3-billing-team-entitlements-strategy-2026-05-06.md`.

## Update Rules

- Do not duplicate PRD/ARCH/Project_state details here.
- A new implementation cut can get a small `dev-plans/<slice>.md` if it needs a tactical checklist.
- When that cut completes, update the relevant slice docs and move the tactical plan to `Archive/` if it is no longer active.

## 中文完整翻译

# Dev Plans 索引

**更新日期**：2026-05-09

详细的产品、架构和状态事实现在位于：

- `../PRD/PRD.md`
- `../ARCH/ARCH.md`
- `../project_state/project_state.md`

`dev-plans/` 只用于战术实施计划、外部研究 notes 和历史归档。

## 活跃战术计划

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `p0-alpha-stabilization-and-acceptance-2026-05-06.md` | 活跃 release-spine plan | 定义本轮 P0 alpha 的 shipping-now list、deferred/frozen list、route map、risk matrix 和 acceptance guide。 |
| `s1c-auth-admin-production-boundary-2026-05-08.md` | 活跃 S1C tactical plan | 在 staging/admin 验收前，硬化真实 Clerk 登录、admin_roles bootstrap、CORS/origin contract、spoof tests，以及默认 solo workspace + personal wallet 创建。 |
| `s1e-tgy-board-package-export-import-2026-05-08.md` | 已规划 S1E tactical plan | 定义 `.tgy` Tanergy Board Package export/import、package contents、asset rehydration、validation 和 smoke phases。 |
| `s2-ai-provider-route-billing-control-plane-2026-05-07.md` | 活跃 S2 tactical plan | 把 provider route 切换、credits 扣费、provider-cost settlement 和 admin observability 收口到服务端 AiRun control plane。 |
| `s3-admin-operator-console-redesign-2026-05-09.md` | 活跃 S3 tactical plan | 围绕快速 User inventory、一次性 user detail bundle、Team/Group plan tabs、弹窗操作，以及缺失的 admin read/write contracts，重做 developer admin console。 |
| `s3-team-group-wallets-membership-billing-plan-2026-05-08.md` | 活跃 S3 tactical plan | 用 Team wallet、个人 Collaborate wallet、invites、seats、membership、billing usage 和 payer-resolver 阶段，取代旧的 Team actor-personal 扣费策略。 |
| `s1b-staging-deployment-runbook-2026-05-02.md` | 活跃 S1B runbook | 面向新手的中文指南，覆盖 domain、DNS、Vercel、Hetzner、Neon、R2、Clerk、Google OAuth 和 email setup。 |
| `s1x-canvas-engine-migration-reference-2026-05-03.md` | 活跃 S1X migration reference | Konva-first route / public share / admin-adjacent checkpoints 已进入；剩余工作是 runtime、export、performance 和 collaboration polish。 |
| `s1-launch-readiness-and-acceptance-report-2026-05-05.md` | 活跃 handoff report | 统一的 S1X/S1B/S1C/S1D/S2/S3/S4 launch-readiness 顺序和 acceptance checklist，现在包含 public share、owner-only copy/delete、known-foreign Asset guard 和 admin bootstrap first pass。 |
| `s3-billing-team-entitlements-strategy-2026-05-06.md` | 已被取代的策略参考 | 只保留作为市场基准和历史推理；Team wallet 规则以 2026-05-08 S3 plan 为准。 |

## 当前战术焦点

1. 以 `p0-alpha-stabilization-and-acceptance-2026-05-06.md` 为准，稳定当前 P0 alpha 主线。
2. 先完成 S1C auth/admin production boundary：真实 Clerk 登录、admin_roles bootstrap、spoof tests、CORS/origin contract 和 first-session wallet 创建。
3. 让 S1D 继续只聚焦在当前 Board/share/page 发布路径的 permission hardening。
4. 在 Board/Asset guards 稳定后加入 S1E `.tgy` Board Package export/import。
5. 先完成 S2 provider-route/billing control-plane cut 和一条真实 AiRun/provider 路径，再扩大 AI 范围。
6. 让 S3 先按 Team/Group wallet plan 推进：schema delta、Team workspace wallet、个人 Collaborate wallet、invite/member hardening、payer resolver 和 billing usage。
7. 在把 S3 admin 当作可运营后台之前，先按新的 inventory/detail mock 重做 admin operator console。
8. 把前端产品 UI 对齐视为并行线路：navigation、套餐标签、角色语言和 AI 扣费文案在上线前必须匹配当前更窄的 P0 alpha 承诺。

## 归档

`Archive/` 包含已完成或已被取代的历史计划和 handoffs。不要把 archive 文件当作活跃事实来源。

`Archive/overseas-cost-growth-forecast.md` 仍可作为旧市场 / 成本研究参考，但活跃商业实现策略现在是 `s3-billing-team-entitlements-strategy-2026-05-06.md`。

## 更新规则

- 不要在这里重复 PRD/ARCH/Project_state 细节。
- 如果新的 implementation cut 需要战术 checklist，可以新增一个小的 `dev-plans/<slice>.md`。
- 当这个 cut 完成后，更新相关切片文档；如果该战术计划不再活跃，就移动到 `Archive/`。
