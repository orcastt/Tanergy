# ARCH Slice S3: Admin, Billing And Analytics

**Updated**: 2026-05-06
**Mode**: Architecture slice.

## Scope

Data-model and access boundary for future management panel, billing, credits, seat entitlements and analytics.

## P0 Alpha Boundary

In the current release pass, this slice stays bounded:

- billing is visible and explainable, but not fully automated
- admin is server-gated and auditable, but not a deep business console yet
- finance reconciliation, invoices, payment webhooks and enterprise operations remain deferred

## Fact Sources

```text
admin_roles
admin_audit_logs
admin_user_notes

credit_accounts
credit_ledger
workspace_seat_assignments
subscriptions
payments
invoices

model_registry
model_parameter_tiers
model_provider_routes
model_pricing_rules
model_pricing_rule_audit_logs
provider_route_health_events
ai_runs
ai_api_calls
api_cost_ledger

analytics_events
workspace_usage_rollups
workspace_dashboard_snapshots
analytics_funnel_snapshots
analytics_cohort_snapshots

moderation_items
moderation_actions
```

## Permission Rules

- `/admin` is production-disabled until real Auth exists.
- Admin access is checked server-side through `admin_roles`.
- Every admin write writes `admin_audit_logs`.
- Support, analyst, finance and moderator roles must be separable.
- Product entitlements such as `free/collaborate_start/collaborate_plus/team/enterprise` are not Auth roles and must not be inferred from `workspace_role`.
- Workspace kind such as `group_workspace` vs `team_workspace` is a separate product fact and must not be inferred only from a Board role.

## Entitlement Model

Workspace kinds:

```text
solo_workspace
group_workspace
team_workspace
enterprise_workspace
```

Plan keys:

```text
free_canvas
collaborate_start
collaborate_plus
team_start
team_growth
enterprise
```

Charge scopes:

```text
actor_personal
workspace_pool
```

Account ownership:

```text
credit_accounts.owner_type = user | workspace
subscriptions.account_id -> credit_accounts.id
workspace_seat_assignments.workspace_id + user_id -> included-credit allowance and team visibility facts
```

Rules:

- Free, both Collaborate tiers and both Team tiers default to `actor_personal`.
- Enterprise may resolve to `actor_personal` or `workspace_pool` depending on contract.
- Every AiRun must resolve a single charge scope and account id before calling a provider.
- Team seat-backed runs still charge the acting member even though Team admins may later see member usage summaries.
- Per-member usage attribution is always recorded, including when a later enterprise contract uses a workspace pool.
- Collaborate invited free editors may have Board edit permission without having an active paid plan; when they run AI, the server must still resolve a personal credit source or reject before provider execution.
- Group workspace billing visibility stays private to each member; Team workspace admins may see member usage/expiry summaries without becoming the payer.
- External share recipients may not trigger any workspace_pool / enterprise pooled AI spend in the initial model.

## Billing + AI Charge Contract

```text
Node UI Run click
  -> request context resolves actor user + workspace + workspace kind + board
  -> permission resolver confirms actor may run AI on this board
  -> entitlement resolver chooses plan + workspace kind + charge scope + entitlement source
  -> credit account resolver chooses personal or workspace account
  -> preflight checks membership, seat assignment, balance, board permission and model allowance
  -> server creates ai_run with charged_account_id + charged_scope + actor_user_id + entitlement_source
  -> provider call executes
  -> ledger writes usage/refund facts
  -> UI receives AiRun summary + who-paid summary + visibility summary
```

Required persisted facts per run:

```text
ai_runs
  actor_user_id
  workspace_id
  board_id
  workspace_kind
  workspace_seat_id
  charged_account_id
  charged_scope
  entitlement_source
  credits_charged
  credits_refunded
  provider_cost
  provider_currency
```

Required ledger event types:

```text
subscription_grant
topup_purchase
usage_charge
usage_refund
admin_adjustment
seat_change_adjustment
plan_change_adjustment
```

## Developer AI Control Plane

The unified developer/admin backend must manage AI pricing and supplier routing separately from user-facing subscription packages.
Runtime observation must expose both commercial credits and normalized supplier cost/currency so operators can tune margins without reading raw provider payloads.

Core admin-managed tables:

```text
model_registry
model_parameter_tiers
model_provider_routes
model_pricing_rules
model_pricing_rule_audit_logs
provider_route_health_events
```

Operator roles:

- `owner` and `admin` may view and edit model/routing/pricing configuration.
- `finance` may view provider cost, credit pricing, revenue impact and pricing history.
- A later `ai_operator` or `developer_operator` role may manage model availability and route priority without gaining billing or user-management authority.

Developer console surfaces:

