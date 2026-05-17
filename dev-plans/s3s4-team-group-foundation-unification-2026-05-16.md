# S3/S4 Team / Group / Free / Invite / Billing / Collaboration 统一基线

**创建日期**: 2026-05-16  
**状态**: Confirmed baseline，已于 2026-05-16 完成产品口径确认；截至 2026-05-17，`Subscription / Usage` 第一轮重构、admin plan catalog 控制面整理、Team / Group settings/invite 规则说明、AI/control-plane 薄化和部分协同桥接拆分已开始落地，当前仍待真实 staging/browser/live-provider 验收  
**适用切片**: S3 Admin/Billing/Analytics, S4 Collaboration  
**目的**: 在继续协同测试、Yjs 深化和 Team/Group 运营功能之前，把 `免费用户 / Team / Group / Invite / Subscription / Credit / Presence` 的口径彻底统一，避免前后端、文案、权限和扣费规则继续漂移。

---

## 0. 这份文档解决什么问题

当前系统已经有不少 Team / Group / Invite / Billing / Usage / Presence 的实现，但“产品口径”还没有完全收紧。最明显的问题不是功能缺失，而是 **同一个概念在不同页面、不同接口、不同文档里说法不完全一样**。

这会直接影响四件事：

1. 用户是否能顺利加入 Team / Group
2. 加入后 AI 到底扣谁的钱
3. Group 到底是“免费协作结构”还是“付费计划的产物”
4. 在继续做 Yjs 协同前，是否已经把 membership / billing / permission 地基打平

这份文档的目标不是“补一个临时解释”，而是给出一套 **统一、可实现、可测试、可运营** 的目标方案。

---

## 0.1 2026-05-16 已确认基线

下面这些不是待讨论项，而是本轮已经确认的产品基线：

1. Free 用户不能创建 Team，但可以加入别人已有 Team
2. Free 用户可以创建 `1` 个 Group，也可以加入别人已有 Group
3. Group 是协作结构，不是独立共享钱包
4. Group 内 AI 永远扣当前操作者自己的 personal credits
5. Team 内 AI 永远扣 Team wallet
6. Invite accept 不看被邀请者是 free 还是 paid，只看目标 workspace capacity / status / invite 状态
7. Team owner transfer 先做稳；Group owner transfer 继续禁用
8. 在继续深入 Yjs 之前，先把 Team / Group / Billing / Invite 地基收平
9. 所有 personal plan 的 Group 成员上限统一按 `15`
10. `free_canvas` 用户最多只能创建 `1` 个 Group
11. 这个 free Group 最多只能创建 `1` 个 Board
12. 这个 free Group 内的每个 Board 最多只能有 `3` 个 Page
13. Free 个人侧仍然只有 `1` 个 private Board / `3` 个 Page
14. Collaborate Start / Plus 只扩 Group 数量和个人 credits，不新增任何 Group 共享账本能力
15. Team included credits 固定沿用当前 seat pack：
    - Team Start = `2500 credits / seat`
    - Team Growth = `5500 credits / seat`
16. Group 页面与相关 UI 文案应移除 `subscription` 这个词，保留 `My personal plan / My credits`
17. 升级计划时，已有 top-up credits 不清零；升级赠送 credits 采用增量叠加语义
18. 订阅 included credits 从付费完成开始计周期，每 `30` 天刷新一次；未使用的订阅 credits 不跨周期累加
19. 所有年付方案都按 `年付单价 × 12` 一次性预付，并按 `365 天` 年周期生效
20. Team Start / Team Growth 的月付和年付都按 `每个 seat` 计价

## 0.2 本轮统一开发验收规则

从这一轮开始，`源码文件目标低于 300 行` 不是局部建议，而是整个项目统一生效的验收规则：

1. 任何正在触达的超大源码文件，都不能继续“顺手叠功能”；需要先拆，再继续加行为
2. 如果某个大文件拆分风险较高，必须先把拆分顺序和剩余收口项写进 active plan，而不是留成模糊 TODO
3. `.tangent-boards/**` 这类生成板数据不算功能瘦身对象，应单独作为仓库卫生问题处理

当前建议的全项目瘦身优先级如下：

1. 低风险、应先收的活跃路径：
   - `KonvaCanvasSpike.tsx` 及其直接 runtime 组装层（已收口到 `<300`）
   - `services/api/tangent_api/workspace_invitations.py` + `workspace_invitation_support.py`（invite 主链已收口）
   - S3 admin/billing 前端控制面与样式聚合文件
   - `services/api/tangent_api/routers/admin.py` 与子 router（主 router 已薄化，剩余 AI control-plane router 继续收）
2. 需要在现有回归护栏下继续拆的核心路径：
   - `webSocketBoardRealtimeRoom.ts`（已拆成 thin entry + shared room + awareness/document 子模块，后续如再增长继续切 socket lifecycle）
   - `useKonvaLocalYjsSync.ts`（已拆成薄编排层）
   - `useKonvaCanvasBoardCollaborationBridge.ts`（已抽离纯派生 helper，后续如继续增长再拆 focused-edit bridge）
   - `konvaCanvasSpikeViewProps.ts`（已把 transient UI props 组装拆到独立文件）
   - `useBoardCollaborationPresence.ts`（已拆成薄协调层 + `useBoardCollaborationLocalPresence.ts` 本地 presence 子 hook）
   - `KonvaBoardSaveAudit.tsx`（已拆成薄 UI 壳 + persistence / restore / document-prep 三层）
   - `BoardManagementMembers.tsx`（已拆成薄成员面板 + `useBoardManagementMembers.ts` 数据/变更 hook + 行组件文件）
   - `localBoardClient.ts`（已拆成薄导出面；内部改为 persistence / members / share / snapshots / shared transport 五块）
   - `WorkspaceBoardGallery.tsx`（已拆成薄展示层 + `useWorkspaceBoardGalleryRuntime.ts` 动作层 + `useWorkspaceBoardGalleryData.ts` 数据层 + `workspaceBoardGalleryDerived.ts` 纯派生）
   - `WorkspaceDirectoryView.tsx`（2026-05-17 已拆成薄状态/筛选壳 + `WorkspaceDirectoryViewParts.tsx` 展示子组件）
   - `billingClient.ts`（2026-05-17 已拆成 façade + read client + workspace mutation client + checkout client + shared fetch/cache helper）
   - `billingTypes.ts`（2026-05-17 已拆成 façade + plan/workspace/ledger 三类类型文件）
   - `billing_payments.py`（2026-05-17 已拆出 `billing_payment_checkout_support.py`，主文件重新回到 `<300`）
   - `credit_ledger.py`（2026-05-17 已拆出 `credit_ledger_support.py`，保留原有 DB monkeypatch seam）
   - `team_subscription_lifecycle.py`（2026-05-17 已拆成 thin façade + `team_subscription_support.py` + `team_subscription_provisioning.py`）
   - `adminTypes.ts`（2026-05-17 已拆成 façade + core/directory/operator 三类 admin 类型文件）
   - `adminFinanceClient.ts`（2026-05-17 已拆成 façade + finance read/manual/catalog 子 client）
   - `adminAiClient.ts`（2026-05-17 已拆成 façade + AI read/mutation client + AI type bundle）
   - `AdminAiMutationPanels.tsx`（2026-05-17 已拆成主 panel + `adminAiMutationPanelSupport.tsx` + `adminAiMutationDrafts.ts`）
   - `AdminOperatorDetailPanels.tsx`（2026-05-17 已拆出 `adminOperatorDetailPanelSupport.tsx`，主文件重新回到 `<300`）
   - `KonvaNodeChatBody.tsx`（2026-05-17 已拆成薄协调层 + input/messages/references/scrollbar 子组件 + layout/type helper）
   - `localProviderImageRun.ts`（2026-05-17 已拆成 orchestration + provider client + persistence + executor + support 模块）
   - `ai_run_persistence.py`（2026-05-17 已拆成 thin façade + `ai_run_persistence_store.py` + `ai_run_persistence_support.py`）
   - `ai_contracts.py`（2026-05-17 已拆出 `ai_contracts_support.py`，主 runtime orchestration 重新回到 `<300`）
   - `admin_ai_control_plane.py`（2026-05-17 已拆成 thin façade + `admin_ai_control_plane_reads.py` / `admin_ai_control_plane_writes.py` / `admin_ai_control_plane_support.py`，并保留原有 DB monkeypatch seam）
   - `admin_ai_versions.py`（2026-05-17 已拆成 thin façade + `admin_ai_version_ops.py` + `admin_ai_version_support.py`）
   - `ai_control_plane.py`（2026-05-17 已拆出 `ai_control_plane_support.py`，主 runtime 控制面重新回到 `<300`）
   - `localBoardMembersStore.ts`（2026-05-17 已拆成成员 CRUD 主壳 + share/workspace-people/board-access/support 子模块）
   - `services/api/tangent_api/routers/boards.py`（已拆成 core / collaboration / realtime 三个 router 文件）
    - `workspace_entitlements.py`
    - `admin_ai_control_plane_router.py`
