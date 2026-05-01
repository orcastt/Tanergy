# TANGENT Fresh Development Rules

本文件适用于当前新项目根目录。旧代码已隔离在 `legacy/old-tangent-desktop-2026-04-29/`，除非用户明确要求恢复或参考，否则不要读取、修改、构建或测试 legacy 目录。

## 当前产品口径

- Web-first AI image canvas，不做桌面客户端 P0。
- P0 只打通最小图像链路：`Prompt Node → Image Gen / Image Gen 4 → Image Node`、`Image + Prompt → Image Gen / Analysis`、`Canvas Markup → Merge Capture → New Image Node`。
- AI Chat 自动创建节点和连线保留为降低门槛入口。
- 多人协作后移到 P0.5。
- S1.5 复杂节点、Asset LOD Slice A-D 和 Slice E 的本地 Asset / Board persistence 基线已通过。
- 当前 Slice E 已完成：Next local Asset / Board bridge、request context、Board save guard、FastAPI local-dev、真实 `s3-compatible` Asset adapter、Postgres Board / Asset metadata persistence、Web-to-FastAPI switch、staging API package、`/boards` Dashboard / Board entry shell。
- 当前接手点：按 `ARCH.md` 11.5-11.7 的 0-to-1 路线推进真实 staging 基础设施、部署流水线、Auth / Board CRUD 产品化，再接 Model Registry / AI Proxy / AI Run。
- 不做公众号 Html Editor、Writer、Personal Library、Knowledge Graph、复杂 Admin Analytics。
- 前端视觉保持干净白板、小卡片、轻边框，不大换皮。

## 工作循环

每次非简单改动按顺序推进：

1. 先读 `project_state.md`、`PRD.md`、`ARCH.md`、`HARNESS.md`、`dev-plans/README.md` 和相关 active slice plan。
2. 新功能、跨文件改动、阶段切换或外部资源接入先更新 `dev-plans/` 或确认 `ARCH.md` 11.5-11.7 / `PRD.md` 当前状态已覆盖。
3. 只实现当前切片，不顺手重构无关逻辑。
4. 源码单文件目标不超过 300 行；250 行开始预警，超过 300 行先拆模块再继续加功能。
5. UI 改动遵守 `reference/Design.md`；当前 Product Shell 不再引用旧 `reference/design-system.md` / `reference/theme.ts`。
6. 用户可见文案走 i18n；默认英文，中文环境不混杂英文业务文案。
7. API Key 只在服务端环境变量，绝不进入前端代码。
8. Board document / node props / 协作文档不得保存 `data:`、`blob:`、Base64 图片、Provider 原始响应、完整日志或长文本结果。
9. 完成后更新 `project_state.md`、`dev-plans/README.md` 和对应计划。

## 质量闸门

新 Web app scaffold 已完成。前端改动至少运行：

- `npm -C apps/web run build`
- `npm -C apps/web run lint`
- `npm -C apps/web run typecheck`
- `git diff --check`

后端/API 改动至少运行：

- `PYTHONPATH=services/api python3 -m pytest services/api/tests`
- `python3 -m compileall services/api/tangent_api`
- `git diff --check`

部署 / staging 改动还要按 `deploy/staging/README.md` 做最小 smoke，尤其是 `/health`、CORS、Asset upload/read、Board save/load 和 guard 422。纯文档改动可只跑 `git diff --check`，但最终回复要说明没有跑代码测试。

## Git

- 不主动 commit、push、新建分支，除非用户明确要求。
- 用户要求提交前，先检查 `git status`，确认变更范围。
- 阶段性开发动作、大范围修复或高风险重构开始前，先创建/切换工作分支并提交当前稳定快照，再继续修复。
- 提交后再继续开发时，保持改动小步可回滚；每个大阶段完成后再次检查是否需要 checkpoint commit。
- 不直接在服务器上手改代码；默认路径是本地改动 → commit → push → staging deploy → smoke → production promote。
