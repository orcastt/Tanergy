# Project State Slice S2: AI Runtime

**Updated**: 2026-05-20
**Status**: Mock runtime/dataflow is usable locally; the canvas now has a GeekAI-first fast path for chat streaming, prompt optimization, image generation/edit/reference and analysis UX; mock AiRun can optionally exercise credit-ledger usage charging behind `TANGENT_AI_MOCK_LEDGER_CHARGING=1`; migrations `20260506_0008`, `20260506_0009`, `20260506_0010` and `20260506_0011` add the first DB-backed AI control-plane tables, quote-time persistence facts, provider-currency/runtime-cost normalization fields, version-history storage and attempt-level `api_cost_ledger` settlement fields. Migration `20260520_0032` switches active defaults back to GeekAI across text, analysis and image routes, and `20260520_0033` makes `qwq-plus-latest` the active Chat/Prompt Optimizer text default while preserving Qwen VL for image analysis. The current alpha gate is unchanged: finish staging/browser acceptance, hand-test one credentialed real provider-backed image path end to end, then keep widening live-provider capability coverage while continuing to strip provider-shaped logic out of the local Next bridge.

## Current Alpha Boundary

- release-critical: quote/preflight, payer summary, persisted Team-wallet/personal-wallet resolver, persisted run lifecycle, one real provider-backed image path
- local product proof: GeekAI-first chat, prompt optimizer, image gen/edit/reference and analysis flows in the canvas
- not current-alpha promise: full provider breadth, broad refund/reconciliation depth, or the automatic graph-planning layer on top of message-native chat

## Current State

