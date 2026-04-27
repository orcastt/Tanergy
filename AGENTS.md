# TanvasAgent Development Rules

本文件是仓库根目录规则，适用于整个项目；更深层目录里的 `AGENTS.md` 可以补充或覆盖对应子树规则。

## 工作循环

每次非简单改动都按下面顺序推进：

1. **对齐上下文**
   - 先阅读与任务相关的 `PRD.md`、`ARCH.md`、`project_state.md`、`README.md`、`dev-plans/`、`debug-plans/`。
   - 不确定现状时先查代码，不凭记忆判断项目进度。
   - 如发现文档与代码不一致，以代码现状为准，再同步修正文档。

2. **写开发计划**
   - 新功能、跨文件改动、架构调整必须先在 `dev-plans/` 新增或更新计划。
   - 计划至少包含：目标、范围、实现步骤、涉及文件索引、测试计划、验收清单、风险/阻断。
   - 如果用户把 `deg-plans` 写成计划目录，按 `dev-plans/` 处理。

3. **开发实现**
   - 优先修根因，不做表面补丁。
   - 尽量保持单文件不超过 300 行；超过时拆成职责清晰的小模块。
   - 不随意重命名、不重构无关代码、不修无关历史 lint。
   - UI 改动遵守 `reference/design-system.md` 和 `reference/theme.ts`。
   - 中英文 UI 必须走 i18n；中文环境显示中文，英文环境显示英文。
   - 当前产品路线优先走官方后端代理线路；用户自带 API Key/BYOK 暂不作为默认开发路径。

4. **测试检查**
   - 前端改动至少运行 `npm -C frontend run build` 与 `git diff --check`。
   - 触碰的前端文件需从 `frontend/` 运行定向 `npx eslint <changed-files>`。
   - Rust/Tauri 改动运行 `cargo check --manifest-path src-tauri/Cargo.toml`。
   - 后端改动运行对应的 Python 测试或最小可用 API 检查。
   - 节点端口、画布连线、Html Editor、Image Editor 等交互改动必须补手测验收项。

5. **验收收口**
   - 完成后在对应 `dev-plans/` 中标记已完成项和已实现文件索引。
   - 如果发现历史链路或旧计划不再贴合当前主流程，在 `debug-plans/` 或相关文档中标为 legacy/非当前主流程。
   - 项目状态变化时同步更新 `project_state.md`；架构或产品口径变化时同步更新 `ARCH.md`、`PRD.md`、相关 `README.md`。
   - 最终回复需要说明改了什么、测了什么、还有什么未做或需用户手测。

6. **Git 操作**
   - 不主动 `git commit`、新建分支或 `git push`，除非用户明确要求。
   - 用户要求提交前，先检查 `git status`，确认只包含本次相关改动。
   - 提交信息用简洁英文动词开头，例如 `docs: add development workflow rules`。

## 当前项目口径

- 公众号主流程：`text_input → research → outline_generator → Split → N×text_input + image_list → html_formatter(Html Editor)`。
- `html_formatter` / Html Editor 是当前主流程终点；`preview_wechat` 属于 legacy 可选节点。
- Admin、Provider、Model、计费、线路稳定性优先放在后端和管理后台，不把第三方 API Key 暴露给桌面端。
- 新第三方中转站优先作为 OpenAI-compatible relay provider 接入后端，而不是写死到前端节点里。
