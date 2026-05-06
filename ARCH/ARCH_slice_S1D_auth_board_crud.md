# ARCH Slice S1D: Auth-Backed Board CRUD

**Updated**: 2026-05-06
**Mode**: Architecture slice.
**Status**: Stable first-pass Board CRUD is active in the Postgres path, including cursor-paginated Board listing, Board copy, snapshot restore, guest-aware board-member roles, a first usable member-management surface and a first public share-view path.

## Goal

Move Board list/load/save/history/assets from local/dev identity to real permission-checked FastAPI APIs.

## Permission Model

Workspace roles:

```text
owner
admin
member
guest
```

Workspace kinds:

```text
solo_workspace
group_workspace
team_workspace
```

Board roles:

```text
owner
admin
editor
viewer
temporary_viewer
```

User-facing role labels:

```text
Owner      -> owner
Can manage -> admin
Can edit   -> editor
Can view   -> viewer | temporary_viewer
```

Rules:

- Owner/admin can update Board metadata, visibility, members and delete.
- Editor can save Board document and create snapshots, but cannot change ownership/security metadata.
- Board edit permission is separate from AI entitlement; runtime AI still needs a separate credit/plan check.
- Viewer can load Board and History summaries if allowed, but cannot save.
- Temporary viewer requires `expires_at`.
- A user may join or create multiple workspaces; workspace membership, admin authority and Board roles are all scoped to one workspace.
- Private Board is visible only to owner/admin/member grants.
- Public/shared Board must still have server-side share link validation.
- Initial product direction: edit/manage requires active workspace membership or an explicit invited-member record; non-team external share recipients remain view-only.
- Initial commercial direction: Group Workspaces may grant `Can edit` to invited free editors without a paid seat, but those invitees still need their own top-up/subscription balance to run AI and should not hold `Can manage` in the first pass.
- Group Workspace creators/admins may assign workspace admins/editors plus Board admins/editors, but they do not inherit billing visibility over other members.
- Team Workspaces use the same core role surface, but Team workspace owners/admins additionally see the Team dashboard and member-usage summaries.
- Board copy is owner-only in the initial product direction.
- Board rename/share/member management are manage-or-owner actions.

## API Contracts

```text
GET    /api/v1/boards?workspaceId=&cursor=&limit=&sort=&query=
POST   /api/v1/boards
GET    /api/v1/boards/{boardId}
PATCH  /api/v1/boards/{boardId}
DELETE /api/v1/boards/{boardId}
POST   /api/v1/boards/{boardId}/copy
POST   /api/v1/boards/{boardId}/open

GET    /api/v1/boards/{boardId}/snapshots?cursor=&limit=&reason=
POST   /api/v1/boards/{boardId}/snapshots
GET    /api/v1/boards/{boardId}/snapshots/{snapshotId}
POST   /api/v1/boards/{boardId}/restore

GET    /api/v1/boards/{boardId}/members
POST   /api/v1/boards/{boardId}/members
PATCH  /api/v1/boards/{boardId}/members/{userId}
DELETE /api/v1/boards/{boardId}/members/{userId}

GET    /api/v1/boards/share-links/{shareId}
GET    /api/v1/boards/share-links/{shareId}/board
```

## Query Rules

- List endpoints return summaries only.
- Full Board document is returned only by load endpoint after permission check.
- Board list uses stable cursor pagination.
- Snapshot/history list remains cursor-based and summary-first.
- Board list sorting supports saved, opened, pinned, title.
- Star/pin/recent-open come from `board_user_preferences`.
- History list supports reason filter: autosave, manual, keyboard, restore.

## Current First Pass

The current implementation intentionally stops short of full `tangent_board_members` routing and uses the already available authenticated request context:

```text
request_context
  -> authenticated active workspace + workspace_role
  -> Postgres Board store
  -> role gate by workspace_role + board.owner_id
```

Current behavior:

- `owner/admin/member` may create and save Board documents in the active workspace.
- `guest` is read-only by default, but explicit board-member roles can now grant guest read/write access on a private Board in the first pass.
- Board metadata update/delete and snapshot clear require `owner/admin` or actual `board.owner_id`.
- Snapshot create requires Board write access.
- Board list pagination is cursor-based in the authenticated Postgres API so large workspaces do not rely on page-number scans.
- Board copy exists as a server-checked duplicate flow that creates a new Board record and preserves only allowed source metadata/content.
- Snapshot restore exists as a server-checked write path; restore creates a new current Board state from a stored snapshot without changing Board ownership.
- Existing Board saves preserve original `owner_id`; collaborator saves do not silently transfer ownership.
- New Boards seed an owner row into `tangent_board_members`.
- Board-members now have a fuller first usable boundary: membership rows/backing contracts plus local/remote Board panel flows now cover member list, people lookup, invite-by-email, role updates and removal.
- People lookup resolves from workspace membership facts in the remote API path and from local workspace-people fixtures in bridge mode.
- Share-link creation/revoke/resolve contracts now exist in both local and Postgres Board storage paths, and the copied Board share link is now server-backed instead of client-generated.
- Share-token Board loading now exists in both local and Postgres paths through a dedicated `share-links/{shareId}/board` contract.
- Public Web entry now opens shared Konva Boards from `/share/[shareId]` without routing through the protected `/boards/*` middleware path.

This is still not the final authorization model. First-pass public share is view-only; temporary-viewer expiry, richer invite acceptance and editor-via-share flows still remain future work, but S1D no longer stops at raw user-id member CRUD.

## Next Permission Hardening Direction

Future effective-permission resolution should look like this:

```text
request context
  -> authenticated actor
  -> workspace kind lookup
  -> workspace membership lookup
  -> board membership lookup
  -> share token lookup if present
  -> effective role resolver
       |-- non-member + share token => view only
       |-- workspace member + board viewer => can view
       |-- workspace member + board editor => can edit
       |-- workspace member + board admin => can manage
       |-- board owner => owner
```

Planned product rules:

- `Can manage` may invite, revoke, rename, change visibility and manage members.
- `Can edit` should remain a Board-content permission, while AI execution stays gated by S2/S3 entitlement checks.
- `Can manage` may not copy or delete the Board.
- `Owner` may copy and delete.
- Invited free editors in Group Workspaces may stop at `Can edit`; first-pass `Can manage` should stay with invited/paying workspace admins rather than free editors.
- Workspace admin visibility and Board admin visibility must stay separate: Group admins can manage structure without seeing other members' AI usage, while only Team workspace admins/owners may see Team dashboard usage summaries.
- Share links stay view-only until there is an explicit server-side editor-via-share product decision.

## Data Guard

- Run Board document guard on save and snapshot.
- Reject `data:`, `blob:` and Base64 image payloads.
- Enforce document byte-size and shape/asset count limits.
- Verify assets referenced by Board belong to the same workspace or are shared through an allowed reference.

## Acceptance

- User A cannot list/load/save/delete User B's private Board.
- Owner can add editor/viewer.
- Editor can save but cannot change card color, thumbnail, visibility or members.
- Viewer cannot save.
- Board copy preserves allowed metadata and creates new ownership correctly.
- Snapshot restore requires write permission and replays a chosen snapshot into the current Board safely.
- Snapshot retention rules work for autosave and manual saves.
- Pagination remains stable while Boards are added.
- Workspace people lookup returns bounded candidate results.
- Email invite resolves to a Board member row through a server-side contract.
- Share link resolve only succeeds for an active stored share id.
- Share token Board load only succeeds for an active stored share id and returns a full Board document without requiring workspace auth headers.

## 中文完整翻译

# ARCH 切片 S1D：带 Auth 的 Board CRUD

**更新日期**：2026-05-06
**模式**：架构切片。
**状态**：第一阶段稳定版 Board CRUD 已在 Postgres 路径生效，包含游标分页的 Board 列表、Board copy、snapshot restore、支持 guest 的 board-member 角色、一套初步可用的成员管理界面，以及第一版公共分享查看路径。

## 目标

把 Board 的列表、加载、保存、历史和素材访问，从本地 / dev 身份切换到真实的、带权限检查的 FastAPI API。

## 权限模型

Workspace 角色：

```text
owner
admin
member
guest
```

