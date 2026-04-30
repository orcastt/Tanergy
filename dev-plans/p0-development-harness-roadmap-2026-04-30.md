# P0 Development Harness Roadmap — 2026-04-30

## Goal

把 TANGENT P0 Alpha 后续开发拆成可交接、可验收、可回滚的 Harness 切片。

## Current Gate

S1.5 和 Asset LOD Slice A-D 已通过。Slice D 跨平台 Canvas 性能门按 `pass with notes` 收口；Windows 密集画布卡顿记录为 non-blocking performance follow-up。

当前进入 Slice E Real Asset Pipeline。Slice E-A 已落本地 server-backed Asset 合同；Slice E-C 正在建立 Board save guard、local save 和 local restore 支架，先挡住 `data:` / `blob:` 和 base64 payload；`CanvasRuntimeDiagnostics` 已默认关闭，仅 `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1` 启用；Cloudflare Tunnel allowlist 仅通过 `NEXT_ALLOWED_DEV_ORIGINS` 临时注入，不能成为产品部署路径。

## Slice Order

| Slice | Goal | Main Docs | Done Means |
|-------|------|-----------|------------|
| S1.5-A Canvas polish freeze | 只修阻塞级画布交互 | `PRD.md` F03/F03.5, `ARCH.md` 9.2 | 坐标、吸附、设置、导航、工具栏不阻塞节点开发 |
| S1.5-B Node runtime data | 验证 text/image mock 数据流 | `dev-plans/Archive/node-runtime-data-transfer-slice-2026-04-30.md` | mock Run、fan-out、Gen4 四输出、删线同步通过；切片已归档 |
| S1.5-C Payload/perf gate | 验证轻量 props 和压力 | `HARNESS.md` QA Harness | 50-100 节点和多图画布可用；Windows 遗留卡顿为 non-blocking follow-up |
| S1.5-D Asset LOD + cross-platform | Image / Node / ordinary canvas image LOD，跨平台质量门 | `dev-plans/Asset-lod-roadmap.md`, `dev-plans/cross-platform-canvas-performance-test-2026-04-30.md` | Slice D pass with notes；diagnostics 默认关闭；quick tunnel 不进入产品部署路径 |
| S1.5-E Real Asset Pipeline | 真实上传、对象存储、多尺寸缩略图、Asset metadata | `dev-plans/Asset-lod-roadmap.md`, `ARCH.md` 4.7 / 8.3 | E-A local API bridge 已落；E-C save guard + local save/restore 已开始；最终 Done 是 Board document 不持久化 `data:` / `blob:`，图片可刷新恢复 |
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
