# PRD Slice S2: AI Productization

**Updated**: 2026-05-05
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
| Cost controls | Server records provider cost, credits charged/refunded, timeout, failure and retry state. | Planned |
| AI Chat planner | Chat can propose a legal graph spec; user confirms before applying/running. | Planned |

Current canvas readiness note: Konva node UI and runtimeGraph mock dataflow are strong enough to begin real provider adapter planning. Real provider calls still must wait for server-side AiRun, Auth/rate-limit/cost controls and Asset upload of generated results.

## Acceptance

- API keys never reach frontend code.
- Board document stores only Asset/AiRun references and short run summaries.
- Every provider call creates structured AiRun/API-call records.
- Failed calls show useful user-facing error state and do not silently consume credits.
- Model routing can be disabled or changed server-side.

## Non-Goals

- No direct provider calls from node UI.
- No provider raw response in Board document.
- No unlimited unauthenticated AI usage.
