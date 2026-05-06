# Project State Slice S3: Admin, Billing And Analytics

**Updated**: 2026-05-06
**Status**: First-pass admin and entitlement surfaces exist; the read-only plan catalog now covers Collaborate Start/Plus and Team Start/Growth, entitlement reads can use database-backed subscription/seat facts when configured, Team owner/admin can upsert/revoke first-pass Team seats, credit ledger read/preflight routes exist, internal ledger mutation/settlement helpers cover grants, top-ups, usage charges, refunds and admin adjustments, and the first read-only `/admin` AI control-plane endpoints now exist. Quote-selected route/pricing facts plus persisted mock AiRun lifecycle rows now give Admin/Finance a stable factual base for later run/cost inspection, and the frontend `/admin` surface now renders first-pass read-only AI models/routes/pricing/runs plus grouped attempt-level API-call timelines that show which attempt finally won. Real payment billing, admin write flows for pricing/routes and finance/admin deep views remain pending.

## Admin Current State

- Backend access probe exists: `GET /api/v1/admin/me`.
- Bounded backend routes exist for summary, users, workspaces, boards and audit logs.
- Frontend `/admin` renders a server-gated first-pass management surface.
- Owner-only admin role grant/revoke routes exist and write audit logs.
- First global admin bootstrap is documented and has a first-pass CLI helper.
- Global Admin authority remains separate from workspace owner/admin roles.
- Read-only AI control-plane routes now exist: `GET /api/v1/admin/ai/models`, `GET /api/v1/admin/ai/provider-routes` and `GET /api/v1/admin/ai/pricing-rules`.
- Read-only AI runtime inspection routes now also exist: `GET /api/v1/admin/ai/runs` and `GET /api/v1/admin/ai/api-calls`.
- Frontend `/admin` now also has a first-pass read-only AI dashboard: models, provider routes, pricing rules, runs and grouped API-call timelines with lightweight filters/reload controls.
- These routes read the DB-backed control-plane facts and audit each access, but they do not yet allow edit/publish/save actions.
- These admin reads now sit on top of quote-time persistence facts as well: new AiRun rows can carry `pricing_rule_id` / `route_id`, and the mock runtime can now persist queued/running/succeeded/canceled lifecycle rows plus one `tangent_ai_api_calls` row per provider attempt. The current `/admin` runtime view now groups those attempts by run and highlights the final winning attempt, which is the factual base the later admin finance/debug views will need.

## Billing / Entitlement Current State

- Migration `20260506_0007` adds workspace kind, seat assignments, usage rollups, dashboard snapshots and AiRun charge fields.
- Backend read-only routes exist for `/api/v1/billing/me`, `/api/v1/workspaces/current/dashboard` and `/api/v1/workspaces/current/entitlement`.
- Frontend `/billing` shows the signed-in user's own plan/credit/payer summary.
- Frontend `/team` renders Group structure or Team usage visibility according to workspace kind.
- Packaging strategy is documented for `free_canvas`, `collaborate_start`, `collaborate_plus`, `team_start`, `team_growth` and `enterprise`.
- Backend and local frontend read-only plan catalogs now cover `free_canvas`, `collaborate_start`, `collaborate_plus`, `team_start`, `team_growth` and `enterprise`.
- Dev request/session context can carry a compatible `workspace_plan_key` for local contract testing.
- When Postgres is configured, entitlement reads now prefer active `tangent_workspace_seat_assignments` for Team Workspaces and active user/workspace `tangent_subscriptions` joined through `tangent_credit_accounts` before falling back to dev context/defaults.
- AiRun payer summaries now use the active database `tangent_credit_accounts.id` when available; synthetic `credit_user_*` / `credit_workspace_*` ids remain only as local fallback.
- Team owner/admin seat mutation contracts now exist: `GET /api/v1/workspaces/current/seats`, `POST /api/v1/workspaces/current/seats` and `DELETE /api/v1/workspaces/current/seats/{userId}`. The first pass requires Team workspace owner/admin authority, an active workspace member target and a Team Start/Growth plan key.
- Credit ledger read/preflight routes now exist: `GET /api/v1/credits/ledger` and `GET /api/v1/credits/preflight?requiredCredits=n`. They resolve the current payer account, read balance/entries and return can-run/shortfall facts without mutating the ledger.
- Internal credit ledger mutation helpers now exist for `subscription_grant`, `topup_purchase`, `usage_charge`, `usage_refund` and `admin_adjustment`. They are service-layer helpers only; payment webhooks, Admin finance writes and real AiRun settlement routes are still pending.
- Mock AiRun can optionally use those helpers behind `TANGENT_AI_MOCK_LEDGER_CHARGING=1`, which gives the payer/preflight/usage-charge path regression coverage without enabling real providers.
- That optional mock settlement path now charges the run's originally resolved account during persisted lifecycle polling, so later GET/cancel requests do not silently switch payer context.
- Migration `20260506_0008` now creates the first DB-backed AI control-plane tables and provider-route normalization columns behind those admin reads.
- Migration `20260506_0009` now extends `tangent_ai_runs` / `tangent_ai_api_calls` with quote-selected pricing/route linkage so later admin run/cost views can explain what the runtime chose, and the current runtime shell now persists failover attempts as separate API-call facts instead of a single overwritten summary row.
- S2/S3 docs now define a developer AI control plane for model keys, parameter tiers, provider routes, pricing-rule versions and route-health/failover management; the first read-only `/admin` surfaces now exist, but no editor/publish workflow exists yet.