- Mock Model Registry exists and is consumed by Image Gen / Image Gen 4 node controls.
- Canvas-facing AI node UX now has a GeekAI-first fast path for local product validation: Chat streams text, Prompt Optimizer streams enriched image prompts, Analysis can choose multimodal text/vision models, and Image Gen / Image Gen 4 can return images into slots and board Assets through the current web app route.
- Canvas image operations still need truthful closeout: `Remove BG` currently has a visible frontend entry point, but the end-to-end backend/API/staging path is not yet part of the accepted live product boundary for this pass. `Object Cutout` remains an explicit future operation after that.
- 2026-05-13 memory/fallback audit: AI chat streaming now caps buffered SSE text and retained output text; the local chat completions route only inlines JPEG/PNG/WebP images up to 20MB and streams same-origin/local image reads with a byte cap; image generation/edit/reference now rejects oversize inline input/output images before base64 expansion/decode; remote image imports stream with byte caps; provider `b64_json` handling estimates size before decode; and AI run text retained in memory is capped before persistence/runtime use.
- 2026-05-13 AI/upload hardening continuation: `/api/ai/runs` now fails closed for unsupported local text runs instead of silently returning a fabricated run; `/api/assets/upload` uses shared content-length plus streamed file-read limits; chat/image-analysis/image-generation reference images now enforce both per-image and total inline byte budgets before base64 expansion; backend provider input assets also enforce a total-byte ceiling; and remote image import now releases/cancels stream readers cleanly on abort or oversize exit.
- 2026-05-13 asset memory cleanup continuation: primary board thumbnail, selection-capture, runtime asset migration and mock-generated image paths now upload through multipart file payloads instead of using large `data:` JSON bodies as the main path; `/api/v1/assets/from-data-url` and the local Next `/api/assets/from-data-url` route are now treated as small-fallback-only paths with an 8MB request ceiling, which reduces base64 request amplification on save/capture flows.
- Image node controls now reflect model-specific parameter surfaces for GPT Image 2, Nano Banana 2, Doubao Seedream and Jimeng-style generation/edit/reference flows. These controls are useful UX proof, but their provider-specific parameter mapping still needs to move behind the server provider adapter/control-plane boundary before production reliance.
- 2026-05-14 image-model refresh: the active image-generation lane is now limited to `gpt-image-2`, `nano-banana-2`, `doubao-seedream-5.0-lite` and `jimeng_t2i_v40`; `gemini-3.1-flash-image-preview` remains only as a legacy-compat identifier and no longer drives the active image-generation UI. The long-running image timeout boundary is now `240000 ms`.
- 2026-05-20 GeekAI provider refresh: active defaults now resolve to `geekai`; image scope prefers `GEEKAI_BALANCE_IMAGE_API_KEY`, falls back to optional image aliases including `GEEKAI_OFFICIAL_IMAGE_API_KEY`, text scope uses `GEEKAI_TEXT_API_KEY`, and video scope keeps `GEEKAI_VIDEO_API_KEY` reserved. Chat and Prompt Optimizer default to `qwq-plus-latest` over GeekAI `/chat/completions` with `stream: true`; local Analysis also streams deltas through the same chat-completions proxy for the visual-analysis UX, while backend AiRun text calls request upstream streaming and fold SSE chunks into durable terminal `text_output`. Analysis remains on `qwen/qwen2.5-vl-72b-instruct` for visual input. GPT Image 2 uses GeekAI `/images/generations`; Nano Banana 2 uses GeekAI `/chat/completions` with provider model `gemini-3.1-flash-image-preview`, and the front/back contracts now preserve the extended Nano ratios instead of collapsing them to `1:1`.
- 2026-05-20 staging validation after redeploy: API release `b35adc0` is healthy, Alembic is at `20260520_0033`, and staging DB confirms enabled/healthy GeekAI routes for `qwq-plus-latest`, `qwen/qwen2.5-vl-72b-instruct`, `gpt-image-2`, `nano-banana-2` and `doubao-seedream-5.0-lite`. QwQ and GPT Image 2 are the current default text/image models. This fixes the previous staging attempt, where `20260520_0033` failed because `default_pricing_rule_id` referenced `price_qwq_plus_latest_v1` before that pricing row existed.
- 2026-05-20 Web text streaming smoke: Vercel staging initially missed the new server-only GeekAI env and returned `503 Missing GEEKAI text API key`. After syncing `GEEKAI_TEXT_*`, `GEEKAI_BALANCE_IMAGE_*`, `GEEKAI_OFFICIAL_IMAGE_*` and `GEEKAI_VIDEO_*` to Vercel and redeploying Web to `dpl_CwARDUa1WkLxDbnZLjrZkHppATMg`, `/api/ai/chat/completions` returned `200 text/event-stream` and live SSE chunks for `qwq-plus-latest`. A low-token check produced 49 reasoning chunks and final content `OK`, confirming transport while exposing the UI nuance that QwQ reasoning chunks are activity, not final text to persist in nodes.
- 2026-05-18 image credit margin refresh remains in place: fixed-cost image tiers use a provider-cost formula plus a 25% target gross margin at `1 credit = $0.01`, rounded up to the nearest 0.5 credit. GPT Image 2 is 5.5/11/21.5 credits for 1K/2K/4K, Nano Banana 2 is 2/4/8/16 credits for 0.5K/1K/2K/4K, and Doubao Seedream 5.0 Lite has a conservative 5-credit rule pending final provider price confirmation.
- 2026-05-16 regression reset: the full backend suite is green again at `256 passed`, frontend `lint/typecheck/build` are green, and the stale failures were narrowed to two causes only: outdated guest-via-visibility expectations and fake-Postgres entitlement query shapes that had fallen behind the current Team/Group wallet SQL.
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
- 2026-05-13 memory/fallback cleanup tightened AI runtime safety: AiRun request schema caps prompt/input assets, provider attempt/run queues are bounded, provider JSON/image responses are byte-capped, chat provider streaming has response byte/time caps, local Next AI routes are production-disabled unless explicitly opted in, model fallback is dev/local only, and production backend stub-provider execution now fails closed unless `TANGENT_AI_ALLOW_STUB_PROVIDER=1`.
- 2026-05-14 staging/provider policy tightening: backend stub-provider execution now fails closed outside local/dev/test unless explicitly enabled, and non-local runtimes can default to live provider execution when credentials are present so staging does not silently return mock `asset_mock_*` outputs as a false success.
- 2026-05-16 provider-decoupling checkpoint: the backend AiRun/control-plane path is now mostly provider-neutral, but the local Next AI bridge and some admin UI still retain provider-shaped logic. The active cleanup target is to keep backend registry/route facts canonical while collapsing the local bridge into thin dev-only wrappers and removing hard-coded provider selectors from admin/editor surfaces.
- 2026-05-16 local-bridge cleanup checkpoint: frontend fallback model facts now flow through shared `aiModelCatalog` / `aiImageModelOptions` / `aiImageModelRuntime` modules instead of being re-declared across node registry and local routes, deprecated Hunyuan-specific local chat message folding is removed, and the unused `geekAiTextConfig.ts` bridge stub is deleted.
- 2026-05-16 local-bridge cleanup follow-up: provider display-name / text-mode rules now live in one `providerApiConfig` helper instead of being repeated across analysis/image local bridge files, but local image execution still keeps a provider+model-family dispatch table in the local image-run bridge, so frontend fallback was not yet fully “admin route only” before the 2026-05-17 split.
- 2026-05-17 runtime control-plane maintenance follow-up: `ai_control_plane.py` is now back under the line-budget rule. Tuple conversion, model-option assembly and pricing/time utility helpers live in `ai_control_plane_support.py`, while the main runtime module keeps the existing `connect_to_postgres` seam used by AI/admin contract tests.
- 2026-05-17 local image-bridge follow-up: `apps/web/src/app/api/ai/_lib/localProviderImageRun.ts` is now a thin orchestration layer. Provider HTTP/polling, asset persistence/reference loading, model-family normalization and local executor dispatch now live in dedicated `localProviderImageRun*.ts` modules, which makes the remaining provider-shaped frontend bridge easier to keep shrinking behind server control-plane boundaries.
- 2026-05-17 runtime persistence follow-up: `ai_run_persistence.py` is now also a thin façade. DB read/write SQL lives in `ai_run_persistence_store.py`, while snapshot-to-record/request conversion and shared payer/timestamp helpers live in `ai_run_persistence_support.py`, preserving the old `connect_to_postgres` monkeypatch seam used by AI/admin tests.
- 2026-05-17 runtime orchestration follow-up: `ai_contracts.py` is now back under the line-budget rule too. Mock run memory-cache, TTL pruning and owner-context recovery helpers live in `ai_contracts_support.py`, while the main module stays focused on create/get/cancel/scheduled execution flow.
- 2026-05-13 text AiRun bridge is now formally in place: `AiRunRequest` accepts `runType="text"` plus `systemPrompt`, the control plane now resolves text models/pricing without falling through to image defaults, OpenAI-compatible and Google live adapters can return terminal short text output, and stub execution now mirrors that contract in local/dev.
- Migration `20260513_0019` now adds `text_output` to `tangent_ai_runs`, persistence now stores/reloads terminal text output, and both the Konva Prompt Optimizer plus the message-native Chat node now use backend `POST /api/v1/ai/runs` + poll/cancel when the browser is pointed at the FastAPI persistence API. Local-only fallback still uses the Next chat route for streaming UX.
- Migration `20260513_0020` now seeds `gpt-5-mini`, `gpt-4o-mini` and `gemini-2.5-flash` into the backend control plane with default routes/pricing, the quote path now refuses unsupported model/run-type mismatches instead of silently choosing an unrelated model, and the OpenAI-compatible live adapter now accepts `image_analysis` by sending prompt plus inline image refs through the same chat-completions boundary used by short text runs.
- Konva runtimeGraph mock flow now covers Prompt, Image, Chat, Image Gen and Analysis data passing, export ports and generated Asset refs.
- Konva runtimeGraph Run/Stop is now wired to the server AiRun lifecycle for the formal Board route: the client creates the run, stores the accepted server run id, polls `GET /api/v1/ai/runs/{runId}` to terminal state, best-effort cancels `POST /api/v1/ai/runs/{runId}/cancel` after user stop, and hydrates returned output Asset records back into generated node outputs when the browser is pointed at the FastAPI backend.
- AI Chat upstream mock dataflow is still present in the canvas, but Chat itself now also has a server-native text/message run path with `params.messages` plus optional `inputAssetIds` when the canvas is pointed at FastAPI. The Prompt Optimizer and Chat nodes both keep a local streaming fallback for no-backend/dev sessions.
- A new `services/api/scripts/s2_live_ai_smoke.py` script now creates one live image run, waits for it to settle, then feeds the returned Asset into one analysis run. This is the first reusable acceptance harness for local real-DB smoke and later staging/provider verification.
- The local AI/upload cleanup pass is now splitting “useful dev fallback” from “unsafe production fallback”: local chat/provider and asset bridge routes now remain opt-in only when `NEXT_PUBLIC_API_BASE_URL` is unset, while unsupported local run types and oversize upload/reference-image paths now fail closed instead of quietly fabricating results or reading unbounded bodies.
- Live adapter coverage is still incomplete: richer multimodal chat/message runs are not yet first-class AiRun inputs, and the new settlement shell still needs broader real-provider coverage plus refund/reconciliation policy depth beyond the first-pass ledger writes.

