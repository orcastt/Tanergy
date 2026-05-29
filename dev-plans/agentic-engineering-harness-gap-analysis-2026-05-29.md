# Tanergy Agentic Engineering Harness — 差距分析与 Epic 建议

> **可独立阅读的分析报告**。不依赖任何聊天上下文，可直接外部讨论 / 转给他人或其他 AI。

**Date**: 2026-05-29
**Author**: Hansen (driver) × Claude (analysis)
**Status**: Research input / discussion draft —— **尚未落地为 issue 或代码**。
**Scope**: 判断 Tanergy 是否需要一套独立的"工程时 Agentic Engineering Harness"，它和当前在飞的运行时 `AI-HARNESS.md` 系列（#44–#47）是什么关系，缺什么，以及该不该单独立 Epic。
**Inputs**:
1. 一段 ChatGPT 对话（主题：Karpathy "vibe coding is dead → agentic engineering"，以及"企业 SaaS 是否该建严格 agentic harness"）。
2. 仓库现有 harness：`HARNESS.md`、`AGENTS.md`、`knowledge/` 记忆层、定时 Codex×Claude 评审器、S2 AiRun 运行时。
3. 在飞的 GitHub kanban：Epic #44（运行时 AI-HARNESS）含 #45/#46/#47，#48/#49（doc-hygiene），Epic #50（group-removal）含 #55 等，PR #56（399 行研究综述 `dev-plans/harness-engineering-paradigm-research.md`）、PR #57（group-removal preflight gate）。
4. 2026 外部实践对标：Red Hat "harness engineering"、`awesome-harness-engineering`、OpenTelemetry GenAI semconv、OWASP Agentic Top-10、OpenAI Agents SDK sandbox、Spec-Driven Development 工具生态。

---

## English abstract

Tanergy already runs two *different* harnesses that are easy to conflate. (A) An **engineering-time harness** that constrains the AI agents (Claude/Codex) *building* the product — today this lives implicitly in `HARNESS.md` + `AGENTS.md` + the `knowledge/` memory layer + a scheduled dual-agent reviewer, but is never named or treated as a first-class system. (B) A **runtime harness** that constrains the AI features running *inside* the product (AiRun) — this is the explicit, in-flight kanban series #44–#47 (`AI-HARNESS.md`). The ChatGPT conversation is ~85% about (A); the in-flight kanban is 100% about (B). They are orthogonal axes. Therefore the ideas in the GPT conversation are **not** covered by #44–#47 and **do** warrant their own Epic. This report maps what already exists, what to adopt, what both the GPT conversation and the current kanban miss (measured against 2026 harness-engineering practice), and proposes a v0-doc-first Epic (`ENG-HARNESS.md`, E0–E6) that hardens the engineering-time harness without blocking the P0 spine.

---

## 0. 背景：为什么有这份报告

Tanergy 是一个 node-based 的 AI 创意工作流画布（web-first）。它的开发本身高度 agent 驱动：大部分 PR 由一个 bot 账号（`Archii-Coder`）发起，由 Codex 和 Claude 多轮对抗评审，人类 owner（`orcastt`）做最终 approve / merge。仓库已经有相当成熟的"文档驱动 harness"：`AGENTS.md`（开发规则 + PR 工作流）、`HARNESS.md`（执行纪律）、folderized 的 PRD/ARCH/project_state/dev-plans、以及一套 Karpathy 式的 `knowledge/` markdown 记忆层。

触发点：一段关于 Karpathy "vibe coding 已被重新定位为 agentic engineering" 的讨论，引出一个问题——**面向企业的 SaaS 是否应该建一套严格的 Agentic Engineering Harness？** 与此同时，仓库里正好有一条在飞的 kanban 系列在做"harness"（#44–#47）。本报告要回答的核心困惑是：

> 我和 GPT 谈的这套 harness，和 kanban 上 #44–#47 在做的 harness，是同一件事吗？缺了什么？该不该单独立一条 issue 系列？

---

## 1. 核心校准：你有两套 harness（严格说三层）

