# S3 Billing + Team Entitlements Strategy

**Updated**: 2026-05-08
**Status**: Superseded strategy reference. Keep only for market benchmarks and historical reasoning. The active implementation plan is `s3-team-group-wallets-membership-billing-plan-2026-05-08.md`.

> Superseded decision: this file describes an older Team actor-personal / seat-backed credit strategy. The current product decision is Team workspace wallet for Team Start/Growth, and personal wallet for Group/Collaborate.

## Goal

Define a launch-ready commercial and workspace-governance model before real provider charging begins, so S1D permissions, S2 AiRun charging and S3 Admin/Billing do not drift into contradictory rules.

## Working Decision

Build in this order:

1. S1D permission hardening: `Can view / Can edit / Can manage / Owner`.
2. S3 Group-vs-Team workspace visibility contract.
3. S3 seat + entitlement resolver.
4. S2 real AiRun charging against the resolved payer.
5. S3 billing/admin finance surfaces.

Do not start real provider charging before steps 1-3 are explicit in code.

## Market Benchmarks

As of 2026-05-06, the most relevant official references are:

| Product | What it shows | Why it matters |
| --- | --- | --- |
| OpenAI ChatGPT Business | `$20/user/month` annual, `$25/user/month` monthly, minimum 2 users | Good reference for business AI seat pricing and pooled team purchase expectations |
| Miro | Starter from `$8/member/month`; Business from `$16/member/month` annual or `$20` monthly | Good reference for visual collaboration seat pricing and permission-heavy workspaces |
| Figma | Professional full seat `$16/month`, Dev seat `$12/month`, Collab seat `$3/month`; Organization full seat `$55/month` | Good reference for role-based seats and “viewer/lightweight seat vs full editor seat” separation |
| Runway | Higher plans add more editor seats plus shared credit allowance | Good reference for team shared-AI spend instead of pretending every seat is unlimited |
| Ideogram | Team plan `$30/member/month`; top-up credits roll over while plans stay active | Good reference for AI-native credit packs and rollover expectations |

Source links:

- https://openai.com/business/chatgpt-pricing
- https://miro.com/pricing/
- https://www.figma.com/pricing/
- https://help.runwayml.com/hc/en-us/articles/21664961171475-Which-plan-is-right-for-me
- https://docs.ideogram.ai/plans-and-pricing/plans-and-pricing

## Recommended TANGENT Packaging

These numbers are product targets, not final finance commitments. Re-check after S2 provider-cost baselines.

| Plan | Price target | Credit owner | Included AI | Main use case |
| --- | --- | --- | --- | --- |
| `free_canvas` | `$0` | none included; top-up only | `0` monthly included | Free canvas adoption and viral sharing |
| `collaborate_start` | `$15/user/month` annual target, `$18` monthly target | personal account | `~1,500` credits/user/month target | Group Workspace for lightweight personal AI plus shared canvas collaboration |
| `collaborate_plus` | `$20/user/month` annual target, `$25` monthly target | personal account | `~2,000` credits/user/month target | Group Workspace for heavier-AI solo creators and small collaborating groups |
| `team_start` | `$20/seat/month` annual target, `$25` monthly target, `2-15` seats | acting member's own seat-backed account | `~2,500` credits/seat/month target | Team Workspace for moderate-AI teams needing governance and admin usage visibility |
| `team_growth` | `$40/seat/month` annual target, `$45` monthly target, `2-15` seats | acting member's own seat-backed account | `~5,500` credits/seat/month target | Team Workspace for AI-heavy teams treating the canvas as an operational workspace |
| `enterprise` | custom | workspace pooled account or contract account | contract-defined | Procurement, SSO, budgets, policy and invoicing |

## Product Rules

### Permission model

- `Can view`: open only. No edit, no run, no copy.
- `Can edit`: edit/save Board content. AI run is a separate entitlement check.
- `Can manage`: invite/share/rename/visibility/member management. Must be an active workspace member or an explicitly allowed invited admin role.
- `Owner`: everything above plus copy/delete and later ownership transfer.

### Workspace kind rule

- Non-team external share recipients are view-only in the initial model.
- Free share links are view-only.
- `Can edit` and `Can manage` are never granted solely by a public share link.
- A user may create and join multiple Group Workspaces.
- Group Workspaces may invite free users as editors.
- Group creators/admins may manage workspace admins/editors and Board admins/editors, and may see a basic structural dashboard, but they may not inspect other members' AI credit usage or expiry state.
- Team Workspaces use the same core Board/member surface, but Team admins/owners can additionally see per-member AI usage, total usage, expiry status, Board count and Board/member inventory.
- Board admin visibility and Team billing visibility must stay separate; a Board admin does not automatically inherit Team dashboard access.

### Credit charging rule

- Free, Collaborate Start, Collaborate Plus, Team Start and Team Growth: whoever clicks `Run` pays from their own eligible balance.
- Invited free Group editors have no included monthly AI credits; they may run AI only if they have their own purchased top-up balance.
- Team seat allowances are attached to each assigned member seat, but they are still consumed by that acting member rather than by a pooled workspace wallet.
- Enterprise may later use workspace pooled charging when the contract says so.
- If the payer account has no balance or the actor lacks permission, the run must fail before provider execution.

### Packaging rationale