## Not Production-Complete

- Payment provider integration.
- Subscription lifecycle and invoices.
- Payment-provider-backed `credit_ledger` grants, top-ups, charges and refunds.
- Payment-backed paid seat purchase, renewal and cancellation service.
- Rich admin/developer search, pagination and finance views.
- Developer-facing model/pricing/route editor and pricing-version publish flow.
- Admin views for AiRuns, provider calls, cost ledger, moderation and analytics.
- Finance/support/moderator role-specific write workflows.

## Next Work

1. Add write-capable `/admin` AI control-plane publish/save flows for model registry, parameter tiers, provider routes and pricing rules.
2. Wire real AiRun settlement to the internal credit ledger service after provider execution and refund/error handling are defined.
3. Expand `/admin` with billing, credit ledger, AiRun/provider-call and workspace entitlement reads.
4. Connect Team seat mutation UI to the server contract after Auth-backed workspace membership is stable.
5. Keep every admin write audited and server-gated.

## 中文完整翻译

# Project State 切片 S3：后台管理、计费与分析

**更新日期**：2026-05-06
**状态**：第一阶段 admin 和 entitlement 界面已经存在；只读 plan catalog 现在已覆盖 Collaborate Start/Plus 和 Team Start/Growth，在配置数据库时 entitlement reads 可以使用 database-backed subscription / seat facts，Team owner/admin 已可 upsert/revoke 第一阶段 Team seats，credit ledger read/preflight routes 已存在，内部 ledger mutation / settlement helpers 已覆盖 grants、top-ups、usage charges、refunds 和 admin adjustments，而且第一批只读 `/admin` AI control-plane 接口现在也已经落地。quote 阶段选中的 route/pricing facts 加上持久化的 mock AiRun lifecycle rows，现在已经给后续 Admin / Finance run/cost inspection 打下稳定事实基础，而前端 `/admin` 现在也已经把这些 endpoints 渲染成第一阶段只读 AI 面板，并能按 run 分组显示 attempt-level API-call 时间线以及最终成功的是哪次。真实 payment billing、AI pricing/route 的 admin 写入流，以及 finance/admin 深度视图仍待完成。

## Admin 当前状态

- 后端访问探针已存在：`GET /api/v1/admin/me`。
- 有边界的后端 routes 已存在，用于 summary、users、workspaces、boards 和 audit logs。
- 前端 `/admin` 会渲染由服务端门控的第一阶段管理界面。
- Owner-only admin role grant / revoke routes 已存在，并会写 audit logs。
- 第一个 global admin bootstrap 已文档化，并有第一阶段 CLI helper。
- Global Admin 权限继续与 workspace owner/admin roles 分离。
- 只读 AI control-plane routes 现在已存在：`GET /api/v1/admin/ai/models`、`GET /api/v1/admin/ai/provider-routes` 和 `GET /api/v1/admin/ai/pricing-rules`。
- 只读 AI runtime inspection routes 现在也已存在：`GET /api/v1/admin/ai/runs` 和 `GET /api/v1/admin/ai/api-calls`。
- 前端 `/admin` 现在也已经有了第一阶段只读 AI dashboard：models、provider routes、pricing rules、runs，以及按 run 分组的 API-call 时间线，并带轻量 filters / reload controls。
- 这些 routes 会读取 DB-backed control-plane facts，并对每次读取写审计，但还不支持 edit / publish / save 动作。
- 这些 admin 读取能力现在也已经有了 quote-time persistence facts 作为后续基础：新的 AiRun rows 已可携带 `pricing_rule_id` / `route_id`，而且 mock runtime 现在还能持久化 queued/running/succeeded/canceled lifecycle rows，并为每次 provider 尝试各写一条 `tangent_ai_api_calls` 记录。当前 `/admin` runtime 视图也已经会按 run 对这些 attempts 做分组，并标出最终成功的是哪次，这就是后面 admin finance / debug 视图解释运行选择所必需的事实底座。

## Billing / Entitlement 当前状态