## Required Next Work

1. Reconcile the current GeekAI-first local fast path into the server provider-route adapter layer described by `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md`, keeping the refreshed GPT Image 2 / Nano Banana 2 / Doubao Seedream lane as the active image-generation surface.
2. Continue shrinking the local Next bridge so provider/model-family dispatch lives in thinner registries and fewer route files, leaving admin/backend control-plane facts as the canonical source of switching behavior.
3. Persist and test Team-wallet settlement through the full live provider path, not only mock entitlement/quote.
4. Finish provider-capability coverage so live adapters support image generation, image edit/reference, analysis and chat/message-native text runs with durable Asset or short text outputs.
5. Deepen real-provider settlement policy so success, failure, cancel and refund paths reconcile cleanly across `credit_ledger`, `api_cost_ledger` and provider-returned usage/cost facts.
6. Preserve provider-response summaries safely for runtime UX without storing long raw payloads.
7. Reconnect and validate image operations as truthful server-owned features, starting with `Remove BG` end to end: auth, request contract, source-asset read, processed-asset write, user-visible error state and staging acceptance.
8. Hand-test the Konva Run/Stop -> create/poll/cancel path against one credentialed live provider route and tighten user-facing quote/error/cancel messaging.

## Validation Target

- API keys stay server-side.
- Board documents store only Asset/AiRun refs and short summaries.
- No provider raw response, Base64 image or complete log enters Board/History/node props.
- A failed provider call does not silently consume credits.
- Every run can explain who paid and why before the provider call starts.