- The Collaborate split should stay simple: same Group Workspace-sharing behavior, mostly differentiated by monthly included credits.
- Team should not be modeled as “pooled AI wallet first”; the real product distinction is governance, member visibility and reporting.
- `team_start` should read as the moderate-AI governed-team plan rather than a weak starter tax.
- `team_growth` should read as the high-AI-dependency Team Workspace package and grant materially more AI value, not just “slightly more credits”.
- Higher team tiers should win on three axes together:
  - more total seat-backed credits
  - more credits per seat
  - stronger governance/reporting value

## Top-Up Strategy

Principle only; final price card should wait for provider-cost baseline:

- Free top-ups are the least favorable unit price.
- Collaborate top-ups are better than Free.
- Team-member top-ups are better than Collaborate.
- Team Growth top-ups should be better than Team Start.
- In first pass, top-up ownership remains user-level even inside Group and Team workspaces.
- Monthly included subscription credits may expire at cycle end.
- Purchased top-up credits should roll over while the subscription remains active.

## Frontend Lock Points

### Billing UI

- `/billing` shows each user's own current plan, included credits, top-up balance, usage and expiry status.
- Group Workspace creators/admins see a basic workspace dashboard for members/Boards/activity, but no other members' billing panel.
- Team Workspace admins/owners see a Team dashboard with per-member AI usage, total usage, expiry status, Board count and Board/member inventory.
- Group and Team members still see their own detailed usage in personal settings/billing.
- Invited free Group editors should see “You can edit this Board, but AI uses your own credits”.
- Team members should see “Charges your credits” plus a note that usage may appear in the Team dashboard.

### Share / Board management UI

- Role dropdown uses `Can view / Can edit / Can manage / Owner`.
- If the target user is not in the workspace/team, only `Can view` is available in the initial version.
- In Group Workspaces, invited unpaid users may be granted `Can edit`, but not `Can manage`, in the first pass.
- Team Workspaces use the same Board-role controls, but Team dashboard visibility stays with Team admins/owners only.
- `Copy board` is shown only for owner.
- `Delete board` is shown only for owner.
- `Rename/share/invite/member management` is shown for manage + owner.

### AI node UI

- Before run, show payer hint:
  - `Charges your credits`
  - `Charges enterprise workspace credits` when an enterprise contract pool is actually active
- If the actor is a free invited Group editor, show that there are no included monthly AI credits before they press Run.
- If the actor is on a Team seat, show that the run still charges their own Team-seat-backed balance.
- If the actor lacks seat/balance/permission, block before run.

## Backend Lock Points

### Required resolvers

1. `effective_board_permission_resolver`
2. `workspace_kind_resolver`
3. `workspace_dashboard_visibility_resolver`
4. `workspace_seat_entitlement_resolver`
5. `credit_account_resolver`
6. `ai_charge_preflight`
7. `ai_actor_credit_eligibility_resolver`

### Logical database direction

Core workspace facts:

- `workspaces`: add or confirm `kind = solo_workspace | group_workspace | team_workspace | enterprise_workspace`.
- `workspace_members`: `workspace_id`, `user_id`, `workspace_role`, `status`, `joined_at`, `invited_by_user_id`.
- `workspace_invites`: email/user invite facts, desired workspace role, expiration and acceptance state.
- `workspace_dashboard_snapshots`: cached Team/Group dashboard cards, recomputable from usage and Board facts.
- `workspace_usage_rollups`: daily/monthly rollups by workspace, user, model family and billing period.

Board-level facts:

- `boards`: owner, workspace, title, visibility, archived/deleted state.
- `board_members`: Board-scoped `owner/admin/editor/viewer/temporary_viewer`.
- `board_share_links`: public view-only tokens, future expiry and revoke metadata.

Seat and billing facts:

- `subscriptions`: plan, billing period, provider subscription id, status.
- `workspace_seat_assignments`: Team seat assignment from workspace to user, plan tier, cycle window and included-credit grant state.
- `credit_accounts`: user-level by default; workspace-level only for enterprise contract pools.
- `credit_ledger`: grants, top-ups, usage, refunds and admin adjustments.
- `payments` / `invoices`: payment-provider facts, not permission authority.

AI execution facts:

- `ai_runs`: immutable run header with actor, workspace, board, workspace kind, charged account and entitlement source.
- `ai_api_calls`: provider/model/latency/status/error/provider-cost details.
- `api_cost_ledger`: normalized provider cost facts for finance/admin analysis.

### Backend service boundaries

- `WorkspaceAccessService`: resolves workspace membership, workspace kind and workspace-admin authority.
- `BoardPermissionService`: resolves Board role and user-facing `Can view/edit/manage/Owner`.
- `DashboardVisibilityService`: decides whether the actor can see Group structural dashboard or Team member usage dashboard.
- `SeatEntitlementService`: resolves Team seat assignment and included-credit allowance.
- `CreditAccountService`: resolves the actor's chargeable account or enterprise pool.
- `AiChargePreflightService`: checks permission, model allowance, balance, rate limit and ledger preauthorization before provider execution.
- `AdminAuditService`: records admin/developer-console writes in `admin_audit_logs`.

## UI Surface Contract

### Group Workspace UI

- Group shell: Boards, members, invites, role management and basic activity/dashboard cards.
- Creator/admin may manage workspace admins/editors and Board admins/editors.
- Creator/admin may not view member-level AI credit usage, expiry, personal invoices or top-up balances.
- Each member views their own usage and billing only in personal settings/billing.

