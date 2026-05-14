# ARCH Slice S2: AI Runtime

**Updated**: 2026-05-14
**Mode**: Architecture slice.

## Scope

Node Registry, Model Registry, AiRun, provider routing, cost/credit facts and AI Chat planner.

## P0 Alpha Boundary

The current alpha requires one real server-side AI image path, not full provider breadth.

- quote/preflight, payer resolution and settlement are release-critical
- one live provider-backed image path is release-critical
- broader analysis/text coverage, refund depth and provider breadth remain deferred

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
  -> resolves model capability + parameter tier + active pricing rule
  -> preflights estimated credits and optionally reserves/charges a hold
  -> selects provider route by admin-configured priority/weight/health
  -> calls provider with server-side key
  -> uploads results as Assets
  -> writes AiRun / ai_api_calls / credit ledger / provider cost ledger
```

## Model, Route And Pricing Control Plane

S2 must be driven by server-owned configuration, not hard-coded frontend price tables.

Required server facts:

```text
model_registry
  model_key                  # stable public product key, for example gpt_image_2
  display_name
  capability                 # image_generation | image_edit | image_analysis | text
  enabled
  default_pricing_rule_id

model_parameter_tiers
  model_key
  tier_key                   # for example 0_5k | 1k | 2k | 4k | low | medium | high
  provider_params            # JSON mapped to provider-native size / quality / output settings
  public_label
  enabled

model_provider_routes
  route_id
  model_key
  provider_key               # openai | proxy_a | proxy_b | future provider
  provider_model
  priority
  weight
  health_status
  timeout_ms
  retry_policy
  enabled

model_pricing_rules
  pricing_rule_id
  model_key
  tier_key
  billing_unit               # per_image | per_output_token | per_input_token | blended
  estimated_credits
  min_credits
  credit_multiplier
  provider_cost_formula
  effective_from
  effective_to
  status
```

Rules:

- The UI may show model choices, parameter tiers and estimated credits, but it must read them from server APIs. When `NEXT_PUBLIC_API_BASE_URL` is configured, the web app must fail closed to backend AI and asset APIs rather than silently falling back to local Next bridges.
- The UI must not send provider names, route ids, raw provider prices or arbitrary price overrides.
- A product model like `gpt_image_2` can have multiple provider routes behind it. The user sees the product model; the server chooses the active route.
- Admins/developer operators can disable a route, change priority/weight, change a provider model mapping and publish a new pricing-rule version without redeploying frontend code.
- Pricing rules must be versioned. An AiRun stores the exact `pricing_rule_id`, `route_id`, estimated credits, charged credits, refunded credits, provider cost and provider currency used at run time.
- Parameter tiers such as `0.5K`, `1K`, `2K` and `4K` are product-facing tiers. Each provider route maps them to provider-native parameters; not every provider must support every tier.
- For providers that return actual usage, the server estimates credits before the call, then settles using actual usage after the provider response. Over-estimates become `usage_refund`; under-estimates require a bounded extra `usage_charge` or a failed/held run according to policy.
- Route failover must never double-charge the user. Retries share one AiRun id, one charge plan and one final settlement.

Runtime flow:

```text
Run request
  -> validate node/run type and board permission
  -> resolve model_key + tier_key from server registry
  -> load active pricing_rule_id and estimate credits
  -> preflight payer balance and permission
  -> choose best enabled provider route by priority/weight/health
  -> call provider
  -> if route fails before provider work starts, retry another healthy route
  -> if provider returns usage/cost, normalize provider facts
  -> settle credit ledger and provider-cost ledger
  -> store Assets and AiRun summary
