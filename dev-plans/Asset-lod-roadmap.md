# Asset LOD Roadmap

**Date**: 2026-04-30  
**Branch**: `feature/asset-lod-roadmap`  
**Base checkpoint**: `a6f20c1 checkpoint: stabilize s1.5 canvas runtime`  
**Status**: Slices A-D implemented. Cross-platform quality gate is `pass with notes` as of 2026-04-30. Windows dense-board stutter is a non-blocking performance follow-up. Slice E-A local Asset API bridge and Slice E-C board save guard / local save-restore are implemented. Slice E-B request context + storage adapter seam now covers FastAPI local-dev, real `s3-compatible` Asset storage, Postgres persistence and configurable Web-to-FastAPI upload/save/load; local FastAPI + Web runtime smoke has passed. Staging server config and Dashboard/Board entry remain next.

**Owner**: Codex / TANGENT

---

## 1. Why This Roadmap Exists

S1.5 has proven that the tldraw-first architecture can support the core AI canvas interactions:

- Prompt / Image Gen / Image Gen 4 / Analysis / Image nodes.
- Runtime data edges, fan-out, input replacement and disconnect.
- Canvas image to Image Node.
- Image Node to canvas image.
- Local Image Node import.
- Merge Capture to Image Node.
- Low zoom Image Node preview degradation.
- React overlay and editor subscription churn reduction.

After these fixes, user testing shows the canvas is usable enough to pass the Slice D gate, with notes for Windows dense-board stutter. The current bottleneck has moved from "our React overlays refresh too often" to "the browser is paying real image rendering cost and needs real asset thumbnails."

For a future studio collaboration product, many images and many nodes are not edge cases. A real shared project can naturally contain:

- 100+ reference, generated, screenshot and merge images.
- 50+ AI nodes.
- Many canvas annotations.
- Multiple users panning, zooming, dragging and editing at the same time.

Therefore Asset Pipeline + Image / Node LOD is now a collaboration prerequisite, not a late polish item.

---

## 2. Current Diagnosis

Already improved:

- NodeCard no longer rerenders on camera-only changes.
- Image Node can switch to reduced preview at low zoom / high density.
- Image Node now has a local resolver-backed thumbnail mode for the 25%-50% zoom band.
- Complex AI nodes can switch to a low-zoom shell while preserving clickable ports.
- Image import max dimension is adaptive by viewport width.
- Image count metrics only rescan when image-like structure changes.
- Navigator samples fewer shapes in dense boards and can collapse.
- Selection Toolbar / Style Panel hide during dragging and camera movement.
- Inspector and overlays use narrower editor revision subscriptions.
- Prompt / Analysis nodes now use resized space better, reducing wasted internal whitespace.

Still unresolved / next:

- Slice D cross-platform validation passed with notes; Windows dense boards remain a non-blocking follow-up.
- Local spike assets still rely on tldraw local asset URLs / data URLs / blob URLs.
- Collaboration cannot safely sync or persist heavy image data in the board document.
- Link preview cards still need a server-side URL unfurl + image proxy / asset path; direct remote preview images can fail due to CORS, hotlinking or bot protection.

Main conclusion:

> Keep tldraw as the interaction and layout base. Move next into Slice E: a real Asset Layer with server-backed originals and thumbnails.

---

## 3. Product Requirement

Target workload before multiplayer collaboration:

| Dimension | Minimum Target | Stretch Target |
| --- | ---: | ---: |
| Total canvas objects | 500 | 1,000 |
| Ordinary canvas images | 100 | 250 |
| AI node cards | 50 | 150 |
| Image Nodes with previews | 50 | 150 |
| Visible objects at low zoom | dense whole-board overview | dense project wall |
| Interaction | pan / zoom / drag must remain usable | near-Miro feel |

Performance expectation:

- Zoom and pan should not become unusable when many images are visible.
- Dragging selected images should remain responsive.
- Low zoom should prefer overview clarity over full fidelity.
- High fidelity image preview can recover after camera movement stops.
- Collaboration state must stay lightweight.

---

## 4. Core Architecture Decision

### 4.1 Canvas Document Layer

The board document stores only lightweight collaborative state:

```text
shapeId
shape type
position
size
rotation
nodeId
nodeType
edge ids
assetId
short params
runtime summary
```

The board document must not store:

```text
data:
blob:
Base64 image strings
provider raw responses
large image payloads
large logs
thumbnail binary data
```

### 4.2 Asset Layer

All images should resolve through one asset model:

```text
assetId
originalUrl
thumbnail256Url
thumbnail512Url
thumbnail1024Url
width
height
mime
byteSize
createdBy
workspaceId
origin: upload | paste | ai_run | merge_capture | screenshot
createdAt
```