- Models: enable/disable product model keys, display names, capabilities and default parameter tiers.
- Parameter tiers: define product-facing choices such as `0.5K`, `1K`, `2K`, `4K`, quality, output count and provider-native parameter mappings.
- Provider routes: configure provider key, provider model, route priority, weight, timeout, retry policy, health status and disabled/enabled state.
- Pricing rules: publish versioned credit estimates, minimum credits, markup/multiplier rules and provider-cost formulas per model/tier.
- Cost observability: inspect provider cost, provider currency, credits charged/refunded, margin estimate, route id, pricing rule id, latency and error facts per AiRun.
- Audit: every edit to model availability, provider route priority, provider mapping or pricing rule writes an admin audit record and keeps previous versions queryable.

Admin save flow:

```text
Developer console edit
  -> server checks admin_roles and specific AI/pricing permission
  -> validate model key, tier key, route support and pricing formula
  -> create a draft config version
  -> optional dry-run estimates for common prompt/image/count cases
  -> publish new version with effective_from
  -> write admin_audit_logs + model_pricing_rule_audit_logs
  -> new AiRuns read the new version; old AiRuns keep old pricing_rule_id
```

Failover rules:

- Route failover is a server concern, never a frontend route selector.
- A route can be manually disabled from the developer console or automatically marked unhealthy by repeated errors.
- Fallback routes must support the requested model capability and parameter tier before being selected.
- If all healthy routes fail before work begins, the AiRun fails without charging credits.
- If a provider begins work and returns a chargeable response/error, settlement follows the stored route/pricing policy and must be visible in Admin cost views.

## Board Role + Workspace Boundary

- A user may belong to multiple Group or Team workspaces; every membership, Board role and seat assignment is scoped to one workspace.
- `Can edit` and `Can manage` require active workspace membership or an equivalent server-backed invited-member record; Board edit permission is not itself proof of AI entitlement.
- `Can manage` maps to the current technical `board admin` capability set: invite/share/rename/visibility/member management.
- `Owner` alone may delete/copy Board content in the initial product direction.
- `viewer` share links remain read-only.
- Group Workspaces and Team Workspaces share the same core Board/member surface.
- Group Workspace creators/admins may manage workspace admins/editors and Board admins/editors, but cannot inspect other members' billing usage or expiry state.
- Collaborate Start and Collaborate Plus may include unpaid invited editors who can edit/save the Board without a paid seat.
- Those unpaid Collaborate editors receive no included monthly AI credits; any AI run must charge their own personal subscription/top-up balance or fail before provider execution.
- Team Workspace owners/admins use the same member/Board controls, but additionally see a Team dashboard with per-member AI usage, total usage, expiry status, Board count and Board/member inventory.
- Team Workspace dashboard visibility is separate from Board admin rights; a Board admin does not automatically inherit Team billing visibility.
- Team seat assignment and workspace membership must be checked together before the member can consume their Team-seat-backed allowance.

## Planned Routes

Admin:

```text
GET /api/v1/admin/me
GET /api/v1/admin/summary
GET /api/v1/admin/users
GET /api/v1/admin/workspaces
GET /api/v1/admin/boards
GET /api/v1/admin/audit-logs
GET /api/v1/admin/ai/models
PATCH /api/v1/admin/ai/models/{modelKey}
GET /api/v1/admin/ai/versions
POST /api/v1/admin/ai/models/{modelKey}/publish
POST /api/v1/admin/ai/models/{modelKey}/rollback/{versionId}
GET /api/v1/admin/ai/runs
GET /api/v1/admin/ai/api-calls
GET /api/v1/admin/ai/provider-routes
PATCH /api/v1/admin/ai/provider-routes/{routeId}
POST /api/v1/admin/ai/provider-routes/{routeId}/publish
POST /api/v1/admin/ai/provider-routes/{routeId}/rollback/{versionId}
GET /api/v1/admin/ai/pricing-rules
PATCH /api/v1/admin/ai/pricing-rules/{ruleId}
POST /api/v1/admin/ai/pricing-rules/{ruleId}/publish
POST /api/v1/admin/ai/pricing-rules/{ruleId}/rollback/{versionId}
```

Billing/entitlements:

```text
GET  /api/v1/billing/me
GET  /api/v1/billing/payments
POST /api/v1/billing/topups/checkout
POST /api/v1/billing/payments/{paymentId}/complete
POST /api/v1/billing/workspaces/current/seats/checkout
GET  /api/v1/workspaces/current/dashboard
GET  /api/v1/workspaces/current/entitlement
GET  /api/v1/workspaces/current/seats
POST /api/v1/workspaces/current/seats
DELETE /api/v1/workspaces/current/seats/{userId}
PATCH /api/v1/workspaces/current/members/{userId}
GET  /api/v1/credits/ledger
GET  /api/v1/credits/preflight?requiredCredits=
GET  /api/v1/workspaces/{workspaceId}/billing
GET  /api/v1/workspaces/{workspaceId}/dashboard
GET  /api/v1/workspaces/{workspaceId}/usage
GET  /api/v1/workspaces/{workspaceId}/seats
POST /api/v1/workspaces/{workspaceId}/seats
POST /api/v1/credits/topups
GET  /api/v1/credits/ledger
GET  /api/v1/boards/{boardId}/permissions/effective
```

