# Project Memory Index

**Updated**: 2026-05-21
**Mode**: Project-state entry point for `knowledge/`.

## Current Status

The project now has a lightweight `knowledge/` memory layer for cross-slice facts that future coding agents repeatedly need to rehydrate:

- provider/model/key-slot capability facts
- external service connection ownership
- important decisions and review triggers
- weekly security/deploy/AI/collaboration/docs audit checks
- raw source notes that support wiki pages
- a concise Harness Agent and project skill map for PRD, ARCH, project_state, QA, AI provider, deploy, security and collaboration work

This layer is not a replacement for `PRD/`, `ARCH/`, `project_state/`, `dev-plans/` or `docs/`. Those remain the canonical source for product behavior, architecture, current truth, tactical plans and acceptance reports.

`legacy/` has also been removed from the active worktree/repo. Future work should not recreate it or use desktop/Tauri code for P0; old reference material should be recovered from Git history or archived docs only as an explicit inspection task.

## Read First

- `knowledge/index.md`
- `knowledge/schema.md`
- `knowledge/wiki/project_memory_operating_model.md`
- `knowledge/wiki/tangent_project_wiki.md`
- `knowledge/wiki/agent_harness_and_skills.md`
- `knowledge/wiki/connections_registry.md`
- `knowledge/wiki/weekly_audit_checklist.md`
- `knowledge/wiki/ai_provider_capability_matrix.md`
- `knowledge/decisions/log.md`

## Current Rule For Future Coding

For data/API/Auth/AI/Admin/Billing/Deploy/Collaboration work:

1. Read `project_state/project_state.md`, `PRD/PRD.md`, `ARCH/ARCH.md`, `HARNESS.md` and the relevant slices.
2. Read `knowledge/index.md`, `knowledge/wiki/agent_harness_and_skills.md` and the matching wiki page.
3. Verify unstable runtime/provider/deploy facts against source docs, staging smoke or provider dashboards.
4. Update canonical docs for product, architecture or state changes.
5. Update `knowledge/` only when the distilled cross-slice memory changes.

## Bootstrap Note

This was added as a docs-only memory checkpoint after re-reading Karpathy's LLM wiki gist. AIS-OS was intentionally not imported into this repo.
