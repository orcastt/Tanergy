# Project State Slice S0: Local Polish

**Updated**: 2026-05-02
**Mode**: Accepted local polish; regression fixes only unless data/API/Auth contracts change.

## Completed First Passes

| Area | Progress | Notes |
| --- | ---: | --- |
| Product Shell | 95% | Route semantics, five-tab navigation and canvas header/home/workspace links are coherent. |
| Workspace Board gallery/list | 93% | Search, sort, Load more, create/open/rename/copy/delete, Manage and icon-led action menus exist. |
| Board Save UX | 94% | Autosave, title sync, dirty/back warnings, save indicator and long-session regression passed. |
| Board History | 95% | Autosave/manual/keyboard timeline, filters, author display, thumbnails, restore and reload regression passed. |
| Board Management | 93% | Metadata/member scaffold, thumbnail remove/default, permission states and wider panel polish exist. |
| Canvas Controls | 96% | Header switcher, floating selection toolbar, stable Properties drawer, distinct style icons and fixed tooltip layer exist. |
| Canvas Settings | 96% | Per-board dots/grid/solid backgrounds render behind drawings and settings panel is simplified. |
| Captured Thumbnail | 91% | Refresh preview, Workspace card preview and History thumbnails passed smoke. |
| Smart Drawing | 95% | Line/rectangle/ellipse/triangle/doodle and immediate undo browser smoke passed; curve tolerance accepted for local P0 alpha. |

## Latest Regression

- `2026-05-02`: Workspace Board Panel / Canvas Settings UI polish smoke passed. Copy board now persists the displayed card color, visibility badges use crisp SVG icons, Board Panel fits its primary actions without clipping, and dots/grid render as subtle gray tldraw background instead of an overlay.
- `2026-05-02`: Canvas side Properties panel now preserves the last drawing-tool style context after blank-canvas clicks or node/card selection. Style controls update selected drawable shapes when applicable; otherwise they only update the next drawing defaults.
- `2026-05-02`: Smart Drawing curve tolerance raised for more reliable cubic/Bezier cleanup.
- `2026-05-02`: Canvas board header now uses a logo link to `/home`, removes the old eyebrow/status badges, and adds a recent-board switcher with the five most recently opened boards plus a new-board action.
- `2026-05-02`: Board Panel widened with more inner spacing, regular-weight typography, and removed helper subtitle copy from sidebar, section headings, thumbnail preview and members scaffold.
- `2026-05-02`: Properties panel Width/Dash icons redrawn for distinct stroke-weight and dash styles; Properties and top canvas toolbar icon buttons now use black hover tooltips instead of relying on native title hints.
- `2026-05-02`: Workspace board action menu now uses leading line SVG icons for share, open, star, pin, rename, copy, manage, visibility and delete actions.
- `2026-05-02`: Canvas Settings sidebar tabs removed; panel now uses a single adaptive content area, regular-weight typography, `Standard / Color` edge labels, no pattern color control, and low-opacity dots/grid render through the tldraw Grid layer behind shapes.
- `2026-05-02`: Restored the floating selection toolbar above selected canvas objects for image-node conversion, merge capture and alignment. This toolbar is separate from the fixed left Properties drawer and must not be removed during drawer polish.
- `2026-05-02`: Canvas top toolbar and floating selection toolbar now use a shared line-SVG icon set with consistent stroke weight instead of mixed glyph/emoji icons.
- `2026-05-02`: Canvas interaction polish and Smart Drawing are accepted for local P0 alpha. Header navigation, board switcher, fixed Properties drawer, floating selection toolbar, tooltips, Canvas Settings and Smart Drawing should only receive regression fixes unless a browser smoke finds a concrete issue.
- `2026-05-02`: real browser long-session Board autosave / History regression passed on `regression-autosave-long`.
- Covered 6 sequential autosaves, one debounced quick-edit autosave, manual Snapshot, Cmd/Ctrl+S, reload load consistency and History filters.
- API counts after reload: 9 history entries, 7 autosaves, 2 user saves.
- Restore follow-up passed separately on `regression-autosave-history`, including restore-to-5-shapes and follow-up autosave.

## Next Local Work

1. Final browser smoke over `/workspaces` and one `/boards/:boardId`: board action menu icons, Board Panel layout, canvas header switcher, floating selection toolbar, Properties tooltip layer, Width/Dash icons and Canvas Settings dots/grid.
2. Checkpoint current S0 accepted state.
3. Move to S1 readiness: schema/migration plan, Auth ownership boundary, staging Postgres/R2/domain smoke and Auth-backed Board CRUD.
4. Only tune Smart Drawing or the Properties drawer again if hand testing reports a specific regression.

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
- Do not remove the floating selection toolbar above selected canvas objects; it owns quick image-node conversion, merge capture and alignment.
- Mock Auth/Team/Billing/Admin/AI surfaces must stay visibly non-production.
