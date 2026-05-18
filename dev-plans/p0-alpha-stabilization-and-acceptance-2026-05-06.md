# P0 Alpha Stabilization And Acceptance

**Updated**: 2026-05-18
**Status**: Active stabilization spine for the current release pass.
**Branch**: `feature/s1c-auth-admin-production-boundary`

## Goal

Reduce the product back to one clear P0 alpha spine, stop treating every scaffold as a launch promise, and give engineering, QA and product one shared definition of what counts as "done enough for this pass".

## P0 Alpha Release Spine

Only these four lanes are release-critical for the current pass:

| Lane | Release requirement | Current state | Remaining gate |
| --- | --- | --- | --- |
| Canvas / Board / Page / Share / Auth | Public landing, Clerk entry, protected workspace shell, Konva-only Board route, page/history flows, public share view, permission-scoped Board CRUD | Staging Web/API/Supabase Pro/R2 plus real session/admin smoke are green; signed-in board/browser and Google/email acceptance remain | Finish the remaining browser/Auth regression sweep and deployment cleanup |
| One real AI provider path | One server-backed AI image path through AiRun, preflight, provider execution, Asset output and settlement | Runtime shell, quote, ledger and provider adapter scaffold exist; Jiekou-first local fast path proves chat, prompt optimization, image generation/edit/reference and analysis UX in the canvas, Prompt Optimizer now has a backend short-text `AiRun` path with durable `text_output`, and the active image-generation lane is refreshed onto GPT Image 2 / Nano Banana 2 / Doubao Seedream / Jimeng | Finish staging/browser smoke, then hand-test one live provider path end to end |
| Billing mock + usage / ledger visible | Public visitors can see pricing before sign-up; authenticated users can see plan, payer, included credits, top-up balance, ledger activity and workspace usage visibility rules | First-pass stable locally; public `/pricing` now exposes the plan shape without checkout, while Team wallet semantics and internal usage surfaces remain the next S3 gate | Keep public pricing honest as beta/waitlist; real payments, taxes, invoices and MoR/checkout stay deferred |
| Admin minimum operating surface | Server-gated `/admin`, summary/users/workspaces/boards/audit plus first-pass AI model/route/pricing/runtime inspection | First-pass stable locally | Keep server-gated, audited and bounded; deeper finance/admin tooling stays deferred |

Release rule:

- If work does not directly tighten one of these four lanes, it is deferred or frozen unless it blocks a release-critical fix.

## Shipping Now

### 1. Canvas / Board / Page / Share / Auth

- Public landing at `/`.
- Clerk sign-in and sign-up entry.
- Protected product shell for `/workspaces`, `/boards/[boardId]`, `/billing`, `/team`, `/usage`, `/account`, `/settings`, `/collections`, `/admin`.
- Konva-only formal Board route.
- Board save, autosave, history, restore and clean.
- Page drawer create/switch/rename/delete/reorder.
- `Move to page` first pass.
- Public view-only share entry at `/share/[shareId]`.
- Server-backed Board/member/share contracts with the current `none/view/edit/manage/owner` model.

### 2. One Real AI Provider Path

- Server-side AiRun quote/preflight.
- Server-side payer resolution and ledger-aware settlement boundary.
- Persisted `ai_runs`, attempt-level `ai_api_calls` and `api_cost_ledger`.
- First live provider adapter path for one image-generation flow.
- Active image-generation surface is limited to GPT Image 2, Nano Banana 2, Doubao Seedream 5.0 Lite and Jimeng 4.0, with the long-running image timeout boundary at 240s.
- Generated result persists as Asset refs; Board/node state stores only compact summaries and refs.
- Current Jiekou-first canvas-facing path is accepted as UX proof only; production reliance requires the unified server AiRun route and settlement path.

### 3. Billing Mock + Usage / Ledger Visible