The exact route split may still change, but the core contract should remain:

- effective board permission
- active plan/seat entitlement
- workspace kind + billing visibility boundary
- resolved credit payer
- active model pricing rule + provider route
- auditable ledger facts

## Current State

- Boundary is documented.
- Minimal backend access probe exists: `GET /api/v1/admin/me` loads active `admin_roles` for the authenticated local user id.
- Read-only routes now exist for `GET /api/v1/admin/summary`, `GET /api/v1/admin/users?limit=n`, `GET /api/v1/admin/workspaces?limit=n` and `GET /api/v1/admin/boards?limit=n`, all behind the same server-side admin check and audit logging.
- `GET /api/v1/admin/audit-logs` now exists with bounded filters for `limit`, `action`, `actorUserId` and `targetUserId`.
- AI inspection plus first-pass mutation routes now also exist: `GET /api/v1/admin/ai/models`, `PATCH /api/v1/admin/ai/models/{modelKey}`, `GET /api/v1/admin/ai/versions`, publish/rollback routes for models/provider-routes/pricing-rules, `GET /api/v1/admin/ai/provider-routes`, `PATCH /api/v1/admin/ai/provider-routes/{routeId}`, `GET /api/v1/admin/ai/pricing-rules`, `PATCH /api/v1/admin/ai/pricing-rules/{ruleId}`, `GET /api/v1/admin/ai/runs` and `GET /api/v1/admin/ai/api-calls`.
- Frontend `/admin` now also renders a first-pass AI dashboard on top of those routes: models, provider routes, pricing rules, runs, grouped API-call attempt timelines, version history/publish/rollback controls and editable save panels for model/route/pricing updates.
- Frontend `/admin` now renders a real first-pass management surface behind server-checked access: summary, users, workspaces, boards, recent audit logs, selected-user role inspection and owner-only role grant/revoke controls.
- Frontend `/admin` access gating now uses the server-side admin probe to render or redirect; browser role flags remain non-authoritative.
- Billing/package strategy is now defined at the doc level, including Group-vs-Team workspace visibility boundaries and actor-personal charging for Team.
- First-pass entitlement implementation now exists: `workspace_kind` and a dev-only compatible `workspace_plan_key` enter request/session context, migration `20260506_0007` adds workspace kind, seat-assignment, usage-rollup, dashboard-snapshot and AiRun charge fields, and the backend exposes `/api/v1/billing/me`, `/api/v1/billing/payments`, payment checkout/complete routes, `/api/v1/workspaces/current/dashboard`, `/api/v1/workspaces/current/entitlement`, `POST /api/v1/credits/topups`, `GET /api/v1/credits/ledger` and `PATCH /api/v1/workspaces/current/members/{userId}` for the current first pass.
- Backend and local frontend read-only plan catalogs now cover `free_canvas`, `collaborate_start`, `collaborate_plus`, `team_start`, `team_growth` and `enterprise`.
- When Postgres is configured, the entitlement resolver now checks active Team seat assignments first, then active user/workspace subscriptions via `tangent_credit_accounts` + `tangent_subscriptions`, before falling back to dev context/default plan keys.
- The same resolver uses active `tangent_credit_accounts.id` as the charged account id when available; synthetic ids remain fallback only.
- First-pass Team seat mutation contracts now exist behind Team workspace owner/admin checks: list current seats, upsert a Team Start/Growth seat for an active workspace member and revoke a member seat. The upsert path also ensures an active user credit account exists for the assigned member.
- First-pass credit ledger read/preflight contracts now exist: `/api/v1/credits/ledger` returns current payer account balance plus recent ledger entries, and `/api/v1/credits/preflight?requiredCredits=n` returns can-run/shortfall facts without writing a usage charge.
- Frontend `/billing` now includes a first-pass top-up action, `/usage` exposes ledger filters plus workspace-vs-personal drill-down, and `/team` now supports seat assign/revoke plus workspace member-role editing on top of the Group/Team visibility split.
- Internal credit ledger mutation helpers now exist for subscription grants, top-up purchases, usage charges with insufficient-balance rejection, usage refunds and admin adjustments. These helpers write auditable `tangent_credit_ledger` rows; first-pass billing checkout/complete now uses them for top-ups, Team seat checkout/complete updates subscription capacity, and AiRun settlement now also writes attempt-level `api_cost_ledger` rows.
- Mock AiRun can optionally call those helpers when `TANGENT_AI_MOCK_LEDGER_CHARGING=1`, giving the charge resolver, preflight and ledger path a tested backend exercise while real providers remain disabled.
- That same mock AiRun path now also gives Admin a persisted runtime fact surface: quote-selected pricing/route ids plus queued/running/succeeded/canceled lifecycle rows, and `ai_api_calls` now persist one row per provider attempt so failover history stays visible. The current `/admin` runtime surface groups those attempts by `run_id` and marks the final winning attempt for inspection.
- The developer AI control-plane contract is now documented and has a first-pass save surface: current `/admin` work can already mutate bounded model, route and pricing facts, and versioned publish/rollback now exists for those resources, while future work still needs parameter-tier editing and richer route-health governance.
- Frontend `/billing` now renders the signed-in user's own plan/credit/payer summary, and `/team` renders a Group structural dashboard or Team member-usage dashboard according to the server/local workspace kind contract.
- This is still not real external billing: no real payment provider, payment webhook integration, invoice/reconciliation flow, broader Admin finance write surface, analytics event stream, moderation queue or impersonation flow exists yet.

