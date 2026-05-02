# Project State Slice S0: Local Polish

**Updated**: 2026-05-02
**Mode**: Fast UI/product polish unless data/API/Auth contracts change.

## Completed First Passes

| Area | Progress | Notes |
| --- | ---: | --- |
| Product Shell | 90% | Route semantics and five-tab navigation are coherent. |
| Workspace Board gallery/list | 88% | Search, sort, Load more, create/open/rename/copy/delete and Manage exist. |
| Board Save UX | 92% | Autosave, title sync, dirty/back warnings, save indicator and long-session regression passed. |
| Board History | 94% | Autosave/manual/keyboard timeline, filters, author display, thumbnails, restore and reload regression passed. |
| Board Management | 86% | Metadata/member scaffold, thumbnail remove/default and permission states exist. |
| Canvas Settings | 92% | Per-board dots/grid/solid backgrounds and settings panel exist. |
| Captured Thumbnail | 85% | Refresh preview, Workspace card preview and History thumbnails passed smoke. |
| Smart Drawing | 82% | Line/rectangle/ellipse/triangle/doodle and immediate undo browser smoke passed. |

## Latest Regression

- `2026-05-02`: real browser long-session Board autosave / History regression passed on `regression-autosave-long`.
- Covered 6 sequential autosaves, one debounced quick-edit autosave, manual Snapshot, Cmd/Ctrl+S, reload load consistency and History filters.
- API counts after reload: 9 history entries, 7 autosaves, 2 user saves.
- Restore follow-up passed separately on `regression-autosave-history`, including restore-to-5-shapes and follow-up autosave.

## Next Local Work

1. Smart Drawing threshold tuning.
2. i18n/status polish.
3. More realistic empty/error states for mocked production surfaces.

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