```

## Charge Resolution Rules

- S2 must not guess payer identity in the frontend.
- Before the provider call starts, the server must resolve:
  - `actor_user_id`
  - `workspace_id`
  - `workspace_kind`
  - `board_id`
  - `charged_scope = actor_personal | team_wallet | workspace_pool`
  - `charged_account_id`
- Free and both Collaborate tiers default to `actor_personal`.
- Team Start/Growth resolve to the active Team workspace wallet.
- Enterprise may resolve to `actor_personal` or `workspace_pool` depending on contract.
- Board edit permission alone is not enough to run AI; invited free editors in Group Workspaces still need their own personal subscription credits or top-up balance.
- Team dashboard visibility never comes from Board admin rights. Team workspace owners/admins may see Team wallet/member usage, while the Team wallet remains the payer for Team runs.
- Share-link viewers and non-member external viewers must not trigger paid AI runs in the initial product model.

Target payer matrix:

```text
solo/free            -> actor personal wallet
group/collaborate   -> actor personal wallet
team                -> active Team wallet
enterprise          -> contract-defined workspace pool or personal fallback
```

## Required Expansion Path For New AI Nodes

1. Add/extend Node Registry spec.
2. Add/extend Model Registry capability.
3. Add parameter-tier and pricing-rule coverage.
4. Add provider-route mapping and fallback policy.
5. Add AiRun request/response schema.
6. Add Next/FastAPI route support.
7. Add provider adapter or mock.
8. Add tests and Board guard checks.
9. Update PRD/ARCH slice files.

## Current State

- Mock Model Registry exists.
- Mock AiRun routes now exist for create/poll/cancel: `POST /api/v1/ai/runs`, `GET /api/v1/ai/runs/{runId}` and `POST /api/v1/ai/runs/{runId}/cancel`.
- Mock AiRun responses now include workspace kind, charged scope, charged account id, entitlement source and payer label, so frontend nodes can display the payer contract before real provider execution exists.
- Mock AiRun now persists a simple lifecycle contract: create queues the run, a background executor moves it through running -> succeeded/failed, GET reads current state without mutating it, and cancel stops queued/running runs.
- A first-pass provider-route execution shell now exists behind that lifecycle: route candidates are resolved from the control plane, a lightweight provider-adapter registry now owns the per-provider attempt boundary, route retry policy is honored inside the shell, and failover now stops on timeouts or work-started failures to avoid duplicate provider work.
- The provider-adapter boundary now also has an opt-in live path: OpenAI-compatible routes can execute server-side image generation/edit calls, Google routes can execute `generateContent`-style requests, and successful image outputs are persisted as Assets through the existing storage adapter.
- Stub-provider execution is now treated as a local/dev/test-only fallback unless explicitly re-enabled. In non-local runtimes such as staging, missing live-provider credentials fail closed instead of returning mock `asset_mock_*` outputs, and present credentials can drive live execution without depending on a separate staging-only mock switch.
- Mock AiRun can optionally exercise real credit-ledger settlement when `TANGENT_AI_MOCK_LEDGER_CHARGING=1` and `DATABASE_URL` are configured: it estimates mock credits, rejects insufficient balance before success and writes a `usage_charge` ledger entry. That settlement now stays bound to the run's originally resolved charged account rather than the later read request context. The default local path still does not charge credits.
- Successful run settlement now also persists normalized `provider_cost` / `provider_currency` onto the final `ai_runs` row and the final successful `ai_api_calls` attempt row, and the shell also writes attempt-level `api_cost_ledger` rows so Admin can inspect supplier-cost facts separately from user-credit charging.
- The text-run path is now shared by both Prompt Optimizer and the message-native Chat node when the canvas is pointed at the FastAPI API: `AiRunRequest` accepts `params.messages`, optional `inputAssetIds` can be inlined server-side for OpenAI-compatible text calls, and terminal short text output is persisted on the run row.
- Migration `20260514_0021_ai_image_model_refresh.py` now aligns the active image-generation catalog to `gpt-image-2`, `nano-banana-2`, `doubao-seedream-5.0-lite` and `jimeng_t2i_v40`. Legacy `gemini-3.1-flash-image-preview` remains compatibility-only and is no longer part of the active image-generation surface.
- The current image-generation route defaults also stretch the live-provider timeout boundary to `240000 ms`, which matches the longer-running staged GeekAI image path instead of the shorter local defaults.
- Image Gen / Image Gen 4 model dropdown reads contract.
- Konva runtimeGraph mock flow now exercises Prompt/Image/Chat/Image Gen/Analysis data passing, export ports and generated Asset refs without provider raw payloads.
- The formal Konva Board runtime now consumes the same lifecycle contract: create returns a server run id, the browser polls `GET /api/v1/ai/runs/{runId}` until terminal state, user stop triggers best-effort `POST /api/v1/ai/runs/{runId}/cancel`, and successful remote image runs hydrate persisted Asset records back into generated node outputs instead of fabricating client-only previews.
- DB-backed control-plane tables, quote-time persistence, persisted mock `ai_runs` rows and attempt-level `ai_api_calls` rows now exist.
- Default backend registry coverage now also includes seeded analysis-capable models/routes/pricing for `gpt-5-mini`, `gpt-4o-mini` and `gemini-2.5-flash`, and unsupported model/run-type combinations now fall back to a supported model or fail instead of silently executing against an unrelated one.
- OpenAI-compatible live execution now accepts `image_analysis` by sending prompt plus inline image refs through `chat/completions`, so live analysis is no longer Google-only at the adapter boundary.
- Local Next AI/upload hardening is now more fail-closed and byte-budgeted: `/api/ai/runs` rejects unsupported text/local mock execution instead of silently fabricating a run, upload routes share bounded request/file readers, chat/image-analysis/image-generation reference images now enforce both per-image and total inline byte budgets before base64 expansion, and backend provider input assets now also enforce a total-byte ceiling so multi-image runs do not scale memory linearly without a hard stop.
- Asset persistence is now moving off `data:` JSON as the primary browser upload contract: board thumbnails, selection captures, runtime asset migration and mock-generated images now prefer multipart file upload, while `/api/v1/assets/from-data-url` remains only as a small fallback path with an 8MB ceiling for explicitly bounded cases that still need client-generated inline thumbnails.
- Remaining gaps are broader live-provider capability coverage, especially real image and analysis smoke on credentialed environments, plus staging/provider acceptance. Durable terminal short `text_output` persistence now exists, the message-native Chat node is on the same create/poll/cancel boundary, and the execution/settlement shell is separated enough to plug the rest in without rewriting the route contract.

## Launch-Readiness Sequence

1. Keep API keys server-side and choose provider adapter boundaries.
2. DB-backed Model Registry, parameter tiers, provider routes and pricing-rule versions are now in the first-pass backend checkpoint.
3. Server-side AiRun persistence, quote/preflight and a persisted mock create/poll/cancel lifecycle are now in the first-pass backend checkpoint too.
4. A persisted background executor plus timeout-safe primary->backup route shell now exist; live provider-specific adapters can plug into the same one-run / one-payer / no-double-charge boundary.
5. Expand capability coverage, provider-cost normalization depth and real post-provider settlement on top of the new per-attempt `ai_api_calls` timeline and extracted finalization boundary.
6. Upload generated outputs as Assets; return Asset refs and short summaries only.
7. Hand-test and harden the Konva Run/Stop create/poll/cancel path against one credentialed live provider route from the refreshed GPT Image 2 / Nano Banana 2 / Doubao Seedream / Jimeng lane.
8. Add provider failure, timeout, rate-limit and cost tests.

## Do Not Do

- Do not call providers from frontend.
- Do not store provider raw responses in Board document.
- Do not let frontend select arbitrary provider routes.
- Do not run real AI without rate limit and cost logging.
- Do not let the provider call start before the server knows who is paying.

## 中文完整翻译

# ARCH 切片 S2：AI 运行时

**更新日期**：2026-05-14
**模式**：架构切片。

## 范围

本切片负责 Node Registry、Model Registry、AiRun、provider routing、成本 / 积分事实，以及 AI Chat planner。

## P0 Alpha 边界

当前 alpha 只要求一条真实的、服务端驱动的 AI 图像路径，而不是完整的 provider 广度。

- quote/preflight、payer resolution 和 settlement 属于发布关键路径
- 一条 live provider-backed image path 属于发布关键路径
- 更广的 analysis/text 覆盖、refund depth 和 provider breadth 继续延后

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
  -> 解析模型能力、参数档位和 active pricing rule
  -> preflight 估算 credits，并按策略选择性预留 / 扣除 hold
  -> 按管理员配置的 priority / weight / health 选择 provider route
  -> 使用服务端密钥调用 provider
  -> 把结果上传为 Assets
  -> 写入 AiRun / ai_api_calls / credit ledger / provider cost ledger
```