- Migration `20260506_0007` 增加 workspace kind、seat assignments、usage rollups、dashboard snapshots 和 AiRun charge fields。
- 后端只读 routes 已存在：`/api/v1/billing/me`、`/api/v1/workspaces/current/dashboard` 和 `/api/v1/workspaces/current/entitlement`。
- 前端 `/billing` 显示当前登录用户自己的 plan / credit / payer summary。
- 前端 `/team` 根据 workspace kind 渲染 Group structure 或 Team usage visibility。
- 套餐策略已文档化，覆盖 `free_canvas`、`collaborate_start`、`collaborate_plus`、`team_start`、`team_growth` 和 `enterprise`。
- 后端和本地前端只读 plan catalogs 现在已覆盖 `free_canvas`、`collaborate_start`、`collaborate_plus`、`team_start`、`team_growth` 和 `enterprise`。
- Dev request/session context 可以携带兼容的 `workspace_plan_key` 用于本地合同测试。
- 当 Postgres 已配置时，entitlement reads 现在会优先读取 Team Workspaces 的 active `tangent_workspace_seat_assignments`，以及通过 `tangent_credit_accounts` join 出来的 active user/workspace `tangent_subscriptions`，然后才 fallback 到 dev context / defaults。
- AiRun payer summaries 现在会在可用时使用 active database `tangent_credit_accounts.id`；synthetic `credit_user_*` / `credit_workspace_*` id 只作为本地 fallback 保留。
- Team owner/admin seat mutation contracts 现在已存在：`GET /api/v1/workspaces/current/seats`、`POST /api/v1/workspaces/current/seats` 和 `DELETE /api/v1/workspaces/current/seats/{userId}`。第一阶段要求 Team workspace owner/admin 权限、目标用户是 active workspace member，并且 plan key 必须是 Team Start/Growth。
- Credit ledger read/preflight routes 现在已存在：`GET /api/v1/credits/ledger` 和 `GET /api/v1/credits/preflight?requiredCredits=n`。它们会解析当前 payer account，读取 balance / entries，并返回 can-run / shortfall facts，但不会 mutation ledger。
- 内部 credit ledger mutation helpers 现在已存在，覆盖 `subscription_grant`、`topup_purchase`、`usage_charge`、`usage_refund` 和 `admin_adjustment`。它们只是 service-layer helpers；payment webhooks、Admin finance writes 和真实 AiRun settlement routes 仍待完成。
- Mock AiRun 可以在 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 后面选择性使用这些 helper，让 payer / preflight / usage-charge path 在不启用真实 providers 的情况下获得回归覆盖。
- 这个可选 mock settlement 路径现在也会在持久化 lifecycle 轮询期间持续扣到该 run 最初解析出的账户，因此后续 GET/cancel 请求不会静默切换 payer context。
- Migration `20260506_0008` 现在已经在这些 admin 读取能力背后建好了第一批 DB-backed AI control-plane tables 和 provider-route 规范化列。
- Migration `20260506_0009` 现在也已经把 quote 阶段选中的 pricing / route 关联扩展进 `tangent_ai_runs` / `tangent_ai_api_calls`，而当前 runtime shell 也会把 failover attempts 作为多条 API-call 事实持久化下来，不再只保留一条会被覆盖的摘要行，为后续 admin run / cost 视图打下了事实基础。
- S2/S3 文档现在已经定义了开发者 AI 控制平面，覆盖 model keys、parameter tiers、provider routes、pricing-rule versions 和 route-health/failover management；第一批只读 `/admin` 界面已经存在，但 editor / publish workflow 还没有实现。

## 尚未生产完成

- Payment provider integration。
- Subscription lifecycle 和 invoices。
- 由 payment-provider 支撑的 `credit_ledger` grants、top-ups、charges 和 refunds。
- 由 payment 支撑的付费 seat purchase、renewal 和 cancellation service。
- 更丰富的 admin/developer search、pagination 和 finance views。
- 面向开发者的 model/pricing/route editor 和 pricing-version publish flow。
- AiRuns、provider calls、cost ledger、moderation 和 analytics 的 Admin views。
- Finance / support / moderator role-specific write workflows。

## 下一步工作

1. 增加可写的 `/admin` AI control-plane publish / save flows，用于 model registry、parameter tiers、provider routes 和 pricing rules。
2. 在 provider execution 和 refund/error handling 定义清楚后，把真实 AiRun settlement 接到内部 credit ledger service。
3. 扩展 `/admin`，加入 billing、credit ledger、AiRun/provider-call 和 workspace entitlement reads。
4. 在 Auth-backed workspace membership 稳定后，把 Team seat mutation UI 接到服务端合同。
5. 保持所有 admin write 都必须 audit 且由服务端门控。