## 中文完整翻译

# Project State 切片 S2：AI 运行时

**更新日期**：2026-05-20
**状态**：Mock runtime / dataflow 已经可以在本地使用；画布现在已有 GeekAI-first fast path，用于验证 chat streaming、prompt optimization、image generation/edit/reference 和 analysis UX；Mock AiRun 可以在 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 后面选择性演练 credit-ledger usage charging；migrations `20260506_0008`、`20260506_0009`、`20260506_0010` 和 `20260506_0011` 已补上 DB-backed AI 控制平面表、quote-time persistence facts、provider-currency / runtime-cost normalization 字段、版本历史存储，以及按尝试分行的 `api_cost_ledger` settlement 字段。Migration `20260520_0032` 已把 active defaults 切回 GeekAI text / analysis / image routes，并保持 provider routing 由服务端拥有。当前 alpha 的关键闸门仍是完成 staging/browser 验收，再用真实凭据把一条 provider-backed image path 端到端手测通过，并继续扩大 live-provider coverage。

## 当前 Alpha 边界

- 发布关键：quote/preflight、payer summary、Team-wallet/personal-wallet resolver、持久化 run lifecycle，以及一条真实的 provider-backed image path
- 本地产品证明：画布里的 GeekAI-first chat、prompt optimizer、image gen/edit/reference 和 analysis flows
- 非当前 alpha 承诺：完整 provider breadth、更广的 refund/reconciliation depth，以及叠加在 message-native chat 之上的自动 graph-planning 层

## 当前状态

