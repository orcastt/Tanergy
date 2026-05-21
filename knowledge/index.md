# TANGENT Knowledge Index

**Updated**: 2026-05-21
**Mode**: Cross-slice project memory index.

## Read Order

1. Start with the relevant canonical docs: `PRD/`, `ARCH/`, `project_state/`, `dev-plans/` and `docs/`.
2. Use the wiki pages below to get the compiled project memory.
3. Return to raw/source notes or live smoke when a fact is unstable, provider-specific or deployment-specific.

## Core Pages

| Page | Use it for | Update trigger |
| --- | --- | --- |
| `schema.md` | Rules for what belongs in `knowledge/` and how to keep it safe. | Memory-system rule changes |
| `log.md` | Append-only timeline of knowledge-layer updates. | Any meaningful knowledge edit |
| `raw/README.md` | Raw-source intake rules. | Raw-source policy changes |
| `raw/source_karpathy_llm_wiki_2026-05-21.md` | External source note that shaped this folder. | Re-read or reinterpret the gist |
| `wiki/project_memory_operating_model.md` | How this memory layer fits TANGENT and future coding. | Process or doc topology changes |
| `wiki/tangent_project_wiki.md` | One-page compiled project overview, release spine, architecture shape and open gates. | Major product/architecture/state checkpoint |
| `wiki/agent_harness_and_skills.md` | Practical Harness Agent workflow and PRD/ARCH/project_state/QA/AI/deploy/security/collab skill map. | Agent workflow or doc ownership changes |
| `wiki/connections_registry.md` | GitHub, Vercel, Hetzner, Supabase, R2, Clerk, GeekAI and Cloudflare ownership map. | Any provider/account/topology change |
| `wiki/weekly_audit_checklist.md` | Weekly security/deploy/AI/collab/docs/file-size checklist. | Acceptance gate or command changes |
| `wiki/ai_provider_capability_matrix.md` | Current provider/model/key-slot/capability matrix. | Any provider key, model, route, pricing or smoke change |
| `decisions/log.md` | Important decisions and review triggers. | Irreversible or costly decisions |

## High-Value Maintenance Additions

These pages are not created yet, but they are good next candidates when the facts stabilize:

| Candidate page | Why it matters |
| --- | --- |
| `wiki/deploy_topology.md` | One page for Web/API/DB/storage/CDN/status/error-tracking topology after the next staging acceptance. |
| `wiki/security_posture.md` | One page for implemented controls, remaining external proofs and incident-response entry points. |
| `wiki/collaboration_status.md` | One page for Yjs/WebSocket/presence/current smoke status and multi-user acceptance gaps. |
| `wiki/admin_billing_runtime.md` | One page for admin writes, audit logs, wallet ownership, Team/Group billing and payment limitations. |

## Current Fast Links

- Project state entry: `project_state/project_state.md`
- Memory entry from project state: `project_state/project_memory_index.md`
- Project wiki: `knowledge/wiki/tangent_project_wiki.md`
- Agent harness and skills: `knowledge/wiki/agent_harness_and_skills.md`
- AI runtime architecture: `ARCH/ARCH_slice_S2_ai_runtime.md`
- AI product acceptance: `PRD/PRD_slice_S2_ai_productization.md`
- Full-stack security acceptance: `docs/fullstack-security-acceptance-2026-05-20.md`
- Ops readiness acceptance: `docs/ops-readiness-acceptance.md`
