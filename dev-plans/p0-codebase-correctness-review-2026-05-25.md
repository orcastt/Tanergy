# Tanergy Codebase Correctness Review — Chunked Plan

## Context

The codebase is a TANGENT AI-image-canvas monorepo (~870 source files: ~600 TS in `apps/web/`, 271 Python in `services/api/`). It mixes money-handling (credit ledger, Stripe webhooks, AI charging), multi-user state (Yjs/WebSocket collaboration), and a dense Konva interaction layer. There is solid pytest coverage on the backend (53 contract test files) but only one Playwright e2e file (`apps/web/e2e/security-smoke.spec.ts`) and no frontend unit tests.

The user wants a **function-level correctness bug hunt** across the whole repo, split into reviewable chunks, with **GitHub issues filed per finding** and **Playwright used reactively** to confirm suspect functions when static reading isn't enough.

Goals:
- Surface latent correctness bugs (state divergence, double-spend, race conditions, off-by-one, missing transactionality) before they become user incidents.
- Keep each chunk small enough to review thoroughly, sized to map to one tracking issue plus N finding issues.
- Respect AGENTS.md rules: every finding becomes its own issue, fixes go through normal `feat/<n>` / `fix/<n>` branch + PR + non-author review workflow.

Not goals (separate efforts, do not bundle):
- Splitting >300L files into <300L files (AGENTS.md gate violation). This review **flags** them by location but does not refactor.
- Security audit / pentest. Findings that happen to be security are filed under their chunk; we don't run a parallel security pass here.
- Adding broad e2e coverage. Playwright is verification-on-demand only.

## Approach

12 chunks, ordered by correctness blast radius (high → medium). Within each chunk: read every public function in scope, trace every state mutation and external boundary, file an issue per finding, post a closeout comment. Chunks run **sequentially**, not in parallel — early findings (e.g., a bug in auth session resolution) reframe what counts as a bug in downstream chunks.

Plan file for the review itself: register this as a tactical plan at `dev-plans/p0-codebase-correctness-review-2026-05-25.md` once execution starts, so it appears in `dev-plans/README.md` alongside other active audits. The tracking GitHub issue uses the same chunk labels listed below.

## Filing convention

**Title**: `[review/<chunk-id>] <subsystem>:<function-or-file>: <one-line wrong behavior>`
e.g. `[review/credit] credit_ledger: settle_usage_charge_to_account double-debits on retry`