Local spike version may use generated blob URLs or local data URLs, but the data model must be shaped like the future server model.

### 4.3 Render LOD Layer

LOD is local UI state. It must not enter CRDT / board document.

Inputs:

- zoom level
- camera state
- dragging / panning state
- viewport size
- shape screen size
- image count density
- node count density
- asset availability

Outputs:

- original image URL
- thumbnail URL
- placeholder
- simple node shell
- full node UI

Rules:

- Low zoom: prefer thumbnails or placeholders.
- Camera moving: prefer thumbnails or placeholders.
- Camera idle: restore higher fidelity when useful.
- Small screen footprint: prefer smaller thumbnail.
- Large screen footprint: use larger thumbnail or original.
- Complex nodes at low zoom: unmount heavy controls and image previews.

---

## 5. Implementation Slices

### Slice A — Image Node Moving Degrade ✅

Goal:

Image Node should avoid mounting full image previews while camera is moving, zooming, panning or while the user is dragging.

Status:

2026-04-30 Codex implemented the local interaction-aware preview degrade. `canvasPerformanceStore` now treats camera movement, panning and dragging as a local reduced-preview signal with a short idle recovery delay; `CanvasSpike` uses `useCanvasPerformanceTracking()` so Image Nodes unmount full previews during motion and restore after idle. LOD state remains local UI state and is not written into shape props.

2026-04-30 user test confirmed the hard degrade removed the stutter but felt too abrupt because readable Image Nodes only recovered after movement stopped. Codex tuned the rule to keep full image previews during interaction when the canvas is at readable zoom (50% and above) or when an individual Image Node has a large enough on-screen footprint. Reduced preview is now reserved for low-zoom overview and high-density movement where internal image detail is not useful.

2026-04-30 Status: done locally. Quality gates passed.

Scope:

- Extend `canvasPerformanceStore` with interaction-aware preview mode.
- Use `useEditorInteractionState` / camera state to detect moving state.
- Add a short idle recovery delay, probably 120-200ms.
- Image Node shows reduced preview during movement and restores full preview after idle.

Files likely involved:

- `apps/web/src/features/canvas-performance/canvasPerformanceStore.ts`
- `apps/web/src/features/canvas-performance/editorPerformanceMetrics.ts`
- `apps/web/src/components/nodes/ImageNodePreview.tsx`
- `apps/web/src/components/canvas/CanvasSpike.tsx`

Acceptance:

- With many Image Nodes visible, zoom / pan feels smoother.
- Full Image Node previews recover after camera movement stops.
- Image Node import, merge capture and To Canvas still work.
- LOD state is not written into shape props.

Risk:

- Low. This only changes Image Node rendering behavior.

---

### Slice B — Node LOD ✅

Goal:

At low zoom or high density, complex AI nodes should not mount full React forms, buttons and previews.

Status:

2026-04-30 user testing at roughly 30 image/node objects showed remaining stutter during zooming and node connection even after Image Node preview LOD improved. Codex started Slice B by adding local `nodeCardCount` / `nodeRenderMode` to `canvasPerformanceStore`. Dense boards now switch non-readable nodes to a shell render mode at low zoom or while moving: the shell keeps node title, status and clickable ports, but skips full React controls, input summaries, payload audit footer and image/body rendering. Readable Image Nodes can still stay full so visible images are not hidden unnecessarily.

2026-04-30 user feedback: switching around 45% zoom made nodes feel unreadable too early. Codex retuned the LOD thresholds so the common 24-48 image/node board only starts reduced image preview / node shell at roughly 25% zoom. Higher thresholds are now reserved only for extreme density boards.

2026-04-30 Status: done locally. User accepted the later 25% threshold as a better interaction balance. Quality gates passed.

Scope:

- Add node render mode: `full | compact | shell`.
- Low zoom shell shows node type, title, status, run readiness and maybe one tiny preview.
- Full node UI restores at readable zoom.
- Ports must remain usable enough or clearly hidden depending on zoom threshold.
- Runtime edge geometry must still follow node bounds.

Files likely involved:

- `apps/web/src/components/nodes/NodeCardContent.tsx`
- `apps/web/src/components/nodes/NodeCardPreviews.tsx`
- `apps/web/src/components/nodes/ImageNodePreview.tsx`
- `apps/web/src/app/styles/node-card-content.css`
- `apps/web/src/features/canvas-performance/canvasPerformanceStore.ts`

Acceptance:

- 50+ AI nodes at low zoom do not mount all full controls.
- Prompt / Image Gen / Analysis node content restores when zoomed in.
- Runtime summaries and missing-input hints remain visible in some form.
- No node data model changes.

Risk:

- Medium-low. It touches node UI, but not node runtime data.

