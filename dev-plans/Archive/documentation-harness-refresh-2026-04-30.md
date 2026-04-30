# Documentation Harness Refresh — 2026-04-30

## Goal

把用户提供的 12 类产品/架构/测试/运营范例，收敛成适合 TANGENT 当前阶段的文档索引、执行规范和未来开发计划。

## Scope

- 补充 `PRD.md` 的产品验证、MoSCoW、用户故事和 Alpha 指标。
- 补充 `ARCH.md` 的架构覆盖映射和 Harness 文档入口。
- 扩展 `README.md`，让新接手 AI/开发者能快速进入项目。
- 新增根目录 `HARNESS.md`，作为跨功能开发索引、代码规范和验收标准。
- 新增 P0 开发 Harness 路线图，明确未来切片顺序和验收门。
- 补充 `ARCH.md` 的 1K / 10K / 100K 用户扩展容量路线。
- 在 `HARNESS.md` 标记当前接近 300 行的源码文件观察表。
- 更新 `project_state.md`。

## Non-goals

- 不编造竞争对手评分、收入或市场数据；这些必须单独开 sourced market research。
- 不实现新业务功能。
- 不改 legacy archive。
- 不调整当前 S1.5 代码实现。

## Acceptance

1. 新接手 AI 只读 `README.md` / `HARNESS.md` / `project_state.md` 就能知道从哪里开始。
2. PRD 覆盖问题、用户、价值、优先级、用户故事、成功指标、MVP/V2 边界。
3. ARCH 覆盖技术架构、数据/API、安全、扩展、运维和功能 Harness 映射。
4. 每个未来功能域都有对应的 dev-plan / PRD / ARCH 入口。
5. 文档明确禁止无来源市场数字和 API Key 泄露。
6. 接班 AI 能看到哪些源码文件接近 300 行，并在继续加功能前先拆分。
