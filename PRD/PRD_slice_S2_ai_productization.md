# PRD Slice S2: AI Productization

**Updated**: 2026-05-20
**Mode**: Product slice.

## Goal

Turn the mock Model Registry and AiRun contracts into a real server-side AI execution path.

## P0 Alpha Release Boundary

This slice is intentionally narrower in the current pass:

- P0 alpha requires one real server-backed AI image path with quote/preflight, payer transparency, Asset result persistence and settlement.
- The canvas now has a useful GeekAI-first local fast path for image, analysis, chat and prompt optimization UX, but production acceptance still requires that path to run through server-side AiRun/provider-route/billing contracts.
- The active image-generation product surface is currently GPT Image 2, Nano Banana 2 and Doubao Seedream 5.0 Lite. Nano Banana 2 maps to GeekAI `gemini-3.1-flash-image-preview` behind the product model key.
- Long-running image generation may take up to 240 seconds before the runtime declares timeout.
- Broader provider coverage across every node type remains deferred until the first live server AiRun path is stable.
- `Remove BG` and later image-operation utilities are not part of the current accepted live path until the server-owned backend/API flow is reconnected and verified.
- AI Chat automatic graph planning and broad refund/reconciliation depth are not current-alpha promises.

## Product Requirements

| Area | Requirement | Status |
| --- | --- | --- |
| Model Registry | The UI reads available image/text models and capabilities from the server. | Mock/local catalog plus DB-backed control-plane scaffold exist; production route source still needs reconciliation |
| Image Gen | Prompt Node -> Image Gen creates one image Asset. | Local GeekAI-first fast path plus refreshed model UI exist; production gate is server AiRun route/settlement path |
| Image Gen 4 | Prompt Node -> Image Gen 4 creates four candidate image Assets. | Local repeated-call UX plus refreshed model UI exist; production gate is server AiRun output-slot settlement |
| Image edit/reference | Image Node + Prompt Node -> Image Gen creates edited/fused image Asset. | Local GeekAI-first image/reference path exists across GPT Image 2, Nano Banana 2 and Doubao Seedream controls; production gate is server Asset refs and provider adapter mapping |
| Image operations | Selected image can trigger product-owned image utilities such as `Remove BG`, with the result persisted as a new Asset rather than a temporary browser-only bitmap. | Current truth: the `Remove BG` surface exists in the frontend, but end-to-end backend/API/staging acceptance is still pending; `Object Cutout` remains planned only |
| Analysis | Image Node + Prompt Node -> Analysis creates text/prompt output. | Local model-select analysis path exists; backend `AiRun` route integration, durable terminal `text_output`, default analysis-capable model seed and reusable live smoke harness now exist; remaining gate is credentialed provider smoke plus broader coverage |
| Chat | Chat Node turns message history plus optional image refs into a short assistant answer. | GeekAI `qwq-plus-latest` is now the default text model; local proxy streams SSE to the browser, and backend create/poll/cancel plus durable terminal `text_output` exist when the canvas is pointed at FastAPI |
| Prompt Optimizer | Prompt Optimizer Node turns rough image prompts into richer generation prompts through a text model. | GeekAI `qwq-plus-latest` is now the default optimizer model; local proxy streams SSE to the browser, and backend create/poll/cancel text AiRun remains available |
| AiRun history | User can inspect own AI calls, status, latency, cost and credit impact. | Planned |
| Charge transparency | Before the user runs AI, the UI can explain whether the run will charge the actor's personal wallet, the active Team wallet or an explicit Enterprise workspace pool. | Mock plus persisted payer contract exist; first Team-wallet resolver cut now exists |
| Cost controls | Server records provider cost, credits charged/refunded, timeout, failure and retry state. | Internal ledger helper + optional mock charge exercise exist; provider cost controls planned |
| Dynamic model pricing | Each model/tier combination, such as image generation resolution, quality and output count, has a server-managed credit estimate and final settlement rule. | Planned |
| Provider routing | One product model can have multiple provider routes, and developer/admin operators can enable, disable, reorder or fail over those routes without frontend deploys. | Planned |
| AI Chat planner | Chat can propose a legal graph spec; user confirms before applying/running. | Deferred |

Current canvas readiness note: Konva node UI and runtimeGraph dataflow are strong enough for product validation. The latest local path is GeekAI-first for chat streaming, prompt optimization, image generation/edit/reference and image analysis; text defaults now use GeekAI `qwq-plus-latest` for Chat/Prompt Optimizer while Analysis stays on Qwen VL for visual input. Model-aware image controls cover GPT Image 2 size/quality, Nano Banana 2 common/extended aspect ratios plus size, and Doubao Seedream size/output parameters. The 2026-05-20 control-plane checkpoint treats GeekAI as the active deployment route while preserving a provider-neutral product contract: product models stay stable while routes, provider keys, base URLs and pricing remain server-owned. This is a product proof, not the final production boundary. Production provider calls still need to stay folded into the server AiRun/provider-route control plane so Auth, rate limits, credit preflight, provider-cost facts, Asset upload and admin observability stay server-owned.

