# TANGENT Development Harness Index

本文件是新接手 AI / 开发者的“执行索引”。它把产品、架构、设计、认证、支付、实时、数据库、发布、测试、管理后台、AI 和运维 12 类工作流映射到当前 TANGENT 项目。

Canonical docs 仍然是：

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `dev-plans/README.md`
5. 当前 slice plan

`HARNESS.md` 只回答：**做某一类功能时，先读哪里、边界是什么、怎么验收。**

---

## 1. Global Rules

- P0 是 Web-first AI image canvas，不做桌面端。
- S1.5 和 Asset LOD Slice A-D 已通过；当前 blocker 是 Slice E Real Asset Pipeline，把图片和 Board persistence 边界做成可保存、可迁移、可接对象存储的形状。
- 不读不改 `legacy/old-tangent-desktop-2026-04-29/`，除非用户明确要求。
- 不读取 `.env`，不把 API Key 写入前端或日志。
- 源码文件 250 行预警，300 行上限；超过前先拆分。
- 每个非简单功能先更新或创建 `dev-plans/`。
- 每个切片只做当前目标，不顺手扩展未来功能。
- 外部市场评分、收入、竞品数据必须联网查证并标注来源；不能凭空写入 PRD。

---

## 2. Definition Of Ready

开工前必须满足：

- 已读 `project_state.md`，知道当前阶段和下一步。
- 已读相关 PRD 功能完成定义。
- 已读相关 ARCH 模块边界和安全规范。
- 已确认本切片 Scope / Non-goals / Acceptance。
- 大范围修复或高风险重构前已按用户要求 checkpoint commit。

---

## 3. Definition Of Done

完成时必须满足：

- 用户可见行为满足 PRD 验收。
- 代码符合 ARCH 分层，重型数据不进节点 props / document state。
- 触碰源码文件未超过 300 行。
- `project_state.md` 和对应 `dev-plans/` 已更新。
- 前端改动至少通过：
  - `npm -C apps/web run lint`
  - `npm -C apps/web run typecheck`
  - `npm -C apps/web run build`
  - `git diff --check`
- 未验证的手测项必须在最终回复中明确列出。

---

## 4. Workstream Harnesses

| # | Harness | 当前阶段 | Canonical Docs | P0 重点 |
|---|---------|----------|----------------|---------|
| 1 | Product / PRD | Active | `PRD.md` | 问题、用户、五类节点、MoSCoW、用户故事、验收 |
| 2 | Full-stack Architecture | Active | `ARCH.md` | Next.js + tldraw + Node Runtime + Asset API seam + future FastAPI boundary |
| 3 | UI / UX Design System | Active | `reference/design-system.md`, `reference/theme.ts`, PRD F03 | 白板、顶部工具栏、左侧 Inspector、右侧 AI Chat |
| 4 | Auth / User Management | Later P0 | PRD F01, ARCH 1.3 / 8.1 / 10.2 | 登录、JWT/session、Board 权限 |
| 5 | Payment / Credits | P1 | ARCH 1.4, cost plan | P0 只记录成本和限额，不做完整付费 |
| 6 | Realtime / Collaboration | P0.5 | ARCH 7.1.1 | Presence / 协作文档 / 服务端权威分层 |
| 7 | Database / API | Active | ARCH 5 / 8, `dev-plans/Asset-lod-roadmap.md` | Assets、Board save guard、future Boards/AiRuns/Model Registry |
| 8 | Launch / Growth | P1 | cost plan, future launch plan | Alpha 手测、海外部署、社媒增长后置 |
| 9 | QA / Test Suite | Active | PRD 9, ARCH 11.3 | 坐标、节点、数据流、图片压力、质量闸门 |
| 10 | Admin / Analytics | P1/P2 | PRD 不做什么, ARCH 1.12 | P0 不做复杂 Admin；只保留 API logs |
| 11 | AI Integration | Later P0 | ARCH 4.6 / 8.4 / 8.5 | Model Registry、AI Runs、成本、结构化错误 |
| 12 | Deploy / Monitor / Recovery | Later P0 | ARCH 11 | local/staging/prod、日志、回滚、备份 |

---

## 5. Feature Harness Rules

### Product Harness

适用：改 PRD、改用户流程、改功能优先级。

- 必须说明 Problem / User / Value / Scope / Non-goals。
- MoSCoW 改动必须同步到 PRD 功能列表。
- 新用户故事必须能落到一个功能编号。
- 成功指标先用 Alpha 假设；市场数字必须 sourced。

### Architecture Harness

