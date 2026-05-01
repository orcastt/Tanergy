# TANGENT Staging Deploy Runbook

This folder is the first staging package for Slice E Real Asset Pipeline.

It is for a small private staging environment, not production launch.

## Target Shape

- Web: Vercel preview, Cloudflare Pages preview, or local `next dev`.
- API: one VPS running the FastAPI Docker container.
- Database: managed Postgres, such as Neon or Supabase.
- Object storage: Cloudflare R2 or another S3-compatible bucket.
- DNS / TLS: Cloudflare + a reverse proxy on the VPS.

## API Server

On the staging server:

```bash
git clone <repo-url> TanvasAgent
cd TanvasAgent
cp deploy/staging/api.env.example deploy/staging/api.env
```

Edit `deploy/staging/api.env` and fill:

- `DATABASE_URL`
- `TANGENT_ALLOWED_ORIGINS`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

Start the API:

```bash
docker compose -f deploy/staging/docker-compose.api.yml up -d --build
docker compose -f deploy/staging/docker-compose.api.yml ps
curl http://127.0.0.1:8000/health
```

The compose file binds FastAPI to `127.0.0.1:8000`. Put Caddy, Nginx, or a platform proxy in front of it for HTTPS.

## Web Wiring

Set the Web app environment:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api-staging.example.com
```

The canvas spike keeps the Next local API bridge only when `NEXT_PUBLIC_API_BASE_URL` is unset.

For staging, `TANGENT_ALLOWED_ORIGINS` in `api.env` must include the Web origin, for example:

```bash
TANGENT_ALLOWED_ORIGINS=https://staging.example.com,http://localhost:3000
```

## Smoke Checklist

Run these after every staging deploy.

```bash
curl -sS https://api-staging.example.com/health
```

Expected:

```json
{"status":"ok"}
```

CORS preflight:

```bash
curl -i -X OPTIONS https://api-staging.example.com/api/v1/assets/from-data-url \
  -H 'Origin: https://staging.example.com' \
  -H 'Access-Control-Request-Method: POST'
```

Expected:

- `200 OK`
- `access-control-allow-origin: https://staging.example.com`

Asset create / file read:

```bash
ASSET_JSON=$(curl -sS -X POST https://api-staging.example.com/api/v1/assets/from-data-url \
  -H 'Content-Type: application/json' \
  --data '{"dataUrl":"data:image/png;base64,AAAA","fileName":"smoke.png","height":1,"origin":"upload","title":"Staging Smoke Asset","width":1}')
echo "$ASSET_JSON"
ASSET_URL=$(printf '%s' "$ASSET_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["asset"]["originalUrl"])')
curl -i "https://api-staging.example.com$ASSET_URL"
```

Expected:

- Asset response has `workspaceId`, `createdBy`, `storage`
- File read returns `200` with `image/png`

Board save / load:

```bash
curl -sS -X POST https://api-staging.example.com/api/v1/boards \
  -H 'Content-Type: application/json' \
  --data '{"boardId":"staging-smoke-board","document":{"shapes":[],"assets":[]},"title":"Staging Smoke Board"}'

curl -sS https://api-staging.example.com/api/v1/boards/staging-smoke-board
```

Expected:

- Save returns a board summary without `document`
- Load returns the saved `document`

Guard rejection:

```bash
curl -i -X POST https://api-staging.example.com/api/v1/boards \
  -H 'Content-Type: application/json' \
  --data '{"boardId":"bad-staging-smoke","document":{"asset":"data:image/png;base64,AAAA"},"title":"Bad Board"}'
```

Expected:

- `422 Unprocessable Entity`

Web canvas:

1. Open `/spikes/canvas`.
2. Import or paste a small PNG/JPEG/WebP.
3. Click `Save local`.
4. Refresh the page.
5. Click `Load local`.
6. Confirm images, shapes, runtime edges and camera restore.

## Current Gaps

- Auth is still dev context based: `dev-user` / `dev-workspace`.
- `TANGENT_POSTGRES_AUTO_CREATE_TABLES=1` is acceptable for staging, but production should use migrations.
- No AI provider proxy, model registry, run logs or credits yet.
- No backup / restore automation yet.
- tldraw production deployment still needs the proper license path before public production.
