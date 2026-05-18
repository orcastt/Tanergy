# S3 Team/Group/Board/Billing 全链路审计与收口计划

**创建日期**：2026-05-18
**状态**：Active tactical audit plan；用于指导下一轮实现，不是替代 `s3-team-group-wallets-membership-billing-plan-2026-05-08.md`。
**Owner slice**：S3 Billing / Admin Finance，关联 S4 Collaboration、S2 AiRun Billing、S1C Auth/Admin。
**目标**：从真实用户和后台管理员视角，把 Team、Group、Board、Seat、Top-up、Subscription、Credit、Admin Manage 和 AI 扣费链路一次性梳理清楚，避免继续出现“局部能点通、全链路不一致”的漏洞。

## 0. 结论先行

这条链路必须按下面的主规则收口：

1. **Team 是工作区级商业实体**：Team subscription 属于 Team workspace；Team wallet 属于 Team workspace；Team AI 消耗扣 Team wallet；seat 是 Team 成员使用 Team 权益的资格。
2. **Group 是个人 Collaborate 计划驱动的协作空间**：Group workspace 没有 pooled wallet；Group 里每个成员跑 AI 都扣自己的 personal wallet；Group owner 的 Collaborate plan 只决定他能开多少 Group、Group 能容纳多少成员、能否继续保留 Group。
3. **Board 治理权和 workspace 角色必须分清**：Team/Group workspace owner 对该 workspace 下所有 board 有最终治理权；admin 可以协作管理，但不能在 owner 不知情的情况下继承、转移或永久删除 board。
4. **积分只能来自 ledger，不允许直接改余额**：所有 grant、top-up、usage charge、refund、revoke、admin adjustment 都必须写 `credit_ledger`，余额由 ledger 汇总得出。
5. **后台 Admin 不是另一套业务系统**：Admin Finance 可以手工开通、删除、冻结、top-up、扣减、add seat、管理 board，但必须调用和用户侧一致的服务层逻辑，并写 audit log。
6. **当前没有支付系统时，用户侧 subscription 不能点了就激活**：Pricing/Billing 可以展示套餐和 CTA，但真正 activation 只能由 Admin Finance 手动完成，直到 Stripe/Paddle/Creem webhook 成为生产权威。
7. **删除不是转移**：Team/Group plan 或 workspace 删除后，board 不允许转移给 admin 或其他成员；过期客户端不能继续保存并把 board “复活”。

## 1. 需要统一的对象模型

### 1.1 User

- 一个真实登录用户。
- 可以拥有 personal wallet。
- 可以拥有一个 active Collaborate subscription。
- 可以拥有多个 Team workspaces。
- 可以加入多个 Team / Group workspaces。

### 1.2 Workspace

当前应只保留三类产品语义：

- `solo/private workspace`：个人私有空间，只显示个人信息，不需要成员邀请、invite link、owner/editor/viewer 配置。
- `team_workspace`：商业团队空间，有 Team subscription、Team wallet、seat capacity、member roles。
- `group_workspace`：个人 Collaborate 计划下的协作空间，无 Group wallet，成员跑 AI 扣自己的 personal wallet。

### 1.3 Subscription

订阅必须是 entitlement 的源头之一，但不能直接等同于钱包余额。

- Collaborate subscription：`owner_type=user`，`owner_id=user_id`，`plan_family=collaborate`。
- Team subscription：`owner_type=workspace`，`owner_id=team_workspace_id`，`plan_family=team`。
- Free plan 不应该伪装成付费 subscription；它应由 entitlement service 显式计算。
- `active/trialing` 才能产生可用权益；`paused/frozen/canceled/deleted/expired` 都必须阻断新增权益和写操作。

### 1.4 Credit Account / Credit Ledger

- Personal wallet：`owner_type=user`，用于个人、Private、Group AI 消耗。
- Team wallet：`owner_type=workspace`，用于 Team workspace 内 AI 消耗。
- Ledger reason 必须覆盖：`subscription_grant`、`topup_purchase`、`usage_charge`、`usage_refund`、`subscription_revoke`、`admin_adjustment`。
- 不允许 UI 或 Admin API 直接写 balance 字段。