---

### Slice C — Local Asset Preview Resolver ✅

Goal:

Introduce a single client-side resolver that Image Node and future canvas image LOD can share.

Status:

2026-04-30 Codex implemented the first local resolver pass. `assetPreviewResolver` now resolves Image Node assets into `full`, `thumbnail`, or `placeholder` preview modes, keeps an in-memory thumbnail cache, and generates local 256/512 thumbnails for uploaded / merge-captured / converted tldraw image assets. `canvasPerformanceStore` now has three image modes: `full`, `thumbnail`, and `reduced`; common dense boards use thumbnail mode around the 25%-50% zoom band instead of jumping straight from original image to placeholder. This is intentionally local UI state and does not enter shape props or the board document.

2026-04-30 user test confirmed the 25%-50% band is basically usable on the current Mac browser setup after thumbnail mode. Later Windows validation passed with notes; remaining uncertainty belongs to real AI images and server-backed Asset thumbnails.

2026-04-30 Status: done locally. Quality gates passed. Cross-platform gate later passed with notes.

Proposed API:

```ts
type AssetPreviewIntent = {
  assetId: string | null
  imageWidth?: number
  imageHeight?: number
  mode: 'full' | 'thumbnail' | 'placeholder'
  screenWidth?: number
  screenHeight?: number
}

type AssetPreviewResult = {
  src: string | null
  quality: 'original' | 'thumb-1024' | 'thumb-512' | 'thumb-256' | 'placeholder'
  width?: number
  height?: number
}
```

Scope:

- Resolve tldraw asset URL by `assetId`.
- Read optional local thumbnail metadata if available.
- Fall back safely to original URL.
- Never write chosen LOD quality into document state.

Files likely involved:

- `apps/web/src/features/node-runtime/imageNodeAssets.ts`
- new `apps/web/src/features/assets/assetPreviewResolver.ts`
- `apps/web/src/components/nodes/ImageNodePreview.tsx`

Acceptance:

- Image Node uses resolver instead of directly reaching into tldraw asset URL.
- Resolver can return original now and thumbnails later without changing node components again.
- Missing assets degrade to placeholder, not broken UI.

Risk:

- Medium. It defines the seam between current local assets and future server assets.

---

### Slice D — Ordinary Canvas Image LOD Spike ✅ Accepted Locally

Goal:

Prove how to apply LOD to ordinary tldraw image shapes.

Candidate approaches:

1. Custom `ImageShapeUtil` overriding default image rendering.
2. Asset URL resolver hook if tldraw exposes a suitable path.
3. Shape / asset metadata storing multi-size URLs, with custom render path selecting one.
4. Temporary local downsample on paste/import while preserving original asset metadata.

Important caution:

Do not permanently replace original images with downsampled versions. Users need original fidelity for export, merge and inspection.

Boundary:

Slice D is a frontend spike. It proves ordinary canvas images can use the same local resolver / thumbnail strategy as Image Node without breaking tldraw behavior. It does not build backend upload, object storage, asset tables, signed URLs, persistence migration or multiplayer-safe asset sync.

Status:

2026-04-30 Codex started the spike with the least invasive path: `CanvasImageShapeUtil` extends tldraw's default `ImageShapeUtil` and only overrides the runtime `component()` render path. Resize, geometry, cropping capability and SVG export stay on the default tldraw implementation. Ordinary canvas images now use `assetPreviewResolver` for screen rendering: full mode uses original asset URLs, and thumbnail / reduced modes use local thumbnails when available. The resolver now falls back to original image rendering if browser-side thumbnail generation fails, which protects cross-origin or tainted-canvas cases during the spike.

2026-04-30 user test: after Slice D local rendering changes, multi-image zoom / move feels much smoother and obvious stutter was not reproduced in the tested Mac browser session. The remaining bug found in the same pass was Image Node -> Image Node inheritance: downstream Image Nodes received the upstream asset id but still rendered their own empty/default placeholder. Codex fixed this by adding one effective Image Node asset rule: connected image input wins over the node's own imported asset, and empty Image Nodes no longer default to `asset_mock_image_001`.

2026-04-30 user accepted Slice D locally. The current state was checkpointed before cross-platform performance validation.

2026-04-30 Windows cross-platform pass found a new threshold issue: below 50% zoom the board remains relatively smooth, but around 50%-100% zoom, 50+ Image Nodes / generated images / runtime edges make connection, copy, drag and resize noticeably stutter on Windows. Codex treated this as a cross-platform LOD threshold problem, not a tldraw architecture rollback: dense image previews now stay on thumbnails through 100% for common 48+ image-like boards, port connection counts as an interaction, high-density nodes shell earlier during interaction, and node edge subscriptions are narrowed to relevant nodes.