## First Admin MVP Boundary

```text
Auth session
  -> server checks admin_roles
  -> bounded user/workspace/board/asset/AiRun/API-call views plus audited admin write actions
  -> any write action must create admin_audit_logs first
```

Do not expose `/admin` in production until real Auth and server-side `admin_roles` are active.

Current bootstrap-first implementation direction:

- Keep `/api/v1/admin/me` read-only and narrow.
- Use it to decide whether `/admin` should render or redirect in the current first pass.
- Allow bounded summary/users/workspaces/boards/audit-log routes behind the same server-side `admin_roles` check.
- Keep owner-only role grant/revoke as the first admin mutation slice, with audit logging in the same server-controlled path.
- First-pass AI control-plane save routes now exist; they must stay server-gated and audit each mutation, and later publish/rollback flows must preserve version history.
- Richer search, pagination, billing controls, seat controls and moderation tooling still wait for later slices.

## Admin Bootstrap Contract

The first global admin must be granted server-side after real Auth maps a verified provider identity into `tangent_users`.

```text
Clerk verified user
  -> S1C auth/session mapping
  -> tangent_users row
  -> one-time server/DB bootstrap grants tangent_admin_roles.owner
  -> bootstrap writes tangent_admin_audit_logs
```

Rules:

- Workspace `owner/admin` is not global Admin.
- Frontend flags, environment variables and browser-provided role fields are never Admin authority.
- `tangent_admin_roles` is the only global Admin authority.
- Read-only `/admin` pages may exist before admin mutation flows, but they must still be server-gated by `tangent_admin_roles`.
- Every Admin write route must insert `tangent_admin_audit_logs` in the same server-controlled operation.
- The first bootstrap may be manual SQL or a one-time CLI, but it must target an existing verified local user id and create an audit record.
- A first-pass bootstrap CLI now exists for this purpose; later role grants/revokes run through owner-only server routes that also write audit logs.

Role meaning:

```text
owner      Full global administration; bootstrap and dangerous settings.
admin      General user/content/system admin after owner exists.
support    User and workspace support views with narrow write actions.
analyst    Read-only analytics, AI run and cost views.
finance    Billing, subscription and credit-ledger operations.
moderator  Moderation queues, content actions and abuse workflows.
```

## 中文完整翻译

# ARCH 切片 S3：后台管理、计费与分析

**更新日期**：2026-05-06
**模式**：架构切片。

## 范围

本切片负责未来管理后台、计费、积分、席位权限和分析系统所需的数据模型与访问边界。

## P0 Alpha 边界

在当前这一轮发布里，这个切片保持有限边界：

- billing 需要可见、可解释，但不是完整自动化系统
- admin 需要 server-gated 且可审计，但还不是深层业务控制台
- finance reconciliation、invoices、payment webhooks 和 enterprise operations 继续延后

## 事实数据源

```text
admin_roles
admin_audit_logs
admin_user_notes

credit_accounts
credit_ledger
workspace_seat_assignments
subscriptions
payments
invoices

model_registry
model_parameter_tiers
model_provider_routes
model_pricing_rules
model_pricing_rule_audit_logs
provider_route_health_events
ai_runs
ai_api_calls
api_cost_ledger

analytics_events
workspace_usage_rollups
workspace_dashboard_snapshots
analytics_funnel_snapshots
analytics_cohort_snapshots

moderation_items
moderation_actions
```

## 权限规则

