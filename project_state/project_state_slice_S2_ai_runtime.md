# Project State Slice S2: AI Runtime

**Updated**: 2026-05-08
**Status**: Mock runtime/dataflow is usable locally; the canvas also has a GeekAI-backed fast path for chat streaming, prompt optimization, image generation/edit/reference and analysis UX; mock AiRun can optionally exercise credit-ledger usage charging behind `TANGENT_AI_MOCK_LEDGER_CHARGING=1`; migrations `20260506_0008`, `20260506_0009`, `20260506_0010` and `20260506_0011` now add the first DB-backed AI control-plane tables, quote-time persistence facts, provider-currency/runtime-cost normalization fields, version-history storage and attempt-level `api_cost_ledger` settlement fields. Migration `20260508_0012` adds `team_wallet` charge scope, and the first payer resolver cut now charges Team workspaces to Team wallet while Group/Collaborate remains personal-wallet based. Current alpha gate: fold the local GeekAI path into the server provider-route/billing control plane and hand-test one credentialed real provider-backed image path end to end.

## Current Alpha Boundary

- release-critical: quote/preflight, payer summary, persisted Team-wallet/personal-wallet resolver, persisted run lifecycle, one real provider-backed image path
- local product proof: GeekAI-backed chat, prompt optimizer, image gen/edit/reference and analysis flows in the canvas
- not current-alpha promise: full provider breadth, durable text output, broad refund/reconciliation depth

## Current State

- Mock Model Registry exists and is consumed by Image Gen / Image Gen 4 node controls.
- Canvas-facing AI node UX now has a GeekAI fast path for local product validation: Chat streams text, Prompt Optimizer streams enriched image prompts, Analysis can choose OpenAI-style or Gemini-style visual analysis, and Image Gen / Image Gen 4 can return images into slots and board Assets through the current web app route.
- Image node controls now reflect model-specific parameter surfaces for GPT Image 2, Nano Banana 2, Doubao Seedream and Jimeng-style generation/edit/reference flows. These controls are useful UX proof, but their provider-specific parameter mapping still needs to move behind the server provider adapter/control-plane boundary before production reliance.
- Mock AiRun route exists and returns payer facts: `workspaceKind`, `chargedScope`, `chargedAccountId`, `entitlementSource`, optional `workspaceSeatId` and a user-facing payer label. Team workspace quotes now resolve to `team_wallet`; Group/Collaborate quotes remain `actor_personal`.
- Mock AiRun can optionally charge the current payer through the internal credit ledger service when `TANGENT_AI_MOCK_LEDGER_CHARGING=1` and `DATABASE_URL` are configured. It rejects insufficient balance with `402` and writes a `usage_charge` entry on success; the default local path remains no-charge.
- Migration `20260506_0008` now adds `tangent_model_registry`, `tangent_model_parameter_tiers`, `tangent_model_pricing_rules` and the first normalization columns on `tangent_model_provider_routes`, with safe backfill/default seed coverage.
- Migration `20260506_0009` now adds `estimated_credits`, `pricing_rule_id`, `route_id`, `route_key`, `selected_tier_key` and `preflight_status` to `tangent_ai_runs`, plus route/pricing linkage fields to `tangent_ai_api_calls`.
- Migration `20260506_0010` now adds `provider_currency` to `tangent_ai_api_calls` and backfills first-pass provider-cost formulas for the seeded image tiers so admin/runtime views can show normalized supplier cost instead of only credits.
- Migration `20260506_0011` now adds `tangent_ai_control_plane_versions` plus the first `api_cost_ledger` settlement columns needed to keep per-attempt supplier-cost facts and versioned control-plane snapshots.
- Public model reads now prefer the DB-backed control plane when available and fall back to the default local catalog when it is not.
- `POST /api/v1/ai/runs/quote` now resolves model + tier + active pricing rule, estimates credits and returns a payer-aware preflight before any provider call.
- `POST /api/v1/ai/runs` now creates a queued mock run and schedules background execution. `GET /api/v1/ai/runs/{runId}` is now a pure read of current run state, and `POST /api/v1/ai/runs/{runId}/cancel` cancels queued/running runs.
- The first execution shell now exists behind that lifecycle: route candidates are resolved from the DB/default control plane, a lightweight provider-adapter registry owns per-provider attempt execution, route retry policy is now honored inside the shell, and failover is now limited to retryable before-work failures instead of blindly continuing after timeouts or work-started errors.
- The provider-adapter layer now also has an opt-in live execution scaffold behind `TANGENT_AI_PROVIDER_EXECUTION_MODE=live` or provider-specific `..._MODE=live`: OpenAI-compatible routes can execute real image generation/edit calls, Google routes can execute `generateContent`-style requests, and successful image outputs are persisted through the existing Asset storage adapter instead of being left as raw provider payloads.
- When `DATABASE_URL` is configured, mock create/read/cancel now persist quote-selected pricing/route facts and lifecycle status changes into `tangent_ai_runs`, while `tangent_ai_api_calls` now stores one row per provider attempt so failover history is observable instead of being collapsed into a single summary row. `GET /api/v1/ai/runs/{runId}` reads the persisted run record back without mutating it.
- Optional mock-ledger charging now settles against the run's originally resolved charged account / creator workspace context, so later read requests do not silently switch payer identity.
- Run finalization/settlement orchestration is now extracted from the route handler layer, and successful runs now persist settled credit amounts plus normalized `provider_cost` / `provider_currency` onto both the final `ai_runs` row and the winning `ai_api_calls` attempt row.
- Run finalization now also writes attempt-level `api_cost_ledger` rows with explicit settlement kinds such as `usage`, `provider_cost_only` and `attempt_failure`, so finance/admin tooling can explain supplier cost independently from user-credit charging.
- Konva runtimeGraph mock flow now covers Prompt, Image, Chat, Image Gen and Analysis data passing, export ports and generated Asset refs.
- Konva runtimeGraph Run/Stop is now wired to the server AiRun lifecycle for the formal Board route: the client creates the run, stores the accepted server run id, polls `GET /api/v1/ai/runs/{runId}` to terminal state, best-effort cancels `POST /api/v1/ai/runs/{runId}/cancel` after user stop, and hydrates returned output Asset records back into generated node outputs when the browser is pointed at the FastAPI backend.
- AI Chat / Prompt upstream mock dataflow is present in the canvas, and the new Prompt Optimizer node proves the desired streaming text-improvement UX through the local web route. Production text calls still need durable server AiRun output handling.
- Live adapter coverage is still incomplete: OpenAI-compatible analysis is not wired, provider text outputs are not durably persisted yet, and the new settlement shell still needs broader real-provider coverage plus refund/reconciliation policy depth beyond the first-pass ledger writes.

