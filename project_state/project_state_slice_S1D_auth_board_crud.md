# Project State Slice S1D: Auth-Backed Board CRUD

**Updated**: 2026-05-06
**Status**: Stable first-pass workspace-role authorization is now in the Postgres Board/History path, including Board cursor pagination, Board copy, snapshot restore, guest-aware board-member roles, people lookup, email invite, server-backed share-link contracts and public share-entry consumption. The next permission hardening target is now defined around Group/Team workspace separation.

## Objective

Route Board and History operations through real FastAPI permissions instead of dev identity.

## Work Items

- [x] Board list cursor pagination.
- [x] Board load/save with first-pass permission checks.
- [x] Board metadata update permission checks.
- [x] Board copy/delete with ownership rules first pass.
- [x] Board History create/list/load/restore with permission checks first pass.
- [x] Board member CRUD surface first pass.
- [x] Board people lookup / email invite / share-link first pass.
- [x] Cross-user isolation tests first pass.

## Current First Pass

- Postgres Board CRUD now uses `workspace_role` plus `owner_id` to enforce:
  - `owner/admin/member` can create and save Board documents.
  - `guest` is read-only.
  - metadata update and delete require `owner/admin` or the actual Board owner.
- Existing Board saves no longer overwrite `owner_id` when another permitted collaborator saves.
- New Postgres Boards seed an owner row into `tangent_board_members`.
- Board list now pages through cursor-based summaries in the authenticated API path.
- Board copy now duplicates an allowed Board into a new owned Board record instead of requiring client-side cloning.
- Snapshot create requires Board write access.
- Snapshot restore now runs through the permission-checked Board API.
- Snapshot clear requires Board manage access.
- Explicit board-member roles now participate in first-pass guest access: a guest can read a private Board when granted `viewer` and can save when granted `editor`.
- Board-members now have a real first-pass management surface in the Board panel for local bridge and remote API modes: list, people lookup, invite by email, edit role/display name and remove.
- Share links now have real create / revoke / resolve / shared-board-load contracts in both local bridge and Postgres API modes.
- Copied share links now point to a dedicated public `/share/[shareId]` entry instead of a protected Board route with a query param.
- Public share consume is now first-pass view-only on Konva v2 Boards; richer temporary-viewer expiry and editor-via-share behavior are still future work.

## Validation

- [x] User A cannot list/load/save/delete User B private Board first pass inside the Postgres permission path.
- [x] Explicit board-member `viewer` / `editor` roles now affect guest read/write behavior in the Postgres path.
- [x] Viewer/guest cannot save in the first-pass role gate.
- [x] History list remains summary-only and scoped.
- [x] Board copy and snapshot restore are routed through the same server-side permission boundary.
- [x] Workspace people lookup and email invite resolve into Board member rows.
- [x] Share link create / revoke / resolve is now server-backed in the authenticated API path.
- [x] Public share entry now resolves a stored share id and loads the shared Board document through a share-token route.
- [ ] Guard rejects `data:` and `blob:` documents.

## Next Tranche

- Map user-facing role labels to the current technical roles:
  - `Can view` -> `viewer`
  - `Can edit` -> `editor`
  - `Can manage` -> `admin`
  - `Owner` -> `owner`
- Require active workspace membership or an explicit invited-member record for edit/manage.
- Add `workspace.kind` resolution for `solo_workspace`, `group_workspace`, `team_workspace` and future `enterprise_workspace`.
- Keep Group Workspace creator/admin authority separate from other members' billing usage visibility.
- Keep Team Workspace dashboard visibility separate from Board-level `Can manage`; Team admins/owners see member usage, Board admins do not automatically inherit that visibility.
- Keep non-team external share recipients view-only in the initial product direction.
- Restrict Board copy/delete to owner in the initial product direction.

## 中文完整翻译

# Project State 切片 S1D：带 Auth 的 Board CRUD

