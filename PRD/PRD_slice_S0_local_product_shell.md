# PRD Slice S0: Local Product Shell

**Updated**: 2026-05-02
**Mode**: Accepted local product polish; regression fixes only unless persistence/API/Auth changes are introduced.

## Goal

Make the local app feel like a coherent P0 alpha surface without pretending that production Auth, billing, team permissions, real AI providers or collaboration are finished.

## User-Visible Surfaces

| Surface | Requirement | Status |
| --- | --- | --- |
| App Shell | Top nav: Landing page, Workspace, Collection, Team, Subscription. Landing page is not in sidebar. Account and Settings stay in sidebar. | Done first pass |
| Auth visual shell | Login, signup, forgot password and verify-email pages are visual/form shells only. | Done first pass |
| Workspace | Board gallery/list with search, sort, create/open/rename/copy/delete, Load more, Manage entry and icon-led action menus. | Polished first pass |
| Board canvas | Autosave, dirty/back warning, title sync, save indicator, load/save failure states. | Done first pass |
| Board History | Autosave/manual/keyboard entries, filters, author display, preview thumbnails, restore. | Done first pass |
| Board Management | Description, card color, thumbnail upload/remove/default, pin/star/visibility/share/member scaffold. | Polished first pass |
| Canvas Header | Return to Workspace, logo to Home, recent-board switcher and new-board action. | Polished first pass |
| Canvas Controls | Top toolbar, floating selection toolbar and Properties panel with stable drawer, distinct style icons and hover tooltips. | Accepted for local P0 alpha |
| Canvas Settings | Per-board dots/grid/solid backgrounds, spacing, snap, zoom, Smart Drawing toggle. | Accepted for local P0 alpha |
| Smart Drawing | High-confidence strokes fit to line/geo shapes; low-confidence doodles stay draw shapes; immediate undo works. | Accepted for local P0 alpha |

## Acceptance Already Met

- Route/responsive smoke for product shell.
- Board autosave / rename / Back warning / multi-image paste regression.
- Board History autosave / Snapshot / Cmd/Ctrl+S / Restore-dirty-autosave smoke.
- Long-session Board autosave / History regression: sequential autosaves, debounced quick edits, manual save, keyboard save, reload consistency and History filters.
- Refresh preview / Workspace card / History thumbnail smoke.
- Smart Drawing line / rectangle / ellipse / triangle / doodle and immediate undo smoke.
- Canvas header/switcher, Board Panel layout, board action menu icons, floating selection toolbar, Properties drawer/tooltips and Canvas Settings background polish implemented.
- Canvas interaction and Smart Drawing are accepted for local P0 alpha; do regression fixes only unless hand smoke finds a specific issue.

## Remaining Local Acceptance

1. Final browser smoke over Workspace menu, Board Panel, Canvas header/switcher, floating selection toolbar, Properties tooltips and Canvas Settings backgrounds.
2. Checkpoint S0 accepted state.
3. Local-only follow-up is regression fixes, i18n/status polish and more realistic empty/error states.
4. New product work should move to S1 unless a specific S0 regression appears.

## Non-Goals

- No real Auth/session/email.
- No real team invites or share permission enforcement.
- No Stripe or subscription enforcement.
- No real AI provider calls.
- No production `/admin`.
- No multi-user collaboration.
