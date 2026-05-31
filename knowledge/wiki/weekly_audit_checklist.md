# Weekly Audit Checklist

**Updated**: 2026-05-21
**Mode**: Recurring acceptance and drift-control checklist.

Run all commands from the repo root.

## Security

- [ ] Run the repo security release gate or the current equivalent documented in `docs/fullstack-security-acceptance-2026-05-20.md`.
- [ ] Verify Board title/input sanitization still rejects dangerous characters and does not break ordinary names.
- [ ] Smoke auth bypass, invalid/expired token, CSRF/origin and admin-write denial paths.
- [ ] Check that Board docs, Board history, node props and collaboration docs contain only refs/summaries, never `data:`, `blob:`, Base64 images, raw provider payloads or complete logs.
- [ ] Confirm share/invite tokens are hashed, expiring, revocable and noindexed where public.
- [ ] Confirm upload guards still reject SVG/PDF/non-raster provider outputs and SSRF-style remote fetches.

## Deploy And Ops

- [ ] Confirm Web and API hosts respond over HTTPS:

```bash
PYTHONPATH=services/api python3 services/api/scripts/ops_readiness_smoke.py \
  --web-url https://staging.tanergy.cc \
  --api-url https://api-staging.tanergy.cc \
  --origin https://staging.tanergy.cc
```

- [ ] Confirm Vercel Web env names are present without printing values.
- [ ] Confirm Hetzner API release id, Caddy, Docker container health and Alembic head.
- [ ] Confirm Supabase backup/PITR proof is current.
- [ ] Confirm R2 object-storage isolation and clean asset smoke.
- [ ] Confirm Cloudflare DNS/CDN/WAF/rate-limit proof is current.
- [ ] Confirm Sentry/APM sourcemap, crash grouping and alert proof is current.

## AI Routes

- [ ] Verify admin/control-plane route facts for QwQ text, Qwen VL analysis, GPT Image 2, Nano Banana 2 and Doubao Seedream.
- [ ] Run direct Chat SSE smoke through `/api/ai/chat/completions`; require `text/event-stream` and multiple `data:` chunks.
- [ ] Run one live image smoke through the server-backed AiRun route and confirm returned Asset MIME/dimensions are byte-detected.
- [ ] Re-check `knowledge/wiki/ai_provider_capability_matrix.md` after any key/model/provider change.
- [ ] Confirm Jiekou remains fallback-only unless an explicit decision flips active routes.

## Collaboration

- [ ] Run two-user invite accept/reopen smoke.
- [ ] Verify active mover identity icon/title is visible during transform, not only after a later click.
- [ ] Verify reconnect/resync does not drop queued updates under high-frequency canvas activity.
- [ ] Verify collaboration docs store lightweight shape/runtime state only.
- [ ] Smoke tooltip cleanup during drag/resize/move and mobile chat-box resize.

## Docs Freshness

- [ ] Update relevant `PRD/PRD_slice_*.md` for user-visible behavior changes.
- [ ] Update relevant `ARCH/ARCH_slice_*.md` for contract, route, storage or boundary changes.
- [ ] Update relevant `project_state/project_state_slice_*.md` for current truth and next steps.
- [ ] Update `knowledge/` only for cross-slice summary or recurring maintenance value.
- [ ] Add a `knowledge/log.md` entry when knowledge pages change.
- [ ] Add a `knowledge/decisions/log.md` entry only for important/costly decisions.

## Oversized Files

Source files target under 300 lines. Run this from repo root so the path with a space is not a problem:

```bash
find apps/web/src services/api/tangent_api -type f \
  \( -name '*.ts' -o -name '*.tsx' -o -name '*.py' \) \
  -print0 | xargs -0 wc -l | awk '$1 > 300 { print }'
```

If a touched file is over target, split it or record a concrete slimming follow-up in the active slice before signoff.

## Final Gate

- [ ] Run `git status --short` before committing or handing off.
- [ ] Run `git diff --check` for docs-only changes.
- [ ] Run frontend/backend quality gates when source code changes.
