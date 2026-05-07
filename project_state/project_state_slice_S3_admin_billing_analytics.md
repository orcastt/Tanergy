# Project State Slice S3: Admin, Billing And Analytics

**Updated**: 2026-05-07
**Status**: First-pass admin and entitlement surfaces exist; the read-only plan catalog now covers Collaborate Start/Plus and Team Start/Growth, entitlement reads can use database-backed subscription/seat facts when configured, Team owner/admin can upsert/revoke first-pass Team seats, credit ledger read/preflight routes exist, internal ledger mutation/settlement helpers cover grants, top-ups, usage charges, refunds and admin adjustments, the first `/admin` AI control-plane endpoints now include versioned publish/rollback, and AiRun settlement now writes both credit and supplier-cost facts. Quote-selected route/pricing facts plus persisted runtime rows now give Admin/Finance a stable factual base for later run/cost inspection, and the frontend `/admin` surface now renders editable first-pass AI models/routes/pricing forms plus grouped attempt-level API-call timelines, finer filters, per-run drill-down and publish/rollback controls with normalized provider cost/currency. The Team page now has seat assign/revoke and member-role edits, `/billing` now has payment-backed top-up and seat-checkout/complete scaffolds, and `/usage` exposes ledger filters plus workspace-vs-personal drill-down. The current canvas-facing GeekAI fast path is useful product proof, but it still needs to be reconciled with these admin/route/pricing/settlement facts before production reliance. Current alpha boundary: accept these surfaces as bounded visibility/operator tooling, not as finished commercial infrastructure.

## Current Alpha Boundary

- release-critical: billing visibility, usage/ledger visibility, server-gated admin access
- acceptable as first pass: seat/member edits, top-up mock/manual scaffolds, bounded AI control-plane editing
- deferred: real payment-provider automation, invoices, reconciliation and deep finance/admin workflows

## Admin Current State

- Backend access probe exists: `GET /api/v1/admin/me`.
- Bounded backend routes exist for summary, users, workspaces, boards and audit logs.
- Frontend `/admin` renders a server-gated first-pass management surface.
- Owner-only admin role grant/revoke routes exist and write audit logs.
- First global admin bootstrap is documented and has a first-pass CLI helper.
- Global Admin authority remains separate from workspace owner/admin roles.
- Read-only AI control-plane routes now exist: `GET /api/v1/admin/ai/models`, `GET /api/v1/admin/ai/provider-routes` and `GET /api/v1/admin/ai/pricing-rules`.
- Read-only AI runtime inspection routes now also exist: `GET /api/v1/admin/ai/runs` and `GET /api/v1/admin/ai/api-calls`.
- Frontend `/admin` now also has a first-pass AI dashboard: read-only models, provider routes, pricing rules and runs, plus editable save panels for models/routes/pricing rules, version history with publish/rollback, grouped API-call timelines and lightweight filters/reload controls.
- `/admin` runtime reads now expose richer filter surfaces across run id, workspace id, board id, provider, route, pricing rule, preflight status and error code, and the frontend runtime panel now includes per-run drill-down instead of only a flat grouped timeline.
- These routes read the DB-backed control-plane facts and audit each access. First-pass edit/save actions plus versioned publish/rollback now exist, but multi-step approval flows are still future work.
- These admin reads now sit on top of quote-time persistence facts as well: new AiRun rows can carry `pricing_rule_id` / `route_id`, runtime settlement now persists normalized `provider_cost` / `provider_currency`, and the runtime can persist queued/running/succeeded/canceled lifecycle rows plus one `tangent_ai_api_calls` row per provider attempt. The current `/admin` runtime view now groups those attempts by run, highlights the final winning attempt and shows settled supplier-cost facts, which is the factual base the later admin finance/debug views will need.
- The local GeekAI image/chat/analysis/prompt-optimizer path has not yet fully entered this control-plane observability model. The next admin-facing requirement is to make every production node run explainable by user, workspace/team, board, node, product model, provider route, pricing rule, credits and provider cost.

## Billing / Entitlement Current State

