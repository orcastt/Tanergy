# Project State Slice S2: AI Runtime

**Updated**: 2026-05-06
**Status**: Mock runtime/dataflow is usable locally; mock AiRun can optionally exercise credit-ledger usage charging behind `TANGENT_AI_MOCK_LEDGER_CHARGING=1`; migrations `20260506_0008` and `20260506_0009` now add the first DB-backed AI control-plane tables plus quote-time persistence fields, and when `DATABASE_URL` is configured the mock run path now writes persistent `ai_runs` records plus attempt-level `ai_api_calls`, schedules background execution after create and exposes pure-read run polling plus a first-pass provider-route/failover shell with a lightweight provider-adapter registry, route timeout handling, retry-policy-aware execution and extracted settlement orchestration. Real provider execution is still blocked on real adapters, provider-cost logging and generated Asset upload.

## Current State

- Mock Model Registry exists and is consumed by Image Gen / Image Gen 4 node controls.
- Mock AiRun route exists and returns payer facts: `workspaceKind`, `chargedScope`, `chargedAccountId`, `entitlementSource`, optional `workspaceSeatId` and a user-facing payer label.
- Mock AiRun can optionally charge the current payer through the internal credit ledger service when `TANGENT_AI_MOCK_LEDGER_CHARGING=1` and `DATABASE_URL` are configured. It rejects insufficient balance with `402` and writes a `usage_charge` entry on success; the default local path remains no-charge.
- Migration `20260506_0008` now adds `tangent_model_registry`, `tangent_model_parameter_tiers`, `tangent_model_pricing_rules` and the first normalization columns on `tangent_model_provider_routes`, with safe backfill/default seed coverage.
- Migration `20260506_0009` now adds `estimated_credits`, `pricing_rule_id`, `route_id`, `route_key`, `selected_tier_key` and `preflight_status` to `tangent_ai_runs`, plus route/pricing linkage fields to `tangent_ai_api_calls`.
- Public model reads now prefer the DB-backed control plane when available and fall back to the default local catalog when it is not.
- `POST /api/v1/ai/runs/quote` now resolves model + tier + active pricing rule, estimates credits and returns a payer-aware preflight before any provider call.
- `POST /api/v1/ai/runs` now creates a queued mock run and schedules background execution. `GET /api/v1/ai/runs/{runId}` is now a pure read of current run state, and `POST /api/v1/ai/runs/{runId}/cancel` cancels queued/running runs.
- The first execution shell now exists behind that lifecycle: route candidates are resolved from the DB/default control plane, a lightweight provider-adapter registry owns per-provider attempt execution, route retry policy is now honored inside the shell, and failover is now limited to retryable before-work failures instead of blindly continuing after timeouts or work-started errors.
- When `DATABASE_URL` is configured, mock create/read/cancel now persist quote-selected pricing/route facts and lifecycle status changes into `tangent_ai_runs`, while `tangent_ai_api_calls` now stores one row per provider attempt so failover history is observable instead of being collapsed into a single summary row. `GET /api/v1/ai/runs/{runId}` reads the persisted run record back without mutating it.
- Optional mock-ledger charging now settles against the run's originally resolved charged account / creator workspace context, so later read requests do not silently switch payer identity.
- Run finalization/settlement orchestration is now extracted from the route handler layer, which gives the future real-provider path a cleaner place to plug in provider-cost normalization, refunds and post-provider settlement rules.
- Konva runtimeGraph mock flow now covers Prompt, Image, Chat, Image Gen and Analysis data passing, export ports and generated Asset refs.
- AI Chat / Prompt upstream mock dataflow is present in the canvas, but no provider call is made from the browser.
- Real provider adapters/calls, `api_cost_ledger` writes and real generated Asset upload are not done.

## Required Next Work

1. Replace the current stub background executor with real provider adapters while preserving one run id, one payer and no-double-charge settlement.
2. Replace the remaining stub adapter bodies with real provider-specific adapters while keeping the new timeout-safe failover boundary and extracted settlement orchestration intact.
3. Expand the control plane from read-only/seeded state into admin-editable publish/save flows.
4. Upload generated outputs as Assets and return only Asset refs/short summaries.
5. Settle success/failure/refund facts in `credit_ledger` and `api_cost_ledger` around real provider outcomes instead of mock-only settlement.
6. Wire Konva Run/Stop UI to the server AiRun lifecycle.

## Validation Target

- API keys stay server-side.
- Board documents store only Asset/AiRun refs and short summaries.
- No provider raw response, Base64 image or complete log enters Board/History/node props.
- A failed provider call does not silently consume credits.
- Every run can explain who paid and why before the provider call starts.

## 中文完整翻译

# Project State 切片 S2：AI 运行时