- `/pricing` is public and linked from the landing nav/footer so subscription positioning is visible before registration.
- `/billing` shows current plan, included credits, remaining credits, top-up balance and payer summary.
- `/usage` shows ledger activity, filters and workspace-vs-personal usage drill-down.
- `/team` shows Group/Team workspace visibility differences plus first-pass seat/member controls.
- S3 implementation must now treat Team plans as Team-wallet backed and Group/Collaborate as personal-wallet backed.
- Internal ledger mutation helpers remain valid for grants, top-ups, usage and refunds, even while public payment provider flows stay mocked/manual.
- Public pricing CTAs must not start a live checkout until provider, tax, invoice, refund and legal review are ready.

### 4. Admin Minimum Operating Surface

- `/admin` is server-gated.
- Summary, users, workspaces, boards and audit reads exist.
- Owner-only role grant/revoke stays audited.
- AI control-plane facts can be inspected and edited in first pass: models, provider routes, pricing rules, runtime attempts and publish/rollback history.

## Deferred / Frozen For This Pass

These are intentionally not part of the current P0 alpha promise:

- Real-time collaboration / Yjs room sync / presence / multi-user live canvas.
- Full production provider coverage across image gen, image gen 4, analysis, text persistence and refund depth beyond the current Jiekou-first local proof, the refreshed four-model image lane and the first live server smoke route.
- Real external payment provider integration, invoices, webhooks, renewals and reconciliation.
- Full Team governance, Team wallet payment automation, enterprise pooled charging, advanced billing operations and finance workflows.
- Collections as a real asset-library product.
- Settings as a primary navigation destination.
- `/home` as a separate product destination.
- `/spikes/*` as anything other than development-only routes.
- Page duplicate, rendered page-thumbnail assets, Move selection to new page and page-scoped collaboration.
- Broad Admin analytics, moderation queues, impersonation and deep finance tooling.

Freeze rule:

- Placeholder routes may remain in the codebase, but they must not read like first-class release promises in the main navigation or the canonical docs.

## Page Entry Map

| Route | Audience | Status | Notes |
| --- | --- | --- | --- |
| `/` | Public | Shipping now | Primary landing page before Auth |
| `/pricing` | Public | Shipping now | Public subscription/pricing page before Auth; beta/waitlist CTAs only, no live checkout |
| `/privacy` / `/terms` / `/ai-policy` | Public | Shipping now as draft policy pages | Product/legal drafts linked from public nav/footer; final operator/company details and counsel review pending |
| `/sign-in` / `/sign-up` | Public | Shipping now | Clerk entry surfaces |
| `/workspaces` | Authenticated product user | Shipping now | Main workspace gallery/list shell |
| `/boards/[boardId]` | Authenticated product user | Shipping now | Formal Konva-only Board runtime |
| `/share/[shareId]` | Public viewer | Shipping now | View-only shared Board entry |
| `/billing` | Authenticated product user | Shipping now | First-pass billing and top-up visibility |
| `/team` | Authenticated product user | Shipping now | Group/Team visibility and seat/member first pass |
| `/usage` | Authenticated product user | Shipping now | Ledger and usage drill-down |
| `/admin` | Global admin only | Shipping now | Server-gated bounded operator surface |
| `/account` | Authenticated product user | Secondary | Useful account/profile surface, not a release headline |
| `/collections` | Authenticated product user | Frozen placeholder | Hidden from primary nav until real asset-library work exists |
| `/settings` | Authenticated product user | Secondary / frozen | Hidden from primary nav; still a truthful environment/preferences surface |
| `/home` | None | Retired | Redirects to `/` |
| `/dashboard` | None | Redirect only | Redirects to `/workspaces` |
| `/spikes/konva-canvas` | Internal dev only | Dev-only | Never treat as product entry |

## Document Archive Actions