### 1.5 Seat Assignment

Seat 只属于 Team。

- Team owner 必须自动占用一个 active seat。
- Team admin/editor/viewer 是否占 seat：P0 统一为“加入 Team workspace 并可使用 Team 权益的成员都占 seat”，避免 viewer 免费占用 Team 资源的灰区。
- Remove member 必须 revoke seat。
- Add seat 必须增加 subscription seat_capacity，并按规则 grant 对应 Team wallet credits。

### 1.6 Board

Board 需要同时记录：

- `workspace_id`
- `created_by_user_id`
- `governance_owner_user_id` 或等价的 owner 解析规则
- `deleted_at`
- `archived/frozen` 状态
- board members / board permissions

Team/Group 下的 board 不应该只靠创建者决定最终治理权，否则 admin 创建 board 后 owner 可能看不到，或者 owner 删除后 admin 获得不该有的继承权。

### 1.7 Invite

- Team invite：受 Team active subscription 和 remaining seats 限制。
- Group invite：受 Group owner 当前 Collaborate entitlement 限制。
- Invite link 的 role 必须明确：viewer / editor / admin。
- Email 是 optional；当前不能真的发邮件时，UI 必须以 generate invite link 为主，邮箱输入只作为备注或未来发送入口。

### 1.8 Admin Role

后台权限先收敛为两类：

- `Admin`：用户、workspace、board、访问控制、运营治理。
- `Finance`：plan、wallet、top-up、deduct、seat、subscription、usage、invoice/payment facts。

不再扩展很多细碎分类；复杂度放在 audit log 和服务层权限上。

## 2. Team 业务链路

### 2.1 Team Plan 开通

入口：

- 当前 beta：Admin Finance 手动开通。
- 未来：支付 checkout + webhook 完成后自动开通。

必须发生的事情：

1. 创建或选择 Team workspace。
2. 写入 Team subscription：plan key、billing interval、seat_capacity、period、billing owner。
3. 创建 Team wallet。
4. 把 owner 加入 workspace，并设为 owner。
5. 给 owner 自动分配 seat。
6. 写入 subscription included credits 到 Team wallet。
7. 写 audit log。
8. 用户侧 `/billing`、`/usage`、Team settings、Admin detail 读取同一个 entitlement read model。

必须禁止：

- 用户在 `/billing` 点 plan 直接变 active。
- Team workspace 没有 active Team subscription 却能邀请成员、add seat 或跑 Team AI。
- Team owner 未占 seat。
- Admin 手工写 subscription 但没有创建 wallet / seat / audit。

### 2.2 Team Top-up

Top-up 是购买额外 credits，不是 subscription grant。

规则：

- Team top-up 进入 Team wallet。
- Top-up 不应因为 plan 删除被静默没收。
- 如果 Team 被删除，剩余 top-up credits 进入 frozen balance，由 Admin 做 refund / transfer / manual adjustment 决策。
- 如果是欺诈、退款、chargeback，必须写 `usage_refund` 或 `admin_adjustment`，不能直接改余额。

用户场景：

- Owner 买了 top-up，member 跑 AI 可以消耗 Team wallet。
- Plan 被暂停时，Top-up 余额还在，但 AI run 不能继续消耗，除非 Admin 解冻。
- Workspace 删除后，旧 tab 不能继续跑 AI 让 top-up 被消耗。

### 2.3 Team Add Seat

Add seat 不是单独创建成员，它只增加容量。

流程：

1. 检查 active Team subscription。
2. 检查 plan 的 `seat_max`。
3. 检查当前 active seat assignments。
4. 新容量不能小于已分配 seat 数。
5. 完成 payment/admin operation 后，增加 `seat_capacity`。
6. 按 `included_credits_for_plan * added_seat_count` 写 Team wallet `subscription_grant`。
7. 写 audit log。

