# PRD Slice S3: Admin, Billing And Analytics

**Updated**: 2026-05-06
**Mode**: Product slice.

## Goal

Prepare the factual data sources, pricing model and access boundary for Admin, billing and credit usage without pretending revenue automation is already finished.

## Product Requirements

| Area | Requirement | Status |
| --- | --- | --- |
| Admin access | Admin entry is visible only to users with server-side admin role, and `/admin` redirects or hides for everyone else. | First-pass stable |
| Users | First-pass Admin can load a read-only user summary/users surface with recent-account inspection; deeper search and profile tooling remain limited. | First-pass stable |
| Audit | Admin write paths must create an audit log; a helper boundary now exists and first-pass owner-only role mutations now use it, but broad admin write product flows are still pending. | First-pass stable |
| Packaging | Product packaging is `free_canvas`, `collaborate_start`, `collaborate_plus`, `team_start`, `team_growth`, `enterprise`. | Strategy defined |
| Workspace modes | `group_workspace` and `team_workspace` share the same core Board/member surface; Team adds admin-visible usage governance while Group keeps billing private to each member. | Strategy defined |
| Charge ownership | Every AI run clearly resolves which acting member pays. Team adds visibility and governance, not automatic pooled charging. | Strategy defined |
| Credits | Credit account and ledger record grants, usage, refunds, top-ups and admin adjustments. | Planned |
| Billing | Subscription/payment/invoice facts are queryable for revenue views. | Planned |
| AI API calls | Admin can inspect model/provider/latency/status/cost/error by user/run and see which account was charged. | Planned |
| Analytics | Event facts support funnels, retention cohorts, activation metrics and seat/credit usage reporting. | Planned |
| Developer/Admin console | Internal operators can inspect users, workspaces, Boards, subscriptions, credit ledger, AiRuns, provider calls, cost ledger and audit logs through server-gated UI. | Planned |
| Moderation | Assets/prompts/reports can enter review queues later. | Planned |

## Recommended Launch Packaging

These price points are a product strategy target, not a locked finance promise. Final included-credit counts must be re-checked after S2 provider-cost baselines exist.

| Plan | Price target | Who it is for | AI charge owner | Included credits | Key limits / notes |
| --- | --- | --- | --- | --- | --- |
| Free Canvas | `$0` | Solo whiteboard adoption and viral sharing | No included credits; top-up only | `0` monthly included | 1 workspace, 1 active Board, 3 pages, up to 3 shared viewers, no external editors, no team billing |
| Collaborate Start | `$15/user/month` annual target, `$18` monthly target | Freelancers and lightweight collaborating creators | The actor's own credit account | `~1,500` credits per paid user / month target | Uses a `group_workspace` surface. Unlimited Boards/pages for the paid user; invited free editors may edit shared Boards without a paid seat, but get no included monthly AI credits and must top up to run AI. Creator/admin sees only a basic workspace dashboard, not member billing usage. |
| Collaborate Plus | `$20/user/month` annual target, `$25` monthly target | Heavier-AI solo creators and small groups that want more personal AI room | The actor's own credit account | `~2,000` credits per paid user / month target | Same `group_workspace` collaboration model as Collaborate Start, but with a higher personal AI allowance. Member billing/credit usage stays private to each user. |
| Team Start | `$20/seat/month` annual target, `$25` monthly target, `2-15` seats | Teams with moderate AI dependency and shared governance needs | The acting member's own seat-backed account | `~2,500` credits per paid seat / month target | Uses a `team_workspace` surface. Unlimited Boards/pages; team admins can see per-member AI usage, total usage, expiry status, Board count and Board/member inventory, while AI still charges the acting member. |
| Team Growth | `$40/seat/month` annual target, `$45` monthly target, `2-15` seats | AI-heavy teams that rely on the canvas as an operational workspace | The acting member's own seat-backed account | `~5,500` credits per paid seat / month target | Same `team_workspace` model as Team Start, but with a much larger per-seat AI allowance and richer governance/reporting value. |
| Enterprise | Custom | Larger teams and companies | Workspace or contract-defined pooled account | Contract-defined | SSO, SCIM, invoicing, budget controls, regional policy and custom credit packs |