**更新日期**：2026-05-06
**状态**：Mock runtime / dataflow 已经可以在本地使用；Mock AiRun 可以在 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 后面选择性演练 credit-ledger usage charging；migrations `20260506_0008` 和 `20260506_0009` 现在已经补上第一批 DB-backed AI 控制平面表和 quote-time persistence fields，并且当 `DATABASE_URL` 已配置时，mock run 路径现在已经会写持久化的 `ai_runs` 记录与按尝试分行的 `ai_api_calls`，在 create 之后调度后台执行，并暴露纯读取的 run polling 加第一阶段 provider-route / failover shell，以及一个轻量 provider-adapter registry、route timeout handling、retry-policy-aware execution 和抽离出来的 settlement orchestration。真实 provider execution 仍然被真实 adapters、provider-cost logging 和 generated Asset upload 阻塞。

## 当前状态

- Mock Model Registry 已存在，并被 Image Gen / Image Gen 4 节点控件消费。
- Mock AiRun route 已存在，并返回 payer facts：`workspaceKind`、`chargedScope`、`chargedAccountId`、`entitlementSource`、可选 `workspaceSeatId` 和用户可见 payer label。
- 当 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 且 `DATABASE_URL` 已配置时，Mock AiRun 可以选择性通过内部 credit ledger service 扣当前 payer。余额不足会返回 `402`，成功时会写入一条 `usage_charge`；默认本地路径仍然不扣费。
- Migration `20260506_0008` 现在已经补上 `tangent_model_registry`、`tangent_model_parameter_tiers`、`tangent_model_pricing_rules`，以及 `tangent_model_provider_routes` 的第一批规范化列，并带有安全 backfill / 默认 seed 覆盖。
- Migration `20260506_0009` 现在已经把 `estimated_credits`、`pricing_rule_id`、`route_id`、`route_key`、`selected_tier_key` 和 `preflight_status` 加进 `tangent_ai_runs`，同时也给 `tangent_ai_api_calls` 加上了 route / pricing 关联字段。
- 面向公开节点的模型读取现在会优先使用 DB-backed control plane；当数据库不可用时，会自动回退到默认本地 catalog。
- `POST /api/v1/ai/runs/quote` 现在会在任何 provider 调用前解析 model + tier + active pricing rule、估算 credits，并返回带 payer 信息的 preflight。
- `POST /api/v1/ai/runs` 现在会创建一个 queued 的 mock run，并在后台调度执行。`GET /api/v1/ai/runs/{runId}` 现在是纯读取当前 run 状态，而 `POST /api/v1/ai/runs/{runId}/cancel` 可以取消 queued/running 的 run。
- 第一阶段执行壳现在已经接上这条生命周期：route candidates 会从 DB / 默认 control plane 解析出来，一个轻量 provider-adapter registry 现在已经接管每次 provider 尝试的执行入口，route retry policy 也已经在执行壳内部生效，而 failover 现在只会发生在可安全重试、且 provider 尚未开始工作的失败上，不会在 timeout 或 work-started error 后盲目继续。
- 当 `DATABASE_URL` 已配置时，mock create/read/cancel 现在会把 quote 阶段选中的 pricing / route facts 以及生命周期状态变化写入 `tangent_ai_runs`，而 `tangent_ai_api_calls` 现在会按每次 provider 尝试各写一行，因此 failover 历史可以被观察，而不再被折叠成单行摘要；`GET /api/v1/ai/runs/{runId}` 只会从该持久化记录读回结果，而不会再去修改它。
- 可选的 mock-ledger charging 现在会按照该 run 最初解析出的 charged account / creator workspace context 结算，因此后续读取请求不会静默切换 payer identity。
- Run 最终执行 / settlement orchestration 现在也已经从 route handler 层抽离出来，这样后续接真实 provider 时，会有一个更干净的挂点去接 provider-cost normalization、refunds 和 post-provider settlement rules。
- Konva runtimeGraph mock flow 现在覆盖 Prompt、Image、Chat、Image Gen 和 Analysis 的数据传递、export ports 和 generated Asset refs。
- AI Chat / Prompt upstream mock dataflow 已经存在于画布中，但浏览器不会发起 provider 调用。
- 真实 provider adapters / calls、`api_cost_ledger` 写入，以及真实 generated Asset upload 都还没有完成。

## 下一步必要工作

1. 把当前 stub 背景执行器替换为真实 provider adapters，同时保持一个 run id、一个 payer 和 no-double-charge settlement。
2. 把剩余的 stub adapter body 替换为真实的 provider-specific adapters，同时保持新的 timeout-safe failover 边界和已抽离的 settlement orchestration 不被破坏。
3. 把当前 read-only / seeded 的 control plane 继续扩展为可由 admin 编辑的 publish / save flows。
4. 把生成结果上传为 Assets，并只返回 Asset refs / short summaries。
5. 围绕真实 provider outcomes，在 `credit_ledger` 和 `api_cost_ledger` 中结算 success / failure / refund facts，而不是只做 mock settlement。
6. 把 Konva Run / Stop UI 接到 server AiRun lifecycle。

## 验证目标

- API keys 保持在服务端。
- Board documents 只保存 Asset / AiRun refs 和 short summaries。
- provider raw response、Base64 image 或 complete log 都不能进入 Board / History / node props。
- 失败的 provider call 不能静默消耗 credits。
- 每次运行在 provider call 开始前都能解释谁付钱，以及为什么。