- 在真实 Auth 生效前，生产环境中的 `/admin` 必须保持禁用。
- Admin 访问必须通过服务端 `admin_roles` 检查。
- 所有 Admin 写操作都必须写入 `admin_audit_logs`。
- `support`、`analyst`、`finance` 和 `moderator` 必须是可以拆分的角色。
- `free/collaborate_start/collaborate_plus/team/enterprise` 这类产品套餐不是 Auth 角色，不能从 `workspace_role` 推断。
- `group_workspace` 和 `team_workspace` 这类 workspace 形态也是独立的产品事实，不能只根据 Board 角色去反推。

## Entitlement 模型

Workspace 形态：

```text
solo_workspace
group_workspace
team_workspace
enterprise_workspace
```

套餐键值：

```text
free_canvas
collaborate_start
collaborate_plus
team_start
team_growth
enterprise
```

扣费范围：

```text
actor_personal
workspace_pool
```

账户归属：

```text
credit_accounts.owner_type = user | workspace
subscriptions.account_id -> credit_accounts.id
workspace_seat_assignments.workspace_id + user_id -> 赠送 credits 额度和 Team 可见性事实
```

规则：

- Free、两个 Collaborate 档位和两个 Team 档位默认都扣 `actor_personal`。
- Enterprise 可以根据合同解析为 `actor_personal` 或 `workspace_pool`。
- 每个 AiRun 在调用 provider 前，都必须先解析出唯一的 charge scope 和 account id。
- 即使 Team 管理员之后能看到成员 usage 汇总，Team 的 seat-backed 运行也仍然扣当前操作者自己。
- 即使未来 enterprise 合同使用 workspace 池，也必须把使用归因记录到成员级别。
- Collaborate 中被邀请的免费编辑者可以拥有 Board 编辑权限，但如果他们运行 AI，服务端仍必须先解析出个人积分来源，否则要在 provider 调用前直接拒绝。
- Group workspace 的 billing 可见性保持在成员自己；Team workspace 的 admins 可以看到成员 usage / 到期状态汇总，但不会因此自动成为付款方。
- 在初始模型里，外部分享对象不能触发任何 workspace_pool / enterprise pooled AI 花费。

## 计费 + AI 扣费合同

```text
Node UI 点击 Run
  -> request context 解析出操作者 user + workspace + workspace kind + board
  -> permission resolver 确认这个操作者可以在当前 board 上运行 AI
  -> entitlement resolver 决定 plan + workspace kind + charge scope + entitlement source
  -> credit account resolver 决定扣个人账户还是 workspace 账户
  -> preflight 检查成员身份、seat assignment、余额、board 权限和模型可用性
  -> server 创建 ai_run，并写 charged_account_id + charged_scope + actor_user_id + entitlement_source
  -> 执行 provider 调用
  -> ledger 写 usage / refund 事实
  -> UI 收到 AiRun summary、who-paid summary 和 visibility summary
```

每次运行必须持久化的事实字段：

```text
ai_runs
  actor_user_id
  workspace_id
  board_id
  workspace_kind
  workspace_seat_id
  charged_account_id
  charged_scope
  entitlement_source
  credits_charged
  credits_refunded
  provider_cost
  provider_currency
```

必须支持的 ledger 事件类型：

```text
subscription_grant
topup_purchase
usage_charge
usage_refund
admin_adjustment
seat_change_adjustment
plan_change_adjustment
```

## 开发者 AI 控制平面

统一的 developer/admin 后台必须把 AI 定价和供应商线路管理，从用户可见的订阅套餐里独立出来管理。

核心后台管理表：

```text
model_registry
model_parameter_tiers
model_provider_routes
model_pricing_rules
model_pricing_rule_audit_logs
provider_route_health_events
```

操作角色：

- `owner` 和 `admin` 可以查看和编辑 model / routing / pricing 配置。
- `finance` 可以查看 provider cost、credit pricing、收入影响和 pricing history。
- 后续可以增加 `ai_operator` 或 `developer_operator` 角色，让其只管理模型可用性和 route priority，而不自动获得 billing 或 user-management 权限。

开发者后台界面：

- Models：启用 / 禁用产品模型 key、display name、capabilities 和默认参数档位。
- Parameter tiers：定义 `0.5K`、`1K`、`2K`、`4K`、quality、output count 这样的产品档位，以及它们到 provider-native parameters 的映射。
- Provider routes：配置 provider key、provider model、route priority、weight、timeout、retry policy、health status 和 enabled/disabled 状态。
- Pricing rules：按 model/tier 发布版本化的 credit estimates、minimum credits、markup/multiplier rules 和 provider-cost formulas。
- Cost observability：按 AiRun 查看 provider cost、provider currency、charged/refunded credits、margin estimate、route id、pricing rule id、latency 和 error facts。
- Audit：每次修改 model availability、provider route priority、provider mapping 或 pricing rule，都必须写 admin audit record，并保留可查询的旧版本。

后台保存流程：