### Team Workspace UI

- Team shell: same Boards, members, invites and Board-role controls as Group.
- Additional Team dashboard: per-member AI usage, total usage, expiry status, seat assignment status, Board count and Board/member mapping.
- Team admins/owners may manage workspace admins/editors and Board admins/editors.
- Board admins do not automatically gain Team dashboard access.

### Personal billing UI

- Shows current plan, included credits, top-up balance, usage history, expiry and invoices for the signed-in user.
- Shows all Group/Team workspaces the user belongs to, but does not leak other members' usage.

### Developer/Admin console UI

- Global `/admin` remains server-gated through `admin_roles`.
- Developer/admin views should include users, workspaces, Boards, subscriptions, credit accounts, credit ledger, AiRuns, provider calls, cost ledger, audit logs and moderation queues.
- Global admin can inspect Team usage summaries for support/finance/debugging, but every write must audit who changed what.
- Admin role management and product entitlement management must stay separate: global admin role is never inferred from workspace owner/admin.

## AI Run Charge Flow

```text
User clicks Run on AI node
  |
  v
Request context resolves user + workspace + workspace_kind + board
  |
  v
BoardPermissionService checks Can edit/run context
  |
  v
WorkspaceAccessService + SeatEntitlementService resolve plan/seat
  |
  v
CreditAccountService resolves payer
  |-- Free / Collaborate / Team -> actor_personal
  |-- Enterprise contract pool -> workspace_pool when configured
  |
  v
AiChargePreflightService checks balance, model allowance, rate limit
  |
  v
Create ai_run + provisional ledger hold/usage fact
  |
  v
Provider adapter executes server-side
  |
  v
Store output as Asset refs; write ai_api_calls + api_cost_ledger
  |
  v
Settle usage/refund in credit_ledger; return summary to UI
```

## Development Architecture Flow

```text
Phase A: Contract + DB
  workspace kind
  workspace members/invites
  seat assignment
  credit accounts/ledger
  ai_run charge fields
  |
  v
Phase B: Permission services
  workspace access
  board permission
  dashboard visibility
  seat entitlement
  charge preflight
  |
  v
Phase C: User-facing surfaces
  Group workspace dashboard
  Team workspace dashboard
  personal billing
  Board share/member role UI
  |
  v
Phase D: AI runtime integration
  real provider adapter
  AiRun create/poll/cancel
  ledger usage/refund
  asset output refs
  |
  v
Phase E: Developer/Admin console
  users/workspaces/boards
  subscriptions/credits/ledger
  AiRuns/provider calls/costs
  audit log and role management
```

### Required persisted facts

- `actor_user_id`
- `workspace_id`
- `board_id`
- `workspace_kind`
- `workspace_seat_id`
- `charged_account_id`
- `charged_scope`
- `entitlement_source`
- `credits_charged`
- `credits_refunded`
- `provider_cost`
- `provider_currency`

### Required ledger events

- `subscription_grant`
- `topup_purchase`
- `usage_charge`
- `usage_refund`
- `admin_adjustment`
- `seat_change_adjustment`
- `plan_change_adjustment`

## Route Direction

Exact route names may move, but these capabilities must exist:

### S1D

- effective board permission
- workspace membership lookup
- board member management
- group/team role policy enforcement

### S3

- billing summary
- workspace dashboard summary
- workspace usage summary
- seat summary and seat changes
- credit ledger
- top-up purchase entry
- team usage breakdown

### S2

- AiRun create must call permission + workspace-kind + entitlement + charge preflight before provider execution

## Implementation Sequence

### Phase 1: permission hardening

- map UI labels to technical roles
- decouple Board edit from AI entitlement
- require server-backed membership for edit/manage
- owner-only copy/delete

### Phase 2: workspace-governance contracts

- define workspace kinds
- define who may see member usage in Group vs Team
- separate Board admin from Team dashboard visibility

### Phase 3: entitlement contracts

- define plan keys
- define charged scope
- define seat/account resolver
- define billing summary APIs

### Phase 4: AiRun charge binding

- add charged account facts to AiRun
- add ledger writes
- add refund path for failures/cancellations

### Phase 5: Admin finance views

- plan, seats, member usage visibility
- per-user team spend
- top-ups, adjustments, refunds

## Open Questions

- Whether free users may invite up to 3 view-only guests on the one free Board, or whether even that should require Collaborate.
- Whether Group Workspace creators should see only Boards/members/activity, or also a very light aggregate AI count that still avoids exposing member-level billing.
- Whether a single user may join multiple Team Workspaces with separate seat-backed allowances, and how seat reassignment/downgrade should work across those memberships.
- Whether Board creators inside a Team Workspace should gain any extra dashboard rights, or whether dashboard visibility must stay strictly workspace-admin-only.
- Whether purchased top-up credits survive downgrades or only active subscriptions.
- Whether enterprise pooled credits should be one global workspace account or region/account scoped.

## Current Recommendation

Do not jump straight to S2 real provider charging yet. Finish the S1D permission hardening plus the Group-vs-Team workspace visibility contract first, then wire S3/S2 on top of that. This avoids later rewrites around “who pays”, “who can see usage”, “who can invite”, and “who can copy/delete”.

## Current Implementation Checkpoint

