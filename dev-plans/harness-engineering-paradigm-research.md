# Tanergy Harness Engineering — Paradigm Research Report

**Date**: 2026-05-28
**Author**: Hansen (driver) × Claude (synthesis) × Codex (3-round critique)
**Status**: Research input. Doctrine artifact (`AI-HARNESS.md`) to follow.
**Scope**: Establish whether Tanergy should formalize "Harness Engineering" as foundational principle for all future AI feature work, and if so, define the contract.

---

## Executive Summary

1. **S2 AiRun is already a harness in everything but name.** The 9 charter invariants below are 7 already-enforced + 2 net-new. Doctrine work is more about naming and code-review enforcement than about new infrastructure.
2. **"Harness Engineering" is not a new paradigm** — it's BDI architectures (1980s) rediscovered as agentic workflows (LangGraph, OpenAI Swarm, AutoGen, Anthropic "Building Effective Agents"). NotebookLM's YouTube sources are downstream packaging. What's new for Tanergy is the *named contract*.
3. **Name it `AI-HARNESS.md` as peer to existing `HARNESS.md`.** Existing `HARNESS.md` = dev process discipline for engineers/agents building Tanergy. New `AI-HARNESS.md` = execution contract for AI features running inside Tanergy. Both are scaffolding, different actors.
4. **Phased rollout: v0 doc-only (1-2 days) → v1 schema (5-8 days) → v2 validator infra (10-15 days).** v0 not blocked by P0 work; v1 should sequence after Group cleanup; v2 blocked by staged image smoke.
5. **PSD-layer-split is a stress test, not a launch feature.** Admin-hidden prototype after Charter v0 lands. Content/demo value is recognized as valid prioritization input but does not lower the harness bar.
6. **Three independent stale-doc bugs surfaced by Codex Round 1** (see Appendix A). These need follow-up separate from this research.

---

## 1. Why This Research Was Commissioned

Hansen's trigger: a WeChat 公众号 article demonstrated GPT Image 2 + reasoning + code execution producing layered PSDs via `psd-tools`. Question: should Tanergy add automatic PSD-layer-split as a canvas feature?

Then two YouTube videos (`youtu.be/8gOOlBcdrIo`, `youtu.be/ozVTJm3n2U4`) on Claude Code's "Workflow" concept reframed the question: Hansen's stated position was "脚本文件比 skill 这样的纯 prompt 注入更加稳定可靠". He asked whether Tanergy should adopt "Workflow / Harness Engineering" as foundational engineering principle for ALL future development, not just PSD.

This report answers that meta-question. PSD is one downstream application.

---

## 2. Naming Decision

Existing `HARNESS.md` is taken — but for a different concept:

| Existing `HARNESS.md` + `knowledge/wiki/agent_harness_and_skills.md` | New `AI-HARNESS.md` (proposed) |
|---|---|
| Dev process discipline for engineers + Claude/Codex working ON Tanergy | Execution contract for AI features running INSIDE Tanergy product |
| Read order / DoR / DoD / Skill map / quality gates / hard boundaries | Run-type registry / budgets / validators / fallback policy / audit |
| Who/how to touch this repo | How AI calls are constrained at runtime |

**Decision**: new file at repo root `AI-HARNESS.md`, peer to `HARNESS.md`. Add disambiguation crossref to `HARNESS.md` header. Update `AGENTS.md:32` read order to include `AI-HARNESS.md` for AI-touching slices.

Rejected alternatives:
- **Extend `ARCH/ARCH_slice_S2_ai_runtime.md`**: too small a home for project-wide doctrine; future S3/S4 AI features would have to import S2-scoped rules awkwardly.
- **Rename to `RUN-CHARTER.md` / `EXECUTION-CONTRACT.md`**: loses the industry-shared "harness" vocabulary (Karpathy, LangGraph, Anthropic). Costs Hansen's personal brand alignment on the term.

---

## 3. First Principles (with Sources)

