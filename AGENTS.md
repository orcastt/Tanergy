# TANGENT Fresh Development Rules

本文件适用于当前新项目根目录。旧代码已隔离在 `legacy/old-tangent-desktop-2026-04-29/`，除非用户明确要求恢复或参考，否则不要读取、修改、构建或测试 legacy 目录。

## 当前产品口径

- Web-first AI image canvas，不做桌面客户端 P0。
- P0 只打通最小图像链路：`Text Node → Multi Generate 4图 → Image Node → Image Editor / Canvas Markup → Merge Capture → New Image Node`。
- AI Chat 自动创建节点和连线保留为降低门槛入口。
- 多人协作后移到 P0.5。
- 不做公众号 Html Editor、Writer、Personal Library、Knowledge Graph、复杂 Admin Analytics。
- 前端视觉保持干净白板、小卡片、轻边框，不大换皮。

## 工作循环

每次非简单改动按顺序推进：

1. 先读 `project_state.md`、`PRD.md`、`ARCH.md` 和相关 `dev-plans/`。
2. 新功能或跨文件改动先更新 `dev-plans/`。
3. 只实现当前切片，不顺手重构无关逻辑。
4. 单文件尽量不超过 300 行，接近上限就拆模块。
5. UI 改动遵守 `reference/design-system.md` 和 `reference/theme.ts`。
6. 用户可见文案走 i18n；默认英文，中文环境不混杂英文业务文案。
7. API Key 只在服务端环境变量，绝不进入前端代码。
8. 完成后更新 `project_state.md` 和对应计划。

## 质量闸门

新 Web app scaffold 完成后，前端改动至少运行：

- `npm -C apps/web run build`
- `npm -C apps/web run lint`
- `npm -C apps/web run typecheck`
- `git diff --check`

后端/API 改动运行对应测试或最小 API 检查。

## Git

- 不主动 commit、push、新建分支，除非用户明确要求。
- 用户要求提交前，先检查 `git status`，确认变更范围。