这是整份报告最重要的一句话。"Harness" 这个词在 Tanergy 语境里指向**两个正交的东西**，混为一谈是所有困惑的根源。仓库自己的研究综述（PR #56 §2）其实已经画过这条线（"`AI-HARNESS.md` 是 `HARNESS.md` 的 peer，不是扩展"），但 GPT 对话把它当成一个东西在谈。

| 层 | 是什么 | 被约束的 actor | 仓库载体 | 状态 |
|---|---|---|---|---|
| **A. 工程时 Harness**（GPT 对话谈的主体） | 约束**建造 Tanergy 的 AI agent**（Claude/Codex/bot）的规格、权限、验证、审计、人审 | Claude / Codex / `Archii-Coder` bot | `HARNESS.md` + `AGENTS.md` + `knowledge/` + 定时评审器 | **早期、隐式、未被命名为 "agentic engineering harness"** |
| **B. 运行时 Harness**（#44–#47 在做的） | 约束**产品内部跑的 AI 功能**（AiRun）：run-type / 预算 / validator / fallback / 扣费 / 审计 | `tangent_ai_runs` 执行路径 | 拟建 `AI-HARNESS.md`（#45）；S2 AiRun 已实现 9 不变量中的 7 条 | **在飞，scope 清晰** |
| **C. 产品本身** | group-removal 等业务收敛 | —— | Epic #50 | 与 harness 无关，仅在 migration 顺序上与 #46 有依赖 |

**结论**：GPT 全程在谈 **A**，kanban 在飞的是 **B**。两者不冲突、不重叠、不在同一条轴上。后果是——**A 轴目前在仓库里没有自己的 Epic、没有 roadmap、没有验收门、没有 owner**，它散落在 `HARNESS.md`/`AGENTS.md` 和那个 launchd 评审脚本里。这就是真正的缺口，也是本报告建议补的东西。

---

## 2. 已经建好的部分（避免重复立 issue）

GPT 把"最小可用 agentic harness"列成 5 件事。映射到仓库现状：