Harness Engineering = put nondeterministic LLM reasoning inside a deterministic operating shell. The principle is older than LLMs:

- **BDI architectures** (Rao & Georgeff, 1991) — Beliefs/Desires/Intentions as code-defined contracts. Foundational agent frame.
- **LangGraph** — Documents prompt chaining, routing, parallelization, orchestrator-worker, agents as workflow primitives. LangGraph Supervisor formalizes managed workers + post-model guardrail hooks.
- **OpenAI Swarm** — Lightweight controllable testable handoffs, run loop with tools + handoffs + max-turn limits.
- **AutoGen** — AgentChat teams, selector group chat, Swarm pattern, GraphFlow, logging, observability.
- **Anthropic "Building Effective Agents"** (2024) — Explicitly favors workflows over autonomous agents for most production tasks: prompt chaining, routing, parallelization, orchestrator-workers with gates.
- **Andrew Ng's agentic workflows** (2024) — Reflection, tool use, planning, multi-agent collaboration as composition patterns.
- **NotebookLM-extracted YouTube videos** — Corroborate the packaging. Do not add first principles. Treat as downstream summaries.

**First principles distilled:**
- Deterministic state machine around stochastic LLM calls
- Typed contracts (not prompt-as-policy)
- Observability by default
- Budget locks before work starts
- Adversarial review / validator hooks
- Bounded retries
- Self-healing only when failure mode is enumerated
- Code-as-contract (not prompt-as-contract)

**Where it succeeds**: tasks decompose cleanly; intermediate outputs are machine-checkable; cost/latency predictability matters more than demo fluency.

**Where it fails**: highly creative taste calls; ambiguous user intent; long-tail UX where validator says pass but human output is bad.

**Competing paradigms**: end-to-end autonomous agents; MoE/model routing; pure RAG+prompt. Harness wins when product liability and cost predictability matter.

---

## 4. Current Tanergy Already Has a Harness

S2 AiRun embodies most harness properties. Code evidence:

- **Control flow contract**: `ARCH/ARCH_slice_S2_ai_runtime.md:20-35` defines Node UI → AiRun → server validation → payer → pricing → route → provider → Assets → ledgers
- **Registry tables**: `model_registry`, `model_parameter_tiers`, `model_provider_routes`, `model_pricing_rules` at `ARCH/ARCH_slice_S2_ai_runtime.md:45-83`
- **Typed input**: `AiRunRequest` at `services/api/tangent_api/ai_schemas.py:39-103` — bounds run_type, prompt length, input assets count (8)
- **Typed output**: `AiRunRecord` at `services/api/tangent_api/ai_schemas.py:106-134`
- **Lifecycle**: `create_ai_run` at `services/api/tangent_api/ai_contracts.py:112-113`; `_execute_scheduled_run` at `services/api/tangent_api/ai_contracts.py:175-205`
- **Audit trail**: `tangent_ai_runs`, `tangent_ai_api_calls`, `tangent_api_cost_ledger` all wired
- **Board safety**: `audit_board_document` at `services/api/tangent_api/board_guard.py:26-55`, `_audit_string` at `:100-140`
- **Image bounds**: `MAX_IMAGE_OP_INPUT_BYTES` 30 MB and `MAX_IMAGE_OP_PIXELS` 24 MP at `services/api/tangent_api/image_ops.py:9-10`
- **Cost preflight + hold**: `ai_control_plane.py:79-115` + `ai_run_execution.py:70-89` + `credit_ledger.py:170-197`
- **Bundled-change rule**: `AGENTS.md:36-38` forces Node Registry + Model Registry + AiRun + routes + tests + Board guard to ship together

**What's missing** (the 2 net-new things):
1. **Named harness key + validator hook** — no explicit field forces declaration of "this AI feature's harness contract." Code review can't reliably say "validator missing — block."
2. **Adversarial validator infra + machine-readable fallback** — today fallback is implicit (retry-or-fail). No explicit "feature off" / "return original asset" / "manual retry only" state. No validator chain for multi-stage features.