## AI Credit Strategy

- Free Canvas includes no monthly AI credits. Free users may still buy top-up packs, but their unit economics should be worse than paid subscriptions.
- Collaborate Start and Collaborate Plus include monthly personal credit allowances. Whoever clicks `Run` is charged from their own account.
- Invited free editors in Collaborate may edit the canvas without a paid seat, but they receive no monthly included AI credits; to run AI they must spend their own top-up balance or later upgrade to a paid Collaborate tier.
- Team plans assign included AI credits to each paid seat/member account inside the Team Workspace, while AI runs still charge that acting member rather than a pooled workspace wallet.
- Team admins may see member usage and cycle-expiry status, but that visibility does not make the team workspace the payer.
- Team Start should read as the moderate-AI governed team entry point.
- Team Growth should read as the high-AI-dependency team package: much more AI per seat, stronger reporting and stronger governance value.
- Extra AI top-ups should be cheaper on paid plans than on Free, and Team top-ups should be cheaper than Collaborate top-ups.
- In the first pass, purchased top-up credits remain user-held even inside Group and Team workspaces.
- Monthly included credits may expire at the end of the billing cycle. Purchased top-up credits should roll over until spent or until the subscription ends. This mirrors a common AI-credit expectation better than expiring every balance together.

## Permission + Billing Product Rules

- `Can view`: may open shared Boards if allowed, but cannot edit, invite, run AI or copy the Board.
- `Can edit`: may edit/save the Board when the user is an active member or invited editor; AI run still requires separate personal or workspace credit entitlement.
- `Can manage`: may invite/share/rename/change Board visibility and manage Board members, but cannot delete the Board and cannot make owned copies.
- `Owner`: may do everything above plus copy, delete and later transfer ownership.
- Non-team external share recipients stay view-only in the initial product direction.
- Free share links are view-only.
- A user may create and join multiple Group Workspaces; membership, creator/admin authority and Board roles are workspace-scoped.
- Group Workspace creators/admins may assign workspace admins/editors and Board admins/editors, but they do not see other members' billing usage or expiry status.
- Collaborate invited editors may be free users and do not need a paid seat to use the canvas.
- Those free Collaborate editors get no included monthly AI credits; AI usage charges their own top-up balance if available.
- Team Workspace owners/admins use the same core member/Board controls, but additionally see a Team dashboard with per-member AI usage, total usage, expiry status, Board count and Board/member mappings.
- In both Group and Team, AI run charges the acting member's own eligible balance.
- Board-level `Can manage` does not automatically grant Team-level billing visibility unless the same user also has Team workspace admin authority.

## Market Positioning Note

Launch positioning should sit between classic collaboration SaaS and AI-native media tools:

- Collaboration floor today is commonly around the high-single-digit to mid-teens USD per seat per month.
- Business AI/team tooling commonly lands around the low-twenties to low-thirties USD per seat per month.
- TANGENT should undercut enterprise design suites on seat cost while making AI usage explicit and controllable instead of pretending it is “unlimited”.

## Acceptance

- Admin permissions are checked server-side through `admin_roles`.
- Frontend role flags are not authority.
- All admin writes write `admin_audit_logs`.
- Production `/admin` is not exposed before real Auth exists.
- First admin owner bootstrap targets an already verified Auth-backed `tangent_users` row and writes an audit log.
- Workspace role names do not grant global Admin access.
- Every AI run can be explained to a user and to finance as one of:
  - charged to the acting user's personal credits or top-up balance
  - charged to the acting user's assigned Team seat allowance
  - charged to a contract-defined enterprise pooled account
  - rejected because the actor lacks permission or balance
