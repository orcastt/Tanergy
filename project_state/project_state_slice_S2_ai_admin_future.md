# Project State Slice S2: AI, Admin And Future Work

**Updated**: 2026-05-06
**Status**: Planned after S1 foundations; admin bootstrap now has a stable first-pass probe plus summary/users/workspaces/boards/audit groundwork, owner-only role mutations and a usable `/admin` management screen, while real AI calls still wait for server-side Auth/cost controls and the newly defined Group/Team workspace + actor-personal charge-ownership contract.

## AI Current State

- Mock Model Registry exists.
- Mock AiRun route exists.
- Node UI reads model contract.
- Real provider calls are not connected.
- Konva nodes now have a stronger mock runtime/dataflow path, including Prompt/Image/Chat/Image Gen/Analysis flow. Real provider calls must replace the mock adapter through server-side AiRun, not frontend node UI.
- Billing strategy is now documented: free/collaborate/team runs charge the acting user's eligible personal or seat-backed account; only explicit enterprise contracts may resolve to a workspace pool.
- Team dashboard visibility is now documented separately from AI payer identity: Team admins may see member usage summaries, but the acting member remains the payer.
- First-pass AiRun charge contract is now in code: mock AiRun responses include `workspaceKind`, `chargedScope`, `chargedAccountId`, `entitlementSource`, optional `workspaceSeatId` and a user-facing payer label.

## Admin Current State

- Admin S0 schema/access/audit boundary is documented.
- Minimal backend access probe now exists: `GET /api/v1/admin/me`.
- First-pass admin surface now renders on `/admin`, including protected counts, recent users, recent workspaces/boards, recent audit logs and selected-user role management backed by the existing admin contracts.
- Additional bounded backend routes now exist for early workspace/board inspection and audit-log reads.
- Owner-only admin role grant/revoke routes now exist and write audit logs.
- Frontend `/admin` route access is now gated from the server-side admin probe rather than local-only flags.
- Real Auth is required before admin UI work becomes meaningful.
- This is still a bounded checkpoint, not a complete Admin MVP: billing, richer search/pagination, deeper write flows and deep inspection remain pending.
- First admin owner bootstrap flow is documented in the S1B runbook and S3 Admin ARCH/PRD: verified Auth user first, then server-side `tangent_admin_roles.owner`, with `tangent_admin_audit_logs`. A first-pass CLI bootstrap script now exists in `services/api/scripts/s3_admin_bootstrap.py`.
- Billing/workspace entitlement first pass now exists: migration `20260506_0007` adds workspace kind, seat and usage/dashboard facts plus AiRun charge fields; backend read-only routes expose personal billing, current workspace dashboard and current entitlement; frontend `/billing` and `/team` consume that contract.
- Global admin runtime still needs:
  - richer bootstrap/runbook polish
  - richer user/resource search and pagination
  - broader protected `/api/v1/admin/*` reads around AI, billing, Group/Team workspaces, credit ledger and moderation
  - richer write routes beyond admin role management
  - deeper `/admin` screens beyond the current first-pass management view

## Future Order

1. Real Auth and Board ownership.
2. S1D permission hardening for `Can view / edit / manage / owner` plus Group/Team workspace separation.
3. Group/Team dashboard visibility, credit ledger, seat entitlement and subscription facts.
4. Real AI provider with AiRun/cost logs and actor-personal charged-account resolution.
5. Admin/developer user, workspace, billing, ledger and AiRun management MVP.
6. Analytics, moderation and revenue dashboards.
7. P0.5 collaboration.

Current handoff reference:

```text
dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md
```

## 中文完整翻译

# Project State 切片 S2：AI、Admin 与未来工作

**更新日期**：2026-05-06
**状态**：计划在 S1 基础之后推进；admin bootstrap 现在已经有稳定的第一阶段 probe，加上 summary/users/workspaces/boards/audit 基础、owner-only role mutations 和可用的 `/admin` 管理界面，而真实 AI 调用仍然等待服务端 Auth / cost controls，以及新定义的 Group/Team workspace + actor-personal charge-ownership 合同。