**Labels** (apply all that fit):
- `review/correctness` (always)
- `area/<chunk-id>` — one of `auth`, `credit`, `entitle`, `webhook`, `aiexec`, `secmw`, `yjs`, `realtime`, `boardstore`, `admin`, `assets`, `konva`
- `severity/high` — data corruption, lost money, cross-tenant leak, auth bypass, multi-user divergence
- `severity/med` — wrong result to one caller, missing audit log, missing rate limit on non-spending endpoint
- `severity/low` — UI inconsistency, dead branch, log-noise, undocumented contract
- `evidence/static` | `evidence/playwright` | `evidence/pytest` (write but don't commit pytest until the fix PR)
- `blocking/<chunk-id>` when downstream chunks depend on a finding being triaged first

**Body template**:
```
## Suspected wrong behavior
<one paragraph: what does the function do today>

## Expected behavior
<what it should do; cite PRD/ARCH slice, existing test, or docstring>

## Trigger / repro
- Path: <abs path>
- Function: `<name>` (line `<n>`)
- Callers: <files>
- Inputs that drive the bug: <values / headers / race ordering / prior state>
- Manual repro: <steps or curl> (if any)
- Playwright trace: <file:test name> (if any)

## Evidence
- [ ] Static read of function + every direct caller
- [ ] Existing contract test (or "none"): `services/api/tests/test_<...>.py::<name>`
- [ ] Playwright spec (or "static only"): `apps/web/e2e/review-<chunk>.spec.ts::<title>`

## Suggested fix surface
<file(s) + rough approach — not a patch>

## Risk if not fixed
<concrete user-facing or financial impact>
```

## Playwright verification protocol

Escalate from static → Playwright only when correctness depends on **runtime behavior unreadable from source**: hook timing, Konva event semantics, multi-tab Yjs convergence, real DOM after a sequence of interactions, browser fetch CORS/CSRF interaction.

- **File layout**: one file per chunk, `apps/web/e2e/review-<chunk-id>.spec.ts`, multiple `test()` per file. Reuses existing `apps/web/playwright.config.ts` (already configured with stub Clerk keys at `sk_test_playwright` / `pk_test_...`).
- **Default profile**: `chromium-desktop`. Skip the other 3 unless the bug is browser-specific.
- **Authenticated flows**: drive `apps/web/src/app/api/auth/dev-bypass/route.ts` from `test.beforeEach`. Read that file first to see what it accepts — do not embed real Clerk credentials.
- **Stable selectors**: prefer `data-testid` (verify they actually exist in `KonvaCanvasStage.tsx`, `KonvaNodeCardShape.tsx`, etc. before composing) and `page.getByRole(...)`. Avoid CSS class selectors.
- **Canvas interactions**: drive `page.mouse.move/down/up` over stage-relative coordinates derived from the stage bounding box — Konva renders to one `<canvas>`, there are no per-shape DOM nodes to click.
- **2-tab convergence tests**: two `context.newPage()` from one `browser`, `test.describe.configure({ mode: 'serial' })`, drive page A, assert page B via existing diagnostic surfaces (check `KonvaCanvasDiagnostics.tsx` for hooks) — wrap convergence assertions in `expect.poll(..., { timeout: 5_000 })`.
- **Downgrade rule**: if a focused spec attempt (~60 lines max) can't reproduce, keep the issue open as `evidence/static` and add a body note "Playwright attempt failed to repro — likely needs server-state preconditions". One failed e2e does not invalidate a bug found in static review.

**Gate for closing/downgrading a static finding** — all three must hold:
1. Every direct caller of the function reads cleanly under the invariant the function expected.
2. An existing pytest exercises the path and passes.
3. PRD/ARCH slice or function comment confirms the current behavior is the contract.
If only (1)+(2) hold, keep open at `severity/low` with `needs-product-decision` — undocumented contracts are themselves a finding.

## Stopping rules per chunk

A chunk is complete only when:
1. Every public function / exported symbol in scope has been read top-to-bottom.
2. Every state mutation (DB write, Yjs `transact`, React setState, in-memory cache write) has a one-line note: invariant / what could violate it / did I file an issue.
3. Every external boundary (HTTP outbound, S3/R2, Postgres, Redis, browser storage, WebSocket send) is checked for error handling, retry idempotency, secret exposure, partial-success cleanup.
4. The corresponding `services/api/tests/test_*.py` files have been read at the level of "what assertions exist" — gaps filed as `severity/low` + `gap/test-coverage`.
5. A "Chunk N closeout" comment is posted on the tracking issue listing every finding issue number (or "0 findings, scope below was fully read").

## Chunks (ordered by blast radius)

Files marked **>300L** already violate the AGENTS.md gate — flag location in the chunk closeout but **don't refactor in this review**.

### 1 — Auth & session resolution (high) — blocks chunks 2, 3, 5, 7, 8, 9, 10, 12

**Scope**: `services/api/tangent_api/auth_sessions.py` (>300L), `auth_session_*.py` (4 files), `auth_provider.py`, `auth_request_metadata.py`, `auth_profile_store.py`, `auth_user_schema.py`, `clerk_admin.py`, `local_admin_bootstrap.py`, `routers/auth.py`; frontend `apps/web/src/features/auth/*` and the four `app/api/auth/*/route.ts` routes.

**Bug patterns**:
- `_load_or_create_postgres_session` upsert race for a fresh Clerk identity (two parallel inserts).
- `_build_ephemeral_session` sha256-prefix collisions when DB unavailable.
- `last_login_at` / `ensure_credit_account` not transactional — half-state on failure.
- `resolve_local_auth_session(requested_workspace_id)` not validating membership before switching context.
- Frontend `routeGuard.ts` open-redirect via `next` param; `useTangentSession.ts` stale-read on tab focus.
- `dev-bypass/route.ts` guard bypassable in prod-shaped env.

**Tests to read first**: `test_auth_contracts.py`, `test_auth_session_workspace_contracts.py`, `test_user_account_deletion.py`, `test_p1_auth_workspace_context_contracts.py`.

### 2 — Credit ledger & money (high) — blocks chunks 3, 4, 5

**Scope**: `credit_ledger.py` (>300L), `credit_ledger_support.py`, `credit_schemas.py`, `billing_balance.py`, `billing_credit_accounts.py`, `ai_credit_pricing.py`, `ai_cost_ledger.py`, `routers/credits.py`.

**Bug patterns**:
- `settle_usage_charge_to_account` double-debit on retry — verify `(provider_event_id, reason)` uniqueness and that `write_credit_ledger_entry_for_account` is the only writer (grep `INSERT INTO tangent_credit_ledger` across repo).
- `build_credit_preflight_for_account` TOCTOU between preflight and spend.
- `load_credit_balance` sign-direction on refund/topup rows.
- `split_credit_balance(total, included_total)` over-allocation when `total > included + topups`.
- Float-money columns — confirm migration uses NUMERIC, not DOUBLE PRECISION.
- `build_credit_ledger_response` returning `balanceCredits=0` whenever `DATABASE_URL` is unset; confirm no prod path hits this.

**Tests to read first**: `test_credit_ledger_contracts.py`, `test_ai_credit_pricing.py`, `test_admin_finance_manual_plan_credit_operations.py`.

### 3 — Entitlement, plan, seat, payer (high) — blocks chunk 5

**Scope**: `workspace_entitlements.py` (>300L), `workspace_entitlement_policy.py`, `workspace_entitlement_members.py`, `workspace_seats.py`, `workspace_dashboard_seats.py`, `workspace_owner_transfer.py`, `workspace_members.py`, `workspace_roles.py`, `workspace_access.py`, `workspace_management.py`, `workspace_lifecycle.py`, `workspace_invitations.py`, `workspace_invitation_support.py`, `plan_catalog*.py`, `team_subscription_*.py`, `collaborate_subscription_lifecycle.py`.

**Bug patterns**:
- `resolve_entitlement` returning wrong `charged_account_id` on solo vs team workspace_kind.
- `_build_ai_charge_summary` plan-key fallback to `"unknown"` leaking to pricing.
- `is_plan_key_allowed_for_workspace_kind` accidentally accepting `team_growth` on `solo_workspace`.
- Seat-assignment race in `assert_team_invitation_capacity` (two concurrent invites past cap).
- `workspace_owner_transfer` not migrating credit account payer reference.
- `included_credits_for_plan` vs `registration_credits_for_plan` duplicating signup grants.
- Subscription end → seats freed → entitlement cleared order.

**Tests to read first**: `test_workspace_entitlement_contracts.py`, `test_workspace_member_management_contracts.py`, `test_workspace_invitation_contracts.py`, `test_workspace_invitation_policy_contracts.py`, `test_workspace_invitation_targeting_contracts.py`, `test_workspace_management_contracts.py`, `test_workspace_role_normalization.py`, `test_team_subscription_billing_contracts.py`, `test_collaborate_subscription_billing_contracts.py`, `test_group_workspace_lifecycle_contracts.py`.

### 4 — Billing checkout & webhooks (high)

**Scope**: `billing_webhooks.py`, `billing_payments.py`, `billing_payment_*.py` (6 files), `billing_checkout_sessions.py`, `billing_stripe_checkout.py`, `routers/billing.py`; frontend `features/billing/billingCheckoutClient.ts`, `billingCheckoutFlow.ts`, `BillingCheckoutReturnView.tsx`, `billingWorkspaceMutationClient.ts`.

**Bug patterns**:
- Uniqueness of `(provider, provider_event_id)` — single-column index aliases across providers.
- `SUPPORTED_COMPLETION_EVENTS` includes `"manual_test.payment_succeeded"` — confirm non-prod-gated.
- HMAC verified against raw body, not a buffer already-consumed by middleware (`request.body()` is once-only).
- `_mark_webhook_event_processed` after `complete_billing_payment_from_provider` — recorded-but-unprocessed state on raise.
- Checkout `success_url` open-redirect surface.
- Frontend trusting client clock for "payment complete" instead of backend truth.

**Tests to read first**: `test_billing_webhook_contracts.py`, `test_billing_provider_checkout_contracts.py`, `test_collaborate_subscription_billing_contracts.py`.

### 5 — AI run execution: charge → provider → settle (high)

**Scope**: `ai_run_execution.py`, `ai_run_persistence*.py` (3 files), `ai_provider_adapters.py`, `ai_provider_chat_streaming.py`, `ai_provider_openai_compatible.py` (**>300L, 536L**), `ai_provider_assets.py` (>300L), `ai_provider_google.py`, `ai_provider_jiekou*.py`, `ai_provider_geekai_image_requests.py`, `ai_provider_image_mime.py`, `ai_provider_runtime_config.py`, `ai_provider_stub_adapter.py`, `ai_provider_types.py`, `ai_route_catalog.py`, `ai_contracts*.py`, `ai_control_plane*.py`, `ai_schemas.py`, `routers/ai.py`; frontend `features/ai/aiRunLifecycle.ts`, `aiClient.ts`, `chatClient.ts`, `aiImageModelRuntime.ts`, `aiRunErrors.ts`, the `app/api/ai/runs/*` and `app/api/ai/chat/completions/route.ts` routes plus `app/api/ai/_lib/`.

**Bug patterns**:
- `finalize_mock_run` 402-on-settle path leaving uploaded R2 assets behind ("free asset" bug).
- Local Next.js `/api/ai/runs` bridge bypassing `services/api` credit ledger — confirm `assertLocalAiBridgeAvailable()` cannot return true in prod.
- Streaming chat partial-stream interruption: settle full credits vs persist truncated text (cross-ref `_limit_text_output` at 12_000 chars).
- Provider response builders re-validating or trusting frontend caps (8 input assets, prompt 8000, params 16KB).
- `ai_provider_openai_compatible.py` silent fail-open on 5xx.
- `ai_route_catalog.py` unknown-model returning stub success instead of 4xx.
- Frontend `aiRunLifecycle.ts` retry without idempotency key (cross-ref chunk 6).

**Playwright trigger**: cancel mid-stream in a chat node — confirm assistant slot clears and no further settle. Selector requires reading `KonvaNodeCardShape.tsx` for chat-node `data-testid`.

**Tests to read first**: `test_ai_contracts.py`, `test_ai_provider_adapter_policy.py`, `test_ai_provider_openai_compatible.py`, `test_ai_provider_geekai.py`, `test_ai_provider_jiekou.py`.

### 6 — Idempotency, CSRF, rate limit, security middleware (high)

**Scope**: `security_idempotency.py`, `security_idempotency_store.py`, `security_csrf.py`, `security_origin.py`, `security_rate_limit.py`, `security_headers.py`, `security_events.py`, `security_business_limits.py`, `security_share_password.py`, `security_redis.py`, `security_persistence*.py`, `request_context.py` (>300L), `safe_text.py`; frontend `app/api/_lib/csrfGuard.ts`, `requestBodyLimits.ts`, `apiRequestContext.ts`, `features/security/safeText.ts`, `safeUrl.ts`.

**Bug patterns**:
- `run_idempotent` cache key includes `workspace_id` — retries that switch workspace don't dedupe. Intentional? File as question.
- `_fingerprint` JSON-key ordering: `{"a":1,"b":2}` vs `{"b":2,"a":1}` collision on retry.
- `_IDEMPOTENCY_CACHE` (process-local) vs persisted store — stale-read window.
- `check_csrf_origin` skipping CSRF on any `Authorization: Bearer ...` — confirm Bearer is independently verified (not just trusted).
- CSRF-exempt path list including `/api/v1/billing/webhooks/` — confirm no other money-mutating paths share that prefix.
- `check_http_rate_limit` fail-open vs fail-closed when Redis is down.
- `security_share_password` hash cost, constant-time compare, length cap.

**Playwright trigger**: `request`-fixture spec posting a mutation with `Origin: https://evil.example` → expect 403. Same idempotency key with different fingerprints → expect conflict.

**Tests to read first**: `test_security_boundary.py`, `test_p1_public_anti_crawl_contracts.py`, `test_persistence_contracts.py`.

### 7 — Yjs structure & frontend collaboration (high) — blocks chunk 8

**Scope**: `apps/web/src/features/collaboration/*` (17 files) — notably `konvaYjsStructure.ts` (**>300L**), `konvaYjsEntityReconcile.ts`, `konvaYjsPageMerge.ts`, `konvaYjsSnapshot.ts`, `webSocketBoardRealtimeSharedRoom.ts`, `webSocketBoardRealtimeDocumentBridge.ts`, `webSocketBoardRealtimeDocumentQueue.ts`, `webSocketBoardRealtimeAwarenessStore.ts`, `localBoardAwareness.ts`, `realtimeUpdatePayload.ts`, `yjsJsonTree.ts`; konva-canvas glue `konvaLocalYjsSnapshotFlow.ts`, `konvaLocalYjsSyncContract.ts`, `konvaLocalYjsSyncHelpers.ts` and the `useKonvaLocalYjs*` / `useBoardCollaboration*` hooks; frontend pair `features/boards/boardCollaboration*.ts`.

**Bug patterns**:
- `readKonvaYjsStructuredSnapshot` returning null on schema mismatch — grep callers that don't null-check.
- `createKonvaYjsUndoManager` `trackedOrigins` accidentally including remote — local undo undoes remote edits.
- `.observe`/`.on` without matching `.unobserve`/`.off` in cleanup — grep across collaboration dir.
- Awareness cross-room leak: confirm awareness state is keyed by `room_key` and cleared on room-switch.
- `konvaYjsPageMerge` concurrent page reorder vs delete — tombstone vs phantom vs duplicate.
- `webSocketBoardRealtimeDocumentQueue` WebSocket drop mid-flush — retry/drop/duplicate.
- Snapshot signature including `serializedAt`/`publishedAt` clock-skew collisions.
- `data:`, `blob:`, `base64` strings being written into the Yjs sync path (AGENTS.md hard rule).

**Playwright trigger**: 2-tab convergence — drag in A, assert B updates within 5s. Room-switch awareness drop. XSS payload in chat node text via Yjs → no script executes.

**Tests to read first**: `test_board_collaboration_contracts.py`, `test_board_realtime_persistence.py`, `test_board_realtime_websocket.py`.

### 8 — Backend realtime hub & persistence (high)

**Scope**: `services/api/tangent_api/realtime/board_realtime_hub.py` (>300L), `board_realtime_hub_registry.py`, `board_realtime_room_support.py`, `board_realtime_persistence.py`, `board_realtime_limits.py`, `board_realtime_abuse.py`, `board_realtime_access.py`, `routers/boards_realtime.py`, `routers/boards_collaboration.py`, `storage/board_realtime_storage_adapter.py`, `storage/postgres_board_realtime_store.py`, `storage/local_board_realtime_store.py`, `storage/board_collaboration_storage_adapter.py`, `storage/postgres_board_collaboration_store.py`, `storage/local_board_collaboration_store.py`, `storage/board_collaboration_store_support.py`.

**Bug patterns**:
- `BoardRealtimeRoom.connect` `send_lock` not released on all failure paths in send.
- `initial_updates` seed race when two connections seed concurrently — silent edit discard.
- Compaction request cooldown enforced on server, not just client-suggested.
- `BoardRealtimePersistenceCoordinator` `WeakKeyDictionary[event_loop]` orphaning pending writes across loop reload.
- `realtime_room_connection_limit` per-room vs per-server; leaked room references on last-disconnect.
- `_broadcast_json` leaking private awareness payloads (draft text) to viewer-only connections.
- `BoardRealtimeConnection.can_edit` set from server-side membership at connect, not re-validated on each frame — revoked members keep editing until reconnect.

**Playwright trigger**: cross-board frame isolation (A in board1, B in board2 — B never sees A's frames).

**Tests to read first**: `test_board_realtime_websocket.py`, `test_board_realtime_abuse.py`, `test_board_realtime_persistence.py`, `test_board_collaboration_contracts.py`.

### 9 — Board storage, board guard, document mutations (medium)

**Scope**: `board_konva_guard.py`, `board_guard.py`, `board_access.py`, `board_metadata.py`, `board_schemas.py`, `board_asset_references.py`, `storage/board_storage_adapter.py` (**>300L, 466L**), `storage/postgres_board_store.py`, `storage/postgres_board_store_mutations.py` (>300L), `postgres_board_store_boards.py`, `postgres_board_store_shares*.py`, `postgres_board_store_members.py`, `postgres_board_store_support.py`, `postgres_board_codec.py`, `postgres_board_deletion.py`, `postgres_board_snapshot_store.py`, `local_board_store*.py`, `local_board_snapshot_store.py`, `routers/boards.py`; frontend `features/boards/boardKonvaDocumentGuard.ts`, `boardDocumentGuard.ts`, `konvaBoardDocument.ts`, `konvaBoardPageContract.ts`, `localBoard*Client.ts`, plus the 14 `app/api/boards/local-*` routes.

**Bug patterns**:
- `_looks_like_konva_document` returning true for any of `renderer="konva"` / `version=2` / `canvasDocument` key — mismatched-renderer doc enters audit.
- `_validate_pages` duplicate-id check against Unicode-normalization-equivalent ids.
- `assert_no_postgres_foreign_asset_refs` not actually catching shared-from-other-workspace assets (AGENTS.md explicit allowlist rule).
- `save_board` audit returning `ok=False` before asset-ref check — partial validation.
- `sanitize_board_id` silently replacing caller id when input non-empty but sanitized to empty.
- FE `boardKonvaDocumentGuard.ts` vs BE `board_konva_guard.py` allowlist drift.
- Share-link id entropy.

**Playwright trigger**: persist `<img onerror>` in a sticky note, reload, confirm no script. Malformed share-link id → 404 not 500.

**Tests to read first**: `test_board_persistence_contracts.py`, `test_board_bola_contracts.py`, `test_board_permission_contracts.py`, `test_board_share_security_contracts.py`, `test_persistence_contracts.py`, `test_image_dimensions.py`.

### 10 — Admin reads/writes & audit (medium)

**Scope**: `admin_access*.py` (4 files), `admin_ai_*.py`, `admin_finance*.py` (15+ files, includes `admin_finance_manual_plan_operations.py` >300L), `admin_operator*.py`, `admin_directory*.py`, `admin_bootstrap_schemas.py`, `routers/admin*.py` (12 routers); frontend `features/admin/*` (79 files) + the `app/api/admin-proxy/[...path]/route.ts` proxy and its `_lib`.

**Bug patterns**:
- `TANGENT_ADMIN_ROLE_CACHE_SECONDS` hiding demotions for cache TTL — confirm invalidation on role-write paths.
- Manual finance writes bypassing `write_credit_ledger_entry_for_account` (grep `LEDGER_REASONS` callers).
- `admin-proxy/[...path]/route.ts` path-traversal (`..`); auth headers leaking into outbound URLs.
- Admin user-listing pagination revealing soft-deleted users.
- AI control-plane writes not atomic (model row without pricing row).
- Frontend admin clients treating non-2xx as success.

**Playwright trigger**: `/api/admin-proxy/...` as non-admin → 403.

**Tests to read first**: `test_admin_contracts.py`, `test_admin_finance_contracts.py`, `test_admin_finance_manual_contracts.py`, `test_admin_finance_manual_plan_credit_operations.py`, `test_admin_finance_manual_plan_lifecycle.py`, `test_admin_operator_contracts.py`, `test_admin_operator_subscription_writes.py`, `test_admin_operator_billing_history.py`, `test_admin_operator_rows.py`, `test_admin_directory_contracts.py`, `test_admin_bootstrap_contracts.py`, `test_p1_admin_access_contracts.py`, `test_p1_admin_route_matrix_contracts.py`.

### 11 — Assets & image ops (medium)

**Scope**: `routers/assets.py`, `routers/image_ops.py`, `image_ops.py`, `image_dimensions.py`, `remote_image_import.py`, `storage/asset_storage_adapter.py`, `asset_metadata_adapter.py`, `asset_store_common.py`, `local_asset_store.py`, `s3_asset_store.py`, `s3_client.py`, `postgres_asset_metadata_store.py`; frontend `features/assets/*` and the `app/api/assets/*` + `app/api/image-ops/*` routes.

**Bug patterns**:
- `from-data-url/route.ts` truncated-base64 → 500 instead of descriptive 4xx.
- `from-url/route.ts` SSRF — confirm allowlist denies `localhost`, `169.254.169.254`, RFC1918, link-local; bounded redirect follow.
- `assets/[assetId]` BOLA — cross-workspace access.
- `files/[assetId]/[fileName]` `fileName` used in filesystem-relative path.
- `s3_asset_store` content-type sanitized server-side, not trusted from client.
- `image_dimensions` image-bomb cap before allocation (e.g., 8000x8000).
- Provider error responses logged at info level leaking key-bearing URLs.
- FE `imageDataUrl.ts` / `assetUploadClient.ts` console-leaking data URLs.

**Playwright trigger**: upload 1px PNG (sanity); `from-url` with `http://169.254.169.254/...` → denied without making the outbound request.

**Tests to read first**: `test_asset_security_contracts.py`, `test_image_dimensions.py`.

### 12 — Konva canvas interactions (medium)

**Scope** (highest-correctness-risk subset of the 173-file `konva-canvas` dir):
- Interaction & history: `useKonvaCanvasInteractions.ts` (>300L), `useKonvaShapeDragHandlers.ts`, `useKonvaTransformPreviewState.ts`, `useKonvaTransformStartHandlers.ts`, `useKonvaCanvasHistory.ts`, `konvaCanvasRunningNodes.ts`, `useKonvaCanvasCommandActions.ts`.
- Command surface: `konvaClipboardCommands.ts`, `konvaArrangeCommands.ts`, `konvaGroupCommands.ts`, `konvaShapeCommands.ts`.
- Node creation/runtime: `useKonvaNodeCreationMenu.ts` (>300L), `KonvaNodeCardShape.tsx` (>300L), `konvaChatNodeStreaming.ts` (>300L), `konvaChatNodeActions.ts`.
- Sync glue: `useKonvaCanvasBoardSync.ts`, `useKonvaCanvasDocumentChangeBridge.ts`, `konvaBoardPage*.ts` (4 files), `useKonvaCanvasSpikeRuntime.ts`.
- Runtime: `features/node-runtime/registry.ts` (>300L), `runtimeGraph.ts` (>300L), `runtimeGraphRunAdapter.ts`, `runtimeGraphResolution.ts`, `runtimeGraphImageGeneration.ts`, `runtimeGraphAssets.ts`, `runtimeGraphMockAssets.ts`.

**Bug patterns**:
- Drag-end commit happening in `useEffect` keyed on `selectedIds` — drop on unrelated re-render between drag-end and commit.
- `useKonvaCanvasHistory` `maxHistoryBytes = 24MB` per-entry vs per-stack ambiguity — large boards lose undo silently.
- History checkpoint while node mid-run → undo restores "executing" runtime state.
- Coordinate transform off-by-one on zoom in `useKonvaNodeCreationMenu`.
- `konvaChatNodeStreaming.prepareKonvaChatRequest` `maxChatMessages=12` trimming dropping system message — cost estimate computed on a different list than sent.
- `useKonvaCanvasBoardSync` debounce flush on unmount racing navigation.
- Wheel-handler NaN propagation on zero-delta.
- `node-runtime/registry.ts` unknown id returning null adapter → downstream crash.
- `runtimeGraph.ts` missing cycle detection on A→B→A.
- Line/arrow endpoint math near 0/180/360 degrees.
- `konvaClipboardCommands` paste across boards smuggling cross-tenant asset refs.

**Playwright trigger** (this chunk is where Playwright pays off most):
- Drag → undo → redo, assert position.
- Chat node abort mid-stream → assistant slot cleared.
- Drag past viewport edge, pan extends, shape preserved.
- Group/ungroup undo, assert order preserved.
- Cross-board paste with foreign asset ref → backend rejects, frontend surfaces.

**Tests to read first**: no direct pytest. Read `apps/web/e2e/security-smoke.spec.ts` for selector/auth conventions; read inline constants in `useKonvaCanvasHistory.ts` for the implicit contract.

## Verification

The review *itself* is verified end-to-end by:

1. **Tracking issue exists** in the GitHub Project with a checklist of all 12 chunks and their closeout comment links.
2. **Each chunk has a closeout comment** that either lists filed issue numbers or states "0 findings, scope fully read".
3. **Per-chunk filed issues** all carry `review/correctness` + `area/<chunk-id>` + a severity label, and every `severity/high` issue has at least one of `evidence/pytest` or `evidence/playwright` attached (write a focused failing test before closing — actual commit happens in the fix PR per AGENTS.md).
4. **Playwright specs** that confirmed findings land at `apps/web/e2e/review-<chunk-id>.spec.ts`. Each file is referenced from at least one filed issue. Specs run via `npm -C apps/web run test:e2e:ci` on the affected branch before merge of the *fix* PR (not the review).
5. **No code changes** land from the review itself — only issues. Fixes flow through the standard `feat/<n>-<slug>` / `fix/<n>-<slug>` branch + non-author review per AGENTS.md.
6. **Plan registered**: `dev-plans/p0-codebase-correctness-review-2026-05-25.md` exists and links from `dev-plans/README.md`'s active table, moved to `Archive/` only when all 12 chunk closeouts are posted.
