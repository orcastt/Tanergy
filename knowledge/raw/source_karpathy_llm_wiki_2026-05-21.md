# Source Note: Karpathy LLM Wiki Gist

**Captured**: 2026-05-21
**Source**: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
**Used by**: `knowledge/schema.md`, `knowledge/wiki/project_memory_operating_model.md`

## Why It Matters

The gist is useful because it treats Markdown as an LLM-readable working memory rather than as static documentation. The pattern separates original source material from synthesized wiki pages, then uses a small schema/index/log layer to keep future edits grounded and searchable.

## TANGENT Adaptation

TANGENT already has strong canonical docs:

- `PRD/` for product requirements and acceptance.
- `ARCH/` for architecture and contracts.
- `project_state/` for current truth and handoff notes.
- `dev-plans/` for tactical implementation.
- `docs/` for acceptance reports and runbooks.

The new `knowledge/` layer should not duplicate those. It should compile cross-slice facts that repeatedly cause context loss: provider capabilities, deployment connections, operational audits, security posture, collaboration status and important decisions.

## Derived Actions

- Keep raw source notes in `knowledge/raw/`.
- Keep compiled memory pages in `knowledge/wiki/`.
- Keep important decisions in `knowledge/decisions/log.md`.
- Keep navigation and maintenance rules in `knowledge/index.md`, `knowledge/log.md` and `knowledge/schema.md`.
- Update this layer after staging smokes, provider switches, incident reviews and major acceptance passes.
