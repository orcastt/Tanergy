# Current Project Progress

**Updated**: 2026-05-02  
**Canonical source**: root `project_state.md`

## Phase

TANGENT is in **local P0 polish after Slice E persistence foundations**.

The app is a Web-first AI image canvas. P0 still targets the minimum image workflow:

```text
Prompt Node -> Image Gen / Image Gen 4 -> Image Node
Image Node + Prompt Node -> Image Gen / Analysis -> Image Node / Prompt Node
Image Node -> Canvas Markup -> Merge Capture -> New Image Node
AI Chat -> create allowed nodes + edges -> user confirms Run
```

## Current Branch And Checkpoint

- Working branch: `feature/local-polish-fast-slices`.
- Latest pushed stable checkpoint before current uncommitted work: `847ed3c checkpoint: canvas polish and context indexes`.
- Current uncommitted work includes Board Refresh preview, History thumbnail preview, optional history `thumbnailUrl` contract and this ARCH/Project_state slice sync.

## Implemented First Passes

| Area | Status |
| --- | --- |
| Product Shell | `/home`, `/workspaces`, `/collections`, `/account`, `/settings`, `/team`, `/billing`, Auth visual shells. |
| Workspace | Board gallery/list, search, sort, Load more, create/open/rename/copy/delete, Board Manage. |
| Board Canvas | Autosave, dirty/back warning, title sync, save indicator, load/save failure states. |
| Board History | Autosave/manual/keyboard timeline, filters, author display, restore, bucket retention, preview thumbnails. |
| Board Management | Description, card color, thumbnail upload/remove/default, pin/star/visibility/share/member scaffold. |
| Captured Thumbnail | Save-time capture, manual Refresh preview, Workspace card preview and History thumbnails passed browser smoke. |
| Canvas Settings | Per-board dots/grid/solid backgrounds, spacing, snap, zoom and Smart Drawing toggle. |
| Smart Drawing | Local geometry recognizer first pass for line/open curve/ellipse/rectangle/triangle. |
| Persistence | Next local bridge, FastAPI local-dev, Postgres Board/Asset/History adapters, S3-compatible Asset adapter. |
| Database | P0 schema roadmap and Alembic scaffold. |
| Auth | Mock session/request context and route guard shape. |
| AI | Mock Model Registry and AiRun contract. |
| Admin | S0 schema/access/audit boundary documented; no production admin yet. |

## Not Production Complete

- Real email/Auth/session/JWT.
- Real workspace/team/Board member permissions.
- Public/private share link enforcement.
- Server-side Board pagination/search under real DB scale.
- Staging Postgres/R2/domain smoke.
- Real AI provider, model routes, AiRun persistence and cost logs.
- Credits, billing, subscriptions and revenue dashboard.
- Full Admin Analytics / Mixpanel-like dashboard.
- Multi-user collaboration and presence.

## Current Progress Percentages

| Track | Progress |
| --- | ---: |
| Local Product Shell | 90% |
| Board Save UX | 90% |
| Board History | 92% |
| Canvas Settings | 92% |
| Board Management | 86% |
| Captured Thumbnail | 85% |
| Smart Drawing | 60% |
| Database Schema | 75% |
| Auth Boundary | 35% |
| AI Productization | 15% |
| Admin S0 | 20% |
| Collaboration | 0% |

## Next Fork

If external resources are not ready:

1. Smart Drawing browser smoke and threshold tuning.
2. Long-session autosave/history regression.
3. i18n/status polish.

If external resources are ready:

1. Staging Postgres migration smoke.
2. R2/S3-compatible Asset upload/read smoke.
3. FastAPI CORS/domain smoke.
4. Web `NEXT_PUBLIC_API_BASE_URL` staging wiring.

## Do Not Regress

- Do not persist `data:`, `blob:` or Base64 image payloads in Board or History documents.
- Do not reintroduce independent left Node Inspector for P0.
- Do not treat mock Auth, Team, Billing, Admin or AI provider surfaces as production-complete.
- Do not open production `/admin` before server-side Auth and `admin_roles`.
- Do not read or modify `legacy/old-tangent-desktop-2026-04-29/` unless the user explicitly asks.
