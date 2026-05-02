# ARCH Slice S2: AI Runtime

**Updated**: 2026-05-02
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
- Real provider calls, real AiRun persistence and cost logging are not done.

## Do Not Do

- Do not call providers from frontend.
- Do not store provider raw responses in Board document.
- Do not let frontend select arbitrary provider routes.
- Do not run real AI without rate limit and cost logging.