必须处理的边界：

- 两个 admin 同时 add seat：需要事务锁或幂等 operation id。
- Add seat 超过 plan max：硬拦截。
- 当前 seat_capacity 已被占满：invite accept 应提示需要 add seat，而不是静默失败。
- Add seat 后未邀请成员：容量保留，但不会产生 workspace member。
- Downgrade 到更低 seat：必须先移除成员或由 owner 明确选择要 revoke 哪些 seats；不能自动随机踢人。

### 2.4 Team Invite / Accept

Generate invite link 为主流程。

创建 invite：

- owner/admin 可以创建。
- role 可选：viewer/editor/admin。
- optional email 只用于标记目标，当前不能假装已经发邮件。
- 创建时可以允许不填 email。

接受 invite：

1. 校验 token 未过期、未撤销、未使用或符合多次使用规则。
2. 校验 Team subscription active。
3. 校验 remaining seat capacity。
4. upsert workspace member。
5. 分配 seat assignment。
6. 若用户已是成员，更新 role 但不能绕过 seat cap。
7. 写 audit log。

风险：

- 如果 invite 创建时有 seat，接受时 seat 已满，必须接受失败并给出可理解提示。
- 如果 Team 被冻结或删除，旧 invite 立即失效。

### 2.5 Team Remove Member

规则：

- owner 可以移除 admin/editor/viewer。
- admin 可以移除 editor/viewer，但不能移除 owner。
- 移除成员必须 revoke seat。
- 移除成员必须撤销该成员对 Team boards 的访问。
- 如果被移除成员在旧浏览器 tab 中，下一次 board save / collaboration heartbeat / AI run 必须返回 no access。

不能发生：

- member 被移除后仍然能消耗 Team wallet。
- member 被移除后自己创建的 board 变成孤儿或变成 admin 拥有。
- owner 被 admin 移除。

### 2.6 Team Plan 冻结、取消、删除

需要区分三个动作：

| 动作 | 用户理解 | 系统行为 |
| --- | --- | --- |
| Freeze | 暂停使用，可能恢复 | subscription 标记 paused/frozen；禁止 invite/add seat/AI write；boards read-only 或不可打开；credits 不扣除 |
| Cancel at period end | 到期后不续费 | period 结束前保持权益；结束后进入 frozen；不再 grant renewal credits |
| Delete plan | 后台确认移除付费计划 | subscription deleted/canceled；workspace soft-delete 或 billing-frozen；boards soft-delete；subscription included credits revoke；top-up frozen 待人工处理 |

P0 beta 推荐：

- Admin “Delete Team Plan” = destructive operation，必须二次确认和 reason。
- 执行后 Team workspace 不再出现在普通用户列表。
- 该 workspace 下 boards 全部 `deleted_at` soft-delete。
- 协同 room 立即失效。
- stale client 保存时返回 board not found / workspace inactive，不能重新插入 board。
- Revoke 只针对该 subscription 尚未消耗的 `subscription_grant`，不能误扣 top-up。

## 3. Group 业务链路

### 3.1 Group 和 Team 的根本区别

Group 容易让用户误解，必须在 Pricing / Terms / Plan Explanation 页面写清楚：

- Group 不是公司钱包。
- Group 没有 pooled credits。
- Group 的成员跑 AI，扣成员自己的 personal wallet。
- Group owner 的 Collaborate plan 决定他能开多少 Group、每个 Group 能有多少成员、Group 是否继续可用。
- Group admin 只管理协作结构，不能看 owner 或其他成员的 billing。

### 3.2 Group Plan 开通

这里的 “Group Plan” 实际上是用户的 Collaborate plan。

流程：

1. Admin Finance 给 user 开通 Collaborate Start / Plus，或未来由 checkout/webhook 完成。
2. 写 user subscription。
3. 给 user personal wallet 写 subscription grant。
4. 更新 entitlement read model。
5. 用户可以创建符合 plan 上限的 Group workspace。

