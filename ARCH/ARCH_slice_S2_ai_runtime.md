# ARCH Slice S2: AI Runtime

**Updated**: 2026-05-06
**Mode**: Architecture slice.

## Scope

Node Registry, Model Registry, AiRun, provider routing, cost/credit facts and AI Chat planner.

## Contract

```text
Node UI
  -> asks server for model capabilities
  -> creates AiRun request
  -> receives Asset/AiRun summary
  -> writes only short summary and refs to Board document

Server
  -> validates user/workspace/board
  -> resolves workspace kind + permission + charge scope + charged account
  -> selects provider route
  -> calls provider with server-side key
  -> uploads results as Assets
  -> writes AiRun / ai_api_calls / cost ledger
```

## Charge Resolution Rules

- S2 must not guess payer identity in the frontend.
- Before the provider call starts, the server must resolve:
  - `actor_user_id`
  - `workspace_id`
  - `workspace_kind`
  - `board_id`
  - `charged_scope = actor_personal | workspace_pool`
  - `charged_account_id`
- Free, both Collaborate tiers and both Team tiers default to `actor_personal`.
- Enterprise may resolve to `actor_personal` or `workspace_pool` depending on contract.
- Board edit permission alone is not enough to run AI; invited free editors in Group Workspaces still need their own personal subscription credits or top-up balance.
- Team dashboard visibility never changes who pays; Team admins may see usage summaries, but the acting member is still the payer.
- Share-link viewers and non-team external viewers must not trigger paid AI runs in the initial product model.

## Required Expansion Path For New AI Nodes

1. Add/extend Node Registry spec.
2. Add/extend Model Registry capability.
3. Add AiRun request/response schema.
4. Add Next/FastAPI route support.
5. Add provider adapter or mock.
6. Add tests and Board guard checks.
7. Update PRD/ARCH slice files.

## Current State

- Mock Model Registry exists.
- Mock AiRun route exists.
- Mock AiRun responses now include workspace kind, charged scope, charged account id, entitlement source and payer label, so frontend nodes can display the payer contract before real provider execution exists.
- Image Gen / Image Gen 4 model dropdown reads contract.
- Konva runtimeGraph mock flow now exercises Prompt/Image/Chat/Image Gen/Analysis data passing, export ports and generated Asset refs without provider raw payloads.
- Real provider calls, real AiRun persistence and cost logging are not done.

## Launch-Readiness Sequence

1. Keep API keys server-side and choose provider adapter boundaries.
2. Add server-side AiRun persistence and `ai_api_calls` writes before real calls.
3. Add workspace-kind-aware entitlement + charged-account resolution before the provider call.
4. Upload generated outputs as Assets; return Asset refs and short summaries only.
5. Wire Konva Run/Stop UI to AiRun create/poll/cancel.
6. Add provider failure, timeout, rate-limit and cost tests.

## Do Not Do

- Do not call providers from frontend.
- Do not store provider raw responses in Board document.
- Do not let frontend select arbitrary provider routes.
- Do not run real AI without rate limit and cost logging.
- Do not let the provider call start before the server knows who is paying.

## 中文完整翻译

# ARCH 切片 S2：AI 运行时

**更新日期**：2026-05-06
**模式**：架构切片。

## 范围

本切片负责 Node Registry、Model Registry、AiRun、provider routing、成本 / 积分事实，以及 AI Chat planner。

## 合同

```text
Node UI
  -> 向服务端请求模型能力
  -> 创建 AiRun 请求
  -> 收到 Asset / AiRun 摘要
  -> 只把短摘要和引用写回 Board 文档

Server
  -> 校验 user / workspace / board
  -> 解析 workspace kind、权限、扣费范围和被扣费账户
  -> 选择 provider 路由
  -> 使用服务端密钥调用 provider
  -> 把结果上传为 Assets
  -> 写入 AiRun / ai_api_calls / cost ledger
```

## 扣费归属解析规则

- S2 不能让前端猜测“这次该由谁付钱”。
- 在 provider 调用开始之前，服务端必须先解析出：
  - `actor_user_id`
  - `workspace_id`
  - `workspace_kind`
  - `board_id`
  - `charged_scope = actor_personal | workspace_pool`
  - `charged_account_id`
- Free、两个 Collaborate 档位和两个 Team 档位默认都扣 `actor_personal`。
- Enterprise 可以根据合同解析为 `actor_personal` 或 `workspace_pool`。
- 仅有 Board 编辑权限并不等于可以运行 AI；Group Workspace 中被邀请的免费编辑者仍然需要自己的个人订阅积分或充值余额。
- Team dashboard 的可见性不会改变付款方；Team 管理员可以看到 usage 汇总，但真正付款的仍然是当前操作者。
- share-link viewer 和非团队外部 viewer 在初始产品模型中不能触发付费 AI 运行。

## 新 AI 节点的必经扩展路径

1. 新增或扩展 Node Registry 规格。
2. 新增或扩展 Model Registry 能力。
3. 新增 AiRun request / response schema。
4. 增加 Next / FastAPI 路由支持。
5. 增加 provider adapter 或 mock。
6. 增加测试和 Board guard 检查。
7. 更新 PRD / ARCH 切片文档。

## 当前状态

- Mock Model Registry 已存在。
- Mock AiRun route 已存在。
- Mock AiRun response 现在包含 workspace kind、charged scope、charged account id、entitlement source 和 payer label，因此在真实 provider execution 存在之前，前端节点已经可以展示扣费归属合同。
- Image Gen / Image Gen 4 的 model dropdown 已读取该合同。
- Konva runtimeGraph mock 流程现在已经覆盖 Prompt / Image / Chat / Image Gen / Analysis 的数据传递、导出端口，以及生成 Asset refs 的流程，同时不会把 provider 原始载荷写入文档。
- 真实 provider 调用、真实 AiRun 持久化和成本日志仍未完成。

## 上线前顺序

1. 保持 API keys 只在服务端，并先定清 provider adapter 的边界。
2. 在真实调用前，先加上服务端 AiRun 持久化和 `ai_api_calls` 写入。
3. 在 provider 调用前，先加上带 workspace kind 的 entitlement + charged-account 解析。
4. 把生成结果上传成 Assets，只返回 Asset refs 和短摘要。
5. 把 Konva 的 Run / Stop UI 接到 AiRun create / poll / cancel。
6. 增加 provider failure、timeout、rate-limit 和成本测试。

## 明确不要做

- 不要从前端直接调用 provider。
- 不要把 provider 原始响应写进 Board 文档。
- 不要让前端自己选择任意 provider 路由。
- 不要在没有 rate limit 和 cost logging 的情况下接真实 AI。
- 不要在服务端还没知道“谁付钱”之前就开始 provider 调用。