- Invited free Collaborate editors may edit shared Boards without a paid seat, but any AI run must charge only from their own personal balance or fail before execution.
- Group Workspaces do not expose one member's AI credit usage or expiry status to another member.
- Team Workspaces expose per-member AI usage, total usage, expiry status, Board count and Board/member inventory only to Team admins/owners.
- Free users can buy top-up credits, but their price per credit is worse than on paid plans.

## Non-Goals

- No full revenue dashboard before subscriptions/payments exist.
- No production impersonation before audit and permission rules are complete.
- No moderation UI before moderation facts exist.
- No fake “unlimited AI” promise before real provider costs and rate limits are measured.

## Launch-Readiness Note

The first useful Admin checkpoint is intentionally bounded, not empty: server-side access probe, summary/users/workspaces/boards reads, recent audit views and owner-only role grant/revoke are now acceptable at this slice. Broader search, credits, billing, moderation and impersonation still stay blocked until richer admin contracts are complete.

Billing/credits now also have a documented launch direction: free canvas for adoption, group workspaces for self-funded small groups, team workspaces for governed multi-member use with admin usage visibility, and enterprise for procurement/security-heavy customers.

## Bootstrap Note

The first global admin is created outside the public UI through a server-side bootstrap command or manual staging SQL. After that, Admin role grants/revokes move into the Admin backend and require an existing active owner/admin role plus audit logging.

## Current First Pass

- Backend now has a minimal read-only access probe: `/api/v1/admin/me`.
- The first frontend `/admin` checkpoint now consumes `/api/v1/admin/me`, `/api/v1/admin/summary`, `/api/v1/admin/users`, `/api/v1/admin/workspaces`, `/api/v1/admin/boards` and `/api/v1/admin/audit-logs` into a usable bounded admin surface.
- Backend also exposes owner-only role grant/revoke routes and a bootstrap CLI for the first global admin.
- These endpoints are not a full admin panel; they expose access status, summary facts, bounded recent resource lists, recent audit logs and first-pass role-management controls for authenticated global admins.
- Frontend `/admin` access now depends on that server-side answer rather than local role guesses.
- First-pass billing/workspace entitlement surfaces now exist: `/billing` shows the user's own plan, included credits, usage and payer summary; `/team` shows Group structure or Team usage visibility according to workspace kind.
- Backend read-only contracts now exist for `/api/v1/billing/me`, `/api/v1/workspaces/current/dashboard` and `/api/v1/workspaces/current/entitlement`.
- Mock AiRun now returns a payer summary so the UI can explain whether a run charges the actor or a future enterprise workspace pool.
- Full user search, richer audit pagination/filtering, real billing controls, paid seat management, real credit ledger mutations and moderation tooling are still pending.

## 中文完整翻译

# PRD 切片 S3：后台管理、计费与分析

**更新日期**：2026-05-06
**模式**：产品切片。

## 目标

在不假装收入自动化已经完成的前提下，先把后台管理、计费和积分消耗所需的事实数据源、定价模型和访问边界定义清楚。

## 产品要求