- New active stabilization spine: this file.
- Archive: `Archive/s1-launch-readiness-and-acceptance-report-2026-05-05.md` as historical cross-slice checklist.
- Archive: `Archive/s1x-canvas-engine-migration-reference-2026-05-03.md` as historical migration context.
- Keep active: `s2-ai-provider-route-billing-control-plane-2026-05-07.md` as the tactical checklist for folding Jiekou-first and future providers into server-owned route switching, credit settlement and admin observability.
- Keep active: `s3-team-group-wallets-membership-billing-plan-2026-05-08.md` as the tactical checklist for Team wallet, personal Collaborate wallet, invites, seats, membership and payer resolver.
- Archive: `s1-s3-document-consolidation-report-2026-05-06.md` after this stabilization pass, because its purpose is historical and parts of its S2/S3 truth are already stale.

## Test And Risk Matrix

| Lane | What to hand-test now | Main risk | Release decision |
| --- | --- | --- | --- |
| Auth + entry flow | Landing -> sign in -> workspace redirect; protected route gating; sign-out return to landing | Mixed public/protected routing can confuse the product story | Must pass before P0 alpha claim |
| Public pricing + legal | Landing -> `/pricing`, `/privacy`, `/terms`, `/ai-policy`; no-auth access; no live checkout | Public pages can accidentally over-promise commercial readiness | Accept as beta disclosure only; paid checkout remains blocked |
| Board + Page + Share | Create/open/save/history/restore; page create/rename/delete/reorder; `Move to page`; public share open | Permission edge cases, page regressions and stale runtime-edge behavior | Must pass before P0 alpha claim |
| AI runtime | Quote/preflight, payer summary, one real provider path, Asset result persistence, no raw payloads in Board | Local Jiekou-first route proves UX but can bypass the intended production control plane if left unreconciled | One server AiRun live path must pass before P0 alpha claim |
| Billing + usage | Billing summary, top-up mock flow, ledger filters, usage drill-down, Team/Group visibility rules | Over-promising real billing when flows are still mocked/manual | Accept as first-pass only; do not market as real payments |
| Admin | Server gate, summary/audit reads, role management, AI route/pricing/runtime inspection | Expanding `/admin` too fast makes it look more complete than it is | Accept as minimum operator surface only |
| Deferred areas | Collaboration, Collections, deep finance, broad provider coverage | Users may assume these exist if docs/nav are noisy | Keep clearly frozen and out of the main promise |

## What Can Be Accepted Now

### Accepted now as first-pass product behavior

1. Public landing -> Auth entry -> protected workspace flow.
2. Public pricing and draft legal/policy pages reachable without registration.
3. Konva-only Board editing, save/load/history and public share viewing.
4. Page management first pass.
5. First-pass billing, team and usage visibility surfaces.
6. First-pass server-gated admin/operator surface.

### Not yet acceptable to claim as done

1. True multi-user live collaboration.
2. Real external billing and subscription automation.
3. Broad real AI coverage across all node types.
4. Deep Team governance or enterprise administration.
5. Full asset-library/Collection productization.
6. Legally finalized Privacy/Terms/AI policy text with final operator address, support contact and counsel sign-off.

## Clear Acceptance Guide For The Current Build

### A. Visitor and Auth

1. Open `/`.
2. Confirm landing page is the first screen.
3. Open `/pricing`, `/privacy`, `/terms` and `/ai-policy` while signed out; confirm each page loads without registration.
4. Confirm `/pricing` shows public subscription containers but does not trigger live checkout.
5. Use `/sign-in` or `/sign-up`.
6. After successful Auth, confirm the user can reach `/workspaces`.
7. Confirm protected routes redirect when web auth is required and the user is not signed in.

### B. Workspace, Board, Pages and Share

1. Open `/workspaces`.
2. Create or open a Board.
3. In `/boards/[boardId]`, verify:
   - save/autosave
   - history snapshot/create/restore/clean
   - page create/switch/rename/delete/reorder
   - `Move to page`
4. Create a share link and open `/share/[shareId]` in a signed-out browser.
5. Confirm share view is read-only and page switching still reflects the saved Board state.

### C. Billing, Team and Usage