- Migration `20260506_0007` now adds `workspace.kind`, workspace seat assignments, usage rollups, dashboard snapshots and AiRun charge ownership fields.
- Request/session context now carries `workspace_kind` plus a dev-only compatible `workspace_plan_key` for local tier-contract testing.
- Backend and local frontend read-only plan catalogs now cover `collaborate_plus` and `team_growth`, not only the Start tiers.
- Entitlement reads now prefer database facts when Postgres is configured: active Team seat assignment first, then active user/workspace subscription via credit account, then dev/default fallback.
- AiRun payer summaries now use active database credit account ids when available, with synthetic ids kept as local fallback only.
- Team owner/admin seat mutation contracts now exist for list/upsert/revoke, but they do not touch Stripe or mutate credit ledger balances.
- Credit ledger read/preflight routes now exist for current payer account balance, entries, can-run and shortfall facts.
- Internal credit ledger mutation/settlement helpers now exist for subscription grants, top-up purchases, usage charges with insufficient-balance rejection, usage refunds and admin adjustments. They are intentionally service-layer only until payment webhooks, Admin finance writes and real AiRun settlement routes are server-gated.
- Backend read-only routes now exist for `/api/v1/billing/me`, `/api/v1/workspaces/current/dashboard` and `/api/v1/workspaces/current/entitlement`.
- Mock AiRun responses now include payer facts: `workspaceKind`, `chargedScope`, `chargedAccountId`, `entitlementSource`, optional `workspaceSeatId` and `payerLabel`.
- Mock AiRun can optionally exercise credit-ledger usage charging behind `TANGENT_AI_MOCK_LEDGER_CHARGING=1`: it estimates mock credits, rejects insufficient balance and writes `usage_charge`. The default local path still does not charge credits.
- S2/S3 docs now define the future developer AI control plane for model tiers, provider routes, pricing-rule versions and audited failover/publish flow.
- Frontend `/billing` now shows the signed-in user's own plan/credits/usage/payer summary.
- Frontend `/team` now shows Group structure or Team usage visibility according to workspace kind.
- This checkpoint is still contract-only for billing: no Stripe, no payment-webhook balance mutation, no paid seat purchase flow and no provider-cost ledger settlement yet.

## Next Implementation Tranche: Developer AI Control Plane

The next S2/S3 bridge should not jump straight to one hard-coded provider. It should create a unified backend control plane for model tiers, supplier routes and credit pricing.

Required backend entities:

- `model_registry`: stable public product model keys such as `gpt_image_2`.
- `model_parameter_tiers`: product-facing tiers such as `0.5K`, `1K`, `2K`, `4K`, quality and output count.
- `model_provider_routes`: provider/model mapping, priority, weight, timeout, retry policy and enabled/health state.
- `model_pricing_rules`: versioned credit estimate, minimum charge, multiplier/markup and provider-cost formula per model/tier.
- `model_pricing_rule_audit_logs` and `provider_route_health_events`: publish history and route health/failover facts.

Required admin/developer backend surfaces:

- Models screen: enable/disable product models and default tiers.
- Tier screen: edit product-facing resolution/quality/count choices and provider-native parameter mapping.
- Routes screen: choose primary/fallback supplier lines, reorder priority and disable unstable routes.
- Pricing screen: publish new credit versions as supplier prices change, with effective date and audit trail.
- Cost screen: inspect AiRun route id, pricing rule id, provider cost, credits charged/refunded, margin estimate and failures.

Execution rules:

- The frontend must read estimated credit cost from the server, not compute it locally.
- One product model may map to multiple supplier lines; users never choose the raw provider route directly.
- Route failover must keep one AiRun id and one final settlement outcome.
- Pricing/version changes affect only future runs; historical runs keep the original pricing rule id.
- If the provider exposes actual usage/cost, the server estimates first, then settles final charge/refund after the response.

## 中文完整翻译

# S3 计费 + 团队权限策略

**更新日期**：2026-05-06  
**状态**：关于定价、积分归属、团队席位策略和实施顺序的活跃战术计划。

## 目标

在接入真实 provider charging 之前，先定义一套可上线的商业模型和 workspace 治理模型，避免 S1D 权限、S2 AiRun 扣费和 S3 Admin/Billing 互相漂移、相互矛盾。

## 当前决策

按以下顺序建设：

1. 先做 S1D 权限硬化：`Can view / Can edit / Can manage / Owner`
2. 再做 S3 的 Group-vs-Team workspace 可见性合同
3. 再做 S3 的 seat + entitlement resolver
4. 再让 S2 的真实 AiRun 按解析出的 payer 扣费
5. 最后做 S3 的 billing / admin finance 界面

在前三步还没有在代码里明确之前，不要直接开始真实 provider charging。

## 市场基准

截至 2026-05-06，最有参考价值的官方公开基准有：