| 领域 | 要求 | 状态 |
| --- | --- | --- |
| Admin 访问 | 只有拥有服务端管理员角色的用户才能看到并进入 `/admin`，其他人必须被隐藏或重定向。 | 第一阶段稳定 |
| 用户 | 第一阶段 Admin 可以查看只读用户摘要 / 用户列表界面，并检查近期账号；更深的搜索和档案工具仍然有限。 | 第一阶段稳定 |
| 审计 | 所有 Admin 写操作都必须写入审计日志；当前已有辅助边界，第一阶段 owner-only 的角色变更已接入，但更广泛的写流程仍待完成。 | 第一阶段稳定 |
| 套餐设计 | 产品套餐采用 `free_canvas`、`collaborate_start`、`collaborate_plus`、`team_start`、`team_growth`、`enterprise`。 | 策略已定义 |
| Workspace 形态 | `group_workspace` 和 `team_workspace` 共享同一套核心 Board/成员界面；Team 额外提供管理员可见的 usage 治理，而 Group 保持每个成员计费私有。 | 策略已定义 |
| 扣费归属 | 每次 AI 运行都必须明确判断究竟是哪个操作者成员在付费。Team 带来的是可见性和治理能力，不是自动共用扣费。 | 策略已定义 |
| Credits | 积分账户和流水需要记录发放、消耗、退款、充值和管理员调整。 | 规划中 |
| Billing | 订阅 / 支付 / 发票事实数据需要可查询，以支撑收入视图。 | 规划中 |
| AI API 调用 | Admin 需要能查看模型 / 提供商 / 延迟 / 状态 / 成本 / 错误，以及这次运行究竟扣了哪个账户。 | 规划中 |
| 分析 | 事件事实需要支持漏斗、留存分群、激活指标以及席位 / 积分使用报表。 | 规划中 |
| Developer / Admin console | 内部运营者需要能通过服务端门控 UI 查看 users、workspaces、Boards、subscriptions、credit ledger、AiRuns、provider calls、cost ledger 和 audit logs。 | 规划中 |
| 审核 | 素材 / 提示词 / 举报在后续需要能进入审核队列。 | 规划中 |

## 推荐的上线套餐

这些价格点是产品策略目标，不是锁死的财务承诺。最终包含的 credits 数量，需要在 S2 跑出 provider 成本基线之后重新校验。

| 套餐 | 目标价格 | 适用对象 | AI 扣费归属 | 赠送积分 | 关键限制 / 说明 |
| --- | --- | --- | --- | --- | --- |
| Free Canvas | `$0` | 单人白板获客和传播 | 不赠送 credits，只能充值 | 每月 `0` | 1 个 workspace，1 个 active Board，3 个 pages，最多 3 个共享查看者，不允许外部编辑者，不支持团队计费 |
| Collaborate Start | 年付目标 `$15/用户/月`，月付 `$18` | 自由职业者和轻量协作型创作者 | 扣操作者自己的积分账户 | 每个付费用户每月约 `1,500` credits | 使用 `group_workspace` 形态。付费用户拥有无限 Boards/pages；被邀请的免费编辑者可编辑共享 Board，无需付费席位，但没有月度赠送 AI 积分，想用 AI 需自行充值。创建者/管理员只能看到基础 workspace dashboard，看不到成员计费 usage。 |
| Collaborate Plus | 年付目标 `$20/用户/月`，月付 `$25` | 更依赖 AI 的单人创作者和小型协作组 | 扣操作者自己的积分账户 | 每个付费用户每月约 `2,000` credits | 与 Collaborate Start 共享同一套 `group_workspace` 协作模式，但个人 AI 额度更高。成员的 billing / credit usage 仍然只对成员自己可见。 |
| Team Start | 年付目标 `$20/席位/月`，月付 `$25`，`2-15` 席位 | 对 AI 有中度依赖、需要治理能力的团队 | 扣当前操作者自己的 seat-backed 账户 | 每席位每月约 `2,500` credits | 使用 `team_workspace` 形态。无限 Boards/pages；团队管理员可以看到每个成员的 AI usage、总 usage、到期状态、Board 数量以及 Board/成员清单，但 AI 仍然扣当前操作者自己。 |
| Team Growth | 年付目标 `$40/席位/月`，月付 `$45`，`2-15` 席位 | 把 AI 画布当作日常工作台的高 AI 依赖团队 | 扣当前操作者自己的 seat-backed 账户 | 每席位每月约 `5,500` credits | 与 Team Start 共享同一套 `team_workspace` 模型，但每席位 AI 配额更大，治理 / 报表价值更强。 |
| Enterprise | 定制 | 中大型企业 | 扣 workspace 共用账户或合同约定账户 | 按合同定义 | SSO、SCIM、开票、预算控制、区域策略和定制 credits 包 |

## AI 积分策略