1. Open `/billing` and confirm the current plan, payer label and credit summary render.
2. Trigger the first-pass top-up flow and confirm the UI updates honestly as a mock/manual flow.
3. Open `/usage` and confirm ledger rows, filters and usage drill-down render.
4. Open `/team` and confirm the workspace mode explains whether member usage is private or admin-visible.

### D. Admin

1. Confirm non-admin users cannot use `/admin`.
2. Confirm admin users can load:
   - summary
   - users
   - workspaces
   - boards
   - audit logs
   - AI model/route/pricing/runtime panels
3. Confirm role-management writes stay owner-only and audited.

### E. AI

Current acceptance split:

- Accept now:
  - quote/preflight
  - payer summary
  - persisted run lifecycle shell
  - runtime/admin observability
  - local Jiekou-first UX proof for chat, prompt optimization, image generation/edit/reference and analysis
- Remaining gate before P0 alpha is complete:
- one real provider-backed server AiRun image path from run request to Asset output and settlement, using one of the refreshed active image models

## Remaining Gates Before Calling P0 Alpha Done

1. Finish signed-in board/browser acceptance on staging.
2. Finish Google/email plus CORS/origin acceptance.
3. Hand-test one real AI provider image path through the refreshed four-model image lane.
4. Return to S1D/S3 closeout: permission edges, payer visibility, billing language, staged payment truth and usage surfaces.
5. Keep collaboration and other frozen lanes out of the release promise.

## Ordered Acceptance Checklist

### 1. Signed-in board/browser second round

- [ ] Open staging in an incognito window and sign in with Google.
- [ ] Land on `/workspaces` without falling back to any dev-bypass path.
- [ ] Open an existing private Board, make a small edit, return to `/workspaces`, then reopen the same Board.
- [ ] Confirm the solo reopen flow does not surface a false `remote update / use remote / keep mine` chooser; if it still appears, record it as a blocking Board/browser bug.
- [ ] Create or refresh Board History, reopen the History panel and confirm the latest save row and preview remain visible after reload.
- [ ] Confirm thumbnail persistence is truthful after save, refresh and reopen.
- [ ] Confirm Free-plan Board limit actions such as create/copy use the centered plan-limit dialog rather than a top-page error. Implementation now covers workspace gallery plus workspace dashboard/manage-panel paths; staging browser confirmation still pending.
- [ ] Confirm private Board owner actions still work, especially delete/copy, while unauthorized actions remain blocked.
- [ ] Paste or upload an image, wait for the placeholder/upload state to finish, then refresh and reopen to confirm persistence.

### 2. Google/email plus CORS/origin

- [ ] Sign out, then sign back in with the same Google account and confirm the same local TANGENT user/workspace memberships are reused.
- [ ] Run one email-based staging auth flow and confirm the message reaches the test inbox.
- [ ] Complete the email link/code flow and confirm it returns to staging and lands in `/workspaces`.
- [ ] Confirm `/api/auth/session` still returns the expected signed-in session shape after the email flow.
- [ ] Confirm FastAPI rejects an invalid, expired or wrong-origin token with `401`.
- [ ] Reconfirm `NEXT_PUBLIC_API_BASE_URL`, API CORS, Clerk allowed origins and Clerk authorized parties all match the exact staging domains.

### 3. One real AI provider image smoke

- [ ] Pick one active image model from `gpt-image-2`, `nano-banana-2`, `doubao-seedream-5.0-lite` or `jimeng_t2i_v40`.
- [ ] Run one real staged `Prompt -> Image Gen -> Image` flow through the server-owned AiRun path.
- [ ] Confirm quote/preflight, provider execution, final status and Asset creation all complete on staging.
- [ ] Refresh or reopen the Board and confirm the generated result reloads from persisted Asset refs instead of temporary local state.
- [ ] Confirm failed-provider behavior stays user-readable and writes a durable failed run state rather than silently succeeding.

### 4. Return to S1D/S3 closeout