必须禁止：

- Group workspace 绑定一个不存在或过期的 Collaborate plan 后仍可继续邀请。
- Group admin 看到 owner personal wallet。
- Group AI 消耗扣 owner 钱包；应扣 actor personal wallet。

### 3.3 Group 创建

创建时检查：

- user 的 Collaborate entitlement。
- group_workspace_limit。
- 如果 Free 允许创建有限 Group，要明确 free limit；如果不允许，直接提示升级。

创建后：

- owner 加入 workspace owner。
- 不创建 Group wallet。
- 不创建 seat assignments。

### 3.4 Group Invite / Accept

创建 invite：

- owner/admin 可以创建，role 为 viewer/editor/admin。
- 不填邮箱也能生成 link。

接受 invite：

1. 校验 token。
2. 校验 Group owner 的 Collaborate plan 仍 active。
3. 校验 group_member_limit。
4. upsert workspace member。
5. 不创建 seat。
6. 不 grant credits。

当前需重点排查：

- 不能用固定 `collaborate_plus` 去算所有 Group 的 member cap；必须按 Group owner 当前实际 plan key 计算。

### 3.5 Group Remove Member

规则：

- owner 可移除 admin/editor/viewer。
- admin 可移除 editor/viewer，但不能移除 owner。
- 移除后撤销 board access。
- 移除后旧 tab 不能继续保存 board 或跑 AI。

### 3.6 Group Plan 删除

删除 Collaborate plan 时必须清楚区分：

- 删除的是 owner 的 Collaborate subscription。
- 删除的不是其他成员的 personal wallet。
- 删除的不是其他成员自己的 subscription。

推荐 P0 beta 规则：

1. Owner 的 Collaborate subscription 变 deleted/canceled。
2. Revoke owner 该 subscription 尚未消耗的 included credits。
3. 不扣 owner 的 top-up credits，除非 Admin 另做 refund/fraud/manual adjustment。
4. Owner 名下 Group workspaces 进入 billing-frozen 或 soft-delete。
5. Group boards soft-delete 或至少禁止打开/保存；推荐与 Team destructive delete 保持一致：Admin delete plan 时 soft-delete boards。
6. 成员旧 tab 保存必须失败，不能把 board 重新写回来。

## 4. Board 治理链路

### 4.1 Private Board

Private board 只属于个人。

- Board manage 页面只显示个人信息。
- 不显示 invite member。
- 不显示 invite link。
- 不显示 owner/editor/viewer 权限管理。
- 不显示与 private board 无关的 Team/Group 设置。

### 4.2 Team/Group Board 创建

推荐收口规则：

- `created_by_user_id` = 实际点击创建的人。
- `governance_owner_user_id` = workspace owner，或通过 workspace owner 动态解析。
- workspace owner 自动拥有 board owner permission。
- admin/editor 创建的 board，owner 必须能看到、管理和删除。
- board creator 可以获得 editor/admin 权限，但不能让 workspace owner 看不到。

这样可以解决：

- admin 创建 board 后 owner 看不见。
- owner 删除 board 后权限转移给 admin。
- 删除 workspace owner 后 board 变孤儿。

### 4.3 Board 删除

规则：

- Team/Group board：只有 workspace owner 可以做 destructive delete。
- admin 可以管理协作、邀请、内容，但不能永久删除或继承 owner。
- owner delete = soft-delete board + revoke board members + collaboration room invalidation。
- 删除不触发 owner transfer。
- stale client 保存必须返回不存在，不能 upsert 复活。

需要测试：

- 用户 A(owner) 删除 board，用户 B(admin/editor/viewer) 正在打开该 board。
- B 应看到 board 不存在/已被删除弹窗，然后退出。
- B 不能继续保存。
- B 刷新后 board 不再出现。
- DB 中 owner_id 不被改成 B。

### 4.4 Board Assign / Manage

Assign board 必须经过 workspace membership：