| 产品 | 它说明了什么 | 为什么值得参考 |
| --- | --- | --- |
| OpenAI ChatGPT Business | 年付 `$20/用户/月`，月付 `$25/用户/月`，至少 2 个用户 | 适合作为团队 AI 席位定价和 pooled purchase 预期参考 |
| Miro | Starter 从 `$8/成员/月` 起；Business 年付 `$16/成员/月` 或月付 `$20` | 适合作为视觉协作产品和权限型 workspace 的定价参考 |
| Figma | Professional full seat `$16/月`，Dev seat `$12/月`，Collab seat `$3/月`；Organization full seat `$55/月` | 适合作为角色化 seat 设计，以及轻量协作者 seat 的参考 |
| Runway | 更高档套餐会增加 editor seats 和 shared credit allowance | 适合作为“团队共享 AI 花费”模式的参考，而不是假装所有 seat 都无限用 |
| Ideogram | Team plan `$30/成员/月`；充值 credits 在计划有效期内可结转 | 适合作为 AI-native credit packs 和 rollover 预期参考 |

参考链接：

- https://openai.com/business/chatgpt-pricing
- https://miro.com/pricing/
- https://www.figma.com/pricing/
- https://help.runwayml.com/hc/en-us/articles/21664961171475-Which-plan-is-right-for-me
- https://docs.ideogram.ai/plans-and-pricing/plans-and-pricing

## 推荐的 TANGENT 套餐

这些数字是产品目标，不是最终财务承诺；等 S2 provider 成本基线出来后还要重新核对。

| 套餐 | 目标价格 | 积分归属 | 赠送 AI | 主要适用人群 |
| --- | --- | --- | --- | --- |
| `free_canvas` | `$0` | 不赠送，只能充值 | 每月 `0` | Free canvas 的获客和传播 |
| `collaborate_start` | 年付目标 `$15/用户/月`，月付 `$18` | 个人账户 | 每人每月约 `1,500` credits | 面向轻量个人 AI + 共享画布协作的 Group Workspace |
| `collaborate_plus` | 年付目标 `$20/用户/月`，月付 `$25` | 个人账户 | 每人每月约 `2,000` credits | 面向更依赖 AI 的单人创作者和小型协作组的 Group Workspace |
| `team_start` | 年付目标 `$20/席位/月`，月付 `$25`，`2-15` 席位 | 当前操作者自己的 seat-backed 账户 | 每席位每月约 `2,500` credits | 面向中度 AI 依赖、需要治理和管理员 usage 可见性的 Team Workspace |
| `team_growth` | 年付目标 `$40/席位/月`，月付 `$45`，`2-15` 席位 | 当前操作者自己的 seat-backed 账户 | 每席位每月约 `5,500` credits | 面向把画布当作日常工作台的高 AI 依赖 Team Workspace |
| `enterprise` | 定制 | workspace 共用账户或合同账户 | 按合同定义 | 采购、SSO、预算、策略和开票 |

## 产品规则

### 权限模型

- `Can view`：只能打开，不能编辑、不能运行、不能复制。
- `Can edit`：表示可以 edit / save Board 内容；AI run 需要单独做 entitlement 检查。
- `Can manage`：可以 invite / share / rename / visibility / member management，并且必须是活跃的 workspace 成员，或被明确允许的 invited admin 角色。
- `Owner`：在上述基础上，再拥有 copy / delete，以及未来的 ownership transfer。

### Workspace 形态规则

- 非 team 的外部分享对象在初始模型中统一是只读。
- Free share links 是只读链接。
- 不能仅靠 public share link 获得 `Can edit` 或 `Can manage`。
- 一个用户可以创建并加入多个 Group Workspace。
- Group Workspace 可以邀请免费用户作为编辑者。
- Group 的创建者 / 管理员可以管理 workspace admins/editors 和 Board admins/editors，也可以看到基础结构型 dashboard，但不能查看其他成员的 AI usage 或到期状态。
- Team Workspace 使用同一套核心 Board / 成员界面，但 Team admins/owners 可以额外看到每个成员的 AI usage、总 usage、到期状态、Board 数量和 Board/成员清单。
- Board admin 可见性和 Team billing 可见性必须分开；一个 Board admin 不会自动继承 Team dashboard 访问权。

### 扣费规则

- Free、Collaborate Start、Collaborate Plus、Team Start 和 Team Growth：谁点击 `Run`，就从谁自己的可用余额扣费。
- 被邀请的免费 Group 编辑者没有月度赠送 AI 积分；只有在他们自己买了充值余额之后，才可以运行 AI。
- Team 的 seat 额度绑定到各自成员身上，但消耗时仍然是当前操作者自己在扣费，而不是扣一个共用 workspace 钱包。
- Enterprise 在未来可以按合同使用 workspace pooled charging。
- 如果 payer 没余额，或者 actor 没权限，必须在 provider 执行前就失败。

### 套餐设计逻辑

- Collaborate 的两个梯度应该尽量保持简单：共享 Group Workspace 规则一致，主要区别放在每月赠送 AI 积分数量。
- Team 不应该被建模成“先有 pooled AI wallet”；真正的产品差异是治理能力、成员 usage 可见性和报表能力。
- `team_start` 应该被理解为“中度 AI 依赖”的治理型团队档，而不是一个软弱的 starter tax。
- `team_growth` 不应该只是“多一点 credits”，而应该明确是给高 AI 依赖 Team Workspace 准备的更强方案。
- 更高团队档位必须同时在三件事上胜出：
  - 总 seat-backed credits 更多
  - 每席位 credits 更多
  - 治理 / 报表价值更强

## Top-Up 策略

这里只先定义原则；最终价格卡需要等 provider 成本基线出来再定：