- [ ] Recheck Free/Private/Team/Group visibility and entitlement language against the current product rules.
- [ ] Recheck payer visibility and usage wording on `/billing`, `/usage` and `/team`.
- [ ] Recheck Board permission edge cases that affect paid limits or owner-only actions.
- [ ] Keep payment language honest as mocked/manual until real provider-backed settlement is ready.
- [ ] Replace public `/pricing` static catalog with the backend public plan-catalog read if admin-edited prices must be launch-authoritative.

Non-urgent follow-on work:

- useful backlog items should be written into the relevant slice / plan docs first, then revisited after the ordered gates above
- do not let post-alpha collaboration, deep finance or secondary polish interrupt the release spine sequence

## Follow-On Development After Current Gates

These items are intentionally documented now, but should wait until the ordered acceptance checklist above is green:

- Free/Private/Team/Group entitlement hardening across create/copy/delete/invite/member visibility.
- Team wallet vs personal Collaborate wallet product language and UI consistency.
- Payment-system completion: hosted checkout truth, webhook settlement, invoice/refund depth and production billing automation.
- Admin/operator refinement for user status, subscription actions, finance reconciliation and plan-change observability.
- Board/browser polish that is useful but not release-blocking: thumbnail quality, history presentation, conflict messaging, plan-limit UX and workspace empty/loading states.
- Broader AI provider coverage and deeper model-route operations after the first live staged image smoke is stable.
- S4 collaboration/provider work only after Auth, Board, Asset and AiRun authority boundaries are stable.

## 中文完整翻译

# P0 Alpha 稳定化与验收

**更新日期**：2026-05-18
**状态**：当前发布轮次的活跃稳定化主线文档。
**分支**：`feature/s1c-auth-admin-production-boundary`

## 目标

把产品重新收回到一条清晰的 P0 alpha 主线，不再把每个 scaffold 都当成上线承诺，并且让工程、测试和产品对“这一轮什么算完成”有一份共享定义。

## P0 Alpha 发布主线

当前这一轮，只有下面四条线属于发布关键路径：

| 线路 | 发布要求 | 当前状态 | 剩余闸门 |
| --- | --- | --- | --- |
| Canvas / Board / Page / Share / Auth | 公开 landing、Clerk 登录入口、受保护的 workspace shell、Konva-only Board 路由、page/history 流程、公开 share 查看和按权限收口的 Board CRUD | staging Web/API/Supabase Pro/R2 与真实 session/admin smoke 已转绿；signed-in board/browser 与 Google/email 验收仍待完成 | 完成剩余浏览器/Auth 回归和部署清理 |
| 一个真实 AI provider 路径 | 一条经由 AiRun、preflight、provider execution、Asset 输出和 settlement 的服务端 AI 图像路径 | runtime shell、quote、ledger 和 provider adapter scaffold 已存在；Jiekou-first 本地 fast path 已在画布里证明 chat、prompt optimization、image generation/edit/reference 和 analysis UX，Prompt Optimizer 也已有带 durable `text_output` 的后端短文本 `AiRun`，活跃生图线已刷新到 GPT Image 2 / Nano Banana 2 / Doubao Seedream / Jimeng | 先完成 staging/browser smoke，再端到端手测一条真实 provider 路径 |
| Billing mock + usage / ledger 可见 | 用户能看到 plan、payer、included credits、top-up 余额、ledger 活动和 workspace usage 可见性规则 | 本地第一阶段稳定，但 Team wallet semantics 是下一道 S3 闸门 | 保持 mock/manual payment 路径诚实；真实支付继续后置 |
| Admin 最小可运营面 | 服务端门控的 `/admin`，带 summary/users/workspaces/boards/audit，以及第一阶段 AI model/route/pricing/runtime 检查面 | 本地第一阶段稳定 | 持续保持 server-gated、audited 且边界有限；更深 finance/admin 能力后置 |

发布规则：

- 如果某项工作不能直接收紧这四条线之一，那么它就属于 deferred 或 frozen，除非它阻塞了发布关键修复。