## 模型、线路和价格控制平面

S2 必须由服务端配置驱动，不能用前端写死的价格表驱动。

必须具备的服务端事实：

```text
model_registry
  model_key                  # 稳定的对外产品 key，例如 gpt_image_2
  display_name
  capability                 # image_generation | image_edit | image_analysis | text
  enabled
  default_pricing_rule_id

model_parameter_tiers
  model_key
  tier_key                   # 例如 0_5k | 1k | 2k | 4k | low | medium | high
  provider_params            # JSON，映射到 provider-native size / quality / output settings
  public_label
  enabled

model_provider_routes
  route_id
  model_key
  provider_key               # openai | proxy_a | proxy_b | future provider
  provider_model
  priority
  weight
  health_status
  timeout_ms
  retry_policy
  enabled

model_pricing_rules
  pricing_rule_id
  model_key
  tier_key
  billing_unit               # per_image | per_output_token | per_input_token | blended
  estimated_credits
  min_credits
  credit_multiplier
  provider_cost_formula
  effective_from
  effective_to
  status
```

规则：

- UI 可以展示模型选择、参数档位和预计 credits，但必须从服务端 API 读取。
- UI 不能发送 provider name、route id、provider 原始价格或任意 price override。
- 像 `gpt_image_2` 这样的产品模型背后可以挂多条 provider routes。用户看到的是产品模型；服务端负责选择 active route。
- Admin / developer operators 可以在不重新部署前端的情况下禁用某条 route、调整 priority/weight、修改 provider model mapping，并发布新的 pricing-rule version。
- Pricing rules 必须版本化。AiRun 需要保存运行当时使用的准确 `pricing_rule_id`、`route_id`、estimated credits、charged credits、refunded credits、provider cost 和 provider currency。
- `0.5K`、`1K`、`2K`、`4K` 这类参数档位是面向产品的档位。每条 provider route 会把它们映射为 provider-native parameters；不是每个 provider 都必须支持每个档位。
- 对于会返回 actual usage 的 providers，服务端需要在调用前估算 credits，再在 provider response 后按 actual usage 结算。估多了写 `usage_refund`；估少了按策略写受限的额外 `usage_charge`，或让 run 进入 failed/held 状态。
- Route failover 绝不能对用户重复扣费。Retries 共享同一个 AiRun id、同一个扣费计划和一次最终结算。