Workspace 形态：

```text
solo_workspace
group_workspace
team_workspace
```

Board 角色：

```text
owner
admin
editor
viewer
temporary_viewer
```

用户可见角色文案：

```text
Owner      -> owner
Can manage -> admin
Can edit   -> editor
Can view   -> viewer | temporary_viewer
```

规则：

- Owner / Admin 可以更新 Board 元数据、可见性、成员并删除 Board。
- Editor 可以保存 Board 文档和创建快照，但不能更改所有权或安全相关元数据。
- Board 的编辑权限和 AI 使用资格是两件事；运行时 AI 仍然需要单独的积分 / 套餐检查。
- Viewer 可以在被允许的情况下加载 Board 和历史摘要，但不能保存。
- Temporary viewer 必须带 `expires_at`。
- 一个用户可以加入或创建多个 workspace；workspace 成员身份、管理员权限以及 Board 角色都只在各自的 workspace 内生效。
- Private Board 只对 owner / admin / member 授权对象可见。
- Public / shared Board 仍然必须经过服务端 share link 校验。
- 当前产品方向里，edit / manage 必须要求活跃 workspace 成员身份，或有明确的 invited-member 记录；非团队外部分享对象保持只读。
- 当前商业化方向里，Group Workspace 可以把 `Can edit` 授予被邀请的免费编辑者，而不要求他们购买付费席位；但这些被邀请者如果要运行 AI，仍然必须使用自己的充值 / 订阅余额，而且在第一阶段不应拥有 `Can manage`。
- Group Workspace 的创建者 / 管理员可以分配 workspace admins/editors 和 Board admins/editors，但他们不会因此继承其他成员的 billing 可见性。
- Team Workspace 使用相同的核心角色结构，但 Team workspace 的 owners/admins 会额外看到 Team dashboard 和成员 usage 汇总。
- 当前产品方向里，Board copy 是 owner-only。
- Board rename / share / member management 属于 manage-or-owner 动作。

## API 合同

```text
GET    /api/v1/boards?workspaceId=&cursor=&limit=&sort=&query=
POST   /api/v1/boards
GET    /api/v1/boards/{boardId}
PATCH  /api/v1/boards/{boardId}
DELETE /api/v1/boards/{boardId}
POST   /api/v1/boards/{boardId}/copy
POST   /api/v1/boards/{boardId}/open

GET    /api/v1/boards/{boardId}/snapshots?cursor=&limit=&reason=
POST   /api/v1/boards/{boardId}/snapshots
GET    /api/v1/boards/{boardId}/snapshots/{snapshotId}
POST   /api/v1/boards/{boardId}/restore

GET    /api/v1/boards/{boardId}/members
POST   /api/v1/boards/{boardId}/members
PATCH  /api/v1/boards/{boardId}/members/{userId}
DELETE /api/v1/boards/{boardId}/members/{userId}

GET    /api/v1/boards/share-links/{shareId}
GET    /api/v1/boards/share-links/{shareId}/board
```

## 查询规则

- 列表接口只返回摘要，不返回完整文档。
- 只有在权限检查通过后，load 接口才返回完整 Board 文档。
- Board 列表使用稳定的游标分页。
- Snapshot / history 列表保持游标分页，并以摘要优先。
- Board 列表排序支持 saved、opened、pinned、title。
- Star / pin / recent-open 来自 `board_user_preferences`。
- History 列表支持按 reason 过滤：autosave、manual、keyboard、restore。

## 当前第一阶段

当前实现还没有完全切到完整的 `tangent_board_members` 路由，而是先利用已经存在的认证 request context：

```text
request_context
  -> 已认证的 active workspace + workspace_role
  -> Postgres Board store
  -> 基于 workspace_role + board.owner_id 进行角色门控
```

当前行为：