## 当前必须交付

### 1. Canvas / Board / Page / Share / Auth

- `/` 公开 landing。
- Clerk sign-in 和 sign-up 入口。
- `/workspaces`、`/boards/[boardId]`、`/billing`、`/team`、`/usage`、`/account`、`/settings`、`/collections`、`/admin` 的受保护 product shell。
- Konva-only 正式 Board 路由。
- Board save、autosave、history、restore 和 clean。
- Page 抽屉的 create/switch/rename/delete/reorder。
- `Move to page` 第一阶段。
- `/share/[shareId]` 的公开只读共享入口。
- 带当前 `none/view/edit/manage/owner` 模型的服务端 Board/member/share 合同。

### 2. 一个真实 AI Provider 路径

- 服务端 AiRun quote/preflight。
- 服务端 payer resolution 和带 ledger 感知的 settlement 边界。
- 持久化的 `ai_runs`、按 attempt 分行的 `ai_api_calls` 和 `api_cost_ledger`。
- 一条 image-generation 流程的第一条 live provider adapter 路径。
- 活跃生图产品面当前只包含 GPT Image 2、Nano Banana 2、Doubao Seedream 5.0 Lite 和 Jimeng 4.0，长耗时生图超时边界是 240s。
- 生成结果以 Asset refs 方式落地；Board/node state 只保存 compact summaries 和 refs。
- 当前 Jiekou-first 画布路径只按 UX proof 验收；生产依赖必须走统一的服务端 AiRun route 和 settlement path。

### 3. Billing Mock + Usage / Ledger 可见

- `/billing` 展示当前 plan、included credits、remaining credits、top-up balance 和 payer summary。
- `/usage` 展示 ledger activity、filters 和 workspace-vs-personal usage drill-down。
- `/team` 展示 Group/Team workspace 可见性差异，以及第一阶段 seat/member controls。
- S3 implementation 现在必须把 Team plans 当作 Team-wallet backed，把 Group/Collaborate 当作 personal-wallet backed。
- 即使 public payment provider flows 仍保持 mocked/manual，内部 ledger mutation helpers 也必须继续对 grants、top-ups、usage 和 refunds 保持有效。

### 4. Admin 最小可运营面

- `/admin` 必须是 server-gated。
- summary、users、workspaces、boards 和 audit 读取存在。
- owner-only role grant/revoke 持续保持 audited。
- 第一阶段可以在后台查看并编辑 AI control-plane facts：models、provider routes、pricing rules、runtime attempts 和 publish/rollback history。

## 本轮延后 / 冻结项

下面这些内容明确不属于当前 P0 alpha 承诺：

- real-time collaboration / Yjs 房间同步 / presence / 多人实时画布。
- 超出当前 Jiekou-first 本地证明、刷新后的四模型生图线和第一条服务端 live smoke route 的完整生产 provider 覆盖，包括 image gen、image gen 4、analysis、text persistence 和 refund depth。
- 真实外部 payment provider integration、发票、webhooks、renewals 和 reconciliation。
- 完整的 Team governance、Team wallet payment automation、enterprise pooled charging、高级 billing operations 和 finance workflows。
- 作为真实资产库产品的 Collections。
- 作为主导航目的地的 Settings。
- 作为独立产品目的地的 `/home`。
- 把 `/spikes/*` 当成任何正式产品入口。
- page duplicate、真实渲染的 page-thumbnail assets、Move selection to new page 和 page-scoped collaboration。
- 广义 Admin analytics、moderation queues、impersonation 和深层 finance tooling。

冻结规则：

- Placeholder routes 可以继续保留在代码里，但它们不能在主导航或 canonical docs 里读起来像第一层发布承诺。

## 页面入口地图

