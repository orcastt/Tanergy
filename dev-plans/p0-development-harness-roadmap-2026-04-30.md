# P0 Development Harness Roadmap — 2026-04-30

## Goal

把 TANGENT P0 Alpha 后续开发拆成可交接、可验收、可回滚的 Harness 切片。

## Current Gate

S1.5 仍是当前 blocker。未完成以下复测前，不进入真实 AI API：

- Canvas Settings / Snap Alignment 手测。
- Node Runtime data flow 手测。
- 50-100 节点压力测试。
- 外部图片 5-10 张粘贴/导入压力测试。
- Merge Capture 纯净导出验证。

## Slice Order

| Slice | Goal | Main Docs | Done Means |
|-------|------|-----------|------------|
| S1.5-A Canvas polish freeze | 只修阻塞级画布交互 | `PRD.md` F03/F03.5, `ARCH.md` 9.2 | 坐标、吸附、设置、导航、工具栏不阻塞节点开发 |
| S1.5-B Node runtime data | 验证 text/image mock 数据流 | `dev-plans/node-runtime-data-transfer-slice-2026-04-30.md` | mock Run、fan-out、Gen4 四输出、删线同步通过 |
| S1.5-C Payload/perf gate | 验证轻量 props 和压力 | `HARNESS.md` QA Harness | 50-100 节点无明显卡顿，document payload 可控 |
| S2 Model Registry mock | 前端统一模型能力来源 | `ARCH.md` 4.10 / 8.4 | 节点和 AI Chat 不再硬编码模型参数 |
| S3 Backend AI Runs skeleton | 后端 run API 和日志骨架 | `ARCH.md` 8.5 / 10.4 | 不暴露 key，有结构化 run/status/error |
| S4 Real Image Gen | 接真实单图/四图生成 | `PRD.md` F12/F13/F15 | 低成本参数、日志、失败状态和限流跑通 |
| S5 Asset/Image Node loop | 生成结果变 Asset 和 Image Node | `PRD.md` F08, `ARCH.md` 4.7 | 不持久化 blob/data URL，节点只存 asset id |
| S6 Analysis loop | Image + Prompt → text output | `PRD.md` F07 | Analysis 输出可接 Prompt / Image Gen |
| S7 Markup/Merge Capture | 画布标注合并成新图 | `PRD.md` F09/F10 | 离屏导出不截 UI/网格/选框 |
| S8 AI Chat graph builder | 右侧自然语言自动搭链 | `PRD.md` F11 | 生成合法 graph spec，用户确认后应用 |
| S9 Board save/auth close | 登录、Board 保存、恢复 | `PRD.md` F01/F02 | 刷新后 Board document 可恢复 |
| S10 Alpha QA/deploy | 质量、部署、监控最小闭环 | `HARNESS.md` Ops/QA | build/lint/typecheck/手测清单全绿 |

## Per-slice Harness Template

每个新切片先创建或更新对应 `dev-plans/<slice>-YYYY-MM-DD.md`：

```md
# <Slice Name>

## Goal
## Scope
## Non-goals
## Files / Modules
## Data Model Impact
## Security / Cost Impact
## Acceptance
## Manual Test
## Rollback Notes
```

## Handoff Standard

- 开始前：读 `project_state.md`、`PRD.md`、`ARCH.md`、`HARNESS.md` 和当前 slice plan。
- 写代码前：确认是否需要 checkpoint commit；大改前必须先稳定快照。
- 过程中：触碰源码 250 行预警，300 行禁止继续加功能。
- 完成后：更新 slice plan 和 `project_state.md`，跑质量闸门。
- 交接时：说明改了哪些文件、哪些命令通过、哪些手测还没做。
