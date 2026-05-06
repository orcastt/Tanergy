# PRD Slice S2: AI Productization

**Updated**: 2026-05-06
**Mode**: Architecture slice.

## Goal

Turn the mock Model Registry and AiRun contracts into a real server-side AI execution path.

## Product Requirements

| Area | Requirement | Status |
| --- | --- | --- |
| Model Registry | The UI reads available image/text models and capabilities from the server. | Mock contract exists |
| Image Gen | Prompt Node -> Image Gen creates one image Asset. | Not started |
| Image Gen 4 | Prompt Node -> Image Gen 4 creates four candidate image Assets. | Not started |
| Image edit/reference | Image Node + Prompt Node -> Image Gen creates edited/fused image Asset. | Not started |
| Analysis | Image Node + Prompt Node -> Analysis creates text/prompt output. | Not started |
| AiRun history | User can inspect own AI calls, status, latency, cost and credit impact. | Planned |
| Charge transparency | Before the user runs AI, the UI can explain whether the run will charge the actor's personal/top-up balance, the actor's Team seat allowance or an explicit Enterprise workspace pool. | Mock payer contract exists |
| Cost controls | Server records provider cost, credits charged/refunded, timeout, failure and retry state. | Internal ledger helper + optional mock charge exercise exist; provider cost controls planned |
| Dynamic model pricing | Each model/tier combination, such as image generation resolution, quality and output count, has a server-managed credit estimate and final settlement rule. | Planned |
| Provider routing | One product model can have multiple provider routes, and developer/admin operators can enable, disable, reorder or fail over those routes without frontend deploys. | Planned |
| AI Chat planner | Chat can propose a legal graph spec; user confirms before applying/running. | Planned |

Current canvas readiness note: Konva node UI and runtimeGraph mock dataflow are strong enough to begin real provider adapter planning. Mock AiRun can now exercise credit-ledger usage charging behind `TANGENT_AI_MOCK_LEDGER_CHARGING=1`, but real provider calls still must wait for server-side AiRun persistence, Auth/rate-limit/provider-cost controls and Asset upload of generated results.

## Model Pricing Product Rules

- Product-visible model names should be stable even when suppliers change. For example, `GPT Image 2` can remain visible to users while the backend switches from one healthy provider route to another.
- Resolution/quality/count tiers such as `0.5K`, `1K`, `2K`, `4K`, `low`, `medium`, `high` and `1/4 outputs` must be priced by server-managed rules, not by canvas code.
- The Run UI should show an estimated credit cost before execution. The final charged/refunded credits may differ when a provider returns actual usage facts.
- If a provider route is unhealthy, the server may retry another route, but the user must still see one AiRun and one final credit settlement.
- Developer/admin operators need a backend UI to adjust model availability, tier prices, provider route priority, provider-specific parameter mapping and credit multipliers as market prices change.
- All pricing changes must be versioned and audited. Old AiRuns keep their historical pricing version; new AiRuns use the newly published version.

## Acceptance

- API keys never reach frontend code.
- Board document stores only Asset/AiRun references and short run summaries.
- Every provider call creates structured AiRun/API-call records.
- Every provider call also records who paid, which account was charged and which workspace kind/entitlement source allowed the run.
- Failed calls show useful user-facing error state and do not silently consume credits.
- Model routing can be disabled or changed server-side.

## Non-Goals

- No direct provider calls from node UI.
- No provider raw response in Board document.
- No unlimited unauthenticated AI usage.
- No hidden credit charging that the user, Team admin or authorized developer/admin cannot later audit.

## 中文完整翻译

# PRD 切片 S2：AI 产品化

**更新日期**：2026-05-06
**模式**：架构切片。

## 目标

把 mock Model Registry 和 AiRun contracts 转换成真实的服务端 AI 执行路径。

## 产品要求

| 领域 | 要求 | 状态 |
| --- | --- | --- |
| Model Registry | UI 从服务端读取可用 image/text models 和能力。 | Mock contract exists |
| Image Gen | Prompt Node -> Image Gen 创建一个 image Asset。 | Not started |
| Image Gen 4 | Prompt Node -> Image Gen 4 创建四个候选 image Assets。 | Not started |
| Image edit/reference | Image Node + Prompt Node -> Image Gen 创建 edited/fused image Asset。 | Not started |
| Analysis | Image Node + Prompt Node -> Analysis 创建 text/prompt output。 | Not started |
| AiRun history | 用户可以检查自己的 AI calls、status、latency、cost 和 credit impact。 | Planned |
| Charge transparency | 用户运行 AI 之前，UI 可以解释本次运行会扣 actor 的 personal/top-up balance、actor 的 Team seat allowance，还是明确的 Enterprise workspace pool。 | Mock payer contract exists |
| Cost controls | 服务端记录 provider cost、credits charged/refunded、timeout、failure 和 retry state。 | Internal ledger helper + optional mock charge exercise exist；provider cost controls planned |
| Dynamic model pricing | 每个 model/tier 组合，例如生图分辨率、质量和输出数量，都有服务端管理的 credit estimate 和最终结算规则。 | Planned |
| Provider routing | 一个产品模型可以拥有多条 provider routes，developer/admin operators 可以在不部署前端的情况下启用、禁用、排序或 fail over 这些线路。 | Planned |
| AI Chat planner | Chat 可以提出合法 graph spec；用户确认后才 apply/running。 | Planned |

当前 canvas readiness note：Konva node UI 和 runtimeGraph mock dataflow 已足够开始真实 provider adapter planning。Mock AiRun 现在可以在 `TANGENT_AI_MOCK_LEDGER_CHARGING=1` 后面演练 credit-ledger usage charging，但真实 provider calls 仍必须等待 server-side AiRun persistence、Auth/rate-limit/provider-cost controls，以及 generated results 的 Asset upload。

## 模型定价产品规则

- 面向产品显示的模型名称应该稳定，即使供应商变化也不应影响用户理解。例如 `GPT Image 2` 可以继续展示给用户，而后端在多条健康 provider routes 之间切换。
- `0.5K`、`1K`、`2K`、`4K`、`low`、`medium`、`high` 和 `1/4 outputs` 这样的分辨率 / 质量 / 数量档位，必须由服务端规则定价，不能由画布代码写死。
- Run UI 应该在执行前展示预计 credit cost。当 provider 返回 actual usage facts 时，最终 charged / refunded credits 可以和预计值不同。
- 如果某条 provider route 不健康，服务端可以重试另一条 route，但用户仍然只应看到一个 AiRun 和一次最终 credit settlement。
- Developer/admin operators 需要一个后台 UI，可以随着市场价格变化调整 model availability、tier prices、provider route priority、provider-specific parameter mapping 和 credit multipliers。
- 所有 pricing changes 都必须版本化并写审计。旧 AiRuns 保留历史 pricing version；新 AiRuns 使用新发布的 version。

## 验收

- API keys 永远不能进入 frontend code。
- Board document 只存 Asset/AiRun references 和 short run summaries。
- 每个 provider call 都创建结构化 AiRun/API-call records。
- 每个 provider call 也记录谁付费、哪个 account 被扣费，以及哪个 workspace kind / entitlement source 允许本次运行。
- Failed calls 显示有用的 user-facing error state，并且不能静默消耗 credits。
- Model routing 可以在服务端 disabled 或 changed。

## 非目标

- Node UI 不直接调用 provider。
- Board document 不保存 provider raw response。
- 不允许无限制 unauthenticated AI usage。
- 不允许隐藏 credit charging，必须能被用户、Team admin 或 authorized developer/admin 后续审计。