---

## 5. The Charter — 9 Invariants

Every new AI feature MUST satisfy:

| # | Invariant | Status | Evidence / Net-new |
|---|---|---|---|
| 1 | Registered run type / capability key | Already enforced (`AiRunRequest.run_type` `ai_schemas.py:95-103`; capability via `tangent_model_registry`) | **NEW**: feature-key beyond generic run_type for specialized harnesses (e.g. PSD) |
| 2 | Declared input budget (bytes / tokens / pixels / asset count) | Mostly enforced (`ai_schemas.py:67-81`, `image_ops.py:9-10`) | **NEW**: per-feature aggregate byte budgets, token budgets as declared fields |
| 3 | Declared output budget (bytes / asset count / board impact) | Mostly enforced (`ai_run_execution.py:13`, `board_guard.py:9-10`) | **NEW**: output asset-count + board-impact declared per harness |
| 4 | Declared latency budget + timeout | Enforced (`tangent_model_provider_routes.timeout_ms`, `ai_provider_execution.py:113-133`, 240s for image routes per `ARCH/ARCH_slice_S2_ai_runtime.md:165`) | None |
| 5 | Machine-checkable validator | Partial (Pydantic, board audit, image assertions) | **NEW**: per-harness `validator_key` registry not present |
| 6 | Machine-readable fallback path | Partial (route retry_policy, attempts retryable flag) | **NEW**: feature-level fallback mode (`disable_feature`, `return_original_asset`, `manual_retry_only`) |
| 7 | Audit log writes | Enforced (`tangent_ai_runs`, `tangent_ai_api_calls`, `tangent_api_cost_ledger`) | None |
| 8 | Board-safe output persistence | Enforced (`AGENTS.md:36-38`, `board_guard.py`) | None |
| 9 | Cost preflight + hold | Mostly enforced (preflight at `ai_control_plane.py:79-115`) | **NEW**: explicit credit hold object (ARCH calls it optional today) |

**Headline**: 7 of 9 already enforced. 2 net-new (validator declaration + fallback policy + harness key as anchor for both). Plus output/input budget declaration fields. This is a *small* code surface, not a refactor.

---

## 6. Orchestration Patterns

| Pattern | Status | When | Constraints |
|---|---|---|---|
| Single-call run | Supported | One prompt+assets → one terminal output | Existing default path |
| Pipeline (multi-step sequential) | Supported with **NEW** harness metadata | Step B depends on validated Step A | One parent harness; child run lineage via `parent_run_id`; each step has own budgets/validator |
| Parallel fan-out | Supported only after explicit total cost cap | Independent variants or route probes | Preflight total max cost; no hidden N-way calls |
| Adversarial validator | Supported for high-risk transforms | Output can look plausible while violating structure (PSD layer JSON, etc.) | Validator is itself an AiRun child (see §7) |
| Self-healing retry | Limited | Before provider work starts; deterministic repair | Must honor `work_started` flag (`ai_provider_execution.py:178-181`); no duplicate paid calls |
| **Autonomous open-loop agents** | **OUT OF SCOPE** | N/A | No unbounded tool loops, no provider calls outside AiRun, no autonomous board mutation (per `AGENTS.md:7`) |

---

## 7. Validator-as-LLM-Call — Mini-Design

A high-fidelity adversarial validator is itself an LLM call (e.g. vision model comparing assembled PSD layers vs original). Resolution:

**Validator becomes a child AiRun with its own AiRunRecord.** Reasons:
- Folding into parent attempts would double-count `cost_credits` per `ai_cost_ledger.py:51-58` settlement logic
- Provider cost vs customer credit must be separable; child-run pattern uses existing infrastructure cleanly

**New run_type**: `validator`. The DB column `tangent_ai_runs.run_type` is plain `TEXT NOT NULL` without check constraint (`services/api/migrations/versions/20260501_0001_p0_core_schema.py:161-181`), so v1 can add `validator` to the API enum without DB constraint fight.

