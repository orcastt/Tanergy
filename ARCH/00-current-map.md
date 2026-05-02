# Current Architecture Map

**Updated**: 2026-05-02  
**Canonical source**: root `ARCH.md` sections 3.1, 3.3, 11.5, 11.5.1

## System Diagram

Current project shape: **Next.js Product Shell + tldraw Canvas Runtime + Next local bridge / FastAPI dual API path + Postgres/Object Storage persistence boundary**.

Local development defaults to the Next local bridge. When `NEXT_PUBLIC_API_BASE_URL` is set, Web clients switch to the FastAPI `/api/v1` contract.

```text
----------------------------------------------------------------------------------+
| Browser                                                                          |
|                                                                                  |
|  Product Shell routes                                                            |
|    /home                                                                         |
|    /workspaces  -> Board gallery/list + Board Management Panel                   |
|    /boards/:id  -> tldraw Canvas + Node Runtime + Board Save/History             |
|    /collections /account /settings /team /billing                                |
|    /login /signup /forgot-password /verify-email                                 |
|                                                                                  |
|  Canvas Runtime                                                                  |
|    tldraw editor                                                                 |
|    custom node_card shapes                                                       |
|    Node Runtime SVG data edges                                                   |
|    fixed drawing properties drawer + Canvas Settings                             |
|    Asset preview resolver + LOD state                                            |
|                                                                                  |
|  Web feature clients                                                             |
|    features/boards          serialize/restore/guard/client/history metadata      |
|    features/assets          upload client/runtime migration/thumbnail resolver   |
|    features/ai              mock Model Registry / AiRun client                   |
|    features/auth            mock session boundary                                |
|    features/canvas-settings per-board lightweight settings                       |
|                                                                                  |
|  Default local path                                                              |
|    Next route handlers                                                           |
|      /api/assets/*                                                               |
|      /api/boards/local-list|load|save|rename|update|delete|snapshot|snapshots    |
|      /api/boards/validate-document                                               |
|      /api/auth/session                                                           |
|      /api/ai/models|runs                                                         |
|    local-dev files                                                               |
|      .tangent-assets/                                                            |
|      .tangent-boards/                                                            |
|                                                                                  |
|  Staging/prod path                                                               |
|    FastAPI services/api                                                          |
|      routers/auth.py       dev session now, real Auth later                      |
|      routers/assets.py     upload/read/file route                                |
|      routers/boards.py     validate/list/save/load/patch/delete/history          |
|      routers/ai.py         mock Model Registry / AiRun now                       |
|      storage/*            local-dev, S3-compatible, Postgres adapters            |
|    PostgreSQL                                                                    |
|      tangent_boards / tangent_board_snapshots / tangent_assets                   |
|      target users/workspaces/admin/credits/ai/analytics tables                   |
|    Object Storage                                                                |
|      local .tangent-assets/ now, R2/S3-compatible bucket later                   |
+----------------------------------------------------------------------------------+
```

## Non-Negotiable Boundaries

- Board list, save response and History list return summary only. Only explicit load returns full `document`.
- Board document and Board History document both pass the guard.
- Do not persist `data:`, `blob:`, Base64 image payloads, provider raw responses or long logs.
- Board Management title/description/card color/thumbnail/star/pin/share/visibility are summary metadata, not Board document fields.
- `canvasSettings` is allowed in Board document only as small UI JSON: background, spacing, snap/zoom and display preferences.
- Auth/Admin/Team/Billing are shell or schema boundary until real server-side Auth exists.
- Production permissions must come from FastAPI session + DB roles, not frontend-provided role strings.

## Layering Rules

```text
UI components
  -> feature clients / hooks
    -> Next local bridge OR FastAPI client
      -> request context
        -> storage adapter
          -> local files / Postgres / S3-compatible object storage
```

Short form:

- `components/*` render UI and orchestrate user actions.
- `features/*` hold contracts, serializers, clients, runtime helpers and guards.
- `app/api/*` is a local development bridge, not production authority.
- `services/api/routers/*` expose production-shaped HTTP contracts.
- `services/api/storage/*` own persistence adapters.
- `services/api/migrations/*` own staging/prod schema evolution.
- `legacy/old-tangent-desktop-2026-04-29/` is archive-only unless the user explicitly asks.

## Parallel Development Lanes

Percentages mean distance to **P0 Alpha usable**, not final commercial completeness.

