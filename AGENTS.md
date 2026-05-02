# TANGENT Fresh Development Rules

本文件适用于当前新项目根目录。旧代码已隔离在 `legacy/old-tangent-desktop-2026-04-29/`，除非用户明确要求恢复或参考，否则不要读取、修改、构建或测试 legacy 目录。

## 当前产品口径

- Web-first AI image canvas，不做桌面客户端 P0。
- P0 只打通最小图像链路：`Prompt Node → Image Gen / Image Gen 4 → Image Node`、`Image + Prompt → Image Gen / Analysis`、`Canvas Markup → Merge Capture → New Image Node`。
- AI Chat 自动创建节点和连线保留为降低门槛入口。
- 后续新增 AI 节点、AI Chat bot 或新模型能力，必须遵守 `ARCH.md` 4.4.1 AI Node Extension Contract：先扩展 Node Registry / Model Registry / AiRun 合同，节点 UI 不直接调用 Provider。
- 多人协作后移到 P0.5。
- S1.5 复杂节点、Asset LOD Slice A-D 和 Slice E 的本地 Asset / Board persistence 基线已通过。
- 当前 Slice E 已完成：Next local Asset / Board bridge、request context、Board save guard、FastAPI local-dev、真实 `s3-compatible` Asset adapter、Postgres Board / Asset metadata persistence、Alembic P0 migration scaffold、Board History first pass、captured Board thumbnail first pass、per-board Canvas Settings、Smart Drawing first pass、Web-to-FastAPI switch、staging API package、`/workspaces` Board gallery/list entry shell、expanded Board management metadata first pass、Auth scaffold first pass、AI contract scaffold first pass。
- 当前 Product Shell 顶部导航固定为 `Landing page / Workspace / Collection / Team / Subscription`；Landing page 只在顶部导航出现，不进入侧栏；Account 和 Settings 保留在侧栏。`/home`、`/collections`、`/team`、`/billing` 都是语义清晰的本地壳，不假装真实素材库、团队权限或订阅计费已完成。
- 当前接手点：按 `ARCH.md` 11.5-11.7 的 0-to-1 路线推进真实 staging 基础设施、部署流水线、真实 Auth / Board CRUD 产品化；本地可继续做 Board autosave / History browser regression、manual/History thumbnail polish、Smart Drawing 浏览器调参或真实 AI Provider 前的 polish。Board management Panel 已有 settings-like metadata/member scaffold first pass、owner/admin edit guard 和 thumbnail remove-to-default，Canvas Settings 已有 per-board first pass，captured Board thumbnail 和 Smart Drawing 已有 first pass，真实 share/member permission 仍等 Auth/collab。
- 不做公众号 Html Editor、Writer、Personal Library、Knowledge Graph、完整 Mixpanel 级 Admin Analytics。允许按 `ARCH.md` 4.11 做 Admin S0 schema/access/audit 边界规划或最小用户管理 MVP，但真实 Auth 前不得开放生产 `/admin`。
- 前端视觉保持干净白板、小卡片、轻边框，不大换皮。

## 工作循环

每次非简单改动按顺序推进：

1. 先判断本次属于 `Fast UI polish` 还是 `Architecture slice`。
2. `Fast UI polish` 只改本地 UI、布局、响应式、文案状态、菜单/图标行为或浏览器 smoke follow-up 时，先读 `Project_state/current-slice.md`、必要时读 `Project_state/00-current-progress.md`、`ARCH/README.md`、相关 `ARCH/Slice-*.md` 和 active dev-plan；完成后通常只更新 `Project_state/current-slice.md`、必要时更新 `Project_state/00-current-progress.md`、active dev-plan 或相关 slice index。
3. `Architecture slice` 涉及数据模型、API、权限、Auth、AI、Admin、Billing、Deploy、协作、外部资源或长期产品边界时，仍按完整顺序读 `project_state.md`、`PRD.md`、`ARCH.md`、`HARNESS.md`、`dev-plans/README.md` 和相关 active slice plan。
4. 新功能、跨文件改动、阶段切换或外部资源接入先更新 `dev-plans/` 或确认 `ARCH.md` 11.5-11.7 / `PRD.md` 当前状态已覆盖。
5. 只实现当前切片，不顺手重构无关逻辑。
6. 源码单文件目标不超过 300 行；250 行开始预警，超过 300 行先拆模块再继续加功能。
7. UI 改动遵守 `reference/Design.md`；页面级 Stitch 参考看 `reference/Design_reference.md`；当前 Product Shell 不再引用旧 `reference/design-system.md` / `reference/theme.ts`。
8. 用户可见文案走 i18n；默认英文，中文环境不混杂英文业务文案。
9. API Key 只在服务端环境变量，绝不进入前端代码。
10. Board document / Board History document / node props / 协作文档不得保存 `data:`、`blob:`、Base64 图片、Provider 原始响应、完整日志或长文本结果。
11. 新增 AI 节点时同步检查 Node type、Node Registry、Node card self-contained controls、node data flow、`features/ai` run types、Next/FastAPI AI route、tests 和 Board guard；P0 不再显示独立 Node Inspector。
12. Admin 权限必须服务端校验 `admin_roles`，不能信任前端 role；所有后台写操作必须设计审计日志。
13. 完成后按切片类型更新文档：fast polish 更新短上下文；architecture slice 更新 canonical 根文档和相关索引。

## 上下文加速规则

- 根目录 `ARCH.md`、`PRD.md`、`project_state.md` 和 `HARNESS.md` 仍是 canonical truth。
- `ARCH/` 是架构短索引，每个主题或切片一个文件；优先读 `ARCH/README.md` 再打开相关 slice；`ARCH/00-current-map.md` 和 `ARCH/05-data-model-and-api.md` 分别承接根 `ARCH.md` 的总图/路线与数据/API 总览。
- `Project_state/` 是短状态和交接层；优先读 `Project_state/current-slice.md` 获取当前关键文件、下一步和测试命令；需要 broader state 时读 `Project_state/00-current-progress.md`。
- `ARCH.md` 只保留稳定架构、总图、关键进度和不可破坏规则；易变 UI 验收项、手测清单、当前文件列表放到 `Project_state/current-slice.md` 或 active dev-plan。
- 每 1-2 个小功能尽量 checkpoint commit，保持 diff 小而可回滚。

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

部署 / staging 改动还要按 `deploy/staging/README.md` 做最小 smoke，尤其是 `/health`、CORS、Asset upload/read、Board save/load、Board history create/list/load 和 guard 422。纯文档改动可只跑 `git diff --check`，但最终回复要说明没有跑代码测试。

## Git

- 不主动 commit、push、新建分支，除非用户明确要求。
- 用户要求提交前，先检查 `git status`，确认变更范围。
- 阶段性开发动作、大范围修复或高风险重构开始前，先创建/切换工作分支并提交当前稳定快照，再继续修复。
- 提交后再继续开发时，保持改动小步可回滚；每个大阶段完成后再次检查是否需要 checkpoint commit。
- 不直接在服务器上手改代码；默认路径是本地改动 → commit → push → staging deploy → smoke → production promote。
