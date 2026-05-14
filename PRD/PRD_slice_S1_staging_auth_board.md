# PRD Slice S1: Staging, Auth And Board CRUD

**Updated**: 2026-05-14
**Mode**: Product slice.

## Goal

Move from local dev identity and local persistence to real staging infrastructure, real users, real workspaces and Auth-backed Board CRUD. This is the step where TANGENT stops being a single local canvas and starts behaving like a real multi-user web product.

## P0 Alpha Stabilization Note

For the current release pass, this slice is release-critical only for the core user journey:

- public landing -> sign in -> workspace
- Konva-only Board open/save/history/page/share
- Auth-backed Board/member/share permission boundaries

Group/Team business-system depth, real billing automation, collaboration and other future surfaces must not expand the promise of this slice.

## Product Requirements

| Area | Requirement | Status |
| --- | --- | --- |
| Staging Web/API | A public staging Web origin can call a public staging FastAPI origin over HTTPS. | Green on rebuilt staging |
| Object storage | Uploaded and captured images persist in R2/S3-compatible storage and reload from URL. | R2 smoke passed; production hardening pending |
| Database | Board, Asset and History data persist in managed Postgres via migrations. | Neon/Alembic smoke passed; current head includes `20260506_0007` entitlement extension |
| Auth | Users can register/login/logout through email OTP, magic link or Google OAuth. | Clerk frontend/session bridge, FastAPI JWT verification and real staging session/admin smoke are green; Google/email/logout hardening still pending |
| Workspace ownership | New users get a workspace; API queries are scoped by user/workspace. | Default workspace first pass exists; multi-workspace hardening pending |
| Board CRUD | Board list/search/pagination/open/rename/delete/copy is server-side and permission checked. | Staging list/open/save/load/history first pass is green; search/sort/effective permission hardening pending |
| Share/member permissions | Owner/admin/editor/viewer states become real server-side roles, and copied share links open through a dedicated public share entry. | First pass; `Can view/edit/manage/Owner` hardening pending |
| Konva production canvas | New/saved Konva Boards open on staging without any legacy paid-canvas dependency. | Green on the active Konva-only staging deploy |

## Included In S1

- Database migrations for users, workspaces, workspace members, board members, boards, board history and assets.
- Registration/login/logout/session using email OTP or magic link.
- Google OAuth signup/login through Auth provider, with local TANGENT user mapping.
- Default workspace creation for every new user.
- User-scoped Board list/open/save/history/rename/delete/copy.
- Owner/admin/editor/viewer permission checks on server APIs.
- Public share-link entry that can open a shared Konva Board in first-pass view-only mode.
- Staging Postgres/R2/domain/CORS smoke.
- Konva-only Board route deploy, with legacy Board documents blocked in the active app path.

## S1 Sub-Slices

| Sub-slice | File | Product outcome |
| --- | --- | --- |
| S1A DB schema + migrations | `PRD_slice_S1A_db_schema.md` | Account/workspace/Board facts are modeled locally; staging DB smoke still pending. |
| S1B staging infra | `PRD_slice_S1B_staging_infra.md` | The app can be tested online against real staging services. |
| S1C Auth/request context | `PRD_slice_S1C_auth_request_context.md` | Users can register/login and get their own workspace. |
| S1D Auth-backed Board CRUD | `PRD_slice_S1D_auth_board_crud.md` | Users can safely save, reopen and manage only authorized Boards. |

## Prepared But Not Fully Built In S1

- Admin roles and audit logs: schema compatibility may be added, but the full Admin dashboard is S3.
- Credits and subscriptions: ids and ownership must be compatible, but real credit deduction, Group/Team dashboard visibility, Team wallet grants and invoices are S3.
- AI usage/cost logs: S1 must not block them, but real provider cost tracking is S2.
- Collaboration: S1 creates the membership truth needed later, but live multiplayer/presence is S4.

## Acceptance

- Existing signed-in user can log in and out on staging without falling back to dev-bypass.
- Login redirects to `/workspaces`.
- Board list returns summaries only, not full documents.
- Board load returns full document only for authorized users.
- Active share link opens a dedicated public shared-Board route without requiring the protected workspace shell.
- Board save, History create/list/load and thumbnail metadata work against staging Postgres/R2.
- User A cannot read or mutate User B's Board.
- Owner/admin can mutate Board metadata; viewer cannot.
- Board History remains scoped to authorized members only.
- Production-like staging Board route opens Konva v2 without requiring any legacy paid-canvas runtime.
- Real signed-in staging smoke can load session and admin-backed board surfaces without exposing the old tldraw/license path.

## Non-Goals

- No AI provider integration in this slice.
- No full Admin analytics.
- No real-time collaboration.

## 中文完整翻译

# PRD 切片 S1：Staging、Auth 与 Board CRUD

**更新日期**：2026-05-14
**模式**：产品切片。

## 目标

从本地 dev identity 和 local persistence 迁移到真实 staging infrastructure、真实 users、真实 workspaces 和 Auth-backed Board CRUD。这一步让 TANGENT 从单一本地 canvas 开始表现为真实的多用户 Web 产品。

