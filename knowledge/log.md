# TANGENT Knowledge Log

Append-only timeline for the `knowledge/` memory layer. Do not remove old entries; add corrective entries when facts change.

## 2026-05-25

- Added `wiki/pr_workflow_handoff.md` mirroring the `AGENTS.md` protected-main PR/Kanban handoff rule into cross-slice memory so future agents can recall it from `knowledge/index.md` without re-reading the full AGENTS contract.
- Added `raw/source_agents_md_pr_workflow_2026-05-25.md` as the capture note for the page.
- Updated `knowledge/index.md` Core Pages table and Current Fast Links to include the new page and source note.
- Recorded the post-S1C-merge active-slice pointer in `project_state/project_state.md` so the index reflects that `feature/s1c-auth-admin-production-boundary` was merged via PR #11.

Sources:

- `AGENTS.md` § "PR workflow (hard rule)"
- Issue [#14](https://github.com/orcastt/Tanergy/issues/14)

## 2026-05-21

- Bootstrapped `knowledge/` as a lightweight LLM-maintained project memory layer.
- Added the directory schema, index, raw-source intake rules, Karpathy LLM wiki source note, project memory operating model, connections registry, decisions log, weekly audit checklist and AI provider capability matrix.
- Added `project_state/project_memory_index.md` as the project-state entry point to this layer.
- Updated `AGENTS.md` so future coding work can use `knowledge/index.md` after the relevant canonical slice docs.
- Added `tangent_project_wiki.md` and `agent_harness_and_skills.md` so future agents can enter through a concise project wiki plus PRD/ARCH/project_state/HARNESS skill map.
- Recorded the `legacy/` removal as active project memory: old desktop/reference code should be recovered from Git history or archived docs only when explicitly requested.

Sources:

- External pattern source: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Current project facts: `project_state/project_state.md`, `ARCH/ARCH_slice_S2_ai_runtime.md`, `PRD/PRD_slice_S2_ai_productization.md`, `docs/fullstack-security-acceptance-2026-05-20.md`, `docs/ops-readiness-acceptance.md`
