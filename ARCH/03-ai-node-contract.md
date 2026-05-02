# AI Node Contract Architecture Slice

**Updated**: 2026-05-02  
**Canonical source**: `ARCH.md` sections 4.4.1, 4.6, 4.8-4.10, 5.6-5.8, 8.4-8.6

## Current Status

- P0 node types remain: Prompt, Image Gen, Image Gen 4, Analysis, Image.
- Mock Model Registry and mock AiRun routes exist in Next local bridge and FastAPI.
- Image Gen / Image Gen 4 model dropdowns read the model contract instead of hardcoding final truth in components.
- Node Run creates a mock AiRun and writes a runtime summary back to the node.
- Real provider calls, cost logs, credit charging and result Asset writes are not implemented yet.
- Node cards are self-contained for P0; no persistent left Node Inspector.

## AI Node Extension Contract

Every new AI node, AI Chat tool or specialized AI bot must define:

- `nodeType`
- `displayName`
- `version`
- `runType`
- input/output ports and data types
- required vs optional ports
- multi-connect rules
- lightweight `paramsSchema` / card fields
- required model capability
- result shape: text, asset ids, multiple images or graph spec
- preview UI fields
- failure states and retry behavior
- persistence constraints

## Execution Boundary

```text
Node card
  -> server-owned AiRun request
    -> server validates session/workspace/board/model/params/rate limit/budget
      -> provider call
        -> write AiRun + ai_api_calls + result Assets
          -> return short run summary
            -> node stores runId/status/assetIds/short hints only
```

Node UI may send:

- `boardId`
- `nodeId`
- `nodeType`
- `runType`
- `selectedModelId`
- lightweight params
- Asset ids

Node UI may not send or store:

- Provider API keys.
- Provider raw responses.
- Full logs.
- Long analysis text.
- Base64/data/blob images.
- Final credit/accounting truth.

## Model Registry

Current mock route:

```http
GET /api/v1/ai/models?capability=image_generation
GET /api/ai/models?capability=image_generation
```

Model contract includes:

- `id`
- `provider`
- `displayName`
- `capabilities`
- `parameterSchema`
- `isEnabled`
- `isDefault`
- `estimatedLatency`
- `costHint`

Real model ids, prices and parameters must come from server configuration/provider integration. Components must not hardcode final provider truth.

P0 candidate model labels remain illustrative:

- `gpt-image-2`
- `gemini-3.1-flash-image-preview`

## AiRun

Current mock route:

```http
POST /api/v1/ai/runs
GET  /api/v1/ai/runs/{run_id}
POST /api/ai/runs
```

Target `ai_runs` fields:

- `id`
- `user_id`
- `board_id`
- `node_id`
- `provider`
- `model`
- `endpoint`
- `request_params`
- `response_meta`
- `status`
- `latency_ms`
- `cost_credits`
- `error_code`
- `created_at`

Target provider-call facts live in `ai_api_calls`; one run may contain multiple provider calls.

## AI Planner / Chat

Planner target route:

```http
POST /api/v1/ai/planner
```

Planner/Chat may output only legal graph specs:

- Node Registry allowed node types.
- Legal ports and edge types.
- Valid selected model id from Model Registry.
- Reasonable node count.
- Layout compatible with current viewport.

Planner/Chat may not bypass Node Runtime to write provider results directly.

Current state:

- Mock graph / planner spike exists.
- Formal right-side AI Chat product panel is not yet connected.
- Long-term chat history is not P0.

## Failure And Cost Rules

Real AI provider slice must include:

- model allowlist
- server-side params validation
- rate limits
- budget kill switch
- structured errors
- retryable marker
- no-charge/refund marker
- result images written as Assets
- API call logs with provider, route, status, latency, credits and raw provider cost fields

Do not connect real providers until Auth/Board/Asset boundaries are stable enough for server-owned keys, permission checks, logs and budget limits.

## Important Files

| Area | Files |
| --- | --- |
| Node types | `apps/web/src/types/nodeRuntime.ts`, `types/nodeCardShape.ts` |
| Registry | `apps/web/src/features/node-runtime/registry.ts` |
| Data flow | `nodeDataFlow.ts`, `nodeEdges.ts`, `connectionRules.ts` |
| Node cards | `components/nodes/NodeCardContent.tsx`, `NodeCardPreviews.tsx` |
| AI contracts | `apps/web/src/features/ai/`, `features/ai-runs/` |
| Next routes | `apps/web/src/app/api/ai/` |
| FastAPI routes | `services/api/tangent_api/routers/` |

## Next Real AI Slice

Minimum safe order:

1. Finalize Model Registry schema and API.
2. Add `ai_runs`, `ai_api_calls`, and cost ledger migration.
3. Add provider route with server-only key.
4. Add rate limit and budget kill switch.
5. Make generated images become Assets.
6. Update Image Gen / Image Gen 4 / Analysis node run paths.
7. Add contract tests and staging smoke.
