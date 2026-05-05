# Project State Slice S1D: Auth-Backed Board CRUD

**Updated**: 2026-05-05
**Status**: First-pass workspace-role authorization is now in the Postgres Board/History path; board-member and pagination work remain.

## Objective

Route Board and History operations through real FastAPI permissions instead of dev identity.

## Work Items

- [ ] Board list cursor pagination.
- [x] Board load/save with first-pass permission checks.
- [x] Board metadata update permission checks.
- [~] Board copy/delete with ownership rules. Delete first pass is in; copy is still pending.
- [~] Board History create/list/load/restore with permission checks. Create/list/load/clear first pass is in; restore is still pending.
- [ ] Board member scaffold APIs.
- [x] Cross-user isolation tests first pass.

## Current First Pass

- Postgres Board CRUD now uses `workspace_role` plus `owner_id` to enforce:
  - `owner/admin/member` can create and save Board documents.
  - `guest` is read-only.
  - metadata update and delete require `owner/admin` or the actual Board owner.
- Existing Board saves no longer overwrite `owner_id` when another permitted collaborator saves.
- New Postgres Boards seed an owner row into `tangent_board_members`.
- Snapshot create requires Board write access.
- Snapshot clear requires Board manage access.
- Guest list/load is limited by visibility/ownership in the current workspace-role first pass.

## Validation

- [x] User A cannot list/load/save/delete User B private Board first pass inside the Postgres permission path.
- [~] Editor/member can save but cannot change security/destructive metadata. Workspace member save is covered; explicit board-member editor/viewer roles are still pending.
- [x] Viewer/guest cannot save in the first-pass role gate.
- [x] History list remains summary-only and scoped.
- [ ] Guard rejects `data:` and `blob:` documents.
