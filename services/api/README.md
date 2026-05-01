# API Service

Fresh FastAPI service scaffold for the TANGENT Web AI image canvas.

P0 server responsibilities:

- Auth/session validation
- Board persistence
- Asset persistence
- AI proxy calls
- API call logs
- Credits/no-charge bookkeeping

Do not expose provider API keys to the browser.

## Local Run

```bash
cd services/api
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
uvicorn tangent_api.main:app --reload --port 8000
```

Useful checks:

```bash
python3 -m compileall tangent_api
PYTHONPATH=. python3 -m pytest tests
curl http://127.0.0.1:8000/health
```

## P0 Persistence Contract

The current Next.js local bridge in `apps/web/src/app/api` is a development harness for this future service. Keep these boundaries when replacing it with FastAPI:

- Resolve authenticated `userId` and `workspaceId` before touching Board or Asset storage.
- Asset create/upload returns an Asset record with `workspaceId`, `createdBy`, original URL and thumbnail URLs.
- Board save runs the Board document guard before persistence and rejects `data:`, `blob:` and base64 image payloads.
- Board save returns a board summary, not the full document.
- Board load checks workspace access and returns the saved document for restore.
- Object storage owns original images and thumbnails; Board documents only reference Asset URLs/ids and lightweight layout state.

## Current Scaffold

Implemented now:

- `/health`
- `POST /api/v1/boards/validate-document`
- `POST /api/v1/boards` local file-backed save
- `GET /api/v1/boards/{board_id}` local file-backed load
- `POST /api/v1/assets/from-data-url` local file-backed asset create
- `POST /api/v1/assets/upload` local file-backed upload
- `GET /api/v1/assets/{asset_id}` local metadata read
- `GET /api/v1/assets/files/{asset_id}/{file_name}` local file read
- Asset storage adapter seam with `local-dev` and explicit `s3-compatible` placeholder driver
- Shared request context parsing for `x-tangent-user-id` / `x-tangent-workspace-id`
- Board document guard parity with the current Next local bridge

Explicitly not implemented yet:

- Database-backed Board persistence
- R2/S3-backed Asset storage; `TANGENT_ASSET_STORAGE_DRIVER=s3-compatible` currently fails with a configuration-aware 501
- Auth/JWT/session validation
- AI provider proxy and run logs