3. 高风险、要先补测试再拆的存储/协同路径：
   - board stores（2026-05-17 已完成 first-pass 薄化；下一步不再是继续拆 store 主文件，而是继续做 account-delete blockers、provider/control-plane 与更外围的大文件）
   - collaboration stores / realtime hub
   - 超大 node/card/chat 复合 UI 文件

---

## 1. 当前发现的主要冲突

截至 2026-05-16，现状里至少有下面几类冲突：

### 1.1 Group 的创建规则冲突

- 旧 S3 文档里，Group 一度被描述为“需要 Collaborate 订阅才能创建”
- 现在代码已经调整为：`free_canvas` 用户可以创建 `1` 个 Group
- 但 PRD / ARCH 的叙述还没有完全跟上

### 1.2 Group 的计费归属冲突

- S3 的目标口径是：**Group 内 AI 扣的是发起者自己的个人钱包**
- 但部分前端文案仍然写成更像“这个 Group 使用 owner 的订阅”
- 这两种说法不能同时成立，必须统一

### 1.3 “Group subscription” 和 “Personal plan” 的概念缠在一起

- 当前 `/billing`、`/usage`、`/group/[groupId]` 的展示口径里，常把 “我的个人计划” 和 “我某个 Group 的协作结构” 混写
- 这会让用户以为 Group 是一个单独付费实体
- 但如果我们坚持“Group 内 AI 仍然扣个人钱包”，那么 Group 更像 **协作空间结构**，不是独立账单主体

### 1.4 Invite 接受规则和 Plan 限制没有完全拆开

- Team invite：应该只看目标 Team 还有没有 seat
- Group invite：应该只看目标 Group 还能不能收成员
- 不应该因为被邀请者是 free 用户，就拦掉他加入别人的 Team / Group
- 这次代码已经开始朝这个方向修，但产品和 UI 话术也要跟上

### 1.5 Collaboration 还没开始大规模测试，但 membership 地基还没完全定死

- 继续做多人 cursor / presence / occupancy 之前
- 必须先明确：谁能进、进了算什么角色、看得到什么、能不能 invite、能不能删人、谁能转移所有权、AI 扣费归谁

我的建议很明确：  
**先把 Team / Group / Free / Invite / Credit 的底层口径定死，再大规模测试协同。**

---

## 2. 建议直接采用的统一产品模型

这次建议把系统拆成四层，不再混写：

```text
层 1: 身份用户 User
层 2: 工作空间 Workspace
  - solo_workspace
  - group_workspace
  - team_workspace
层 3: 计费主体 Billing Owner
  - user-owned personal wallet
  - workspace-owned team wallet
层 4: 协作能力 Collaboration
  - invite
  - membership
  - board permission
  - presence
  - realtime sync
```

### 2.1 统一定义

#### A. Solo Workspace

- 每个用户默认拥有一个 `solo_workspace`
- 这是个人私有空间
- 不支持 workspace invite
- 不支持 public / workspace share
- AI 永远扣自己的个人钱包

#### B. Group Workspace

- Group 是 **轻量协作结构层**
- Group 不是独立的付费主体
- Group 不拥有自己的钱包
- Group 里的 AI 运行，**始终扣当前操作者自己的个人钱包**
- Group 的价值是协作、成员、Board 归组、Presence 和 Yjs 协作，不是共享账本

#### C. Team Workspace

- Team 是 **付费协作产品**
- Team 拥有独立 Team wallet
- Team 里的 AI 运行，**始终扣 Team wallet**
- Team 的 seat、成员、Board、usage、billing 都围绕 Team workspace 本身展开

#### D. Personal Plan

- 个人计划只定义：
  - 个人 included credits
  - 个人 top-up 价格
  - 个人最多可创建多少个 Group
  - 个人私有空间的 board/page 限制

#### E. Workspace Plan

- 只有 Team / Enterprise 才有 workspace-owned plan
- Group 没有 workspace-owned plan
- Group 只消费成员各自的 personal plan / personal wallet

---

## 3. 建议定版的核心规则

下面这组规则，我建议直接作为目标口径定版。

### 3.1 Free 用户规则

#### Free 用户可以：

- 注册并获得默认 `solo_workspace`
- 使用注册赠送积分
- 创建 `1` 个 Group
- 加入别人已经存在的 Group
- 加入别人已经存在的 Team
- 在自己有权限的 Group / Team Board 中协作

#### Free 用户不可以：

- 创建 Team
- 拥有多个 Group
- 让自己的个人计划继承别人的 Team 或 Group 订阅

#### Free 用户的明确容量边界：

- 个人私有空间最多 `1` 个 private Board
- 个人私有 Board 最多 `3` 个 Page
- 自己创建的 free Group 最多 `1` 个 Board
- 该 free Group 内每个 Board 最多 `3` 个 Page

### 3.2 Team 规则

- Team 必须由付费流程创建
- Team 有独立 Team wallet
- Team invite 接受时只检查：
  - invite 有效
  - seat 还有余量
  - 目标成员未被封禁 / 未失效
- 被邀请者是不是 free，不影响加入 Team
- 一旦加入 Team，在 Team Board 中的 AI 消费全部走 Team wallet

### 3.3 Group 规则

- Group 是免费可用的协作结构
- Free 用户最多创建 `1` 个 Group
- Group 成员上限统一按 `15`
- Collaborate Start / Plus 只是在个人层面扩容：
  - 可创建更多 Group
  - 个人有更多 included credits