**Parent–child lineage**: child carries `parent_run_id`. Parent stays non-terminal until validator child passes.

**Cost accounting**:
- Validator child: `cost_credits=0`, `credits_charged=0`, but provider cost row recorded with new `settlement_kind='validator_cost'` (extends existing settlement kinds at `services/api/tangent_api/ai_cost_ledger.py:66-71`)
- Parent: customer credit settlement moves to *after harness acceptance*, not after raw provider success. **This is a code change to `services/api/tangent_api/ai_run_execution.py:50-89` and is non-trivial.**

**Retry/exhaust semantics**:
- Validator fail → triggers retry of upstream step → parent hold/preflight stays open
- All retries exhaust → parent fails. Validator + provider costs remain internal cost rows. Customer not charged.

---

## 8. Decision Rules — "How Much Harness?"

**Single-call is enough when:**
- Input is bounded by `AiRunRequest` fields as-is
- Output is Asset refs or short text only
- Failure can be expressed as terminal failed run
- Existing capability/run-type model is accurate

Most current text + image gen/edit fits here.

**Multi-stage with validator is mandatory when:**
- Feature creates structured intermediate data
- Mutates multiple board nodes
- Produces more than one durable artifact class
- Can be "visually impressive but semantically wrong"

PSD-layer-split is here.

**Opt-out allowed when:**
- Admin-only, hidden, non-provider-backed, no user-visible board state mutation
- Even then: board guard compliance + `tangent_ai_runs` audit still required if it touches assets or billing

---

## 9. Phased Rollout

| Phase | Lands | Enforcement | Effort | Doc Output | Blocking Dependencies |
|---|---|---|---:|---|---|
| **v0 doc-only** | Charter v0.2, harness rollout plan, ARCH sketch for `harness.py`, validator child-run model, admin-hidden graduation gates | Review-only checklist; no runtime enforcement | 1-2 days | `AI-HARNESS.md` + dev-plan | Not blocked by P0; must note image graduation blocked by staged Jiekou smoke (`dev-plans/p0-project-wide-acceptance-audit-2026-05-18.md:216-223`); must align with teams-only direction |
| **v1 schema** | Add nullable `harness_key`, `validator_key`, `input_budget`, `output_budget`, `fallback_policy`, `parent_run_id`; create `tangent_ai_harness_registry`; extend persistence/admin reads | Require known harness keys for NEW admin-hidden harnesses; existing public flows grandfathered | 5-8 days | ARCH schema slice + migration dev-plan | Should sequence AFTER Group cleanup — that plan owns forward-only migration touching `tangent_ai_runs.workspace_kind` (`dev-plans/remove-group-feature-and-consolidate-to-teams-only.md:248-252, 322-352`) |
| **v2 validator infra** | `services/api/tangent_api/harness.py`, validator child AiRuns, retry/fallback orchestration, aggregate views, admin graduation/rollback UI, validator smoke | Enforce "public only after validator pass"; block public exposure on failed gates | 10-15 days | Validator-infra dev-plan + ARCH orchestration sequence | Blocked by staged image smoke for image validators; Group cleanup verification gates before prod hardening (`dev-plans/remove-group-feature-and-consolidate-to-teams-only.md:543-589`) |

**Key sequencing insight**: v0 can land NOW without waiting on P0 spine closure. v0 is pure doctrine — it pays the naming + review-language cost without forcing a single schema change. Hansen gets enforceable code review immediately.

---

## 10. Graduation Criteria (Admin-Hidden → Public)

Per `harness_key`, all must pass to promote:

- ≥100 successful parent runs OR 7 days with ≥50 runs
- Validator pass rate ≥98%
- Fallback/retry rate ≤5%
- p95 latency within published model budget OR ≤180s for image flows
- Zero blocking Board Guard violations for generated board writes
- Unresolved `error_code` rate ≤2%

