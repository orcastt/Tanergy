# Project State Slice S1: Staging, Auth And Board

**Updated**: 2026-05-02
**Status**: Planned; waiting on external resources.

## Needed External Resources

- Staging API server or VPS.
- Managed Postgres or staging Postgres instance.
- R2/S3-compatible bucket and credentials.
- Staging domain and TLS.
- Email provider and sender-domain setup.
- tldraw production license before production deploy.

## First Checks When Resources Exist

1. FastAPI `/health` on public staging.
2. CORS from staging Web origin.
3. Asset upload/read.
4. Board save/load/history create/list/load.
5. Guard rejects `data:` / `blob:`.
6. Web app uses `NEXT_PUBLIC_API_BASE_URL`.

## Not Started

- Real Auth.
- Real workspace membership.
- Real Board member/share permissions.
- Server-side pagination under real DB scale.