- 不能把 board assign 给不是该 workspace member 的用户。
- 不能通过 board assign 绕过 Team seat 或 Group member cap。
- Team 中被 remove member 的用户，其 board access 自动撤销。
- Group 中被 remove member 的用户，其 board access 自动撤销。

### 4.5 Page 上限

每个 Team/Group board 内 Page 上限为 10。

- 创建第 11 页时必须弹统一 UI modal。
- 限制必须在前后端都有。
- stale client 或 API 直接请求不能绕过。

## 5. AI 使用和积分消耗链路

### 5.1 Payer Resolver

统一规则：

```text
Private / Free / Solo       -> actor personal wallet
Group / Collaborate         -> actor personal wallet
Team                        -> active Team wallet
Enterprise                  -> enterprise pool or explicit contract
```

### 5.2 AI Run 前置检查

Provider 调用前必须完成：

1. 校验 user 登录。
2. 校验 workspace membership。
3. 校验 board permission。
4. 校验 workspace / subscription 未冻结、未删除。
5. 解析 payer account。
6. quote 价格。
7. 检查余额。
8. 记录 run intent。

余额不足或权限不足时必须在 provider 调用前失败。

### 5.3 AI Run 结算

- 成功：写 `usage_charge`。
- 失败且已预扣：写 `usage_refund`。
- polling/cancel/retry 不能切换 charged account。
- Team run 永远不能因为 actor 有 personal credits 就 fallback 到 personal wallet。
- Group run 永远不能扣 owner wallet，除非 owner 自己是 actor。

### 5.4 当前必须补齐的风险

- 所有 Image Gen / Image Gen 4 / Analysis / Merge Capture route 是否都走统一 AiRun contract。
- JIEKOU / Nano Banana 2 等模型 route 是否都使用 server-side pricing 和 payer resolver。
- 前端节点不能持有 provider secret，也不能绕过 server route 直接调用 provider。
- 失败重试不能重复扣费。
- 旧 tab 在 workspace deleted 后不能继续发起 run。

## 6. Admin Finance / Operator 链路

### 6.1 Admin 用户详情页应展示的统一读模型

一个 user detail bundle 应该包含：

- User 基本信息。
- Personal wallet balance。
- Collaborate subscription。
- 用户拥有的 Groups。
- 用户加入的 Groups。
- 用户拥有的 Teams。
- 用户加入的 Teams。
- 每个 Team 的 subscription、seat capacity、used seats、Team wallet balance。
- 用户相关 boards。
- 最近 billing history / ledger / AI usage。
- 当前 admin 可执行操作。

这份 read model 必须和用户 `/billing`、`/usage` 使用同一套 plan catalog / entitlement service，否则会出现 Finance 改了数值但 Subscription 页面不变。

### 6.2 Admin 可写操作

Team：

- Assign / renew Team plan。
- Freeze / unfreeze Team plan。
- Delete Team plan。
- Add seat。
- Remove seat / revoke member。
- Team wallet top-up。
- Team wallet deduct。
- Delete / freeze Team workspace。
- Manage Team boards。

Group / Collaborate：

- Assign / renew Collaborate plan。
- Freeze / unfreeze Collaborate plan。
- Delete Collaborate plan。
- Personal wallet top-up。
- Personal wallet deduct。
- Freeze / delete owned Group workspaces。
- Manage Group boards。

每个 write 必须：

- 校验 admin role。
- 要求 reason。
- 生成 idempotency/operation id。
- 调用同一服务层。
- 写 audit log。
- 返回变更后的 entitlement read model。

### 6.3 Admin 不应做的事

- 不应直接改 DB balance。
- 不应只改 subscription 但不处理 workspace、board、credit、seat。
- 不应在 Group Plan 页面隐藏 manage 能力；Group Plan 也需要和 Team 一样能删除、冻结、top-up、deduct、查看 owned/joined groups。
- 不应让 Admin UI 的 plan catalog 和用户 Pricing/Billing 页面各自有一份常量。

## 7. 用户视角异常场景清单