| 路由 | 面向对象 | 状态 | 说明 |
| --- | --- | --- | --- |
| `/` | 公开访客 | 当前交付 | Auth 前的主 landing page |
| `/sign-in` / `/sign-up` | 公开访客 | 当前交付 | Clerk 入口界面 |
| `/workspaces` | 已认证产品用户 | 当前交付 | 主 workspace gallery/list shell |
| `/boards/[boardId]` | 已认证产品用户 | 当前交付 | 正式 Konva-only Board runtime |
| `/share/[shareId]` | 公开查看者 | 当前交付 | 只读 shared Board 入口 |
| `/billing` | 已认证产品用户 | 当前交付 | 第一阶段 billing 与 top-up 可见面 |
| `/team` | 已认证产品用户 | 当前交付 | Group/Team 可见性与 seat/member 第一阶段 |
| `/usage` | 已认证产品用户 | 当前交付 | ledger 与 usage drill-down |
| `/admin` | 仅全局管理员 | 当前交付 | 服务端门控的有限运营面 |
| `/account` | 已认证产品用户 | 次级 | 有用的 account/profile 页面，但不是发布 headline |
| `/collections` | 已认证产品用户 | 冻结占位页 | 在真正 asset-library 工作存在前，不再出现在主导航 |
| `/settings` | 已认证产品用户 | 次级 / 冻结 | 从主导航隐藏；仍保留为诚实的 environment/preferences 页面 |
| `/home` | 无 | 退役 | 重定向到 `/` |
| `/dashboard` | 无 | 仅重定向 | 重定向到 `/workspaces` |
| `/spikes/konva-canvas` | 仅内部开发 | 仅开发 | 绝不作为产品入口对外描述 |

## 文档归档动作

- 新的活跃稳定化主线：本文件。
- 归档：`Archive/s1-launch-readiness-and-acceptance-report-2026-05-05.md`，作为历史 cross-slice checklist。
- 归档：`Archive/s1x-canvas-engine-migration-reference-2026-05-03.md`，作为历史迁移背景。
- 保持活跃：`s2-ai-provider-route-billing-control-plane-2026-05-07.md`，作为把 Jiekou-first 和后续 providers 收口到服务端 route switching、credit settlement 和 admin observability 的战术 checklist。
- 保持活跃：`s3-team-group-wallets-membership-billing-plan-2026-05-08.md`，作为 Team wallet、personal Collaborate wallet、invites、seats、membership 和 payer resolver 的战术 checklist。
- 归档：`s1-s3-document-consolidation-report-2026-05-06.md`，因为它的作用已经转为历史记录，而且其中部分 S2/S3 事实已经过时。

## 测试与风险矩阵

| 线路 | 现在要手测什么 | 主要风险 | 发布判断 |
| --- | --- | --- | --- |
| Auth + entry flow | Landing -> sign in -> workspace redirect；protected route gating；sign-out return to landing | 公共/受保护路由混杂会让产品故事变乱 | 在宣称 P0 alpha 前必须通过 |
| Board + Page + Share | Create/open/save/history/restore；page create/rename/delete/reorder；`Move to page`；public share open | 权限边界、page regressions 和 stale runtime-edge 行为 | 在宣称 P0 alpha 前必须通过 |
| AI runtime | Quote/preflight、payer summary、一条真实 provider path、Asset result persistence、Board 不含 raw payloads | 本地 Jiekou-first route 已证明 UX，但如果不收口会绕过目标生产 control plane | 一条 server AiRun live 路径必须通过，才能叫 P0 alpha 完成 |
| Billing + usage | Billing summary、top-up mock flow、ledger filters、usage drill-down、Team/Group visibility rules | 容易把 mocked/manual 的计费说得像真实支付 | 只能按第一阶段能力验收；不能当成真实支付能力宣传 |
| Admin | Server gate、summary/audit 读取、role management、AI route/pricing/runtime inspection | `/admin` 扩太快会让它看起来比实际更完整 | 只按最小 operator surface 验收 |
| Deferred areas | Collaboration、Collections、deep finance、broad provider coverage | 如果 docs/nav 太吵，用户会误以为这些已经可用 | 必须持续冻结并从主承诺里剔除 |

## 现在能验收什么