- Collaborate Start / Plus **不**新增 Group 共享钱包、Group 独立账本或 Group 级别 credits 池
- Group invite 接受时只检查：
  - invite 有效
  - group 成员上限未满
  - 目标成员未被封禁 / 未失效
- 被邀请者是不是 free，不影响加入 Group
- 加入 Group 后，AI 仍然扣 **自己** 的个人钱包
- `free_canvas` 创建出来的 Group 继承 free 的 board/page 上限：`1 Board / 每个 Board 3 Pages`

### 3.4 AI 扣费规则

统一成一个不绕的决策树：

```text
如果当前 workspace.kind == team_workspace
  -> 扣 Team wallet

否则
  -> 扣 actor personal wallet
```

也就是说：

```text
solo_workspace   -> actor personal wallet
group_workspace  -> actor personal wallet
team_workspace   -> team wallet
enterprise       -> enterprise workspace pool（以后）
```

### 3.5 Invite 管理规则

- Workspace invite 管理权限：`owner/admin`
- Viewer / Editor 不能发 workspace invite
- Team / Group 都支持 invite link
- Private solo workspace 不支持 workspace invite
- 现阶段不强制发邮件，先以 copy link 为主
- 后续如接 Clerk/email，只是“通知渠道”，不改变 invite token 本身的 authority

### 3.6 删除与所有权规则

#### Team

- Team owner 可以：
  - rename Team
  - delete Team workspace
  - invite / revoke
  - remove member
  - transfer ownership
- Team owner transfer 必须先做稳

#### Group

- Group owner 可以：
  - rename Group
  - delete Group
  - invite / revoke
  - remove member
- Group owner transfer **建议先继续禁止**
- 等 billing ownership 规则完全定清楚后再开

#### Account delete

- free/solo-only 用户可直接删除账号
- 仍绑定 paid Team / joined Team seat / owned Team / owned Group / active subscription 的用户，必须先清 blockers

---

## 4. 统一后的订阅方案矩阵

以下价格和额度基于当前 plan catalog / 代码现状；建议作为当前 review 基准。

## 4.1 Personal Plans

| 计划 | 月付 | 年付 | 计费说明 | 周期 / 有效期 | included credits | 注册赠送 | 可创建 Group 数 | Group 成员上限 | Solo board limit | Solo page limit | Free Group board limit | Free Group page limit | 可加入 Team | 可加入 Group |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Free Canvas | $0 | $0 | 免费 | 长期有效 | 0 | 50 | 1 | 15 | 1 | 3 | 1 | 3 | 是 | 是 |
| Collaborate Start | $18 | $15 | 月付=`18/月`；年付=`15 × 12` 一次性预付，按 365 天计算 | 月付=`30 天`；年付=`365 天`；usage 页显示 `Current period` 与 `Valid until` | 1500 | 0 | 10 | 15 | 沿 active catalog | 沿 active catalog | 沿 active catalog | 沿 active catalog | 是 | 是 |
| Collaborate Plus | $25 | $20 | 月付=`25/月`；年付=`20 × 12` 一次性预付，按 365 天计算 | 月付=`30 天`；年付=`365 天`；usage 页显示 `Current period` 与 `Valid until` | 2000 | 0 | 20 | 15 | 沿 active catalog | 沿 active catalog | 沿 active catalog | 沿 active catalog | 是 | 是 |

### Personal Plan 的真实含义

- 它控制的是 **个人钱包、个人额度、个人可创建 Group 数**
- 它 **不** 自动给 Group 变成“共享钱包”
- 它 **不** 影响用户加入别人 Team / Group 的资格
- 对 `free_canvas` 来说，它同时定义了 free Group 的初始 board/page 上限

### Personal Plans 定价解释

- 表中的 `月付` 是个人方案的每月价格
- 表中的 `年付` 是个人方案在年付下的折算月价
- Personal 年付实际结算金额：
  - `年付单价 × 12`
  - 在购买时一次性付清
  - 周期按 `365 天` 计算

## 4.2 Workspace Plans

| 计划 | 月付 | 年付 | 计费说明 | 周期 / 有效期 | included credits | seat 范围 | seat cap | 钱包归属 | AI 扣费归属 | 可邀请成员 | 可看成员 usage |
| --- | ---: | ---: | --- | --- | ---: | --- | ---: | --- | --- | --- | --- |
| Team Start | $25/seat | $20/seat | 月付=`25 × seat 数 / 月`；年付=`20 × 12 × seat 数` 一次性预付，按 365 天计算 | 月付=`30 天`；年付=`365 天`；usage 页显示 `Current period` 与 `Valid until` | 2500 / seat | 1-15 | 15 | Team wallet | Team wallet | 是 | owner/admin |
| Team Growth | $45/seat | $40/seat | 月付=`45 × seat 数 / 月`；年付=`40 × 12 × seat 数` 一次性预付，按 365 天计算 | 月付=`30 天`；年付=`365 天`；usage 页显示 `Current period` 与 `Valid until` | 5500 / seat | 1-15 | 15 | Team wallet | Team wallet | 是 | owner/admin |

### Workspace Plans 定价解释

- 表中的 `月付` 是 **每个 seat 的每月价格**
- 表中的 `年付` 是 **每个 seat 在年付方案下的折算月价**
- Team 实际结算金额：
  - 月付：`月付单价 × seat 数`
  - 年付：`年付单价 × 12 × seat 数`，并在购买时一次性付清 12 个月
  - 年周期按 `365 天` 计算
- 例如 Team Start：
  - 5 个 seat 月付 = `25 × 5 / 月`
  - 5 个 seat 年付 = `20 × 12 × 5` 一次性支付

### Team Plan 的真实含义

- 它控制的是 **workspace-owned team wallet**
- seat 是 Team 内协作容量和 credit pack 的购买单位
- Team member 的个人 free/collaborate 计划，不改变 Team Board 中的扣费主体
- included credits 固定按 seat pack 计算：
  - Team Start = `2500 / seat`
  - Team Growth = `5500 / seat`
- 定价也固定按 seat 计算，不是整个 Team workspace 的一口价

## 4.3 Upgrade / Top-up 语义

- Personal top-up 永远留在个人钱包
- Team top-up 永远留在 Team wallet
- Group 没有独立 top-up 钱包
- subscription included credits 从付费完成开始进入当前周期，并在每 `30` 天周期开始时刷新
- 未使用的 subscription included credits 不跨周期累加
- 计划 upgrade 时，已有 top-up credits 不能被覆盖或清零
- upgrade 的 included credits 应采用 **delta / additive** 语义叠加到现有余额，而不是重置总余额

---

## 4.4 Admin 价格控制面

Admin 需要能根据市场行情动态调整 personal plan 和 workspace plan，而不是把价格写死在代码或前端里。

### 4.4.1 Personal Plans 可调参数

- 月付价格
- 年付价格
- included credits
- 注册赠送积分
- 可创建 Group 数
- Group 成员上限
- solo board limit
- solo page limit
- free Group board/page 上限

### 4.4.2 Workspace Plans 可调参数

- 月付价格
- 年付价格
- included credits / seat
- seat cap
- seat range
- Team plan 的 board/page / usage 展示阈值

### 4.4.3 Admin 调整链路