运行时流程：

```text
Run request
  -> 校验 node/run type 和 board permission
  -> 从服务端 registry 解析 model_key + tier_key
  -> 加载 active pricing_rule_id 并估算 credits
  -> preflight payer balance 和 permission
  -> 按 priority/weight/health 选择最佳 enabled provider route
  -> 调用 provider
  -> 如果 route 在 provider 真正开始工作前失败，就重试另一条健康 route
  -> 如果 provider 返回 usage/cost，就归一化 provider facts
  -> 结算 credit ledger 和 provider-cost ledger
  -> 存储 Assets 和 AiRun summary
```

## 扣费归属解析规则

- S2 不能让前端猜测“这次该由谁付钱”。
- 在 provider 调用开始之前，服务端必须先解析出：
  - `actor_user_id`
  - `workspace_id`
  - `workspace_kind`
  - `board_id`
  - `charged_scope = actor_personal | team_wallet | workspace_pool`
  - `charged_account_id`
- Free 和两个 Collaborate 档位默认扣 `actor_personal`。
- Team Start/Growth 解析到当前 Team workspace wallet。
- Enterprise 可以根据合同解析为 `actor_personal` 或 `workspace_pool`。
- 仅有 Board 编辑权限并不等于可以运行 AI；Group Workspace 中被邀请的免费编辑者仍然需要自己的个人订阅积分或充值余额。
- Team dashboard 可见性不能来自 Board admin 权限；Team workspace owners/admins 可以看到 Team wallet/member usage，而 Team wallet 是 Team runs 的 payer。
- share-link viewer 和非 workspace member 外部 viewer 在初始产品模型中不能触发付费 AI 运行。

目标 payer matrix：

```text
solo/free            -> actor personal wallet
group/collaborate   -> actor personal wallet
team                -> active Team wallet
enterprise          -> contract-defined workspace pool or personal fallback
```

## 新 AI 节点的必经扩展路径

1. 新增或扩展 Node Registry 规格。
2. 新增或扩展 Model Registry 能力。
3. 增加参数档位和 pricing-rule 覆盖。
4. 增加 provider-route mapping 和 fallback policy。
5. 新增 AiRun request / response schema。
6. 增加 Next / FastAPI 路由支持。
7. 增加 provider adapter 或 mock。
8. 增加测试和 Board guard 检查。
9. 更新 PRD / ARCH 切片文档。

## 当前状态

