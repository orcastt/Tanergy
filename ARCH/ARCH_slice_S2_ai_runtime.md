# ARCH Slice S2: AI Runtime

**Updated**: 2026-05-05
**Mode**: Architecture slice.

## Scope

Node Registry, Model Registry, AiRun, provider routing, cost/credit facts and AI Chat planner.

## Contract

```text
Node UI
  -> asks server for model capabilities
  -> creates AiRun request
  -> receives Asset/AiRun summary
  -> writes only short summary and refs to Board document

Server
  -> validates user/workspace/board
  -> selects provider route
  -> calls provider with server-side key
  -> uploads results as Assets
  -> writes AiRun / ai_api_calls / cost ledger
```

## Required Expansion Path For New AI Nodes

1. Add/extend Node Registry spec.
2. Add/extend Model Registry capability.
3. Add AiRun request/response schema.
4. Add Next/FastAPI route support.
5. Add provider adapter or mock.
6. Add tests and Board guard checks.
7. Update PRD/ARCH slice files.

## Current State

- Mock Model Registry exists.
- Mock AiRun route exists.
- Image Gen / Image Gen 4 model dropdown reads contract.
- Konva runtimeGraph mock flow now exercises Prompt/Image/Chat/Image Gen/Analysis data passing, export ports and generated Asset refs without provider raw payloads.
- Real provider calls, real AiRun persistence and cost logging are not done.

## Launch-Readiness Sequence

1. Keep API keys server-side and choose provider adapter boundaries.
2. Add server-side AiRun persistence and `ai_api_calls` writes before real calls.
3. Upload generated outputs as Assets; return Asset refs and short summaries only.
4. Wire Konva Run/Stop UI to AiRun create/poll/cancel.
5. Add provider failure, timeout, rate-limit and cost tests.

## Do Not Do

- Do not call providers from frontend.
- Do not store provider raw responses in Board document.
- Do not let frontend select arbitrary provider routes.
- Do not run real AI without rate limit and cost logging.
