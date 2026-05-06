# ARCH Slice S3: Admin, Billing And Analytics

**Updated**: 2026-05-06
**Mode**: Architecture slice.

## Scope

Data-model and access boundary for future management panel, billing, credits, seat entitlements and analytics.

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
model_provider_routes
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
```

Billing/entitlements:

```text
GET  /api/v1/billing/me
GET  /api/v1/workspaces/current/dashboard
GET  /api/v1/workspaces/current/entitlement
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
- auditable ledger facts

## Current State

- Boundary is documented.
- Minimal backend access probe exists: `GET /api/v1/admin/me` loads active `admin_roles` for the authenticated local user id.
- Read-only routes now exist for `GET /api/v1/admin/summary`, `GET /api/v1/admin/users?limit=n`, `GET /api/v1/admin/workspaces?limit=n` and `GET /api/v1/admin/boards?limit=n`, all behind the same server-side admin check and audit logging.
- `GET /api/v1/admin/audit-logs` now exists with bounded filters for `limit`, `action`, `actorUserId` and `targetUserId`.
- Frontend `/admin` now renders a real first-pass management surface behind server-checked access: summary, users, workspaces, boards, recent audit logs, selected-user role inspection and owner-only role grant/revoke controls.
- Frontend `/admin` access gating now uses the server-side admin probe to render or redirect; browser role flags remain non-authoritative.
- Billing/package strategy is now defined at the doc level, including Group-vs-Team workspace visibility boundaries and actor-personal charging for Team.
- First-pass entitlement implementation now exists: `workspace_kind` enters request/session context, migration `20260506_0007` adds workspace kind, seat-assignment, usage-rollup, dashboard-snapshot and AiRun charge fields, and the backend exposes read-only `/api/v1/billing/me`, `/api/v1/workspaces/current/dashboard` and `/api/v1/workspaces/current/entitlement`.
- Frontend `/billing` now renders the signed-in user's own plan/credit/payer summary, and `/team` renders a Group structural dashboard or Team member-usage dashboard according to the server/local workspace kind contract.
- This is still not real billing: no payment provider, atomic credit ledger, paid seat mutation service, analytics event stream, moderation queue or impersonation flow exists yet.

## First Admin MVP Boundary

```text
Auth session
  -> server checks admin_roles
  -> read-only user/workspace/board/asset/AiRun/API-call views
  -> any write action must create admin_audit_logs first
```

Do not expose `/admin` in production until real Auth and server-side `admin_roles` are active.

Current bootstrap-first implementation direction:

- Keep `/api/v1/admin/me` read-only and narrow.
- Use it to decide whether `/admin` should render or redirect in the current first pass.
- Allow bounded summary/users/workspaces/boards/audit-log routes behind the same server-side `admin_roles` check.
- Keep owner-only role grant/revoke as the first admin mutation slice, with audit logging in the same server-controlled path.
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
model_provider_routes
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
```

Billing / entitlement：

```text
GET  /api/v1/billing/me
GET  /api/v1/workspaces/current/dashboard
GET  /api/v1/workspaces/current/entitlement
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
- auditable ledger facts

## 当前状态

- 这条边界已经被文档化。
- 后端已有最小 Admin 访问探针：`GET /api/v1/admin/me`，用于加载已认证本地用户 id 的 active `admin_roles`。
- 只读接口 `GET /api/v1/admin/summary`、`GET /api/v1/admin/users?limit=n`、`GET /api/v1/admin/workspaces?limit=n` 和 `GET /api/v1/admin/boards?limit=n` 已存在，并统一挂在同一个服务端 admin 检查和审计日志后面。
- `GET /api/v1/admin/audit-logs` 已存在，并支持 `limit`、`action`、`actorUserId` 和 `targetUserId` 的受限过滤。
- 前端 `/admin` 现在已经是一个真实的第一阶段管理界面，基于服务端权限检查渲染 summary、users、workspaces、boards、recent audit logs、selected-user role inspection 以及 owner-only role grant/revoke controls。
- 前端 `/admin` 的访问门控现在依赖服务端探针，而不是浏览器本地 role flags。
- 计费 / 套餐策略已经在文档层被定义，包括 Group/Team workspace 的可见性边界，以及 Team 也采用 actor-personal charging 的规则。
- 第一阶段 entitlement 实现现在已经存在：`workspace_kind` 进入 request/session context，迁移 `20260506_0007` 增加 workspace kind、seat-assignment、usage-rollup、dashboard-snapshot 和 AiRun charge fields，并且后端暴露只读 `/api/v1/billing/me`、`/api/v1/workspaces/current/dashboard` 和 `/api/v1/workspaces/current/entitlement`。
- 前端 `/billing` 现在渲染当前登录用户自己的 plan/credit/payer summary，`/team` 会根据服务端 / 本地 workspace kind 合同渲染 Group structural dashboard 或 Team member-usage dashboard。
- 这仍然不是真实 billing：payment provider、原子化 credit ledger、付费 seat mutation service、analytics event stream、moderation queue 和 impersonation flow 都还不存在。

## 第一阶段 Admin MVP 边界

```text
Auth session
  -> 服务端检查 admin_roles
  -> 只读 user/workspace/board/asset/AiRun/API-call 视图
  -> 任意写操作都必须先写 admin_audit_logs
```

在真实 Auth 和服务端 `admin_roles` 生效之前，不要把 `/admin` 暴露到生产环境。

当前 bootstrap-first 的实现方向：

- 保持 `/api/v1/admin/me` 只读且边界收敛。
- 用它来决定 `/admin` 在当前第一阶段是应该渲染还是重定向。
- 允许有边界的 summary / users / workspaces / boards / audit-log 路由都挂在同一个服务端 `admin_roles` 检查后面。
- 保留 owner-only 的角色授予 / 撤销作为第一个 admin mutation 切片，并在同一路径中写入审计日志。
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