1. Admin 在 Finance / Plan Catalog 中读取当前 catalog
2. Admin 调整月付、年付、included credits、注册赠送积分和容量字段
3. 变更通过 server-side plan catalog 持久化
4. billing / entitlement / create / invite / checkout 全部从同一份 catalog 读取
5. `Subscription`（当前可沿用 `/billing` route）、`/usage`、`/team`、`/group`、`/admin` 使用同一份 catalog 展示价格和额度
6. 变更必须写 audit log，并要求 reason

### 4.4.4 当前已存在的控制面

- `/api/v1/admin/finance/plan-catalog`
- `GET /api/v1/billing/plans`
- `group-plan-operation`
- `team-plan-operation`
- plan catalog 驱动的注册赠送、board/page cap、group cap、seat cap、月付/年付和 included-credit math

## 5. 权限 / 邀请 / 扣费 / 可见性统一矩阵

## 5.1 Workspace 权限矩阵

| 角色 | 看 workspace | 看 board | 编辑 board | 发 workspace invite | 改成员角色 | 移除成员 | 改 workspace 设置 | 删除 workspace | transfer owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| owner | 是 | 是 | 是 | 是 | 是 | 是 | 是 | 是 | 是（Team 先开） |
| admin | 是 | 是 | 是 | 是 | 部分 | 是 | 部分 | 否 | 否 |
| editor | 是 | 是 | 是 | 否 | 否 | 否 | 否 | 否 | 否 |
| viewer | 是 | 是 | 否 | 否 | 否 | 否 | 否 | 否 | 否 |

### 5.1A Team / Group 成员管理链路

当前应视为已经存在并需要统一验收的 member management 链路：

- invite create
- invite revoke
- invite accept
- pending / accepted / revoked 状态展示
- add member
- remove member
- role change
- admin `Join Team` / `Join Group` lookup modal
- Team seat assignment / Team seat revoke
- Team owner transfer
- Group owner transfer 继续禁用

这些动作全部应该复用 server-side workspace membership / invitation / seat contracts，不允许前端自己拼权限状态。

## 5.2 邀请接受矩阵

| 场景 | 是否允许 | 应检查什么 | 不该检查什么 |
| --- | --- | --- | --- |
| Free 用户加入 Team | 允许 | token、seat capacity、workspace status | 个人是不是 free |
| Paid 用户加入 Team | 允许 | token、seat capacity、workspace status | 对方有没有 personal plan |
| Free 用户加入 Group | 允许 | token、group member cap、workspace status | 个人是不是 free |
| 已拥有 1 个 Group 的用户加入别人的 Group | 允许 | token、group member cap | “你已经有 1 个 Group” |

## 5.3 AI 扣费与可见性矩阵

| Workspace | AI 扣费账户 | 谁能看总 usage | 谁能看成员 usage | 谁能看个人账单 |
| --- | --- | --- | --- | --- |
| Solo | actor personal wallet | 用户本人 | 不适用 | 用户本人 |
| Group | actor personal wallet | Group 结构可见，但 billing 聚合要谨慎 | 不建议看他人个人 usage 金额 | 仅各自本人 |
| Team | team wallet | owner/admin | owner/admin | 仅个人自己的 personal 历史 |

### 强建议

Group 页面里：

- 可以看成员列表
- 可以看 Board 列表
- 可以看协作状态
- 可以看自己的 credit / 自己的 usage
- **不要** 让 Group owner/admin 看到别的成员的 personal wallet 明细

---

## 6. 建议统一后的信息架构

## 6.1 顶层导航建议

```text
Workspace
Boards
Team
Group
Subscription
Usage
Admin
```

## 6.2 页面职责建议

### `/team`

- 只看 Team 目录
- 分成：
  - Created by me
  - Joined
- 每张卡只表达：
  - Team 名称
  - 当前角色
  - seat / members / boards
  - Team wallet usage
  - 当前 plan

### `/team/[teamId]`

- 这是 Team dashboard / management page
- 里面才放：
  - Boards
  - Usage
  - Members
  - Invites
  - Settings

### `/group`

- 只看 Group 目录
- 分成：
  - Created by me
  - Joined
- 顶部 summary 要明确写：
  - 这是你的 **personal plan**
  - 不是“Group 共享钱包”

### `/group/[groupId]`

- 这是 Group dashboard / management page
- 里面放：
  - Boards
  - Members
  - Invites
  - Settings
  - 左侧或侧栏显示“你的个人 credits / 你的当前 plan”

### `Subscription`（当前可沿用 `/billing` 路由）

- 这是 plan catalog / 购买 / upgrade 页面
- 只讲 plan 结构、价格、权益、对比和 CTA
- 不要混入太多 workspace 运营动作
- 不要承担实际 usage / ledger 的主展示职责

### `/usage`

- 这是当前已订阅方案与消耗状态页
- 要列出：
  - 当前 personal plan
  - 当前已拥有 / 已加入的 Team workspace plan
  - current period / valid until / next refresh
  - credits 消耗、remaining、top-up、ledger、payments
  - top-up / buy seat / open workspace 等动作
- 也就是说，`Usage` 不是纯 ledger 页，而是“当前订阅状态 + 消耗状态”页

### `/admin`

- Finance tab 作为 plan catalog 控制面
- 允许调整月付 / 年付 / included credits / 注册赠送积分 / cap
- Users/Teams/Groups 负责 invite、member、role、join、remove、owner-transfer 这条 operator 链路
- 所有写操作都要求 audit / reason

### `/invite/[token]`

- 只做 membership 进入
- 文案必须告诉用户：
  - 这是加入 Team 还是 Group
  - 你加入后 AI 是扣 Team wallet 还是你自己的 credits

---

## 7. 前端 UI 架构建议（含 ASCII 示意图）

下面不是最终视觉稿，而是信息架构和块级布局建议。

## 7.1 Team 列表页 `/team`

```text
+----------------------------------------------------------------------------------+
| Team                                                           [Create] [Join]   |
|----------------------------------------------------------------------------------|
| [Search....................................]   [Gallery] [List]                  |
|----------------------------------------------------------------------------------|
| Created by me                                                                    |
| +----------------------+  +----------------------+  +----------------------+      |
| | Team A               |  | Team B               |  | Team C               |      |
| | role: Owner          |  | role: Owner          |  | role: Admin          |      |
| | 12 boards  8 members |  |  4 boards  3 members |  | 18 boards 12 members|      |
| | Team Start           |  | Team Growth          |  | Team Start           |      |
| | 1800 / 2500 credits  |  | 4600 / 5500 credits  |  |  900 / 2500 credits  |      |
| +----------------------+  +----------------------+  +----------------------+      |
|                                                                                  |
| Joined                                                                           |
| +----------------------+  +----------------------+                               |
| | Team D               |  | Team E               |                               |
| | role: Editor         |  | role: Viewer         |                               |
| |  6 boards  9 members |  | 10 boards  5 members |                               |
| +----------------------+  +----------------------+                               |
+----------------------------------------------------------------------------------+
```

### Team 列表页 UI 重点

- Team 是一个“付费 workspace”，所以卡片上要直接显示 Team wallet usage
- Joined Team 不要展示“你的个人 plan”
- 用户一眼就要知道：这是 Team 的钱，不是我的钱

