# PRD Slice S0: Local Product Shell

**Updated**: 2026-05-02
**Mode**: Fast local product polish unless persistence/API/Auth changes are introduced.

## Goal

Make the local app feel like a coherent P0 alpha surface without pretending that production Auth, billing, team permissions, real AI providers or collaboration are finished.

## User-Visible Surfaces

| Surface | Requirement | Status |
| --- | --- | --- |
| App Shell | Top nav: Landing page, Workspace, Collection, Team, Subscription. Landing page is not in sidebar. Account and Settings stay in sidebar. | Done first pass |
| Auth visual shell | Login, signup, forgot password and verify-email pages are visual/form shells only. | Done first pass |
| Workspace | Board gallery/list with search, sort, create/open/rename/copy/delete, Load more and Manage entry. | Done first pass |
| Board canvas | Autosave, dirty/back warning, title sync, save indicator, load/save failure states. | Done first pass |
| Board History | Autosave/manual/keyboard entries, filters, author display, preview thumbnails, restore. | Done first pass |
| Board Management | Description, card color, thumbnail upload/remove/default, pin/star/visibility/share/member scaffold. | Done first pass |
| Canvas Settings | Per-board dots/grid/solid backgrounds, spacing, snap, zoom, Smart Drawing toggle. | Done first pass |
| Smart Drawing | High-confidence strokes fit to line/geo shapes; low-confidence doodles stay draw shapes; immediate undo works. | Browser smoke passed |

## Acceptance Already Met

- Route/responsive smoke for product shell.
- Board autosave / rename / Back warning / multi-image paste regression.
- Board History autosave / Snapshot / Cmd/Ctrl+S / Restore-dirty-autosave smoke.
- Refresh preview / Workspace card / History thumbnail smoke.
- Smart Drawing line / rectangle / ellipse / triangle / doodle and immediate undo smoke.

## Remaining Local Acceptance

- Long-session Board autosave / History regression.
- Smart Drawing threshold tuning and optional strength setting.
- i18n/status polish for visible product strings.
- More realistic empty/error states where production data is still mocked.

## Non-Goals

- No real Auth/session/email.
- No real team invites or share permission enforcement.
- No Stripe or subscription enforcement.
- No real AI provider calls.
- No production `/admin`.
- No multi-user collaboration.
