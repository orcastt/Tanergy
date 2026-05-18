# S2 AI Provider Route + Billing Control Plane

**Updated**: 2026-05-18
**Status**: Active tactical plan for keeping AI provider calls, route switching, credit charging and admin observability behind one server-owned AiRun control plane while the current deployment is Jiekou-first and the architecture remains provider-neutral.

## Goal

Make every production AI node run through the same server-side control plane:

```text
Canvas node Run
  -> AiRun request
  -> model + parameter tier resolution
  -> payer / permission / credit preflight
  -> provider route selection
  -> provider execution
  -> Asset persistence
  -> credit + provider-cost settlement
  -> Admin/runtime observability
```

This lets the product add or switch providers later without changing node behavior, while keeping user credits, team visibility and admin monitoring explainable.

## Why Now

Recent local canvas work proves the desired user-facing flow with Jiekou-first image, analysis and chat paths. That is good for product speed, but the production spine must not remain provider-hardcoded in frontend-facing code.

The next backend cut should reconcile that fast path with the existing DB-backed S2/S3 control-plane scaffold:

- product models stay stable for users
- provider routes can be enabled, disabled or reprioritized by admin/developer operators
- every run records user, workspace/team, board, node, model, route, pricing rule, status, latency and costs
- credit settlement is server-owned and never performed by the browser

## Scope

In scope:

- Image generation and image edit for `Image Gen` and `Image Gen 4`
- Analysis and prompt/text AI runs where the output is a short text result
- Model registry, provider route registry and pricing rule registry as server-owned facts
- Admin/developer route switching and runtime inspection
- Credit preflight and settlement for successful/failed/canceled runs
- Generated Asset persistence and Board-safe refs

Out of scope for this cut:

- AI Chat automatic graph/node creation
- Full external payment provider reconciliation
- Enterprise pooled wallet automation beyond preserving the contract shape
- Broad provider breadth beyond one live route plus a clear extension point
- Storing full provider raw responses, base64 images or long generated text in Board documents

## Current Starting Point

Already present in the architecture/state docs and first-pass code:

- DB-backed model/provider-route/pricing tables and fallback default catalogs
- AiRun create/read/cancel lifecycle shell
- quote/preflight path
- attempt-level `ai_api_calls`
- attempt-level `api_cost_ledger`
- admin AI model/route/pricing inspection and first-pass mutation surfaces
- optional mock credit charging behind `TANGENT_AI_MOCK_LEDGER_CHARGING=1`
- live provider adapter scaffold for OpenAI-compatible and Google-style providers

Current gap:

- the latest local canvas-facing Next API path should be treated as a fast local integration path, then folded back into the unified AiRun/provider-route adapter layer before production reliance
- the active image-generation lane is now explicitly GPT Image 2, Nano Banana 2, Doubao Seedream 5.0 Lite and Jimeng 4.0; migration `20260514_0021_ai_image_model_refresh.py` keeps backend seeds aligned and `gemini-3.1-flash-image-preview` is no longer part of the active image-generation surface
- long-running image routes now assume a `240000 ms` timeout boundary instead of the shorter local default
- Prompt Optimizer and the message-native Chat node now share a backend short-text `AiRun` path with durable terminal `text_output` when the canvas is pointed at FastAPI; backend analysis-capable model/route/pricing seed plus one reusable `s2_live_ai_smoke.py` image->analysis acceptance script now also exist; remaining work is credentialed live image/analysis smoke and reducing production dependence on local Next fallbacks
- provider parameter mapping for models like GPT Image 2, Nano Banana 2, Doubao Seedream and Jimeng needs to live in route/model configuration or provider adapter code, not scattered in node components
- credit estimation and final settlement still need a clean end-to-end smoke path with real credentials
- 2026-05-18 pricing checkpoint: DeepSeek OCR 2 is removed from active model/route/pricing defaults, short-text chat now defaults to DeepSeek V3.1, image analysis defaults to Qwen 2.5 VL 72B, token-priced text/image-analysis runs estimate credits from prompt/system/history/context size, and fixed-cost image tiers use a `1 credit = $0.01`, 25% target gross margin rule rounded up to 0.5-credit steps. Doubao Seedream 5.0 Lite is temporarily conservative at 5 credits until the Jiekou image pricing table is verified.

## Target Data Facts

### Model Registry

Each product model should define:

- `model_key`
- display name
- capabilities: `image_generation`, `image_edit`, `image_reference`, `image_analysis`, `text`
- supported node types
- default product-facing params
- allowed product-facing parameter tiers
- enabled/default state

Users and nodes choose product models, not supplier routes.

### Provider Routes

Each route should define:

- `route_id`
- `model_key`
- `provider_key`
- `provider_model`
- `api_key_env_name`
- optional `base_url`
- supported capabilities and parameter tiers
- route priority, weight, timeout and retry policy
- health/enabled state

The database stores env var names, never secret values.

Example:

```text
model_key: gpt-image-2
route_id: route_gpt_image_2_jiekou_primary
provider_key: jiekou
provider_model: gpt-image-2
api_key_env_name: JIEKOU_IMAGE_KEY
priority: 10
enabled: true
```

### Pricing Rules

Each pricing rule should define:

- `pricing_rule_id`
- `model_key`
- tier key or parameter match
- estimated credits
- minimum credits
- billing unit: per run, per image, per token or custom
- provider-cost formula
- effective window and version status

