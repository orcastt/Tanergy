# Incident Response Runbook

Use this during staging and production incidents. Keep secrets, bearer tokens,
provider raw responses, full logs and customer data out of tickets, chat and
postmortems unless the private incident channel explicitly permits them.

## Ownership Placeholders

| Role | Owner | Backup | Channel |
| --- | --- | --- | --- |
| Incident commander | TODO | TODO | TODO |
| API/server operator | TODO | TODO | TODO |
| Database operator | TODO | TODO | TODO |
| Security/privacy lead | TODO | TODO | TODO |
| Customer/status-page lead | TODO | TODO | TODO |

Record the active incident channel, start time, affected environment, affected
domains and current severity before making changes.

## Severity And First Response

1. Confirm user impact with `/health`, external monitors, error tracking,
   Cloudflare, database provider and object storage dashboards.
2. Assign an incident commander and one note-taker.
3. Freeze risky deploys until the commander clears them.
4. Start a timeline with UTC timestamps.
5. If users are affected, publish a status-page update within 15 minutes.
6. Re-check the environment RTO/RPO target before choosing restore, rollback or
   fail-forward.

RTO/RPO placeholders:

- Staging: RTO TODO, RPO TODO.
- Production: RTO TODO, RPO TODO.

## Common Smoke Checks

Configuration smoke:

```bash
PYTHONPATH=services/api python3 services/api/scripts/security_deploy_config_smoke.py \
  --env-file deploy/staging/api.env.example \
  --production-like
```

Public readiness smoke:

```bash
PYTHONPATH=services/api python3 services/api/scripts/ops_readiness_smoke.py \
  --web-url https://staging.tanergy.cc \
  --api-url https://api-staging.tanergy.cc \
  --origin https://staging.tanergy.cc
```

See `docs/ops-readiness-acceptance.md` for the current readiness matrix.

## API Or Server Down

Symptoms: `/health` fails, Cloudflare origin errors, container restarts, high 5xx,
or the web app cannot reach the API.

1. Check external monitor, Cloudflare events and server health.
2. SSH from the allowed source IP and inspect compose state:
   `docker compose -p staging -f deploy/staging/docker-compose.api.yml ps`.
3. Check recent API logs without copying secrets into chat or tickets.
4. Roll back to the last known-good web deploy or API image/commit if the
   incident began after a deploy.
5. Run `/health`, CORS preflight and the public readiness smoke before clearing.

Escalate to the hosting provider if the host is unreachable or disk/network
health is degraded.

## Database Corruption Or Loss

Symptoms: migration failure, missing rows, bad board history, widespread 500s on
board/auth/admin routes, or provider reports storage failure.

1. Stop nonessential writes if corruption or destructive migration is suspected.
2. Snapshot the current database if the provider allows it.
3. Identify the last known-good backup and PITR timestamp.
4. Compare restore time against the environment RTO/RPO before proceeding.
5. Restore into a separate database first when possible, then validate auth,
   boards, assets metadata, admin routes and migrations.
6. Point runtime env at the restored database only after validation and approval
   from the incident commander.

Never run destructive smoke scripts against production or any database that must
be preserved.

## API Or AI Provider Outage

Symptoms: live AI runs fail, provider timeouts, unexpected 401/429/5xx, or image
generation stalls.

1. Confirm whether core app flows still work without AI.
2. Check provider status, quota, billing, key validity and route metrics.
3. Disable or rate-limit only the affected model/provider path if available.
4. Keep provider keys server-side; do not paste provider responses containing
   prompts, images or account identifiers into public channels.
5. Update the status page if user-visible generation is degraded.

Recovery requires one live text or image run through the backend `AiRun` path.

## Data Leak Or Security Incident

Symptoms: exposed secret, unauthorized admin access, leaked board data, suspicious
downloads, credential stuffing, or unexpected public asset access.

1. Treat as high severity and assign the security/privacy lead.
2. Preserve audit logs, Cloudflare logs, auth provider logs and relevant database
   timestamps.
3. Rotate exposed secrets and revoke affected sessions/tokens.
4. Disable compromised accounts, API keys or admin roles.
5. Identify affected users, data types and exposure window.
6. Escalate to legal/privacy counsel before external disclosure.
7. Publish status-page updates only with approved wording.

Do not delete evidence until the security/privacy lead approves retention.

## Cloudflare, DNS Or SSL Failure

Symptoms: DNS lookup failure, certificate errors, Cloudflare 52x, redirect loops,
HSTS problems or broken CORS origin.

1. Check Cloudflare DNS records, proxy status, WAF/rate-limit events and SSL mode.
2. Confirm SSL mode is `Full (strict)`, not `Flexible`.
3. Verify origin certificate validity and hostname match.
4. Run the public readiness smoke with `--require-hsts` for production.
5. If DNS changed, record old/new records and expected TTL.

Escalate to Cloudflare or the DNS registrar if authoritative DNS or certificate
issuance is failing.

## Object Storage Issue

Symptoms: uploads fail, pasted images disappear after refresh, asset URLs return
403/404/5xx, or R2/S3 reports elevated errors.

1. Check object storage dashboard, bucket policy, credentials and endpoint.
2. Confirm API env has the intended `S3_ENDPOINT`, `S3_BUCKET` and scoped keys.
3. Test one small upload/read in staging or the affected environment.
4. If credentials leaked, rotate keys and redeploy the API runtime.
5. If objects were deleted, restore from bucket versioning/backups if enabled and
   reconcile asset metadata before reopening writes.

## Status Page

Use the configured status page for user-visible outages:

- Investigating: impact known, cause unknown.
- Identified: cause known, mitigation in progress.
- Monitoring: fix deployed or provider recovered.
- Resolved: smoke checks green and error rate normal.

Each update should include affected environment, affected feature, current user
impact and next update time. Do not include secrets, raw logs, provider payloads
or customer content.

## Recovery Checks

- Public readiness smoke passes.
- `/health` and external uptime monitor are green.
- Error tracking has returned to baseline.
- Database writes and reads work for boards, history and admin routes.
- Asset upload/read works after refresh.
- One live AI provider smoke succeeds when AI was affected.
- Status page is updated to monitoring or resolved.

## Postmortem Checklist

- Timeline with UTC timestamps.
- Customer impact and duration.
- Root cause and contributing factors.
- Detection gap and alert owner.
- What worked during response.
- Corrective actions with owners and due dates.
- RTO/RPO result versus target.
- Follow-up docs, tests, monitors or backup drills.