```text
Developer console edit
  -> server 检查 admin_roles 和具体的 AI/pricing permission
  -> 校验 model key、tier key、route support 和 pricing formula
  -> 创建 draft 配置版本
  -> 可选地对常见 prompt/image/count 场景做 dry-run estimates
  -> 带 effective_from 发布新版本
  -> 写入 admin_audit_logs + model_pricing_rule_audit_logs
  -> 新 AiRuns 读取新版本；旧 AiRuns 保留旧 pricing_rule_id
```

Failover 规则：

- Route failover 是服务端问题，绝不能变成前端 route selector。
- 一条 route 可以在开发者后台被手动禁用，也可以因重复错误被自动标记为 unhealthy。
- 在被选中之前，fallback routes 必须支持当前请求的模型能力和参数档位。
- 如果所有健康 routes 都在真正开始工作前失败，AiRun 必须失败且不能扣 credits。
- 如果 provider 已开始工作并返回可计费 response/error，就必须按已记录的 route/pricing policy 结算，并在 Admin cost views 中可见。

## Board 角色 + Workspace 边界

- 一个用户可以同时属于多个 Group 或 Team workspace；所有成员关系、Board 角色和 seat assignment 都只在各自的 workspace 内生效。
- `Can edit` 和 `Can manage` 必须要求用户是活跃的 workspace 成员，或有等价的服务端 invited-member 记录；但 Board 编辑权限本身并不等于 AI 使用资格。
- `Can manage` 对应当前技术层面的 `board admin` 能力集合：邀请、分享、重命名、可见性和成员管理。
- 在初始产品方向里，只有 `Owner` 可以删除或复制 Board 内容。
- `viewer` 分享链接保持只读。
- Group Workspace 和 Team Workspace 共享同一套核心 Board / 成员界面。
- Group Workspace 的创建者 / 管理员可以管理 workspace admins/editors 和 Board admins/editors，但不能查看其他成员的 billing usage 或到期状态。
- Collaborate Start 和 Collaborate Plus 可以包含未付费的被邀请编辑者，他们无需付费席位也能编辑 / 保存 Board。
- 这些未付费的 Collaborate 编辑者没有月度赠送 AI 积分；任何 AI 运行都必须从他们自己的个人订阅 / 充值余额扣费，否则在 provider 调用前失败。
- Team Workspace 的 owners/admins 使用同样的成员 / Board 管理能力，但额外会看到一个 Team dashboard，展示成员级 AI usage、总 usage、到期状态、Board 数量和 Board/成员清单。
- Team Workspace 的 dashboard 可见性与 Board admin 权限是分开的；一个 Board admin 不会自动继承 Team billing 可见性。
- 在允许成员消耗 Team seat 额度之前，必须同时检查 Team seat assignment 和 workspace 成员身份。

## 计划中的路由

Admin：

```text
GET /api/v1/admin/me
GET /api/v1/admin/summary
GET /api/v1/admin/users
GET /api/v1/admin/workspaces
GET /api/v1/admin/boards
GET /api/v1/admin/audit-logs
GET /api/v1/admin/ai/models
PATCH /api/v1/admin/ai/models/{modelKey}
GET /api/v1/admin/ai/versions
POST /api/v1/admin/ai/models/{modelKey}/publish
POST /api/v1/admin/ai/models/{modelKey}/rollback/{versionId}
GET /api/v1/admin/ai/runs
GET /api/v1/admin/ai/api-calls
GET /api/v1/admin/ai/provider-routes
PATCH /api/v1/admin/ai/provider-routes/{routeId}
POST /api/v1/admin/ai/provider-routes/{routeId}/publish
POST /api/v1/admin/ai/provider-routes/{routeId}/rollback/{versionId}
GET /api/v1/admin/ai/pricing-rules
PATCH /api/v1/admin/ai/pricing-rules/{ruleId}
POST /api/v1/admin/ai/pricing-rules/{ruleId}/publish
POST /api/v1/admin/ai/pricing-rules/{ruleId}/rollback/{versionId}
```

Billing / entitlement：

```text
GET  /api/v1/billing/me
GET  /api/v1/billing/payments
POST /api/v1/billing/topups/checkout
POST /api/v1/billing/payments/{paymentId}/complete
POST /api/v1/billing/workspaces/current/seats/checkout
GET  /api/v1/workspaces/current/dashboard
GET  /api/v1/workspaces/current/entitlement
GET  /api/v1/workspaces/current/seats
POST /api/v1/workspaces/current/seats
DELETE /api/v1/workspaces/current/seats/{userId}
PATCH /api/v1/workspaces/current/members/{userId}
GET  /api/v1/credits/ledger
GET  /api/v1/credits/preflight?requiredCredits=
GET  /api/v1/workspaces/{workspaceId}/billing
GET  /api/v1/workspaces/{workspaceId}/dashboard
GET  /api/v1/workspaces/{workspaceId}/usage
GET  /api/v1/workspaces/{workspaceId}/seats
POST /api/v1/workspaces/{workspaceId}/seats
POST /api/v1/credits/topups
GET  /api/v1/credits/ledger
GET  /api/v1/boards/{boardId}/permissions/effective
```