- Migration `20260506_0007` adds workspace kind, seat assignments, usage rollups, dashboard snapshots and AiRun charge fields.
- Backend read-only routes exist for `/api/v1/billing/me`, `/api/v1/workspaces/current/dashboard` and `/api/v1/workspaces/current/entitlement`.
- Frontend `/billing` shows the signed-in user's own plan/credit/payer summary.
- Frontend `/team` renders Group structure or Team usage visibility according to workspace kind.
- Frontend `/billing` now also has first-pass top-up checkout/complete plus Team seat checkout flows, and `/usage` exposes ledger filters plus workspace-vs-personal drill-down.
- Frontend `/team` now also supports seat assign/revoke and workspace member-role editing on top of the Group/Team visibility split.
- Packaging strategy is documented for `free_canvas`, `collaborate_start`, `collaborate_plus`, `team_start`, `team_growth` and `enterprise`.
- Backend and local frontend read-only plan catalogs now cover `free_canvas`, `collaborate_start`, `collaborate_plus`, `team_start`, `team_growth` and `enterprise`.
- Dev request/session context can carry a compatible `workspace_plan_key` for local contract testing.
- When Postgres is configured, entitlement reads now prefer active `tangent_workspace_seat_assignments` for Team Workspaces and active user/workspace `tangent_subscriptions` joined through `tangent_credit_accounts` before falling back to dev context/defaults.
- AiRun payer summaries now use the active database `tangent_credit_accounts.id` when available; synthetic `credit_user_*` / `credit_workspace_*` ids remain only as local fallback.
- Team owner/admin seat mutation contracts now exist: `GET /api/v1/workspaces/current/seats`, `POST /api/v1/workspaces/current/seats` and `DELETE /api/v1/workspaces/current/seats/{userId}`. The first pass requires Team workspace owner/admin authority, an active workspace member target and a Team Start/Growth plan key.
- Credit ledger read/preflight routes now exist: `GET /api/v1/credits/ledger` and `GET /api/v1/credits/preflight?requiredCredits=n`. They resolve the current payer account, read balance/entries and return can-run/shortfall facts without mutating the ledger.
- Internal credit ledger mutation helpers now exist for `subscription_grant`, `topup_purchase`, `usage_charge`, `usage_refund` and `admin_adjustment`. First-pass payment checkout/complete flows now call them for top-ups, Team seat purchase completion now updates subscription/seat-capacity facts, and AiRun settlement now also writes `api_cost_ledger` rows. Payment webhooks and broader Admin finance writes are still pending.
- Mock AiRun can optionally use those helpers behind `TANGENT_AI_MOCK_LEDGER_CHARGING=1`, which gives the payer/preflight/usage-charge path regression coverage without enabling real providers.
- That optional mock settlement path now charges the run's originally resolved account during persisted lifecycle polling, so later GET/cancel requests do not silently switch payer context.
- Migration `20260506_0008` now creates the first DB-backed AI control-plane tables and provider-route normalization columns behind those admin reads.
- Migration `20260506_0009` now extends `tangent_ai_runs` / `tangent_ai_api_calls` with quote-selected pricing/route linkage so later admin run/cost views can explain what the runtime chose, and the current runtime shell now persists failover attempts as separate API-call facts instead of a single overwritten summary row.
- S2/S3 docs now define a developer AI control plane for model keys, parameter tiers, provider routes, pricing-rule versions and route-health/failover management; the first save-capable `/admin` surfaces now exist, and versioned publish/rollback now works for model, route and pricing resources.

## Not Production-Complete

- Real payment-provider integration.
- Subscription lifecycle and invoices.
- Payment webhook-backed `credit_ledger` grants, top-ups, charges and refunds.
- Subscription renewal/cancellation automation and seat lifecycle service.
- Rich admin/developer search, pagination and finance views.
- Deeper Admin views for cost ledger, moderation, analytics and finance-specific reconciliation.
- Finance/support/moderator role-specific write workflows.

## Next Work

1. Reconcile the GeekAI fast path with the server AI model/route/pricing registry so Admin can switch provider routes and explain every production run without frontend deploys.
2. Replace the current manual/test billing checkout scaffolds with real payment-provider webhooks, invoice/reconciliation handling and renewal/cancellation lifecycle.
3. Deepen AiRun settlement/refund handling on top of the new `credit_ledger` + `api_cost_ledger` writes, especially around failure, retry and cancel policy.
4. Expand `/admin` with billing, credit ledger, provider-cost and workspace entitlement deep views.
5. Keep every admin write audited and server-gated.

## 中文完整翻译

# Project State 切片 S3：后台管理、计费与分析

