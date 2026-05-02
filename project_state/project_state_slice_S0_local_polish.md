# Project State Slice S0: Local Polish

**Updated**: 2026-05-02
**Mode**: Fast UI/product polish unless data/API/Auth contracts change.

## Completed First Passes

| Area | Progress | Notes |
| --- | ---: | --- |
| Product Shell | 90% | Route semantics and five-tab navigation are coherent. |
| Workspace Board gallery/list | 88% | Search, sort, Load more, create/open/rename/copy/delete and Manage exist. |
| Board Save UX | 90% | Autosave, title sync, dirty/back warnings and save indicator exist. |
| Board History | 92% | Autosave/manual/keyboard timeline, filters, author display, thumbnails and restore exist. |
| Board Management | 86% | Metadata/member scaffold, thumbnail remove/default and permission states exist. |
| Canvas Settings | 92% | Per-board dots/grid/solid backgrounds and settings panel exist. |
| Captured Thumbnail | 85% | Refresh preview, Workspace card preview and History thumbnails passed smoke. |
| Smart Drawing | 82% | Line/rectangle/ellipse/triangle/doodle and immediate undo browser smoke passed. |

## Current Uncommitted Work

- Documentation restructure into `PRD/`, `ARCH/` and `project_state/` canonical folder indexes.
- Old duplicate short mirror files removed.
- Superseded active `dev-plans/` roadmaps moved to `dev-plans/Archive/`.
- Root `PRD.md`, `ARCH.md` and `project_state.md` have been reduced to pointers.

## Next Local Work

1. Long-session Board autosave / History regression.
2. Smart Drawing threshold tuning.
3. i18n/status polish.

## Validation Commands

Frontend:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
```

Backend/API:

```bash
PYTHONPATH=services/api python3 -m pytest services/api/tests
python3 -m compileall services/api/tangent_api services/api/migrations
```

Always:

```bash
git diff --check
```

## Do Not Regress

- No `data:`, `blob:` or Base64 image payloads in Board/History documents.
- No independent Node Inspector in P0.
- Mock Auth/Team/Billing/Admin/AI surfaces must stay visibly non-production.