```text
                         +--------------------------------+
                         | Base [90%]                    |
                         | Canvas / Asset / Board        |
                         | S1.5 + Slice E local passes   |
                         +----------------+---------------+
                                          |
     +------------------------------------+------------------------------------+
     |                                    |                                    |
+----v-------------+                +-----v-------------+                +-----v----------+
| Local UX [89%]   |                | Data/Backend [35%]|                | AI/Node [30%] |
| product polish   |                | real boundary     |                | contract      |
+----+-------------+                +-----+-------------+                +-----+----------+
     |                                    |                                    |
+----v-----------------+          +-------v----------------+          +--------v---------------+
| Board save UX [90%]  |          | P0 DB schema [75%]     |          | Model Registry [35%]   |
| Board History [92%]  |          | Alembic scaffold [80%] |          | AiRun / logs [20%]     |
| Canvas Settings [92%]|          | Auth boundary [35%]    |          | AI Chat planner [10%]  |
| Board Mgmt [86%]     |          | staging Postgres [0%]  |          | image models [25%]     |
| Captured thumb [78%] |          | R2 / domains [0%]      |          +--------+---------------+
| Smart Drawing [60%]  |          +-------+----------------+                   |
+----+-----------------+                  |                                    |
     |                                    |                                    |
     +-----------------------+------------+------------+-----------------------+
                             |                         |
                    +--------v---------+       +-------v--------+
                    | Auth / Board [25%]|      | Alpha/Ops [10%]|
                    | CRUD product      |      | safety/logs    |
                    | users/workspaces  |      | backup/rate    |
                    +--------+---------+       +-------+--------+
                             |                         |
                             +-----------+-------------+
                                         |
                                +--------v--------+
                                | P0.5 Collab [0%]|
                                | presence/sync   |
                                +-----------------+
```

## Slice Progress Snapshot

| Track | Progress | Current state |
| --- | ---: | --- |
| Local Product Shell | 90% | Routes, workspaces, account/settings/team/billing placeholders are usable locally. |
| Board Save UX | 90% | Autosave, dirty warning, title sync, save indicator and browser smoke have passed. |
| Board History | 92% | Autosave/manual/keyboard history, filters, author display and thumbnail previews exist. |
| Canvas Settings | 92% | Reference-style panel, per-board settings, subtle background grid/dots. |
| Board Management | 86% | Metadata panel, color, thumbnail upload/remove, pin/star/visibility/share/member scaffold. |
| Captured Thumbnail | 85% | Save-time capture, manual Refresh preview, Workspace card preview and History thumbnails passed browser smoke. |
| Smart Drawing | 60% | Recognizer and hook landed; browser tuning still pending. |
| Database Schema | 75% | Alembic scaffold and P0 schema roadmap exist; real staging DB pending. |
| Auth Boundary | 35% | Mock session and request context scaffold; real email/session pending. |
| AI Productization | 15% | Mock Model Registry/AiRun only; real provider pending. |
| Admin S0 | 20% | Schema/access/audit plan only; production admin waits for real Auth. |
| Collaboration | 0% | P0.5 after Auth/Board/Asset/AiRun boundaries stabilize. |
| Context Index Split | 100% | `ARCH/` and `Project_state/` short context layers exist and now mirror root diagrams/details. |

## Standard Slice Flow

```text
+-------------+
| 1. Boundary |  Define what this slice does and does not do
+------+------+
       |
+------v------+
| 2. Thin cut |  Build the narrowest contract / UI / storage seam
+------+------+
       |
+------v------+
| 3. Reuse    |  Reuse local bridge / mock / adapter patterns
+------+------+
       |
+------v------+
| 4. Smoke    |  Make local smoke or browser smoke pass first
+------+------+
       |
+------v------+
| 5. Tighten  |  Keep only summary / id / short params in documents
+------+------+
       |
+------v------+
| 6. Record   |  Record done state, remaining risk and next cut
+------+------+
       |
+------v------+
| 7. Converge |  Continue local polish or switch to staging
+-------------+
```

## Active Slice Cards

```text
S0I Captured Board Thumbnail [85%]
  canvas capture
      -> upload as Asset / thumbnail metadata [done]
      -> board.thumbnailUrl summary [done]
      -> Workspace card renders real preview [done]
      -> Refresh preview manual action [done]
      -> History thumbnail summary [done]
      -> browser visual smoke: save / refresh / workspace card / history [passed]

S0J Smart Drawing [60%]
  draw stroke
      -> local recognizer [done]
      -> confidence check [done]
      -> convert to normal line/geo OR keep original stroke [done]
      -> settings toggle [done]
      -> frontend gates + recognizer smoke [done]
      -> browser smoke: line / ellipse / rectangle / triangle / doodle / undo [pending]

S1-S2 Staging Persistence [20%]
  Postgres + R2 + domain
      -> env / Docker / migration
      -> FastAPI health + CORS
      -> Asset upload/read + Board save/load/history
      -> Web points to NEXT_PUBLIC_API_BASE_URL

S5-S7 Real Auth [15%]
  users/workspaces schema
      -> email OTP or magic link
      -> session/JWT request context
      -> protect /workspaces and /boards
      -> workspace isolation smoke

S11-S15 AI Productization [15%]
  Model Registry + provider route
      -> AI proxy + AiRun + api call logs
      -> result images become Assets
      -> Image Gen / Image Gen 4 / Analysis real runs
      -> AI Chat planner creates valid node graph

S20-S22 Collaboration [0%]
  choose sync tech
      -> presence / soft locks
      -> lightweight collaborative document
      -> server authority for Asset / AiRun / credits
      -> reconnect / conflict / stress smoke
```

## Current Fork

If external resources are **not** ready:

- Smart Drawing browser smoke and threshold tuning.
- Long-session Board autosave/History regression.
- i18n/status polish.

If external resources **are** ready:

- Managed Postgres + R2/S3 + domain + TLS.
- FastAPI `/health`, CORS, Asset upload/read, Board save/load/history smoke.
- Web `NEXT_PUBLIC_API_BASE_URL` staging wiring.