## Model Pricing Product Rules

- Product-visible model names should be stable even when suppliers change. For example, `GPT Image 2` can remain visible to users while the backend switches from one healthy provider route to another.
- Resolution/quality/count tiers such as `0.5K`, `1K`, `2K`, `3K`, `4K`, `low`, `medium`, `high`, aspect ratio choices and `1/4 outputs` must be priced by server-managed rules, not by canvas code.
- The Run UI should show an estimated credit cost before execution. The final charged/refunded credits may differ when a provider returns actual usage facts.
- If a provider route is unhealthy, the server may retry another route, but the user must still see one AiRun and one final credit settlement.
- Developer/admin operators need a backend UI to adjust model availability, tier prices, provider route priority, provider-specific parameter mapping and credit multipliers as market prices change.
- The admin route/model UI must not hard-code a single provider brand. Current deployment may be GeekAI-only, but provider keys, models and route labels should remain route/config facts instead of product copy.
- All pricing changes must be versioned and audited. Old AiRuns keep their historical pricing version; new AiRuns use the newly published version.

## Acceptance

- API keys never reach frontend code.
- Board document stores only Asset/AiRun references and short run summaries.
- Every provider call creates structured AiRun/API-call records.
- Every provider call also records who paid, which account was charged and which workspace kind/entitlement source allowed the run.
- Team workspace runs must charge the Team wallet after server preflight; Group/Collaborate runs must charge the acting user's personal wallet.
- Failed calls show useful user-facing error state and do not silently consume credits.
- Model routing can be disabled or changed server-side.
- At least one live server-backed image run succeeds on staging using one of the active image models.

## Non-Goals

- No direct provider calls from node UI.
- No provider raw response in Board document.
- No unlimited unauthenticated AI usage.
- No hidden credit charging that the user, Team admin or authorized developer/admin cannot later audit.

## 中文完整翻译

# PRD 切片 S2：AI 产品化

**更新日期**：2026-05-20
**模式**：产品切片。

## 目标

把 mock Model Registry 和 AiRun contracts 转换成真实的服务端 AI 执行路径。

## P0 Alpha 发布边界

当前这一轮，这个切片的范围是刻意收窄的：

- P0 alpha 只要求一条真实的、服务端驱动的 AI 图像路径，具备 quote/preflight、payer transparency、Asset 结果持久化和 settlement。
- 画布现在已经有一条可用的 GeekAI-first 本地 fast path，用于验证 image、analysis、chat 和 prompt optimization UX，但生产验收仍要求这条路径通过服务端 AiRun/provider-route/billing contracts。
- 当前活跃生图产品面是 GPT Image 2、Nano Banana 2 和 Doubao Seedream 5.0 Lite；Nano Banana 2 在 provider 层映射到 GeekAI `gemini-3.1-flash-image-preview`。
- 长耗时生图在运行时最多允许 240 秒后才判定超时。
- 覆盖所有 node type 的更广 provider 覆盖，都继续延后到第一条 live server AiRun 路径稳定之后。
- AI Chat 自动 graph planning，以及更深的 refund/reconciliation depth，都不是当前 alpha 的承诺。

## 产品要求

