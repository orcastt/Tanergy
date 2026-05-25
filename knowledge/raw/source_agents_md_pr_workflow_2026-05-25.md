# Source Note: AGENTS.md PR Workflow Hard Rule

**Captured**: 2026-05-25
**Source**: `AGENTS.md` § "PR workflow (hard rule)" (in-repo, current as of this capture)
**Used by**: `knowledge/wiki/pr_workflow_handoff.md`

## Why It Matters

`AGENTS.md` is the multi-agent contract for Claude, Codex and any future agent. Its PR workflow section defines the only legal path into `main`: ticket-first, branch off main, PR with `Closes #N`, non-author review, GitHub UI merge.

Issue [#14](https://github.com/orcastt/Tanergy/issues/14) calls for this rule to also live in the cross-slice memory layer so future agents can recall it from `knowledge/index.md` without re-reading the full AGENTS contract.

## Capture Decisions

- Mirror the rule verbatim into `knowledge/wiki/pr_workflow_handoff.md`. Do not rewrite the steps; small drift between the wiki page and the source rule would cause future confusion.
- Keep the wiki page short and link back to this source note plus `AGENTS.md`.
- If `AGENTS.md` changes, update the wiki page and append a corrective entry to `knowledge/log.md`.

## Related

- `AGENTS.md` — § "PR workflow (hard rule)" and § "Git".
- `CLAUDE.md` (Tanergy) — project tracking, `gh` auth and don'ts.
- `knowledge/wiki/pr_workflow_handoff.md` — compiled wiki page for this rule.