**Data already on `tangent_ai_runs`**: status, run type, model/provider, assets, params, cost credits, latency, error fields, timestamps (`services/api/migrations/versions/20260501_0001_p0_core_schema.py:161-180`); workspace/charge/provider-cost (`20260506_0007_*:91-99`); pricing/route/tier/preflight (`20260506_0009_*:40-45`); text output (`20260513_0019_*:27-29`). Attempt-level facts on `tangent_ai_api_calls` (`20260502_0005_*:167-185`).

**Gaps**: validator pass rate, parent-child rollups, fallback rate, p95 latency by harness, Board Guard blocks (not currently a `tangent_ai_runs` metric).

**Approval**: AI runtime owner + product owner. Record promotion in `tangent_ai_control_plane_versions` with `resource_type='harness'`, `resource_id=harness_key`, gate snapshot, actor, `published_at` (uses existing schema at `services/api/migrations/versions/20260506_0011_*:27-40`).

**Rollback**: mark harness admin-hidden, disable/deprioritize routes via existing `enabled` filter (`ai_control_plane.py:43-52, 229-232`).

---

## 11. Grandfathering Existing AI Features

- **Historical `tangent_ai_runs` rows**: `harness_key=NULL`. Do not backfill.
- **New rows post-v1**: NULL allowed for a fixed **30-day grandfather window only**. Not indefinite.
- **Existing `tangent_model_registry` rows**: no harness metadata needed there. Registry owns model display/capability/params/cost/enabled/default fields (`services/api/migrations/versions/20260506_0008_*:45-57`); orchestration contracts live in the new `tangent_ai_harness_registry`.
- **Migration approach**: additive only in v1 — nullable columns + new table first; code that writes them deploys later. Backward-compatible until code writes.
- **Known-issue exemption**: features that won't pass charter today (e.g. image gen pre-Jiekou-smoke) stay admin-hidden, cannot graduate, must record reason + remediation deadline ≤1 product cycle in the registry row.

---

## 12. Velocity Safeguards

The charter must not become ceremony for simple work.

- **Trivial validator escape hatch**: allowed when validator is still named and machine-checkable (e.g. "outputs are existing Asset ids only, count ≤ N, no board write")
- **Admin-only flag**: hidden = no public node, no default route, no marketing dependency, no irreversible board mutation. Allowed for all unproven features.
- **Migration laziness**: existing `text` / `image_generation` / `image_edit` / `image_analysis` get harness keys at most via additive metadata; no row rewrites; disabled flows stay disabled (`object_cutout_not_ready()` keeps returning 501 until its harness exists, per `image_ops.py:35-39`)

---

## 13. Content / Demo Value as Prioritization Input

**Recognized as first-class.** Hansen is simultaneously building (a) Tanergy product and (b) personal AEC AI brand on 小红书 / LinkedIn. "Wow-factor for AEC content" is a real cost/benefit input.

**Guardrail**: demo value may decide which charter-compliant feature ships first. It may NOT convert an unbounded or under-specified idea into production scope. Charter bar does not drop because output looks good in a video. A feature motivated by content value still must have server-side provider calls, bounded cost, board-safe persistence, admin-hidden rollout, validator, and audit before leaving internal scope.

---

## 14. PSD-Layer-Split — Verdict as First Test

**Does NOT clear the public bar as a single-call image feature today.**

**Can clear an admin-hidden research bar IF structured as sequential harness:**
- Bounded input asset (single image, byte cap)
- Deterministic PSD/layer schema validator (mask coverage, transparent holes, edge halos, layer overlap, output dimensions, payload size — must be machine-checkable, fail to "user-editable layer draft" not silently bad PSD)
- Declared output asset count + board impact
- Explicit fallback to original flattened image
- No raw provider payload in board docs
- Cost preflight + hold
- Audit rows for every step
- New run_type registration (NOT a hidden code branch in `image_ops.py`)

