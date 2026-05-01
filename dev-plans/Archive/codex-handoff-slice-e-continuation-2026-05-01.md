# Codex Handoff — Slice E Real Asset Pipeline Continuation

**Date**: 2026-05-01  
**Branch**: `feature/asset-lod-roadmap`  
**Checkpoint before this handoff**: `67dafcb docs: sync overseas deployment cost baseline`  
**Current phase**: Slice E Real Asset Pipeline, about 65%-70% complete  
**Audience**: next Codex / AI engineer taking over the same workspace

---

## 1. Read This First

Start with these files, in this order:

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `HARNESS.md`
5. `dev-plans/README.md`
6. `dev-plans/Asset-lod-roadmap.md`
7. This handoff

Do not read or modify `legacy/old-tangent-desktop-2026-04-29/` unless the user explicitly asks.

Do not read `.env`. Use `.env.example` and documented env names only.

---

## 2. Product State

TANGENT is now a Web-first AI image canvas. P0 is not the old desktop app and not a full workflow engine.

P0 core path:

```text
Prompt Node -> Image Gen / Image Gen 4 -> Image Node
Image Node + Prompt Node -> Image Gen / Analysis
Image Node -> Canvas Markup -> Merge Capture -> New Image Node
Right AI Chat -> create nodes / connect nodes / run later
```

S1.5 complex nodes and Asset LOD Slices A-D are accepted. Slice D cross-platform gate is `pass with notes`; Windows dense-board stutter is a non-blocking follow-up.

Do not keep tuning Cloudflare Tunnel + `next dev` as the main performance path. The real next performance path is server-backed Assets, thumbnails, object storage and eventually viewport-aware mounting.

---

## 3. What Is Already Done

Frontend / canvas:

- tldraw-first canvas remains the chosen architecture.
- Prompt / Image Gen / Image Gen 4 / Analysis / Image nodes exist in the canvas spike.
- Runtime data edges are custom SVG overlay edges, not tldraw arrows.
- Image Node and ordinary canvas images have LOD / thumbnail rendering paths.
- Image Node import, Convert to Image Node, To Canvas, Screenshot and Merge Capture are wired enough for local spike use.
- Canvas max zoom is capped at 500%.
- Paste / import single-image cap is 30MB.

Slice E-A:

- Next local Asset API bridge exists under `apps/web/src/app/api/assets/`.
- Image imports and Merge/Screenshot paths can create server-backed local asset URLs under `.tangent-assets/`.
- `TangentAssetRecord` carries thumbnail URLs and now includes `workspaceId` / `createdBy`.

Slice E-C:

- Board save guard exists and rejects `data:`, `blob:` and large base64-like payloads.
- Local `Save audit`, `Save local` and `Load local` dev controls exist.
- Local Board JSON is stored under `.tangent-boards/`.
- Runtime asset migration fills `props.isAnimated` to satisfy tldraw image asset schema.

Slice E-B so far:

- Next local Asset / Board routes use request context and storage adapter seams.
- FastAPI scaffold exists under `services/api/tangent_api/`.
- FastAPI has `/health`, request context parsing, Board guard parity and local file-backed Board save/load.
- FastAPI local-dev Asset routes exist:
  - `POST /api/v1/assets/from-data-url`
  - `POST /api/v1/assets/upload`
  - `GET /api/v1/assets/{asset_id}`
  - `GET /api/v1/assets/files/{asset_id}/{file_name}`
- FastAPI Asset routes now call `asset_storage_adapter.py`.
- `local-dev` works; `s3-compatible` is currently a configuration-aware 501 placeholder.
- Unknown storage drivers fail explicitly instead of silently falling back.

Recent docs:

- `dev-plans/overseas-cost-growth-forecast.md` was updated to the current deployment cost baseline:
  `Vercel / Cloudflare Pages + Hetzner US West / Hillsboro + Neon/Supabase + Cloudflare R2`.

---

## 4. Current Working Tree Expectation

At the time this handoff was written:

- The cost baseline checkpoint was committed as `67dafcb`.
- This handoff doc and its index/state references are intended to be committed separately.
- After the handoff commit, `git status --short` should be clean.

Always check:

```bash
git status --short
git log --oneline -5
```

---

## 5. Immediate Next Engineering Step

The next best implementation step is one of these two. Prefer the first unless the user redirects.

### Option A — Implement Real R2/S3-Compatible Asset Adapter

Goal:

Make `TANGENT_ASSET_STORAGE_DRIVER=s3-compatible` actually store and retrieve assets instead of returning 501.