- Mock Model Registry 已存在，并被 Image Gen / Image Gen 4 节点控件消费。
- 面向画布的 AI node UX 现在已有 GeekAI-first fast path 用于本地产品验证：Chat 可以流式输出文本，Prompt Optimizer 可以流式输出优化后的出图提示词，Analysis 可以选择 OpenAI-style 或 Gemini-style visual analysis，Image Gen / Image Gen 4 可以通过当前 web app route 把图片返回到 slots 和 board Assets。
- 图片节点控件现在已经体现 GPT Image 2、Nano Banana 2、Doubao Seedream 和 Jimeng-style generation/edit/reference flows 的模型特定参数界面。这些控件是有价值的 UX proof，但 provider-specific 参数映射在生产依赖前仍需要移动到服务端 provider adapter/control-plane 边界后面。
- 2026-05-18 计费刷新：DeepSeek OCR 2 已从活跃默认模型、路由和价格规则中移除；Analysis 默认 `qwen/qwen2.5-vl-72b-instruct`；文字 / 图像分析按 prompt、system prompt、history、context 和图片输入估算 token 成本，并保留最低扣费。
- 2026-05-20 GeekAI provider refresh：active defaults 现在使用 `geekai`；图片 scope 优先 `GEEKAI_BALANCE_IMAGE_API_KEY`，并保留 `GEEKAI_OFFICIAL_IMAGE_API_KEY` 等可选 image aliases；文本 scope 使用 `GEEKAI_TEXT_API_KEY`，视频 scope 保留 `GEEKAI_VIDEO_API_KEY`；Chat 和 Prompt Optimizer 默认 `qwq-plus-latest`，通过 GeekAI `/chat/completions` + `stream: true`；backend AiRun text 调用也请求上游 streaming，并把 SSE chunks 聚合回 durable `text_output`。GPT Image 2 走 GeekAI `/images/generations`，Nano Banana 2 走 GeekAI `/chat/completions` 和 `gemini-3.1-flash-image-preview`；前后端现在都会保留 Nano 的扩展比例，不再静默回退到 `1:1`。
- 2026-05-20 post-stage fix: Nano Banana 2 / GeekAI chat-completion image outputs now infer the stored Asset MIME from image magic bytes instead of trusting a returned data-URL/header MIME. This fixes JPEG/WebP payloads that arrive behind a `data:image/png` wrapper and keeps SVG/PDF/non-image payloads rejected by the existing Asset magic-byte guard.
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
- AI Chat / Prompt upstream mock dataflow 已经存在于画布中；当画布指向 FastAPI persistence API 时，Chat 也已经能以 `params.messages` 加可选 `inputAssetIds` 走同一套 server AiRun lifecycle，而 Prompt Optimizer 继续共享这条 text-run 路径。无后端或纯本地开发时，两者仍保留本地流式 fallback。
- Migration `20260513_0020` 还顺手补了一层契约收口：当用户选择了不支持当前 `runType` 的模型时，quote 不再静默落到一个不相关模型上；OpenAI-compatible live adapter 现在也接受 `image_analysis`，会把 prompt 加 inline image refs 一起发到 `chat/completions`。
- `services/api/scripts/s2_live_ai_smoke.py` 现在已经可以把一条 live image run 和一条后续 analysis run 串起来做验收，给本地 real-DB smoke 与后续 staging/provider 验收复用。
- live adapter 覆盖仍不完整：更丰富的 multimodal chat/message runs 还没成为一等 AiRun 输入，而且新的 settlement shell 还需要在更多真实 provider 上补齐深度，以及把 refund/reconciliation policy 做完整。

## 下一步必要工作

1. 先完成 S1B/S1C staging / 真实数据库 / 真实登录 smoke，拿到可信的线上边界。
2. 按 `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md`，继续把剩余本地 provider-shaped fast path 收口到服务端 provider-route adapter layer，并减少生产对 Next 本地 fallback 的依赖。
3. 保持 Team workspace runs 扣 Team wallet、Group/Collaborate workspace runs 扣操作者个人钱包，并继续补 live smoke。
4. 把 live adapters 的能力覆盖补齐，让 image generation、image edit/reference、analysis 和 prompt/text optimization 都能输出 durable Asset 或短文本结果。
5. 围绕真实 provider outcomes，把 success / failure / cancel / refund 路径在 `credit_ledger`、`api_cost_ledger` 和 provider 返回 usage/cost 事实之间做完整对账。
6. 在不存长原始 payload 的前提下，安全保留 provider-response summaries 以支撑 runtime UX。
7. 用一条带真实凭据的 live provider route 手测 Konva Run/Stop -> create/poll/cancel 路径，并继续收紧用户可见的 quote / error / cancel 文案。

## 验证目标

- API keys 保持在服务端。
- Board documents 只保存 Asset / AiRun refs 和 short summaries。
- provider raw response、Base64 image 或 complete log 都不能进入 Board / History / node props。
- 失败的 provider call 不能静默消耗 credits。
- 每次运行在 provider call 开始前都能解释谁付钱，以及为什么。
