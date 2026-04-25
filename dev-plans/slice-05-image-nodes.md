# Slice 5: Outline Split 编排（替代原 gate · writer · reviewer 主链路）

**优先级**: P0 | **难度**: 高 | **预计**: 3 天 | **状态**: ✅ 已完成（架构重构）
**依赖**: Slice 4 | **返回索引**: [phase1-mvp.md](phase1-mvp.md)

> 2026-04-25 对齐：Split 后默认接 `html_formatter` / Html Editor，不再自动要求 `preview_wechat`。

---

## 目标

将公众号中段流程从“Gate 暂停 + Writer/Reviewer 串行”重构为“Outline Split 自动编排”。

核心收益：
- 去除人工暂停依赖，提升可执行性。
- 章节化文本结构天然匹配 HTML 拼装。
- 为 Agent 自动搭图和 Html Editor 留出清晰扩展点。

---

## 实际交付

### 1. Outline 输出结构化增强

`outline_generator` 统一输出：
- `sections[]`：章节数组
- `image_plans[]`：图片计划数组
- `options[]` / `raw`：兼容字段

### 2. Split 自动搭图能力落地

**文件**：`frontend/src/store/canvasActions.ts`

落地行为：
- 基于 `sections[]` 自动创建 N 个 `text_input` 节点。
- 生成章节连线：`outline.section_i -> text_input[i].in`。
- 若存在 `image_plans[]`，自动创建 `image_list` 并连线。
- 自动创建或复用 `html_formatter`，将每个章节映射到 `text_i` 输入。
- 自动确保后续可进入 `html_formatter` / Html Editor。

### 3. 画布状态联动

**文件**：
- `frontend/src/store/canvasStore.ts`
- `frontend/src/nodes/OutlineGeneratorNode.tsx`

关键实现：
- `splitOutline(...)` 动作接入 store。
- Outline 完成后支持自动/手动触发 Split。
- 重新执行 Outline 时，支持重建 Split 结果。

---

## 当前节点策略（Slice 5 校准结论）

公众号默认路径中，以下节点不再作为必需节点：
- `gate`
- `writer`
- `reviewer`

说明：
- 以上节点作为 legacy 能力可保留兼容执行，但不进入公众号主模板。
- Agent 默认不应再自动创建这些节点。

---

## 验收清单

- [x] Outline 结果可一键拆分为章节节点。
- [x] 拆分后每个章节文本能正确流向 `html_formatter`。
- [x] `image_plans` 可自动挂接到 `image_list`。
- [x] 公众号模板无 Gate/Writer 依赖。
- [x] 拆分行为在重复执行下表现稳定。

---

## 与原计划差异

原计划定义为：`gate -> writer -> reviewer`。
实际落地为：`outline_generator -> split -> section text_input + image_list -> html_formatter`。

该差异为架构级优化，不是功能缺失。

---

## 后续维护

- 若后续需要“人工确认步骤”，优先采用节点内轻交互，不再恢复全局 Gate 暂停机制。
- 若需要增强长文润色，建议以 Html Editor 的 AI Rewrite 子能力实现，而非恢复 Writer/Reviewer 主链路。