## AI 当前状态

- Mock Model Registry 已存在。
- Mock AiRun route 已存在。
- Node UI 已读取 model contract。
- 真实 provider calls 尚未接入。
- Konva nodes 现在有更强的 mock runtime/dataflow path，包括 Prompt/Image/Chat/Image Gen/Analysis flow。真实 provider calls 必须通过 server-side AiRun 替换 mock adapter，而不是从 frontend node UI 直接调用。
- Billing strategy 已文档化：free/collaborate/team runs 扣当前操作者 eligible personal 或 seat-backed account；只有明确的 enterprise contracts 可以解析到 workspace pool。
- Team dashboard visibility 已经和 AI payer identity 分开文档化：Team admins 可以看到 member usage summaries，但当前操作者仍然是 payer。
- 第一阶段 AiRun charge contract 现在已经进入代码：mock AiRun responses 包含 `workspaceKind`、`chargedScope`、`chargedAccountId`、`entitlementSource`、可选 `workspaceSeatId` 和用户可见 payer label。

## Admin 当前状态

- Admin S0 schema/access/audit boundary 已文档化。
- 最小 backend access probe 已存在：`GET /api/v1/admin/me`。
- 第一阶段 admin surface 现在在 `/admin` 渲染，包含 protected counts、recent users、recent workspaces/boards、recent audit logs，以及基于现有 admin contracts 的 selected-user role management。
- 额外 bounded backend routes 现在已存在，用于 early workspace/board inspection 和 audit-log reads。
- Owner-only admin role grant/revoke routes 已存在，并会写 audit logs。
- Frontend `/admin` route access 现在通过 server-side admin probe 门控，而不是只靠本地 flags。
- Admin UI 工作在真实 Auth 之前意义有限。
- 这仍然是一个边界收敛的 checkpoint，不是完整 Admin MVP：billing、更丰富的 search/pagination、更深入的 write flows 和 deep inspection 仍然待完成。
- 第一个 admin owner bootstrap flow 已在 S1B runbook 和 S3 Admin ARCH/PRD 中文档化：先有 verified Auth user，再通过服务端写入 `tangent_admin_roles.owner` 和 `tangent_admin_audit_logs`。第一阶段 CLI bootstrap 脚本已存在于 `services/api/scripts/s3_admin_bootstrap.py`。
- Billing/workspace entitlement 第一阶段现在已经存在：迁移 `20260506_0007` 增加 workspace kind、seat 和 usage/dashboard facts，以及 AiRun charge fields；后端只读路由暴露个人 billing、当前 workspace dashboard 和当前 entitlement；前端 `/billing` 和 `/team` 已消费该合同。
- Global admin runtime 仍然需要：
  - 更丰富的 bootstrap/runbook polish
  - 更丰富的 user/resource search 和 pagination
  - 更广的受保护 `/api/v1/admin/*` reads，覆盖 AI、billing、Group/Team workspaces、credit ledger 和 moderation
  - 超出 admin role management 的更多 write routes
  - 当前第一阶段 management view 之外更深入的 `/admin` screens

## 未来顺序

1. 真实 Auth 和 Board ownership。
2. S1D 权限硬化为 `Can view / edit / manage / owner`，并拆清 Group/Team workspace。
3. Group/Team dashboard visibility、credit ledger、seat entitlement 和 subscription facts。
4. 真实 AI provider，带 AiRun/cost logs 和 actor-personal charged-account resolution。
5. Admin/developer user、workspace、billing、ledger 和 AiRun management MVP。
6. Analytics、moderation 和 revenue dashboards。
7. P0.5 collaboration。

当前 handoff reference：

```text
dev-plans/s1-launch-readiness-and-acceptance-report-2026-05-05.md
```