- `owner/admin/member` 可以在当前 workspace 中创建和保存 Board 文档。
- `guest` 默认只读，但如果显式赋予 board-member 角色，也可以在 private Board 上获得读 / 写访问。
- Board 元数据更新 / 删除和 snapshot clear 需要 `owner/admin` 或真实的 `board.owner_id`。
- Snapshot create 需要 Board 写权限。
- Board 列表在已认证的 Postgres API 路径里已经是游标分页，因此大 workspace 不需要依赖页码扫描。
- Board copy 已经是服务端检查过的 duplicate 流程，会创建新的 Board 记录，并只保留允许复制的元数据和内容。
- Snapshot restore 已经是服务端检查过的写路径；恢复时会把某个快照内容重新放回当前 Board，但不会改变 Board 所有权。
- 协作者保存现有 Board 时，不会覆盖原始 `owner_id`。
- 新建 Board 会自动 seed 一条 owner 级别的 `tangent_board_members` 记录。
- Board-members 现在已经有更完整的第一阶段边界：成员记录 / 底层合同，加上本地和远端 Board panel 流程，已经覆盖成员列表、people lookup、invite-by-email、角色更新和移除。
- People lookup 在远端 API 路径中基于 workspace membership 事实解析，在 bridge 模式下则基于本地 workspace-people fixtures。
- Share-link create / revoke / resolve 已经在 local 和 Postgres 两条 Board storage 路径都存在，复制出来的 share link 也已经是服务端生成，而不是客户端拼的。
- Share-token Board loading 已经在 local 和 Postgres 两条路径中通过专门的 `share-links/{shareId}/board` 合同存在。
- 公共 Web 入口现在可以通过 `/share/[shareId]` 打开共享 Konva Board，而无需经过受保护的 `/boards/*` middleware 路径。

这还不是最终授权模型。当前 public share 仍然是 view-only；temporary-viewer expiry、更丰富的 invite acceptance，以及 editor-via-share 流程仍然留到后续。

## 下一轮权限硬化方向

未来的 effective-permission 解析应该长这样：

```text
request context
  -> authenticated actor
  -> workspace kind lookup
  -> workspace membership lookup
  -> board membership lookup
  -> share token lookup if present
  -> effective role resolver
       |-- 非成员 + share token => 只能 view
       |-- workspace member + board viewer => can view
       |-- workspace member + board editor => can edit
       |-- workspace member + board admin => can manage
       |-- board owner => owner
```

后续产品规则：

- `Can manage` 可以 invite、revoke、rename、change visibility、manage members。
- `Can edit` 应当继续只表示 Board 内容编辑能力，而 AI 执行要继续交给 S2/S3 的 entitlement 检查。
- `Can manage` 不能 copy 或 delete Board。
- `Owner` 才能 copy 和 delete。
- Group Workspace 中被邀请的免费编辑者最多停留在 `Can edit`；第一阶段的 `Can manage` 应保留给被邀请 / 付费的 workspace admins，而不是免费编辑者。
- Workspace admin 可见性和 Board admin 可见性必须分开：Group admins 可以管理结构，但不能看到其他成员的 AI usage；只有 Team workspace 的 admins/owners 才能看到 Team dashboard 的 usage 汇总。
- Share links 继续保持 view-only，直到未来真的做出明确的服务端 editor-via-share 产品决策。

## 数据防护

- 保存和快照时都要运行 Board document guard。
- 拒绝 `data:`、`blob:` 和 Base64 图片载荷。
- 限制 document 字节大小、shape 数量和 asset 数量。
- 校验 Board 引用的 asset 是否属于同一 workspace，或是否通过合法方式共享。

## 验收

- 用户 A 不能列出 / 加载 / 保存 / 删除用户 B 的 private Board。
- Owner 可以添加 editor / viewer。
- Editor 可以保存，但不能改变 card color、thumbnail、visibility 或 members。
- Viewer 不能保存。
- Board copy 必须保留允许复制的元数据，并创建新的正确所有权。
- Snapshot restore 需要写权限，并能把选定快照安全恢复到当前 Board。
- Snapshot retention 规则对 autosave 和 manual save 都有效。
- 分页在 Board 持续新增时仍然稳定。
- Workspace people lookup 必须返回数量受控的候选结果。
- Email invite 必须能通过服务端合同解析成 Board member 记录。
- Share link resolve 只能对活跃存储的 share id 成功。
- Share token Board load 只能对活跃 share id 成功，并且在不要求 workspace auth headers 的前提下返回完整 Board 文档。