具体路由拆分未来可以调整，但核心合同必须保持不变：

- effective board permission
- active plan / seat entitlement
- workspace kind + billing visibility boundary
- resolved credit payer
- active model pricing rule + provider route
- auditable ledger facts

## 当前状态

- 这条边界已经被文档化。
- 后端已有最小 Admin 访问探针：`GET /api/v1/admin/me`，用于加载已认证本地用户 id 的 active `admin_roles`。
- 只读接口 `GET /api/v1/admin/summary`、`GET /api/v1/admin/users?limit=n`、`GET /api/v1/admin/workspaces?limit=n` 和 `GET /api/v1/admin/boards?limit=n` 已存在，并统一挂在同一个服务端 admin 检查和审计日志后面。
- `GET /api/v1/admin/audit-logs` 已存在，并支持 `limit`、`action`、`actorUserId` 和 `targetUserId` 的受限过滤。
- AI 检查加第一阶段 mutation routes 现在也已存在：`GET /api/v1/admin/ai/models`、`PATCH /api/v1/admin/ai/models/{modelKey}`、`GET /api/v1/admin/ai/versions`、models/provider-routes/pricing-rules 的 publish/rollback routes、`GET /api/v1/admin/ai/provider-routes`、`PATCH /api/v1/admin/ai/provider-routes/{routeId}`、`GET /api/v1/admin/ai/pricing-rules`、`PATCH /api/v1/admin/ai/pricing-rules/{ruleId}`、`GET /api/v1/admin/ai/runs` 和 `GET /api/v1/admin/ai/api-calls`。
- 前端 `/admin` 现在也已经在这些 routes 之上渲染了第一阶段 AI dashboard：既有 models、provider routes、pricing rules、runs 和按 run 分组的 API-call attempt 时间线，也有 version history / publish / rollback 控件，以及 model / route / pricing 更新的可编辑 save panels。
- 前端 `/admin` 现在已经是一个真实的第一阶段管理界面，基于服务端权限检查渲染 summary、users、workspaces、boards、recent audit logs、selected-user role inspection 以及 owner-only role grant/revoke controls。
- 前端 `/admin` 的访问门控现在依赖服务端探针，而不是浏览器本地 role flags。
- 计费 / 套餐策略已经在文档层被定义，包括 Group/Team workspace 的可见性边界，以及 Team 也采用 actor-personal charging 的规则。
- 第一阶段 entitlement 实现现在已经存在：`workspace_kind` 和 dev-only compatible `workspace_plan_key` 进入 request/session context，迁移 `20260506_0007` 增加 workspace kind、seat-assignment、usage-rollup、dashboard-snapshot 和 AiRun charge fields，并且后端当前已经暴露 `/api/v1/billing/me`、`/api/v1/billing/payments`、payment checkout/complete routes、`/api/v1/workspaces/current/dashboard`、`/api/v1/workspaces/current/entitlement`、`POST /api/v1/credits/topups`、`GET /api/v1/credits/ledger` 和 `PATCH /api/v1/workspaces/current/members/{userId}` 这些第一阶段接口。
- 后端和本地前端只读 plan catalogs 现在已覆盖 `free_canvas`、`collaborate_start`、`collaborate_plus`、`team_start`、`team_growth` 和 `enterprise`。
- 当 Postgres 已配置时，entitlement resolver 现在会先检查 active Team seat assignments，再通过 `tangent_credit_accounts` + `tangent_subscriptions` 检查 active user/workspace subscriptions，最后才 fallback 到 dev context / default plan keys。
- 同一个 resolver 会在可用时使用 active `tangent_credit_accounts.id` 作为 charged account id；synthetic ids 只作为 fallback 保留。
- 第一阶段 Team seat mutation contracts 现在已存在，并且受 Team workspace owner/admin 检查保护：列出当前 seats、为 active workspace member upsert Team Start/Growth seat、revoke member seat。upsert 路径也会确保被分配成员拥有 active user credit account。
- 第一阶段 credit ledger read/preflight contracts 现在已存在：`/api/v1/credits/ledger` 返回当前 payer account balance 和近期 ledger entries，`/api/v1/credits/preflight?requiredCredits=n` 返回 can-run / shortfall facts，但不会写 usage charge。
- 前端 `/billing` 现在已经带上第一阶段 top-up 动作，`/usage` 现在支持 ledger filters 和 workspace-vs-personal drill-down，而 `/team` 现在也已经在 Group/Team 可见性分层之上支持 seat assign/revoke 和 workspace member-role 编辑。
- 内部 credit ledger mutation helpers 现在已存在，用于 subscription grants、top-up purchases、带余额不足拒绝的 usage charges、usage refunds 和 admin adjustments。这些 helper 会写入可审计的 `tangent_credit_ledger` rows；第一阶段 billing checkout/complete 现在已经会在 top-up 场景下调用它们，Team seat checkout/complete 会更新 subscription capacity，而 AiRun settlement 现在也会按尝试写入 `api_cost_ledger`。
- 当 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 时，Mock AiRun 可以选择性调用这些 helper，让 charge resolver、preflight 和 ledger path 有一条被测试覆盖的后端演练链路，同时保持真实 providers disabled。
- 同一条 Mock AiRun 路径现在也给 Admin 提供了持久化 runtime 事实面：quote 阶段选中的 pricing / route ids，加上 queued/running/succeeded/canceled lifecycle rows，而且 `ai_api_calls` 现在会按每次 provider 尝试各写一行，因此 failover 历史不会被覆盖掉。当前 `/admin` runtime 界面也会按 `run_id` 对这些 attempts 分组，并标出最终成功的是哪次。
- 开发者 AI 控制平面合同已经被文档化，并且已经有了第一阶段 save surface：当前 `/admin` 已能对受限的 model、route 和 pricing facts 做 mutation，而且这些资源现在已经支持版本化 publish/rollback；后续还需要补 parameter-tier editing 和更丰富的 route-health 治理。
- 前端 `/billing` 现在渲染当前登录用户自己的 plan/credit/payer summary，`/team` 会根据服务端 / 本地 workspace kind 合同渲染 Group structural dashboard 或 Team member-usage dashboard。
- 这仍然不是真实的外部 billing：真实 payment provider、payment webhook integration、invoice/reconciliation 流、更广的 Admin finance write surface、analytics event stream、moderation queue 和 impersonation flow 都还不存在。