适用：改技术栈、数据模型、API、状态分层、部署。

- 必须说明客户端 vs 服务端边界。
- 必须说明数据归属、持久化位置和权限校验。
- 不能让前端保存 Provider Key。
- 不能把 `blob:` / `data:` / Base64 / Provider 原始响应写入持久化 document。

### UI / UX Harness

适用：画布、工具栏、设置面板、Inspector、AI Chat。

- UI 默认 English-first；中文开发备注不能混进正式业务文案。
- 白板体验优先，不把产品改成纯工作流编辑器。
- 右侧保留给 AI Chat；属性和节点 Inspector 放左侧。
- 小 UI 可以后置；阻塞级问题优先：坐标、连线、性能、误触。

### Node Runtime Harness

适用：Prompt / Image Gen / Image Gen 4 / Analysis / Image。

- 节点卡片只展示摘要和高频操作。
- 复杂参数进入 Inspector。
- Output 允许 fan-out；input 默认单来源；多 image input 用动态端口扩展。
- `Image Gen 4` 四个输出端口分别传 asset 1-4。
- text 端口/线黄色，image 端口/线绿色。

### AI Integration Harness

适用：Model Registry、AI Runs、Analysis、AI Chat Planner。

- 前端只传 `selected_model_id`，后端按 Model Registry 二次校验。
- 真实 Provider 参数和费用只在后端处理。
- Run 必须有 status、latency、cost、error_code、retryable。
- 余额不足、模型不可用、内容违规都返回结构化错误。

### QA Harness

适用：任何可手测切片。

- 从最小路径开始测，再测错误/删除/刷新/缩放。
- Canvas 必测 50% / 100% / 200%、resize、Retina、高 DPI。
- 节点必测连接、删除、移动、fan-out、非法类型、Run disabled。
- 图片必测 MIME、大小、长边、5-10 张导入压力。
- Merge 必测“不截 UI、网格、选择框”。

### Ops Harness

适用：部署、监控、事故恢复。

- local / staging / production 分环境。
- `.env.example` 只写变量名，不写真实值。
- PostgreSQL 需要备份；对象存储需要保留和删除路径。
- AI 成本必须有限流和熔断开关。

---

## 6. Current Priority

当前只允许围绕 Slice E Real Asset Pipeline 做收口：

1. 完成 E-B request context + storage adapter seam 的本地手测和提交。
2. 继续把本地 Asset API 合同迁移到带真实 Auth / Workspace 校验的 FastAPI + R2/S3 adapter。
3. 保持 Board document save guard：任何持久化路径都不能写入 `data:` / `blob:` / Base64 图片 payload。
4. 验证 refresh / local load 后图片、节点、runtime edges 和 camera 能恢复。
5. Asset 边界稳定后，再进入 Model Registry、AI Runs、真实 Image Gen、Dashboard / Board persistence。

---

## 7. Handoff Prompt

新对话建议直接粘贴：

```text
先读项目根目录的 project_state.md、PRD.md、ARCH.md、HARNESS.md 和 dev-plans/README.md，再读当前 active slice plan。不要读 legacy，不要读 .env。然后继续做「具体任务」。
```

---

## 8. Source Size Watchlist

这些源码文件已接近 300 行。后续如果继续触碰，优先拆分，不要直接继续堆功能：

| File | Current Risk | Next Split Direction |
|------|--------------|----------------------|
| `apps/web/src/components/canvas/CanvasSpikeStylePanel.tsx` | 约 290 行 | 拆 style section / control group |
| `apps/web/src/components/canvas/CanvasSpikeToolbar.tsx` | 约 290 行 | 拆 toolbar category / popover |
| `apps/web/src/app/styles/canvas-overlays.css` | 约 290 行 | 拆 connection / selection / minimap overlay CSS |
| `apps/web/src/app/styles/node-card-content.css` | 约 298 行 | 再改节点内容样式前拆 prompt / image / port CSS |
| `apps/web/src/features/assets/assetPreviewResolver.ts` | 约 266 行 | 新增 resolver 行为前拆 persisted thumbnail / local cache helper |
| `apps/web/src/app/styles/canvas-settings.css` | 约 250 行 | 新增设置样式前拆 section CSS |
| `apps/web/src/components/canvas/CanvasSettingsPanel.tsx` | 约 250 行 | 新增设置项前拆 setting row / section component |

规则：

- 250 行是预警，不阻塞小修。
- 300 行是硬线；超过前必须拆。
- 新功能优先创建小文件，不在 spike 容器里继续膨胀。