## 7.2 Team 详情页 `/team/[teamId]`

```text
+----------------------------------------------------------------------------------+
| <- Back     Team Alpha                                             [Dashboard]   |
|----------------------------------------------------------------------------------|
| +---------------------------------------------------+ +------------------------+ |
| | Boards                                            | | Usage                  | |
| | [Gallery] [List]                                  | | 1800 credits remaining | |
| |                                                   | | Team Start             | |
| | [board thumb] [board thumb] [board thumb]         | | valid until 2026-06-15 | |
| | [board thumb] [board thumb] [board thumb]         | | [Top Up] [Buy Seat]    | |
| +---------------------------------------------------+ +------------------------+ |
|                                                     | +------------------------+ |
|                                                     | | Settings               | |
|                                                     | | rename / delete /      | |
|                                                     | | transfer owner         | |
|                                                     | +------------------------+ |
|----------------------------------------------------------------------------------|
| +--------------------------------------+ +--------------------------------------+ |
| | Members                              | | Invites                              | |
| | owner/admin/editor/viewer rows       | | pending / accepted / revoked         | |
| | [role] [remove]                      | | [create] [copy link] [revoke]        | |
| +--------------------------------------+ +--------------------------------------+ |
+----------------------------------------------------------------------------------+
```

### Team 详情页 UI 重点

- Usage 模块只显示 Team wallet
- Member 行动只由 owner/admin 可见
- Invite 状态必须清楚显示 `pending / accepted / revoked`
- Team-only 的 owner transfer 放在 Settings

## 7.3 Group 列表页 `/group`

```text
+----------------------------------------------------------------------------------+
| Group                                                          [Create] [Join]   |
|----------------------------------------------------------------------------------|
| Personal collaboration summary                                                    |
| Plan: Free Canvas / Collaborate Start / Collaborate Plus                         |
| Credits: 50 / 1500 / 2000 ...                                                    |
| Groups created: 1 / 10 / 20                                                      |
|----------------------------------------------------------------------------------|
| [Search....................................]   [Gallery] [List]                  |
|----------------------------------------------------------------------------------|
| Created by me                                                                    |
| +----------------------+  +----------------------+                               |
| | Design Circle        |  | Research Cell        |                               |
| | role: Owner          |  | role: Owner          |                               |
| | 8 boards  5 members  |  | 2 boards  3 members  |                               |
| +----------------------+  +----------------------+                               |
|                                                                                  |
| Joined                                                                           |
| +----------------------+  +----------------------+                               |
| | Studio Shared        |  | Product Review       |                               |
| | role: Editor         |  | role: Viewer         |                               |
| +----------------------+  +----------------------+                               |
+----------------------------------------------------------------------------------+
```

### Group 列表页 UI 重点

- 顶部 summary 必须明确写这是 **Personal collaboration summary**
- 不要让人误会成“每个 Group 各有一份共享 subscription”
- Group 卡片重点是协作结构，不是共享钱包

## 7.4 Group 详情页 `/group/[groupId]`

```text
+----------------------------------------------------------------------------------+
| <- Back     Design Circle                                         [Dashboard]    |
|----------------------------------------------------------------------------------|
| +---------------------------------------------------+ +------------------------+ |
| | Boards                                            | | My credits             | |
| | [Gallery] [List]                                  | | 50 remaining           | |
| |                                                   | | Free Canvas            | |
| | [board thumb] [board thumb] [board thumb]         | | [Top Up]               | |
| +---------------------------------------------------+ +------------------------+ |
|                                                     | +------------------------+ |
|                                                     | | Settings               | |
|                                                     | | rename / delete group  | |
|                                                     | +------------------------+ |
|----------------------------------------------------------------------------------|
| +--------------------------------------+ +--------------------------------------+ |
| | Members                              | | Invites                              | |
| | owner/admin/editor/viewer rows       | | pending / accepted / revoked         | |
| +--------------------------------------+ +--------------------------------------+ |
+----------------------------------------------------------------------------------+
```

### Group 详情页 UI 重点

- 右侧不要叫 “Group subscription”
- 应该叫：
  - `My credits`
  - `My personal plan`
- 因为 Group 本身不是钱包主体

## 7.5 Subscription 页（当前可沿用 `/billing` 路由）

```text
+----------------------------------------------------------------------------------+
| Subscription                                                                     |
|----------------------------------------------------------------------------------|
| [Monthly] [Annual]                                                               |
|----------------------------------------------------------------------------------|
| Personal Plans                                                                   |
| +-------------------------------------------------------------------------------+|
| | Free Canvas                                                                  ||
| | price / current plan / current period / valid until                          ||
| | credits / groups / group member cap / solo board/page / free-group board/page||
| | feature bullets / CTA                                                        ||
| +-------------------------------------------------------------------------------+|
| +-------------------------------------------------------------------------------+|
| | Collaborate Start                                                            ||
| | price / current plan / current period / valid until                          ||
| | 1500 credits / 10 groups / 15 members / limits / yearly billing note         ||
| | feature bullets / CTA                                                        ||
| +-------------------------------------------------------------------------------+|
| +-------------------------------------------------------------------------------+|
| | Collaborate Plus                                                             ||
| | price / current plan / current period / valid until                          ||
| | 2000 credits / 20 groups / 15 members / limits / yearly billing note         ||
| | feature bullets / CTA                                                        ||
| +-------------------------------------------------------------------------------+|
|----------------------------------------------------------------------------------|
| Workspace / Team Plans                                                           |
| +-------------------------------------------------------------------------------+|
| | Team Start                                                                   ||
| | $25/seat monthly or $20/seat annual-rate                                     ||
| | current period / valid until / seats / team credits / team board allowance   ||
| | owner/admin permission summary / team wallet summary / CTA                   ||
| +-------------------------------------------------------------------------------+|
| +-------------------------------------------------------------------------------+|
| | Team Growth                                                                  ||
| | $45/seat monthly or $40/seat annual-rate                                     ||
| | current period / valid until / seats / team credits / team board allowance   ||
| | owner/admin permission summary / team wallet summary / CTA                   ||
| +-------------------------------------------------------------------------------+|
+----------------------------------------------------------------------------------+
```

### Subscription 页 UI 重点

- 整页按 **上下纵向长条 container** 排布，不走弹窗
- 风格参考 Lovart 的清晰营销表达，但保留我们的 workspace / credit / seat 信息密度
- 顶部仍保留月付 / 年付切换
- 明确拆成：
  - `Personal Plans`
  - `Workspace / Team Plans`
- 每个长条 plan container 需要同时显示：
  - 价格
  - 当前是否激活
  - current period
  - valid until
  - credits
  - 权限摘要
  - Group / Team board 数量与 page/seat 限制
  - CTA
- 不要再把 Group 当作单独 workspace 计划写进去
- Group 是协作结构，plan 是 personal 的
- 文案可以有营销表达，但信息必须可扫描、可比较、可直接做购买决策

### Subscription 页分区顺序

建议直接固定为下面的顺序，避免前端后面又把 plan、usage、workspace 信息混成一个杂糅页面：

1. 顶部标题区
   - 标题：`Subscription`
   - 副标题一句话说明：个人方案负责个人 credits 和 Group 创建能力；Team 方案负责 workspace wallet 和 seats