- Free 的 top-up 单价最差
- Collaborate 的 top-up 单价优于 Free
- Team 成员的 top-up 单价优于 Collaborate
- Team Growth 的 top-up 单价应优于 Team Start
- 第一阶段里，top-up 的归属依然是用户级，而不是 Group/Team 级
- 订阅赠送的 credits 可以在账期结束后失效
- 单独购买的 credits 在订阅有效期内应可继续结转

## 前端需要锁定的点

### Billing UI

- `/billing` 需要展示每个用户自己的 current plan、included credits、top-up balance、usage 和 expiry status
- Group Workspace 的创建者 / 管理员只看到基础 workspace dashboard，不看到其他成员的 billing panel
- Team Workspace 的 admins/owners 需要看到 Team dashboard，展示 per-member AI usage、总 usage、expiry status、Board 数量和 Board/成员清单
- Group 和 Team 的普通成员仍然只在自己的个人 settings/billing 里看详细 usage
- 被邀请的免费 Group 编辑者需要看到 “You can edit this Board, but AI uses your own credits” 这一类提示
- Team 成员需要看到 “Charges your credits”，并附带“usage 可能会出现在 Team dashboard 里”这一类提示

### Share / Board management UI

- 角色下拉统一使用 `Can view / Can edit / Can manage / Owner`
- 如果目标用户不在 workspace / team 中，初始版本只能给 `Can view`
- 在 Group Workspace 里，被邀请但未付费的用户第一阶段可以给 `Can edit`，但不能给 `Can manage`
- Team Workspace 使用相同的 Board 角色控件，但 Team dashboard 的可见性只属于 Team admins/owners
- `Copy board` 只对 owner 显示
- `Delete board` 只对 owner 显示
- `Rename/share/invite/member management` 只对 manage + owner 显示

### AI node UI

- 在 Run 之前，需要明确提示：
  - `Charges your credits`
  - 只有在 enterprise 合同真的启用 pooled charging 时，才显示 `Charges enterprise workspace credits`
- 如果操作者是被邀请的免费 Group 编辑者，在点击 Run 前就要明确提示“没有月度赠送 AI 积分”
- 如果操作者使用的是 Team seat，也要明确提示：扣费的仍然是他自己的 Team-seat-backed 余额
- 如果 actor 缺少 seat / 余额 / 权限，必须在执行前阻止

## 后端需要锁定的点

### 必须存在的 resolver

1. `effective_board_permission_resolver`
2. `workspace_kind_resolver`
3. `workspace_dashboard_visibility_resolver`
4. `workspace_seat_entitlement_resolver`
5. `credit_account_resolver`
6. `ai_charge_preflight`
7. `ai_actor_credit_eligibility_resolver`

### 逻辑数据库方向

核心 workspace 事实：

- `workspaces`：新增或确认 `kind = solo_workspace | group_workspace | team_workspace | enterprise_workspace`。
- `workspace_members`：`workspace_id`、`user_id`、`workspace_role`、`status`、`joined_at`、`invited_by_user_id`。
- `workspace_invites`：email / user invite 事实、目标 workspace role、过期时间和接受状态。
- `workspace_dashboard_snapshots`：缓存 Team / Group dashboard 卡片，可从 usage 和 Board 事实重新计算。
- `workspace_usage_rollups`：按 workspace、user、model family 和 billing period 聚合的日 / 月 rollup。

Board 级事实：

- `boards`：owner、workspace、title、visibility、archived / deleted 状态。
- `board_members`：Board 级 `owner/admin/editor/viewer/temporary_viewer`。
- `board_share_links`：公开只读 token，以及未来的 expiry 和 revoke 元数据。

席位和计费事实：

- `subscriptions`：plan、billing period、provider subscription id、status。
- `workspace_seat_assignments`：Team seat 从 workspace 分配到 user，记录 plan tier、cycle window 和 included-credit grant 状态。
- `credit_accounts`：默认是 user-level；只有 enterprise contract pool 才使用 workspace-level。
- `credit_ledger`：grant、top-up、usage、refund 和 admin adjustment。
- `payments` / `invoices`：支付 provider 事实，不作为权限来源。

AI 执行事实：

- `ai_runs`：不可变 run header，包含 actor、workspace、board、workspace kind、charged account 和 entitlement source。
- `ai_api_calls`：provider / model / latency / status / error / provider-cost 细节。
- `api_cost_ledger`：归一化 provider 成本事实，用于 finance / admin 分析。

### 后端服务边界

- `WorkspaceAccessService`：解析 workspace membership、workspace kind 和 workspace-admin 权限。
- `BoardPermissionService`：解析 Board role 和用户可见的 `Can view/edit/manage/Owner`。
- `DashboardVisibilityService`：判断 actor 是否能看到 Group 结构 dashboard 或 Team 成员 usage dashboard。
- `SeatEntitlementService`：解析 Team seat assignment 和 included-credit allowance。
- `CreditAccountService`：解析当前操作者的可扣费账户或 enterprise pool。
- `AiChargePreflightService`：在 provider 执行前检查权限、模型额度、余额、rate limit 和 ledger 预授权。
- `AdminAuditService`：把 admin / developer-console 写操作记录到 `admin_audit_logs`。

## UI 界面合同

### Group Workspace UI