## Required Next Work

1. Reconcile the current GeekAI local fast path into the server provider-route adapter layer described by `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md`.
2. Persist and test Team-wallet settlement through the full live provider path, not only mock entitlement/quote.
3. Finish provider-capability coverage so live adapters support image generation, image edit/reference, analysis and prompt/text optimization with durable Asset or short text outputs.
4. Deepen real-provider settlement policy so success, failure, cancel and refund paths reconcile cleanly across `credit_ledger`, `api_cost_ledger` and provider-returned usage/cost facts.
5. Preserve provider-response summaries safely for runtime UX without storing long raw payloads.
6. Hand-test the Konva Run/Stop -> create/poll/cancel path against one credentialed live provider route and tighten user-facing quote/error/cancel messaging.

## Validation Target

- API keys stay server-side.
- Board documents store only Asset/AiRun refs and short summaries.
- No provider raw response, Base64 image or complete log enters Board/History/node props.
- A failed provider call does not silently consume credits.
- Every run can explain who paid and why before the provider call starts.

## 中文完整翻译

# Project State 切片 S2：AI 运行时

**更新日期**：2026-05-08
**状态**：Mock runtime / dataflow 已经可以在本地使用；画布也已有 GeekAI-backed fast path，用于验证 chat streaming、prompt optimization、image generation/edit/reference 和 analysis UX；Mock AiRun 可以在 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 后面选择性演练 credit-ledger usage charging；migrations `20260506_0008`、`20260506_0009`、`20260506_0010` 和 `20260506_0011` 现在已经补上第一批 DB-backed AI 控制平面表、quote-time persistence facts、provider-currency / runtime-cost normalization 字段、版本历史存储，以及按尝试分行的 `api_cost_ledger` settlement 字段。当前 alpha 的关键闸门是把本地 GeekAI 路径收口到 server provider-route/billing control plane，同时更新 payer resolution：Team runs 扣 Team wallet，Group/Collaborate runs 扣个人钱包，然后用真实凭据把一条 provider-backed image path 端到端手测通过。