2. 月付 / 年付切换条
3. `Personal Plans` 长条区
4. `Workspace / Team Plans` 长条区
5. 底部补充说明区
   - 说明 included credits 每 30 天刷新
   - 说明 top-up credits 不随周期清零
   - 说明年付为一次性支付 `年付单价 × 12`

### Personal plan 长条 container 结构

每一条 personal plan 都应是一个完整长条，不是小卡片宫格。建议一条分成四列信息，但视觉上仍是一整块：

```text
+--------------------------------------------------------------------------------------------------+
| Plan name + plan tag | Price + billing mode | Limits / credits / permissions | CTA + active tag |
+--------------------------------------------------------------------------------------------------+
```

#### Personal plan 长条内必须展示的字段

- plan 名称
- 当前状态：
  - `Current plan`
  - `Available`
  - `Upgrade`
- 月付价格
- 年付价格
- 年付说明：
  - `annual price x 12 billed upfront`
  - `365-day term`
- current period
- valid until
- next refresh
- included credits
- top-up credits 规则说明
- 可创建 Group 数
- Group member cap
- solo board limit
- solo page limit
- free-owned Group 的 board/page limit
- 权限摘要：
  - 可否创建 Team
  - 可否加入 Team
  - 可否加入 Group
- CTA：
  - `Start`
  - `Upgrade`
  - `Current plan`

#### Personal plan 文案重点

- Free Canvas:
  - 强调 `1 private board`, `1 created group`, `3 pages per board`
- Collaborate Start:
  - 强调 `1500 monthly credits`, `10 groups`, `personal collaboration scale`
- Collaborate Plus:
  - 强调 `2000 monthly credits`, `20 groups`, `higher collaboration capacity`
- 这里允许营销语言，但营销句必须绑定真实权益，不允许空泛 slogan 占掉主要信息位

### Workspace / Team plan 长条 container 结构

Team 方案也应采用同样的长条，但字段和 personal plan 不一样，重点是 seat 和 Team wallet：

```text
+--------------------------------------------------------------------------------------------------+
| Team plan + plan tag | Price / seat + billing mode | Seats / wallet / usage facts | CTA + status |
+--------------------------------------------------------------------------------------------------+
```

#### Team plan 长条内必须展示的字段

- plan 名称
- 当前状态：
  - `Current team plan`
  - `Available`
  - `Upgrade`
- 月付 seat 单价
- 年付 seat 单价
- 年付说明：
  - `annual seat price x 12 x seat count billed upfront`
  - `365-day term`
- current period
- valid until
- next refresh
- included credits per seat
- current seat count
- seat cap
- Team wallet remaining credits
- Team board count / board allowance
- Team member count / seat usage
- 权限摘要：
  - owner/admin 可 invite
  - owner/admin 可看 Team usage
  - Team AI charge Team wallet
- CTA：
  - `Create team`
  - `Upgrade`
  - `Manage`

### Subscription 页视觉和交互约束

- 不是表格式 compare grid，也不是弹窗后再展开说明
- 每个长条 container 上半部分就要让用户明白：
  - 多少钱
  - 有多少 credits
  - 能建多少 Group / Team
  - 谁来付 AI 的钱
  - 当前周期什么时候到期
- `current period`、`valid until`、`next refresh` 应放在同一视觉组，不能散落到 tooltip 或次级折叠区
- 年付说明必须直接可见，不能藏在 FAQ 里
- 如果是当前激活方案，CTA 不要继续显示购买语义，而应该显示 `Current plan` 或 `Manage`
- Group 相关方案永远放在 `Personal Plans` 分区，不允许单独列出 `Group subscription`

## 7.6 Usage 页 `/usage`

```text
+----------------------------------------------------------------------------------+
| Usage                                                                            |
|----------------------------------------------------------------------------------|
| Personal usage                                                                   |
| +-------------------------------------------------------------------------------+|
| | current plan / current period / valid until                                  ||
| | remaining credits / top-up credits / groups created / limits                 ||
| | recent ledger slice / CTA                                                    ||
| +-------------------------------------------------------------------------------+|
|                                                                                  |
| Team usage                                                                       |
| +-------------------------------------------------------------------------------+|
| | Team A: current plan / current period / valid until / remaining credits      ||
| | seats used / seat cap / team board count / usage / top-up / buy seat         ||
| +-------------------------------------------------------------------------------+|
| +-------------------------------------------------------------------------------+|
| | Team B: current plan / current period / valid until / remaining credits      ||
| | seats used / seat cap / team board count / usage / top-up / buy seat         ||
| +-------------------------------------------------------------------------------+|
|                                                                                  |
| Ledger                                                                           |
| [time] [scope] [action] [change]                                                 |
+----------------------------------------------------------------------------------+
```

### Usage 页 UI 重点

- 也是 **上下纵向长条 container** 排布
- Personal usage 和 Team usage 分成两个大区块
- 要先展示“当前有哪些 active plan / workspace”，再展示 credits 消耗和 ledger
- 每个 plan / workspace usage 条都要显示：
  - current period
  - valid until
  - remaining credits
  - included credits
  - top-up balance
  - 对应 workspace 的 seats / boards / limits
- 不要用 “Group subscription” 当区块标题
- 这页重点是“我现在有什么、用到哪里、什么时候到期”，不是单纯价格展示

### Usage 页分区顺序

1. 顶部标题区：`Usage`
2. `Personal usage`
3. `Team usage`
4. `Ledger / Payments`

注意：

- `Group usage` 不要单独成为一个付费区块
- Group 中的消耗应折回 `Personal usage` 解释，因为扣费主体仍然是 actor personal wallet
- Usage 页需要先把“当前订阅中的 personal / Team 计划”列出来，再解释消耗，不要只剩流水表

### Personal usage 长条 container 结构

```text
+--------------------------------------------------------------------------------------------------+
| Personal plan status | Period / validity | Credits / limits | Actions / ledger entrypoint       |
+--------------------------------------------------------------------------------------------------+
```

#### Personal usage 必须展示的字段

- current plan
- current period
- valid until
- next refresh
- remaining included credits
- top-up balance
- total available credits
- 已创建 Group 数 / 上限
- 当前 personal workspace board/page limit
- 如果当前用户有 free-owned Group：
  - free Group board count
  - free Group page usage
- 最近 usage 摘要：
  - 最近一次消费时间
  - 最近一次 top-up
  - 最近一次 plan change
- CTA：
  - `Top up`
  - `Change plan`
  - `Open ledger`

### Team usage 长条 container 结构

每个已加入或已拥有的 Team workspace 都是一条长条：

```text
+--------------------------------------------------------------------------------------------------+
| Workspace identity | Period / validity | Team wallet / seats / boards | Actions / member-usage entry |
+--------------------------------------------------------------------------------------------------+
```

#### Team usage 必须展示的字段

- Team 名称
- 当前角色
- current plan
- current period
- valid until
- next refresh
- remaining Team credits
- included credits per seat
- current seat count
- seats used / seat cap
- Team member count
- Team board count
- Team AI charges Team wallet 的简短提示
- CTA：
  - `Top up`
  - `Buy seats`
  - `Open workspace`
  - owner/admin 额外可见 `View member usage`

### Ledger / Payments 区块要求

