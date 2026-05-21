# TANGENT Knowledge Schema

**Updated**: 2026-05-21
**Mode**: LLM-maintained project memory rules.

## Purpose

`knowledge/` is a compact project memory layer inspired by Karpathy's LLM wiki pattern: keep source material traceable, compile working knowledge into wiki pages, and maintain a small index/log/schema so future agents can re-enter the project without re-reading every long slice.

This folder does not replace the canonical docs:

| Canonical area | Owns |
| --- | --- |
| `AGENTS.md` | Repo-wide hard rules, product boundary and quality gates |
| `HARNESS.md` | Concise execution harness, read order and definition of done |
| `PRD/` | User-visible requirements, acceptance and product behavior |
| `ARCH/` | Architecture boundaries, contracts, APIs and schemas |
| `project_state/` | Current truth, handoff notes and active next steps |
| `dev-plans/` | Tactical implementation plans |
| `docs/` | Acceptance reports, runbooks and operational proof |
| `knowledge/` | Cross-slice memory, source index, decisions, capability matrices and recurring audit checklists |

## Folder Contract

| Path | Write rule | Examples |
| --- | --- | --- |
| `knowledge/raw/` | Redacted source notes, original links and smoke summaries. Do not store secrets or full provider payloads. | Provider doc excerpts, smoke command results, incident notes, user decision excerpts |
| `knowledge/wiki/` | Synthesized, maintained pages that compile raw/source facts into current operating knowledge. | AI provider matrix, deploy topology, security posture, collaboration status |
| `knowledge/decisions/` | Append-only important decisions. Only record decisions that are hard to reverse, costly, or likely to confuse future work. | Provider switch, DB host decision, memory-system rules |
| `knowledge/index.md` | Human/agent navigation map. Update when pages are added or retired. | "Read this first" table |
| `knowledge/log.md` | Append-only memory-layer change timeline. | Bootstraps, capability refreshes, audit updates |
| `knowledge/schema.md` | These rules. Change rarely. | Ownership, citation and redaction policy |

## Source Rules

- Every wiki page must list its source docs or external links near the top or bottom.
- External facts that may change, especially provider capabilities and prices, must be linked to the upstream source or to a dated smoke result.
- Never paste API keys, bearer tokens, cookies, complete logs, raw provider responses, `data:` URLs, `blob:` URLs or Base64 images into this folder.
- Raw smoke output should be summarized and redacted. Keep only status, date, command, target URL, response type and important failure messages.
- If a source conflicts with live smoke or staging state, staging/runtime proof wins for current operations, and the conflict should be logged.

## Update Workflow

1. Read the relevant canonical slice docs first.
2. Read `knowledge/wiki/agent_harness_and_skills.md` for the operating skill map when the task is cross-slice.
3. Read the matching `knowledge/wiki/*` page for the cross-slice summary.
4. Verify unstable facts against source docs, provider dashboards, staging smoke or admin APIs.
5. Update the canonical slice if product/architecture/state changed.
6. Update the matching wiki page only with the distilled cross-slice fact.
7. Add a dated entry to `knowledge/log.md`.
8. Add a decision entry only if the outcome is important and not just routine progress.

## Future-Coding Rule

For data/API/Auth/AI/Admin/Billing/Deploy/Collaboration work, future agents should use `knowledge/index.md` as a navigation layer after reading the canonical slice docs. The wiki is a shortcut to the right facts, not permission to skip source verification.

## Sources

- Karpathy LLM wiki gist: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Project documentation rules: `AGENTS.md`