- Free Canvas 不包含月度 AI credits。Free 用户仍然可以购买充值包，但其单位经济性必须差于付费订阅。
- Collaborate Start 和 Collaborate Plus 都包含月度个人 credits 额度；谁点击 `Run`，就从谁自己的账户扣费。
- Collaborate 中被邀请的免费编辑者可以不买席位直接编辑画布，但他们没有月度赠送 AI 积分；如果要运行 AI，只能先消耗自己的充值余额，或者后续升级为付费 Collaborate 档位。
- Team 套餐会把赠送 AI credits 绑定到每个付费席位 / 成员账户上；运行 AI 时仍然扣当前操作者，而不是扣一个共用 workspace 钱包。
- Team 管理员可以看到成员 usage 和账期到期状态，但这种可见性并不会让 Team workspace 自动变成付款方。
- Team Start 应该被理解为“中度 AI 依赖”的治理型团队入门档。
- Team Growth 应该被理解为“高 AI 依赖”的团队档：每席位 AI 更多、报表更强，而且是给高频使用团队准备的更强方案。
- 额外 AI 充值在付费套餐上应当比 Free 更便宜，Team 套餐的充值又应当比 Collaborate 更便宜。
- 在第一阶段，额外购买的 top-up credits 仍然归属于用户自己，即使这个用户身处 Group 或 Team workspace 中也是如此。
- 月度赠送的 credits 可以在账期结束时过期；额外购买的充值 credits 应当一直保留到被消耗完，或订阅结束为止。这样更符合 AI credits 的通行预期，而不是让所有余额一起清零。

## 权限 + 计费产品规则

- `Can view`：可以打开共享 Board，但不能编辑、邀请、运行 AI 或复制 Board。
- `Can edit`：当用户是活跃成员或被邀请的编辑者时，可以编辑 / 保存 Board；但运行 AI 仍然需要独立的个人或 workspace 积分资格。
- `Can manage`：可以邀请 / 分享 / 重命名 / 修改 Board 可见性，并管理 Board 成员，但不能删除 Board，也不能复制出新的 owned copy。
- `Owner`：具备以上全部能力，并且可以复制、删除，以及未来可支持转移所有权。
- 不属于 team 的外部分享对象，在初始产品方向中保持只读。
- Free 分享链接是只读。
- 一个用户可以创建并加入多个 Group Workspace；成员身份、创建者 / 管理员权限以及 Board 角色都只在各自的 workspace 内生效。
- Group Workspace 的创建者 / 管理员可以分配 workspace admins/editors 和 Board admins/editors，但他们看不到其他成员的 billing usage 或到期状态。
- Collaborate 中被邀请的编辑者可以是免费用户，不需要付费席位也能使用画布。
- 这些免费的 Collaborate 编辑者没有月度赠送 AI 积分；如果有充值余额，AI 使用从他们自己的余额扣。
- Team Workspace 的 owners/admins 使用同样的核心成员 / Board 管理能力，但额外会看到一个 Team dashboard，展示每个成员的 AI usage、总 usage、到期状态、Board 数量以及 Board/成员映射。
- 无论是 Group 还是 Team，AI 运行都扣当前操作者自己的可用余额。
- Board 级别的 `Can manage` 并不会自动授予 Team 级别的 billing 可见性；只有同时具备 Team workspace admin 权限的人才能看到这些数据。

## 市场定位说明

上线时的定价位置应该落在传统协作 SaaS 和 AI 原生媒体工具之间：

- 当前协作产品的价格底线通常落在个位数到十几美元每席位每月。
- 面向团队的 AI 工具通常落在二十几到三十几美元每席位每月。
- TANGENT 应该在席位价格上低于高价企业设计套件，但同时在 AI 使用上保持明确、可控，而不是假装“无限制”。

## 验收标准