| 场景 | 期望行为 | 必须测试 |
| --- | --- | --- |
| Team owner 开通 Team 后立刻创建 board | owner 可见，Team wallet 已创建 | subscription、wallet、owner seat、board owner |
| Team admin 创建 board | workspace owner 也能看到并拥有治理权 | created_by 与 governance owner 分离 |
| Team admin 删除 board | destructive delete 被拒绝 | admin cannot delete |
| Team owner 删除 board，editor 正在编辑 | editor 弹出 board deleted，保存失败 | stale client cannot recreate |
| Team owner 删除 Team plan | workspace/boards 不再可用，Team subscription grant 扣回 | board list、collab room、ledger |
| Team top-up 后删除 Team plan | top-up 不静默没收，进入 frozen/manual handling | ledger reason 区分 |
| Team add seat 到上限 | 到上限后再 add 失败 | seat max |
| Team invite link 无邮箱 | 可以生成 link | invite UI/API |
| Team invite accept 时 seat 已满 | 失败并提示 add seat | accept-time capacity |
| Team member 被移除 | seat revoke，board access revoke，AI run 拒绝 | membership + payer |
| Group owner 删除 Collaborate plan | owned Groups 冻结/soft-delete，owner subscription grant 扣回 | Group list、board access |
| Group member 跑 AI | 扣 member personal wallet | payer resolver |
| Group admin 查看 billing | 不能看到 owner/其他成员 wallet | privacy boundary |
| Group cap 不同 plan | 按 owner 实际 plan 计算 | 不使用固定 plus |
| Private board manage | 不显示邀请/成员/权限 | UI cleanup |
| Page 超过 10 | 统一弹窗，API 拒绝 | frontend + backend |
| Admin Finance 改 plan catalog | Pricing/Billing/Admin 同步显示 | shared read model |
| 两个 Admin 同时 add seat/top-up/delete | 幂等且不会重复 grant/revoke | transaction + operation id |
| AI route provider 失败 | 不重复扣费，必要时 refund | settlement |

## 8. 当前已知漏洞与整改方向

### 8.1 Group cap 可能没有按实际 plan 计算

风险：

- 如果代码用固定 `collaborate_plus` 计算 member cap，Start 用户会获得 Plus 容量。

整改：

- Group invite accept 和 Group create 都必须先解析 owner 当前 active Collaborate plan，再调用 `group_member_limit_for_plan(plan_key)`。

### 8.2 Plan 删除语义不统一

风险：

- Admin 删除 Team/Group plan 后，workspace boards 还留在普通列表。
- stale client 继续保存，把 soft-deleted board 复活。
- credits 扣错：把 top-up 当成 subscription grant 扣掉，或完全不扣 subscription grant。

整改：

- 引入明确 lifecycle service：`freeze_plan`、`cancel_at_period_end`、`delete_plan`。
- `delete_plan` 必须联动 subscription、workspace、board、collab room、seat、credit revoke、audit。

### 8.3 Board owner/admin 治理不清

风险：

- admin 创建 board 后 workspace owner 看不到。
- owner 删除 board 后 admin 继承 board。
- admin 可以删除不该删除的 board。

整改：

- Workspace owner 是 Team/Group board governance owner。
- Board creator 和 governance owner 分开。
- destructive delete owner-only。
- delete 不产生 transfer。

### 8.4 Admin Finance 和用户 Subscription 可能未统一

风险：

- Admin 修改 plan、credit、seat 后，用户 `/billing` 不更新。
- Pricing 页面读取 live catalog，但 subscription entitlement 还读旧常量。

整改：

- 建立 `EntitlementReadService`。
- 用户 Billing、Usage、Admin detail、Pricing 全部读同一服务或同一 plan catalog overlay。

### 8.5 AI 使用积分消耗还没有全链路验收

风险：

- 某些节点/route 没经过 payer resolver。
- Provider 调用失败导致重复扣费。
- Team workspace deleted 后旧 tab 仍能发起 AI run。

整改：

