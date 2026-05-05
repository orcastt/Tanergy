# PRD Slice S1D: Auth-Backed Board CRUD

**Updated**: 2026-05-05
**Status**: Workspace-role first pass is active in the Postgres Board CRUD path.

## User Value

Boards become real account-owned documents. Users can save, reopen, rename, copy, delete and restore Board History without leaking data across accounts.

## Requirements

- Board list with cursor pagination, search and sort.
- Board create/open/load/save/rename/copy/delete.
- Board History create/list/load/restore.
- Board metadata updates with role checks.
- Board member list and role update scaffold.
- Asset references validated against workspace access.

## Acceptance

- User A cannot read or mutate User B's private Board.
- Owner/admin can update metadata and members.
- Editor/member can save document and create snapshots.
- Viewer/guest cannot save.
- Board list returns summaries only.
- Board load returns full document only after permission check.
- History filter supports autosave/manual/keyboard.

## First-Pass Note

The current shipped step is intentionally smaller than the final PRD target:

- authorization is based on authenticated `workspace_role` plus `board.owner_id`
- destructive metadata/history actions are limited to `owner/admin` or actual owner
- full `board_members` routes, copy, restore and cursor pagination remain in the next tranche
