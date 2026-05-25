# PR Workflow And Kanban Handoff

**Updated**: 2026-05-25
**Mode**: Protected-main PR/Kanban handoff protocol for future agents.

This page is the cross-slice memory of how every change reaches `main`. It mirrors the hard rule in `AGENTS.md` so future agents can find it from `knowledge/index.md` without re-reading the full AGENTS contract.

## Hard Rule

Every change into `main` — code, docs, config, any size — follows this order:

1. **Open an issue first.** Write scope and acceptance criteria. Add the issue to the Tanergy GitHub Project board.
2. **Branch from `main`.** Never edit or push `main` directly.
3. **Open a PR.** The body must contain `Closes #N` (or `Fixes #N` / `Resolves #N`). The `link-issue` CI check blocks PRs without an issue reference.
4. **Get an approving review from a non-author reviewer.** Self-review or self-approval is not allowed.
5. **Merge through the GitHub UI.** Never `git push origin main`.

## AI Agent Constraints

- Do not push to `main`. Do not merge your own PR. Do not approve a PR you authored.
- If any step is missing, stop and tell the operator. Do not work around it.
- Branch naming: `feat/<n>-<slug>` / `fix/<n>-<slug>` / `chore/<slug>` / `docs/<n>-<slug>`, where `<n>` is the issue number.

## Kanban Handoff

GitHub Project board is the single source of truth for kanban state. See `CLAUDE.md` (Tanergy) for the active board URL and ID. Do not mirror board state into the repo.

Slice ↔ issue links live inline in `project_state/project_state.md` and slice files, not in a separate ledger.

When closing a slice or task:

- Reference the issue (`Closes #N`) in the commit and PR body.
- Move the project card via `gh project item-edit` once the PR is opened, and again when it is merged.

## When To Read This Page

- Before opening any PR.
- Before pushing any branch.
- When onboarding a new agent into the repo.
- When a CI `link-issue` check fails.

## Sources

- `AGENTS.md` — canonical PR workflow rule.
- `CLAUDE.md` (Tanergy) — project tracking and `gh` auth notes.
- `knowledge/raw/source_agents_md_pr_workflow_2026-05-25.md` — capture note for this page.