Likely files:

- `services/api/tangent_api/storage/asset_storage_adapter.py`
- `services/api/tangent_api/storage/local_asset_store.py`
- new `services/api/tangent_api/storage/s3_asset_store.py`
- `services/api/tangent_api/routers/assets.py`
- `services/api/tests/test_persistence_contracts.py`
- `.env.example`
- `ARCH.md`
- `dev-plans/Asset-lod-roadmap.md`
- `project_state.md`

Acceptance:

- `s3-compatible` validates required `S3_*` env vars.
- Upload/from-data-url writes original and thumbnails to an S3-compatible bucket.
- Asset metadata includes `workspaceId`, `createdBy`, width, height, mime, byteSize and thumbnail URLs/keys.
- Metadata and file reads are workspace-checked.
- Missing object / wrong workspace / bad driver return structured errors.
- Local-dev path still works.

### Option B — Implement Postgres Persistence Adapter

Goal:

Move Asset metadata and Board records away from local JSON/file metadata toward a real DB contract.

Likely scope:

- Define DB schema for `assets` and `boards`.
- Add repository interfaces for Asset metadata and Board save/load.
- Keep local-dev fallback.
- Preserve Board document guard before writes.

This is slightly larger than Option A. It may be better after the S3 adapter contract is real.

---

## 6. Slice E Remaining Checklist

Slice E is not done until these are true:

- [ ] Real R2/S3-compatible Asset adapter works.
- [ ] Postgres persistence adapter exists for Asset metadata and Board records.
- [ ] Web upload/save/load flows can target FastAPI contract, not only Next local bridge.
- [ ] Board saved document stores durable asset references, not runtime `data:` / `blob:` / hidden base64.
- [ ] Refresh/reopen restores images, runtime edges and camera from saved Board data.
- [ ] Workspace/user isolation is tested for Asset and Board reads.
- [ ] Docs and quality gates are updated.

Not part of Slice E:

- Model Registry
- Real AI Proxy
- AI Run logs
- Dashboard/Auth product UI
- Link Preview backend unfurl
- Multiplayer collaboration

Those start after Asset / Board persistence boundaries are stable.

---

## 7. Known Issues And Risks

Windows performance:

- Dense boards can still stutter around 50+ images/nodes and 50%-100% zoom.
- This is non-blocking and should feed thumbnail / asset / later viewport mounting work.

Temporary dev infrastructure:

- Cloudflare Tunnel and `NEXT_ALLOWED_DEV_ORIGINS` were only for cross-platform testing.
- `CanvasRuntimeDiagnostics` is dev-only and off unless `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1`.

tldraw production:

- `next start` previously exposed a tldraw production license gate.
- Do not treat that as a canvas performance regression.

Testing:

- Local machine currently did not have `pytest` installed during prior FastAPI work.
- Direct FastAPI TestClient smoke tests were used instead.

Docs:

- `ARCH.md` still says FastAPI is planned in some older language, but later sections document the scaffold and storage seams. If touching architecture docs, align those phrasings.

---

## 8. Quality Gates

For FastAPI-only changes:

```bash
python3 -m compileall services/api/tangent_api
```

If tests are available:

```bash
python3 -m pytest services/api/tests
```

If `pytest` is unavailable, either install in an isolated env or run focused direct TestClient smoke scripts and say so clearly.

For web or shared contract changes:

```bash
npm -C apps/web run typecheck
npm -C apps/web run lint
npm -C apps/web run build
git diff --check
```

Always run `git diff --check` before commit.

---

## 9. Coding Rules To Keep

- Use `rg` / `rg --files` for searching.
- Use `apply_patch` for manual file edits.
- Do not write or edit files with shell heredocs.
- Keep source files under 300 lines; 250 lines is warning.
- Do not let image binary payloads enter Board document state.
- Do not put provider API keys in frontend code.
- Do not revert user changes.
- Do not commit or push unless the user asks.

Current source size watchlist is in `HARNESS.md`.

---

## 10. Suggested First Prompt For The Next Codex

```text
先读 project_state.md、PRD.md、ARCH.md、HARNESS.md、dev-plans/README.md、dev-plans/Asset-lod-roadmap.md 和 dev-plans/Archive/codex-handoff-slice-e-continuation-2026-05-01.md。
不要读 legacy，不要读 .env。
然后继续 Slice E Real Asset Pipeline，优先实现 FastAPI 的 real R2/S3-compatible Asset storage adapter，保持 local-dev adapter 可用，并更新 tests/docs/project_state。
```