### 现在可以作为第一阶段产品行为验收的

1. Public landing -> Auth entry -> protected workspace 流程。
2. Konva-only Board 编辑、save/load/history 和 public share viewing。
3. Page management 第一阶段。
4. 第一阶段 billing、team 和 usage 可见面。
5. 第一阶段 server-gated admin/operator 面。

### 现在还不能宣称已经完成的

1. 真正的多人实时协作。
2. 真实外部 billing 和 subscription automation。
3. 覆盖全部 node types 的广义真实 AI。
4. 深层 Team governance 或 enterprise administration。
5. 完整的 asset-library/Collection 产品化。

## 在宣称 P0 Alpha 完成前的剩余主线闸门

1. 先完成 signed-in board/browser staging 验收。
2. 再完成 Google/email 与 CORS/origin 验收。
3. 跑通一条刷新后四模型生图线的真实 AI provider image path。
4. 回到 S1D/S3 收口：permission edges、payer visibility、billing language、staged payment truth 和 usage surfaces。
5. collaboration 以及其他 frozen lanes 继续保持在主承诺之外。

不紧急的后续开发规则：

- 有价值但不紧急的 backlog 项目，先写进对应 slice / plan 文档
- 不要让 post-alpha collaboration、deep finance 或 secondary polish 打断这条 release spine 顺序

## 当前版本的明确验收指南

### A. 访客与 Auth

1. 打开 `/`。
2. 确认 landing page 是第一屏。
3. 使用 `/sign-in` 或 `/sign-up`。
4. Auth 成功后，确认用户能够进入 `/workspaces`。
5. 当 web auth 打开且用户未登录时，确认 protected routes 会发生重定向。

### B. Workspace、Board、Pages 与 Share

1. 打开 `/workspaces`。
2. 创建或打开一个 Board。
3. 在 `/boards/[boardId]` 中验证：
   - save/autosave
   - history snapshot/create/restore/clean
   - page create/switch/rename/delete/reorder
   - `Move to page`
4. 创建一个 share link，并在未登录浏览器中打开 `/share/[shareId]`。
5. 确认 share view 是只读的，并且 page 切换仍能正确反映保存后的 Board 状态。

### C. Billing、Team 与 Usage

1. 打开 `/billing`，确认当前 plan、payer label 和 credit summary 正常渲染。
2. 触发第一阶段 top-up flow，并确认 UI 以诚实方式表现为 mock/manual 流程。
3. 打开 `/usage`，确认 ledger rows、filters 和 usage drill-down 正常显示。
4. 打开 `/team`，确认 workspace mode 能清楚解释 member usage 是私有还是 admin 可见。

### D. Admin

1. 确认非 admin 用户不能使用 `/admin`。
2. 确认 admin 用户能够加载：
   - summary
   - users
   - workspaces
   - boards
   - audit logs
   - AI model/route/pricing/runtime 面板
3. 确认 role-management writes 仍然保持 owner-only 且 audited。

### E. AI

当前 AI 的验收分成两层：

- 现在可验收：
  - quote/preflight
  - payer summary
  - persisted run lifecycle shell
  - runtime/admin observability
  - 本地 Jiekou-first UX proof：chat、prompt optimization、image generation/edit/reference 和 analysis
- 在 P0 alpha 完成前仍需补上的闸门：
  - 一条真实 provider-backed server AiRun image path，从 run request 到 Asset output 和 settlement

## 在正式称为 P0 Alpha 完成前，还剩哪些闸门

1. 完成发布主线上的 Auth/staging hardening。
2. 完成 Board/share/page flows 的权限回归扫测。
3. 通过刷新后的四模型生图线，把 Jiekou-first 收口到服务端 provider-route/billing control plane，并手测一条真实 AI provider 路径。
4. 保持 billing/admin 语言诚实：是第一阶段可见面，不是完整商业系统。
5. 把 collaboration 和其他 frozen lanes 持续排除在本轮发布承诺之外。
