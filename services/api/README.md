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

## Database Migrations

Local smoke can still use adapter auto-create, but staging/production should run Alembic before API traffic:

```bash
cd services/api
DATABASE_URL=postgresql://... alembic upgrade head
```

For staging/production, set `TANGENT_POSTGRES_AUTO_CREATE_TABLES=0` after migrations are in place so schema changes remain controlled.

## Staging

The first staging package lives in `deploy/staging/`.

It includes:

- `services/api/Dockerfile`
- `deploy/staging/docker-compose.api.yml`
- `deploy/staging/api.env.example`
- `deploy/staging/README.md`

Use it for a private VPS + managed Postgres + R2 smoke before production.

## P0 Persistence Contract

The current Next.js local bridge in `apps/web/src/app/api` is a development harness for this future service. Keep these boundaries when replacing it with FastAPI:

- Resolve authenticated `userId` and `workspaceId` before touching Board or Asset storage.
- Asset create/upload returns an Asset record with `workspaceId`, `createdBy`, original URL and thumbnail URLs.
- Board save runs the Board document guard before persistence and rejects `data:`, `blob:` and base64 image payloads.
- Board save returns a board summary, not the full document.
- Board load checks workspace access and returns the saved document for restore.
- Board History create also runs the guard; history list returns summaries only, while history load returns the saved document.
- Object storage owns original images and thumbnails; Board documents only reference Asset URLs/ids and lightweight layout state.

## Current Scaffold

Implemented now:

- `/health`
- `POST /api/v1/boards/validate-document`
- `POST /api/v1/boards` adapter-backed save
- `GET /api/v1/boards` adapter-backed summary list
- `GET /api/v1/boards/{board_id}` adapter-backed load
- `PATCH /api/v1/boards/{board_id}` adapter-backed rename
- `DELETE /api/v1/boards/{board_id}` adapter-backed delete
- `POST /api/v1/boards/{board_id}/snapshots` adapter-backed history create
- `GET /api/v1/boards/{board_id}/snapshots` adapter-backed history list
- `DELETE /api/v1/boards/{board_id}/snapshots` adapter-backed history clear
- `GET /api/v1/boards/{board_id}/snapshots/{snapshot_id}` adapter-backed history load
- `POST /api/v1/assets/from-data-url` adapter-backed asset create
- `POST /api/v1/assets/upload` adapter-backed upload
- `GET /api/v1/assets/{asset_id}` adapter-backed metadata read
- `GET /api/v1/assets/files/{asset_id}/{file_name}` adapter-backed file read
- Asset storage adapter seam with `local-dev` and `s3-compatible`
- Optional Postgres Board persistence via `TANGENT_BOARD_STORAGE_DRIVER=postgres`
- Optional Postgres Asset metadata via `TANGENT_ASSET_METADATA_DRIVER=postgres`
- Alembic scaffold with the P0 core schema migration
- CORS allowlist via `TANGENT_ALLOWED_ORIGINS`
- Shared request context parsing for `x-tangent-user-id` / `x-tangent-workspace-id`
- Board document guard parity with the current Next local bridge
- Clerk bearer verification first pass with issuer/audience/authorized-party checks
- First-session local user, default solo workspace and personal wallet creation
- Admin bootstrap script for granting `admin_roles` by local user id or login email
- Opt-in admin/operator demo seed script for dense local QA data

Explicitly not implemented yet:

- Native OTP/password Auth and session revocation
- AI provider proxy and run logs
- Backup/restore automation

## Auth/Admin Production Boundary

For staging/prod admin smoke:

1. Set `TANGENT_REQUIRE_API_AUTH=1`.
2. Set `TANGENT_ALLOWED_ORIGINS` and `CLERK_AUTHORIZED_PARTIES` to the deployed Web origin.
3. Sign in once with Clerk so `/api/v1/auth/session` creates the local TANGENT user, solo workspace and personal wallet.
4. Grant admin access with:

```bash
DATABASE_URL=postgresql://... \
PYTHONPATH=services/api \
python3 services/api/scripts/s3_admin_bootstrap.py --email operator@example.com --role owner
```

Optional demo data seed:

```bash
DATABASE_URL=postgresql://... \
PYTHONPATH=services/api \
python3 services/api/scripts/seed_admin_operator_demo.py
```

Use `--clean-only` to remove the same namespaced demo rows without reseeding. The script refuses non-local database hosts unless you pass `--allow-remote`.

Optional real-token smoke:

```bash
S1C_SMOKE_BASE_URL=https://api-staging.example.com \
S1C_SMOKE_ORIGIN=https://staging.example.com \
S1C_SMOKE_BEARER_TOKEN=<real-clerk-token> \
python3 services/api/scripts/s1c_remote_admin_smoke.py
```

The local `x-tangent-user-id` and `x-tangent-workspace-id` headers are ignored as authority when `TANGENT_REQUIRE_API_AUTH=1`.
