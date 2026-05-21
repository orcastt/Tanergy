# Connections Registry

**Updated**: 2026-05-21
**Mode**: External service and runtime connection map.

Secrets are intentionally not recorded here. Use provider dashboards, Vercel env, the Hetzner server-local shared env store and private operator notes for real values.

| Connection | Role | Runtime truth | Secret/key slots | Health or proof path | Current notes |
| --- | --- | --- | --- | --- | --- |
| GitHub | Source control and code review. | Repository and branch state. | Deploy keys and GitHub tokens stay outside tracked docs. | `git status`, CI once configured, PR checks. | Do not commit/push unless explicitly requested. Dirty worktree is expected during active work. |
| Vercel | Web deploy for `staging.tanergy.cc`. | Vercel project env and deployments. | Server-only Web env, Clerk secret, GeekAI server-side env. | Vercel deploy URL, `staging.tanergy.cc`, public ops smoke. | 2026-05-20 Web redeploy restored GeekAI text SSE after syncing server-only env names. |
| Hetzner | FastAPI/API host for `api-staging.tanergy.cc`. | Docker/Caddy/API release on the server. | Server-local shared `api.env`; SSH deploy key. | `/health`, API release id, Alembic head, API smoke. | Current caveat: workstation SSH deploy failed with `Permission denied (publickey)`, so API redeploy access or CI needs restoration. |
| Supabase | Staging Postgres source of truth. | Supabase Pro project and Alembic migrations. | Database URLs and pool URLs. | Alembic head, DB smoke, backup/PITR drill. | Fresh Supabase Pro staging DB replaced historical Neon and Hetzner-local Postgres fallback. |
| Cloudflare R2 | Image/object storage. | R2 bucket and access policies. | R2 access key/secret, bucket names, endpoint. | Object-storage isolation smoke, clean asset smoke. | R2 remains active for image assets; do not persist Base64 images in Board docs. |
| Clerk | Auth provider. | Clerk dashboard, JWT templates and Web runtime env. | Clerk secret, publishable key, OAuth config. | Signed-in auth/session smoke, Google/email flow smoke. | Clerk is active Auth provider; Supabase Auth is not active in the current staging plan. |
| GeekAI | Active AI provider for text, analysis and image routes. | GeekAI dashboard and server env. | `GEEKAI_TEXT_API_KEY`, `GEEKAI_BALANCE_IMAGE_API_KEY`, `GEEKAI_OFFICIAL_IMAGE_API_KEY`, `GEEKAI_VIDEO_API_KEY`. | Direct SSE smoke, backend route facts, live image smoke, provider-cost records. | Active default provider after 2026-05-20 switch; Jiekou remains historical/rollback fallback only. |
| Cloudflare | DNS/CDN/WAF/rate-limit layer. | Cloudflare dashboard and DNS records. | API tokens and zone credentials outside repo. | TLS, DNS, WAF/rate-limit proof, cache headers. | External WAF/rate-limit proof is still an ops-readiness blocker until captured. |
| Sentry/APM | Error tracking and performance monitoring. | Sentry/project dashboard and source-map config. | Sentry DSN/auth token outside tracked docs. | Synthetic crash, sourcemap proof, severity grouping, API latency/RSS alerts. | Hooks are documented, but external proof remains part of ops readiness. |

## Maintenance Rules

- Update this page when a provider, domain, host, env naming convention or health-check path changes.
- Link a dated smoke or acceptance report when marking a service live-accepted.
- Never paste credential values, dashboard tokens or private URLs with embedded tokens.

## Sources

- `project_state/project_state.md`
- `project_state/project_state_slice_S1B_staging_infra.md`
- `ARCH/ARCH_slice_S1B_staging_infra.md`
- `docs/ops-readiness-acceptance.md`
- `docs/fullstack-security-acceptance-2026-05-20.md`