AiRun stores the exact pricing rule used at run time so later rule edits do not rewrite history.

### AiRun / Attempt / Cost Facts

Every run should preserve:

- actor user id
- workspace/team id and workspace kind
- board id
- node id and node type
- run type
- model id
- selected tier/params summary
- route id and provider key
- pricing rule id
- charged account id and charged scope
- status, latency, error code/message
- output Asset ids
- estimated credits, charged credits and refunded credits
- provider cost and provider currency when available

Admin surfaces should query these facts directly rather than reconstruct them from Board documents.

## Implementation Phases

### Phase 1: Contract Reconciliation

- Confirm one canonical `AiRunRequest` shape for image generation, image edit, analysis and text/prompt optimization.
- Keep node payloads product-facing: `modelId`, node type, prompt, input asset ids and normalized product params.
- Remove any need for frontend code to know provider route ids or raw supplier endpoints.
- Add a small mapping document or typed adapter contract for provider-native params.

Exit criteria:

- Image Gen / Image Gen 4 requests can be represented without provider-specific fields leaking into the node contract.
- Analysis and text runs can share the same lifecycle shape even when provider execution differs.

### Phase 2: Active Provider Route Cleanup

- Keep Jiekou as the active deployed provider route while retaining provider-neutral control-plane tables, adapters and admin/runtime facts.
- Move remaining local-bridge provider decisions into adapter-owned mapping functions:
  - `/images/generations`
  - `/images/edits`
  - `/chat/completions`
  - `/responses` if needed
- Preserve model-specific payload rules inside adapter-owned mapping functions.
- Use provider/scope-specific env keys from server env only.

Exit criteria:

- A run can select a Jiekou route by model/priority, not by frontend hardcoding.
- The adapter can support GPT Image 2, Nano Banana 2 and Doubao Seedream payload differences without leaking provider-specific fields into the node contract.
- Admin/provider editor surfaces do not hard-code a single provider brand even if the current deployment keeps one-provider policy enabled.

### Phase 3: Credit Preflight + Settlement

- Run quote/preflight before any provider request.
- Reject before provider execution if actor lacks board permission, model entitlement or enough eligible credits.
- On success, settle user credits against the charged account chosen at run creation.
- On provider failure before work starts, do not charge.
- On work-started failure or provider-returned cost, write provider-cost facts and apply the documented settlement policy.

Exit criteria:

- One successful image run writes both user-credit settlement and provider-cost facts.
- One insufficient-balance run fails before provider call.
- One provider failure path is visible in Admin without double charging.

### Phase 4: Admin Developer Control

- Ensure `/admin` can inspect:
  - models
  - provider routes
  - pricing rules
  - AiRuns
  - API-call attempts
  - cost ledger rows
- Ensure save/publish/rollback is audited and versioned for model, route and pricing edits.
- Add a practical route toggle smoke path: disable the current Jiekou primary route, enable a backup/fallback route when one exists.

Exit criteria:

- Admin can tell which user/team/board/node/model/route generated an output.
- Admin can disable a route without redeploying frontend code.
- Old AiRuns keep old pricing/route facts after a new config version is published.

### Phase 5: Canvas Integration

- Point the formal canvas run path at the server AiRun lifecycle for production/staging.
- Keep local Next routes only as a development fallback if needed.
- Hydrate successful output Asset refs back into node generated slots.
- Keep Board docs limited to Asset ids, compact summaries and run ids.

Exit criteria:

- `Prompt -> Image Gen -> Image` works through server AiRun.
- `Prompt -> Image Gen 4` returns four slot-safe Asset refs.
- `Image + Prompt -> Analysis` returns a short text output without storing raw provider response.

## Smoke Tests

Minimum manual smoke before calling this cut stable:

1. Admin route visibility:
   - open `/admin`
   - confirm model, route, pricing and runtime panels load
2. Credit preflight:
   - run with enough credits succeeds
   - run with insufficient credits fails before provider execution
3. Jiekou live image:
   - run one `Image Gen` with a low-cost/default route
   - use one of `gpt-image-2`, `nano-banana-2`, `doubao-seedream-5.0-lite` or `jimeng_t2i_v40`
   - confirm output persists as an Asset and appears in node preview
4. Image Gen 4:
   - run one four-output generation
   - confirm exactly four slots are populated
5. Observability:
   - confirm run has user id, workspace id, board id, node id, model id, route id, pricing rule id, latency, status, output asset ids and cost facts
6. Safety:
   - confirm Board document does not store provider raw response, base64 image data, blob URLs or long generated text

## Quality Gates

Frontend:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

Backend/API:

```bash
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api services/api/migrations
git diff --check
```

## Open Decisions

- Whether local Next AI routes remain as a no-DB local development fallback or become thin proxies to FastAPI only.
- Whether to model provider-native parameter mapping in DB as route metadata, in adapter code, or as a hybrid with safe adapter validation.
- Whether Image Gen 4 should prefer provider-native multi-output where available or always perform four single-output calls for slot determinism.
- How to handle provider work-started failures that charge supplier cost but return no usable output.
- When to turn on real credit charging by default instead of `TANGENT_AI_MOCK_LEDGER_CHARGING=1`.

## Do Not Break

- API keys and provider secrets stay server-side only.
- Frontend never chooses raw provider routes.
- One AiRun has one payer and one final settlement outcome.
- Route failover must not double-charge users.
- Board documents store refs and compact summaries only.
- Admin writes remain server-gated, audited and versioned.
