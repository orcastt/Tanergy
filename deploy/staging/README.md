# TANGENT Staging Deploy Runbook

This folder is the first staging package for Slice E Real Asset Pipeline.

It is for a small private staging environment, not production launch.

## Configuration Boundary

Treat staging configuration as four separate surfaces:

1. Runtime configuration that must be correct for the deployment to work.
   - Vercel staging env
   - staging API host `deploy/staging/api.env`
   - Clerk dashboard origins, redirects and auth toggles
   - SSH key authorization and source-host firewall rules
2. Operator records that may describe the setup but must not contain live secrets in tracked docs.
   - `deploy/staging/deployment-secrets.local.md` is now a redacted worksheet only
   - real values belong in dashboards, untracked local env files, the server `api.env`, and private operator storage
3. Status-only product docs.
   - `ARCH/`, `PRD/`, `project_state/`, and `dev-plans/` may record rotation state and acceptance state
   - they must not store raw keys, passwords, bearer tokens, or connection strings
4. Business data.
   - rotating a key does not usually require changing application data unless the underlying Clerk, Neon, or R2 instance also changed

Important Clerk note:

- The current FastAPI bearer verifier uses `CLERK_JWT_ISSUER`, `CLERK_JWKS_URL`, optional `CLERK_JWT_AUDIENCE`, and `CLERK_AUTHORIZED_PARTIES`.
- `CLERK_SECRET_KEY` belongs on the web runtime when Next server-side Clerk helpers are used. FastAPI does not currently require it for bearer verification.

## Target Shape

- Web: Vercel preview, Cloudflare Pages preview, or local `next dev`.
- API: one VPS running the FastAPI Docker container.
- Database: managed Postgres, such as Neon or Supabase.
- Object storage: Cloudflare R2 or another S3-compatible bucket.
- DNS / TLS: Cloudflare + a reverse proxy on the VPS.

## Current Deployment Map

As of 2026-05-15, the staging chain is intentionally split:

- Web deploy: Vercel project `tanergy-staging`
  - local link already exists in `.vercel/project.json`
  - Vercel `rootDirectory` is `apps/web`
  - public staging alias is `https://staging.tanergy.cc`
- API deploy: Hetzner host `5.78.122.74`
  - public API domain is `https://api-staging.tanergy.cc`
  - source host is maintained over SSH and runs Docker Compose
- Auth: Clerk dashboard
  - web runtime uses Clerk publishable/server keys
  - FastAPI bearer verification uses `CLERK_JWT_ISSUER`, `CLERK_JWKS_URL`, optional audience and `CLERK_AUTHORIZED_PARTIES`
  - Clerk changes are dashboard/env sync work, not a standalone server deploy
- Database: Neon Postgres
  - API runtime should prefer `DATABASE_POOL_URL`
  - Alembic and admin tasks should keep using direct `DATABASE_URL`
  - Neon itself is not "deployed"; schema changes are applied from the API host with Alembic
- Object storage: Cloudflare R2
  - runtime keys live in API env
  - bucket/domain changes are env and dashboard work, not web-only deploy work

## Operator Shortcut

Use this section when you already know the infrastructure exists and only need to ship the next change.

### 1. Web-only changes

Examples:

- workspace UI
- board/browser UX
- landing page
- client-side auth wiring
- docs only

From the repo root:

```bash
git push origin <branch>
npx --yes vercel deploy --prod --yes
```

Notes:

- Run this from the repo root, not from `deploy/`.
- The linked Vercel project already points at `apps/web`, so you do not need to `cd apps/web`.
- If the Vercel CLI is not installed globally, `npx --yes vercel ...` is the expected path.
- A successful production deploy should re-alias `https://staging.tanergy.cc`.

### 2. API / backend changes

Examples:

- FastAPI routes
- auth verification
- board persistence
- AI runtime
- image-ops
- env changes that affect the API container

SSH to the Hetzner source host and redeploy there:

```bash
ssh deploy@5.78.122.74
cd ~/TanvasAgent
git pull
docker compose -f deploy/staging/docker-compose.api.yml build
docker compose -f deploy/staging/docker-compose.api.yml run --rm api alembic upgrade head
docker compose -f deploy/staging/docker-compose.api.yml up -d
docker compose -f deploy/staging/docker-compose.api.yml ps
curl http://127.0.0.1:8000/health
curl -sS https://api-staging.tanergy.cc/health
```

Rules:

- Run Alembic whenever migrations changed.
- If only the frontend changed, do not touch the Hetzner API host.
- If only the API changed, Vercel does not need a fresh deploy unless the web build also changed.

### 3. Clerk changes

Examples:

- allowed origins
- redirect URLs
- Google toggle
- email auth toggle
- publishable/secret key rotation

Clerk is a dashboard + env sync surface, not a code deploy target by itself.

After Clerk changes:

1. Verify Vercel env still has the correct Clerk web keys.
2. Verify API env still has the correct issuer/JWKS/authorized-party values.
3. Re-run the remote auth/admin smoke:

```bash
S1C_SMOKE_BASE_URL=https://api-staging.tanergy.cc \
S1C_SMOKE_ORIGIN=https://staging.tanergy.cc \
S1C_SMOKE_BEARER_TOKEN=<real-clerk-token> \
python3 services/api/scripts/s1c_remote_admin_smoke.py
```

### 4. Neon changes

Examples:

- password rotation
- pooled/direct URL rotation
- branching / new DB
- migrations

Neon changes are applied by updating env and, when schema changed, re-running Alembic from the API host.

Rules:

- `DATABASE_POOL_URL` is for API runtime traffic.
- `DATABASE_URL` remains the direct admin/migration URL.
- Rotating a Neon password usually means:
  1. update the API host env
  2. update private operator records
  3. restart/redeploy the API container
  4. run smoke checks

### 5. Fast decision table

```text
Only web files changed?        -> Vercel deploy only
API code or API env changed?   -> Hetzner redeploy (+ Alembic if needed)
Clerk dashboard changed?       -> sync env + rerun auth smoke
Neon credentials changed?      -> update API env + redeploy API
R2 credentials changed?        -> update API env + redeploy API
Docs only?                     -> no runtime deploy required unless you want a matching web release
```

## Source Firewall First

Do not rely on Cloudflare to protect SSH.

Lock the Hetzner/UFW source host down first:

```bash
ufw default deny incoming
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow from <your-public-ip> to any port 22 proto tcp
ufw enable
ufw status verbose
```

Rules:

- Public Internet should only reach `80/tcp` and `443/tcp`.
- `22/tcp` should be restricted to the maintainer's fixed public IP.
- SSH should never be routed through Cloudflare.
- Keep password SSH disabled once the key path is proven.

Current staging note:

- `api-staging.tanergy.cc` points to the Hetzner source host.
- `staging.tanergy.cc` stays on the Vercel web deployment.
- Both DNS records may be Cloudflare-proxied, but `staging` should stay a proxied Vercel CNAME, not be repointed to the Hetzner API host.

## Cloudflare Edge Hardening

After the source firewall is correct:

1. Proxy the public hostnames through Cloudflare:
   - `staging.<domain>` -> existing Vercel CNAME, proxied
   - `api-staging.<domain>` -> Hetzner `A` record, proxied
2. Set SSL/TLS mode to `Full (strict)`.
3. Enable WAF managed rules.
4. Enable bot protection if the current plan exposes it.
5. Add rate limits for the hot paths:
   - `/sign-in*`
   - `/api/auth/*`
   - `/api/v1/ai/*`
   - `/api/v1/admin/*`
   - `/api/v1/boards/*`
6. Add uptime/health monitoring for `/health`, 5xx spikes and origin-unreachable events.

Do not use `Flexible` SSL for staging or production. The source host should present a valid certificate to Cloudflare.

## API Server

On the staging server:

```bash
git clone <repo-url> TanvasAgent
cd TanvasAgent
cp deploy/staging/api.env.example deploy/staging/api.env
```

Edit `deploy/staging/api.env` and fill:

- `DATABASE_URL`
- `DATABASE_POOL_URL` when your Postgres provider exposes a pooled runtime URL, such as Neon pooling
- `CLERK_JWT_ISSUER`
- `CLERK_JWT_AUDIENCE` when configured
- `CLERK_JWKS_URL`
- `CLERK_AUTHORIZED_PARTIES`
- `TANGENT_REQUIRE_API_AUTH=1`
- `TANGENT_ALLOWED_ORIGINS`
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `GEEKAI_API_KEY` for the balanced image channel used by `gpt-image-2`, `jimeng_t2i_v40`, and `doubao-seedream-5.0-lite`
- `GEEKAI_NANO_BANANA_API_KEY` for the dedicated Nano Banana 2 official channel when you want separate billing or routing
- `GEEKAI_NANO_BANANA_BASE_URL` when that Nano Banana channel uses a different base URL
- `GEEKAI_TEXT_API_KEY` for the active GeekAI text channel used by `analysis`, `chat`, and `prompt optimizer`
- `GEEKAI_TEXT_BASE_URL` as the optional base URL for that text channel
- `GEEKAI_VIDEO_API_KEY` as a reserved placeholder for a future GeekAI video channel split
- `GEEKAI_VIDEO_BASE_URL` as the optional base URL for that future video split

Do not put live secret values into this repo's tracked markdown notes. Keep them in the server `api.env`, Vercel env, Clerk dashboard, or private operator storage.

Start the API:

```bash
docker compose -f deploy/staging/docker-compose.api.yml build
docker compose -f deploy/staging/docker-compose.api.yml run --rm api alembic upgrade head
docker compose -f deploy/staging/docker-compose.api.yml up -d
docker compose -f deploy/staging/docker-compose.api.yml ps
curl http://127.0.0.1:8000/health
```

The compose file binds FastAPI to `127.0.0.1:8000`. Put Caddy, Nginx, or a platform proxy in front of it for HTTPS.

Keep Alembic migrations on `DATABASE_URL`. At runtime the API prefers `DATABASE_POOL_URL` when it is set, and logs SQL taking longer than `TANGENT_DATABASE_SLOW_QUERY_MS` milliseconds without logging query parameters.

For a disposable staging database, S1A migration smoke can run:

```bash
docker compose -f deploy/staging/docker-compose.api.yml run --rm \
  -e S1A_SMOKE_DATABASE_URL="$DATABASE_URL" \
  -e S1A_SMOKE_ALLOW_RESET=1 \
  api python scripts/s1a_migration_smoke.py
```

Do not run this against production or any database you need to keep. It drops `tangent_%` tables and `alembic_version`.

## Web Wiring

Set the Web app environment:

```bash
NEXT_PUBLIC_API_BASE_URL=https://api-staging.example.com
```

The canvas spike keeps the Next local API bridge only when `NEXT_PUBLIC_API_BASE_URL` is unset. When that base URL is configured, the web app fails closed to the backend APIs instead of silently falling back to local AI or asset routes.

Local development may use a different port when another service occupies `8000`:

```bash
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8100
```

Do not reuse the local dev-bypass path for staging or production. `/api/auth/dev-bypass` and the `tangent_dev_auth` cookie are local-only helpers; deployed `/admin` smoke must use a real Clerk login and real FastAPI bearer verification.

For staging, `TANGENT_ALLOWED_ORIGINS` in `api.env` must include the Web origin, for example:

```bash
TANGENT_ALLOWED_ORIGINS=https://staging.example.com,http://localhost:3000
CLERK_AUTHORIZED_PARTIES=https://staging.example.com
```

When `CLERK_AUTHORIZED_PARTIES` or `TANGENT_ALLOWED_ORIGINS` is configured, FastAPI requires the Clerk JWT `azp` authorized party to match one of those origins.

If the Clerk issuer changes rather than only the key material rotating, expect a follow-up pass on:

- real session/admin smoke
- local identity mapping in `tangent_user_identities`
- `admin_roles` bootstrap for the signed-in operator

After the real operator signs in once and `/api/v1/auth/session` has created the local TANGENT user, grant admin access with either the local user id or the login email:

```bash
DATABASE_URL=postgresql://... \
PYTHONPATH=services/api \
python3 services/api/scripts/s3_admin_bootstrap.py \
  --email operator@example.com \
  --role owner \
  --note "Staging operator bootstrap"
```

Then run the remote auth/admin smoke with a real Clerk token:

```bash
S1C_SMOKE_BASE_URL=https://api-staging.example.com \
S1C_SMOKE_ORIGIN=https://staging.example.com \
S1C_SMOKE_BEARER_TOKEN=<real-clerk-token> \
python3 services/api/scripts/s1c_remote_admin_smoke.py
```

The remote smoke now checks:

- `/api/v1/auth/session`
- `/api/v1/admin/me`
- `/api/v1/admin/operator/users?limit=3`
- `/api/v1/admin/finance/summary`
- `/api/v1/admin/ai/route-metrics?limit=5`

It prints one JSON report with per-endpoint status, payload and CORS headers, and exits non-zero if any required admin check fails.

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
- Load returns the saved `document` and stamps `lastOpenedAt`

Board History create / list / load (snapshot-named API):

```bash
SNAPSHOT_JSON=$(curl -sS -X POST https://api-staging.example.com/api/v1/boards/staging-smoke-board/snapshots \
  -H 'Content-Type: application/json' \
  --data '{"document":{"shapes":[],"assets":[]},"reason":"manual","title":"Staging Smoke Snapshot"}')
echo "$SNAPSHOT_JSON"
SNAPSHOT_ID=$(printf '%s' "$SNAPSHOT_JSON" | python3 -c 'import json,sys; print(json.load(sys.stdin)["snapshot"]["id"])')
curl -sS https://api-staging.example.com/api/v1/boards/staging-smoke-board/snapshots
curl -sS "https://api-staging.example.com/api/v1/boards/staging-smoke-board/snapshots/$SNAPSHOT_ID"
```

Expected:

- Create/list return history summaries without `document`
- Load returns the history `document`

Guard rejection:

```bash
curl -i -X POST https://api-staging.example.com/api/v1/boards \
  -H 'Content-Type: application/json' \
  --data '{"boardId":"bad-staging-smoke","document":{"asset":"data:image/png;base64,AAAA"},"title":"Bad Board"}'
```

Expected:

- `422 Unprocessable Entity`

Web canvas:

1. Open `/boards/<boardId>` with a real saved board.
2. Import or paste a small PNG/JPEG/WebP.
3. Click `Save local`.
4. Refresh the page.
5. Click `Load local`.
6. Confirm images, shapes, runtime edges and camera restore.

Post-rotation browser checks:

1. Sign in with Google on `https://staging.tanergy.cc`.
2. Open `/workspaces`.
3. Open a board, edit it, refresh, and reopen it.
4. Create and delete a private board.
5. Paste or upload an image, wait for persistence, then refresh and reopen.
6. If Neon, Clerk issuer, or R2 bucket changed, rerun the relevant smoke before treating staging as green.

## Current Gaps

- Auth still needs full deployed browser smoke: local can use `dev-user` / `dev-workspace` plus dev bypass, but staging/prod must verify Clerk session, JWT issuer/JWKS/audience/authorized-party, exact allowed origins and the actual signed-in user's `admin_roles`.
- Admin finance deploy smoke requires Alembic migrated to head before calling `/api/v1/admin/finance/summary`; stale DB schema can produce missing-column errors.
- `TANGENT_POSTGRES_AUTO_CREATE_TABLES=0` is the preferred staging/prod path after running Alembic migrations. Temporary staging smoke can still use `1` while debugging a fresh database.
- Staging AI smoke now expects a real live provider credential such as `GEEKAI_API_KEY`; deployed environments should fail closed instead of silently returning mock `asset_mock_*` success.
- Cloudflare SSL mode, WAF managed rules and rate limits still need either dashboard setup or a wider-scoped API token than DNS-only automation.
- No backup / restore automation yet.
- The active web app is Konva-only; staging/prod should not depend on any tldraw runtime or license path.

Production preparation now lives in:

```text
deploy/production/README.md
```

Do not open a real production site until the staging real-login, email/OAuth and live-AI smokes are green.
