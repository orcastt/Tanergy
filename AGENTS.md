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

Root `ENG-HARNESS.md`:build-loop 的 agent 治理 doctrine(规范 AI agent 如何构建本仓库),引用本文件为 PR 硬规则的 source of truth、不重复其规则。

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

## Review convergence (hard rule)

补全 `PR workflow` 第 4 步;本节对 author、reviewer、AI reviewer(Codex/Claude)双向同等生效。review 的阻断权只来自本节,不来自"还可以更好"。

- **角色对称,不认人。** 谁开 PR 谁是 author,另一方是 reviewer(Archii-Coder 与 orcastt 平级,角色随 PR 互换)。下文 "reviewer / author" 指角色;blocker 裁定按角色 + 独立裁决走,不归某个具体的人。merge 按 `PR workflow` 第 5 步(非作者 approval 后走 GitHub UI)。
- **默认负担在 blocker。** finding 要挡 merge,reviewer 必须在 comment 里给出:diff/file 行、可复现或可推导的失败路径、严重度、为什么现有 required gate/test/guard 挡不住。缺任一项 = signal,开 linked issue,不挡。
- **In-diff 定义。** 只包括本 PR 改过的行、改动直接调用/启用的路径、以及为修本 PR 必须触碰的契约。既有坏味道、相邻代码、未来 PR scope 不挡;除非本 PR 新暴露它。
- **严重度门槛。** `Critical` = secret 泄露、auth/admin 绕过、不可逆数据破坏、任意执行、生产破坏性操作;`High` = 已承诺用户路径/数据完整性/安全边界可达失败;`Medium/Low` = 可恢复边缘、测试/可维护性/style/更好方案。
- **Risk tier 按 blast radius 定。** `Low`:docs/read-only/tooling/运行时不可达,且无 secret、provider spend、写入或删除能力。`Medium`:常规可回滚 app/API/config。`High`:migration、auth、admin、billing、secret、provider spend、prod/user data、backup/restore、删除/覆盖/破坏性脚本。
- **Tier 裁定。** 作者在 PR body 提议 tier;reviewer 可用具体 blast radius 挑战;由非作者 reviewer 记录裁定。裁定前按较高 tier 处理;作者不得单方降级。
- **Blocker 规则。** `Low/Medium` PR 只有 in-diff `High/Critical` 可挡;`Medium` finding 修或开 linked issue。`High` PR 的 in-diff `Medium+` 可挡,且修后要 verifier:测试、脚本输出、截图、日志或人工复核说明;普通绿勾只有覆盖该路径时才算 verifier。
- **Re-review scope。** 第 N+1 轮只看:已接受 blocker 的修复、上轮后新增/修改的 diff、这些修改的直接副作用。禁止在未改旧行上继续开 `Medium/High` 新 blocker;真正 `Critical` 可例外,但必须按 blocker 负担完整证明并由非作者 reviewer 确认。
- **Approval 后不回炉。** PR 一旦获非作者 approval,只有 in-diff `Critical` 能再 push 改动 / 重开 blocker;其余(含 High)一律 fast-follow issue,不 push 进已批 PR —— 否则会顶掉 approval、把已收敛的 review 重启。
- **Dispute closeout。** 作者可逐条标记 `contested`;reviewer 必须二选一:补齐 blocker 证明并维持,或降为 linked issue。仍争议 → 独立裁决(read-only,非作者非审者;不绑定某人本机的具体工具)分类 blocker / follow-up issue;裁定后同一事实不得反复阻断。再无解 → 默认降为 follow-up issue 放行(举证责任在 blocking 一方)。
- **Merge gate。** 满足 `PR workflow`、required checks、非作者 approval,且按本节裁定的残留 blocker 为 0,即可 merge;所有非阻断项必须已有 linked issue 或明确不做。
- **无轮数上限。** 不用轮数封顶压掉晚发现的真缺陷;收敛靠 blocker 证明负担、delta re-review scope、独立裁决兜底。
- **本节校准。** 裁决若暴露本节盲点,开 issue 按 `PR workflow` 改本节;预期它随真实争议演进,但不靠临时编辑,也不冻在某次粘贴的 prompt 里。

发散式 grind 的处理见 `ENG-HARNESS.md`(build-loop 改写策略)。
