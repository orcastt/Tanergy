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
| Charge transparency | Before the user runs AI, the UI can explain whether the run will charge the actor's personal/top-up balance, the actor's Team seat allowance or an explicit Enterprise workspace pool. | Planned |
| Cost controls | Server records provider cost, credits charged/refunded, timeout, failure and retry state. | Planned |
| AI Chat planner | Chat can propose a legal graph spec; user confirms before applying/running. | Planned |

Current canvas readiness note: Konva node UI and runtimeGraph mock dataflow are strong enough to begin real provider adapter planning. Real provider calls still must wait for server-side AiRun, Auth/rate-limit/cost controls and Asset upload of generated results.

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
| Charge transparency | 用户运行 AI 之前，UI 可以解释本次运行会扣 actor 的 personal/top-up balance、actor 的 Team seat allowance，还是明确的 Enterprise workspace pool。 | Planned |
| Cost controls | 服务端记录 provider cost、credits charged/refunded、timeout、failure 和 retry state。 | Planned |
| AI Chat planner | Chat 可以提出合法 graph spec；用户确认后才 apply/running。 | Planned |

当前 canvas readiness note：Konva node UI 和 runtimeGraph mock dataflow 已足够开始真实 provider adapter planning。真实 provider calls 仍必须等待 server-side AiRun、Auth/rate-limit/cost controls，以及 generated results 的 Asset upload。

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