## 第一阶段 Admin MVP 边界

```text
Auth session
  -> 服务端检查 admin_roles
  -> 有边界的 user/workspace/board/asset/AiRun/API-call 视图，加上带审计的 admin 写操作
  -> 任意写操作都必须先写 admin_audit_logs
```

在真实 Auth 和服务端 `admin_roles` 生效之前，不要把 `/admin` 暴露到生产环境。

当前 bootstrap-first 的实现方向：

- 保持 `/api/v1/admin/me` 只读且边界收敛。
- 用它来决定 `/admin` 在当前第一阶段是应该渲染还是重定向。
- 允许有边界的 summary / users / workspaces / boards / audit-log 路由都挂在同一个服务端 `admin_roles` 检查后面。
- 保留 owner-only 的角色授予 / 撤销作为第一个 admin mutation 切片，并在同一路径中写入审计日志。
- 第一阶段 AI control-plane save routes 现在已经存在；它们必须继续保持服务端门控，并对每次 mutation 写审计，而后续 publish / rollback 还必须保留版本历史。
- 更丰富的搜索、分页、billing controls、seat controls 和 moderation tooling 仍然留到后续切片。

## Admin Bootstrap 合同

第一个全局管理员必须在真实 Auth 把已验证的 provider 身份映射到 `tangent_users` 之后，通过服务端赋予：

```text
Clerk verified user
  -> S1C auth/session mapping
  -> tangent_users row
  -> 一次性的 server/DB bootstrap 授予 tangent_admin_roles.owner
  -> bootstrap 写入 tangent_admin_audit_logs
```

规则：

- Workspace 的 `owner/admin` 不是全局 Admin。
- 前端 flags、环境变量和浏览器传来的 role 字段，永远不能成为 Admin 权限来源。
- `tangent_admin_roles` 是唯一的全局 Admin 权威来源。
- 即使是只读 `/admin` 页面，也必须由服务端 `tangent_admin_roles` 做门控。
- 每个 Admin 写路由都必须在同一个服务端控制操作中插入 `tangent_admin_audit_logs`。
- 第一次 bootstrap 可以是手工 SQL，也可以是一次性 CLI，但它必须指向一个已经验证存在的本地 user id，并写出一条审计记录。
- 当前已经有第一阶段 bootstrap CLI；后续角色授予 / 撤销应走 owner-only 的服务端路由，并同时写审计日志。

## 角色含义

```text
owner      完整的全局管理权；用于 bootstrap 和高风险设置。
admin      在 owner 建立之后承担一般性的系统管理。
support    用户和 workspace 支持视图，带少量窄写操作。
analyst    只读 analytics、AI run 和成本视图。
finance    负责 billing、subscription 和 credit-ledger 操作。
moderator  负责审核队列、内容动作和滥用工作流。
```
