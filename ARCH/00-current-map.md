# Current Architecture Map

**Updated**: 2026-05-02  
**Canonical source**: root `ARCH.md`

## Current System

```text
Next.js Product Shell
  -> /workspaces Board gallery/list
  -> /boards/:boardId tldraw canvas
  -> Next local bridge OR FastAPI /api/v1

tldraw Canvas Runtime
  -> regular drawing shapes/images/text/arrows
  -> AI node cards with self-contained controls
  -> Node Runtime SVG data edges
  -> fixed left drawing properties drawer
  -> Canvas Settings panel
  -> Board save/autosave/history

Persistence Boundary
  -> Board document JSON guarded against data/blob/base64
  -> Board summary metadata in local/FastAPI/Postgres contract
  -> Board History summary/list/load contract
  -> Asset files through local bridge or S3-compatible adapter

Future Server Truth
  -> Auth/session/workspaces
  -> AiRun/model registry/API cost logs
  -> Credits/billing/admin/audit/analytics
  -> Collaboration after P0
```

## Progress Snapshot

Percentages mean distance to **P0 Alpha usable**, not final commercial completeness.

| Track | Progress | Notes |
| --- | ---: | --- |
| Local Product Shell | 90% | Routes, workspaces, account/settings/team/billing placeholders are usable locally. |
| Board Save UX | 90% | Autosave, dirty warning, title sync and browser smoke passed. |
| Board History | 90% | Autosave/manual/keyboard history with filters and bucketed retention. |
| Canvas Settings | 92% | Reference-style panel, per-board settings, subtle background grid/dots. |
| Board Management | 86% | Metadata panel, color, thumbnail upload/remove, pin/visibility badges. |
| Captured Thumbnail | 65% | Save-time first pass; manual refresh/history thumbnails still pending. |
| Smart Drawing | 60% | Recognizer and hook landed; browser tuning still pending. |
| Database Schema | 75% | Alembic scaffold and P0 schema roadmap exist; real staging DB pending. |
| Auth Boundary | 35% | Mock session and request context scaffold; real email/session pending. |
| AI Productization | 15% | Mock Model Registry/AiRun only; real provider pending. |
| Admin S0 | 20% | Schema/access/audit plan only; production admin waits for real Auth. |
| Collaboration | 0% | P0.5 after Auth/Board/Asset/AiRun boundaries stabilize. |
| Context Index Split | 100% | `ARCH/` and `Project_state/` short context layers are in place for faster handoffs. |

## Current Fork

If external resources are **not** ready, continue local polish:

- Manual thumbnail refresh and History preview.
- Smart Drawing browser smoke and threshold tuning.
- Long-session Board autosave/History regression.
- i18n/status polish.

If external resources **are** ready, switch to staging:

- Managed Postgres + R2/S3 + domain + TLS.
- FastAPI `/health`, CORS, Asset upload/read, Board save/load/history smoke.
- Web `NEXT_PUBLIC_API_BASE_URL` staging wiring.