- Group shell：Boards、members、invites、role management 和基础 activity / dashboard 卡片。
- Creator / admin 可以管理 workspace admins/editors 和 Board admins/editors。
- Creator / admin 不能查看成员级 AI credit usage、expiry、个人 invoices 或 top-up balances。
- 每个成员只能在 personal settings / billing 里查看自己的 usage 和 billing。

### Team Workspace UI

- Team shell：与 Group 相同的 Boards、members、invites 和 Board-role 控件。
- 额外 Team dashboard：per-member AI usage、total usage、expiry status、seat assignment status、Board count 和 Board/member mapping。
- Team admins / owners 可以管理 workspace admins/editors 和 Board admins/editors。
- Board admins 不会自动获得 Team dashboard 访问权。

### 个人 billing UI

- 展示当前登录用户自己的 current plan、included credits、top-up balance、usage history、expiry 和 invoices。
- 展示用户加入的所有 Group / Team workspaces，但不泄露其他成员 usage。

### Developer / Admin console UI

- 全局 `/admin` 继续通过 `admin_roles` 做服务端门控。
- Developer / admin 视图应包含 users、workspaces、Boards、subscriptions、credit accounts、credit ledger、AiRuns、provider calls、cost ledger、audit logs 和 moderation queues。
- Global admin 可以为了 support / finance / debug 查看 Team usage summaries，但所有写操作都必须审计谁改了什么。
- Admin role management 和 product entitlement management 必须分开：全局 admin role 永远不能从 workspace owner/admin 推断。

## AI Run 扣费流程

```text
用户在 AI node 点击 Run
  |
  v
Request context 解析 user + workspace + workspace_kind + board
  |
  v
BoardPermissionService 检查 Can edit/run context
  |
  v
WorkspaceAccessService + SeatEntitlementService 解析 plan/seat
  |
  v
CreditAccountService 解析 payer
  |-- Free / Collaborate / Team -> actor_personal
  |-- Enterprise contract pool -> workspace_pool when configured
  |
  v
AiChargePreflightService 检查余额、model allowance、rate limit
  |
  v
创建 ai_run + provisional ledger hold/usage fact
  |
  v
Provider adapter 在服务端执行
  |
  v
把输出存成 Asset refs；写 ai_api_calls + api_cost_ledger
  |
  v
在 credit_ledger 里 settle usage/refund；向 UI 返回 summary
```

## 开发架构流程

```text
Phase A: Contract + DB
  workspace kind
  workspace members/invites
  seat assignment
  credit accounts/ledger
  ai_run charge fields
  |
  v
Phase B: Permission services
  workspace access
  board permission
  dashboard visibility
  seat entitlement
  charge preflight
  |
  v
Phase C: User-facing surfaces
  Group workspace dashboard
  Team workspace dashboard
  personal billing
  Board share/member role UI
  |
  v
Phase D: AI runtime integration
  real provider adapter
  AiRun create/poll/cancel
  ledger usage/refund
  asset output refs
  |
  v
Phase E: Developer/Admin console
  users/workspaces/boards
  subscriptions/credits/ledger
  AiRuns/provider calls/costs
  audit log and role management
```

### 必须持久化的字段

- `actor_user_id`
- `workspace_id`
- `board_id`
- `workspace_kind`
- `workspace_seat_id`
- `charged_account_id`
- `charged_scope`
- `entitlement_source`
- `credits_charged`
- `credits_refunded`
- `provider_cost`
- `provider_currency`

### 必须支持的 ledger 事件

- `subscription_grant`
- `topup_purchase`
- `usage_charge`
- `usage_refund`
- `admin_adjustment`
- `seat_change_adjustment`
- `plan_change_adjustment`

## 路由方向

具体路由名字未来可以调整，但下面这些能力必须存在：

### S1D

- effective board permission
- workspace membership lookup
- board member management
- group / team role policy enforcement

### S3

- billing summary
- workspace dashboard summary
- workspace usage summary
- seat summary 和 seat changes
- credit ledger
- top-up purchase entry
- team usage breakdown

### S2

- AiRun create 必须在 provider 调用前先跑 permission + workspace-kind + entitlement + charge preflight

## 实施顺序

### Phase 1：权限硬化

- 把 UI 角色文案映射到技术角色
- 把 Board 编辑能力和 AI entitlement 分开
- 对 edit / manage 强制要求服务端可验证的成员身份
- 把 copy / delete 收敛到 owner-only

### Phase 2：workspace 治理合同

- 定义 workspace kinds
- 定义 Group 和 Team 里谁可以看成员 usage
- 把 Board admin 和 Team dashboard 可见性拆开

### Phase 3：entitlement 合同

- 定义 plan keys
- 定义 charged scope
- 定义 seat / account resolver
- 定义 billing summary APIs

### Phase 4：AiRun 扣费绑定

- 给 AiRun 增加 charged account 相关事实
- 增加 ledger 写入
- 为失败 / 取消场景增加 refund 路径

### Phase 5：Admin finance 视图

- plan、seats、成员 usage 可见性
- per-user team spend
- top-ups、adjustments、refunds

## 开放问题

