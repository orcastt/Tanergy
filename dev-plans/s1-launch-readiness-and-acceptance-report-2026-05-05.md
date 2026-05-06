# S1 上线准备和验收汇报

**Updated**: 2026-05-06
**Status**: S1X Konva Page polish、S1D public share + owner-only copy/delete + known-foreign Asset guard hardening、S1C Clerk/Auth first pass 和 S3 admin/entitlement first pass 已接上的活跃交接报告；2026-05-06 文档收口后继续作为验收清单。
**Branch**: `feature/s1x-konva-handfeel-spike`

## 当前位置

S1X 已经把生产画布方向切到 Konva v2。新建/缺失 Board 和已保存的 Konva Board 都走正式 `/boards/[boardId]` 路由；tldraw 只保留为参考路径，并且生产默认关闭。

当前 working tree 除了已验收的 Page polish，还已经包含一轮 S1C Auth 接线：

- `/` 是公开 Tanergy homepage；`/sign-in`、`/sign-up` 走 Clerk。
- `/workspaces` 在 `TANGENT_REQUIRE_WEB_AUTH=1` 时会被 Clerk 保护。
- workspace 顶部导航里的 `Home` 已移除；点 logo 返回 homepage。
- localhost 图片上传 / 外部图片粘贴 / 截图粘贴 已重新验证能走本地 asset pipeline，不依赖数据库。
- FastAPI 在 `TANGENT_REQUIRE_API_AUTH=1` 时不再接受伪造的 `x-tangent-user-id` / `x-tangent-workspace-id` 作为 authority；改为 Bearer Clerk token。
- 前端 remote Board / Asset / Image Op / AI client 已补 Clerk JWT 透传。
- Postgres Board/History 现在有第一轮 workspace-role gate：`owner/admin/member` 可写，`guest` 只读，metadata/clear 更严格，copy/delete 已 owner-only。
- S1D 当前稳定 checkpoint 还包含：Board cursor pagination、owner-only Board copy/delete、snapshot restore、guest-aware board-member roles、share-link expiry enforcement、known-foreign Asset reference guard，以及 Board Panel 里的首轮成员管理流。
- admin backend 当前稳定 checkpoint 已从最小 access probe 扩到：`GET /api/v1/admin/me`、只读 summary/users/workspaces/boards 首轮资源、owner-only role grant/revoke、bootstrap CLI、audit helper 边界，以及前端 `/admin` access gating。

当前 Page polish 范围：

- 右侧 Pages 抽屉，带轻量几何缩略图。
- Page 创建、切换、重命名、删除、重排。
- 右键菜单 `Move to page`。
- `Move to page` 会把 group 成员和 frame children 一起作为移动范围。
- Runtime edge 只在 source/target 两端都被移动时跟着迁移；跨 page runtime edge 暂时删除。
- S1X PRD / ARCH / project state / dev plan 已同步更新。

Page polish 已跑过质量门：

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

## 建议执行顺序

```text
0. 提交已验收的 S1X Page polish checkpoint
   |
   v
1. S1B 上线/部署加固
   staging env, Konva-first route, CORS, R2, Postgres, rollback
   |
   v
2. S1A/S1D 数据库和 Board API 加固
   staging migration smoke, cursor pagination, permission query indexes, JSON guard limits
   |
   v
3. S1C Auth / request context
   Clerk/Supabase decision, Google OAuth, JWT verification, default workspace
   |
   v
4. S1D Auth-backed Board CRUD
   list/load/save/history/copy/delete/restore/member scaffold/cursor pagination
   |
   v
5. S2 真实 AI provider 路径
   server-side AiRun, provider adapter, asset result upload, cost logs
   |
   v
6. S3 Admin MVP
   server-side admin_roles, read-only summary/users, audit helper, `/admin` gating, later AI call inspection
   |
   v
7. S4 collaboration proof
   Yjs provider, presence, role-aware writes, snapshot reconciliation
```

## 上线优化 Backlog

| 线路 | 现在可以开始 | 必须等待 | 验收标准 |
| --- | --- | --- | --- |
| S1X Board polish | 真实渲染的 page-thumbnail assets、page duplicate、export background options、route acceptance tests | Collaboration 和真实 AI side effects | `/boards/[boardId]` 在 production mode 下不依赖 tldraw |
| S1B Deployment | 刷新 staging runbook、核对 env 名称、CORS、health、R2 asset 读写、rollback commands | 用于 Auth smoke 的公开 Auth provider credentials | Web 能调用 staging API，assets 从 R2 加载，Board save/load/history 通过 |
| Database optimization | Staging migration smoke、Board list / History / Asset list 的 EXPLAIN、文档体积限制、snapshot retention policy | 真实用户流量和 Auth-scoped query volume | cursor indexes 被使用；Board/History list 速度稳定；guard 拒绝超大或不安全文档 |
| S1C Auth | Auth provider 最终选择、route contracts、request-context implementation plan | Provider project keys 和 Google OAuth setup | 用户不能伪造 user/workspace id；非法 JWT 返回 401 |
| S1D Board CRUD | Permission matrix、cursor pagination、owner-only copy/delete、restore/member/share/Asset guard contract tests | 真实 Auth request context | User A 不能读/改 User B 的 Board；copy/delete owner-only；copy/restore/share expiry 走 server-side 权限；known foreign Asset refs 被拒绝；member scaffold 不越权 |
| S2 AI calls | Provider adapter interface、AiRun schema mapping、mock-to-real test plan | Server-side API keys 和 Auth/cost limits | 前端永远拿不到 key；输出是 Asset；Board 只存 refs/summaries |
| S3 Admin | Admin role/audit contract、只读 summary/users 首轮资源、`/admin` gating | 真实 Auth 和 admin_roles seed | 没有 server-side admin role 不能访问 `/admin`；已有角色时只看到首轮只读能力 |
| S4 Collaboration | Yjs document mapping proof plan、presence shape、no-binary CRDT rules | Auth、Board members、Asset 和 AiRun authority | 两个用户能编辑测试 Board，CRDT 不存图片二进制/provider payload |

