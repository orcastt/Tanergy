# TANGENT Fresh Development Rules

本文件适用于当前新项目根目录。旧代码已隔离在 `legacy/old-tangent-desktop-2026-04-29/`，除非用户明确要求恢复或参考，否则不要读取、修改、构建或测试 legacy 目录。

## 当前产品口径

- Web-first AI image canvas，不做桌面客户端 P0。
- P0 只打通最小图像链路：`Prompt Node → Image Gen / Image Gen 4 → Image Node`、`Image + Prompt → Image Gen / Analysis`、`Canvas Markup → Merge Capture → New Image Node`。
- AI Chat 自动创建节点和连线保留为降低门槛入口。
- 多人协作后移到 P0.5。
- S1.5 复杂节点与 Asset LOD Slice A-D 已通过；当前主线是 Slice E Real Asset Pipeline。
- Slice E 当前重点：Asset API request context / storage adapter、Board save guard、local save/restore、后续 FastAPI + R2/S3 adapter。
- 不做公众号 Html Editor、Writer、Personal Library、Knowledge Graph、复杂 Admin Analytics。
- 前端视觉保持干净白板、小卡片、轻边框，不大换皮。

## 工作循环

每次非简单改动按顺序推进：

1. 先读 `project_state.md`、`PRD.md`、`ARCH.md`、`HARNESS.md`、`dev-plans/README.md` 和相关 active slice plan。
2. 新功能或跨文件改动先更新 `dev-plans/`。
3. 只实现当前切片，不顺手重构无关逻辑。
4. 源码单文件目标不超过 300 行；250 行开始预警，超过 300 行先拆模块再继续加功能。
5. UI 改动遵守 `reference/design-system.md` 和 `reference/theme.ts`。
6. 用户可见文案走 i18n；默认英文，中文环境不混杂英文业务文案。
7. API Key 只在服务端环境变量，绝不进入前端代码。
8. 完成后更新 `project_state.md`、`dev-plans/README.md` 和对应计划。

## 质量闸门

新 Web app scaffold 已完成。前端改动至少运行：

- `npm -C apps/web run build`
- `npm -C apps/web run lint`
- `npm -C apps/web run typecheck`
- `git diff --check`

后端/API 改动运行对应测试或最小 API 检查。

## Git

- 不主动 commit、push、新建分支，除非用户明确要求。
- 用户要求提交前，先检查 `git status`，确认变更范围。
- 阶段性开发动作、大范围修复或高风险重构开始前，先创建/切换工作分支并提交当前稳定快照，再继续修复。
- 提交后再继续开发时，保持改动小步可回滚；每个大阶段完成后再次检查是否需要 checkpoint commit。