**更新日期**：2026-05-06
**状态**：稳定的第一阶段 workspace-role authorization 已经进入 Postgres Board/History 路径，包含 Board cursor pagination、Board copy、snapshot restore、支持 guest 的 board-member roles、people lookup、email invite、server-backed share-link contracts 和 public share-entry consumption。下一轮权限硬化目标现在围绕 Group/Team workspace separation 定义。

## 目标

让 Board 和 History 操作通过真实 FastAPI permissions，而不是 dev identity。

## 工作项

- [x] Board list cursor pagination。
- [x] Board load/save with first-pass permission checks。
- [x] Board metadata update permission checks。
- [x] Board copy/delete with ownership rules first pass。
- [x] Board History create/list/load/restore with permission checks first pass。
- [x] Board member CRUD surface first pass。
- [x] Board people lookup / email invite / share-link first pass。
- [x] Cross-user isolation tests first pass。

## 当前第一阶段

- Postgres Board CRUD 现在使用 `workspace_role` 加 `owner_id` 来强制：
  - `owner/admin/member` 可以创建和保存 Board documents。
  - `guest` 默认只读。
  - metadata update 和 delete 需要 `owner/admin` 或实际 Board owner。
- 当另一个被允许的 collaborator 保存现有 Board 时，不再覆盖 `owner_id`。
- 新 Postgres Boards 会 seed 一条 owner row 到 `tangent_board_members`。
- Board list 现在在 authenticated API path 里通过 cursor-based summaries 分页。
- Board copy 现在会把允许复制的 Board duplicate 成一条新的 owned Board record，而不是要求客户端 clone。
- Snapshot create 需要 Board write access。
- Snapshot restore 现在通过 permission-checked Board API 执行。
- Snapshot clear 需要 Board manage access。
- Explicit board-member roles 现在参与第一阶段 guest access：当 guest 被授予 `viewer` 时可以读取 private Board，被授予 `editor` 时可以保存。
- Board-members 现在在 Board panel 中有真实第一阶段管理界面，支持 local bridge 和 remote API modes：list、people lookup、invite by email、edit role/display name 和 remove。
- Share links 现在在 local bridge 和 Postgres API modes 都有真实 create / revoke / resolve / shared-board-load contracts。
- Copied share links 现在指向专门的 public `/share/[shareId]` entry，而不是带 query param 的受保护 Board route。
- Public share consume 现在是 Konva v2 Boards 上第一阶段 view-only；更丰富的 temporary-viewer expiry 和 editor-via-share 行为仍然是未来工作。

## 验证

- [x] 在 Postgres permission path 的第一阶段里，用户 A 不能 list/load/save/delete 用户 B 的 private Board。
- [x] Explicit board-member `viewer` / `editor` roles 现在会影响 Postgres path 中 guest 的 read/write 行为。
- [x] Viewer/guest 在第一阶段 role gate 下不能保存。
- [x] History list 仍然是 summary-only 且有 scope。
- [x] Board copy 和 snapshot restore 通过同一个 server-side permission boundary。
- [x] Workspace people lookup 和 email invite 会解析成 Board member rows。
- [x] Share link create / revoke / resolve 现在在 authenticated API path 中由服务端支持。
- [x] Public share entry 现在解析 stored share id，并通过 share-token route 加载 shared Board document。
- [ ] Guard rejects `data:` and `blob:` documents。

## 下一阶段

- 把用户可见 role labels 映射到当前技术角色：
  - `Can view` -> `viewer`
  - `Can edit` -> `editor`
  - `Can manage` -> `admin`
  - `Owner` -> `owner`
- 对 edit/manage 要求 active workspace membership 或 explicit invited-member record。
- 增加 `workspace.kind` resolution，支持 `solo_workspace`、`group_workspace`、`team_workspace` 和未来的 `enterprise_workspace`。
- 保持 Group Workspace creator/admin authority 与其他成员 billing usage visibility 分离。
- 保持 Team Workspace dashboard visibility 与 Board-level `Can manage` 分离；Team admins/owners 可以看 member usage，Board admins 不会自动继承这个可见性。
- 保持非 team 外部 share recipients 在初始产品方向中 view-only。
- 在初始产品方向中把 Board copy/delete 限制为 owner-only。
