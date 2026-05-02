# AI Node Contract Architecture Slice

**Updated**: 2026-05-02  
**Canonical source**: `ARCH.md` sections 4.4.1, 4.6, 8.4-8.6

## Current Status

- P0 node types remain: Prompt, Image Gen, Image Gen 4, Analysis, Image.
- Mock Model Registry and mock AiRun routes exist in Next local bridge and FastAPI.
- Image Gen / Image Gen 4 model dropdowns read the model contract instead of hardcoding final truth in components.
- Real provider calls, cost logs and result Asset writes are not implemented yet.
- Node cards are self-contained for P0; no persistent left Node Inspector.

## Extension Contract

Every new AI node or AI Chat tool must define:

- `nodeType`, `displayName`, `version`, `runType`.
- Input/output ports and data types.
- Lightweight `paramsSchema` / card fields.
- Required model capability.
- Result shape: text, asset ids, multiple images, graph spec.
- Failure states and retry behavior.
- Persistence constraints.

## Persistence Rule

Node card props may store:

- ids
- short params
- layout
- port summary
- run id
- model id
- short status/error/cost hint
- Asset ids
- short text preview

Node card props may not store:

- API keys
- provider raw responses
- full logs
- long analysis text
- Base64/data/blob images

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

Do not connect real providers until Auth/Board/Asset boundaries are stable enough for:

- server-owned provider keys
- model allowlist
- user/workspace permission checks
- rate limits
- budget kill switch
- AiRun/API call logs
- result images written as Assets
