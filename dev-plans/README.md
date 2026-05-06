# Dev Plans Index

**Updated**: 2026-05-06

Detailed product, architecture and state truth now lives in:

- `../PRD/PRD.md`
- `../ARCH/ARCH.md`
- `../project_state/project_state.md`

`dev-plans/` is only for tactical implementation plans, external research notes and historical archive.

## Active Tactical Plans

| File | Status | Notes |
| --- | --- | --- |
| `s1b-staging-deployment-runbook-2026-05-02.md` | Active S1B runbook | Chinese beginner guide for domain, DNS, Vercel, Hetzner, Neon, R2, Clerk, Google OAuth and email setup. |
| `s1x-canvas-engine-migration-reference-2026-05-03.md` | Active S1X migration reference | Konva-first route/public share/admin-adjacent checkpoints are in; remaining work is runtime, export, performance and collaboration polish. |
| `s1-launch-readiness-and-acceptance-report-2026-05-05.md` | Active handoff report | Unified S1X/S1B/S1C/S1D/S2/S3/S4 launch-readiness order and acceptance checklist, now including public share, owner-only copy/delete, known-foreign Asset guard and admin bootstrap first pass. |
| `s3-billing-team-entitlements-strategy-2026-05-06.md` | Active S3 strategy plan | Market-informed pricing, Group/Team workspace visibility, actor-personal credit ownership, team seat and implementation sequence for free/collaborate/team/enterprise. |
| `s1-s3-document-consolidation-report-2026-05-06.md` | Active consolidation report | Current doc/code truth, archived files, known conflicts and next implementation slices after the May 6 consolidation pass. |

## Current Tactical Focus

1. S1B/S1C deploy and Auth rollout against staging resources.
2. S1D permission hardening on top of the current `Can view / Can edit / Can manage / Owner` resolver and known-foreign Asset guard, with active membership/invite state, explicit Asset-sharing allowlists and Group/Team workspace role separation.
3. S3 Group/Team dashboard visibility, seat entitlement and actor-personal credit-account implementation from the new strategy plan.
4. S2 real AiRun provider adapter after the local mock/runtime graph checkpoint and after charge ownership is settled.
5. S3 richer admin/developer console search, pagination, credit ledger and AiRun/provider-call views on top of the current first-pass `/admin`.

## Archive

`Archive/` contains completed or superseded historical plans and handoffs. Do not use archive files as active truth.

`Archive/overseas-cost-growth-forecast.md` remains useful as old market/cost research, but the active commercial implementation strategy is now `s3-billing-team-entitlements-strategy-2026-05-06.md`.

## Update Rules

- Do not duplicate PRD/ARCH/Project_state details here.
- A new implementation cut can get a small `dev-plans/<slice>.md` if it needs a tactical checklist.
- When that cut completes, update the relevant slice docs and move the tactical plan to `Archive/` if it is no longer active.

## 中文完整翻译

# Dev Plans 索引

**更新日期**：2026-05-06

详细的产品、架构和状态事实现在位于：

- `../PRD/PRD.md`
- `../ARCH/ARCH.md`
- `../project_state/project_state.md`

`dev-plans/` 只用于战术实施计划、外部研究 notes 和历史归档。

## 活跃战术计划

| 文件 | 状态 | 说明 |
| --- | --- | --- |
| `s1b-staging-deployment-runbook-2026-05-02.md` | 活跃 S1B runbook | 面向新手的中文指南，覆盖 domain、DNS、Vercel、Hetzner、Neon、R2、Clerk、Google OAuth 和 email setup。 |
| `s1x-canvas-engine-migration-reference-2026-05-03.md` | 活跃 S1X migration reference | Konva-first route / public share / admin-adjacent checkpoints 已进入；剩余工作是 runtime、export、performance 和 collaboration polish。 |
| `s1-launch-readiness-and-acceptance-report-2026-05-05.md` | 活跃 handoff report | 统一的 S1X/S1B/S1C/S1D/S2/S3/S4 launch-readiness 顺序和 acceptance checklist，现在包含 public share、owner-only copy/delete、known-foreign Asset guard 和 admin bootstrap first pass。 |
| `s3-billing-team-entitlements-strategy-2026-05-06.md` | 活跃 S3 strategy plan | 市场参考定价、Group/Team workspace 可见性、actor-personal credit ownership、team seat 和 free/collaborate/team/enterprise 实施顺序。 |
| `s1-s3-document-consolidation-report-2026-05-06.md` | 活跃 consolidation report | 2026-05-06 收拢后的当前文档 / 代码事实、已归档文件、已知冲突和下一批实现切片。 |

## 当前战术焦点

1. 基于 staging resources 推进 S1B/S1C deploy 和 Auth rollout。
2. 在当前 `Can view / Can edit / Can manage / Owner` resolver 和 known-foreign Asset guard 之上继续硬化 S1D 权限，并接入 active membership / invite state、明确的 Asset-sharing allowlists 和 Group/Team workspace role 边界。
3. 按新 strategy plan 实现 S3 Group/Team dashboard visibility、seat entitlement 和 actor-personal credit-account。
4. 在本地 mock/runtime graph checkpoint 之后，并且 charge ownership 稳定后，推进 S2 真实 AiRun provider adapter。
5. 在当前第一阶段 `/admin` 之上扩展 S3 richer admin/developer console search、pagination、credit ledger 和 AiRun/provider-call views。

## 归档

`Archive/` 包含已完成或已被取代的历史计划和 handoffs。不要把 archive 文件当作活跃事实来源。

`Archive/overseas-cost-growth-forecast.md` 仍可作为旧市场 / 成本研究参考，但活跃商业实现策略现在是 `s3-billing-team-entitlements-strategy-2026-05-06.md`。

## 更新规则

- 不要在这里重复 PRD/ARCH/Project_state 细节。
- 如果新的 implementation cut 需要战术 checklist，可以新增一个小的 `dev-plans/<slice>.md`。
- 当这个 cut 完成后，更新相关切片文档；如果该战术计划不再活跃，就移动到 `Archive/`。