- 不要让 ledger 抢主信息位，但也不能埋太深
- 至少要能看到：
  - 时间
  - scope：personal / team
  - action：usage / top-up / grant / refund / admin adjustment
  - change
  - balance after
- ledger 可以是表格，但上面的 Personal / Team usage 区块必须仍是长条 container，不要混成一个表页

### Usage 页视觉和文案约束

- 这页不是“价格页”，而是“当前状态页”
- 应优先回答四个问题：
  1. 我现在是什么计划
  2. 我还有多少 credits
  3. 我的周期什么时候刷新、什么时候到期
  4. 哪些 Team 在消耗 Team wallet
- 如需营销文案，只能放在区块副标题，不要盖过 usage 和 expiry 事实

## 7.7 Invite 接受页 `/invite/[token]`

```text
+---------------------------------------------------------------+
| TANGENT                                                       |
|---------------------------------------------------------------|
| Join Team Alpha                                               |
| This invite will add you as Editor.                           |
| Workspace: Team workspace                                     |
| AI billing: Runs in this Team charge the Team wallet.         |
|                                                               |
| [Accept invite] [Not now]                                     |
+---------------------------------------------------------------+
```

或：

```text
+---------------------------------------------------------------+
| Join Design Circle                                            |
| This invite will add you as Viewer.                           |
| Workspace: Group workspace                                    |
| AI billing: Runs in this Group charge your own personal       |
| credits, not the Group owner wallet.                          |
|                                                               |
| [Accept invite] [Not now]                                     |
+---------------------------------------------------------------+
```

### Invite 页 UI 重点

- 让用户在接受前就知道扣费归属
- 这一步对减少计费误解非常重要

---

## 8. Collaboration 的产品边界建议

我的建议是：  
**协同先完全建立在 Team / Group membership 之上，不要另起一套 room-level 权限系统。**

## 8.1 进入协同的前提

用户要进入同一块 Board 的 realtime / Yjs / cursor / presence，必须先满足：

1. 是该 workspace 的有效成员
2. 对该 Board 至少有 `viewer`
3. 若要发 document update，则至少是 `editor`

## 8.2 协同作用域建议

### Workspace 作用域

- Team / Group 决定成员集合、invite、管理权限

### Board 作用域

- Board 决定谁能看 / 改 / 管

### Page 作用域

- Presence 必须带 `activePageId`
- Cursor / selection / focused edit occupancy 按 page 解释
- 真正“用户体感上的协同”应以 page 为主，而不是整个 board 完全无差别广播

建议目标：

```text
workspace
  -> board
      -> page
          -> cursor / selection / transform preview / focused edit occupancy
```

## 8.3 Focused edit occupancy 建议

继续沿用当前方向即可：

- 文本编辑
- crop
- node 参数 dropdown
- chat model selection

这些属于 **focused edit**

普通操作：

- 拖动
- 画线
- 选框
- 平移缩放

这些保持 optimistic，不做全局锁。

---

## 9. 后端需要做的事情

## 9.1 规则层

1. 把 Group 正式定义为免费协作结构层
2. 把 personal plan 和 group workspace 彻底解耦
3. 让 Team / Group invite accept 只看目标 workspace capacity，不看被邀请者是不是 free
4. 用独立 contract 文件锁住这条 invite policy，不把新增基线继续堆回旧的超长 invitation test 文件
4. 明确定义：
   - Team -> workspace wallet
   - Group -> actor personal wallet

## 9.2 数据模型层

建议保持并加强下面这些不变量：

### Workspace

```text
tangent_workspaces.kind
  solo_workspace
  group_workspace
  team_workspace
  enterprise_workspace
```

### Membership

```text
tangent_workspace_members.role
  owner / admin / editor / viewer
```

兼容值 `member / guest` 继续只做 alias，不再作为前台主语言。

### Invitation

```text
tangent_workspace_invitations
  pending / accepted / revoked / expired
```

### Billing ownership

```text
if workspace.kind == team_workspace
  charged_account = workspace-owned credit_account
else
  charged_account = user-owned credit_account
```

## 9.3 API 层

建议把接口语义也整理成这几个块：

### Workspace lifecycle

- `POST /api/v1/workspaces/groups`
- `POST /api/v1/billing/teams/checkout`
- `PATCH /api/v1/workspaces/current`
- `DELETE /api/v1/workspaces/current`
- `POST /api/v1/workspaces/current/owner/transfer`（Team-only）

### Membership / invite

- `GET /api/v1/workspaces/current/members`
- `PATCH /api/v1/workspaces/current/members/{userId}`
- `DELETE /api/v1/workspaces/current/members/{userId}`
- `GET /api/v1/workspaces/current/invitations`
- `POST /api/v1/workspaces/current/invitations`
- `DELETE /api/v1/workspaces/current/invitations/{invitationId}`
- `POST /api/v1/workspaces/invitations/{token}/accept`

### Subscription / usage

- `GET /api/v1/billing/plans`
- `GET /api/v1/billing/me`
- `GET /api/v1/workspaces/current/dashboard`
- `GET /api/v1/credits/ledger`
- `GET /api/v1/billing/payments`

### Collaboration

- realtime websocket room
- Yjs document updates
- awareness / presence
- focused occupancy

这些全部复用已有的 membership / board permission，不允许自行绕过。

## 9.4 自删 / 管理员删号 blocker 模型

这一层建议尽快结构化，不要只返回模糊报错：

```text
owned_team_workspace
owned_group_workspace
joined_team_workspace
joined_group_workspace
active_team_seat
active_subscription
orphaned_invites
```

---

## 10. 前端需要做的事情

## 10.1 文案和口径收口

必须统一替换：

- 把“Group subscription”替换成：
  - `Personal collaboration`
  - `My credits`
  - `My personal plan`
- 把容易引导误解的“owner subscription”文案删掉
- Invite 页显式显示扣费归属

## 10.2 页面职责收口

- `/team` 只做 Team 目录
- `/group` 只做 Group 目录 + personal summary
- `Subscription`（当前可沿用 `/billing` route）只做 plan catalog / compare / purchase / upgrade
- `/usage` 做 active personal/team plans + credits / ledger / payment / top-up / seat purchase
- `/team/[id]` 和 `/group/[id]` 才做管理面板

## 10.3 组件拆分建议

### Team / Group 目录层

```text
WorkspaceDirectoryPage
  -> WorkspaceDirectoryView
  -> WorkspaceDirectoryActions
  -> WorkspaceCard
  -> PersonalSummaryCard (Group only)
```

### Team / Group 详情层

```text
WorkspaceDashboardView
  -> WorkspaceDashboardBoardsPanel
  -> WorkspaceMembersPanel
  -> WorkspaceInvitePanel
  -> WorkspaceSettingsPanel
  -> WorkspaceUsagePanel
```

### Collaboration 层

```text
Board page
  -> Presence header roster
  -> Cursor overlay
  -> Selection / transform preview
  -> Focused edit occupancy hint
```

## 10.4 UI 交互建议

- Invite panel:
  - 默认分页 / 分组显示 `pending / accepted / revoked`
  - 每条 invite 展示 target role、创建时间、board target、copy link、revoke
- Members panel:
  - owner/admin/editor/viewer 标签统一
  - 移除成员要有确认 modal
