# Project State Slice S1D: Auth-Backed Board CRUD

**Updated**: 2026-05-02
**Status**: After S1C.

## Objective

Route Board and History operations through real FastAPI permissions instead of dev identity.

## Work Items

- [ ] Board list cursor pagination.
- [ ] Board load/save with permission checks.
- [ ] Board metadata update permission checks.
- [ ] Board copy/delete with ownership rules.
- [ ] Board History create/list/load/restore with permission checks.
- [ ] Board member scaffold APIs.
- [ ] Cross-user isolation tests.

## Validation

- [ ] User A cannot list/load/save/delete User B private Board.
- [ ] Editor can save but cannot change members/security metadata.
- [ ] Viewer cannot save.
- [ ] History list remains summary-only and scoped.
- [ ] Guard rejects `data:` and `blob:` documents.