**Hard stress points on existing harness:**
- 240s image route boundary (`ARCH/ARCH_slice_S2_ai_runtime.md:165`)
- 30 MB / 24 MP image input (`image_ops.py:9-10`)
- Multi-AiRun chains vs `AiRunRequest.input_asset_ids` cap 8 (`ai_schemas.py:41, 67-68`)
- Board 2 MB cap (`board_guard.py:9-10`)
- `object_cutout_not_ready()` is 501 today (`image_ops.py:35-39`); PSD needs net-new image-op pipeline, not extension of existing rembg

**NotebookLM's 4-stage workflow draft** (analyze → parallel cutout → adversarial validate → psd-tools assemble) is directionally right but under-specified — analyze must produce typed layer plan (not freeform text); cutout stresses 501 immediately; validation needs concrete metrics; assembly stores PSD as Asset not board doc.

**Content/demo value verdict**: PSD's content/AEC story value raises its priority over other unproven features. Does NOT lower the harness bar. Verdict: prototype as admin-hidden harness spike AFTER Charter v0 lands, BEFORE staged image smoke completes is acceptable for the prototype only.

---

## 15. Risks and Pushback

**On the paradigm:**
- "Harness Engineering" is overhyped when called a paradigm shift. Substance = disciplined workflow engineering around LLMs. Old wine, new bottle.
- Naming as contract is the actual lever (code review can say "validator missing — block"), not the underlying techniques.
- Doesn't create PMF, doesn't solve taste, doesn't make ambiguous creative instructions deterministic.

**On the cost:**
- More schema, more route plumbing, more tests, more admin observability, more failure states to maintain on-call
- Latency rises with validation + retries + adversarial checks
- Dev velocity drops if every small AI affordance requires full bundle (mitigated by v0 doc-only + trivial-validator escape hatch + admin-only hatch)

**On wrong-problem timing:**
- Current P0 truth still points to live image smoke + server-boundary cleanup undone
- "Harness Engineering" risks becoming an excuse to expand surface area before P0 spine is believable
- Mitigation: v0 doc-only blocks PSD implementation explicitly; v1 schema sequences after Group cleanup; v2 validator infra blocked by staged image smoke

---

## 16. Concrete Next Actions

In order:

1. **Land Charter v0 (doc-only)** — create `/Users/shuaitang/Developer/AIS-OS/projects/Tanergy/AI-HARNESS.md` (sketch in Appendix B). 1-2 days. Add crossref to `HARNESS.md` header. Update `AGENTS.md:32` read order. Update `CLAUDE.md` if its `dev-plans/web-collaborative-canvas-pivot.md` pointer is in scope (see Appendix A stale-doc finding).
2. **Defer PSD-layer-split** to "admin-hidden spike after Charter v0 lands." Not blocked by P0 spine for the prototype, but cannot graduate until staged image smoke is green.
3. **Open issues for the 3 stale-doc findings** in Appendix A. These are independent of this research and need fixing regardless.
4. **Decide whether to proceed to v1 schema** after v0 lands and one feature (likely PSD) exercises the doctrine in admin-hidden mode.
5. **Charter v2 validator infra** deferred until both Group cleanup + staged image smoke close.

---

## Appendix A — Stale Doc Findings (Independent Issues)

Codex Round 1 surfaced three orthogonal stale-doc problems while reviewing the brainstorm. None are caused by this research; all need fixing regardless. Recommend opening separate GitHub issues.

1. **`CLAUDE.md:13`** points to `dev-plans/web-collaborative-canvas-pivot.md` as current P0 plan, but the file is missing from active `dev-plans/` — only `dev-plans/Archive/web-collaborative-canvas-pivot.md` exists (status: archived historical baseline). Fix: update CLAUDE.md pointer to the actual current P0 doc.

2. **Provider truth contradiction**: `dev-plans/s2-ai-provider-route-billing-control-plane-2026-05-07.md:4` says current deployment is Jiekou-first; `dev-plans/p0-project-wide-acceptance-audit-2026-05-18.md:110, 222` repeats this. But `ARCH/ARCH_slice_S2_ai_runtime.md:163-168` says GeekAI is active/default; `:195-198` says Jiekou is explicitly not active/default. These contradict.

