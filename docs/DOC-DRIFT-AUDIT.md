# Documentation Drift Audit

**Date**: 2026-05-30
**Branch**: `chore/58-doc-drift-audit`
**Issue**: [#58](https://github.com/orcastt/Tanergy/issues/58) (cross-links [#48](https://github.com/orcastt/Tanergy/issues/48), [#49](https://github.com/orcastt/Tanergy/issues/49); migration drift routes to [#54](https://github.com/orcastt/Tanergy/issues/54))
**Scope**: all 115 pre-existing git-tracked markdown files (this audit report is the 116th). Vendored (`.venv/`, `node_modules/`) and gitignored paths excluded.

## TL;DR

- **Links are healthy.** 0 broken markdown links across all 115 docs. The repo's cross-file references resolve.
- **9 mechanical fixes applied** in this PR (§1) — all objective value/identifier/path corrections, no judgment.
- **~30 semantic items reported, not touched** (§2) — code-vs-doc, cross-doc contradictions, status drift. Need your call.
- **47 group→teams migration items** (§3) — route to #54. Group/Collaborate is wired in as permanent architecture (enums, plan families, DB schema, live routes) across ARCH/PRD/project_state. The removal decision is also **missing from `knowledge/decisions/log.md`**.
- **2 untracked-config issues** (§5) — `CLAUDE.md` has a broken session-read pointer; fix locally (gitignored, can't go in PR).

## Method & cost control

Tiered scan, cheapest tool first:

| Tier | Tool | Job | Why this tier |
| --- | --- | --- | --- |
| 0 | Python script (no model) | resolve every link/path ref | deterministic, free; catches all broken refs |
| 1 | Haiku ×10 | per-doc intra-document drift (placeholders, internal contradictions, count/anchor mismatches) | broad cheap read of 115 files |
| 2 | Sonnet ×4 | semantic: ARCH-vs-code, PRD/state-vs-reality, cross-doc, migration | needs judgment + code grep |
| 3 | Opus (orchestrator) | verify every candidate fix against source, synthesize, apply | judgment-heavy core only |

No model re-did what a script could do. Opus did not fan out. 14 subagents, ~1.5M tokens total.

Every "mechanical" fix was re-verified against the actual file before applying — agents over-labeled (35 candidates → 9 truly objective fixes). The rest were down-classified to report-only.

---

## 1. Mechanical fixes applied in this PR

All verified two ways. Pattern: **Chinese mirror sections lag the English** — the fixes sync ZH to the already-correct EN, plus one stale hardcoded path and one stale migration-head fact.

| File | Site | Was | Now | Why |
| --- | --- | --- | --- | --- |
| `ARCH/ARCH.md` | L562 | S3 `96%` | `97%` | EN L43 = 97% (ZH snapshot lagged) |
| `ARCH/ARCH.md` | L566 | UI `63%` `[#############-------]` | `69%` `[##############------]` | EN L47 = 69% |
| `ARCH/ARCH.md` | L570 | S4 `34%` | `35%` | EN L51 = 35% |
| `PRD/PRD.md` | L256 | S4 `34%` | `35%` | EN L98 + 2× project_state all say 35% |
| `project_state/project_state.md` | L259 | 更新日期 `2026-05-20` | `2026-05-25` | EN header L3 = 2026-05-25 |
| `project_state/project_state.md` | L260 | 分支 `feature/s1c-auth-admin-production-boundary` | `` `main`（S1C 已通过 PR #11 合入） `` | EN header L4 = `main`; S1C merged via PR #11 |
| `project_state/project_state.md` | L182 + L400 | migration head `0007` | `20260520_0033` | actual Alembic head; same doc L20 already states `0033 head` |
| `knowledge/wiki/weekly_audit_checklist.md` | L6-10 | `cd "/Users/orcastt/Code project/TanvasAgent"` | "Run all commands from the repo root." | wrong user (`orcastt`) + wrong project name (`TanvasAgent`) hardcoded in a committed doc; also fixes the "run from repo root then cd away" contradiction |

---

## 2. Reported — needs your decision (not auto-fixed)

These are real but require judgment, so they were left untouched per the PR's scope.

### 2.1 Code-vs-doc — ARCH describes code that doesn't exist (HIGH)

| File:line | Drift |
| --- | --- |
| `ARCH/ARCH_slice_S1C_auth_request_context.md:63` | Lists **10 auth API routes** as the contract; only **3** are implemented (`GET /session`, `PATCH /profile`, `DELETE /account`). |
| `ARCH/ARCH_slice_S1D_auth_board_crud.md:77` (+ZH L286) | Documents `POST /api/v1/boards/{boardId}/open` — route does not exist; `last_opened_at` is a side effect of the GET load. |
| `ARCH/ARCH.md:186` | Labels `src/components/canvas` as "retired / historical-only", but it's actively imported by production Konva canvas code. |
| `ARCH/ARCH_slice_S1X_canvas_engine_migration.md:514,531` | "Migration Architecture" lists planned files (`store.ts`, `viewport.ts`, `history.ts`, `tools.ts`, `ydoc.ts`, `provider.ts`, `awareness.ts`) — most don't exist; real collaboration files live elsewhere. (MED) |
| `ARCH/ARCH.md:411` | Runtime flow diagram names 6 service classes (`WorkspaceAccessService`, `BoardPermissionService`, …) that aren't classes in the codebase. (LOW) |

### 2.2 Cross-doc contradictions

| Locations | Conflict |
| --- | --- |
| `PRD/PRD.md:63` (EN) vs `:228` (ZH) vs `PRD/PRD_slice_S4_collaboration.md` | S4 status three ways: "Planned next slice" / "推迟到 P0.5" / slice file says in-progress. |
| `AGENTS.md:82` vs `knowledge/wiki/pr_workflow_handoff.md:22` | Chore branch naming: AGENTS says `chore/<slug>` (no issue number); handoff page says embed the issue number. |
| `README.md:36` vs `HARNESS.md` step 6 | README's architecture read-order omits `dev-plans/README.md`. (LOW) |
| `project_state/project_state.md:267` (EN vs ZH) | Backend test count: `373 passed` vs `367`. One is wrong. (LOW) |
| `CLAUDE.md:38` vs `AGENTS.md:47-49` / `HARNESS.md:69-71` | Frontend gate order: CLAUDE runs build→lint→typecheck; the others run lint→typecheck→build. (gitignored — see §5) |

### 2.3 Intra-doc status/count contradictions (living docs, MED)

- `PRD/PRD_slice_S1B_staging_infra.md:4` — Status claims items complete that the Acceptance section lists as remaining gates.
- `PRD/PRD_slice_S1X_canvas_engine_migration.md:4` — Opening status lists work as remaining; detailed acceptance shows it done.
- `PRD/PRD_slice_S3_admin_billing_analytics.md:92` — has a "drift to fix" section that contradicts its "Active" status.
- `PRD/PRD.md:263,220` — acceptance criteria inserted mid-paragraph (EN) with no ZH equivalent; EN/ZH disagree on Google/email flow status.
- `project_state/project_state_slice_S1B_staging_infra.md:53` — smoke checkbox `[ ]` unchecked but narrative (L85) says "mostly green".
- `dev-plans/p0-collaboration-security-hardening-2026-05-19.md:15` — title dated 05-19 but body has 05-20 sections.

### 2.4 Mechanical-looking, deliberately NOT auto-fixed (why)

| Item | Why reported, not fixed |
| --- | --- |
| `ARCH/ARCH.md:200/717` admin source-tree EN/ZH desc divergence | fix = authoring Chinese prose, not a value swap |
| `project_state.md:82` S1D `73%` vs `PRD:93` `72%` | cross-doc; canonical value ambiguous |
| `project_state.md:182` State Slice Index missing S4 row; `:56` S1 sub-slices table missing S1X row | adding a row needs an authored status cell |
| `HARNESS.md:3`, `dev-plans/README.md:3`, S1X missing `**Updated**` header | date bumps fabricate freshness without a content change |
| `knowledge/wiki/project_memory_operating_model.md:60` "7 pages but lists 8" | the 8th is an intentional "Future:" entry |
| `AGENTS.md:21` knowledge row omits `knowledge/log.md` | completeness judgment, low value |

### 2.5 Archive (frozen, low severity — expected)

12 intra-doc inconsistencies in `dev-plans/Archive/` and `docs/archive/` (date/filename mismatches, stale status markers, one cost-math inconsistency in `overseas-cost-growth-forecast.md:94`). Archive is frozen by design — listed for completeness, no action recommended unless a living doc depends on them (none do).

---

## 3. Group → Teams migration drift → #54

The removal (#50-#55) hard-deletes Group/Collaborate and consolidates to Solo + Team + Enterprise. **47 findings** show Group/Collaborate is documented as *permanent architecture*, not a transitional feature. All deferred to the #54 docs-sync slice — **do not edit during the in-flight migration**.

**Missing decision record (HIGH):** `knowledge/decisions/log.md` has **no entry** for the removal decision. The decisions log is the authoritative record — add one.

By file:

| File | Items | Worst-case drift |
| --- | --- | --- |
| `ARCH/ARCH.md` | 7 (6 HIGH) | plan-tier enum `collaborate_start/collaborate_plus`, workspace-kind `group_workspace` (L389/392 + ZH L906/909); "Group/Team Workspace + AI Charging Architecture" section |
| `ARCH/ARCH_slice_S3_admin_billing_analytics.md` | 6 | DB `subscriptions.plan_family = … collaborate …`; `-> create group_workspace` payer flow |
| `project_state/project_state.md` | 6 | "done-locally" records `group_workspace` create + Group/Collaborate payer settlement as live |
| `PRD/PRD_slice_S3_admin_billing_analytics.md` | 5 | Group/Collaborate Start/Plus as a permanent commercial tier with SKUs + member caps |
| `PRD/PRD.md` | 3 | S3 index row + S2/S3 roadmap treat Group personal-wallet collaboration as permanent |
| `project_state/project_state_slice_S3_admin_billing_analytics.md` | 3 | live route `/api/v1/workspaces/groups`; `chargedScope` keeps Group/Collaborate |
| `dev-plans/s3s4-team-group-foundation-unification-2026-05-16.md` | 3 | whole doc is a "confirmed baseline" for rules being removed |
| `dev-plans/s3-team-group-wallets-membership-billing-plan-2026-05-08.md` | 2 | plan keys `collaborate_start/collaborate_plus` to "lock" |
| `dev-plans/s3-team-group-board-billing-chain-audit-2026-05-18.md` | 2 | Group billing semantics as conclusion-first baseline |
| `dev-plans/s3-admin-operator-console-redesign-2026-05-09.md` | 2 | Group Plan UI section with collaborate plan keys |
| `ARCH/ARCH_slice_S1C_auth_request_context.md` | 2 (MED) | — |
| `PRD/PRD_slice_S4_collaboration.md` | 2 (MED) | — |
| `dev-plans/README.md` | 2 (MED) | indexes team-group plans as active foundation |
| `knowledge/decisions/log.md` | 1 (HIGH) | **missing removal-decision entry** |
| `dev-plans/s4-collaboration-invite-presence-plan-2026-05-16.md` | 1 (LOW) | — |

---

## 4. Deterministic link scan — clean

182 raw "broken path" hits dropped to **0 actionable** after conservative resolution:

- **0 broken markdown links** (`[text](path)`) in any of the 115 docs.
- Backtick "path" hits were all false positives: code-shorthand (`features/node-runtime/registry.ts` resolved against `apps/web/src/`), gitignored runtime files (`api.env`, `.vercel`, `.env.local`), `<placeholder>` templates, and archive rot.
- 3 living-doc flags were verified by hand and cleared as **intentional**: `knowledge/index.md` lists 4 wiki pages under a heading that says *"these pages are not created yet"*; `reference/Design.md` cites `design-system.md`/`theme.ts` it explicitly says were *"moved to legacy"*; `reference/Design_reference.md` uses a shorthand label whose full path is given at the top of the same file.

---

## 5. Untracked configs (out of PR scope)

`CLAUDE.md` is gitignored, so these can't go in the PR. Fix locally:

- **`CLAUDE.md:13` (broken pointer, HIGH)** — instructs agents to read `dev-plans/remove-group-feature-and-consolidate-to-teams-only.md` every session, but that file lives at `.tangent-review/group-removal-plans/remove-group-feature-and-consolidate-to-teams-only.md` (itself gitignored). The session-read pointer resolves to nothing.
- **`CLAUDE.md:38` (gate order, MED)** — frontend gate runs build→lint→typecheck; `AGENTS.md`/`HARNESS.md` run lint→typecheck→build (cheap checks first). Reorder to match.

---

## Appendix — agent roster

| Agent | Model | Target | Findings |
| --- | --- | --- | --- |
| B1-B10 | Haiku 4.5 | 115 docs, intra-doc drift | 51 |
| S1 | Sonnet 4.6 | ARCH vs code | 7 |
| S2 | Sonnet 4.6 | PRD/state vs reality | 9 |
| S3 | Sonnet 4.6 | cross-doc consistency | 8 |
| S4 | Sonnet 4.6 | group→teams migration | 47 |
| Tier 0 | script | link/ref resolution | 0 actionable |

Raw counts: 116 findings → 47 migration-deferred, 35 mechanical-candidate (9 applied, 26 reported), 34 semantic.
