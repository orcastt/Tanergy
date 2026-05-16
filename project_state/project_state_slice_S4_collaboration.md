# Project State Slice S4: Collaboration

**Updated**: 2026-05-16
**Status**: Planned next slice. Collaboration is still outside the current release promise, but the next implementation order is now explicit and can start once the remaining signed-in browser, Google/email and live AI gates are closed.

## Current Truth

- The local/provider-shaped Yjs bridge already exists with reconnect/resync smoke and a permission-aware websocket room foundation.
- Workspace invite links, workspace member roles and board member roles already exist in the backend/frontend stack; collaboration does not need a second membership model.
- Canonical visible collaboration roles should now be treated as `owner/admin/editor/viewer` for workspaces, with board roles `owner/admin/editor/viewer/temporary_viewer`.
- Current account-deletion hard-delete is live, but paid Team/Group membership cleanup still needs another blocker pass before collaboration scale-up.

## Reuse First

- `tangent_workspace_invitations`
- `tangent_workspace_members`
- `tangent_board_members`
- existing Team/Group invite create/accept/revoke routes
- existing board permission resolver and owner-only board delete/copy rules
- existing websocket room plus Yjs awareness/document bridge

## Next Implementation Order

1. Invite-link and membership acceptance path in the real workspace shell.
2. Canonical role language cleanup in product UI: `owner/admin/editor/viewer`.
3. Live collaborator presence: cursor, name, active page and current tool.
4. Sensitive-edit occupancy for node params and text-like edit modes.
5. Optimistic sync for draw/move/page operations without global board locks.

## Do Not Drift

- Do not let Yjs awareness become the permission source.
- Do not treat all canvas edits as hard-locked; use occupancy only for sensitive focused editing.
- Do not create a second invite schema when the current Team/Group invite tables already exist.