| GPT 的建议 | 仓库现状 | 成熟度 |
|---|---|---|
| **Spec Gate**（先规格后代码：Goal/Non-goals/Acceptance/Test plan/Rollback） | `HARNESS.md` 的 DoR/DoD + slice 文档（PRD/ARCH/project_state 分片）+ PR 模板强制 `Closes #N` | 🟡 有，但**没有"每任务一份可执行 spec"格式**，靠人写散文 |
| **Context Pack**（AGENTS/ARCHITECTURE/DOMAIN_RULES/SECURITY_RULES） | `AGENTS.md` + `ARCH/` + `PRD/` + `project_state/` + Karpathy 式 `knowledge/` 记忆层（raw/wiki/decisions/index/schema/log） | 🟢 **强**，比 GPT 建议的还细 |
| **Permission Layer**（default deny + 工具白名单） | `AGENTS.md` hard boundaries + main 分支保护（require PR / 1 approval / `link-issue` check / 非作者审 / dismiss stale / enforce admins）+ "不 push main、不自审自批" | 🟡 有边界，但**粗粒度、靠人审兜底**，无 L0–L4 分级，无工具级 allowlist |
| **Verification Layer**（lint/typecheck/test/security scan/migration dry-run/权限测试/租户隔离测试） | 质量门（lint/typecheck/build/pytest/compileall/git diff --check）+ CI `link-issue` + group-removal 静态 grep gate(#55/#57) + preflight 快照 | 🟡 有通用门，**缺 GPT 正确点名的企业测试**：租户隔离 / RBAC / 计费边界 / 数据删除·导出 / 审计日志回归 |
| **Trace & Audit（agent 行为）** | 定时 Codex×Claude 评审器（`.tangent-review/`，每天 04:00+17:30 AWST）+ PR body 里手写的 "round 1–4 review record" | 🔴 **弱**：无结构化 agent-run trace，无 OTel，审计是散文不是数据 |
| **Dual-agent review**（一个实现一个 red-team） | 已在做：Codex × Claude 多轮对抗（PR #41/#43/#56 都有 "Codex round N" 记录） | 🟢 **强项**，领先多数团队 |
| **Human-in-the-loop** | 非作者 approving review + GitHub UI merge | 🟡 有，但无 HITL 专用界面（diff/risk/approve/rollback），且人审正在变成瓶颈（见 §4.9） |

**要点**：Context Pack 和 Dual-agent review 已经做得好，**不要重复立 issue**。真正要补的是 Permission tiers、企业验证测试、agent trace、evals、威胁模型。

---

## 3. GPT 对话里**对的、可直接采纳**的

- **L0–L4 权限分层**（Research / Draft / Dev Sandbox / Staging / Production，default deny，production 默认禁止）——仓库当前**最缺的脊柱**。现在只有"main 受保护 + 人审"，无按风险分层的执行权限模型。**采纳。**
- **风险分级自动化表**（marketing copy 高自动化 → auth/billing/permissions 低自动化 + 严格审 → production data 默认禁止）。写成可执行策略，**采纳。**
- **"Agentic Product Architect" 自我定位 + 7 杠杆**（少写 boilerplate、多定义边界/规格/验证/信任体验）。作为团队角色文档，**采纳。**
- **业务语义级工具而非裸 SQL**（`getTenantUsage(tenantId)`、`validatePermission()`、`runMigrationDryRun()`）——这正是 2026 的 agent-native interface / MCP 方向，**采纳**（见 §4.10）。
- **把"受治理的 agentic workflow"包装成企业卖点**——marketing 角度对，**采纳。**

GPT 对话给出的端到端流程（Intent → Spec → Agent Plan → Sandboxed Execution → Tests → Review → Audit → Release）方向正确，且与仓库现有 PR 工作流大体一致——它是 A 轴的"目标态"骨架。

---

## 4. GPT 对话**遗漏 / 没说透**的（深度 gap 分析）

GPT 给的是**通用企业 SaaS 安全建议**，正确但泛。对照 2026 年已经固化的 "harness engineering" 实践，它漏掉了下面这些——**而且运行时系列 #44–#47 在工程侧也没覆盖**：

1. **Agent 自身的 Evals / 回归门**。GPT 说"跑测试"，但没提对 agent 本身做 eval：golden task set、deterministic + LLM-judge 混合打分、CI 上 merge-to-main 才跑（控成本）、分数下降时 diff 出回归用例。2026 硬结论：**同样模型权重在不同 harness 里 benchmark 差 10–20 分**——harness 质量本身要被 eval。两边都没有。

2. **Spec 作为可执行契约（SDD）**。GPT 说"先写 spec"，但没点名 2026 已成型的 **Spec-Driven Development** 品类与工具（GitHub Spec Kit / AWS Kiro / OpenSpec / BMAD / Google Antigravity）。仓库 slice 文档是手写散文版 SDD，缺"每任务一份机器可校验 spec"。

3. **确定性权限执行（policy-as-code）**。GPT 的 "default deny" 是**散文**。2026 实践是**策略即代码**：同步拦截工具调用、按声明式策略评估、产出**密码学签名审计记录**（Open Agent Passport 2026-03；Microsoft Agent Governance Toolkit 2026-04；Bedrock AgentCore + Cedar）。口号："deterministic security, not probabilistic"。仓库现在是 probabilistic（靠人审）。

4. **Agent-run 可观测性要有标准**。GPT 说"记录一切"，但没提 **OpenTelemetry GenAI Semantic Conventions**（v1.41, 2026-05；`invoke_agent` / `execute_tool` span）——2026 agent trace 的事实标准。仓库现在 trace = PR body 里手写 "round 1–4"。

5. **OWASP *Agentic* Top-10 威胁模型**。GPT 引了 OWASP **LLM** Top 10 2025，但漏了 2025 底的 **Agentic companion**：memory poisoning、cascading failures，以及 Excessive Agency 拆成的三根因（excessive functionality / permissions / autonomy）。对"要让 agent 动手"的企业 SaaS，这才是该贴墙上的清单。

6. **Agent context 的 prompt-injection / 供应链**。GPT 完全没谈。**这条在真实使用中已发生**：本报告的生成会话里，系统注入过一条"你应该用 Workflow 工具"的伪提醒（不存在该工具，已忽略）。Tanergy 的 harness 会吞 GitHub PR/issue/CI 文本（不可信外部数据），任何能在被 watch 的 PR 上评论的人都能尝试改写 agent 行为。这是工程 harness 必须显式防的面，运行时 harness 不管。

7. **Agent 运行的成本治理**。GPT 谈了产品 credit，没谈 **Claude/Codex 自己跑起来的 token/provider 花费**预算与归因。多 agent 并发开 PR 时是真金白银。

8. **记忆/知识腐化与漂移**——**该失败模式在仓库里已被证实**。PR #56 Appendix A 抓到三个 stale-doc bug（`CLAUDE.md:13` 指向已归档文件；Jiekou vs GeekAI provider 矛盾；Group vs Teams 矛盾），#48/#49 就是在**反应式**补。GPT 的 "Context Pack" 假设上下文是对的，没说怎么**持续保证它对**。需要把 #48/#49 从"人工 sweep"升级成 **CI 守卫**。

9. **人审瓶颈 / 规模化**。GPT 流程末端是"人 review final diff"。但 `Archii-Coder` bot + Codex + Claude 在同时开 PR，**创始人就是瓶颈**（GPT 自己引的 AIDev 研究：agent 提交快、接受率低）。没有"低风险 + 全绿自动 merge"的分流策略，无 triage 机制。

10. **Agent-native 领域接口要落地为 MCP**。GPT 抽象提了 "agent-native infra"，但没说 2026 的具体形态 = **MCP server + 机器可读 schema**。仓库已是 markdown/CLI 友好（好），但没对自己的领域操作（用量、权限校验、migration dry-run）暴露 MCP/工具面——正好接上 §3 的"业务语义工具"。

11. **Agent 身份与归因**。`Archii-Coder`（bot）vs `orcastt`（人）的机器身份、签名动作、可审计性——GPT 没碰（2026 实践是 cryptographic agent identity）。

12. **Agent *动作*的幂等 / 安全重试 / 回滚**。GPT 谈了产品回滚，没谈 agent 操作回滚。仓库的 group-removal 其实工程化得很好（preflight 快照 + forward-only migration + "point of no return" 标注），但这是**个案**，没上升为 doctrine。

13. **DoD 自动化**。GPT 列了验收标准，但没闭环到"机器验证验收标准"。

14. **Agent 闯祸的 incident runbook**。两边都没有。

---

## 5. 当前 GitHub PR / Kanban harness 系列**遗漏**了什么

- **#44–#47（运行时 AI-HARNESS）的 scope 是对的，但显式排除了工程时 agentic**——#44 原话 "Out of scope: Autonomous open-loop agents (BDI / AutoGPT / multi-agent orchestration)"。所以严格说不是"漏"，是**故意只做运行时**。后果就是 §1 说的：**A 轴（工程 harness）没有任何 Epic 拥有它**。
- **即便在运行时系列内部，也有缺口**：
  - 9 条不变量是 budget/validator/fallback/cost/audit，**没有一条是对抗输入防御**（OWASP **LLM01 prompt injection / LLM02 insecure output handling / LLM05**）。AI 功能吞用户图片 + prompt，这块该是不变量却不是。
  - 只有运行时 **graduation 指标**（≥98% validator pass 等），**没有 merge 前的 eval 数据集 / 回归 harness**。
  - 可观测性只是 "`tangent_ai_runs` 上的字段"，**没有 OTel / trace 标准**。
- **#48 / #49（doc-hygiene）本身是好的**，且恰好**证明了 §4.8 的漂移问题真实存在**——但它是反应式打补丁，不是系统化守卫。
- **#50（group-removal）和 harness 无关**，只在 migration 顺序上挡着 #46（#46 要等 group-removal 对 `workspace_kind` 的改动落地）。

---

## 6. 结论 + 建议的独立 Epic

**判断：需要一个独立 Epic。** 开一个新 Epic「**Agentic Engineering Harness（工程时）**」，与 #44（运行时）、#50（产品）平行。它不是从零造——**`HARNESS.md` + `AGENTS.md` 已经是它的 v0**，这个 Epic 是"给它命名、补上 permission 脊柱 + 观测 + evals + 威胁模型 + 企业测试层"。沿用团队在 #44 已验证好的 **v0-doc-only → v1 → v2** 节奏，让 v0 不阻塞 P0 主线。

| 逻辑 | Sub-issue | Scope | 风险 | 依赖 | 对应缺口 |
|---|---|---|---|---|---|
| **E0**（doc-only，1–2d，**不阻塞**，仿 #45） | 写 `ENG-HARNESS.md` | 命名现有工程 harness；定义 **L0–L4 权限分层**；映射现有控制；贴 **OWASP Agentic Top-10** 威胁模型；声明与 `HARNESS.md`/`AI-HARNESS.md` 的三方关系 | Low | 无 | §2 权限、§4.3、§4.5 |
| **E1** | Permission tiers + policy-as-code | 把 allow/deny 按 L0–L4 写成可执行策略；收紧分支保护；探索工具级 allowlist | Med | E0 | §4.3、§4.11 |
| **E2**（最高 ROI） | **企业验证层** | 补 GPT 正确点名、仓库现缺的测试：**租户隔离 / RBAC / 计费边界 / 数据删除·导出 / 审计日志**回归 | Med | 接 `docs/fullstack-security-acceptance-2026-05-20.md` | §2 Verification、§5 |
| **E3** | Agent-run 观测 & trace | 采 **OTel GenAI semconv**；每任务一份结构化 trace（spec→plan→diff→tests→review→verdict），取代 PR body 散文 | Med | E0 | §4.4 |
| **E4** | Agent evals & 回归门 | golden task set；merge-to-main 才跑；harness 漂移检测 | Med | E3 | §4.1 |
| **E5** | Context/记忆完整性 CI | 把 #48/#49 的人工 sweep 升级成 **stale-link / 矛盾检测 CI 守卫** | Low | 含 #48 | §4.8 |
| **E6**（forward） | Agent-native 领域接口 | 给领域操作建 **MCP server / 业务语义工具**（getTenantUsage / validatePermission / runMigrationDryRun） | Med | E0 | §3、§4.10 |

> PR #56 Appendix A 那三个 stale-doc 发现里，#48 已立、Jiekou 是 #49、Group-vs-Teams 由 #50 收。这些可挂在 E5 下做"已知漂移"的回归基线。

**为什么是单独 Epic 而不是塞进 #44**：#44 自己声明 "autonomous/multi-agent OUT of scope"，硬塞会破坏它干净的运行时 scope；且两条轴的 owner、验收门、节奏都不同。保持三份 peer doctrine——`HARNESS.md`（工程过程）/ `ENG-HARNESS.md`（工程 agent 治理）/ `AI-HARNESS.md`（运行时）——是和现有 doc 拓扑最一致的做法。

---

## 7. 落地节奏与"不阻塞 P0"的理由

- **最便宜、最可逆的第一步永远是 E0（doc-only）**：不碰 schema、不碰钱、不碰 P0 主线，与 #45 一个量级。任何时候想动从它起。
- 当前 P0 真相仍是 live image smoke + server-boundary 清理未完。E0 是纯 doctrine，付的是"命名 + code-review 语言"的成本，不强制任何 schema 改动——可立即拿到可执行的 code review（"validator 缺失 → block"这类话术）。
- E1–E6 应排在 P0 spine 更可信之后；E2（企业验证测试）ROI 最高，可优先，因为它直接接现有 `docs/fullstack-security-acceptance` 与 group-removal 的 preflight/gate 思路。
- 最该警惕的两件事都已在仓库里被证实，不是理论：① stale-doc 漂移（PR #56 Appendix A 抓到 3 个）；② prompt-injection 面（生成会话被注入伪指令）。它们是 A 轴存在价值的现成证据。

---

## Sources（2026 外部实践对标）

- Harness engineering: Structured workflows for AI-assisted development — Red Hat Developer (2026-04): https://developers.redhat.com/articles/2026/04/07/harness-engineering-structured-workflows-ai-assisted-development
- awesome-harness-engineering（tools/patterns/evals/memory/MCP/permissions/observability/orchestration）: https://github.com/ai-boost/awesome-harness-engineering
- Semantic Conventions for GenAI agent spans — OpenTelemetry (v1.41, 2026-05): https://opentelemetry.io/docs/specs/semconv/gen-ai/gen-ai-agent-spans/
- OWASP Top 10 for Agentic Applications — Promptfoo: https://www.promptfoo.dev/docs/red-team/owasp-agentic-ai/
- LLM06:2025 Excessive Agency — OWASP Gen AI Security Project: https://genai.owasp.org/llmrisk/llm06-sensitive-information-disclosure/
- OpenAI Agents SDK: Sandbox Execution & Model-Native Harness 2026 — DEV: https://dev.to/rams901/openai-agents-sdk-sandbox-execution-and-model-native-harness-in-2026-37jn
- Your AI Agents Need an Operating System (harness + permission model) — Version 1 / Medium: https://medium.com/version-1/your-ai-agents-need-an-operating-system-harnesses-orchestration-and-the-permission-model-7c1c140590b1
- Spec-Driven Development: The Definitive 2026 Guide — BCMS: https://thebcms.com/blog/spec-driven-development
- AI Agent Eval Frameworks 2026 — DigitalApplied: https://www.digitalapplied.com/blog/ai-agent-eval-frameworks-testing-guide-2026

---

## Appendix A — 输入材料快照（便于外部讨论时无需回溯）

### A.1 GPT 对话要点（Karpathy 框架 + 企业 harness 建议）

- **核心论点**：Karpathy 没说"vibe coding 已死"，而是把它**降级为低门槛原型范式**，把生产级 AI 开发称为 **"agentic engineering"**。属于 "Software 3.0"（用 prompt/context/tools/examples/memory 编程 LLM，context window 成为新程序载体）。
- **范式对比**：Vibe coding = 提高下限（周末项目/Demo）；Agentic engineering = 提高上限并保持质量线（生产系统）。AI 在"可验证"领域进步最快（代码/数学/测试），故 jagged intelligence。
- **风险数据**（GPT 引用）：某 benchmark 200 个真实 feature 任务，某配置 61% 功能正确但仅 10.5% 安全；AIDev 研究分析 456,000+ agent PR，提交快但接受率低（信任/实用缺口）。
- **企业 SaaS 建议**：应建严格 harness，但"像安全带不像铁笼"，**按风险分层**。给出 **L0–L4 权限分层**（Research/Draft/Dev Sandbox/Staging/Production，default deny）。
- **最小可用 harness 5 件套**：Spec Gate（先规格后代码）、Context Pack（AGENTS/ARCH/DOMAIN/SECURITY 等）、Permission Layer（工具白名单、default deny）、Verification Layer（含权限/租户隔离/计费/数据删除/审计测试）、Trace & Audit（task id / prompt / model / tools / files / commands / approvals / diff / risk notes）。
- **创始人 7 角色杠杆**：Architect（定边界）/ PM（写可验证规格）/ UI（设计 HITL 界面：approve/preview/risk/diff/undo/timeline）/ Dev（提供业务语义工具而非裸 SQL）/ Full-stack（打通端到端反馈）/ Marketing（把受治理 agentic 包装成卖点）/ Founder（定速度-风险交换比）。
- **agent-native infrastructure**：未来产品的直接用户是代表人的 agent，需 markdown/CLI/API/MCP/结构化日志/机器可读 schema/可审计动作。
- GPT 引用的标准：OWASP LLM Top 10 2025、NIST GenAI Profile、Anthropic Claude Code 安全文档、OpenAI Agents SDK tracing。

### A.2 仓库现有 harness 清单

- `AGENTS.md` — 产品边界 + 安全规则 + 质量门 + **PR 工作流硬规则**（先开 issue→从 main 拉分支→PR body 含 `Closes #N`→非作者 approving review→GitHub UI merge；AI 不 push main、不自审自批；分支命名 `feat|fix|chore/<n>-<slug>`）。
- `HARNESS.md` — 执行纪律：Read Order、Definition of Ready/Done、Required Gates、Hard Boundaries、Harness Agent Skill Map（PRD/ARCH/Project State/QA/AI Provider/Deploy/Security/Collaboration/Memory Wiki 九类 skill）。
- `knowledge/` — Karpathy 式 markdown 记忆层：`raw/`（原始源注，含 `source_karpathy_llm_wiki_2026-05-21.md`）、`wiki/`（含 `agent_harness_and_skills.md`、`pr_workflow_handoff.md` 等）、`decisions/log.md`、`index.md`/`schema.md`/`log.md`。
- 质量门：`npm -C apps/web run lint|typecheck|build` + `PYTHONPATH=services/api pytest` + `compileall` + `git diff --check`。
- CI：`pr-checks.yml` 的 `link-issue` job（PR body 必须引 issue）；`static-gate-group-removal.yml`（#55/#57）。main 分支保护：require PR / 1 approval / link-issue check / dismiss stale / enforce admins。
- 定时评审：`.tangent-review/` launchd job，每天 04:00 + 17:30 AWST 跑 Codex×Claude PR 评审，写 per-PR state。
- 运行时：S2 AiRun 已是事实上的 harness（见 A.4）。

### A.3 在飞 kanban 一览（截至 2026-05-29）

| # | 标题 | 类型 | 状态 |
|---|---|---|---|
| #44 | [Epic] Adopt Harness Engineering doctrine for AI-runtime work | 运行时 Epic | open |
| #45 | [1] Write `AI-HARNESS.md` v0 doctrine（doc-only，未阻塞） | 运行时 | open |
| #46 | [2] Add `harness_key` / `validator_key` / `fallback_policy` to `tangent_ai_runs` | 运行时 schema | open（blocked by group-removal + #45） |
| #47 | [3] Validator-as-LLM-call infra + credit settlement boundary shift | 运行时 infra | open（blocked by #46；最大、最高风险，碰真金白银） |
| #48 | [doc-hygiene] dev-plan pointer convention sweep | hygiene | open |
| #49 | [doc-hygiene] Jiekou→GeekAI refs audit（~16 文件） | hygiene | open |
| #50 | [Epic] 硬删 Group/Collaborate → Solo+Team+Enterprise | 产品 Epic | open |
| #55 | [1] Group-removal preflight script + 静态 grep gate | 产品 | open（PR #57） |
| PR #56 | docs: harness engineering paradigm research synthesis（`dev-plans/harness-engineering-paradigm-research.md`，399 行） | 运行时研究 | open |
| PR #57 | group-removal [1] preflight + static gate（warn-only CI） | 产品 | open |
| PR #43 | credit system setup & acceptance（#3） | 产品 | open |

### A.4 运行时 9 不变量（来自 #44 / PR #56，S2 AiRun "7 已实现 + 2 新增"）

1. registered run_type ✅
2. input budget（8 assets / 30MB / 24MP）✅
3. output budget（240s timeout）✅
4. latency budget ✅
5. **validator（NEW）**
6. **fallback policy（NEW）**
7. audit log（AiRunRecord）✅
8. board-safe persistence（board_guard）✅
9. cost preflight ✅

新增三字段：`harness_key`（prototype / single_call / pipeline / parallel_fan_out / adversarial_validator / self_healing）、`validator_key`、`fallback_policy`（retry / degrade / surface_error）。
四种 orchestration 模式：single-call / pipeline / parallel-fan-out / adversarial-validator / self-healing。**显式排除**：autonomous open-loop agents（BDI / AutoGPT / multi-agent）。

---

*报告完。本文件是分析草稿，未对应任何已落地的代码或 issue；落地节奏见 §6/§7。*
