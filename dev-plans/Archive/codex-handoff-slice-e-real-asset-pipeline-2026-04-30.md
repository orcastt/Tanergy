# Codex Handoff — Slice E Real Asset Pipeline

**Date**: 2026-04-30  
**Branch**: `feature/asset-lod-roadmap`  
**Last stable commit before this handoff**: `d627835 feat: accept canvas image lod spike`  
**Current gate**: Archived handoff; superseded by `project_state.md`, `dev-plans/README.md`, and `dev-plans/Asset-lod-roadmap.md`  
**Next owner**: next Codex / TANGENT

---

## 1. Read This First

New Codex should start with these files, in order:

1. `project_state.md`
2. `PRD.md`
3. `ARCH.md`
4. `HARNESS.md`
5. `dev-plans/Asset-lod-roadmap.md`
6. `dev-plans/cross-platform-canvas-performance-test-2026-04-30.md`
7. This handoff file

Do not read or modify `legacy/old-tangent-desktop-2026-04-29/` unless the user explicitly asks. It is archived old code.

---

## 2. Current Product / Architecture State

- Product is Web-first AI image canvas.
- P0 is still the minimal image chain:
  - `Prompt Node -> Image Gen / Image Gen 4 -> Image Node`
  - `Image Node + Prompt Node -> Image Gen / Analysis`
  - `Canvas Markup -> Merge Capture -> New Image Node`
  - AI Chat graph builder remains a later P0 entry point.
- Main canvas stays tldraw-first.
- Node business logic is handled by Node Runtime / Node Registry / Inspector.
- Runtime data edges are SVG overlay edges, not tldraw arrow shapes.
- Board / future CRDT document must stay lightweight: ids, layout, ports, short params, runtime summaries and `assetId` references only.
- Images, thumbnails, provider responses, logs and long text must live outside the board document.
- LOD state is local UI state and must not enter persisted Board / CRDT state.

---

## 3. What Was Completed In This Shift

Slice D and cross-platform testing were closed:

- Ordinary canvas images now use a custom `CanvasImageShapeUtil` that reuses `assetPreviewResolver`.
- Image Node / ordinary canvas image LOD can render `full`, `thumbnail` or placeholder modes.
- Image Node -> Image Node inheritance was fixed through `getImageNodeEffectiveAsset`.
- Windows LAN direct connection failed due to shared / enterprise Wi-Fi client isolation.
- Cloudflare Tunnel was used only as a temporary test route.
- `next start` exposed a tldraw production license gate; for this local spike, Windows test used `next dev`.
- `NEXT_ALLOWED_DEV_ORIGINS` was added for tunnel + Next dev HMR.
- `CanvasRuntimeDiagnostics` was added as a temporary red diagnostic panel / error boundary and is default-off behind `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1`.
- Windows dense-board tuning was added:
  - edge connection counts as interaction LOD
  - 48+ image-like objects stay thumbnail through 110%
  - 80+ image-like objects stay thumbnail through 120%
  - high-density nodes shell earlier during interaction
  - NodeCard / Inspector subscribe only to relevant runtime edges
  - image input count sync updates only affected target nodes
  - image import / paste limit increased from 3MB to 30MB
  - max canvas zoom reduced from 800% to 500%

Final user decision:

- Slice D cross-platform gate is `pass with notes`.
- Windows residual stutter is `non-blocking performance follow-up`.
- Stop polishing Cloudflare Tunnel + `next dev`.
- Move next into Slice E Real Asset Pipeline.

---

## 4. Current Running Processes

Recorded during handoff:

- `node` listening on `*:3000`, PID `4827`
- `cloudflared tunnel --url http://localhost:3000`, PID `1145`
- Current tunnel URL used in testing:
  `https://dice-queensland-markets-selected.trycloudflare.com/spikes/canvas`

Before a clean commit or handoff to production-minded work, stop these temporary processes.

---

## 5. Current Uncommitted Work

Expected uncommitted groups:

- Temporary tunnel / diagnostics:
  - `apps/web/next.config.mjs`
  - `apps/web/src/components/canvas/CanvasRuntimeDiagnostics.tsx`
  - `apps/web/src/components/canvas/CanvasSpike.tsx`
  - `apps/web/src/app/styles/canvas-shell.css`
- Windows dense-board performance tuning:
  - `apps/web/src/features/canvas-performance/canvasPerformanceStore.ts`
  - `apps/web/src/features/canvas-performance/useCanvasPerformanceTracking.ts`
  - `apps/web/src/features/node-runtime/nodeEdges.ts`
  - `apps/web/src/components/nodes/NodeCardContent.tsx`
  - `apps/web/src/components/inspector/CanvasNodeInspector.tsx`
  - `apps/web/src/components/canvas/usePortConnectionCompletion.ts`
  - `apps/web/src/components/canvas/CanvasNodeEdgeOverlay.tsx`