**更新日期**：2026-05-07
**状态**：第一阶段 admin 和 entitlement 界面已经存在；只读 plan catalog 现在已覆盖 Collaborate Start/Plus 和 Team Start/Growth，在配置数据库时 entitlement reads 可以使用 database-backed subscription / seat facts，Team owner/admin 已可 upsert/revoke 第一阶段 Team seats，credit ledger read/preflight routes 已存在，内部 ledger mutation / settlement helpers 已覆盖 grants、top-ups、usage charges、refunds 和 admin adjustments，第一批 `/admin` AI control-plane 接口现在也已经带上版本化 publish/rollback，而 AiRun settlement 现在已经同时写入 credit facts 和 supplier-cost facts。quote 阶段选中的 route/pricing facts 加上持久化 runtime rows，现在已经给后续 Admin / Finance run/cost inspection 打下稳定事实基础，而前端 `/admin` 现在也已经把这些 endpoints 渲染成可编辑的第一阶段 AI 面板，并支持更细 filters、按 run 分组的 attempt-level API-call 时间线、per-run drill-down、publish/rollback controls，以及归一化后的 provider cost/currency 展示。`/team` 现在支持 seat assign/revoke 和 member-role 编辑，`/billing` 现在已经有 payment-backed 的 top-up 与 seat checkout/complete scaffolds，而 `/usage` 现在可以按 ledger filters 和 workspace-vs-personal 维度查看。当前面向画布的 GeekAI fast path 是有用的产品证明，但生产依赖前仍需要和这些 admin/route/pricing/settlement facts 对齐。当前 alpha 边界是：把这些界面按有限的可见性/运营工具验收，而不是当成已完成的商业基础设施。

## 当前 Alpha 边界

- 发布关键：billing 可见性、usage/ledger 可见性，以及 server-gated admin access
- 第一阶段可接受：seat/member edits、top-up mock/manual scaffolds，以及有边界的 AI control-plane editing
- 继续延后：真实 payment-provider automation、invoices、reconciliation，以及更深 finance/admin workflows

## Admin 当前状态

- 后端访问探针已存在：`GET /api/v1/admin/me`。
- 有边界的后端 routes 已存在，用于 summary、users、workspaces、boards 和 audit logs。
- 前端 `/admin` 会渲染由服务端门控的第一阶段管理界面。
- Owner-only admin role grant / revoke routes 已存在，并会写 audit logs。
- 第一个 global admin bootstrap 已文档化，并有第一阶段 CLI helper。
- Global Admin 权限继续与 workspace owner/admin roles 分离。
- 只读 AI control-plane routes 现在已存在：`GET /api/v1/admin/ai/models`、`GET /api/v1/admin/ai/provider-routes` 和 `GET /api/v1/admin/ai/pricing-rules`。
- 只读 AI runtime inspection routes 现在也已存在：`GET /api/v1/admin/ai/runs` 和 `GET /api/v1/admin/ai/api-calls`。
- 前端 `/admin` 现在也已经有了第一阶段 AI dashboard：既能读 models、provider routes、pricing rules、runs 和按 run 分组的 API-call 时间线，也带有 models/routes/pricing rules 的第一阶段可编辑 save panels、版本历史与 publish/rollback 控件，以及轻量 filters / reload controls。
- `/admin` runtime 读取现在也已经暴露更细的过滤维度，覆盖 run id、workspace id、board id、provider、route、pricing rule、preflight status 和 error code；前端 runtime 面板也已经带上了 per-run drill-down，而不只是平铺的 grouped timeline。
- 这些 routes 会读取 DB-backed control-plane facts，并对每次读取写审计。当前已经有第一阶段 edit / save 动作以及版本化 publish / rollback，但多步审批流还未完成。
- 这些 admin 读取能力现在也已经有了 quote-time persistence facts 作为后续基础：新的 AiRun rows 已可携带 `pricing_rule_id` / `route_id`，runtime settlement 现在也会持久化归一化后的 `provider_cost` / `provider_currency`，而且 runtime 还能持久化 queued/running/succeeded/canceled lifecycle rows，并为每次 provider 尝试各写一条 `tangent_ai_api_calls` 记录。当前 `/admin` runtime 视图也已经会按 run 对这些 attempts 做分组、标出最终成功的是哪次，并显示 settled supplier-cost facts，这就是后面 admin finance / debug 视图解释运行选择所必需的事实底座。
- 本地 GeekAI image/chat/analysis/prompt-optimizer 路径还没有完整进入这套 control-plane observability 模型。下一步 admin-facing 要求是：每个生产节点运行都必须能按 user、workspace/team、board、node、product model、provider route、pricing rule、credits 和 provider cost 解释清楚。

## Billing / Entitlement 当前状态