- Free 用户到底是否允许在那 1 个免费 Board 上邀请最多 3 个只读 guests，还是连这一步也应该要求 Collaborate。
- Group Workspace 的创建者是否应该只看到 Boards/members/activity，还是也可以看到一种很轻量的 aggregate AI count，但仍不暴露成员级 billing。
- 一个用户是否可以同时加入多个 Team Workspace 并拥有多份 seat-backed 额度；这些 membership 之间的 seat reassignment / downgrade 应该怎么处理。
- Team Workspace 里的 Board 创建者是否应该获得任何额外 dashboard 权限，还是说 dashboard 可见性必须严格限定在 workspace admins/owners。
- 购买的 top-up credits 在降级后是否继续有效，还是只在订阅有效期内存在。
- Enterprise pooled credits 应该是一个全局 workspace 账户，还是按 region / account 拆开。

## 当前建议

先不要直接跳进 S2 的真实 provider charging。应该先把 S1D 的权限收口和 Group-vs-Team workspace 可见性合同做完，再把 S3/S2 接上去。这样可以避免后面围绕“谁付钱”、“谁能看 usage”、“谁能邀请”、“谁能 copy/delete”再返工一轮。

## 当前实现检查点

- 迁移 `20260506_0007` 现在增加 `workspace.kind`、workspace seat assignments、usage rollups、dashboard snapshots 和 AiRun charge ownership fields。
- Request/session context 现在携带 `workspace_kind`，并带有 dev-only compatible `workspace_plan_key`，用于本地 tier-contract 测试。
- 后端和本地前端只读 plan catalogs 现在已覆盖 `collaborate_plus` 和 `team_growth`，不再只覆盖 Start 档。
- 当 Postgres 已配置时，entitlement reads 现在会优先使用数据库事实：先 active Team seat assignment，再通过 credit account 查 active user/workspace subscription，最后才 dev/default fallback。
- AiRun payer summaries 现在会在可用时使用 active database credit account ids，synthetic ids 只作为本地 fallback 保留。
- Team owner/admin seat mutation contracts 现在已支持 list/upsert/revoke，但不会触碰 Stripe，也不会 mutation credit ledger balance。
- Credit ledger read/preflight routes 现在已支持当前 payer account 的 balance、entries、can-run 和 shortfall facts。
- 内部 credit ledger mutation / settlement helpers 现在已存在，覆盖 subscription grants、top-up purchases、带余额不足拒绝的 usage charges、usage refunds 和 admin adjustments。在 payment webhooks、Admin finance writes 和真实 AiRun settlement routes 完成服务端门控之前，它们会刻意只保留在 service-layer。
- 后端只读路由现在已经存在：`/api/v1/billing/me`、`/api/v1/workspaces/current/dashboard` 和 `/api/v1/workspaces/current/entitlement`。
- Mock AiRun responses 现在包含 payer facts：`workspaceKind`、`chargedScope`、`chargedAccountId`、`entitlementSource`、可选 `workspaceSeatId` 和 `payerLabel`。
- Mock AiRun 现在可以在 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 后面选择性演练 credit-ledger usage charging：它会估算 mock credits、拒绝余额不足，并写入 `usage_charge`。默认本地路径仍然不会扣 credits。
- S2/S3 文档现在已经定义了未来的开发者 AI 控制平面，覆盖模型档位、provider routes、pricing-rule versions，以及带审计的 failover/publish flow。
- 前端 `/billing` 现在显示当前登录用户自己的 plan/credits/usage/payer summary。
- 前端 `/team` 现在会根据 workspace kind 显示 Group structure 或 Team usage visibility。
- 这个检查点仍然只是 billing contract：还没有 Stripe、没有 payment-webhook balance mutation、没有付费 seat purchase flow，也没有 provider-cost ledger settlement。

## 下一段实现主线：开发者 AI 控制平面

下一步的 S2/S3 衔接，不应该直接跳成一个写死的单供应商实现。应该先建立统一的后端控制平面，来管理模型档位、供应商线路和 credit 定价。

必须具备的后端实体：

- `model_registry`：稳定的对外产品模型 key，例如 `gpt_image_2`。
- `model_parameter_tiers`：面向产品的档位，例如 `0.5K`、`1K`、`2K`、`4K`、quality 和 output count。
- `model_provider_routes`：provider/model mapping、priority、weight、timeout、retry policy，以及 enabled/health 状态。
- `model_pricing_rules`：按 model/tier 维度版本化的 credit estimate、minimum charge、multiplier/markup 和 provider-cost formula。
- `model_pricing_rule_audit_logs` 和 `provider_route_health_events`：发布历史，以及 route health/failover 事实。

必须具备的 admin/developer 后台界面：

- Models screen：启用 / 禁用产品模型和默认 tiers。
- Tier screen：编辑面向产品的分辨率 / 质量 / 数量档位，以及它们到 provider-native parameters 的映射。
- Routes screen：选择 primary/fallback supplier lines、调整 priority，并禁用不稳定线路。
- Pricing screen：随着 supplier 价格变化发布新的 credit versions，并带 effective date 和 audit trail。
- Cost screen：查看 AiRun 的 route id、pricing rule id、provider cost、charged/refunded credits、margin estimate 和失败情况。

执行规则：

- 前端必须从服务端读取 estimated credit cost，不能本地自己计算。
- 一个产品模型可以映射到多条 supplier lines；用户永远不直接选择底层 provider route。
- Route failover 必须保持一个 AiRun id 和一次最终 settlement outcome。
- Pricing/version changes 只影响未来的新运行；历史运行保留原始 pricing rule id。
- 如果 provider 会暴露 actual usage/cost，服务端必须先估算，再在 response 后做最终 charge/refund settlement。
