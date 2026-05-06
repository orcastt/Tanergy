# PRD Slice S1D: Auth-Backed Board CRUD

**Updated**: 2026-05-06
**Status**: Stable first-pass Board CRUD/member/share/public-share path is active; owner-only copy/delete, expiring share-link enforcement, cross-workspace Asset reference blocking and the backend effective-permission resolver are now in place.

## User Value

Boards become real account-owned documents. Users can save, reopen, rename, copy, delete and restore Board History without leaking data across accounts.

## Requirements

- Board list with cursor pagination, search and sort.
- Board create/open/load/save/rename/copy/delete.
- Board History create/list/load/restore.
- Board metadata updates with role checks.
- Board member list and role update scaffold.
- Share/member vocabulary that maps to `Can view / Can edit / Can manage / Owner`.
- Team-gated editing and management: non-team share recipients stay view-only in the initial product direction.
- Asset references validated against workspace access.

## Acceptance

- User A cannot read or mutate User B's private Board.
- Owner/admin can update metadata and members.
- Editor/member can save document and create snapshots.
- Viewer/guest cannot save.
- `Can manage` may invite/share/rename/change visibility, but cannot copy or delete the Board.
- `Owner` may copy and delete the Board.
- Share links may expire; expired or revoked links cannot resolve or load Board content.
- Board save and History snapshot creation reject known Asset ids from another workspace.
- Board list returns summaries only.
- Board load returns full document only after permission check.
- History filter supports autosave/manual/keyboard.

## Current First Pass

The current shipped step is intentionally smaller than the final PRD target, but it is no longer just raw Board CRUD:

- authorization is based on authenticated `workspace_role` plus `board.owner_id`
- backend Board authorization now resolves through one `none/view/edit/manage/owner` capability ladder
- destructive Board copy/delete actions are owner-only; manage-level users may update metadata/share/members but cannot copy or delete
- cursor pagination, owner-only Board copy/delete, snapshot restore, board-member list/update/remove, people lookup, email invite, share-link create/revoke/resolve, share-link expiry checks and public share-token Board load now exist as first passes
- Board save/snapshot persistence now rejects known Asset references from another workspace, while explicit Asset-sharing allowlists remain a follow-up
- Board search/sort, `POST /boards/{id}/open` and page-scoped history filtering remain follow-ups
- later share hardening should map the user-facing labels this way:
  - `Can view` -> board `viewer`
  - `Can edit` -> board `editor`
  - `Can manage` -> board `admin`
  - `Owner` -> board `owner`

## 中文完整翻译

# PRD 切片 S1D：带 Auth 的 Board CRUD

**更新日期**：2026-05-06
**状态**：稳定的第一阶段 Board CRUD / member / share / public-share path 已经生效；owner-only copy/delete、share-link 过期校验、cross-workspace Asset reference blocking 和 backend effective-permission resolver 已经落地。

## 用户价值

Board 会成为真实账号拥有的文档。用户可以保存、重新打开、重命名、复制、删除和恢复 Board History，同时不会跨账号泄露数据。

## 需求

- Board list 支持 cursor pagination、search 和 sort。
- Board create / open / load / save / rename / copy / delete。
- Board History create / list / load / restore。
- Board metadata updates 带 role checks。
- Board member list 和 role update scaffold。
- Share / member 词汇映射到 `Can view / Can edit / Can manage / Owner`。
- Team-gated editing and management：初始产品方向中，非 team share recipients 保持 view-only。
- Asset references 必须根据 workspace access 校验。

## 验收

- 用户 A 不能读取或修改用户 B 的 private Board。
- Owner / admin 可以更新 metadata 和 members。
- Editor / member 可以保存 document 并创建 snapshots。
- Viewer / guest 不能保存。
- `Can manage` 可以 invite / share / rename / change visibility，但不能 copy 或 delete Board。
- `Owner` 可以 copy 和 delete Board。
- Share links 可以过期；过期或被 revoke 的 link 不能 resolve 或 load Board content。
- Board save 和 History snapshot creation 会拒绝已知属于另一个 workspace 的 Asset id。
- Board list 只返回 summaries。
- Board load 只有通过 permission check 后才返回 full document。
- History filter 支持 autosave / manual / keyboard。

## 当前第一阶段

当前已经交付的步骤故意小于最终 PRD 目标，但它已经不再只是原始 Board CRUD：

- authorization 基于已认证的 `workspace_role` 加 `board.owner_id`
- 破坏性的 Board copy/delete 动作是 owner-only；manage-level users 可以更新 metadata / share / members，但不能 copy 或 delete
- cursor pagination、owner-only Board copy/delete、snapshot restore、board-member list/update/remove、people lookup、email invite、share-link create/revoke/resolve、share-link expiry checks 和 public share-token Board load 现在都已经有第一阶段实现
- backend Board authorization 现在通过一个 `none/view/edit/manage/owner` capability ladder 解析
- Board save / snapshot persistence 现在会拒绝已知属于另一个 workspace 的 Asset references，但明确的 Asset-sharing allowlists 仍然是后续工作
- Board search/sort、`POST /boards/{id}/open` 和 page-scoped history filtering 仍然是后续工作
- 后续 share hardening 应该把用户可见 labels 这样映射：
  - `Can view` -> board `viewer`
  - `Can edit` -> board `editor`
  - `Can manage` -> board `admin`
  - `Owner` -> board `owner`