- Image import / paste and zoom limits:
  - `apps/web/src/features/node-runtime/imageNodeAssets.ts`
  - `apps/web/src/components/canvas/CanvasSpike.tsx`
  - `apps/web/src/components/canvas/useCanvasSettings.ts`
  - `apps/web/src/components/canvas/CanvasSpikeNavigator.tsx`
  - `apps/web/src/app/styles/canvas-navigation.css`
- Docs:
  - `PRD.md`
  - `ARCH.md`
  - `project_state.md`
  - `dev-plans/Asset-lod-roadmap.md`
  - `dev-plans/cross-platform-canvas-performance-test-2026-04-30.md`
  - `dev-plans/p0-development-harness-roadmap-2026-04-30.md`
  - `dev-plans/web-alpha-detailed-development-plan.md`
  - `dev-plans/web-collaborative-canvas-pivot.md`
  - this handoff file

Check `git status --short` before doing anything. Do not revert user changes.

---

## 6. Quality Gates Already Run

After the Windows tuning and 30MB / 500% updates, these passed:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

After editing this handoff and final docs, rerun at least:

```bash
git diff --check
```

If you change code while cleaning diagnostics, rerun the full frontend gate.

---

## 7. Immediate Next Actions

1. Stop temporary `cloudflared` and `next dev` when the user is done testing.
2. Keep `CanvasRuntimeDiagnostics` default-off behind `NEXT_PUBLIC_CANVAS_RUNTIME_DIAGNOSTICS=1`, or delete it entirely if the next branch does not need Windows diagnostics.
3. Remove diagnostic CSS if the diagnostics panel is removed.
4. Remove `CanvasSpike` diagnostic wrapper / panel usage if diagnostics are removed.
5. Decide whether `NEXT_ALLOWED_DEV_ORIGINS` stays as a documented local dev helper or is removed before commit.
6. Check whether `apps/web/next-env.d.ts` changed due to Next dev/build generated routes and restore project baseline if needed.
7. Run quality gates and create a clean checkpoint if the user asks for a commit.

Recommended policy:

- For production-facing work, keep diagnostics hidden behind the dev-only flag or remove them.
- Do not keep Cloudflare quick tunnel as a product/deploy assumption.

---

## 8. Slice E Starting Spec

Goal:

Move from local spike image assets to production-ready server-backed Assets before real AI image generation and before multiplayer.

Must build:

- Backend upload endpoint.
- Object storage strategy: Cloudflare R2 / S3-compatible / MinIO dev.
- Asset metadata table or model:
  - `id`
  - `workspace_id`
  - `owner_id`
  - `board_id`
  - `origin`
  - `original_key` / `original_url`
  - `thumb_256_key`
  - `thumb_512_key`
  - `thumb_1024_key`
  - `width`
  - `height`
  - `mime`
  - `byte_size`
  - `created_at`
- Thumbnail generation pipeline.
- Permissioned or unguessable URLs.
- Frontend resolver path that can swap local tldraw asset URLs for server asset URLs.
- Board save guard: no persistent `data:`, `blob:`, Base64 or image binary payloads in document state.

Acceptance:

- Uploaded / pasted / generated / merge-captured image can become an Asset.
- Image Node and ordinary canvas image can resolve by `assetId`.
- Refreshing the page can restore image visuals from Asset references.
- Board document stores only lightweight shape/node/edge state plus asset references.
- 30MB image limit is enforced safely.
- Thumbnails are used for dense boards and LOD without losing original fidelity for export / inspect paths.

Non-goals:

- Do not start multiplayer yet.
- Do not build full personal library.
- Do not expose provider API keys to the frontend.
- Do not persist LOD mode in Board state.

---

## 9. Known Issues / Follow-ups

- Windows dense-board stutter is non-blocking but real:
  - 50+ image-like objects
  - 50%-100% zoom
  - runtime edge growth / connection / drag / resize
- Current quick tunnel environment adds uncertainty and should not be used for final performance truth.
- tldraw production deployment requires a proper production license key.
- Link preview still needs backend URL unfurl + image proxy / Asset path.
- Current local spike assets still use tldraw local asset URLs / data URLs / blob URLs.
- Some docs are long; source code files near 250 lines should be watched before adding logic.

Files near the source size guard:

- `apps/web/src/features/assets/assetPreviewResolver.ts` around 244 lines.
- `apps/web/src/features/node-runtime/imageNodeAssets.ts` around 272 lines.
- `apps/web/src/components/nodes/NodeCardContent.tsx` around 241 lines.
- Avoid adding major logic there without splitting.

---

## 10. User Decisions To Preserve

- Keep the clean whiteboard / small card visual direction.
- Do not switch away from tldraw based on the Windows notes.
- Do not block Slice E on residual Windows stutter.
- 30MB image upload / paste cap is accepted for now.
- 500% max zoom is enough; 800% has no current product value.
- Temporary tunnel and diagnostics must stay gated or be removed before production-facing work.