| 领域 | 要求 | 状态 |
| --- | --- | --- |
| Model Registry | UI 从服务端读取可用 image/text models 和能力。 | Mock/local catalog 与 DB-backed control-plane scaffold 已存在；生产 route source 仍需收口 |
| Image Gen | Prompt Node -> Image Gen 创建一个 image Asset。 | 本地 GeekAI-first fast path 和刷新后的模型 UI 已存在；生产闸门是 server AiRun route/settlement path |
| Image Gen 4 | Prompt Node -> Image Gen 4 创建四个候选 image Assets。 | 本地 repeated-call UX 和刷新后的模型 UI 已存在；生产闸门是 server AiRun output-slot settlement |
| Image edit/reference | Image Node + Prompt Node -> Image Gen 创建 edited/fused image Asset。 | 本地 GeekAI-first image/reference path 已覆盖 GPT Image 2、Nano Banana 2 和 Doubao Seedream 控件；生产闸门是 server Asset refs 和 provider adapter mapping |
| Analysis | Image Node + Prompt Node -> Analysis 创建 text/prompt output。 | 本地 model-select analysis path 已存在；backend `AiRun` route integration、durable terminal `text_output`、默认 analysis-capable model seed，以及可复用的 live smoke harness 都已存在；剩余闸门是带真实凭据的 provider smoke 和更广覆盖 |
| Chat | Chat Node 把 message history 加可选 image refs 转成短 assistant answer。 | GeekAI `qwq-plus-latest` 现在是默认文本模型；本地代理把 SSE 流式转发到浏览器，当画布指向 FastAPI 时仍有 backend create/poll/cancel 和 durable terminal `text_output` |
| Prompt Optimizer | Prompt Optimizer Node 通过 text model 把粗略出图提示词优化成更完整的生成提示词。 | GeekAI `qwq-plus-latest` 现在是默认 optimizer 模型；本地代理流式输出，同时保留 backend create/poll/cancel text AiRun 路径 |
| AiRun history | 用户可以检查自己的 AI calls、status、latency、cost 和 credit impact。 | Planned |
| Charge transparency | 用户运行 AI 之前，UI 可以解释本次运行会扣操作者个人钱包、当前 Team wallet，还是明确的 Enterprise workspace pool。 | Mock 与持久化 payer contract 已存在；Team-wallet resolver 第一阶段已落地 |
| Cost controls | 服务端记录 provider cost、credits charged/refunded、timeout、failure 和 retry state。 | Internal ledger helper + optional mock charge exercise exist；provider cost controls planned |
| Dynamic model pricing | 每个 model/tier 组合，例如生图分辨率、质量和输出数量，都有服务端管理的 credit estimate 和最终结算规则。 | Planned |
| Provider routing | 一个产品模型可以拥有多条 provider routes，developer/admin operators 可以在不部署前端的情况下启用、禁用、排序或 fail over 这些线路。 | Planned |
| AI Chat planner | Chat 可以提出合法 graph spec；用户确认后才 apply/running。 | 延后 |

当前 canvas readiness note：Konva node UI 和 runtimeGraph dataflow 已足够做产品验证。最新本地路径使用 GeekAI-first 验证 chat streaming、prompt optimization、image generation/edit/reference 和 image analysis；文本默认现在用 GeekAI `qwq-plus-latest` 服务 Chat/Prompt Optimizer，Analysis 仍用 Qwen VL 承接视觉输入。模型感知图片控件覆盖 GPT Image 2 的 size/quality、Nano Banana 2 的常见和扩展 aspect/size、Doubao Seedream 的 size/output 参数。2026-05-20 control-plane checkpoint 已把活跃部署路线切回 GeekAI，但长期合同仍保持 provider-neutral：产品模型稳定，provider keys、base URLs、routes 和 pricing 都由服务端拥有。这是产品证明，不是最终生产边界。生产 provider calls 仍需要收口进 server AiRun/provider-route control plane，让 Auth、rate limits、credit preflight、provider-cost facts、Asset upload 和 admin observability 都保持服务端拥有。

## 模型定价产品规则

- 面向产品显示的模型名称应该稳定，即使供应商变化也不应影响用户理解。例如 `GPT Image 2` 可以继续展示给用户，而后端在多条健康 provider routes 之间切换。
- `0.5K`、`1K`、`2K`、`3K`、`4K`、`low`、`medium`、`high`、aspect ratio choices 和 `1/4 outputs` 这样的分辨率 / 质量 / 比例 / 数量档位，必须由服务端规则定价，不能由画布代码写死。
- Run UI 应该在执行前展示预计 credit cost。当 provider 返回 actual usage facts 时，最终 charged / refunded credits 可以和预计值不同。
- 如果某条 provider route 不健康，服务端可以重试另一条 route，但用户仍然只应看到一个 AiRun 和一次最终 credit settlement。
- Developer/admin operators 需要一个后台 UI，可以随着市场价格变化调整 model availability、tier prices、provider route priority、provider-specific parameter mapping 和 credit multipliers。
- 所有 pricing changes 都必须版本化并写审计。旧 AiRuns 保留历史 pricing version；新 AiRuns 使用新发布的 version。

## 验收

- API keys 永远不能进入 frontend code。
- Board document 只存 Asset/AiRun references 和 short run summaries。
- 每个 provider call 都创建结构化 AiRun/API-call records。
- 每个 provider call 也记录谁付费、哪个 account 被扣费，以及哪个 workspace kind / entitlement source 允许本次运行。
- Team workspace runs 必须在服务端 preflight 后扣 Team wallet；Group/Collaborate runs 必须扣操作者个人钱包。
- Failed calls 显示有用的 user-facing error state，并且不能静默消耗 credits。
- Model routing 可以在服务端 disabled 或 changed。
- staging 上至少要有一条基于活跃生图模型的真实服务端生图 run 成功。

## 非目标

- Node UI 不直接调用 provider。
- Board document 不保存 provider raw response。
- 不允许无限制 unauthenticated AI usage。
- 不允许隐藏 credit charging，必须能被用户、Team admin 或 authorized developer/admin 后续审计。