2026-04-30 final gate: Slice D cross-platform testing is `pass with notes`. The Windows stutter that remains is recorded as non-blocking performance follow-up. Do not keep polishing the Cloudflare Tunnel + `next dev` test setup; move the next optimization into Slice E Real Asset Pipeline.

Acceptance:

- A pasted/imported canvas image can display a thumbnail at low zoom or camera movement.
- Full image restores at high zoom / idle.
- Export and Merge Capture still use correct fidelity or an explicitly chosen export source.
- Copy/paste and Convert to Image Node still work.
- Image Node -> Image Node pass-through displays the inherited upstream image and `To Canvas` uses the same effective asset.

Current acceptance state:

- Accepted in local Mac browser testing.
- Multi-image zoom / move feels smooth enough to stop tuning thresholds for now.
- Cross-platform quality gate is pass with notes. Any remaining Windows performance issue should feed Slice E / later LOD tuning, not block the next slice.

Risk:

- Medium-high. This touches tldraw default image shape behavior and export consistency.

Next entry criteria:

- Keep Slice D as a spike, not a broad refactor.
- Reuse `assetPreviewResolver` instead of inventing a second image-resolution path.
- Verify Convert to Image Node, To Canvas, Screenshot and Merge Capture still use the expected fidelity.
- Add a rollback note because custom image rendering can affect tldraw export and copy/paste behavior.

---

### Slice E — Real Asset Pipeline ▶️ Active

Goal:

Move from local spike assets to production-ready image assets before multiplayer collaboration.

Boundary:

Slice E productionizes the asset layer after the frontend LOD path is proven. It should turn local `data:` / `blob:` spike assets into durable server-backed asset records with original and thumbnail URLs. It should not be started as part of the Slice D frontend spike.

Scope:

- Backend upload endpoint.
- Object storage path strategy.
- Thumbnail generation pipeline.
- Asset table / metadata.
- Permissioned or unguessable URLs.
- Board save rejects or migrates `data:` / `blob:` image refs.
- AI-generated images and Merge Capture results become assets.

Potential storage model:

```text
assets
  id
  workspace_id
  owner_id
  origin
  original_key
  thumb_256_key
  thumb_512_key
  thumb_1024_key
  width
  height
  mime
  byte_size
  created_at
```

Acceptance:

- Board document references only asset ids.
- Refreshing the page can restore images from asset ids.
- Collaboration sync does not include image binary payloads.
- Large images are uploaded once, not broadcast through CRDT.

Risk:

- High. Requires backend, storage, auth and migration work.

---

### Slice E-A — Local Server-Backed Asset Contract ✅

Goal:

Create the first replaceable Asset API contract inside the current Web app before wiring a full FastAPI / R2 backend.

Boundary:

This is a development bridge, not the final production storage implementation. It should move Image Node import and Merge Capture away from raw `data:` URLs by posting image data to a local server route, storing files under an ignored local asset directory, and returning an asset record with original and thumbnail URLs. Auth, workspace permission checks and object storage migration remain for later Slice E steps.

Scope:

- `POST /api/assets/from-data-url` stores an original image plus client-generated thumbnails.
- `POST /api/assets/upload` exists for the future upload contract and stores the original file.
- `GET /api/assets/{assetId}` returns metadata.
- `GET /api/assets/files/{assetId}/{fileName}` serves local development asset files.
- Image Node file import and Merge Capture / Screenshot create tldraw assets from returned asset URLs, not raw data URLs.
- `assetPreviewResolver` prefers persisted thumbnail URLs when available, falling back to the existing local thumbnail cache.

Acceptance:

- Imported Image Node images have a non-`data:` `props.src` URL.
- Merge Capture creates an Image Node whose tldraw asset points at `/api/assets/files/...`.
- Thumbnail mode can use `thumbnail256Url` / `thumbnail512Url` / `thumbnail1024Url` from asset metadata.
- API response shape matches the future server Asset model closely enough to swap storage later.
- Generated asset files are ignored by Git.

Known limitations:

- Local Next route has no real auth or workspace authorization yet.
- Thumbnails are generated client-side in this bridge slice; production should move thumbnail generation server-side.
- The seeded spike image is now served from `/spikes/sample-image.svg`; seeded demo data URLs should not enter persistence candidates.

2026-04-30 implementation note:

Codex implemented the first bridge in `apps/web/src/app/api/assets/`. Image Node file import and Merge Capture / Screenshot now post image data to `POST /api/assets/from-data-url`, create a tldraw image asset from the returned `/api/assets/files/...` URL, and store the returned `TangentAssetRecord` on the tldraw asset metadata. `assetPreviewResolver` now prefers `thumbnail256Url` / `thumbnail512Url` / `thumbnail1024Url` from that metadata before falling back to the local thumbnail cache. Generated files live under `.tangent-assets/`, which is ignored by Git.