## 当前 Alpha 边界

- 发布关键：quote/preflight、payer summary、Team-wallet/personal-wallet resolver、持久化 run lifecycle，以及一条真实的 provider-backed image path
- 本地产品证明：画布里的 GeekAI-backed chat、prompt optimizer、image gen/edit/reference 和 analysis flows
- 非当前 alpha 承诺：完整 provider breadth、durable text output 和更广的 refund/reconciliation depth

## 当前状态

- Mock Model Registry 已存在，并被 Image Gen / Image Gen 4 节点控件消费。
- 面向画布的 AI node UX 现在已有 GeekAI fast path 用于本地产品验证：Chat 可以流式输出文本，Prompt Optimizer 可以流式输出优化后的出图提示词，Analysis 可以选择 OpenAI-style 或 Gemini-style visual analysis，Image Gen / Image Gen 4 可以通过当前 web app route 把图片返回到 slots 和 board Assets。
- 图片节点控件现在已经体现 GPT Image 2、Nano Banana 2、Doubao Seedream 和 Jimeng-style generation/edit/reference flows 的模型特定参数界面。这些控件是有价值的 UX proof，但 provider-specific 参数映射在生产依赖前仍需要移动到服务端 provider adapter/control-plane 边界后面。
- Mock AiRun route 已存在，并返回 payer facts：`workspaceKind`、`chargedScope`、`chargedAccountId`、`entitlementSource`、可选 `workspaceSeatId` 和用户可见 payer label。
- 当 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 且 `DATABASE_URL` 已配置时，Mock AiRun 可以选择性通过内部 credit ledger service 扣当前 payer。余额不足会返回 `402`，成功时会写入一条 `usage_charge`；默认本地路径仍然不扣费。
- Migration `20260506_0008` 现在已经补上 `tangent_model_registry`、`tangent_model_parameter_tiers`、`tangent_model_pricing_rules`，以及 `tangent_model_provider_routes` 的第一批规范化列，并带有安全 backfill / 默认 seed 覆盖。
- Migration `20260506_0009` 现在已经把 `estimated_credits`、`pricing_rule_id`、`route_id`、`route_key`、`selected_tier_key` 和 `preflight_status` 加进 `tangent_ai_runs`，同时也给 `tangent_ai_api_calls` 加上了 route / pricing 关联字段。
- Migration `20260506_0010` 现在已经把 `provider_currency` 加进 `tangent_ai_api_calls`，并给种子图片档位回填第一阶段 provider-cost formulas，这样 admin/runtime 视图不再只能看到 credits，也能看到归一化后的供应商成本。
- Migration `20260506_0011` 现在已经增加 `tangent_ai_control_plane_versions`，以及 `api_cost_ledger` 所需的第一批 settlement 列，用来保存按尝试分行的供应商成本事实和版本化控制平面快照。
- 面向公开节点的模型读取现在会优先使用 DB-backed control plane；当数据库不可用时，会自动回退到默认本地 catalog。
- `POST /api/v1/ai/runs/quote` 现在会在任何 provider 调用前解析 model + tier + active pricing rule、估算 credits，并返回带 payer 信息的 preflight。
- `POST /api/v1/ai/runs` 现在会创建一个 queued 的 mock run，并在后台调度执行。`GET /api/v1/ai/runs/{runId}` 现在是纯读取当前 run 状态，而 `POST /api/v1/ai/runs/{runId}/cancel` 可以取消 queued/running 的 run。
- 第一阶段执行壳现在已经接上这条生命周期：route candidates 会从 DB / 默认 control plane 解析出来，一个轻量 provider-adapter registry 现在已经接管每次 provider 尝试的执行入口，route retry policy 也已经在执行壳内部生效，而 failover 现在只会发生在可安全重试、且 provider 尚未开始工作的失败上，不会在 timeout 或 work-started error 后盲目继续。
- provider-adapter 层现在也已经有了可选启用的 live execution scaffold：通过 `TANGENT_AI_PROVIDER_EXECUTION_MODE=live` 或 provider-specific `..._MODE=live`，OpenAI-compatible routes 可以执行真实 image generation/edit，Google routes 可以执行 `generateContent` 风格请求，而成功的图片输出会通过现有 Asset storage adapter 落为真实 Assets，而不是停留在 raw provider payload。
- 当 `DATABASE_URL` 已配置时，mock create/read/cancel 现在会把 quote 阶段选中的 pricing / route facts 以及生命周期状态变化写入 `tangent_ai_runs`，而 `tangent_ai_api_calls` 现在会按每次 provider 尝试各写一行，因此 failover 历史可以被观察，而不再被折叠成单行摘要；`GET /api/v1/ai/runs/{runId}` 只会从该持久化记录读回结果，而不会再去修改它。
- 可选的 mock-ledger charging 现在会按照该 run 最初解析出的 charged account / creator workspace context 结算，因此后续读取请求不会静默切换 payer identity。
- Run 最终执行 / settlement orchestration 现在也已经从 route handler 层抽离出来，并且成功 run 现在会把 settled credit amount 与归一化后的 `provider_cost` / `provider_currency` 同时写进最终 `ai_runs` 行和 winning `ai_api_calls` attempt 行。
- Run 最终执行现在也会按尝试写入 `api_cost_ledger`，并带上明确的 settlement kind，例如 `usage`、`provider_cost_only` 和 `attempt_failure`，这样 finance/admin 工具就能把供应商成本与用户积分扣费拆开解释。
- Konva runtimeGraph mock flow 现在覆盖 Prompt、Image、Chat、Image Gen 和 Analysis 的数据传递、export ports 和 generated Asset refs。
- 正式 Board 路由上的 Konva runtimeGraph Run/Stop 现在也已经接到服务端 AiRun lifecycle：客户端会 create run、保存接受到的 server run id、轮询 `GET /api/v1/ai/runs/{runId}` 到终态、在用户 stop 后尽力调用 `POST /api/v1/ai/runs/{runId}/cancel`，并在浏览器指向 FastAPI backend 时，把返回的 output Asset records 回填进生成节点的 outputs。
- AI Chat / Prompt upstream mock dataflow 已经存在于画布中，新的 Prompt Optimizer node 也通过本地 web route 证明了流式 text-improvement UX。生产 text calls 仍需要 durable server AiRun output handling。
- live adapter 覆盖仍不完整：OpenAI-compatible analysis 还没接，provider text output 还不能稳定持久化，而且新的 settlement shell 还需要在更多真实 provider 上补齐深度，以及把 refund/reconciliation policy 做完整。

## 下一步必要工作

1. 按 `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md`，把当前 GeekAI 本地 fast path 收口到服务端 provider-route adapter layer。
2. 更新 payer resolution：Team workspace runs 扣 Team wallet，Group/Collaborate workspace runs 扣操作者个人钱包。
3. 把 live adapters 的能力覆盖补齐，让 image generation、image edit/reference、analysis 和 prompt/text optimization 都能输出 durable Asset 或短文本结果。
4. 围绕真实 provider outcomes，把 success / failure / cancel / refund 路径在 `credit_ledger`、`api_cost_ledger` 和 provider 返回 usage/cost 事实之间做完整对账。
5. 在不存长原始 payload 的前提下，安全保留 provider-response summaries 以支撑 runtime UX。
6. 用一条带真实凭据的 live provider route 手测 Konva Run/Stop -> create/poll/cancel 路径，并继续收紧用户可见的 quote / error / cancel 文案。

## 验证目标

- API keys 保持在服务端。
- Board documents 只保存 Asset / AiRun refs 和 short summaries。
- provider raw response、Base64 image 或 complete log 都不能进入 Board / History / node props。
- 失败的 provider call 不能静默消耗 credits。
- 每次运行在 provider call 开始前都能解释谁付钱，以及为什么。