- Settings panel:
  - rename / delete / transfer owner
  - delete 的说明统一成和 profile delete 一样的确认 modal 风格

---

## 11. 建议测试矩阵

在开始大规模协同测试前，我建议至少把下面这组 smoke matrix 跑完。

## 11.1 Free 用户基础矩阵

| 场景 | 预期 |
| --- | --- |
| Free 用户注册 | 得到 solo workspace + registration credits |
| Free 用户创建第 1 个 Group | 成功 |
| Free 用户创建第 2 个 Group | 被限制 |
| Free 用户加入别人 Team | 成功，只要 Team 有 seat |
| Free 用户加入别人 Group | 成功，只要 Group 未满 |

## 11.2 Team 矩阵

| 场景 | 预期 |
| --- | --- |
| Owner 创建 Team | 成功，生成 team workspace + team wallet |
| Admin 发 invite | 成功 |
| Viewer 发 invite | 拒绝 |
| Free 用户接受 Team invite | 成功 |
| Team seat 满后再接受 invite | 拒绝 |
| Team Board 中 AI 运行 | 扣 Team wallet |

## 11.3 Group 矩阵

| 场景 | 预期 |
| --- | --- |
| Free 用户创建 Group | 成功 |
| Collaborate Start 用户创建第 10 个 Group | 成功 |
| Collaborate Start 用户创建第 11 个 Group | 拒绝 |
| 已拥有 Group 的 free 用户加入别人 Group | 成功 |
| Group Board 中 AI 运行 | 扣 actor personal wallet |
| Group owner 查看别的成员个人 credits | 不允许 |

## 11.4 Invite 矩阵

| 场景 | 预期 |
| --- | --- |
| pending invite | 可复制、可打开、可撤回 |
| accepted invite | 状态变 accepted |
| revoked invite | 无法再次接受 |
| expired invite | 无法接受 |
| 带 boardId 的 invite | 接受后直达对应 board |

## 11.5 Admin 价格 / 成员管理矩阵

| 场景 | 预期 |
| --- | --- |
| Admin 修改 Free Canvas 月付 / 年付 / 注册赠送积分 | plan catalog 更新，前后端展示同步 |
| Admin 修改 Collaborate Start/Plus 月付 / 年付 / included credits | personal plan 额度与展示同步 |
| Admin 修改 Team Start/Growth 月付 / 年付 / included credits per seat | Team plan card、checkout、usage 同步 |
| Admin 修改 group cap / seat cap / board/page cap | create / invite / checkout 校验按新阈值生效 |
| Admin 查看 pending / accepted / revoked invites | 状态明确可见 |
| Admin add member / remove member / change role | row state 立即反映 |
| Admin `Join Team` / `Join Group` | 通过 workspace lookup 成功加入 |
| Admin Team owner transfer | 仅 Team 路径允许 |
| Admin Group owner transfer | 继续拒绝 |
| Collaborate / Team 订阅 credits 到达下一个 30 天周期 | 刷新当期 included credits，不累加上周期未用部分 |

## 11.6 Collaboration 前置矩阵

| 场景 | 预期 |
| --- | --- |
| 同 Team 两用户进入同一 Board | 可见 presence |
| 同 Group 两用户进入同一 Board | 可见 presence |
| viewer 进入 Board | 可看 cursor，不可发写入 |
| editor 进入 Board | 可发写入 |
| focused edit 被占用 | 第二个用户看到 occupied 提示 |

---

## 12. 我建议的实施顺序

如果你问我现在最合理的顺序，我建议是：

### Phase A: 先把已确认口径灌回主文档和实现口径

1. 回写本文档中的 confirmed baseline 到 PRD / ARCH / project_state
2. 把前端所有 Group `subscription / owner subscription` 残留文案收掉
3. 把 invite accept / billing / entitlement / delete blocker 的描述全部统一成同一套语言

### Phase B: 收 S3 地基

1. 对齐 Team / Group / Billing / Usage 的页面职责
2. 结构化 account deletion blockers
3. 收紧 Group / Team owner transfer 边界
4. 对齐 plan upgrade / top-up additive 语义
5. 把 Admin plan catalog 的月付 / 年付 / included credits / 注册赠送积分控制链路写实并跑 smoke
6. 把 Team / Group member management 全链路按 operator + end-user 两条线一起验收

### Phase C: 再测 Invite / Membership

1. Team / Group invite smoke matrix
2. Free / paid / joined / owner/admin 的回归矩阵
3. staging 上的真实账号双人测试

### Phase D: 再进 S4 Collaboration

1. Team / Group 同 board presence
2. 多人 cursor + 名字 + 颜色
3. focused edit occupancy
4. optimistic page-scoped Yjs

---

## 13. 本轮已经拍板并应当回写实现的关键口径

1. `Free 用户不能创建 Team，但可以加入别人 Team`
2. `Free 用户可以创建 1 个 Group，也可以加入别人已有 Group`
3. `Group 成员上限统一 15`
4. `free_canvas` 只能创建 1 个 Group，且该 Group 最多 1 个 Board、每个 Board 最多 3 个 Page
5. `Group 是协作结构，不是独立共享钱包`
6. `Group 内 AI 永远扣当前操作者自己的 personal credits`
7. `Team 内 AI 永远扣 Team wallet`
8. `Invite accept 不看被邀请者是不是 free，只看目标 workspace capacity / status`
9. `Collaborate Start / Plus 只扩 Group 数量和个人 credits`
10. `Team included credits 固定按每 seat 一份 credit pack 计算`
11. `Group 页面移除 subscription 文案，只保留 My personal plan / My credits`
12. `upgrade 赠送 credits 采用增量叠加；已有 top-up credits 保留`

---

## 14. 我的结论

我的结论现在也已经更明确了：

**这条 Team / Group / Billing / Invite 基线已经确认，下一步不是继续讨论，而是全面回写和验收。**

在继续把协同往更深的 Yjs / conflict policy / occupancy 方向推进之前，需要先确保下面这条业务底板在前后端、文案、测试矩阵里完全一致：

- 谁能创建 Team / Group
- 谁能加入 Team / Group
- Group 到底是不是共享钱包
- Team / Group 内 AI 到底扣谁的钱
- Invite accept 到底看什么，不看什么
- free_canvas 的 Group / Board / Page 容量边界
- upgrade / top-up 的 credits 叠加语义
- owner transfer、delete blocker、成员移除这些治理边界

因为一旦多人协同开始大规模验收，所有模糊规则都会立刻变成真实缺陷：

- 谁能进房间
- 谁能发 invite
- 谁能删人
- 谁的 AI 能跑
- 跑了扣谁的钱
- 账号删不掉到底卡在哪里

这些现在已经定死，所以这一轮应把这份文档当成：

1. 产品口径统一底稿
2. 前后端改造蓝图
3. 协同测试前置清单

并把已确认内容分别灌回：

- `PRD/PRD_slice_S3_admin_billing_analytics.md`
- `ARCH/ARCH_slice_S3_admin_billing_analytics.md`
- `PRD/PRD_slice_S4_collaboration.md`
- `ARCH/ARCH_slice_S4_collaboration.md`
- `project_state/project_state_slice_S3_admin_billing_analytics.md`
- `project_state/project_state_slice_S4_collaboration.md`