- Admin 权限必须通过服务端 `admin_roles` 检查。
- 前端角色 flag 不能成为权限依据。
- 所有 Admin 写操作都必须写入 `admin_audit_logs`。
- 在真实 Auth 存在之前，生产环境不能暴露 `/admin`。
- 第一个 admin owner bootstrap 必须面向已经验证过的 Auth-backed `tangent_users` 记录，并写入审计日志。
- Workspace 的角色名称不能自动授予全局 Admin 权限。
- 每次 AI 运行最终都必须能够向用户和财务解释为以下三种之一：
  - 扣当前操作者自己的个人 credits 或 top-up 余额
  - 扣当前操作者自己被分配到的 Team seat 额度
  - 扣合同定义的 enterprise 共用账户
  - 因为操作者缺少权限或余额而被拒绝
- 被邀请的免费 Collaborate 编辑者可以不买席位直接编辑共享 Board，但如果运行 AI，就只能从他们自己的个人余额扣费，否则必须在执行前失败。
- Group Workspace 不能把一个成员的 AI usage 或到期状态暴露给另一个成员。
- Team Workspace 只向 Team admins/owners 展示成员级 usage、总 usage、到期状态、Board 数量和 Board/成员清单。
- Free 用户可以购买 top-up credits，但每 credit 单价必须劣于付费套餐。

## 非目标

- 在订阅 / 支付事实数据存在之前，不做完整收入仪表盘。
- 在审计和权限规则完整之前，不做生产级 impersonation。
- 在审核事实数据存在之前，不做 moderation UI。
- 在真实 provider 成本和速率限制测清楚之前，不做“无限 AI”承诺。

## 上线准备说明

当前第一个有用的 Admin checkpoint 是刻意收敛的，而不是空壳：服务端访问探针、summary / users / workspaces / boards 读取、近期 audit 视图，以及 owner-only 的角色授予 / 撤销，已经可以作为本切片的可接受结果。更广泛的搜索、credits、billing、moderation 和 impersonation 仍需等待更丰富的 Admin 合同。

现在，billing / credits 也已经有明确的上线方向：free canvas 用于获客，group workspace 用于小团队各自自费协作，team workspace 用于带管理员 usage 可见性的多人治理场景，enterprise 用于有采购和安全要求的客户。

## Bootstrap 说明

第一个全局管理员不是通过公开 UI 创建，而是通过服务端 bootstrap 命令或手工 staging SQL 创建。之后，Admin 角色授予 / 撤销才进入 Admin 后端流程，并要求调用者已经是 active owner / admin，同时必须写审计日志。

## 当前第一阶段

- 后端已有最小只读访问探针：`/api/v1/admin/me`。
- 第一阶段前端 `/admin` 现在会消费 `/api/v1/admin/me`、`/api/v1/admin/summary`、`/api/v1/admin/users`、`/api/v1/admin/workspaces`、`/api/v1/admin/boards` 和 `/api/v1/admin/audit-logs`，从而形成一个可用但边界有限的 admin 界面。
- 后端也已经暴露 owner-only 的角色授予 / 撤销接口，以及首位全局管理员的 bootstrap CLI。
- 这些接口还不是完整管理后台；它们只提供访问状态、摘要事实、有限的近期资源列表、近期审计日志，以及第一阶段的角色管理控件。
- 前端 `/admin` 的访问现在依赖服务端返回，而不是浏览器本地猜测角色。
- 第一阶段 billing / workspace entitlement 界面现在已经存在：`/billing` 显示当前用户自己的 plan、included credits、usage 和 payer summary；`/team` 根据 workspace kind 显示 Group 结构视图或 Team usage 可见性视图。
- 后端只读合同现在已经存在：`/api/v1/billing/me`、`/api/v1/workspaces/current/dashboard` 和 `/api/v1/workspaces/current/entitlement`。
- Mock AiRun 现在返回 payer summary，因此 UI 可以解释一次运行会扣当前操作者，还是未来 enterprise workspace pool。
- 更完整的用户搜索、更丰富的审计分页 / 筛选、真实 billing 控制、付费 seat 管理、真实 credit ledger mutation 和 moderation 工具仍待后续完成。