## P0 Alpha 稳定化说明

在当前这一轮发布里，这个切片只对核心用户旅程承担发布关键职责：

- public landing -> sign in -> workspace
- Konva-only Board 的 open/save/history/page/share
- Auth-backed 的 Board/member/share 权限边界

Group/Team 的业务系统深度、真实 billing automation、collaboration 以及其他未来界面，都不能继续扩大这个切片的承诺范围。

## 产品要求

| 领域 | 要求 | 状态 |
| --- | --- | --- |
| Staging Web/API | 一个公开 staging Web origin 可以通过 HTTPS 调用公开 staging FastAPI origin。 | 重建后的 staging 已转绿 |
| Object storage | 上传和 capture 的图片持久化到 R2/S3-compatible storage，并能从 URL 重新加载。 | R2 smoke 已通过；production hardening 待完成 |
| Database | Board、Asset 和 History data 通过 migrations 持久化到 managed Postgres。 | Neon/Alembic smoke 已通过；当前 head 包含 `20260506_0007` entitlement extension |
| Auth | 用户可以通过 email OTP、magic link 或 Google OAuth 注册 / 登录 / 登出。 | Clerk frontend/session bridge、FastAPI JWT verification 与真实 staging session/admin smoke 已转绿；Google/email/logout hardening 待完成 |
| Workspace ownership | 新用户会获得 workspace；API queries 按 user/workspace scope。 | Default workspace 第一阶段存在；multi-workspace hardening 待完成 |
| Board CRUD | Board list/search/pagination/open/rename/delete/copy 在服务端执行并带权限检查。 | staging list/open/save/load/history 第一阶段已转绿；search/sort/effective permission hardening 待完成 |
| Share/member permissions | Owner/admin/editor/viewer states 成为真实服务端 roles，复制的 share links 通过专门 public share entry 打开。 | 第一阶段；`Can view/edit/manage/Owner` hardening 待完成 |
| Konva production canvas | New/saved Konva Boards 可以在 staging 打开，且不依赖任何 legacy paid-canvas dependency。 | 活跃 Konva-only staging deploy 已转绿 |

## S1 包含

- users、workspaces、workspace members、board members、boards、board history 和 assets 的 database migrations。
- 使用 email OTP 或 magic link 的 registration/login/logout/session。
- 通过 Auth provider 进行 Google OAuth signup/login，并映射到本地 TANGENT user。
- 为每个新用户创建 default workspace。
- User-scoped Board list/open/save/history/rename/delete/copy。
- 服务端 API 上的 Owner/admin/editor/viewer permission checks。
- 可以第一阶段 view-only 打开 shared Konva Board 的 public share-link entry。
- Staging Postgres/R2/domain/CORS smoke。
- 部署 Konva-only Board route，并在 active app path 中阻止 legacy Board 文档。

## S1 子切片

| 子切片 | 文件 | 产品结果 |
| --- | --- | --- |
| S1A DB schema + migrations | `PRD_slice_S1A_db_schema.md` | Account/workspace/Board facts 已在本地建模；staging DB smoke 仍待完成。 |
| S1B staging infra | `PRD_slice_S1B_staging_infra.md` | App 可以在线对真实 staging services 测试。 |
| S1C Auth/request context | `PRD_slice_S1C_auth_request_context.md` | 用户可以 register/login，并获得自己的 workspace。 |
| S1D Auth-backed Board CRUD | `PRD_slice_S1D_auth_board_crud.md` | 用户只能安全保存、重新打开和管理已授权 Boards。 |

## S1 已准备但不完整构建

- Admin roles 和 audit logs：可以增加 schema compatibility，但完整 Admin dashboard 属于 S3。
- Credits 和 subscriptions：ids 和 ownership 必须兼容，但真实 credit deduction、Group/Team dashboard visibility、Team wallet grants 和 invoices 属于 S3。
- AI usage/cost logs：S1 不能阻塞它们，但真实 provider cost tracking 属于 S2。
- Collaboration：S1 创建未来需要的 membership truth，但 live multiplayer/presence 属于 S4。

## 验收

- 已有 signed-in 用户可以在 staging 正常登录/登出，而不依赖 dev-bypass。
- Login 重定向到 `/workspaces`。
- Board list 只返回 summaries，不返回 full documents。
- Board load 只对 authorized users 返回 full document。
- Active share link 可以打开专门的 public shared-Board route，不要求进入 protected workspace shell。
- Board save、History create/list/load 和 thumbnail metadata 可以在 staging Postgres/R2 上工作。
- 用户 A 不能读取或修改用户 B 的 Board。
- Owner/admin 可以修改 Board metadata；viewer 不能。
- Board History 仍然只对 authorized members 有 scope。
- Production-like staging Board route 打开 Konva v2，不要求任何 legacy paid-canvas runtime。
- 真实 signed-in staging smoke 可以加载 session 与 admin-backed board surfaces，且不会重新暴露旧 tldraw/license 路径。

## 非目标

- 本切片不接入 AI provider。
- 不做完整 Admin analytics。
- 不做 real-time collaboration。