3. **Group vs Teams contradiction**: `dev-plans/remove-group-feature-and-consolidate-to-teams-only.md:18-28` argues hard deletion; active S3/S4 plans still encode Group + Collaborate as live product concepts (`dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md:15-18, 92-97` and `dev-plans/s3s4-team-group-foundation-unification-2026-05-16.md:27-43`). Need explicit superseded-by markers on one side.

---

## Appendix B — Sketch of `AI-HARNESS.md`

Recommended structure for the v0 doctrine artifact:

```
# Tanergy AI Execution Harness

> This file = AI runtime execution contract. For dev-process discipline see HARNESS.md.

**Updated**: YYYY-MM-DD
**Purpose**: every new AI feature in Tanergy must declare its execution contract before shipping.

## What This Is

[Definition paragraph from §1 of this research report]

## Read Order

For any work touching AI nodes, providers, or AiRun:
1. `AGENTS.md`
2. `ARCH/ARCH.md` + `ARCH/ARCH_slice_S2_ai_runtime.md`
3. `AI-HARNESS.md` (this file)
4. Relevant `knowledge/wiki/*.md`

## The 9 Invariants

[Table from §5 — each invariant with one paragraph + line refs to existing code that already enforces it]

## Orchestration Patterns

[Table from §6 — supported / out-of-scope]

## Decision Rules — "How Much Harness?"

[§8 distilled]

## Charter Phases

[Phase v0/v1/v2 table from §9 with current phase marked]

## Validator-as-LLM-Call

[Mini-design from §7]

## Graduation Criteria

[§10 — gate checks + approval flow + rollback]

## Grandfathering

[§11 — 30-day window + known-issue exemption pattern]

## Velocity Safeguards

[§12 — trivial validator + admin-hidden + lazy migration]

## What This File Is Not

- Not generic AI safety guidance
- Not a substitute for `ARCH/ARCH_slice_S2_ai_runtime.md` runtime specifics
- Not a substitute for `HARNESS.md` dev process rules
- Not a doctrine about prompts, prompt-injection defense, or model selection (those live in PRD/wiki)
```

Target length: ~400-700 lines for v0. Update `AGENTS.md:32` read order to include `AI-HARNESS.md` for AI-touching slices. Update `HARNESS.md` header with one-line disambiguation.

---

## Appendix C — Open Questions for Round 4 (Deferred)

If a Round 4 is commissioned:

- Exact schema for `tangent_ai_harness_registry` table (column types, FKs, indices)
- Parent/child run lineage admin UI requirements
- Credit hold/reservation design beyond current preflight + settlement
- PSD-layer-split validator schema (concrete metrics, thresholds, output format)
- Whether harness metadata should ALSO live in `tangent_model_registry` (for capability-level harness binding) vs only in dedicated registry table

---

## Sources Used

- Codex Round 1 (2026-05-28): brainstorm review + first principles literature scan + Tanergy mapping + PSD critique + risks
- Codex Round 2 (2026-05-28): Charter v0.1 draft with 9 invariants + orchestration patterns + code/doc change spec
- Codex Round 3 (2026-05-28): Phased rollout + validator-as-LLM-call mini-design + graduation criteria + grandfathering policy + Charter v0.1 amendments
- Claude push-backs across all 3 rounds: name-as-contract argument; PSD demand framing; content/demo value as first-class input; v0 doc-only as immediate-actionable
- Naming collision discovery: existing `HARNESS.md` + `knowledge/wiki/agent_harness_and_skills.md` verified by Claude

NotebookLM-extracted YouTube content cited as one downstream source; Anthropic / LangGraph / OpenAI Swarm / AutoGen / Andrew Ng / BDI cited as primary upstream literature per Codex Round 1.
