# TANGENT Fresh Development Rules

## Product Boundary

- Web-first AI image canvas; no desktop client for P0.
- P0 image flow: `Prompt -> Image Gen / Image Gen 4 -> Image`, `Image + Prompt -> Image Gen / Analysis`, `Image -> Canvas Markup -> Merge Capture -> New Image`.
- AI Chat may create legal nodes and edges, but provider calls still go through server-side AiRun contracts.
- Collaboration is P0.5 and waits for Auth, Board, Asset and AiRun boundaries.
- `legacy/` has been removed from the active worktree/repo. Do not recreate desktop/Tauri code for P0; recover old reference material from Git history or archived docs only when explicitly requested.

## Canonical Docs

Root `PRD.md`, `ARCH.md` and `project_state.md` are pointers only.

| Folder | Total file | Slice files | Owns |
| --- | --- | --- | --- |
| `PRD/` | `PRD/PRD.md` | `PRD/PRD_slice_*.md` | User-visible requirements and acceptance |
| `ARCH/` | `ARCH/ARCH.md` | `ARCH/ARCH_slice_*.md` | Architecture diagrams, boundaries, APIs, schemas |
| `project_state/` | `project_state/project_state.md` | `project_state/project_state_slice_*.md` | Current progress, next steps, handoff notes |
| `dev-plans/` | `dev-plans/README.md` | Active/archived plans | Tactical implementation plans |
| `knowledge/` | `knowledge/index.md` | `knowledge/wiki/*.md`, `knowledge/raw/*.md`, `knowledge/decisions/log.md` | Cross-slice memory, source notes, decision log, provider/deploy/security/collab lookup pages |

Do not recreate mirror files such as `ARCH/00-current-map.md` or `project_state/current-slice.md`.

## Update Policy

- During an active small slice, update only the relevant slice docs.
- When that slice reaches a stable checkpoint, update the folder total file.
- Root pointer files should almost never change.
- PRD changes describe product behavior; ARCH changes describe implementation boundaries; project state changes describe what is currently true.
- For `Fast UI polish`, read `project_state/Finished/project_state_slice_S0_local_polish.md`, then the relevant `PRD/` and `ARCH/` slice.
- For data/API/Auth/AI/Admin/Billing/Deploy/Collaboration, read `project_state/project_state.md`, `PRD/PRD.md`, `ARCH/ARCH.md`, `HARNESS.md`, the relevant slices, `knowledge/index.md` and `knowledge/wiki/agent_harness_and_skills.md` for cross-slice memory.

## Safety Rules

- API keys and provider secrets stay server-side only.
- Board documents, Board History documents, node props and future collaboration docs must not persist `data:`, `blob:`, Base64 images, provider raw responses, complete logs or long generated text.
- New AI nodes must update Node Registry, Model Registry, AiRun contracts, routes, tests and Board guard together.
- Admin access must be server-side through `admin_roles`; all admin writes need audit logs.
- Source files target under 300 lines; this is a project-wide acceptance gate, not a soft preference. Split before adding more behavior to large files, and record any remaining slimming follow-up in the active plan before signoff.

## Quality Gates

Frontend changes:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

Backend/API changes:

```bash
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api services/api/migrations
git diff --check
```

Docs-only changes may run only `git diff --check`, but say that clearly in the final response.

## Git

- Do not commit, push or create branches unless the user asks.
- Before committing, inspect `git status`.
- Keep checkpoints small and reversible.

## PR workflow (hard rule)

每个进入 `main` 的改动，无论大小、无论类型（代码、文档、配置），都按以下顺序：

1. **先开 issue。** 写清楚 scope 和 acceptance criteria。加入 Tanergy GitHub Project board。
2. **从 main 拉新分支。** 永远不直接编辑或推送 `main`。
3. **开 PR**，body 里必须包含 `Closes #N`（或 `Fixes #N` / `Resolves #N`）。CI 的 `link-issue` check 会拦截不符合的 PR。
4. **由非作者的另一位 reviewer 给出 approving review。** 不能自审自批。
5. **通过 GitHub UI merge。** 永远不 `git push origin main`。

AI agent 额外约束：
- 不要 push 到 main，不要 merge 自己开的 PR，不要批准自己作者身份的 PR。
- 任何一步缺失，停下来告诉用户，不要自己绕过。
- Branch 命名：`feat/<n>-<slug>` / `fix/<n>-<slug>` / `chore/<slug>`，其中 `<n>` 是 issue 编号。