- 所有 AI route 增加 contract tests。
- Provider call 前统一 preflight。
- Settlement 写 ledger，失败 refund。

## 9. 推荐实现顺序

### Phase 0：先写合同测试

先不要继续堆 UI 补丁，先把规则写成 tests：

- Team plan create/delete/freeze。
- Group plan create/delete/freeze。
- Team add seat/top-up/remove member。
- Group invite cap。
- Board owner/admin delete/stale save。
- Admin Finance operation audit。
- AI payer resolver / insufficient credits。

验收目标：

- 测试失败能准确指出当前漏洞。
- 每个漏洞对应一个服务层修复点，不把逻辑散在 UI。

### Phase 1：建立 lifecycle services

建议拆出：

- `TeamPlanLifecycleService`
- `GroupPlanLifecycleService`
- `WorkspaceLifecycleService`
- `BoardGovernanceService`
- `CreditLedgerService`
- `EntitlementReadService`
- `AdminAuditService`

原则：

- Admin UI 和用户支付 webhook 都调用同一服务。
- 不允许 Admin route 直接拼 SQL 完成复杂业务。

### Phase 2：收口 Team/Group plan delete

优先修：

- Plan delete 后 workspace/boards 的状态。
- Stale client board save reject。
- Seat revoke。
- Subscription grant revoke。
- Top-up frozen/manual handling。

这是当前最危险的漏洞，因为它会让“被删除的商业实体继续存在”。

### Phase 3：收口 Board owner/admin/assign

优先修：

- Admin 创建 board，workspace owner 自动可见。
- Owner destructive delete for all。
- Admin cannot destructive delete。
- Remove member 后 board access revoke。
- Page 10 limit 前后端一致。

### Phase 4：收口 Admin Finance 与 Subscription UI 联动

优先修：

- Admin detail read model。
- Group Plan manage 能力补齐。
- Team/Group plan catalog、seat、credit、price 在用户侧和 admin 侧一致。
- 用户侧 paid plan CTA 不激活，只展示联系/等待开通状态。

### Phase 5：AI usage billing 真扣费验收

优先修：

- Image Gen / Image Gen 4 / Analysis / Merge Capture 全部走 payer resolver。
- JIEKOU / Nano Banana 2 route 使用服务端 pricing。
- quote -> preflight -> provider -> settlement -> ledger 全链路。
- insufficient credits before provider。

### Phase 6：Staging 双用户验收

用真实 staging 做：

- owner/admin/editor/viewer 四角色。
- 两个浏览器同时打开 board。
- owner 删除 board。
- admin 创建 board。
- member 被移除。
- Team plan 删除。
- Group plan 删除。
- Admin Finance 操作后用户 Billing/Usage 刷新。

## 10. 下一轮开发的首要任务

建议下一轮按这个顺序做，不要跳：

1. **合同测试先行**：把上面的 Team/Group/Board/Credit/Admin/AI 场景写成 backend tests 和少量 frontend tests。
2. **修 Group cap**：按 owner 实际 Collaborate plan 计算，不允许固定 Plus。
3. **修 Plan delete lifecycle**：Team/Group plan 删除必须联动 workspace、boards、seats、credits、stale clients。
4. **修 Board governance**：workspace owner 统一治理，admin 不继承、不 destructive delete。
5. **统一 Admin/User entitlement read model**：Finance 改动必须同步反映到 Subscription / Usage。
6. **接 AI usage 真扣费**：所有 provider route 走 quote/preflight/settlement。

## 11. 不在这轮文档内解决的内容

这些不要混进本轮实现：

- Stripe / Paddle / Creem 的生产税务和 MoR 选择。
- 真实 invoice / VAT / GST 报税链路。
- Enterprise contract 自定义钱包。
- 完整邮件发送 invite。
- 多区域 Redis/Yjs 深度协同架构。

本轮目标是先把 Tanergy 内部的 Team / Group / Board / Credit / Admin 业务链路变成一套一致的、可测试的、不会互相打架的规则。