## Page Polish 手测清单

- 创建 3 个 pages，并在每个 page 画不同内容。
- 双击 page row 重命名；点击外部后保存名字。
- 用 up/down 重排 pages；active page 和内容保持正确。
- 删除 inactive page；active page 不变。
- 删除 active page；fallback page 打开，selection/edit state 清空。
- 选择一个普通 shape 后 `Move to page`；它从 source 消失并出现在 target。
- 选择一个 group 后 `Move to page`；所有 group members 一起移动。
- 选择一个带 children 的 frame 后 `Move to page`；frame children 跟着移动。
- 移动已连接的 runtime nodes，且两端都被选中；内部 runtime edge 保留。
- 只移动 runtime edge 的其中一端；跨 page edge 被删除。
- Save、reload、Snapshot、Restore；page 顺序、标题、内容和 active page 都保留。
- History 仍然显示 active Page title。

## Deployment / Backend 验收

- `NEXT_PUBLIC_ENABLE_TLDRAW_REFERENCE` 在 production staging 中不存在或为 false，除非明确测试 reference mode。
- Public staging Web 打开新 Board 时 `/boards/<id>` 使用 Konva v2。
- FastAPI `/health` 通过 HTTPS。
- CORS 允许 staging Web origin，并拒绝无关 origin。
- Alembic 在 staging Postgres 上达到 head。
- localhost / staging asset ingest 不要求数据库才能完成浏览器端图片上传；本地 fallback 使用 `.tangent-assets`。
- Asset upload/read 通过 R2/S3-compatible storage。
- Board save/load/history/clean 通过 staging API。
- Board guard 拒绝 `data:`、`blob:`、Base64 images 和 malformed Konva v2 envelopes。
- Board save / snapshot create 拒绝已知属于另一个 workspace 的 Asset id；后续 explicit Asset-sharing allowlist 再开放合法跨 workspace 共享。
- `TANGENT_REQUIRE_API_AUTH=1` 后，非法或缺失 Bearer token 会收到 401，不能再靠前端 header 伪造用户或 workspace。
- Production deploy 前已写好 rollback path。

## AI Provider 验收

- AI API keys 只留在 server-side。
- Model Registry capabilities 来自 server contract。
- `Prompt -> Image Gen -> Image` 创建 Asset，并且 Board/node data 只存 asset refs。
- `Prompt -> Image Gen 4 -> Image` 创建 4 个 candidate Asset refs。
- `Image + Prompt -> Analysis` 通过 AiRun summary 创建短文本输出，不把 provider raw payload 写进 Board JSON。
- Provider 调用失败时写入 failed AiRun state，并显示用户可理解的错误。
- AiRun 和 `ai_api_calls` 记录 user/workspace/board/node/model/provider/status/latency/cost facts。
- Rate limits 或 credits 能防止未认证用户无限调用。

## Admin 验收

- `/admin` 入口和页面访问都必须走 server-side admin probe/gate。
- Admin access 通过 server-side `admin_roles` 检查。
- 前端 role flags 永远不是权限依据。
- 当前 first pass 是只读 summary/users 首轮能力，不代表完整 users/workspaces/Boards/assets/AiRuns 检索面板都已完成。
- 每个 admin write 都写 `admin_audit_logs`；当前 audit helper 是为后续 write 路由先铺边界。

## Collaboration 验收

- Collaboration 只能在 Auth、Board members、Asset 和 AiRun authority 稳定后开始。
- CRDT 只存 lightweight shapes、node params、runtime edges 和 Asset refs。
- CRDT 永远不存 image binaries、Base64、provider raw payloads 或 long logs。
- Presence 包含 cursor、selection 和 current tool。
- Board History 在 collaboration 下仍可 restore。
- AI runs 和 credit charges 仍然由 server 决定。

## Legacy 边界

不要读取或修改 `legacy/old-tangent-desktop-2026-04-29/`，除非用户明确要求。如果之后需要从 legacy 里复制 AI provider 参考，单独开一个 inspection task，先总结差异，再迁移代码。

## 下一个具体 Checkpoint

当前这轮之后建议直接进入：

1. 把 S1D first-pass checkpoint 从 user-id member management 往 email invite / people lookup / share-link flow 继续补。
2. 把 S3 admin first-pass checkpoint 从 summary/users/workspaces/boards 扩到 audit views、role-management UI 和更多只读资源。
3. 然后再进入 S2 real AiRun provider adapter，避免真实 AI 调用先跑在松散 auth 上。

上述第 1 / 2 条现在已经完成到可用 checkpoint：

- S1D：Board members 已支持 people lookup、email invite、server/local-backed share link create/revoke/resolve，以及 public share entry / share consume first pass。
- S3：`/admin` 已支持 summary/users/workspaces/boards/audit views，以及 owner-only role-management UI。

因此下一步建议改为：

1. 继续做 S1D permission hardening：single effective-permission resolver、active membership / invited-member edit/manage，以及 cross-workspace Asset reference guard。
2. 再做 S3 entitlement/seat/credit-ledger preflight，把 documented pricing/Group/Team 策略变成服务端合同。
3. 然后进入 S2 real AiRun provider adapter，把当前 mock runtime 数据流切到真实 server-side provider contracts。
4. 再补 admin search / pagination / richer audit filters，避免把 `/admin` 卡在首轮 bounded lists。
5. 视情况继续补 share editor / temporary-viewer 创建 UI / invite accept 等更完整 shared-collab 前置能力。