- Mock Model Registry 已存在。
- Mock AiRun create / poll / cancel routes 现在已存在：`POST /api/v1/ai/runs`、`GET /api/v1/ai/runs/{runId}` 和 `POST /api/v1/ai/runs/{runId}/cancel`。
- Mock AiRun response 现在包含 workspace kind、charged scope、charged account id、entitlement source 和 payer label，因此在真实 provider execution 存在之前，前端节点已经可以展示扣费归属合同。
- Mock AiRun 现在已经持久化了一个简单 lifecycle 合同：create 会把 run 置为 queued，由后台执行器推进到 running -> succeeded/failed，GET 只读取当前状态而不会修改它，cancel 可以停止 queued/running 的 run。
- 第一阶段 provider-route 执行壳现在已经接到这条生命周期后面：route candidates 会从 control plane 解析出来，一个轻量 provider-adapter registry 现在已经接管每次 provider 尝试的边界，route retry policy 也已经在执行壳内生效，而且一旦遇到 timeout 或 provider 已开始工作的失败，就会停止 failover，以避免重复 provider work。
- 当 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 且 `DATABASE_URL` 已配置时，Mock AiRun 可以选择性演练真实 credit-ledger settlement：它会估算 mock credits，在成功前拒绝余额不足，并写入一条 `usage_charge` ledger entry。现在这段 settlement 还会始终绑定到该 run 最初解析出的 charged account，而不会被后续读取请求上下文偷换。默认本地路径仍然不会扣 credits。
- 成功 run 的 settlement 现在也会把归一化后的 `provider_cost` / `provider_currency` 写进最终 `ai_runs` 行和成功的 `ai_api_calls` attempt 行，同时还会按尝试写入 `api_cost_ledger`，让 Admin 可以把供应商成本与用户积分扣费拆开看。
- `AiRunRequest` 现在也承认 `runType="text"` 与 `systemPrompt`；控制平面会按 text capability 选 model/route/pricing，而不会再在缺省路径里跌回 image default。
- `tangent_ai_runs` 现在持久化 `text_output`，因此短文本结果不再只依赖进程内存或 `image_analysis` 的临时重建逻辑。
- OpenAI-compatible / GeekAI live adapter 现在可以用非流式 `chat/completions` 返回 terminal `text_output`，并且已经接受 `image_analysis` 这类 prompt + inline image refs 的分析请求；Google `generateContent` 路径也已经接受 text runs；当画布指向 FastAPI persistence API 时，Prompt Optimizer 和 message-native Chat 都会走同一套 create/poll/cancel AiRun lifecycle，而不是只依赖 Next 本地 chat proxy。
- `20260514_0021_ai_image_model_refresh.py` 现在会把活跃生图目录对齐到 `gpt-image-2`、`nano-banana-2`、`doubao-seedream-5.0-lite` 和 `jimeng_t2i_v40`；`gemini-3.1-flash-image-preview` 只保留兼容用途，不再属于活跃生图面，同时长耗时生图的 live-provider 超时边界已统一到 `240000 ms`。
- Image Gen / Image Gen 4 的 model dropdown 已读取该合同。
- Konva runtimeGraph mock 流程现在已经覆盖 Prompt / Image / Chat / Image Gen / Analysis 的数据传递、导出端口，以及生成 Asset refs 的流程，同时不会把 provider 原始载荷写入文档。
- 正式 Konva Board runtime 现在也已经消费同一套 lifecycle 合同：create 会返回 server run id，浏览器会轮询 `GET /api/v1/ai/runs/{runId}` 到终态，用户 stop 会尽力触发 `POST /api/v1/ai/runs/{runId}/cancel`，而成功的远端 image runs 会把持久化 Asset records 回填到生成节点输出，而不再伪造纯客户端 previews。
- DB-backed control-plane tables、quote-time persistence、持久化的 mock `ai_runs` rows，以及按尝试分行的 `ai_api_calls` rows 现在都已存在。
- 真实 provider adapters / calls、generated Asset upload 和更广的 live-provider capability 覆盖仍未完成，但执行 / settlement shell 现在已经分层到足以在不重写 route contract 的前提下接入这些能力；当前最大的缺口已经不再是 chat/message-native input contract，而是一条真实 image/analysis live route 的验收与更广的 provider coverage。

## 上线前顺序

1. 保持 API keys 只在服务端，并先定清 provider adapter 的边界。
2. DB-backed Model Registry、参数档位、provider routes 和 pricing-rule versions 现在已经进入第一阶段后端检查点。
3. 服务端 AiRun persistence、quote/preflight，以及持久化的 mock create/poll/cancel lifecycle 现在也已经进入第一阶段后端检查点。
4. 现在已经有了 stub 背景执行器加 timeout-safe 的 primary->backup route shell；下一步要换成真实 provider adapters，同时保持一个 run id、一个 payer 和 no-double-charge settlement。
5. 在新的逐次尝试 `ai_api_calls` 时间线、`api_cost_ledger` 和已抽离的 finalization boundary 之上，继续扩展 provider-cost normalization 和真实的 post-provider settlement。
6. 把生成结果上传成 Assets，只返回 Asset refs 和短摘要。
7. 用一条带真实凭据的 live provider route 手测并收紧 Konva Run / Stop create / poll / cancel 路径。
8. 增加 provider failure、timeout、rate-limit 和成本测试。

## 明确不要做

- 不要从前端直接调用 provider。
- 不要把 provider 原始响应写进 Board 文档。
- 不要让前端自己选择任意 provider 路由。
- 不要在没有 rate limit 和 cost logging 的情况下接真实 AI。
- 不要在服务端还没知道“谁付钱”之前就开始 provider 调用。
