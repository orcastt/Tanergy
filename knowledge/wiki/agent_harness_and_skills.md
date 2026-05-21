# Agent Harness And Project Skills

**Updated**: 2026-05-21
**Mode**: Operating skill map for future agents.

This page turns the project docs into a practical agent workflow. It is not a separate product spec and not a runtime plugin.

## Harness Agent

The Harness Agent is the default operating posture for substantial work.

Use it when a task touches data, API, Auth, AI, Admin, Billing, Deploy, Collaboration, security, staging, or cross-slice docs.

Core loop:

1. Read `AGENTS.md` and `HARNESS.md`.
2. Read `project_state/project_state.md`, then the relevant project-state slice.
3. Read the matching `PRD/` and `ARCH/` slice.
4. Read `knowledge/index.md`, then the matching wiki page.
5. Inspect code with `rg` and small file reads.
6. Implement narrowly.
7. Run the relevant quality gates.
8. Update the canonical slice docs and distilled wiki pages.
9. Record decisions only when they are important, costly or hard to reverse.

## Project Skills

| Skill | Trigger | Must read | Output |
| --- | --- | --- | --- |
| PRD Skill | User-visible behavior, acceptance, UX promises, release scope. | `PRD/PRD.md`, relevant `PRD/PRD_slice_*.md`, `project_state/project_state.md`. | Updated product requirement or acceptance note. |
| ARCH Skill | APIs, schemas, storage, boundaries, provider routes, deployment topology. | `ARCH/ARCH.md`, relevant `ARCH/ARCH_slice_*.md`, `HARNESS.md`. | Updated architecture contract, data flow or boundary note. |
| Project State Skill | Current truth, handoff, stage comparison, next steps. | `project_state/project_state.md`, relevant project-state slice. | Updated checkpoint, blocker, acceptance result or handoff. |
| Harness/QA Skill | Quality gates, smoke tests, oversized files, release readiness. | `HARNESS.md`, `knowledge/wiki/weekly_audit_checklist.md`, relevant scripts/docs. | Gate run, result summary and follow-up notes. |
| AI Provider Skill | Model/key/provider changes, image/text/analysis route bugs, capability matrix. | `knowledge/wiki/ai_provider_capability_matrix.md`, `ARCH/ARCH_slice_S2_ai_runtime.md`, `PRD/PRD_slice_S2_ai_productization.md`. | Provider route/code/doc update plus smoke result. |
| Deploy/Ops Skill | Vercel, Hetzner, Supabase, R2, Clerk, Cloudflare, monitoring. | `knowledge/wiki/connections_registry.md`, `ARCH/ARCH_slice_S1B_staging_infra.md`, `docs/ops-readiness-acceptance.md`. | Deployment, smoke result, or ops proof update. |
| Security Skill | Auth bypass, CSRF/origin, upload safety, data leakage, public share, realtime abuse. | `docs/fullstack-security-acceptance-2026-05-20.md`, `dev-plans/p0-collaboration-security-hardening-2026-05-19.md`, relevant slices. | Guard/test/doc update plus security acceptance note. |
| Collaboration Skill | Multi-user Board, Yjs/WebSocket, presence, invite chain, realtime performance. | `PRD/PRD_slice_S4_collaboration.md`, `ARCH/ARCH_slice_S4_collaboration.md`, `project_state/project_state_slice_S4_collaboration.md`. | Collaboration fix, smoke result and state update. |
| Memory Wiki Skill | Cross-slice summary, decision log, source notes, recurring checklists. | `knowledge/schema.md`, `knowledge/index.md`, source docs. | Wiki/log/decision update without duplicating canonical docs. |

## Doc Update Rules

- PRD: what users can do, what acceptance means, what is in/out of scope.
- ARCH: how the system is wired, which boundary owns authority, which API/schema/route changed.
- project_state: what is true now, what passed, what failed, what is next.
- dev-plans: tactical sequence and implementation plan.
- docs: acceptance reports, runbooks and operational proof.
- knowledge: cross-slice memory, matrices, source notes and recurring audit checklists.
- HARNESS/AGENTS: compact execution rules only.

## Stop Conditions

Pause and ask before proceeding when:

- A fix needs secret values that are not already available through safe env names.
- A destructive operation is required.
- A provider/deployment decision would create cost or production impact.
- Current dirty changes make ownership ambiguous in the same file.

## Legacy Rule

`legacy/` has been removed from the active worktree/repo. Do not recreate it or reintroduce desktop/Tauri code for P0. If old reference material is needed, recover it from Git history or archived docs as a separate, explicit inspection task.

## Sources

- `AGENTS.md`
- `HARNESS.md`
- `knowledge/schema.md`
- `knowledge/wiki/tangent_project_wiki.md`
