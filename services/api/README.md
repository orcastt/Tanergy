# API Service

Fresh backend/API work can start here if we decide not to reuse the legacy FastAPI backend directly.

P0 server responsibilities:

- Auth/session validation
- Board persistence
- Asset persistence
- AI proxy calls
- API call logs
- Credits/no-charge bookkeeping

Do not expose provider API keys to the browser.

## P0 Persistence Contract

The current Next.js local bridge in `apps/web/src/app/api` is a development harness for this future service. Keep these boundaries when replacing it with FastAPI:

- Resolve authenticated `userId` and `workspaceId` before touching Board or Asset storage.
- Asset create/upload returns an Asset record with `workspaceId`, `createdBy`, original URL and thumbnail URLs.
- Board save runs the Board document guard before persistence and rejects `data:`, `blob:` and base64 image payloads.
- Board save returns a board summary, not the full document.
- Board load checks workspace access and returns the saved document for restore.
- Object storage owns original images and thumbnails; Board documents only reference Asset URLs/ids and lightweight layout state.
