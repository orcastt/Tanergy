# Project Memory Operating Model

**Updated**: 2026-05-21
**Mode**: Derived operating model for future coding agents.

## Intent

TANGENT's current docs are accurate but wide. Future coding work benefits from a small memory layer that answers:

- Where is the current source of truth?
- Which external services are connected?
- Which provider routes and key slots are active?
- Which decisions should not be relitigated without new evidence?
- Which weekly checks prevent security, deploy and collaboration regressions?

## What This Adds

`knowledge/` adds a compiled layer:

```text
raw source notes
  -> wiki synthesis
  -> index/log/schema
  -> future agent reads faster, then verifies at source
```

This is intentionally not AIS-OS and not a new runtime subsystem. It is a repo-native memory scaffold.

## Agent Workflow

For substantial coding or validation work:

1. Read the relevant canonical slice docs.
2. Read `knowledge/index.md`.
3. Open `agent_harness_and_skills.md` when the task is cross-slice or operational.
4. Open the matching wiki page, such as `ai_provider_capability_matrix.md` or `connections_registry.md`.
5. Verify unstable facts against live smoke, provider docs or deployment dashboards.
6. Make code/doc changes.
7. Update canonical docs for any product, architecture or current-state change.
8. Update `knowledge/` only with cross-slice distilled facts.

## What Belongs In Wiki Pages

- Provider capability facts that affect code paths.
- Deployment topology and external service ownership.
- Security posture summaries and audit entry points.
- Collaboration status across frontend, backend and WebSocket layers.
- Admin/billing runtime ownership and known limitations.
- Recurring acceptance checklists.

## What Does Not Belong Here

- Full PRD requirements.
- Full architecture specs.
- Tactical implementation plans.
- Secrets or raw logs.
- Long provider docs copied into the repo.
- Raw generated images or provider payloads.

## Current Priority Pages

1. `ai_provider_capability_matrix.md`
2. `connections_registry.md`
3. `weekly_audit_checklist.md`
4. `agent_harness_and_skills.md`
5. `tangent_project_wiki.md`
6. Future: `deploy_topology.md`
7. Future: `security_posture.md`
8. Future: `collaboration_status.md`

## Sources

- Karpathy LLM wiki gist: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- Canonical project docs: `PRD/`, `ARCH/`, `project_state/`, `dev-plans/`, `docs/`