- Migration `20260506_0007` 增加 workspace kind、seat assignments、usage rollups、dashboard snapshots 和 AiRun charge fields。
- 后端只读 routes 已存在：`/api/v1/billing/me`、`/api/v1/workspaces/current/dashboard` 和 `/api/v1/workspaces/current/entitlement`。
- 前端 `/billing` 显示当前登录用户自己的 plan / credit / payer summary。
- 前端 `/team` 根据 workspace kind 渲染 Group structure 或 Team usage visibility。
- 前端 `/billing` 现在也已经带上第一阶段 top-up checkout/complete 与 Team seat checkout，而 `/usage` 现在支持 ledger filters 与 workspace-vs-personal drill-down。
- 前端 `/team` 现在也已经支持 seat assign/revoke，以及 workspace member-role 编辑。
- 套餐策略已文档化，覆盖 `free_canvas`、`collaborate_start`、`collaborate_plus`、`team_start`、`team_growth` 和 `enterprise`。
- 后端和本地前端只读 plan catalogs 现在已覆盖 `free_canvas`、`collaborate_start`、`collaborate_plus`、`team_start`、`team_growth` 和 `enterprise`。
- Dev request/session context 可以携带兼容的 `workspace_plan_key` 用于本地合同测试。
- 当 Postgres 已配置时，entitlement reads 现在会优先读取 Team Workspaces 的 active `tangent_workspace_seat_assignments`，以及通过 `tangent_credit_accounts` join 出来的 active user/workspace `tangent_subscriptions`，然后才 fallback 到 dev context / defaults。
- AiRun payer summaries 现在会在可用时使用 active database `tangent_credit_accounts.id`；synthetic `credit_user_*` / `credit_workspace_*` id 只作为本地 fallback 保留。
- Team owner/admin seat mutation contracts 现在已存在：`GET /api/v1/workspaces/current/seats`、`POST /api/v1/workspaces/current/seats` 和 `DELETE /api/v1/workspaces/current/seats/{userId}`。第一阶段要求 Team workspace owner/admin 权限、目标用户是 active workspace member，并且 plan key 必须是 Team Start/Growth。
- Credit ledger read/preflight routes 现在已存在：`GET /api/v1/credits/ledger` 和 `GET /api/v1/credits/preflight?requiredCredits=n`。它们会解析当前 payer account，读取 balance / entries，并返回 can-run / shortfall facts，但不会 mutation ledger。
- 内部 credit ledger mutation helpers 现在已存在，覆盖 `subscription_grant`、`topup_purchase`、`usage_charge`、`usage_refund` 和 `admin_adjustment`。第一阶段 payment checkout/complete flows 现在已经会在 top-up 场景下调用它们，Team seat purchase completion 现在也会更新 subscription / seat-capacity 事实，而 AiRun settlement 现在也会写入 `api_cost_ledger`。payment webhooks 和更广的 Admin finance writes 仍待完成。
- Mock AiRun 可以在 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 后面选择性使用这些 helper，让 payer / preflight / usage-charge path 在不启用真实 providers 的情况下获得回归覆盖。
- 这个可选 mock settlement 路径现在也会在持久化 lifecycle 轮询期间持续扣到该 run 最初解析出的账户，因此后续 GET/cancel 请求不会静默切换 payer context。
- Migration `20260506_0008` 现在已经在这些 admin 读取能力背后建好了第一批 DB-backed AI control-plane tables 和 provider-route 规范化列。
- Migration `20260506_0009` 现在也已经把 quote 阶段选中的 pricing / route 关联扩展进 `tangent_ai_runs` / `tangent_ai_api_calls`，而当前 runtime shell 也会把 failover attempts 作为多条 API-call 事实持久化下来，不再只保留一条会被覆盖的摘要行，为后续 admin run / cost 视图打下了事实基础。
- S2/S3 文档现在已经定义了开发者 AI 控制平面，覆盖 model keys、parameter tiers、provider routes、pricing-rule versions 和 route-health/failover management；第一批可保存的 `/admin` 界面已经存在，而且 model、route 和 pricing 资源的版本化 publish / rollback 现在已经可用。

## 尚未生产完成

- 真实 payment-provider integration。
- Subscription lifecycle 和 invoices。
- 由 payment webhook 支撑的 `credit_ledger` grants、top-ups、charges 和 refunds。
- subscription renewal/cancellation automation 与 seat lifecycle service。
- 更丰富的 admin/developer search、pagination 和 finance views。
- cost ledger、moderation、analytics 和 finance-specific reconciliation 的更深 Admin views。
- Finance / support / moderator role-specific write workflows。

## 下一步工作

1. 把 GeekAI fast path 和服务端 AI model/route/pricing registry 对齐，让 Admin 可以不部署前端就切换 provider routes，并解释每个生产 run。
2. 把当前 manual/test billing checkout scaffolds 替换成真实 payment-provider webhooks、invoice/reconciliation 处理，以及 renewal/cancellation 生命周期。
3. 在新的 `credit_ledger` + `api_cost_ledger` 写入基础上，继续补齐 AiRun settlement/refund handling，尤其是 failure、retry 和 cancel policy。
4. 扩展 `/admin`，加入 billing、credit ledger、provider-cost 和 workspace entitlement 的深度视图。
5. 保持所有 admin write 都必须 audit 且由服务端门控。