---

### Slice E-C — Board Save Guard / Data URL Migration ✅

Goal:

Add a hard validation layer before Board persistence exists, so future save APIs cannot accidentally store raw image payloads.

Boundary:

This slice does not implement Dashboard, Board CRUD, database persistence or migration UI. It only creates a reusable guard and a local validation endpoint that future save code must call before writing `document_state`.

Scope:

- Add a pure Board document audit function for arbitrary JSON-like values.
- Block strings starting with `data:` or `blob:`.
- Block large base64-like payloads that could be hidden inside props or metadata.
- Report JSON byte size and issue paths for developer diagnostics.
- Add a local `POST /api/boards/validate-document` route as a save-guard contract.
- Add a lightweight editor serializer that emits shapes, assets, camera, viewport and runtime edges before running the guard.
- Add a dev `Save audit` control on the canvas spike so this path can be exercised before real persistence.
- Before audit, migrate browser runtime image assets (`data:image/png|jpeg|webp` / `blob:`) through the local Asset API and update the existing tldraw asset in place.
- Add local `POST /api/boards/local-save` and `GET /api/boards/local-load` routes that write/read ignored `.tangent-boards/` JSON for development.
- Add a `Save local` dev control that runs migrate -> serialize -> guard -> local save.
- Add a `Load local` dev control that restores assets, shapes, runtime edges and camera from the local document.

Acceptance:

- Clean board-like JSON validates with `ok: true`.
- Documents containing `data:image/...` or `blob:...` validate with `ok: false`.
- Documents containing very large base64-like strings validate with `ok: false`.
- The guard is pure and can be reused by future FastAPI / Board save implementations.
- Current editor state can be serialized and guarded without using a full tldraw store snapshot.
- Guarded documents can be written to the local dev board store.
- The local saved document can be restored into the editor enough to verify refresh/reopen fundamentals.

2026-04-30 implementation note:

Codex added `boardDocumentGuard.ts`, `boardDocumentSerializer.ts`, `boardDocumentRestore.ts`, `POST /api/boards/validate-document`, `runtimeAssetMigration.ts`, `POST /api/boards/local-save`, `GET /api/boards/local-load`, and a `CanvasBoardSaveAudit` dev control. The serializer intentionally includes asset source URLs in the candidate document so local `data:` / `blob:` assets are visible to the guard instead of silently passing into persistence. The save audit / local save controls first upload migratable runtime image assets through the local Asset API and update their existing tldraw asset records, preserving shape references. The local load control restores tldraw assets, shapes, runtime edges and camera from the saved local document. The original seeded SVG sample was moved from an inline data URL to `apps/web/public/spikes/sample-image.svg`, so the default spike board should no longer fail save audit because of fixture data. Local board JSON is written under `.tangent-boards/`, which is ignored by Git.

2026-05-01 stabilization note:

Manual dense-board save testing exposed a tldraw image asset schema issue: migrated runtime assets must include `props.isAnimated`, otherwise `editor.updateAssets()` throws `Expected boolean, got undefined`. `runtimeAssetMigration.ts` now preserves `true` animated flags and defaults everything else to `false`. The same pass also tightened Analysis node internal layout so the output prompt area is no longer clipped by hidden compact textarea whitespace.

User retest confirms the Analysis layout and `Save local` schema error are no longer reproducing in the current local canvas spike.

---

### Slice E-B — Auth Context + Storage Adapter Contract ▶️ Active

Goal:

Prepare the local Asset API bridge for the production FastAPI / R2 path without pretending full authentication already exists.

Boundary:

This slice keeps the current Next.js local dev API working. It does not implement login UI, JWT validation or database tables yet. It adds the request-context and storage-driver seams that the production API will replace; the FastAPI side now includes a real `s3-compatible` Asset adapter, while Postgres persistence remains pending.

Scope:

- Add an API request context helper that resolves `workspaceId` and `userId`.
- Use explicit development fallback IDs for the local spike so current `/spikes/canvas` testing remains unblocked.
- Add `workspaceId` and `createdBy` to `TangentAssetRecord`.
- Add storage adapter entry points for asset and board operations.
- Keep `local-dev` as the default storage driver, while making unsupported drivers fail loudly.
- Route asset create / metadata / file reads through the adapter and request context.
- Route local board save / load through the same request context and board storage adapter, then stamp saved board records with `workspaceId` / `ownerId`.
- Route Board validate-document through request context as the same persistence preflight boundary.
- Centralize Board persistence response types so save returns summary while load returns the full document.

Acceptance:

- Existing Image Node import, Merge Capture, Screenshot and `Save local` continue to work without custom headers in local dev.
- New asset metadata contains `workspaceId` and `createdBy`.
- New local board records contain `workspaceId` and `ownerId`.
- `local-save` response does not echo the full Board document; `local-load` does.
- Unsupported `TANGENT_ASSET_STORAGE_DRIVER` / `TANGENT_BOARD_STORAGE_DRIVER` values return a clear error instead of silently falling back.
- The frontend asset upload client contract does not need to change when this local bridge later moves behind FastAPI.

Manual test:

- Open `/spikes/canvas`, import or paste an image, then run `Save local`.
- Fetch a created asset metadata record and verify it contains `workspaceId: "dev-workspace"` and `createdBy: "dev-user"` by default.
- Call `GET /api/boards/local-load?boardId=canvas-spike-local` and verify the board metadata contains `workspaceId: "dev-workspace"` and `ownerId: "dev-user"` after saving.
- Set `TANGENT_ASSET_STORAGE_DRIVER` to an unsupported value and confirm upload returns a clear configuration error.
- Set `TANGENT_BOARD_STORAGE_DRIVER` to an unsupported value and confirm local save/load returns a clear configuration error.

2026-05-01 implementation note:

Codex added `apps/web/src/app/api/_lib/apiRequestContext.ts` and `apps/web/src/app/api/assets/_lib/assetStorageAdapter.ts`. Asset create / metadata / file routes now resolve a local request context before touching storage, and `TangentAssetRecord` includes `workspaceId` and `createdBy`. The local adapter remains file-system backed under `.tangent-assets/`, but unsupported storage drivers fail explicitly. Smoke tests verified `POST /api/assets/from-data-url`, metadata GET, file GET and unsupported driver failure.

2026-05-01 continuation note:

Local board save / load now also uses the same request context. `LocalBoardRecord` includes `workspaceId` and `ownerId`; `local-load` checks workspace access before returning a saved document. Smoke tests verified clean save/load returns `dev-workspace` / `dev-user`, while documents containing `data:` asset URLs still fail with 422.

2026-05-01 board adapter note:

Codex added `apps/web/src/app/api/boards/_lib/boardStorageAdapter.ts`, mirroring the Asset storage seam for local board persistence. Local board routes now go through `getBoardStorageAdapter()`, with `TANGENT_BOARD_STORAGE_DRIVER=local-dev` as the only supported driver for this spike and unsupported drivers failing explicitly. Board persistence response types are centralized in `apps/web/src/features/boards/boardTypes.ts`; `local-save` returns a board summary without the full document, while `local-load` returns the saved document for restore. Smoke tests verified local save/load still returns `dev-workspace` / `dev-user`, save no longer echoes `document`, load does return `document`, and invalid `data:` documents still fail with 422. lint / typecheck / build / git diff --check passed.

The Board validate route now also resolves request context before auditing, so future auth-required mode applies to the full Board persistence preflight, not only save/load.

2026-05-01 FastAPI scaffold note:

Codex added a minimal fresh FastAPI scaffold under `services/api/tangent_api/`. It includes `/health`, request context parsing, Python Board document guard parity and `POST /api/v1/boards/validate-document`. It also implements local file-backed `POST /api/v1/boards` and `GET /api/v1/boards/{board_id}` using the same guard/context/summary-load contract as the Next bridge. At that moment Asset storage routes were still explicit 501 placeholders. This remains an API boundary scaffold; it does not implement DB, R2/S3, Auth/JWT, AI proxy or run logs yet. `python3 -m compileall services/api/tangent_api`, web typecheck, web lint, web build and `git diff --check` passed.

2026-05-01 FastAPI asset local-dev note:

Codex implemented local file-backed FastAPI Asset routes: `POST /api/v1/assets/from-data-url`, `POST /api/v1/assets/upload`, `GET /api/v1/assets/{asset_id}` and `GET /api/v1/assets/files/{asset_id}/{file_name}`. The Python local store mirrors the Next bridge guardrails: PNG/JPEG/WebP only, 30MB maximum, metadata with `workspaceId` / `createdBy`, optional 256/512/1024 thumbnail files, workspace-checked metadata and file reads, and explicit 501 for unsupported asset/board storage drivers. R2/S3 is still not implemented. Added `services/api/tests/test_persistence_contracts.py` for the Asset/Board persistence contract; local `pytest` is not installed in the current machine environment, so equivalent direct FastAPI TestClient smoke was run. `python3 -m compileall services/api/tangent_api`, web typecheck, web lint, web build and `git diff --check` passed.

2026-05-01 FastAPI asset adapter note:

Codex added `services/api/tangent_api/storage/asset_storage_adapter.py`. FastAPI Asset routes now call the adapter instead of importing the local store directly. `local-dev` remains the working driver; `s3-compatible` is now a configuration-aware placeholder that returns 501 and lists missing `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` and `S3_PUBLIC_BASE_URL` values. Unknown drivers also fail explicitly. Direct TestClient smoke verified local asset create / metadata / file and `s3-compatible` / unknown-driver failures. `python3 -m compileall services/api/tangent_api`, web typecheck, web lint, web build and `git diff --check` passed.

2026-05-01 R2/S3-compatible adapter implementation start:

The next sub-slice replaces the FastAPI `s3-compatible` placeholder with a real object-store adapter. The initial production-shaped contract stores originals, thumbnails and `metadata.json` under workspace-scoped object keys, keeps `originalUrl` / thumbnail URLs on the FastAPI `/api/v1/assets/files/{asset_id}/{file_name}` path so file reads can still enforce request context, and leaves Postgres persistence for a later Slice E step.

2026-05-01 R2/S3-compatible adapter implementation note:

Codex implemented `services/api/tangent_api/storage/s3_asset_store.py` and routed the FastAPI `s3-compatible` driver through it. The adapter validates `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` and `S3_SECRET_ACCESS_KEY`, uses boto3 with optional `S3_REGION` / `S3_ADDRESSING_STYLE`, writes original files, thumbnails and `metadata.json` under `workspaces/{workspace_id}/assets/{asset_id}/...`, and streams file reads through the FastAPI file route after workspace-checked metadata lookup. `local-dev` still works and now shares the same MIME / size / path / workspace helper logic. `pytest` is still unavailable in the current machine environment, so direct FastAPI TestClient smoke verified local-dev, fake S3 create/read, missing file, cross-workspace isolation, unknown driver and Board guard paths; `python3 -m compileall services/api/tangent_api` and `git diff --check` passed.

2026-05-01 Postgres persistence adapter start:

The next sub-slice adds a real Postgres persistence option without switching the frontend yet. Board save/load gets a `postgres` storage driver behind the same FastAPI contract. S3-compatible Asset storage gets optional `TANGENT_ASSET_METADATA_DRIVER=postgres`, so original/thumbnail bytes stay in object storage while metadata and workspace checks come from Postgres. Local-dev remains the default fallback.

2026-05-01 Postgres persistence adapter implementation note:

Codex implemented a FastAPI Postgres persistence seam. `TANGENT_BOARD_STORAGE_DRIVER=postgres` now routes Board save/load through `postgres_board_store.py`, preserving the Board document guard and summary-vs-load contract. `TANGENT_ASSET_METADATA_DRIVER=postgres` can be paired with `TANGENT_ASSET_STORAGE_DRIVER=s3-compatible`, so asset bytes remain in object storage while metadata and workspace checks are persisted in Postgres. The adapters use `DATABASE_URL`, optional `TANGENT_POSTGRES_AUTO_CREATE_TABLES`, and table names `tangent_boards` / `tangent_assets`. Fake Postgres TestClient coverage was added for Board save/load, S3+Postgres Asset metadata, cross-workspace isolation and missing `DATABASE_URL`; `PYTHONPATH=services/api python3 -m pytest services/api/tests` now passes locally. Source files remain below 300 lines.

2026-05-01 Web-to-FastAPI configurable switch note:

Codex added `apps/web/src/features/api/persistenceApi.ts` and updated the Web Asset upload / Board save-load clients. If `NEXT_PUBLIC_API_BASE_URL` is unset, the canvas spike keeps using the existing Next local bridge. If it is set, Asset upload posts to FastAPI `/api/v1/assets/from-data-url`, Board save posts to `/api/v1/boards`, and Board load reads `/api/v1/boards/{board_id}`. FastAPI now has a `TANGENT_ALLOWED_ORIGINS` CORS allowlist, and the Asset client rewrites FastAPI relative file URLs to absolute API URLs before creating tldraw image assets. CORS preflight is covered by tests; `PYTHONPATH=services/api python3 -m pytest services/api/tests` reports 11 passed.

2026-05-01 local runtime smoke note:

Codex ran FastAPI on `127.0.0.1:8000` with local-dev storage directories and Next dev on `localhost:3000` with `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000`. Smoke verified FastAPI `/health`, CORS preflight from `http://localhost:3000`, Web `/spikes/canvas`, FastAPI Asset create / metadata / file read, Board save / load and Board guard rejection for runtime `data:` payloads. The Next dev bundle was also checked for the compiled API base URL and `/api/v1` client routes. Smoke artifacts were cleaned and both servers were stopped.

---

## 6. Development Order

Recommended order:

1. ✅ Slice A — Image Node Moving Degrade
2. ✅ Slice B — Node LOD
3. ✅ Slice C — Local Asset Preview Resolver
4. ✅ Slice D — Ordinary Canvas Image LOD Spike
5. ✅ Quality gate — Cross-platform performance pass with notes: Windows Chrome / Edge via temporary tunnel, browser zoom, dense boards
6. ✅ Slice E-A — Local Server-Backed Asset Contract
7. ✅ Slice E-C — Board save guard / data URL migration
8. ▶️ Slice E-B — Auth context + storage adapter contract
9. Link preview backend unfurl + image proxy / asset path
10. Multiplayer collaboration

Reason:

- A and B are local UI changes with immediate performance payoff.
- C creates a stable abstraction before touching ordinary canvas image rendering.
- D is the risky tldraw integration spike.
- Cross-platform validation was a release gate after D and is now pass with notes.
- E is the next active slice and is required before collaboration.
- Collaboration should not be built on a board document that can still carry heavy image payloads.
- Windows/browser performance validation happened before real AI integration and produced non-blocking follow-up notes for dense boards.

---

## 7. Non-Goals For This Roadmap

- Do not replace tldraw.
- Do not switch to React Flow or Konva as the main canvas.
- Do not build full multiplayer yet.
- Do not build full image editor.
- Do not solve backend billing or AI provider persistence here.
- Do not persist LOD mode in board document.
- Do not remove original image fidelity.

---

## 8. Risks And Mitigations

| Risk | Mitigation |
| --- | --- |
| Custom ImageShapeUtil breaks tldraw export | Keep Slice D as spike; test export / merge / copy-paste before adopting |
| LOD flickers during zoom | Add idle recovery debounce and threshold hysteresis |
| Nodes become unusable at low zoom | Show shell only when content is unreadable anyway; restore full UI at readable zoom |
| Asset resolver creates stale URLs | Keep resolver pure and local; later integrate server cache headers / signed URL refresh |
| CRDT accidentally syncs thumbnails or data URLs | Add payload audit and board save guard before collaboration |
| Too many DOM nodes remain visible | Pair image LOD with Node LOD; consider viewport unmounting only after LOD is proven insufficient |

---

## 9. Manual Test Matrix

Small board:

- 5 images, 5 nodes.
- Verify no quality regression.
- Verify imports, Convert to Image Node, To Canvas, Merge Capture.

Medium board:

- 30 images, 30 nodes.
- Zoom 10%, 50%, 100%, 200%.
- Zoom 25%-50% with Image Nodes and ordinary canvas images mixed.
- Drag selected images.
- Pan while nodes are selected.

Dense board:

- 100 images, 50 nodes.
- Zoom to overview.
- Rapid pan / zoom.
- Select and drag images.
- Run mock nodes.
- Disconnect runtime edges.

Future collaboration readiness:

- Inspect board document payload.
- Confirm no `data:` / `blob:` / Base64 image payloads in persistent state.
- Confirm asset ids are enough to restore visual state.

Cross-platform performance readiness:

- Mac Chrome / Safari at 1080p, 2K and high-DPI display settings.
- Windows Chrome / Edge at 1080p, 2K and 4K.
- Browser zoom 90%, 100%, 125%.
- Boards with 30 images / 30 nodes and 100 images / 50 nodes.
- Track whether 25%-50% zoom remains usable after real AI output images replace mock / local test assets.

---

## 10. Quality Gates

For frontend-only slices:

```bash
npm -C apps/web run lint
npm -C apps/web run typecheck
npm -C apps/web run build
git diff --check
```

For Asset Pipeline slices:

- Add backend/API tests for upload and metadata.
- Add payload audit for board document.
- Add refresh / restore test for asset-backed images.
- Add migration notes for current local spike assets.

Source size guard:

- Keep source files under 300 lines.
- Files near 250 lines should be split before adding new behavior.

---

## 11. Open Questions

1. Which tldraw extension point is safest for ordinary image LOD?
2. Should local thumbnails be generated immediately on paste/import or lazily after first render?
3. Should Merge Capture use original source images when available or current LOD display source?
4. How should asset URLs be permissioned for shared workspaces?
5. What is the minimum thumbnail set: 256/512/1024, or 320/640/1280?
6. How much of Asset Pipeline should be done before the first multiplayer spike?

---

## 12. Definition Of Done For Collaboration Prerequisite

Before multiplayer collaboration begins:

- Board document contains no image binary payloads.
- All images resolve through asset ids.
- Image Node and ordinary canvas image can both degrade during low zoom / camera movement.
- Complex AI nodes have a low-zoom shell mode.
- 100 images + 50 nodes remain usable in production build.
- Asset upload and thumbnail generation path is defined, even if initially local or mocked.
